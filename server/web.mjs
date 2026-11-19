import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {openSourceSettings} from './source-settings.mjs';
import {SourceHub} from './hub.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function startServer({port=4317,hub,settingsFile}={}){
 if(!hub) {
  hub=new SourceHub();
  settingsFile??=path.join(process.env.RELAY_DATA_DIR || path.join(root,'.runtime','web'),'sources.json');
 }
 const settings=settingsFile ? await openSourceSettings(settingsFile,hub) : null;
 const token=randomBytes(32).toString('hex'),clients=new Set();let origin='';
 const equal=v=>typeof v==='string'&&Buffer.byteLength(v)===token.length&&timingSafeEqual(Buffer.from(v),Buffer.from(token));
 const server=http.createServer(async(req,res)=>{
  let url;try{url=new URL(req.url,'http://127.0.0.1');}catch{res.writeHead(400).end('Invalid request URL');return;}
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');
  if(req.headers.host!==origin.replace('http://','') || (req.headers.origin&&req.headers.origin!==origin)){res.writeHead(403).end('Local access only');return;}
  const saving=req.method==='POST' && url.pathname==='/api/sources' && settings;
  if(req.method!=='GET' && !saving){res.writeHead(405).end();return;}
  if(url.pathname==='/'&&equal(url.searchParams.get('token'))){res.writeHead(303,{'Set-Cookie':`relay=${token}; HttpOnly; SameSite=Strict; Path=/`,'Location':'/'}).end();return;}
  const cookie=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('relay='))?.slice(6);
  if(!equal(cookie)){res.writeHead(401).end('Open the local launch URL printed by npm run web.');return;}
  if(url.pathname==='/api/sources' && settings){
   res.setHeader('Content-Type','application/json');
   if(!saving){res.end(JSON.stringify(settings.list()));return;}
   if(req.headers.origin!==origin || req.headers['content-type']!=='application/json'){res.writeHead(403).end();return;}
   try{
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>1024*1024){res.writeHead(413).end();return;}chunks.push(chunk);}
    const {id,enabled,directories}=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    res.end(JSON.stringify(await settings.save(id,{enabled,directories})));
   }catch(error){res.writeHead(400).end(JSON.stringify({error:error.code?'无法保存来源设置。':error.message}));}
   return;
  }
  if(url.pathname==='/api/snapshot'){res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(hub.snapshot()));return;}
  if(url.pathname==='/api/events'){
   res.writeHead(200,{'Content-Type':'text/event-stream','Connection':'keep-alive'});res.write(': connected\n\n');clients.add(res);
   const ping=setInterval(()=>res.write(': heartbeat\n\n'),15000);req.on('close',()=>{clearInterval(ping);clients.delete(res);});return;
  }
  const rel=url.pathname==='/'?'index.html':url.pathname.slice(1);
  if(!(rel==='index.html'||/^src\/[\w/.-]+\.(mjs|css)$/.test(rel)||/^assets\/fonts\/[\w.-]+\.ttf$/.test(rel))||rel.split('/').includes('..')){res.writeHead(404).end();return;}
  try{const bytes=await readFile(path.join(root,rel));res.writeHead(200,{'Content-Type':rel.endsWith('.mjs')?'text/javascript':rel.endsWith('.css')?'text/css':rel.endsWith('.ttf')?'font/ttf':'text/html'}).end(bytes);}catch{res.writeHead(404).end();}
 });
 const broadcast=(type,data)=>{for(const client of clients){if(client.writableLength>1024*1024){client.end();clients.delete(client);}else client.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);}};
 hub.on('event',e=>broadcast('tool',e));hub.on('status',s=>broadcast('status',s));
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 origin=`http://127.0.0.1:${server.address().port}`;await hub.start();
 return {url:`${origin}/?token=${token}`,origin,hub,server,close:()=>{hub.stop();for(const client of clients)client.end();return new Promise(r=>server.close(r));}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const requested=Number(process.env.PORT)||4317;
 let app;try{app=await startServer({port:requested});}catch(e){if(e.code!=='EADDRINUSE')throw e;app=await startServer({port:0});}
 console.log(`Relay Atelier · local-only\n${app.url}\nCtrl+C to stop.`);
 for(const sig of ['SIGINT','SIGTERM'])process.on(sig,async()=>{await app.close();process.exit(0);});
}
