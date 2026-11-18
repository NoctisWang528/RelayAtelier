import { EDGE, ENAMEL, INK, MUTED, box, clamp, ease, glyph, label, lerp, line, metal, panel, pipe, polygon, screw, serial, short, statusColor, statusMark, uncertain, upsertCall } from './scene-utils.mjs';
const TRAVEL=2.45;
function track(u,d,top=180,strike=700,span=128,mouth=40){const p=(Math.exp(clamp(d)*1.8)-1)/(Math.exp(1.8)-1),x=600+(u-.5)*span,y=strike+850-Math.sqrt(850**2-(x-600)**2);return[lerp(600+(u-.5)*mouth,x,p),lerp(top,y,p)];}
function hung(ctx,x,y,w,h,title){
 for(const xx of [x+38,x+w-38]){pipe(ctx,[[xx,0],[xx,y]],4);panel(ctx,xx-6,y-7,12,15);}
 panel(ctx,x,y,w,h);label(ctx,title,x+13,y+15,11,MUTED);box(ctx,x+9,y+27,w-18,h-36,2,'#efede6','#b9b5ab');
}
function counter(ctx,value,x,y,size,color=INK,align='center'){
 ctx.save();ctx.font=`700 ${size}px ComicMono, ui-monospace, monospace`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(String(value),x,y);ctx.restore();
}
function timingWheel(ctx,strike){
 const cx=600,cy=strike+850,radius=850,start=-Math.PI*.9,end=-Math.PI*.1;
 const at=(r,a)=>[cx+Math.cos(a)*r,cy+Math.sin(a)*r];
 const band=(outer,inner,fill,stroke='#c9c5bc')=>{
  ctx.beginPath();ctx.arc(cx,cy,outer,start,end);ctx.arc(cx,cy,inner,end,start,true);ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=.7;ctx.stroke();
 };
 const rim=ctx.createLinearGradient(0,strike-20,0,strike+13);rim.addColorStop(0,'#fffefa');rim.addColorStop(.45,'#f5f3ed');rim.addColorStop(.8,'#e4e0d7');rim.addColorStop(1,'#fffefa');
 ctx.save();ctx.shadowColor='#81796818';ctx.shadowBlur=9;ctx.shadowOffsetY=4;band(radius+18,radius-10,rim);ctx.restore();
 band(radius+5,radius-10,'#fcfbf8');band(radius-10,radius-18,'#ece9e1');band(radius-18,radius-50,'#fffefa');
 band(radius-50,radius-139,'#faf9f6');band(radius-139,radius-148,'#fffefa');band(radius-148,radius-165,'#fffefa');
 band(radius-165,radius-175,'#e8e4db');band(radius-175,radius-200,'#f6f3ed');band(radius-200,radius-385,'#eeebe3');
 for(let i=0;i<=Math.ceil((end-start)*radius/3.3);i++){
  const a=start+i*3.3/radius,major=i%25===0,medium=i%5===0;
  line(ctx,[at(radius-19,a),at(radius-(major?43:medium?32:25),a)],major?'#8e897f':'#b2ada3',major?.9:.5);
  if(i%20===0)screw(ctx,...at(radius-3,a),2.3);
  if(i%3===0)line(ctx,[at(radius-148,a),at(radius-(i%15===0?159:153),a)],'#aaa59a',.6);
 }
 // Fixed bridges and the inner bolt circle are present in the reference, with no invented dial values.
 for(let a=-Math.PI*.88;a<-Math.PI*.12;a+=.34){
  line(ctx,[at(radius-53,a),at(radius-136,a)],'#c2bdb2',3);
  line(ctx,[at(radius-53,a),at(radius-136,a)],'#fdfcf9',1.7);
  for(const r of [radius-55,radius-134])screw(ctx,...at(r,a),1.4);
 }
 for(let a=start;a<end;a+=.083)screw(ctx,...at(radius-186,a),2);
 for(let r=radius-225;r>radius-385;r-=26){ctx.beginPath();ctx.arc(cx,cy,r,start,end);ctx.strokeStyle='#d1ccc1';ctx.lineWidth=.65;ctx.stroke();}
 for(let a=start;a<end;a+=.09)line(ctx,[at(radius-201,a),at(radius-385,a)],'#d4cfc4',.65);
}
export default class Rhythm{
 constructor(){this.calls=new Map();this.eventCount=0;this.combo=0;this.lastEventAt=-Infinity;this.toolLanes=new Map();this.spread=0;}
 onEvent(event,t){const{record,fresh,changed}=upsertCall(this.calls,event,t);if(fresh){const key=event.tool||event.toolType||'other';let lane=this.toolLanes.get(key);if(lane===undefined){if(this.toolLanes.size===16){const oldest=this.toolLanes.keys().next().value;lane=this.toolLanes.get(oldest);this.toolLanes.delete(oldest);}else lane=[7,9,5,11,3,13,1,15,6,8,4,10,2,12,0,14][this.toolLanes.size];this.toolLanes.set(key,lane);}record.lane=lane;}if(changed){this.eventCount++;this.combo=t-this.lastEventAt<1.6?Math.min(99,this.combo+1):1;this.lastEventAt=t;}}
 render(ctx,t,dt,state={}){
  ctx.save();const height=clamp(state.viewport?.height??1100,620,1100),amount=(1100-height)/480,top=lerp(180,110,amount),strikeY=lerp(680,436,amount);
  const open=t-this.lastEventAt<3.3?1:0;this.spread=state.reducedMotion?open:lerp(this.spread,open,1-Math.exp(-Math.max(0,dt)*(open?7:2.5)));
  const point=(u,d)=>track(u,d,top,strikeY,lerp(lerp(128,190,amount),560,this.spread),lerp(40,150,this.spread));
  const records=[...this.calls.values()],latest=records.reduce((a,r)=>!a||r.changedAt>=a.changedAt?r:a,null),combo=t-this.lastEventAt<3?this.combo:0;
  const nav=state.viewport?.navigation,navOverlap=nav&&(nav.left<261||nav.right>940);
  ctx.save();ctx.translate(0,Math.max(-52-21*amount,navOverlap?nav.bottom+10-91:-Infinity));
  hung(ctx,9,91,252,167,'EVENT COUNT');counter(ctx,String(this.eventCount).padStart(7,'0'),135,169,46);line(ctx,[[29,217],[240,217]],'#d3cfc4',.6);label(ctx,'EVENT CADENCE / NOT TASK QUALITY',135,236,8,MUTED,'center');
  hung(ctx,940,91,251,167,'TOOL TRANSMISSION');
  const g=ctx.createLinearGradient(951,128,1178,247);g.addColorStop(0,'#f0eee7');g.addColorStop(1,latest?`${statusColor(latest.event)}35`:'#e5e7df');box(ctx,951,128,229,118,1,g,'#d0cbc0');
  if(latest){glyph(ctx,latest.event.toolType,978,157,16,statusColor(latest.event));label(ctx,short(latest.event.tool,17),966,193,17,INK);label(ctx,short(latest.event.target,27),966,215,9,MUTED);statusMark(ctx,latest.event.status,1157,159,11,statusColor(latest.event));label(ctx,latest.event.status.toUpperCase(),966,236,8,statusColor(latest.event));}
  else{label(ctx,'Awaiting',966,167,22,INK);label(ctx,'tool calls.',966,194,22,INK);label(ctx,'LOCAL EVENT FEED',966,233,8,MUTED);}
  ctx.restore();
  line(ctx,[[285,top],[916,top]],'#c5c1b5',.8);line(ctx,[[285,top+3],[916,top+3]],'#fffefa',.7);
  // This skyline is recent observed call cadence, not a looping equalizer.
  for(let i=0;i<40;i++){const n=records.filter(r=>{const age=t-r.born;return age>=i*.3&&age<(i+1)*.3;}).length;if(n){const h=Math.min(43,n*7),x=901-i*15.5;box(ctx,x,top-6-h,12,h,0,'#b6b1a47a');}}
  polygon(ctx,[[600,top-4],[604,top],[600,top+4],[596,top]],'#6b685e');
  const leftTop=point(0,0),rightTop=point(1,0),leftEnd=point(0,1),rightEnd=point(1,1);
  polygon(ctx,[leftTop,rightTop,rightEnd,leftEnd],'#fffefa55');
  for(let i=0;i<=16;i++){
   const u=i/16,outer=i===0||i===16;
   if(outer){line(ctx,[point(u,0),point(u,1)],'#d5d1c7',3.4);line(ctx,[point(u,0),point(u,1)],'#aaa69c',.9);line(ctx,[point(u+.009,0),point(u+.009,1)],'#fffefa',.8);}
   else {const rail=ctx.createLinearGradient(0,top,0,strikeY);rail.addColorStop(0,`rgba(118,113,103,${.025+.07*this.spread})`);rail.addColorStop(.55,`rgba(118,113,103,${.04+.30*this.spread})`);rail.addColorStop(1,`rgba(118,113,103,${.08+.72*this.spread})`);line(ctx,[point(u,0),point(u,1)],rail,.5+this.spread*.8);}
  }
  for(let d=.2;d<1;d+=.1){const pts=[];for(let k=0;k<=16;k++)pts.push(point(k/16,d));line(ctx,pts,'#d9d4c52d',.5);}
  timingWheel(ctx,strikeY+16);
  const strike=[];for(let i=0;i<=32;i++)strike.push(point(i/32,1));
  ctx.save();ctx.shadowColor='#81796622';ctx.shadowBlur=3;ctx.shadowOffsetY=3;line(ctx,strike,'#c3beb3',5);ctx.restore();
  line(ctx,strike,'#fdfcf9',3);line(ctx,strike.map(([x,y])=>[x,y+2]),'#a9a397',.7);
  for(const p of [leftEnd,rightEnd]){panel(ctx,p[0]-6,p[1]-5,12,14);screw(ctx,p[0],p[1]+1,1.6);box(ctx,p[0]-3,p[1]-12,6,7,1,ENAMEL,EDGE,.6);}
  if(this.spread>.02){ctx.save();ctx.globalAlpha=this.spread;for(let i=1;i<16;i++){const p=point(i/16,1);metal(ctx,p[0]-2,p[1]-7,4,8,1);screw(ctx,p[0],p[1]-3,1);}line(ctx,strike,'#c7ae61',1);ctx.restore();}
  if(latest&&this.spread>.05){const tools=[...this.toolLanes.keys()],key=latest.event.tool||latest.event.toolType||'other',index=tools.indexOf(key);ctx.save();ctx.globalAlpha=this.spread;for(let j=-1;j<=1;j++){const name=index<0?(j===0?key:null):tools[index+j];if(!name)continue;const lane=index<0?latest.lane:this.toolLanes.get(name),x=600+j*225,y=strikeY+92+j*j*lerp(32,10,amount);label(ctx,`S${String(lane+1).padStart(2,'0')}/16`,x,y-21,9,MUTED,'center');label(ctx,short(name.toUpperCase(),21),x,y,13,INK,'center');}ctx.restore();}
  ctx.save();ctx.translate(0,strikeY-700);
  panel(ctx,558,725,84,53);metal(ctx,550,723,100,10,2);
  const glass=ctx.createLinearGradient(0,735,0,769);glass.addColorStop(0,'#d7d4cc');glass.addColorStop(.4,'#e9e6de');glass.addColorStop(1,'#f5f3ed');
  box(ctx,572,736,56,32,1,glass,'#c9c4b8',.7);
  for(let x=574;x<628;x+=3)line(ctx,[[x,736],[x-3,747]],'#aaa599',.6);
  for(const x of [566,634]){metal(ctx,x-4,733,8,34,1);screw(ctx,x,739,1.8);screw(ctx,x,763,1.8);}
  line(ctx,[[600,734],[600,772]],'#57554c',1);polygon(ctx,[[596,772],[604,772],[600,777]],'#57554c');
  for(const x of [582,618])screw(ctx,x,729,1.5);
  const counterLeft=380-40*amount-190*this.spread,counterRight=709+40*amount+190*this.spread;
  panel(ctx,counterLeft,621,115,79);box(ctx,counterLeft+7,628,101,47,2,'#eeece5','#b5b0a4');counter(ctx,combo,counterLeft+100,652,36,combo?'#b8994c':MUTED,'right');label(ctx,'EVENT COMBO',counterLeft+102,687,9,MUTED,'right');
  const moving=state.reducedMotion?0:records.filter(r=>t>=r.born&&t-r.born<TRAVEL).length;
  panel(ctx,counterRight,621,115,79);box(ctx,counterRight+7,628,101,47,2,'#eeece5','#b5b0a4');counter(ctx,moving,counterRight+14,652,36,MUTED,'left');label(ctx,'IN TRANSIT',counterRight+14,687,9,MUTED);
  ctx.restore();
  for(const r of records){
   const u=(r.lane+.5)/16,age=t-r.born,color=statusColor(r.event),at=point(u,1);
   if(!state.reducedMotion&&age>=0&&age<TRAVEL){
    const d=clamp(age/TRAVEL),p=point(u,d),s=.2+.8*ease(d),w=(point((r.lane+1)/16,d)[0]-point(r.lane/16,d)[0])*.78,h=10*s;
    line(ctx,[point(u,Math.max(0,d-.08)),p],`${color}66`,1.4);
    ctx.save();if(uncertain(r.event.status))ctx.setLineDash([2,2]);polygon(ctx,[[p[0]-w/2,p[1]-h],[p[0]+w/2,p[1]-h-2],[p[0]+w/2,p[1]],[p[0]-w/2,p[1]+2]],'#fffefa',color,.9);ctx.setLineDash([]);statusMark(ctx,r.event.status,p[0],p[1]-h/2,Math.min(3.6*s,w*.35),color);ctx.restore();
    if(d>.55&&(r===latest||r.event.visualCount>1))label(ctx,r.event.visualCount>1?`×${r.event.visualCount}`:serial(r.event.callId),p[0]+10,p[1]-5,7,color);
   }
   const impact=t-Math.max(r.born+TRAVEL,r.changedAt);
   if(!state.reducedMotion&&impact>=0&&impact<.7){ctx.save();ctx.globalAlpha=1-impact/.7;const spread=5+impact*35;line(ctx,[[at[0]-spread,at[1]-2],[at[0]+spread,at[1]-2]],color,2);for(let k=0;k<9;k++){const x=at[0]+(k-4)*impact*22,y=at[1]-Math.sin(impact/.7*Math.PI)*(55+k%3*27);line(ctx,[[x,y],[x+(k-4)*2,y-8-k%3*5]],r.event.status==='failed'?color:k%3?'#605d52':color,.9);}statusMark(ctx,r.event.status,at[0],at[1]-19-impact*16,6,color);if(r===latest)label(ctx,short(r.event.tool,18).toUpperCase(),at[0],at[1]+14,10,INK,'center');ctx.restore();}
  }
  ctx.save();ctx.translate(0,height-1100);
  panel(ctx,-10,1028,1220,56);panel(ctx,323,1036,554,36,true);label(ctx,latest?`${short(latest.event.tool,34)} / ${latest.event.status.toUpperCase()}`:'WAITING FOR TOOL CALLS',340,1055,11,latest?statusColor(latest.event):MUTED);
  for(let x=14;x<1200;x+=24)screw(ctx,x,1031,1.1);
  for(const x of [23,1098])for(let k=0;k<4;k++)box(ctx,x,1039+k*7,76,3,1,'#eeece5',EDGE,.6);
  for(const x of [127,896]){panel(ctx,x,1038,179,28);for(let k=0;k<3;k++)line(ctx,[[x+33,1048+k*4],[x+149,1048+k*4]],'#c9c4b8',.8);}
  ctx.restore();ctx.restore();
 }
}
