// Browser Canvas regression for event-driven track expansion. No real agent data.
process.env.PLAYWRIGHT_BROWSERS_PATH ||= new URL('../.runtime/playwright',import.meta.url).pathname;
const {chromium}=await import('playwright');
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {SourceHub} from '../server/hub.mjs';
import {startServer} from '../server/web.mjs';
const out='evidence/refinement/rhythm-motion';await mkdir(out,{recursive:true});
const service=await startServer({port:0,hub:new SourceHub({roots:{}})});
const browser=await chromium.launch({headless:true,executablePath:process.env.RELAY_BROWSER||chromium.executablePath()});
const report={checks:[],errors:[]};
try{
 const page=await browser.newPage({viewport:{width:1440,height:940}});page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(service.url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.relayDiagnostics?.().connected);await page.evaluate(()=>document.fonts.ready);
 report.checks=await page.evaluate(async()=>{
  const {default:Rhythm}=await import('/src/scenes/rhythm.mjs'),results=[];
  for(const height of [620,800,1100]){
   const scene=new Rhythm(),canvas=new OffscreenCanvas(1200,height),ctx=canvas.getContext('2d');
   const draw=(t,dt,reducedMotion=false)=>{ctx.clearRect(0,0,1200,height);scene.render(ctx,t,dt,{viewport:{height},reducedMotion});};
   const digest=()=>{const pixels=ctx.getImageData(0,0,1200,height).data;let h=2166136261;for(let i=0;i<pixels.length;i+=16)h=Math.imul(h^pixels[i],16777619);return h>>>0;};
   draw(0,1/60);const idle=scene.spread,idleHash=digest();
   const e={id:'rhythm-start',callId:'rhythm-call',tool:'Shell',toolType:'shell',status:'started'};scene.onEvent(e,0);
   for(let frame=1;frame<=60;frame++)draw(frame/60,1/60);
   const active=scene.spread,activeHash=digest();
   scene.onEvent({...e,id:'rhythm-failed',status:'failed'},1);
   for(let frame=61;frame<=450;frame++)draw(frame/60,1/60);
   const settled=scene.spread,calls=scene.calls.size,outcome=scene.calls.get(e.callId).event.status;
   scene.onEvent({...e,id:'second-start',callId:'second-call'},8);draw(8,0,true);const reduced=scene.spread;
   draw(20,0);const paused=scene.spread;
   for(let i=0;i<24;i++)scene.onEvent({...e,id:'burst-'+i,callId:'burst-'+i,tool:'Burst-'+i},21+i*.01);
   scene.onEvent({...e,id:'second-end',callId:'second-call',status:'completed'},22);draw(22,1/60);
   const lateResult=scene.calls.get('second-call').event.status,laneCount=scene.toolLanes.size;
   results.push({height,idle,active,settled,calls,outcome,reduced,paused,idleHash,activeHash,lateResult,laneCount});
  }
  return results;
 });
 for(const r of report.checks){assert.equal(r.idle,0);assert.ok(r.active>.99);assert.ok(r.settled<.001);assert.equal(r.calls,1);assert.equal(r.outcome,'failed');assert.equal(r.reduced,1);assert.equal(r.paused,1);assert.notEqual(r.idleHash,r.activeHash);assert.equal(r.lateResult,'completed');assert.equal(r.laneCount,16);}
 await page.setViewportSize({width:1134,height:1009});await page.locator('[data-scene=rhythm]').click();await page.locator('#focus').click();
 await page.waitForTimeout(400);await page.locator('.main-stage').screenshot({path:`${out}/reference-aspect-idle.png`});
 await page.locator('[data-mode=demo]').click();await page.waitForTimeout(4000);await page.locator('.main-stage').screenshot({path:`${out}/reference-aspect-active.png`});
 report.capture={canvasPixels:'1120×974',viewport:'1134×1009',deviceScaleFactor:1,mode:'empty Live and Demo fixtures'};
 assert.deepEqual(report.errors,[]);report.passed=true;console.log('PASS event-driven opening, return to idle, result pairing, pause and reduced motion at three heights');
}catch(error){report.passed=false;report.error=error.stack;process.exitCode=1;console.error(error.message);}
finally{report.finishedAt=new Date().toISOString();await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();await service.close();}
