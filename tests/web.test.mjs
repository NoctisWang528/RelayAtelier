import http from 'node:http';import test from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';import {startServer} from '../server/web.mjs';
class EmptyHub extends EventEmitter{async start(){}stop(){}snapshot(){return{events:[],sources:[],sessions:[],revision:0};}}
test('local fallback requires a capability cookie, rejects hostile hosts/origins and exposes only public UI',async t=>{
 const app=await startServer({port:0,hub:new EmptyHub()});t.after(()=>app.close());
 assert.equal((await fetch(app.origin+'/api/snapshot')).status,401);
 const login=await fetch(app.url,{redirect:'manual'});assert.equal(login.status,303);const cookie=login.headers.get('set-cookie').split(';')[0];assert.match(login.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
 const good=await fetch(app.origin+'/api/snapshot',{headers:{cookie}});assert.equal(good.status,200);assert.equal((await good.json()).events.length,0);
 assert.equal((await fetch(app.origin+'/api/snapshot',{headers:{cookie,origin:'https://evil.example'}})).status,403);
 const hostile=await new Promise((resolve,reject)=>{const req=http.get(app.origin+'/api/snapshot',{headers:{cookie,host:'evil.example'}},r=>{r.resume();resolve(r.statusCode);});req.on('error',reject);});assert.equal(hostile,403);
 assert.equal((await fetch(app.origin+'/server/adapters.mjs',{headers:{cookie}})).status,404);
 assert.equal((await fetch(app.origin+'/package.json',{headers:{cookie}})).status,404);
 assert.equal((await fetch(app.origin+'/src/app.mjs',{headers:{cookie}})).status,200);
 assert.equal((await fetch(app.origin+'/api/snapshot',{method:'POST',headers:{cookie}})).status,405);
});
