import {_electron as electron} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';import assert from 'node:assert/strict';
const out=process.env.RELAY_VERIFY_DIR||'evidence';await mkdir(out,{recursive:true});
const app=await electron.launch({...(process.env.RELAY_EXECUTABLE?{executablePath:process.env.RELAY_EXECUTABLE}:{}),args:process.env.RELAY_EXECUTABLE?[]:[process.env.RELAY_APP||'.'],env:{...process.env,RELAY_DATA_DIR:path.resolve('.runtime/desktop-verification')},timeout:60000});
const report={checks:[],errors:[]};const check=(name,detail)=>{report.checks.push({name,passed:true,detail});console.log('PASS',name);};
try{
 const window=await app.firstWindow();window.on('pageerror',e=>report.errors.push(e.message));await window.waitForFunction(()=>window.relayDiagnostics?.().connected,null,{timeout:45000});
 await window.waitForTimeout(1500);const real=await window.evaluate(()=>window.relayDiagnostics());assert.equal(real.mode,'live');assert.equal(real.sources.filter(s=>s.status==='connected').length,3);check('native macOS window loads all three actual sources',real);
 await window.screenshot({path:`${out}/desktop-live.png`});
 await window.locator('#pin').click();assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isAlwaysOnTop()),true);await window.locator('#pin').click();check('native always-on-top toggles and reads back');
 const security=await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];const p=w.webContents.getLastWebPreferences();return{sandbox:p.sandbox,contextIsolation:p.contextIsolation,nodeIntegration:p.nodeIntegration,url:w.webContents.getURL()};});assert.equal(security.sandbox,true);assert.equal(security.contextIsolation,true);assert.equal(security.nodeIntegration,false);check('sandboxed renderer with local file entry',security);
 await window.locator('[data-mode=demo]').click();await window.locator('[data-scene=dial]').click();await window.waitForTimeout(3200);await window.screenshot({path:`${out}/desktop-dial.png`});
 await window.locator('[data-scene=dataflow]').click();await window.waitForTimeout(3200);await window.screenshot({path:`${out}/desktop-dataflow.png`});check('desktop tool-driven scenes render');
 for (const scene of ['factory','loom']) {
  await window.locator('[data-scene='+scene+']').click();
  const stage=window.locator('#stage');
  const before=await stage.screenshot();
  const delivered=await window.evaluate(()=>relayDiagnostics().delivered);
  await window.waitForFunction(n=>relayDiagnostics().delivered>=n+3,delivered);
  assert.ok(!before.equals(await stage.screenshot()));
  await window.screenshot({path:out+'/desktop-'+scene+'.png'});
  check('native '+scene+' scene changes with Demo events',{sampleFPS:await window.evaluate(()=>relayDiagnostics().fps)});
 }
 await window.locator('[data-scene=dataflow]').click();
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(820,650));await window.waitForTimeout(500);assert.equal(await window.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await window.screenshot({path:`${out}/desktop-compact.png`});check('native window resize');
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].minimize());await window.waitForFunction(()=>!window.relayDiagnostics().windowVisible);const before=await window.evaluate(()=>window.relayDiagnostics().rendered);await new Promise(r=>setTimeout(r,3200));const after=await window.evaluate(()=>window.relayDiagnostics().rendered);assert.ok(after-before<10);check('minimized window stops animation drawing',{frames:after-before});await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].restore());
 const metrics=await app.evaluate(({app})=>app.getAppMetrics().map(p=>({type:p.type,cpu:p.cpu.percentCPUUsage,memory:p.memory.workingSetSize})));check('process resource snapshot',metrics);
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.passed=false;report.error=error.stack;process.exitCode=1;console.error(error);}finally{await app.close();await writeFile(`${out}/desktop-report.json`,JSON.stringify(report,null,2));}
