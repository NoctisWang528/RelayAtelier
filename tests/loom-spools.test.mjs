import test from 'node:test';
import assert from 'node:assert/strict';
import Loom from '../src/scenes/loom.mjs';

function event(tool, callId, status='started', sessionId='one') {
  return {source:'fixture', sessionId, callId, id:`${sessionId}-${callId}-${status}`, tool, toolType:'other', status};
}

test('Loom starts with sixteen empty plaques and learns from full tool names', () => {
  const scene=new Loom();
  assert.equal(scene.spools.length,16);
  assert.ok(scene.spools.every(names=>names.size===0));
  for (const [i,tool] of ['WebFetch','WebSearch','Write','TodoWrite','NotebookEdit','Edit','Read'].entries()) {
    scene.onEvent(event(tool,String(i)),i);
  }
  const calls=[...scene.calls.values()];
  assert.deepEqual(calls.map(call=>call.spool+1),[12,2,1,9,6,3,8]);
  scene.onEvent(event('WebFetch','again'),8);
  assert.equal(scene.latest.spool,calls[0].spool);
  assert.equal(scene.spools.filter(names=>names.size).length,7);
});

test('results keep the original spool and pick, including simultaneous calls with the same external ID', () => {
  const scene=new Loom();
  scene.onEvent({...event('Read','same'),visualCount:3},0);
  const read=scene.latest;
  scene.onEvent(event('Glob','same','started','two'),0);
  const glob=scene.latest, end=scene.nextAt;
  const original=[read.spool,read.sequence,read.weaveAt,read.duration];
  for (const status of ['waiting','completed','completed','started']) {
    scene.onEvent(event('Read','same',status),10);
  }
  assert.equal(scene.calls.size,2);
  assert.equal(read.event.status,'completed');
  assert.equal(read.visualCount,3);
  assert.equal(glob.event.status,'started');
  assert.deepEqual([read.spool,read.sequence,read.weaveAt,read.duration],original);
  assert.equal(scene.nextAt,end);
  scene.onEvent(event('Glob','same','failed','two'),11);
  assert.equal(scene.latest,glob);
  assert.equal(glob.event.status,'failed');
  scene.onEvent(event('Ls','result-only','unknown'),12);
  assert.equal(scene.sequence,3);
  assert.deepEqual([scene.latest.tool,scene.latest.spool+1],['Ls',10]);
});

test('a seventeenth tool shares a spool only after all plaques are assigned', () => {
  const scene=new Loom(), first=new Map();
  for (let i=0;i<34;i++) {
    const tool=`provider.${i}.search`;
    scene.onEvent(event(tool,'call-'+i),0);
    first.set(tool,scene.latest.spool);
    assert.equal(scene.spools.filter(names=>names.size).length,Math.min(i+1,16));
  }
  assert.ok(scene.spools.every(names=>names.size>=2&&names.size<=3));
  for (const [tool,slot] of first) {
    scene.onEvent(event(tool,'again-'+tool),1);
    assert.equal(scene.latest.spool,slot);
    assert.ok(scene.spools[slot].has(tool));
  }
  assert.equal(scene.calls.size,68);
  assert.equal([...scene.spools].reduce((n,names)=>n+names.size,0),34);
});

test('burst scheduling stays ordered and a late result cannot resurrect an evicted pick', () => {
  const scene=new Loom();
  for (let i=0;i<600;i++) scene.onEvent(event('tool-'+i,'call-'+i),i*.005);
  const calls=[...scene.calls.values()];
  assert.equal(calls.length,120);
  assert.deepEqual(new Set(scene.spools.flatMap(names=>[...names])),new Set(calls.map(r=>r.tool)));
  for (let i=1;i<calls.length;i++) assert.ok(calls[i].weaveAt>=calls[i-1].weaveAt+calls[i-1].duration);
  assert.ok(scene.nextAt<=3+.30+8+1e-8);
  const end=scene.nextAt;
  scene.onEvent(event('tool-0','call-0','failed'),20);
  assert.equal(scene.sequence,600);
  assert.equal(scene.nextAt,end);
  assert.ok(!scene.spools.some(names=>names.has('tool-0')));
});

const referenceOrder=['Write','WebSearch','Edit','Grep','Glob','NotebookEdit','Shell','Read','TodoWrite','LS','LSP','WebFetch','Git','Task','Lint','Test'];

test('Shell can arrive anywhere among the 15 observed tools without displacing their slots', () => {
  for(let offset=0;offset<16;offset++){
    const scene=new Loom();
    for(let i=0;i<16;i++){
      const tool=referenceOrder[(i*7+offset)%16];
      scene.onEvent(event(tool,'call-'+i),i);
    }
    assert.deepEqual(scene.spools.map(names=>[...names]),referenceOrder.map(tool=>[tool]));
  }
});

test('seeding chooses the newest sixteen distinct actual names and reserves observed positions first', () => {
  const scene=new Loom();
  const history=referenceOrder.map((tool,i)=>({tool,timestamp:new Date(1000+i).toISOString()}));
  history[6].tool='mcp.custom';
  history[15].tool='another.custom';
  // An update to the oldest inserted call makes its tool the newest. Array order alone is insufficient.
  history.unshift({tool:'Write',timestamp:new Date(5000).toISOString()});
  history.push({tool:'old-a',timestamp:new Date(200).toISOString()},
               {tool:'old-b',timestamp:new Date(300).toISOString()},
               {tool:'unknown'}, {tool:' '}, {toolType:'shell'});
  scene.seedTools(history);
  assert.equal(scene.spools.reduce((n,names)=>n+names.size,0),16);
  history.slice(1,17).forEach(({tool},i)=>{
    if(i!==6&&i!==15)assert.deepEqual([...scene.spools[i]],[tool]);
  });
  assert.ok(scene.spools[6].has('another.custom'));
  assert.ok(scene.spools[15].has('mcp.custom'));
  assert.deepEqual([scene.latest,scene.sequence,scene.nextAt,scene.calls.size,scene.retired.size],[null,0,0,0,0]);
  scene.onEvent(event('Read','new'),4);
  assert.deepEqual([scene.latest.spool,scene.latest.sequence,scene.latest.weaveAt],[7,1,4]);
  scene.seedTools([]);
  assert.ok(scene.spools[7].has('Read'));
});

function drawLayout(scene,navBottom,methods={}){
  const noop=()=>{};
  const ctx=new Proxy({createLinearGradient:()=>({addColorStop:noop}),...methods},{get:(o,k)=>o[k]??noop});
  scene.render(ctx,10,0,{viewport:{height:800,navigation:{bottom:navBottom}}});
}

test('plaque hit tests follow the last rendered bounds, including gaps, blank and shared slots', () => {
  const scene=new Loom(),cx=485+7.5*685/16;
  scene.seedTools([{tool:'Read'}]);
  assert.deepEqual(scene.toolNamesAt(cx,69),[]);
  drawLayout(scene,0);
  assert.deepEqual(scene.toolNamesAt(cx,69),['Read']);
  assert.deepEqual(scene.toolNamesAt(cx-18,59),['Read']);
  assert.deepEqual(scene.toolNamesAt(cx+18,69),[]);
  assert.deepEqual(scene.toolNamesAt(cx,86),[]);
  assert.deepEqual(scene.toolNamesAt(cx+685/16,69),[]);
  drawLayout(scene,150);
  assert.deepEqual(scene.toolNamesAt(cx,69),[]);
  assert.deepEqual(scene.toolNamesAt(cx,172),['Read']);
  scene.seedTools([]);
  assert.deepEqual(scene.toolNamesAt(cx,172),['Read']); // Still the displayed frame.
  drawLayout(scene,150);
  assert.deepEqual(scene.toolNamesAt(cx,172),[]);
  for(let i=0;i<30;i++)scene.onEvent(event('custom-'+i,String(i)),i);
  drawLayout(scene,0);
  const shared=scene.spools.findIndex(names=>names.size>1),x=485+(shared+.5)*685/16;
  const hit=scene.toolNamesAt(x,70);
  assert.deepEqual(hit,[...scene.spools[shared]]);
  hit.pop();
  assert.deepEqual(scene.toolNamesAt(x,70),[...scene.spools[shared]]);
});

test('long floats, split picks and exposed waiting cells follow the actual call', () => {
  function stitches(tool,status){
    const scene=new Loom(),fills=[];
    scene.onEvent(event(tool,'one',status),0);
    drawLayout(scene,0,{fillRect(x,y,w,h){fills.push({x,y,w,h});}});
    return fills;
  }
  // Inspect an unrelated warp group to exclude the result mark in the tool's own cell.
  const middle=fills=>fills.filter(p=>p.x>750&&p.x<800&&p.w>p.h);
  const floats=middle(stitches('Write','completed'));
  const split=middle(stitches('WebSearch','completed'));
  assert.ok(Math.max(...floats.map(p=>p.w))>3*Math.max(...split.map(p=>p.w)));
  assert.ok(split.length>floats.length);
  const readCell=fills=>fills.filter(p=>p.x>485+7*685/16+10&&p.x<485+8*685/16-1);
  assert.ok(readCell(stitches('Read','completed')).length>0);
  assert.deepEqual(readCell(stitches('Read','waiting')),[]);
  assert.deepEqual(readCell(stitches('Read','unknown')),[]);
  assert.deepEqual(stitches('Read','completed'),stitches('Read','completed'));
});
