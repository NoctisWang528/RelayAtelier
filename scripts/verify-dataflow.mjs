// A local empty source and timed Canvas samples keep tool data out of the evidence.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { SourceHub } from '../server/hub.mjs';
import { startServer } from '../server/web.mjs';
process.env.PLAYWRIGHT_BROWSERS_PATH ||= new URL('../.runtime/playwright', import.meta.url).pathname;
const { chromium } = await import('playwright');
const out = process.env.RELAY_VERIFY_DIR || 'evidence/scene-review/dataflow';
await mkdir(out, {recursive: true});
const service = await startServer({port: 0, hub: new SourceHub({roots: {}})});
const browser = await chromium.launch({headless: true, executablePath: process.env.RELAY_BROWSER || chromium.executablePath()});
const report = {checks: [], errors: []};

try {
  const page = await browser.newPage({viewport: {width: 1440, height: 940}});
  page.on('pageerror', e => report.errors.push(e.stack || e.message));
  await page.goto(service.url, {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => window.relayDiagnostics?.().connected);
  await page.evaluate(() => document.fonts.ready);
  const button = page.getByRole('button', {name: 'DataFlow', exact: true});
  await button.click();
  assert.equal(await page.locator('#scene-title').textContent(), 'DataFlow');
  assert.match(await page.locator('#stage').getAttribute('aria-label'), /^DataFlow ·/);
  await page.reload({waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => window.relayDiagnostics?.().scene === 'dataflow');
  assert.equal(await button.getAttribute('aria-current'), 'true');
  report.checks.push('DataFlow navigation, accessible scene name and persisted scene selection');

  const style = () => page.evaluate(() => ({
    canvasFilter: getComputedStyle(document.querySelector('#stage')).filter,
    statusBackground: getComputedStyle(document.querySelector('.stage-status')).background,
    statusInk: getComputedStyle(document.querySelector('.status-tally b')).color
  }));
  const substrate = () => page.evaluate(()=>{
    const pixels = document.querySelector('#stage').getContext('2d').getImageData(4,8,32,32).data;
    const rgb = [0,0,0];
    for (let i=0;i<pixels.length;i+=4) for (let k=0;k<3;k++) rgb[k]+=pixels[i+k];
    return rgb.map(sum=>Math.round(sum/1024));
  });
  await page.waitForFunction(()=>relayDiagnostics().rendered>=3);
  const paper = await style();
  const dataFlowPaper = await substrate();
  assert.ok(dataFlowPaper[0]>240 && dataFlowPaper[0]>dataFlowPaper[2]);
  assert.equal(paper.canvasFilter, 'none');
  await page.locator('[data-scene=factory]').click();
  await page.waitForTimeout(200);
  assert.deepEqual(await style(), paper);
  assert.deepEqual(await substrate(), dataFlowPaper);
  report.paperRGB = dataFlowPaper;
  await page.locator('#theme').click();
  const graphite = await style();
  assert.notEqual(graphite.canvasFilter, paper.canvasFilter);
  await button.click();
  assert.deepEqual(await style(), graphite);
  await page.waitForTimeout(150);
  await page.screenshot({path: out + '/graphite-idle.png'});
  report.checks.push('DataFlow and Factory use identical canvas and status treatment in both appearances');

  report.motion = await page.evaluate(async () => {
    const {default: DataFlow} = await import('/src/scenes/dataflow.mjs');
    const {paper} = await import('/src/porcelain.mjs');
    const {routePoint} = await import('/src/kinematics.mjs');
    const {statusColor} = await import('/src/scenes/scene-utils.mjs');
    const rows = [];
    for (const height of [620, 800, 1100]) {
      const surface = new OffscreenCanvas(1200, height);
      const ctx = surface.getContext('2d', {willReadFrequently: true});
      for (const status of ['started', 'completed', 'failed', 'waiting', 'unknown']) {
        const scene = new DataFlow();
        const event = {source:'fixture', sessionId:'local', agentId:'child', parentAgentId:'main', callId:'one', tool:'Read', toolType:'files', status};
        const active = ['started', 'waiting'].includes(status) ? [event] : [];
        const state = {viewport:{height}, reducedMotion:false, agents:[{id:'child'}], calls:[event], active, counts:{active:active.length}};
        function draw(t) {
          paper(ctx, 0, 0, 1200, height);
          scene.render(ctx, t, 1/60, state);
        }
        // Count actual signal-colored pixels near both ends, excluding the fittings.
        function signalPixels(route, fraction) {
          const [x,y] = routePoint(route, fraction);
          const pixels = ctx.getImageData(Math.round(x)-5, Math.round(y)-5, 11, 11).data;
          const hex = statusColor(event).slice(1);
          const rgb = [0,2,4].map(i => parseInt(hex.slice(i,i+2),16));
          let count = 0;
          for (let i=0;i<pixels.length;i+=4) {
            if (rgb.every((v,k) => Math.abs(v - pixels[i+k]) < 38)) count++;
          }
          return count;
        }
        draw(0);
        const route = scene.layout.ports[0].route;
        scene.onEvent(event, 0);
        const fraction = status === 'waiting' ? 1 : status === 'started' ? .23 : .77;
        draw(1.12 * .23);
        const atSignal = signalPixels(route, fraction);
        const opposite = signalPixels(route, 1-fraction);
        const born = [...scene.branches.values()][0].born;
        scene.onEvent({...event, status:'completed'}, .9);
        draw(4);
        rows.push({height, status, atSignal, opposite, branches:scene.branches.size, bornUnchanged:born === [...scene.branches.values()][0].born, pulsesAfterSettle:scene.pulses.length});
      }
    }
    return rows;
  });
  for (const r of report.motion) {
    assert.ok(r.atSignal > 0 && r.atSignal > r.opposite, JSON.stringify(r));
    assert.equal(r.branches, 1);
    assert.ok(r.bornUnchanged);
    assert.equal(r.pulsesAfterSettle, 0);
  }
  report.checks.push('Canvas pixels track outgoing calls, returning results, node-local waits and red/amber outcomes at three heights');
  assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (e) {
  report.passed = false;
  report.error = e.stack;
  process.exitCode = 1;
  console.error(e.message);
} finally {
  await writeFile(out + '/report.json', JSON.stringify(report, null, 2));
  await browser.close();
  await service.close();
  console.log(report.passed ? 'PASS' : 'FAIL', out + '/report.json');
}
