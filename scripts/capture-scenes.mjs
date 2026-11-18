// Repeatable, local-only visual review. The fixtures here are explicitly Demo.
process.env.PLAYWRIGHT_BROWSERS_PATH ||= new URL('../.runtime/playwright',import.meta.url).pathname;
const {chromium}=await import('playwright');
import {mkdir,writeFile} from 'node:fs/promises';
import {SourceHub} from '../server/hub.mjs';
import {startServer} from '../server/web.mjs';
const out=process.env.RELAY_CAPTURE_DIR||'evidence/scenes';await mkdir(out,{recursive:true});
const service=await startServer({port:0,hub:new SourceHub({roots:{}})});
const browser=await chromium.launch({headless:true,executablePath:process.env.RELAY_BROWSER||chromium.executablePath()});
const context=await browser.newContext({viewport:{width:1440,height:940},deviceScaleFactor:1,...(process.env.RELAY_RECORD?{recordVideo:{dir:out,size:{width:1440,height:940}}}:{})});
const page=await context.newPage(),video=page.video(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const metrics=[];
const modes=(process.env.RELAY_SCENES||'dial,loom,factory,chips,rhythm,slots,roulette,dataflow').split(',');
try{
 await page.goto(service.url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.relayDiagnostics?.().connected);await page.evaluate(()=>document.fonts.ready);
 for(const scene of modes){
  await page.locator('[data-mode=live]').click();await page.locator(`button[data-scene=${scene}]`).click();
  await page.setViewportSize({width:1440,height:1706});await page.waitForTimeout(450);await page.screenshot({path:`${out}/${scene}-portrait-idle.png`});
  await page.setViewportSize({width:1440,height:940});await page.waitForTimeout(450);await page.screenshot({path:`${out}/${scene}-wide-idle.png`});
  await page.locator('[data-mode=demo]').click();await page.waitForTimeout(400);await page.screenshot({path:`${out}/${scene}-motion-1.png`});
  await page.waitForTimeout(900);await page.screenshot({path:`${out}/${scene}-motion-2.png`});
  await page.waitForTimeout(1200);await page.screenshot({path:`${out}/${scene}-motion-3.png`});
  await page.waitForTimeout(1700);await page.screenshot({path:`${out}/${scene}-wide-demo.png`});
  await page.waitForTimeout(1100);metrics.push({scene,...await page.evaluate(()=>{const d=window.relayDiagnostics();return{fps:d.fps,counts:d.counts,queue:d.queue};})});console.log('CAPTURED',scene,metrics.at(-1).fps+' fps');
 }
 await writeFile(`${out}/capture-report.json`,JSON.stringify({capturedAt:new Date().toISOString(),mode:'Demo and empty Live fixtures; no real session contents',viewports:['1440×940','1440×1706'],modes,metrics,errors},null,2));
 if(errors.length)throw Error(errors.join('\n'));
}finally{await context.close();await video?.saveAs(`${out}/all-modes.webm`);await browser.close();await service.close();}
