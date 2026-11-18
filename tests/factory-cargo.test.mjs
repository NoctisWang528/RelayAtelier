import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Factory from '../src/scenes/factory.mjs';
import { demoEvent } from '../src/demo.mjs';
import { SourceHub } from '../server/hub.mjs';
import { startServer } from '../server/web.mjs';

it('pairs results by source and session, retaining the folded count and original belt ticket', () => {
  const scene = new Factory();
  const start = { ...demoEvent(0), visualCount: 6 };
  scene.onEvent(start, 0);
  scene.onEvent({ ...start, sessionId: 'second' }, 0);
  scene.onEvent({ ...start, source: 'second' }, 0);
  const [first, second, third] = scene.calls.values();
  const schedule = [first.start, first.duration, first.releaseU, scene.nextAt];
  const result = demoEvent(0, 'completed');
  for (const event of [result, result, start]) scene.onEvent(event, .4);
  assert.equal(scene.calls.size, 3);
  assert.equal(first.visualCount, 6);
  assert.equal(first.event.status, 'completed');
  assert.equal(second.event.status, 'started');
  assert.equal(third.event.status, 'started');
  assert.deepEqual([first.start, first.duration, first.releaseU, scene.nextAt], schedule);
});

it('preserves belt displacement on eviction and ignores the retired call’s late result', () => {
  const scene = new Factory();
  for (let i=0; i<120; i++) scene.onEvent(demoEvent(i), 0);
  const oldest = [...scene.calls.values()][0];
  const time = oldest.start + oldest.duration*.31;
  const distance = oldest.startU + oldest.pitch*.31;
  scene.onEvent(demoEvent(120), time);
  const [running] = scene.calls.values();
  assert.equal(running.start, time);
  assert.ok(Math.abs(running.startU-distance)<1e-12);
  const tickets = structuredClone([...scene.calls.values()]);
  const end = scene.nextAt;
  scene.onEvent(demoEvent(0, 'failed'), time+.1);
  assert.equal(scene.retired.size, 1);
  assert.equal(scene.calls.size, 120);
  assert.equal(scene.nextAt, end);
  assert.deepEqual([...scene.calls.values()], tickets);
});

describe('Factory Canvas', () => {
  let service, browser, page;
  before(async () => {
    const bundled = fileURLToPath(new URL('../.runtime/playwright',import.meta.url));
    if (existsSync(bundled)) process.env.PLAYWRIGHT_BROWSERS_PATH ??= bundled;
    const {chromium} = await import('playwright');
    browser = await chromium.launch({executablePath: process.env.RELAY_BROWSER || chromium.executablePath()});
    service = await startServer({port:0, hub:new SourceHub({roots:{}})});
    page = await browser.newPage({viewport:{width:1440,height:940}});
    await page.goto(service.url, {waitUntil:'domcontentloaded'});
    await page.locator('[data-scene=factory]').click();
    await page.evaluate(async () => {
      const {default:Factory} = await import('/src/scenes/factory.mjs');
      const {demoEvent} = await import('/src/demo.mjs');
      window.testFactory = () => new Factory();
      window.fixture = demoEvent;
      // Observe the actual Canvas paints, retaining just the parts under test.
      window.drawFactory = (scene,time,height,reducedMotion=false) => {
        const canvas = new OffscreenCanvas(1200,height), ctx = canvas.getContext('2d');
        const parts = [], joints = [], slats = [];
        const colors = {'#e9e5db':'lid','#817c71':'tape','#aaa598':'jaw','#fffcf6':'sticker'};
        let vertices = [], order = 0;
        for (const method of ['moveTo','lineTo']) {
          const original = ctx[method].bind(ctx);
          ctx[method] = (x,y) => {
            if (method==='moveTo') vertices = [];
            vertices.push([x,y]);
            original(x,y);
          };
        }
        const roundRect = ctx.roundRect.bind(ctx), fillText = ctx.fillText.bind(ctx);
        ctx.roundRect = (x,y,w,h,r) => {
          vertices = [[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
          roundRect(x,y,w,h,r);
        };
        ctx.fillText = (text,...args) => {
          if (text.startsWith('×')) parts.push({kind:'count',text});
          fillText(text,...args);
        };
        const fill = ctx.fill.bind(ctx), stroke = ctx.stroke.bind(ctx), ellipse = ctx.ellipse.bind(ctx);
        ctx.fill = () => {
          const kind = colors[ctx.fillStyle];
          if (ctx.fillStyle==='#f1ece4' && slats.length<2) slats.push(vertices[0]);
          if (kind && (kind!=='jaw' || Math.abs(vertices[0][1]-vertices[3][1]-19)<.01)) {
            const m = ctx.getTransform();
            const points = vertices.map(([x,y]) => new DOMPoint(x,y).matrixTransform(m).toJSON());
            parts.push({kind,order:order++,x:m.e,y:m.f,points});
          }
          fill();
        };
        ctx.stroke = () => {
          if (ctx.strokeStyle==='#746e63') parts.push({kind:'seam'});
          if (ctx.strokeStyle==='#c6c3ba' && ctx.lineWidth===6 && vertices.length===2 &&
              Math.abs(vertices[1][0]-vertices[0][0])>1000) parts.push({kind:'rail',order:order++});
          stroke();
        };
        ctx.ellipse = (x,y,rx,ry,...rest) => {
          if ([34,24,13].includes(rx) && ry===rx*1.08) {
            joints.push({x:x+rx*.12,y:y+rx*.08,top:y-ry-.5});
          }
          ellipse(x,y,rx,ry,...rest);
        };
        scene.render(ctx,time,0,{viewport:{height},reducedMotion});
        const tape = parts.find(p => p.kind==='tape');
        let ink;
        if (tape) {
          const x=tape.points.reduce((s,p)=>s+p.x/4,0), y=tape.points.reduce((s,p)=>s+p.y/4,0);
          ink = [...ctx.getImageData(Math.round(x),Math.round(y),1,1).data];
        }
        return {parts,joints,slats,ink};
      };
    });
  });
  after(async () => { await browser?.close(); await service?.close(); });

  it('parks for empty Live, drained and reduced motion frames', async () => {
    const results = await page.evaluate(() => {
      const scene = testFactory();
      const frames = [620,860,1100].map(h=>drawFactory(scene,0,h));
      scene.onEvent(fixture(0),0);
      return [...frames, drawFactory(scene,0,620,true), drawFactory(scene,90,620)];
    });
    for (const {parts,joints} of results) {
      assert.equal(parts.filter(p=>p.kind==='lid').length,0);
      assert.equal(parts.filter(p=>p.kind==='jaw').length,2);
      assert.equal(joints.length,3);
    }
    assert.deepEqual(results[0].joints,results[3].joints);
    assert.deepEqual(results[0].joints,results[4].joints);
  });

  it('transfers one carton from rollers to deck, keeping the jaws against opposite lid edges', async () => {
    for (const height of [620,1044,1100]) {
      const frames = await page.evaluate(h => {
        const scene = testFactory(); scene.onEvent(fixture(5),0);
        const [r] = scene.calls.values();
        return [.20-1e-6,.20+1e-6,.34,.50-1e-6,.50+1e-6,.64].map(u => drawFactory(scene,u*r.duration,h));
      },height);
      const lids = frames.map(({parts}) => {
        const lids = parts.filter(p=>p.kind==='lid');
        assert.equal(lids.length,1);
        return lids[0];
      });
      for (const [a,b] of [[0,1],[3,4]]) {
        assert.ok(Math.hypot(lids[a].x-lids[b].x,lids[a].y-lids[b].y)<.01);
      }
      assert.ok(lids[0].x>lids[4].x+60);
      assert.ok(lids[2].y<lids[0].y-30);
      assert.ok(lids[5].x>lids[4].x && lids[5].y>lids[4].y);
      const parts = frames[2].parts;
      const [back,front] = parts.filter(p=>p.kind==='jaw');
      assert.ok(back.order<lids[2].order && lids[2].order<front.order);
      const middle = (a,b) => [(a.x+b.x)/2,(a.y+b.y)/2];
      const [bl,fl,fr,br] = lids[2].points;
      // The rear pad front face meets the back lid edge. Front pad thickness is four units.
      const rearLip = middle(back.points[2],back.points[3]);
      const frontLip = middle(front.points[2],front.points[3]);
      const fromEdge = (pt,edge) => Math.hypot(pt[0]-edge[0],pt[1]-edge[1]);
      assert.ok(fromEdge(rearLip,middle(bl,br))<.01);
      assert.ok(Math.abs(fromEdge(frontLip,middle(fl,fr))-4)<.01);
    }
  });

  it('moves released cartons and tape along the slats in depth order, between the two rails', async () => {
    const frames = await page.evaluate(() => {
      const scene = testFactory();
      for (let i=0; i<10; i++) scene.onEvent(fixture(i),0);
      const r = [...scene.calls.values()][7];
      return [.60,.72].map(u=>drawFactory(scene,r.start+u*r.duration,1044));
    });
    const positions = frames.map(({parts}) => {
      const [far,near] = parts.filter(p=>p.kind==='rail');
      const boxes = parts.filter(p=>p.kind==='lid' && p.order>far.order && p.order<near.order);
      assert.equal(boxes.length,8);
      for (let i=1; i<boxes.length; i++) {
        assert.ok(boxes[i].x>boxes[i-1].x+18);
        assert.ok(boxes[i].y>boxes[i-1].y);
      }
      return boxes;
    });
    const delta = positions[1][0].x-positions[0][0].x;
    assert.ok(delta>0);
    positions[1].forEach((p,i)=>assert.ok(Math.abs(p.x-positions[0][i].x-delta)<.001));
    const slats = frames.map(frame=>frame.slats);
    const period = slats[0][1][0]-slats[0][0][0];
    const slatDelta = (slats[1][0][0]-slats[0][0][0]+period)%period;
    assert.ok(Math.abs(delta-slatDelta)<.001);
    const {ink,parts} = await page.evaluate(() => {
      const scene=testFactory(); scene.onEvent(fixture(0),0); return drawFactory(scene,3,1044);
    });
    assert.deepEqual(ink,[129,124,113,255]);
    const [left,forward,right] = parts.find(p=>p.kind==='tape').points;
    assert.ok(forward.x>left.x && forward.y>left.y && right.x>forward.x && right.y<forward.y);
  });

  it('projects distinct carton sizes and a counted bundle with one face label', async () => {
    const samples = await page.evaluate(() => [0,5,2].map((i,index) => {
      const scene = testFactory(), event = fixture(i);
      scene.onEvent(index===2 ? {...event,visualCount:6} : event,0);
      scene.onEvent(fixture(i,'completed'),.1);
      return drawFactory(scene,3,1044).parts;
    }));
    const width = parts => {
      const lid = parts.find(p=>p.kind==='lid');
      const xs = lid.points.map(p=>p.x);
      return Math.max(...xs)-Math.min(...xs);
    };
    assert.ok(width(samples[0])>130 && width(samples[0])<160);
    assert.ok(width(samples[1])>60 && width(samples[1])<80);
    const bundle = samples[2];
    assert.equal(bundle.filter(p=>p.kind==='seam').length,3);
    assert.deepEqual(bundle.filter(p=>p.kind==='count').map(p=>p.text),['×6']);
    const labels = bundle.filter(p=>p.kind==='sticker');
    assert.equal(labels.length,1);
    const [a,b,c] = labels[0].points;
    assert.ok(b.x>a.x && b.y<a.y && c.y>b.y && Math.abs(c.x-b.x)<.001);
  });

  it('keeps the moving elbow below the compact mode rail and the forearm at its designed reach', async () => {
    const {navBottom,measurements} = await page.evaluate(() => {
      const canvas=document.querySelector('.stage-canvas').getBoundingClientRect();
      const height=Math.max(620,1200*canvas.height/canvas.width);
      const scale=Math.min(canvas.width/1200,canvas.height/height);
      const top=canvas.top+(canvas.height-height*scale)/2;
      const navBottom=(document.querySelector('.mode-rail').getBoundingClientRect().bottom-top)/scale;
      const measurements=[];
      for (const h of [620,Math.round(height),760,860,1044,1100]) {
        for (const i of [0,2]) {
          const scene=testFactory(); scene.onEvent({...fixture(i),visualCount:4},0);
          const [r]=scene.calls.values();
          for (const u of [0,.09,.16,.20,.29,.34,.38,.50,.56,.66,.76,1]) {
            const {joints:[base,elbow,wrist]}=drawFactory(scene,u*r.duration,h);
            measurements.push({h,top:elbow.top,upper:Math.hypot(elbow.x-base.x,elbow.y-base.y),
              forearm:Math.hypot(wrist.x-elbow.x,wrist.y-elbow.y)});
          }
        }
      }
      return {navBottom,measurements};
    });
    for (const {h,top,upper,forearm} of measurements) {
      assert.ok(top>navBottom+8,`elbow at ${top}, navigation ends at ${navBottom} (height ${h})`);
      assert.ok(Math.abs(forearm-157)<.01);
      if (h>=1044) assert.ok(Math.abs(upper-133)<.01);
    }
  });
});
