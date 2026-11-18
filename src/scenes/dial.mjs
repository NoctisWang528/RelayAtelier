import {roundedRoute,routePoint} from '../kinematics.mjs';
import {P,TAU,clamp,line,circle,rect,label,screw,panel,metal,pipe,clampJoint,dial,meter,vent,screen} from '../porcelain.mjs';
export default class Westworld{
 constructor(){this.angle=0;this.target=0;this.velocity=0;this.pulses=[];this.latest=null;this.tools=new Map();this.lastAt=-100;this.motionAt=0;this.motionFrom=0;this.motionVelocity=0;}
 sample(t){const age=Math.max(0,t-this.motionAt),d=this.motionFrom-this.target,w=Math.sqrt(36-4.25**2),b=(this.motionVelocity+4.25*d)/w,decay=Math.exp(-4.25*age),co=Math.cos(w*age),si=Math.sin(w*age);return{angle:this.target+decay*(d*co+b*si),velocity:decay*((b*w-4.25*d)*co-(d*w+4.25*b)*si)};}
 onEvent(e,t){const motion=this.sample(t);this.motionFrom=motion.angle;this.motionVelocity=motion.velocity;this.motionAt=t;let slot=this.tools.get(e.tool)?.slot;if(slot===undefined){if(this.tools.size>=32){const first=this.tools.keys().next().value;slot=this.tools.get(first).slot;this.tools.delete(first);}else slot=this.tools.size;}const previous=this.tools.get(e.tool);const targets=[...(previous?.targets||[])];if(e.target&&!targets.includes(e.target))targets.push(e.target);this.tools.set(e.tool,{...e,slot,calls:(previous?.calls||0)+(e.status==='started'?(e.visualCount||1):0),targets:targets.slice(-8)});if(e.status==='started'||!this.latest){this.latest={...e,at:t};const desired=-slot*TAU/32;const diff=((desired-this.target+Math.PI*3)%TAU)-Math.PI;this.target+=Math.abs(diff)<.005?.015:diff;}else if(e.callId===this.latest.callId)this.latest={...e,at:t};this.pulses.push({...e,at:t});this.pulses=this.pulses.slice(-60);this.lastAt=t;}
 render(c,t,dt,state){
  this.angle=state.reducedMotion?this.target:this.sample(t).angle;
  const height=state.viewport?.height||1100, compact=clamp((1100-height)/480), cy=557-(1100-height)*.51;
  const machineScale=1-compact*.18, machineY=height-10-1100*machineScale;
  const mx=x=>890+(x-870)*machineScale,my=y=>machineY+y*machineScale;
  const energy=clamp(this.pulses.reduce((sum,e)=>sum+Math.exp(-Math.max(0,t-e.at)*1.5)*.6,0)),hot=energy>.03,col=this.latest?.status==='failed'?'#cb796c':P[this.latest?.toolType]||P.gold;
  const toolSlots=new Array(32);for(const e of this.tools.values())toolSlots[e.slot]=e;
  dial(c,-963,cy,1523,this.angle,{tools:toolSlots,color:hot?col:null,openCenter:true});
  // The inner contact harness grows from observed tool bays; idle stays empty.
  if(this.tools.size){c.save();c.beginPath();c.arc(-963,cy,1523-411,0,TAU);c.clip();for(let j=0;j<6;j++){c.beginPath();c.arc(-963,cy,1063+j*5,-.72,.72);c.strokeStyle=j%2?'#a39f92':'#c9c3b4';c.lineWidth=.65;c.stroke();}
   for(const e of this.tools.values()){const a=e.slot*TAU/32+this.angle;if(Math.cos(a)<.75)continue;const n=Math.min(10,Math.max(2,e.calls)),co=Math.cos(a),si=Math.sin(a),x=-963+co*1110,y=cy+si*1110;
    for(let k=0;k<n;k++){const yy=y+(k-(n-1)/2)*8,xx=x-3-Math.abs(k-(n-1)/2)*.6;const route=roundedRoute([[xx-64,yy],[xx-50,yy],[xx-50,yy+15],[xx-22,yy+15],[xx-22,yy],[xx,yy]],5);line(c,route.points,k%3===0?'#a5a194':'#c8c3b6',.65);circle(c,xx-64,yy,1.8,P.paper,'#c0baab',.6);circle(c,xx,yy,1.1,k===n-1&&hot?'#bca443':'#a7a192');}
   }c.restore();}
  // In the reference the needle is engraved into the scale; no floating box.
  line(c,[[542,cy],[560,cy]],'#8f8b82',1.2);
  for(const y of [100,height*.28,cy,height*.72,height-45]){const x=-2308+Math.sqrt(3115**2-(y-(cy-35))**2);clampJoint(c,x,y,false);}
  // Glass paths share their centreline with the travelling energy pulse.
  const railX=y=>-2308+Math.sqrt(3115**2-(y-(cy-35))**2);
  const thirdInletY=Math.min(height*.71,my(808)-16);
  const routes=[
   [[railX(height*.28),height*.28],[837,height*.28],[837,my(779)],[mx(881),my(779)]],
   [[railX(cy),cy],[826,cy],[826,my(794)],[mx(872),my(794)]],
   [[railX(thirdInletY),thirdInletY],[813,thirdInletY],[813,my(808)],[mx(870),my(808)]],
   [[railX(height*.77),height*.77],[821,height*.77],[848,my(973)],[mx(877),my(973)]],
   [[railX(height*.842),height*.842],[813,height*.842],[846,my(991)],[mx(866),my(991)]],
   [[railX(height*.90),height*.90],[810,height*.90],[841,my(1009)],[mx(860),my(1009)]]
  ].map(p=>roundedRoute(p,25));
  routes.forEach((route,i)=>{pipe(c,route,i<3?5:4,hot?(i<3?'#c6a436':'#4dabc2')+Math.round(energy*185).toString(16).padStart(2,'0'):null);clampJoint(c,...route.points[0]);const end=route.points.at(-1),x=end[0]-(i>=3?14*machineScale:0),y=end[1];rect(c,x-4,y-4.5,12,9,1,P.white,P.edge,.75);line(c,[[x-1,y-4.5],[x-1,y+4.5]],'#b9b5ab',.7);});
  // Hanging status screen replaces the original unrelated sponsored picture.
  c.save();c.translate(825,48+compact*25);c.scale(1-compact*.1,1-compact*.1);c.translate(-825,-95);
  for(const x of [849,1171]){pipe(c,[[x,0],[x,94]],2);clampJoint(c,x,83);}
  panel(c,825,95,365,223,P.white);for(let y=102;y<310;y+=4){line(c,[[830,y],[837,y]],'#bdb7aa',.5);line(c,[[1178,y],[1185,y]],'#bdb7aa',.5);}
  screen(c,849,112,317,188,this.latest);rect(c,821,100,8,209,2,P.white,P.edge,.6);rect(c,1186,100,8,209,2,P.white,P.edge,.6);
  for(const p of [[825,100],[1190,100],[825,313],[1190,313]])screw(c,...p,2);
  c.restore();
  c.save();c.translate(870*(1-machineScale)+20,machineY);c.scale(machineScale,machineScale);
  // Flanged vacuum sight glass with small radial screws.
  const gx=925,gy=811,gr=43;
  circle(c,gx+2,gy+4,gr+8,'#dad5c9');circle(c,gx,gy,gr+8,'#fbfaf7','#c6c0b4');circle(c,gx,gy,gr,'#efebe2','#bdb6a8');const glass=c.createLinearGradient(gx-gr,gy-gr,gx+gr,gy+gr);glass.addColorStop(0,'#eeebe3');glass.addColorStop(.48,'#f5f2eb');glass.addColorStop(1,'#e8e4da');circle(c,gx,gy,gr-4,glass,'#d0c8ba');
  for(let i=0;i<16;i++){const a=i*TAU/16;screw(c,gx+Math.cos(a)*(gr+4),gy+Math.sin(a)*(gr+4),1.5);}
  for(let i=0;i<21;i++){const yy=-gr+5+i*(gr*2-10)/20,xx=Math.sqrt(Math.max(0,(gr-2)**2-yy**2));for(const side of [-1,1])line(c,[[gx+side*xx,gy+yy],[gx+side*(xx-(i%5===0?10:6)),gy+yy]],'#a9a395',.8);}
  line(c,[[gx-3,gy-gr+3],[gx+3,gy-gr+3]],'#66635b',1.2);
  if(hot){c.save();c.beginPath();c.arc(gx,gy,gr-5,0,TAU);c.clip();const fillY=gy+gr-7-energy*32,liquid=c.createLinearGradient(0,fillY,0,gy+gr);liquid.addColorStop(0,'#e5bb36');liquid.addColorStop(.15,'#e8c452bb');liquid.addColorStop(1,'#cda63c80');rect(c,gx-gr,fillY,gr*2,gr,0,liquid,null);line(c,[[gx-gr,fillY],[gx+gr,fillY]],'#b39a4b',.7);if(!state.reducedMotion)for(let i=0;i<6;i++)circle(c,gx-20+i*8,gy+gr-5-((t*13+i*7)%Math.max(1,energy*30)),.8,'#fff9d799');c.restore();}
  metal(c,gx-23,863,46,9,3);for(const xx of [gx-9,gx+9])metal(c,xx-2,872,4,28,1);metal(c,gx-28,881,56,9,2);for(const xx of [gx-20,gx+20])screw(c,xx,885,1.5);
  circle(c,960,874,8,P.white,P.edge);line(c,[[955,869],[965,879]],'#bdb5a7');line(c,[[955,879],[965,869]],'#bdb5a7');
  const support=c.createLinearGradient(873,0,981,0);support.addColorStop(0,'#e9e5dd');support.addColorStop(.26,'#fdfcf9');support.addColorStop(1,'#eeeae2');rect(c,873,1044,108,100,1,support,P.edge,.7);
  // A volumetric flask. Fill level is an animation envelope, not a fake task metric.
  c.save();c.shadowColor='#8c83751a';c.shadowBlur=7;c.shadowOffsetY=7;c.beginPath();c.moveTo(910,906);c.lineTo(943,906);c.bezierCurveTo(943,934,994,994,1000,1030);c.quadraticCurveTo(1004,1048,989,1052);c.lineTo(857,1052);c.quadraticCurveTo(839,1048,847,1030);c.bezierCurveTo(852,998,910,931,910,906);c.closePath();c.fillStyle='#f6f3ed';c.fill();c.strokeStyle=P.edge;c.lineWidth=1.2;c.stroke();c.restore();
  c.beginPath();c.moveTo(914,922);c.lineTo(940,922);c.lineTo(988,1036);c.lineTo(859,1036);c.closePath();c.fillStyle='#ede9e1';c.fill();c.strokeStyle='#bdb7aa';c.lineWidth=.65;c.stroke();if(hot){c.save();c.clip();const yy=1036-energy*42,fluid=c.createLinearGradient(0,yy,0,1040);fluid.addColorStop(0,'#5ebbd0');fluid.addColorStop(.18,'#73c1d3b0');fluid.addColorStop(1,'#5aa0b58c');rect(c,850,yy,145,90,0,fluid,null);line(c,[[850,yy],[995,yy]],'#4b9db5',1);c.restore();}
  for(let i=0;i<16;i++){const yy=925+i*7,xx=940+(yy-922)*48/114,xx2=914-(yy-922)*55/114,length=i%5===0?8:5;line(c,[[xx-length,yy],[xx,yy]],'#a7a092',.8);line(c,[[xx2,yy],[xx2+length,yy]],'#a7a092',.8);}line(c,[[908,947],[880,1020]],'#ffffffbb',2);metal(c,901,898,50,12,2);screw(c,909,904,1.5);screw(c,943,904,1.5);
  // Tall pneumatic accumulator, milled bands, regulator and service ports.
  const barrel=c.createLinearGradient(1023,0,1133,0);barrel.addColorStop(0,'#eeeae1');barrel.addColorStop(.22,'#fdfcf9');barrel.addColorStop(.56,'#f8f6f0');barrel.addColorStop(1,'#e1ddd3');c.save();c.shadowColor='#8278691c';c.shadowBlur=8;c.shadowOffsetX=5;rect(c,1023,758,110,374,2,barrel,P.edge,.75);c.restore();line(c,[[1031,764],[1031,1130]],'#fffefa',1.4);metal(c,1018,747,120,17,2);
  c.beginPath();c.moveTo(1031,747);c.lineTo(1061,701);c.lineTo(1096,701);c.lineTo(1125,747);c.closePath();c.fillStyle='#faf8f3';c.fill();c.strokeStyle=P.edge;c.stroke();metal(c,1057,696,43,12,2);rect(c,1063,690,31,7,1,P.white,P.edge);
  for(let i=0;i<5;i++)metal(c,1020,790+i*10,116,3,0);for(const xx of [1035,1120])screw(c,xx,754,1.6);line(c,[[1043,730],[1112,730]],'#dedad2',.6);
  for(const [x,y,end] of [[976,813,1020],[991,1005,1022]]){metal(c,x,y-7,end-x,14,0);rect(c,x-2,y-12,5,24,1,P.white,P.edge,.65);rect(c,end-9,y-11,10,22,2,P.white,P.edge,.7);for(const yy of [y-8,y+8])screw(c,x+.5,yy,1);screw(c,end-4,y,1.6);}
  line(c,[[1024,880],[1131,880]],'#c7c1b6',.75);line(c,[[1024,1000],[1131,1000]],'#c7c1b6',.75);
  panel(c,1037,883,63,30);rect(c,1045,890,47,14,2,P.shade,P.edge,.6);for(let j=0;j<10;j++)line(c,[[1050+j*3.5,900],[1050+j*3.5,903]],'#a8a090',.7);rect(c,1049,893,39,4,1,'#f8f6ef','#ada596',.6);panel(c,1040,925,58,14);vent(c,1045,1013,40,4);
  rect(c,1087,833,9,32,2,P.white,P.edge,.7);for(const yy of [839,858])screw(c,1091,yy,2.2);
  pipe(c,[[1092,839],[1105,839],[1122,853],[1122,1130]],5);pipe(c,[[1092,858],[1104,858],[1115,870],[1115,1130]],5);
  for(const y of [897,966,1034]){rect(c,1107,y-3,23,6,2,P.white,P.edge,.7);screw(c,1118,y,1.1);screw(c,1030,y,1.4);}
  c.restore();
  this.pulses=this.pulses.filter(e=>t-e.at<2.6);
  if(!state.reducedMotion)for(const e of this.pulses){const age=t-e.at,color=e.status==='failed'?'#be6257':e.status==='waiting'||e.status==='unknown'?P.gold:P[e.toolType]||P.gold,end=e.status!=='started';
    const route=routes[e.toolType==='files'?3:e.toolType==='search'?4:e.toolType==='agents'?5:e.toolType==='shell'?1:e.toolType==='web'?2:0];
    if(age<1.5){const distance=age/1.5;for(let j=18;j>=0;j--){const u=distance-j*.009;if(u<0||u>1)continue;const [px,py]=routePoint(route,end?1-u:u);c.save();c.globalAlpha=(1-j/19)*.8;c.shadowBlur=j===0?7:0;c.shadowColor=color;circle(c,px,py,j===0?2:1.3,color);c.restore();}}
    // Fine streaks leave the moving tool bay and collect at the cable drum.
    if(age<1.1){const slot=this.tools.get(e.tool)?.slot||0,a=slot*TAU/32+this.angle,origin=[-963+Math.cos(a)*1523,cy+Math.sin(a)*1523],rayColor=e.status==='failed'?'#be6257':end?'#519ead':'#bda029';if(origin[0]>0&&origin[1]>0&&origin[1]<height){c.save();for(let i=0;i<27;i++){const u=clamp(age/1.1+i*.009),spread=Math.sin(i*127.1)*55,reach=railX(origin[1])-origin[0]-7,x=origin[0]+reach*u,y=origin[1]+spread*(1-u*.72);c.globalAlpha=(1-age/1.1)*(.18+(i%4)*.12);line(c,[[x-(8+i%7*3),y-spread*.08],[x,y]],i%5===0?'#66645a':rayColor,i%6===0?1.2:.6);if(u>.78){line(c,[[x-3,y-3],[x+2,y+2]],rayColor,.8);}}c.restore();}}

  }
 }
}
