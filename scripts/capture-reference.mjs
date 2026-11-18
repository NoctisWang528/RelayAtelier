process.env.PLAYWRIGHT_BROWSERS_PATH ||= new URL('../.runtime/playwright',import.meta.url).pathname;const {chromium}=await import('playwright');import {mkdir,writeFile} from 'node:fs/promises';
import {SourceHub} from '../server/hub.mjs';import {startServer} from '../server/web.mjs';
const app=await startServer({port:0,hub:new SourceHub({roots:{}})});
const browser=await chromium.launch({executablePath:process.env.RELAY_BROWSER||chromium.executablePath(),headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1700},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));await mkdir('evidence/fidelity',{recursive:true});
try{await page.goto(app.url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.relayDiagnostics);await page.waitForTimeout(700);
for(const scene of ['dial','loom','factory','chips','rhythm','slots','roulette','dataflow']){if(!await page.locator(`[data-scene=${scene}]`).count())continue;await page.locator(`[data-scene=${scene}]`).click();await page.waitForTimeout(300);await page.screenshot({path:`evidence/fidelity/${scene}-idle.png`});console.log('CAPTURE',scene);}
await page.locator('[data-mode=demo]').click();await page.waitForTimeout(5000);for(const scene of ['dial','loom','factory','chips','rhythm','slots','roulette','dataflow']){if(!await page.locator(`[data-scene=${scene}]`).count())continue;await page.locator(`[data-scene=${scene}]`).click();await page.waitForTimeout(1300);await page.screenshot({path:`evidence/fidelity/${scene}-active.png`});}
await page.setViewportSize({width:1440,height:940});await page.locator('[data-scene=dial]').click();await page.waitForTimeout(300);await page.screenshot({path:'evidence/fidelity/wide-dial.png'});
await writeFile('evidence/fidelity/capture-report.json',JSON.stringify({viewport:[1440,1700],errors},null,2));if(errors.length)process.exitCode=1;
}finally{await browser.close();await app.close();}
