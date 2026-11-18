import test from 'node:test';
import assert from 'node:assert/strict';
import {roundedRoute,routePoint} from '../src/kinematics.mjs';
import Westworld from '../src/scenes/dial.mjs';
import Rhythm from '../src/scenes/rhythm.mjs';

test('energy follows rounded geometry, including both endpoints and return direction',()=>{
 const route=roundedRoute([[0,0],[100,0],[100,100]],20);
 assert.deepEqual(routePoint(route,0),[0,0]);assert.deepEqual(routePoint(route,1),[100,100]);
 const middle=routePoint(route,.5);assert.ok(middle[0]>90&&middle[0]<100);assert.ok(middle[1]>0&&middle[1]<10);
 assert.ok(route.length<200&&route.length>180);
 for(let u=0;u<1;u+=.01)assert.ok(Math.hypot(...routePoint(route,u+.01).map((v,k)=>v-routePoint(route,u)[k]))<2.01);
});

test('interrupted dial motion preserves position and velocity; status does not increment call count',()=>{
 const dial=new Westworld(),event={tool:'Read',toolType:'files',callId:'one',status:'started',target:'src/a.mjs'};
 dial.onEvent(event,0);const before=dial.sample(.15);
 dial.onEvent({...event,tool:'Shell',callId:'two'},.15);const after=dial.sample(.15);
 assert.ok(Math.abs(before.angle-after.angle)<1e-10);assert.ok(Math.abs(before.velocity-after.velocity)<1e-10);
 dial.onEvent({...event,status:'completed'},.5);assert.equal(dial.tools.get('Read').calls,1);
 assert.ok(Math.abs(dial.sample(10).angle-dial.target)<1e-10);
});

test('Rhythm keeps repeated tools in their lane and results on their original note',()=>{
 const scene=new Rhythm(),read={id:'read-start',callId:'read-one',tool:'Read',toolType:'files',status:'started'};
 scene.onEvent(read,0);scene.onEvent({...read,id:'read-two-start',callId:'read-two'},.1);
 const first=scene.calls.get('read-one').lane;assert.equal(scene.calls.get('read-two').lane,first);
 scene.onEvent({...read,id:'read-end',status:'failed'},.2);
 assert.equal(scene.calls.size,2);assert.equal(scene.calls.get('read-one').lane,first);assert.equal(scene.calls.get('read-one').event.status,'failed');
 for(let i=0;i<24;i++)scene.onEvent({...read,id:'tool-'+i,callId:'tool-'+i,tool:'tool-'+i},1+i*.1);
 assert.equal(scene.toolLanes.size,16);assert.equal(new Set(scene.toolLanes.values()).size,16);
 assert.equal(scene.calls.get('read-one').lane,first);
});
