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
      window.drawFactory = (scene,time,height,reducedMotion=false,nav=null) => {
        const canvas = new OffscreenCanvas(1200,height), ctx = canvas.getContext('2d',{willReadFrequently:!!nav});
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
          if (text.startsWith('#') && ctx.getTransform().b<0) parts.push({kind:'frontId',text,font:parseFloat(ctx.font)});
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
          // The three projecting pin flanges are drawn in their pivot's local frame.
          if ([13,11,6].includes(ry) && rest[1]===Math.PI/2 && rest[2]===3*Math.PI/2) {
            const m=ctx.getTransform();
            joints.push({x:m.e,y:m.f});
          }
          ellipse(x,y,rx,ry,...rest);
        };
        scene.render(ctx,time,0,{viewport:{height,navigation:nav},reducedMotion});
        const tape = parts.find(p => p.kind==='tape');
        let ink;
        if (tape) {
          const x=tape.points.reduce((s,p)=>s+p.x/4,0), y=tape.points.reduce((s,p)=>s+p.y/4,0);
          ink = [...ctx.getImageData(Math.round(x),Math.round(y),1,1).data];
        }
        let navInk;
        if (nav) {
          // Compare the arm's horizontal sweep over the stationary cabinet and deck.
          const xs=joints.map(j=>j.x);
          const left=Math.max(nav.x,Math.floor(Math.min(...xs)-50));
          const right=Math.min(nav.x+nav.width,Math.ceil(Math.max(...xs)+50));
          const band=[left,0,right-left,nav.bottom+8];
          const actual=ctx.getImageData(...band).data, parked=nav.parked.getImageData(...band).data;
          const changed=actual.findIndex((v,i)=>v!==parked[i]);
          navInk=changed<0 ? null : [left+Math.floor(changed/4)%(right-left),Math.floor(changed/(4*(right-left)))];
        }
        return {parts,joints,slats,ink,navInk};
      };
      // Request the CPU raster path for repeatable pixel comparisons across complete frames.
      window.pixelContext = height => new OffscreenCanvas(1200,height).getContext('2d',{willReadFrequently:true});
      window.renderCanvas = (scene,t,height,ctx=pixelContext(height)) => {
        scene.render(ctx,t,0,{viewport:{height}});
        return ctx;
      };
      // Compare only pixels inside the projected face, after the rails and other boxes are painted.
      window.changedPixels = (before,after,quad) => {
        const left=Math.floor(Math.min(...quad.map(p=>p.x))), top=Math.floor(Math.min(...quad.map(p=>p.y)));
        const w=Math.ceil(Math.max(...quad.map(p=>p.x)))-left, h=Math.ceil(Math.max(...quad.map(p=>p.y)))-top;
        const a=before.getImageData(left,top,w,h).data, b=after.getImageData(left,top,w,h).data;
        const path=new Path2D();
        quad.forEach(({x,y},i)=>i ? path.lineTo(x,y) : path.moveTo(x,y));
        path.closePath();
        let count=0;
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){
          const i=(y*w+x)*4;
          if(Math.abs(a[i]-b[i])>30 && before.isPointInPath(path,left+x+.5,top+y+.5)) count++;
        }
        return count;
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

  it('prints the call ID and tool on a full-size sticker and a tool on each packed carton', async () => {
    const samples=await page.evaluate(()=>{
      const frame=(callId,toolType,phase)=>{
        const scene=testFactory(), event={...fixture(0),callId};
        scene.onEvent(event,0);
        scene.onEvent({...event,id:callId+'-end',status:'completed',toolType},.01);
        return {ctx:renderCanvas(scene,phase,620),parts:drawFactory(scene,phase,620).parts};
      };
      return [0,.4,3].map(t=>{
        const normal=frame('custom-abcd','files',t);
        const {points}=normal.parts.find(p=>p.kind==='sticker');
        return {t, ids:normal.parts.filter(p=>p.kind==='frontId'),
          glyph:changedPixels(normal.ctx,frame('custom-abcd','web',t).ctx,points),
          id:changedPixels(normal.ctx,frame('custom-0123','files',t).ctx,points)};
      });
    });
    for(const {t,glyph} of samples) assert.ok(glyph>8,`front glyph at ${t}s: ${glyph} pixels`);
    const big=samples.at(-1);
    assert.equal(big.ids[0].text,'#ABCD');
    assert.ok(big.ids[0].font>=9 && big.id>35);
  });

  it('keeps tool-specific ink visible on every carton in a mixed burst, including obscured front stickers', async () => {
    for(const height of [620,1044]){
      const boxes=await page.evaluate(height=>{
        const scene=testFactory();
        for(let i=0;i<10;i++)scene.onEvent({...fixture(i),visualCount:i===4?5:1},0);
        const records=[...scene.calls.values()].reverse(), last=records[0];
        const t=last.start+last.duration*.85, original=renderCanvas(scene,t,height);
        const {parts}=drawFactory(scene,t,height), lids=parts.filter(p=>p.kind==='lid');
        const stickers=parts.filter(p=>p.kind==='sticker');
        return records.map((r,i)=>{
          // Keep the ticket, geometry, text and paint order identical. Change only this tool mark.
          const event=r.event;
          r.event={...event,tool:'probe',toolType:/edit|write/i.test(event.tool)?'files':event.toolType==='web'?'search':'web'};
          const altered=renderCanvas(scene,t,height);
          r.event=event;
          const lid=lids[i], [a,b]=lid.points, h=lid.y-lid.points.reduce((sum,p)=>sum+p.y/4,0);
          return {tool:event.tool,front:changedPixels(original,altered,stickers[i].points),
            side:changedPixels(original,altered,[a,b,{x:b.x,y:b.y+h},{x:a.x,y:a.y+h}])};
        });
      },height);
      assert.equal(boxes.length,10);
      for(const {tool,front,side} of boxes) assert.ok(front+side>10,`${tool} lost its mark at height ${height}`);
      assert.ok(boxes.some(p=>p.front===0 && p.side>15),'exercises a carton with its front glyph completely hidden');
      assert.ok(boxes.filter(p=>p.front>10).length>=2,'prints front stickers behind the leading carton');
    }
  });

  it('turns the blades rigidly behind a circular bearing, rim and pipework, with a foreshortened roof vent', async () => {
    for(const height of [620,1100]){
      const result=await page.evaluate(height=>{
        const scene=testFactory();
        scene.onEvent(fixture(0),0);
        const [r]=scene.calls.values(), shift=130*(1100-height)/480;
        const cx=1053, cy=439-shift, rings=[], roof=[];
        const ctx=pixelContext(height);
        function observe(x,y,rx,ry) {
          const m=ctx.getTransform(), center=new DOMPoint(x,y).matrixTransform(m);
          const width=rx*Math.hypot(m.a,m.b), tall=ry*Math.hypot(m.c,m.d);
          if (Math.hypot(center.x-cx,center.y-cy)<12 && width>=12)
            rings.push({x:center.x-cx,y:center.y-cy,width,tall});
          if (Math.hypot(center.x-760,center.y-234+shift)<6 && width>=20)
            roof.push(tall/width);
        }
        const arc=ctx.arc.bind(ctx), ellipse=ctx.ellipse.bind(ctx);
        ctx.arc=(x,y,r,...args)=>{observe(x,y,r,r);arc(x,y,r,...args);};
        ctx.ellipse=(x,y,rx,ry,...args)=>{observe(x,y,rx,ry);ellipse(x,y,rx,ry,...args);};
        const span=152, pixels=c=>c.getImageData(cx-span/2,cy-span/2,span,span).data;
        const a=pixels(renderCanvas(scene,0,height,ctx));
        // The first ticket moves at constant speed until the end of its cycle.
        const quarterTurn=r.duration*Math.PI/2/(r.pitch*1320*.017);
        const b=pixels(renderCanvas(scene,quarterTurn,height));
        const vane=(data,i)=>data[i]>222; // Light metal against the recessed chamber.
        let fixedChanges=0,moving=0,union=0,overlap=0;
        for(let y=0;y<span;y++)for(let x=0;x<span;x++){
          const dx=x+.5-span/2, dy=y+.5-span/2, radius=Math.hypot(dx,dy), i=4*(y*span+x);
          const changed=a[i]!==b[i] || a[i+1]!==b[i+1] || a[i+2]!==b[i+2] || a[i+3]!==b[i+3];
          const underPlate=dx>=-23 && dx<=15 && dy>=-44 && dy<=-40;
          if(changed && (radius<20 || radius>55 || underPlate)) fixedChanges++;
          if(radius<24 || radius>37) continue;
          if(changed) moving++;
          const rotated=4*(x*span+span-1-y);
          if(vane(a,i) || vane(b,rotated)) union++;
          if(vane(a,i) && vane(b,rotated)) overlap++;
        }
        return {rings,roof,fixedChanges,moving,union,overlap};
      },height);
      assert.ok(result.rings.length>=7 && Math.max(...result.rings.map(r=>r.width))>60);
      for(const ring of result.rings) assert.deepEqual([ring.x,ring.y,ring.width],[0,0,ring.tall]);
      assert.ok(result.roof.length>=2 && result.roof.every(ratio=>ratio>.4 && ratio<.55));
      assert.equal(result.fixedChanges,0,'bearing, lip and pipe clamp stay in front of the rotor');
      assert.ok(result.moving>500 && result.union>600);
      assert.ok(result.overlap/result.union>.96,'visible blade silhouettes match after a quarter turn');
    }
  });

  it('keeps the whole moving arm below the short window’s navigation rail and preserves link reach', async () => {
    await page.setViewportSize({width:1180,height:620});
    const measurements = await page.evaluate(() => {
      const canvas=document.querySelector('.stage-canvas').getBoundingClientRect();
      const height=Math.max(620,1200*canvas.height/canvas.width);
      const scale=Math.min(canvas.width/1200,canvas.height/height);
      const top=canvas.top+(canvas.height-height*scale)/2;
      const rail=document.querySelector('.mode-rail').getBoundingClientRect();
      const left=canvas.left+(canvas.width-1200*scale)/2;
      const nav={x:Math.floor((rail.left-left)/scale), width:Math.ceil(rail.width/scale),
        bottom:Math.ceil((rail.bottom-top)/scale)};
      const measurements=[];
      for (const h of [620,Math.round(height),760,860,1044,1100]) {
        nav.parked=pixelContext(h);
        testFactory().render(nav.parked,0,0,{viewport:{height:h,navigation:nav}});
        for (const i of [0,2]) {
          const scene=testFactory(); scene.onEvent({...fixture(i),visualCount:4},0);
          const [r]=scene.calls.values();
          for (const u of [0,.09,.16,.20,.29,.34,.38,.50,.56,.66,.76,1]) {
            const {joints:[base,elbow,wrist],navInk}=drawFactory(scene,u*r.duration,h,false,nav);
            measurements.push({h,navInk,upper:Math.hypot(elbow.x-base.x,elbow.y-base.y),
              forearm:Math.hypot(wrist.x-elbow.x,wrist.y-elbow.y)});
          }
        }
      }
      return measurements;
    });
    for (const {h,navInk,upper,forearm} of measurements) {
      assert.equal(navInk,null,`paint at ${navInk} inside navigation clearance at height ${h}`);
      assert.ok(Math.abs(forearm-157)<.01);
      if (h>=1044) assert.ok(Math.abs(upper-133)<.01);
    }
  });
});
