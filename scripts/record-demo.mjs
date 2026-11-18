process.env.PLAYWRIGHT_BROWSERS_PATH ||= new URL('../.runtime/playwright',import.meta.url).pathname;
const {chromium}=await import('playwright');
import {mkdir} from 'node:fs/promises';
import {SourceHub} from '../server/hub.mjs';
import {startServer} from '../server/web.mjs';
const out=process.env.RELAY_RECORD_DIR||'evidence';await mkdir(out,{recursive:true});
const service=await startServer({port:0,hub:new SourceHub({roots:{}})});
const browser=await chromium.launch({headless:true,executablePath:process.env.RELAY_BROWSER||chromium.executablePath()});
const context=await browser.newContext({viewport:{width:1440,height:940},recordVideo:{dir:out,size:{width:1440,height:940}}});
const page=await context.newPage(),video=page.video();
try{
 await page.goto(service.url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.relayDiagnostics?.().connected);await page.evaluate(()=>document.fonts.ready);
 await page.locator('[data-mode=demo]').click();
 for(const scene of ['dial','factory','chips','rhythm','loom','slots','roulette','dataflow']){
  await page.locator(`button[data-scene=${scene}]`).click();await page.waitForTimeout(scene==='dial'?6500:4500);console.log('RECORDED',scene);
 }
}finally{await context.close();await video.saveAs(`${out}/motion-demo.webm`);await browser.close();await service.close();}
