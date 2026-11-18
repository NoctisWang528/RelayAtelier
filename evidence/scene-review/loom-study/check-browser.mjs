// Run from the project root. The server serves only the memory fixture below.
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {writeFile} from 'node:fs/promises';
import {startServer} from '../../../server/web.mjs';
process.env.PLAYWRIGHT_BROWSERS_PATH ||= new URL('../../../.runtime/playwright',import.meta.url).pathname;
const {chromium}=await import('playwright');
const out=name=>new URL(name,import.meta.url);
const history=['Git','WebSearch'].flatMap((tool,i)=>['started','completed'].map((status,j)=>({
  id:`fixture-${i}-${j}`,callId:'fixture-'+i,sessionId:'fixture',agentId:'fixture',source:'fixture',
  tool,toolType:'other',status,timestamp:new Date(100000+i*600+j*150).toISOString()
})));
const hub=Object.assign(new EventEmitter(),{start(){},stop(){},snapshot:()=>({events:history,sources:[],sessions:[{id:'fixture',source:'fixture'},{id:'empty',source:'fixture'}]})});
const service=await startServer({port:0,hub});
const browser=await chromium.launch({headless:true,executablePath:chromium.executablePath()});
const checks=[],errors=[];
try {
 const page=await browser.newPage({viewport:{width:1134,height:1009}});
 page.setDefaultTimeout(12000);
 page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 page.on('response',r=>{if(r.status()>=400)console.error(r.status(),new URL(r.url()).pathname);});
 await page.addInitScript(()=>{
  const proto=CanvasRenderingContext2D.prototype, reset=proto.setTransform, drawText=proto.fillText;
  proto.setTransform=function(...args){
   if(this.canvas.id==='stage')window.stageText=[];
   return reset.apply(this,args);
  };
  proto.fillText=function(text,x,y,...rest){
   if(this.canvas.id==='stage'){
    const point=new DOMPoint(x,y).matrixTransform(this.getTransform());
    window.stageText.push({text,x,y,px:point.x,py:point.y});
   }
   return drawText.call(this,text,x,y,...rest);
  };
 });
 await page.goto(service.url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.relayDiagnostics?.().connected);
 await page.locator('[data-scene=loom]').click();
 await page.locator('#focus').click();
 await page.evaluate(()=>document.fonts.ready);
 const waitForRows=n=>page.waitForFunction(n=>window.stageText.some(p=>p.text===n+' ROWS'),n);
 const plaques=()=>page.evaluate(()=>window.stageText.filter(p=>p.x>=485&&p.x<=1170&&p.y>40&&p.y<110).map(p=>p.text));
 await waitForRows(0);
 const historyLabels=['GIT','…CH'].sort();
 assert.deepEqual((await plaques()).sort(),historyLabels);
 assert.equal(await page.evaluate(()=>window.relayDiagnostics().counts.total),2);
 const stage=page.locator('#stage');
 const web=await page.evaluate(()=>window.stageText.find(p=>p.text==='…CH'));
 await stage.hover({position:{x:web.px,y:web.py}});
 assert.equal(await stage.getAttribute('title'),'WebSearch');
 await page.locator('.main-stage').screenshot({path:out('host-live-seeded.png').pathname});
 await page.locator('#focus').click();
 await page.locator('#session').selectOption('empty');
 await page.waitForFunction(()=>window.relayDiagnostics().counts.total===0&&!window.stageText.some(p=>p.text==='GIT'));
 await page.locator('#focus').click();
 await waitForRows(0);
 assert.deepEqual(await plaques(),[]);
 await page.locator('.main-stage').screenshot({path:out('host-live-idle.png').pathname});
 checks.push('Live snapshot seeds two tool labels, zero woven rows and a full hover title. Selecting an empty session clears the strip.');
 await page.locator('[data-mode=demo]').click();
 await waitForRows(2);
 assert.ok((await plaques()).includes('…AD'));
 await page.locator('[data-scene=chips]').click();
 await page.locator('[data-scene=loom]').click();
 await page.waitForFunction(()=>window.stageText.some(p=>p.text==='…AD'));
 await page.locator('.main-stage').screenshot({path:out('host-demo.png').pathname});
 checks.push('Demo builds its own plaques and cloth and retains them across a scene switch.');
 await page.locator('[data-mode=replay]').click();
 await page.waitForFunction(()=>window.stageText.some(p=>p.text==='GIT'));
 await waitForRows(2);
 assert.deepEqual((await plaques()).sort(),['GIT','…CH'].sort());
 await page.locator('#pause').click();
 await page.waitForTimeout(550);
 const paused=await page.locator('#stage').screenshot();
 await page.waitForTimeout(550);
 assert.deepEqual(await page.locator('#stage').screenshot(),paused);
 await page.locator('#pause').click();
 await page.locator('#replay-restart').click();
 await waitForRows(0);
 await waitForRows(2);
 assert.deepEqual((await plaques()).sort(),['GIT','…CH'].sort());
 checks.push('Replay uses only the two fixture calls. Pause freezes the raster and restart produces two rows again.');
 await page.locator('[data-mode=live]').click();
 await waitForRows(0);
 assert.deepEqual((await plaques()).sort(),historyLabels);
 assert.ok(await page.evaluate(()=>window.stageText.some(p=>p.text==='NO TOOL INPUT')));
 checks.push('Returning to Live restores historical labels with zero rows and no selected tool.');

 const result=await page.evaluate(async()=>{
  const {default:Loom}=await import('/src/scenes/loom.mjs'),{paper}=await import('/src/porcelain.mjs');
  const scene=new Loom(),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
  const width=1120,height=974,scale=width/1200,navBottom=65;
  canvas.width=width;canvas.height=height;
  const draw=(t,reducedMotion=false)=>{
   ctx.setTransform(scale,0,0,scale,0,0);paper(ctx,0,0,1200,height/scale);
   scene.render(ctx,t,0,{viewport:{height:height/scale,navigation:{bottom:navBottom}},reducedMotion});
  };
  const fixture=['Write','WebSearch','Edit','Grep','Glob','NotebookEdit','Read','TodoWrite','LS','LSP','WebFetch','Git','Task','Lint','Test','fixture.exec_command'];
  // Unequal bursts expose each tool's floats and the run of open Read cells in one still.
  const rows=fixture.map(tool=>({tool,status:'completed'}));
  for(const [tool,n,status='completed'] of [
   ['Read',10,'waiting'],['WebSearch',6],['Write',7],['Read',8,'unknown'],['Task',3],
   ['Git',5],['NotebookEdit',8],['WebFetch',4],['Grep',6],['Glob',8],['Lint',4],['Test',7],['Read',8]
  ])for(let j=0;j<n;j++)rows.push({tool,status});
  const events=[];
  for(const [i,{tool,status}] of rows.entries()){
   const event={id:'start-'+i,callId:'call-'+i,sessionId:'fixture',source:'fixture',tool,toolType:'other',status:'started'};
   scene.onEvent(event,i*.4);
   if(i!==22)scene.onEvent({...event,id:'result-'+i,status},i*.4+.31);
   events.push(event);
  }
  scene.onEvent({...events[0],id:'active',callId:'active',tool:'WebFetch'},40);
  draw(40.15);const active=canvas.toDataURL();
  draw(40,true);const reduced=canvas.toDataURL();
  draw(44);const settled=canvas.toDataURL(),before=ctx.getImageData(0,0,width,height).data;
  scene.onEvent({...events[22],id:'late-failure',status:'failed'},44);
  draw(45);const after=ctx.getImageData(0,0,width,height).data;
  const delta=[];
  for(let y=148;y<520;y++)for(let x=458;x<1080;x++){
   const offset=(y*width+x)*4;
   if(before[offset]!==after[offset]||before[offset+1]!==after[offset+1]||before[offset+2]!==after[offset+2])delta.push([x,y]);
  }
  return {active,match:reduced===settled,hasMotion:active!==settled,latePixels:delta.length,
   bounds:delta.length?[Math.min(...delta.map(p=>p[0])),Math.min(...delta.map(p=>p[1])),Math.max(...delta.map(p=>p[0])),Math.max(...delta.map(p=>p[1]))]:null,
   spool:scene.latest.spool+1,rows:scene.calls.size};
 });
 const {active,...metrics}=result;
 await writeFile(out('canvas-100-rows-fixture.png'),Buffer.from(active.split(',')[1],'base64'));
 assert.ok(metrics.match&&metrics.hasMotion);
 assert.equal(metrics.spool,8);assert.equal(metrics.rows,101);
 assert.ok(metrics.latePixels>0&&metrics.bounds[2]-metrics.bounds[0]<16&&metrics.bounds[3]-metrics.bounds[1]<6,JSON.stringify(metrics));
 const expectedX=(485+7.5*685/16)*1120/1200,expectedY=(136+22+22*4+2)*1120/1200;
 assert.ok(Math.abs((metrics.bounds[0]+metrics.bounds[2])/2-expectedX)<2);
 assert.ok(Math.abs((metrics.bounds[1]+metrics.bounds[3])/2-expectedY)<2);
 checks.push('Reduced motion raster equals settled raster. Updating one woven result changes only its small stitch under spool 8 within the cloth.');
 assert.deepEqual(errors,[]);
 await writeFile(out('browser-results.json'),JSON.stringify({checks,metrics,errors},null,2)+'\n');
 console.log(checks.join('\n'),metrics);
}finally{await browser.close();await service.close();}
