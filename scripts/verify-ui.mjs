process.env.PLAYWRIGHT_BROWSERS_PATH ||= new URL('../.runtime/playwright',import.meta.url).pathname;
const {chromium}=await import('playwright');
import {mkdir,mkdtemp,writeFile,appendFile,rename,rm} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {SourceHub} from '../server/hub.mjs';
import {startServer} from '../server/web.mjs';
const root=path.resolve('.'),out=path.resolve(process.env.RELAY_VERIFY_DIR||'output/playwright');await mkdir(out,{recursive:true});await mkdir('.runtime',{recursive:true});
const temp=await mkdtemp(path.join(root,'.runtime','ui-fixture-')),source=path.join(temp,'claude');await mkdir(source);const logfile=path.join(source,'test-session.jsonl');await writeFile(logfile,'');
const codexSource=path.join(temp,'codex');await mkdir(codexSource);const codexLog=path.join(codexSource,'rollout-wait.jsonl');await writeFile(codexLog,JSON.stringify({type:'session_meta',payload:{id:'codex-wait-fixture'}})+'\n');
const hub=new SourceHub({roots:{claude:source,codex:codexSource},pollMs:100});const app=await startServer({port:0,hub});
const browser=await chromium.launch({executablePath:process.env.RELAY_BROWSER||chromium.executablePath(),headless:true});
const context=await browser.newContext({viewport:{width:1440,height:940},deviceScaleFactor:1,recordVideo:{dir:out,size:{width:1440,height:940}}});const page=await context.newPage();
const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));const video=page.video();
const diag=()=>page.evaluate(()=>window.relayDiagnostics());
const check=(name,detail={})=>{checks.push({name,passed:true,...detail});console.log('PASS',name,JSON.stringify(detail));};
const wait=(predicate,timeout=12000)=>page.waitForFunction(predicate,null,{timeout});
const stamp=()=>new Date().toISOString();
const record=(id,status='started',tool='Read',agent=null)=>({type:status==='started'?'assistant':'user',sessionId:'test-session',timestamp:stamp(),...(agent?{agentId:agent,isSidechain:true}:{}),message:{content:[status==='started'?{type:'tool_use',id,name:tool,input:{file_path:'/redacted/scene.mjs',command:'node fixture.mjs',url:'https://example.org/docs'}}:{type:'tool_result',tool_use_id:id,...(status==='unknown'?{}:{is_error:status==='failed'}),content:'redacted'}]}});
const append=async entries=>appendFile(logfile,entries.map(x=>JSON.stringify(x)).join('\n')+'\n');
const snap=async name=>page.screenshot({path:path.join(out,name+'.png')});
let report;
try{
 await page.goto(app.url,{waitUntil:'domcontentloaded'});await wait(()=>window.relayDiagnostics?.().connected);await page.waitForTimeout(1200);assert.equal((await diag()).counts.total,0);check('Live starts empty without manufactured calls');
 await append([record('single')]);await wait(()=>window.relayDiagnostics().counts.active===1);await page.waitForTimeout(320);await snap('dial-start');
 const first=await page.locator('#stage').screenshot();await page.waitForTimeout(500);const second=await page.locator('#stage').screenshot();assert.notEqual(createHash('sha256').update(first).digest('hex'),createHash('sha256').update(second).digest('hex'));check('single start drives actual canvas motion');
 await append([record('single','completed')]);await wait(()=>window.relayDiagnostics().counts.completed===1);assert.equal((await diag()).counts.total,1);await snap('dial-complete');check('start and completion paired as one call');
 const tools=['Read','Bash','Grep','WebFetch','Task','Edit'];
 const entries=[];for(let i=0;i<20;i++){const agent=i%3===0?'worker-a':i%3===1?'worker-b':null;entries.push(record(`parallel-${i}`,'started',tools[i%6],agent));if(i!==19)entries.push(record(`parallel-${i}`,i===4?'failed':i===8?'unknown':'completed',tools[i%6],agent));}
 await append(entries);await wait(()=>window.relayDiagnostics().agents>=3&&window.relayDiagnostics().counts.failed===1);check('three concurrent agents, explicit error and unknown status',await diag());
 await page.locator('[data-mode=demo]').click();await wait(()=>window.relayDiagnostics().mode==='demo');
 for(const scene of ['dial','dataflow','factory','chips','rhythm','loom','slots','roulette']){
  await page.locator(`[data-scene=${scene}]`).click();await page.waitForTimeout(scene==='loom'?4500:3200);assert.equal((await diag()).scene,scene);await snap(`${scene}-porcelain`);
  const a=await page.locator('#stage').screenshot();await page.waitForTimeout(650);const b=await page.locator('#stage').screenshot();assert.notEqual(createHash('sha256').update(a).digest('hex'),createHash('sha256').update(b).digest('hex'));check(`${scene} distinct active animation rendered`);
 }
 await page.locator('#theme').click();await page.locator('[data-scene=dataflow]').click();await page.waitForTimeout(1700);await snap('dataflow-graphite');await page.locator('[data-scene=dial]').click();await page.waitForTimeout(1200);await snap('dial-graphite');
 await page.locator('[data-mode=live]').click();await wait(()=>window.relayDiagnostics().counts.total===21);assert.equal(await page.locator('#total-tally').innerText(),'21');assert.equal(await page.locator('#stream-mode').innerText(),'LIVE');check('Demo isolation and Live state restored immediately in controls');
 await page.locator('#session').selectOption(hub.snapshot().events.find(e=>e.source==='claude'&&!e.parentAgentId).sessionId);await wait(()=>window.relayDiagnostics().counts.total===7);check('session filter selects seven parent calls independently of children');
 await page.locator('[data-mode=replay]').click();await wait(()=>window.relayDiagnostics().mode==='replay');await page.locator('#replay-speed').selectOption('4');await page.waitForTimeout(3000);assert.ok((await diag()).replayIndex>0);await snap('replay');check('Replay animates actual fixture history');
 await page.locator('[data-mode=live]').click();await page.locator('[data-scene=dataflow]').click();
 const burst=[];for(let i=0;i<1000;i++){burst.push(record(`burst-${i}`,'started',tools[i%6],i%2?'worker-a':null));burst.push(record(`burst-${i}`,i%31===0?'failed':'completed',tools[i%6],i%2?'worker-a':null));}
 await append(burst);await wait(()=>window.relayDiagnostics().counts.total>=1021);const dense=await diag();assert.ok(dense.queue<=240);assert.ok(dense.folded>0);check('1000-call burst preserves state and bounds animation backlog',{counts:dense.counts,queue:dense.queue,folded:dense.folded});await snap('burst-dataflow');
 await rename(source,source+'-offline');await wait(()=>window.relayDiagnostics().sources.find(s=>s.source==='claude').status==='missing');check('missing source visible');
 await rename(source+'-offline',source);await wait(()=>window.relayDiagnostics().sources.find(s=>s.source==='claude').status==='connected');await append([record('recovered'),record('recovered','completed')]);await wait(()=>window.relayDiagnostics().counts.total===1022);check('file source reconnect recovers new call');
 await context.setOffline(true);await wait(()=>!window.relayDiagnostics().connected,20000);check('transport disconnect displayed');await context.setOffline(false);await wait(()=>window.relayDiagnostics().connected,20000);check('SSE transport reconnect and state resync');
 await page.setViewportSize({width:820,height:650});await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await snap('compact-820');check('820×650 resize and controls remain on screen');await page.setViewportSize({width:1440,height:940});
 const beforeSwitch=(await diag()).counts;for(let i=1;i<=8;i++)await page.keyboard.press(String(i));assert.deepEqual((await diag()).counts,beforeSwitch);check('scene switching preserves shared state');
 await page.keyboard.press('Space');await page.waitForTimeout(300);const paused=await diag();await page.waitForTimeout(2200);const afterPause=await diag();assert.equal(afterPause.simTime,paused.simTime);assert.ok(afterPause.rendered-paused.rendered<=6);check('pause freezes simulation and lowers rendering rate');await page.keyboard.press('Space');
 await page.emulateMedia({reducedMotion:'reduce'});await wait(()=>window.relayDiagnostics().reducedMotion);check('reduced-motion preference observed');await page.emulateMedia({reducedMotion:'no-preference'});
 await page.locator('#info').click();await page.waitForTimeout(200);await snap('source-info');await page.keyboard.press('Escape');
 // Drain the bounded performance queue, then watch a real 60-second idle interval.
 await wait(()=>window.relayDiagnostics().queue===0,30000);await page.waitForTimeout(6500);
 const idleBefore=await diag();const cdp=await context.newCDPSession(page);await cdp.send('HeapProfiler.collectGarbage');const heapBefore=await cdp.send('Runtime.getHeapUsage');
 for(let i=0;i<4;i++){await page.waitForTimeout(15000);console.log('IDLE',15*(i+1),'seconds');}
 await cdp.send('HeapProfiler.collectGarbage');const heapAfter=await cdp.send('Runtime.getHeapUsage');const idleAfter=await diag();assert.deepEqual(idleAfter.counts,idleBefore.counts);assert.ok(idleAfter.rendered-idleBefore.rendered<=60*15);assert.ok(heapAfter.usedSize-heapBefore.usedSize<5e6);check('60-second idle: no synthetic calls, reduced FPS, bounded retained heap',{frames:idleAfter.rendered-idleBefore.rendered,heapBefore:heapBefore.usedSize,heapAfter:heapAfter.usedSize});await snap('idle');
 const codexRecord=payload=>({type:'response_item',timestamp:stamp(),payload});
 await appendFile(codexLog,[codexRecord({type:'function_call',name:'exec_command',call_id:'wait-process',arguments:JSON.stringify({cmd:'node fixture.mjs'})}),codexRecord({type:'function_call_output',call_id:'wait-process',output:{session_id:42,exit_code:null}})].map(JSON.stringify).join('\n')+'\n');
 await page.locator('.status-label').filter({hasText:'等待'}).first().waitFor();await snap('waiting');check('real Codex-format running process displays waiting through the file adapter');
 const waitingTotal=(await diag()).counts.total;
 await appendFile(codexLog,[codexRecord({type:'function_call',name:'write_stdin',call_id:'wait-poll',arguments:JSON.stringify({session_id:42})}),codexRecord({type:'function_call_output',call_id:'wait-poll',output:{exit_code:0}})].map(JSON.stringify).join('\n')+'\n');
 await wait(()=>!document.querySelector('.stream').textContent.includes('等待'));assert.equal((await diag()).counts.total,waitingTotal+1);check('process completion resolves original wait; only actual polling adds a distinct call');
 assert.deepEqual(errors,[]);check('no browser JavaScript errors');report={passed:true,checks,errors,finishedAt:new Date().toISOString()};
}catch(error){report={passed:false,checks,errors,error:error.stack};await snap('failure').catch(()=>{});console.error(error);process.exitCode=1;}
finally{await context.close();await video?.saveAs(path.join(out,'validation.webm'));await video?.delete();await browser.close();await app.close();await rm(temp,{recursive:true,force:true});await writeFile(path.join(out,'ui-report.json'),JSON.stringify(report,null,2));console.log('REPORT',path.join(out,'ui-report.json'));}
