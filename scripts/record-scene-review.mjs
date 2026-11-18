// Replay the same synthetic history through three normal UI scenes. All sources
// are isolated here so that the recorded window contains only fixture data.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { SourceHub } from '../server/hub.mjs';
import { startServer } from '../server/web.mjs';
process.env.PLAYWRIGHT_BROWSERS_PATH ||= new URL('../.runtime/playwright', import.meta.url).pathname;
const { chromium } = await import('playwright');

const out = path.resolve(process.env.RELAY_RECORD_DIR || 'evidence/scene-review/replay');
await mkdir(out, {recursive: true});
await mkdir('.runtime', {recursive:true});
const source = await mkdtemp(path.resolve('.runtime/scene-review-'));
const names = ['Read','Grep','Shell','Glob','Write','WebFetch','Edit','WebSearch','Task','NotebookEdit','LSP','Git','Lint','Test','TodoWrite','LS'];
const repeated = ['Read','Read','Read','Grep','Edit','Edit','Shell','Shell','Shell','WebFetch','Grep','Write','Write','Task','Read','Test'];
const seed = Date.UTC(2026, 0, 1);
const records = [];
for (let i = 0; i < 48; i++) {
  const tool = i < names.length ? names[i] : repeated[(i - names.length) % repeated.length];
  const id = 'sample-' + i;
  const at = seed + i * 225;
  const date = t => new Date(t).toISOString();
  const session = {sessionId:'scene-review', ...(i % 4 === 3 ? {agentId:'worker-' + (i % 3)} : {})};
  records.push({...session, timestamp:date(at), type:'assistant', message:{content:[{
    type:'tool_use', id, name:tool, input:{file_path:'sample/module.js', command:'npm test', url:'https://example.org/'}
  }]}});
  records.push({...session, timestamp:date(at + 800 + i % 4 * 160), type:'user', message:{content:[{
    type:'tool_result', tool_use_id:id, ...(i % 17 === 6 ? {} : {is_error:i % 13 === 7}), content:'sample'
  }]}});
}
records.sort((a,b) => a.timestamp.localeCompare(b.timestamp));
await writeFile(path.join(source, 'fixture.jsonl'), records.map(r=>JSON.stringify(r)).join('\n')+'\n');
const service = await startServer({port:0, hub:new SourceHub({roots:{claude:source}})});
const browser = await chromium.launch({headless:true, executablePath:process.env.RELAY_BROWSER || chromium.executablePath()});
const size = {width:1440, height:940};
const context = await browser.newContext({viewport:size, recordVideo:{dir:out, size}});
const page = await context.newPage(), video = page.video();
const report = {source:'Replay of generated fixture history. No model or user sessions.', calls:48, transitions:96, size, scenes:[], errors:[]};
page.on('pageerror', e=>report.errors.push(e.message));
try {
  await page.goto(service.url, {waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.relayDiagnostics?.().counts.total===48);
  await page.evaluate(()=>document.fonts.ready);
  await page.locator('[data-mode=replay]').click();
  for (const scene of ['factory','loom','dataflow']) {
    await page.locator('[data-scene='+scene+']').click();
    await page.locator('#replay-restart').click();
    await page.waitForFunction(()=>relayDiagnostics().counts.total>=8);
    await page.screenshot({path:path.join(out,scene+'-early.png')});
    await page.waitForFunction(()=>relayDiagnostics().counts.total>=34);
    await page.screenshot({path:path.join(out,scene+'-active.png')});
    await page.waitForFunction(()=>relayDiagnostics().replayIndex===96 && relayDiagnostics().queue===0);
    const result = await page.evaluate(()=>{
      const {scene, mode, counts, agents, folded, delivered} = relayDiagnostics();
      return {scene, mode, counts, agents, folded, delivered};
    });
    assert.equal(result.mode,'replay');
    assert.equal(result.scene,scene);
    assert.equal(result.counts.total,48);
    assert.equal(result.counts.failed,4);
    assert.equal(result.counts.unknown,3);
    assert.equal(result.delivered,96);
    report.scenes.push(result);
    console.log('RECORDED',scene);
  }
  // Capture the same near-square scene area as the official 1120×974 clip.
  // A second context keeps these size changes out of the landscape recording.
  await page.close();
  const square = await browser.newPage({viewport:{width:1134,height:1009}});
  square.on('pageerror', e=>report.errors.push(e.message));
  // Locate the printed name from the actual frame, including the responsive plaque rack.
  await square.addInitScript(()=>{
    const fillText=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...args){
      if(this.canvas.id==='stage' && text==='Read' && this.textAlign==='center'){
        const point=new DOMPoint(x,y).matrixTransform(this.getTransform());
        const box=this.canvas.getBoundingClientRect();
        window.readPlaque={x:box.left+point.x*box.width/this.canvas.width,
                          y:box.top+point.y*box.height/this.canvas.height};
      }
      return fillText.call(this,text,x,y,...args);
    };
  });
  await square.goto(service.url, {waitUntil:'domcontentloaded'});
  await square.waitForFunction(()=>window.relayDiagnostics?.().connected && relayDiagnostics().counts.total===48);
  await square.locator('#focus').click();
  await square.locator('[data-scene=loom]').click();
  const beforeLoom = await square.evaluate(()=>relayDiagnostics().rendered);
  await square.waitForFunction(n=>relayDiagnostics().rendered>n+1,beforeLoom);
  await square.waitForFunction(()=>Boolean(window.readPlaque));
  const readPlaque = await square.evaluate(()=>window.readPlaque);
  await square.mouse.move(readPlaque.x, readPlaque.y);
  await square.waitForFunction(()=>/read/i.test(document.querySelector('#stage').title),null,{timeout:3000});
  assert.equal(await square.evaluate(()=>relayDiagnostics().delivered),0);
  report.historyPlaque = 'Read identified from fixture history before any animated event';
  await square.mouse.move(10,10);
  await square.locator('.main-stage').screenshot({path:path.join(out,'loom-fixture-history.png')});
  await square.locator('[data-mode=replay]').click();
  for (const scene of ['factory','loom']) {
    await square.locator('[data-scene='+scene+']').click();
    await square.locator('#replay-restart').click();
    await square.waitForFunction(()=>relayDiagnostics().delivered>=64);
    await square.locator('.main-stage').screenshot({path:path.join(out,scene+'-reference-aspect.png')});
  }
  await square.close();
  assert.deepEqual(report.errors,[]);
  report.passed = true;
} catch(e) {
  report.passed = false;
  report.error = e.stack;
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await context.close();
  await video.saveAs(path.join(out,'three-scenes.webm'));
  await video.delete();
  await browser.close();
  await service.close();
  await rm(source, {recursive:true, force:true});
  await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
}
