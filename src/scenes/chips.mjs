import { AMBER, EDGE, ENAMEL, INK, MUTED, TOOLS, box, clamp, dialArc, disc, ease, ellipse, glyph, label, lerp, line, metal, panel, pipe, polygon, screw, serial, short, statusColor, statusMark, uncertain, upsertCall } from './scene-utils.mjs';
const DIAL_X=-745;
const DEALER_X=1062;
const PLAY_X=640;

function heavyLabel(ctx,text,x,y,size,color=INK,align='right'){
 ctx.save();ctx.font=`700 ${size}px ComicMono, ui-monospace, monospace`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(String(text),x,y);ctx.restore();
}
function tablePlate(ctx,left,top,height,handY,portrait){
 const shoulder=lerp(left+16,left+62,portrait),knee=lerp(handY-87,handY-153,portrait);
 const outline=()=>{
  ctx.beginPath();ctx.moveTo(left,top);ctx.lineTo(1174,top);ctx.quadraticCurveTo(1180,top,1180,top+6);ctx.lineTo(1180,height-14);ctx.quadraticCurveTo(1180,height-8,1174,height-8);
  ctx.lineTo(13,height-8);ctx.quadraticCurveTo(6,height-8,6,height-15);ctx.lineTo(6,handY+21);ctx.quadraticCurveTo(6,handY+6,22,handY+4);
  ctx.bezierCurveTo(left-125,handY-5,shoulder+8,handY-9,shoulder,knee);
  ctx.bezierCurveTo(shoulder-2,knee-100,left+26,top+112,left,top);ctx.closePath();
 };
 ctx.save();ctx.shadowColor='#8176611b';ctx.shadowBlur=9;ctx.shadowOffsetY=4;
 const fill=ctx.createLinearGradient(left,top,1180,height);fill.addColorStop(0,'#eeebe2');fill.addColorStop(.45,'#f1eee6');fill.addColorStop(1,'#eae6dc');
 outline();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle='#d2ccbf';ctx.lineWidth=1;ctx.stroke();ctx.shadowBlur=0;ctx.shadowOffsetY=0;
 ctx.save();ctx.translate(3,3);ctx.scale(.994,.994);outline();ctx.strokeStyle='#fffdf8';ctx.lineWidth=1;ctx.stroke();ctx.restore();
 for(const x of [left+13,1168])for(const y of [top+12,height-20])if(x>left+20||y<top+20)screw(ctx,x,y,2);
 for(let x=38;x<1140;x+=73)screw(ctx,x,height-16,1.1);
 ctx.restore();
}
function feedChute(ctx,x,y,w,h){
 panel(ctx,x-10,y-5,w+20,h+10);
 const well=ctx.createLinearGradient(x,y,x+w,y);well.addColorStop(0,'#d7d2c5');well.addColorStop(.035,'#ece8de');well.addColorStop(.1,'#f4f1e9');well.addColorStop(.9,'#f1eee5');well.addColorStop(1,'#d9d3c6');
 box(ctx,x,y,w,h,2,well,'#bfb7a7',.8);
 for(const xx of [x-5,x+w+5]){
  line(ctx,[[xx,y+4],[xx,y+h-4]],'#c4bcac',3);line(ctx,[[xx-1,y+4],[xx-1,y+h-4]],'#fffdf8',1.3);
  for(let yy=y+12;yy<y+h-8;yy+=42)screw(ctx,xx,yy,1.4);
 }
 metal(ctx,x-8,y-8,w+16,7,1);line(ctx,[[x+6,y+3],[x+w-6,y+3]],'#aaa08d',1);
 for(const xx of [x-7,x+w-1]){metal(ctx,xx,y+h-16,8,24,1);screw(ctx,xx+4,y+h-5,1.5);}
}
function cardShoe(ctx,x,y,scale,count){
 ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
 panel(ctx,0,0,210,230);recess(ctx,12,10,186,212,5);
 // The patterned cover is mechanical trim; extra exposed sheets reflect retained calls only.
 const backs=Math.min(7,Math.max(0,count));
 for(let i=backs;i>=0;i--){
  const xx=25+i*.65,yy=21-i*1.3;
  ctx.save();ctx.shadowColor='#71523c35';ctx.shadowBlur=4;ctx.shadowOffsetY=3;
  const fill=ctx.createLinearGradient(xx,yy,xx+160,yy+194);fill.addColorStop(0,'#f9d7ba');fill.addColorStop(.5,'#f1c3a3');fill.addColorStop(1,'#eab391');
  box(ctx,xx,yy,160,194,10,fill,'#c58d69',1.2);ctx.restore();
  box(ctx,xx+4,yy+4,152,186,8,null,'#fae9d8',1.5);box(ctx,xx+8,yy+8,144,178,6,null,'#cc9776',.8);
 }
 for(let i=0;i<12;i++){ctx.save();ctx.translate(105,117);ctx.rotate(i*Math.PI/6);ellipse(ctx,0,-32,3,13,null,'#ad8466',.7);ctx.restore();}glyph(ctx,'agents',105,117,10,'#665542');
 for(const xx of [8,202]){metal(ctx,xx-3,19,6,191,1);screw(ctx,xx,23,1.4);screw(ctx,xx,205,1.4);}
 metal(ctx,17,216,176,6,1);ctx.restore();
}
function handTray(ctx,y,h,height){
 ctx.save();ctx.shadowColor='#84775e1c';ctx.shadowBlur=7;ctx.shadowOffsetY=4;
 box(ctx,6,y,925,h,9,'#eeebe2','#c9c1b2',.9);ctx.restore();
 box(ctx,12,y+6,913,h-12,5,null,'#fffdf8',1);box(ctx,19,y+14,899,h-27,4,'#f5f2e9','#ddd6c8',.7);
 line(ctx,[[17,height-27],[919,height-27]],'#b6ab96',1);line(ctx,[[17,height-25],[919,height-25]],'#fffdf8',1.2);
 for(let i=0;i<94;i++)line(ctx,[[20+i*9.5,height-(i%5===0?35:32)],[20+i*9.5,height-26]],'#bdb39f',.55);
 for(const x of [12,925])for(const yy of [y+7,y+h-7])screw(ctx,x,yy,1.5);
}

function recess(ctx,x,y,w,h,r=12){
 const shade=ctx.createLinearGradient(x,y,x+w,y+h);
 shade.addColorStop(0,'#d5d0c5');shade.addColorStop(.13,'#e7e2d7');shade.addColorStop(.8,'#eeeadf');shade.addColorStop(1,'#f8f5ee');
 box(ctx,x,y,w,h,r,'#f8f5ed','#b9b2a3',1);
 box(ctx,x+4,y+4,w-8,h-8,r-3,shade,'#d0c8b7',.8);
 line(ctx,[[x+12,y+7],[x+w-12,y+7]],'#b8b0a0',.8);
 line(ctx,[[x+w-6,y+15],[x+w-6,y+h-12],[x+12,y+h-6]],'#fffdf7',1.5);
}

function lcd(ctx,x,y,w,h,title,value){
 box(ctx,x-3,y-3,w+6,h+6,7,'#e7e2d7','#c9c1b1',.9);
 const fill=ctx.createLinearGradient(x,y,x,y+h);fill.addColorStop(0,'#dcd9ce');fill.addColorStop(.12,'#e7e4da');fill.addColorStop(1,'#e5e2d8');
 box(ctx,x,y,w,h,4,fill,'#a9a292',1);
 line(ctx,[[x+6,y+h-2],[x+w-6,y+h-2]],'#fffaf0',1);
 label(ctx,title,x+13,y+18,13,'#8d8678');
 heavyLabel(ctx,value,x+w-16,y+h-29,36,'#302e27');
}
function playingCard(ctx,r,x,y,w,h,angle=0,focus=false){
 const e=r.event,c=statusColor(e);ctx.save();ctx.translate(x,y);ctx.rotate(angle);
 ctx.shadowColor=focus?'#7b664139':'#70695730';ctx.shadowBlur=focus?12:5;ctx.shadowOffsetX=focus?2:1;ctx.shadowOffsetY=focus?6:3;
 box(ctx,-w/2+.5,-h/2+2,w,h,9,'#e7e1d4','#c4bcac',.7);
 const face=ctx.createLinearGradient(0,-h/2,0,h/2);face.addColorStop(0,'#fffefa');face.addColorStop(.7,'#fdfcf8');face.addColorStop(1,'#f5f1e8');
 box(ctx,-w/2,-h/2,w,h,9,face,focus?'#c5a154':'#c7c2b7',focus?2:.8);ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
 if(focus)box(ctx,-w/2-3,-h/2-3,w+6,h+6,11,null,'#d6bd7c66',2);
 box(ctx,-w/2+4,-h/2+4,w-8,h-8,6,null,focus?`${c}66`:'#e5e1d7',.7);
 const names={files:'Rd',shell:'Sh',search:'Sr',web:'Wb',agents:'Ag',other:'Tl'};
 heavyLabel(ctx,names[e.toolType]||'Tl',-w/2+12,-h/2+17,14,INK,'left');glyph(ctx,e.toolType,-w/2+17,-h/2+36,7,INK);
 label(ctx,e.visualCount>1?`×${e.visualCount}`:serial(e.callId),w/2-10,-h/2+18,8,MUTED,'right');
 disc(ctx,0,-h*.13,w*.21,null,'#e5e0d5',.7);glyph(ctx,e.toolType,0,-h*.13,w*.12,INK);
 const title=short(e.tool||e.toolType,focus?13:12),titleSize=Math.min(focus?21:15,(w-24)/Math.max(1,title.length*.62));
 heavyLabel(ctx,title,0,h*.11,titleSize,INK,'center');
 line(ctx,[[-w*.34,h*.2],[w*.34,h*.2]],'#ddd7cb',.65);
 label(ctx,short(e.target,focus?20:14),-w/2+13,h*.29,10,MUTED);
 label(ctx,e.status.toUpperCase(),-w/2+13,h/2-32,7,c);
 heavyLabel(ctx,e.visualCount>1?`×${e.visualCount}`:names[e.toolType]||'Tl',-w/2+13,h/2-16,12,c,'left');heavyLabel(ctx,names[e.toolType]||'Tl',w/2-27,h/2-16,12,INK);statusMark(ctx,e.status,w/2-15,h/2-17,5,c);
 if(e.status==='failed')statusMark(ctx,'failed',0,-h*.13,w*.14);
 if(uncertain(e.status)){ctx.setLineDash([3,4]);box(ctx,-w/2+2,-h/2+2,w-4,h-4,8,null,AMBER,1);ctx.setLineDash([]);}
 ctx.restore();
}
function controls(ctx,scene,records,latest,t,layout=null){
 ctx.save();if(layout){ctx.translate(layout.counterX,layout.counterY+layout.counterOffset);ctx.scale(layout.counterScale,layout.counterScale);ctx.translate(-465,-110);}
 ctx.save();ctx.shadowColor='#756c5524';ctx.shadowBlur=7;ctx.shadowOffsetY=5;
 box(ctx,465,110,460,232,17,'#f9f6ee','#c3bbab',1.2);ctx.shadowBlur=0;ctx.shadowOffsetY=0;
 box(ctx,471,116,448,220,12,null,'#ded7c8',.8);box(ctx,474,119,442,214,10,null,'#fffdf7',1);ctx.setLineDash([4,3]);box(ctx,459,104,472,244,20,null,'#b0a794',.7);ctx.setLineDash([]);
 for(const x of [480,910])for(const y of [125,327])screw(ctx,x,y,2.2);
 panel(ctx,485,129,81,26);label(ctx,`第 ${Math.ceil(records.length/16)} 手`,525,143,12,MUTED,'center');
 label(ctx,'事件',717,142,11,MUTED,'right');box(ctx,733,126,171,35,4,'#e5e1d6','#b7ae9c');heavyLabel(ctx,String(scene.eventCount).padStart(5,'0'),889,145,28);
 const combo=t-scene.lastEventAt<3?scene.combo:0;
 lcd(ctx,484,178,201,91,'筹码 / 保留调用',String(records.length));
 lcd(ctx,704,178,201,91,'倍率 / 事件演出',String(combo));
 label(ctx,'×',695,231,19,'#8e8573','center');
 panel(ctx,486,289,72,24);label(ctx,'本手',522,302,11,MUTED,'center');
 for(let i=0;i<6;i++)disc(ctx,580+i*18,302,5,records.length>i?'#e6d49a':ENAMEL,'#c2b9a6',.65);
 for(let i=0;i<4;i++)line(ctx,[[850,290+i*5],[902,290+i*5]],'#c8bfac',1.4);
 label(ctx,'事件节奏演出 · 不代表任务质量',699,327,9,MUTED,'center');ctx.restore();

 ctx.restore();ctx.save();if(layout){ctx.translate(layout.dealerX,layout.dealerY);ctx.scale(layout.dealerScale,layout.dealerScale);ctx.translate(-948,-133);}
 panel(ctx,948,133,228,270);panel(ctx,962,147,54,24);label(ctx,'抽牌',989,160,12,MUTED,'center');
 for(let i=0;i<3;i++)disc(ctx,1032+i*14,159,3.5,i===2&&latest?'#d99d72':'#b6b0a2','#ded8cb',1);
 for(let i=0;i<4;i++)line(ctx,[[1119,150+i*4],[1160,150+i*4]],EDGE,1.2);
 const fill=ctx.createLinearGradient(962,181,1161,307);fill.addColorStop(0,'#f3e6be');fill.addColorStop(.7,'#f2dfcb');fill.addColorStop(1,'#eadbce');
 box(ctx,962,181,199,126,4,fill,'#d2c8b6');
 glyph(ctx,latest?.event.toolType||'other',983,206,13,'#877755');label(ctx,latest?short(latest.event.tool,19):'Tool card engine',976,241,15,INK);label(ctx,latest?short(latest.event.target,24):'Waiting for a real call.',976,263,9,MUTED);if(latest)statusMark(ctx,latest.event.status,1139,285,9,statusColor(latest.event));
 panel(ctx,962,320,136,25);for(let x=969;x<1092;x+=3)line(ctx,[[x,326],[x,339]],'#9e9686',.7);
 box(ctx,1107,320,54,25,3,'#e2ddd1','#b8b0a1');heavyLabel(ctx,String(records.length),1149,334,18);
 panel(ctx,961,358,201,27);box(ctx,970,366,183,10,5,'#ddd5c5','#c0b49f');for(let x=976;x<1148;x+=3)line(ctx,[[x,366],[x,375]],'#b2a68f',.6);
 const roller=ctx.createLinearGradient(0,365,0,377);roller.addColorStop(0,'#bfb6a5');roller.addColorStop(.35,'#fffdf7');roller.addColorStop(.7,'#f3eee3');roller.addColorStop(1,'#c7bca8');
 box(ctx,973,365,177,12,5,roller,'#b9ad97',.7);for(let x=979;x<1147;x+=3)line(ctx,[[x,367],[x,374]],'#c8beab',.6);
 for(const x of [969,1155]){disc(ctx,x,371,4,ENAMEL,EDGE,.7);screw(ctx,x,371,1.4);}
 metal(ctx,975,394,173,6,1);line(ctx,[[980,400],[1143,400]],'#a69b87',1);

 ctx.restore();
}
// Components reflow independently; cards and cast housings always retain their aspect ratios.
function landscape(ctx,scene,t,state,height){
 const records=[...scene.calls.values()],latest=scene.calls.get(scene.selectedId),visible=records.filter(r=>r!==latest).slice(-16);
 const room=clamp((height-620)/180),portrait=clamp((height-800)/300);
 const layout={counterX:lerp(302,465,portrait),counterY:lerp(32,110,portrait),counterOffset:45*(1-portrait),counterScale:lerp(.8,1,portrait),dealerX:lerp(988,948,room),dealerY:lerp(32,133,portrait),dealerScale:lerp(lerp(.82,.98,room),1,portrait)};
 const bedScale=lerp(.86,1,room),bedX=lerp(702,520,portrait),counterRight=layout.counterX+460*layout.counterScale;
 let bedY=lerp(98+40*room,400,portrait);
 if(bedX<counterRight+12)bedY=Math.max(bedY,layout.counterY+232*layout.counterScale+14);
 const playX=bedX+120*bedScale,playY=bedY+160*bedScale,handHeight=lerp(206,246,portrait),handY=height-handHeight-16,handScale=lerp(.88,1,portrait);
 const shoeScale=lerp(.88,1,portrait),dealerX=layout.dealerX+114*layout.dealerScale,dealerBottom=layout.dealerY+270*layout.dealerScale,shoeY=height-230*shoeScale-28,shoeCenter=shoeY+117*shoeScale;
 const plateX=lerp(260,350,portrait),plateY=lerp(16,78,portrait),dialY=lerp(height*.48,510,portrait);
 tablePlate(ctx,plateX,plateY,height,handY,portrait);
 dialArc(ctx,DIAL_X,dialY,1015,-1.2,1.2,'#cfc7b7');
 for(let i=0;i<7;i++){const a=-.66+i*.22,r=916;ctx.save();ctx.translate(DIAL_X+Math.cos(a)*r,dialY+Math.sin(a)*r);ctx.rotate(a);glyph(ctx,TOOLS[i%6],0,-12,11,'#969083');label(ctx,['Read','Shell','Search','Web','Agents','Tool'][i%6],0,16,12,'#8a8477','center');ctx.restore();}
 const capX=lerp(283,370,portrait),capEnd=lerp(293,437,portrait),capY=lerp(Math.min(handY-35,playY+70),649,portrait);
 ctx.beginPath();ctx.moveTo(capX,layout.counterY+12);ctx.bezierCurveTo(capX+8,capY*.4,capEnd-3,capY*.75,capEnd,capY);ctx.strokeStyle='#cbc4b4';ctx.lineWidth=9;ctx.stroke();ctx.strokeStyle='#fffdf8';ctx.lineWidth=6;ctx.stroke();ctx.strokeStyle='#d8ad68';ctx.lineWidth=2.5;ctx.stroke();disc(ctx,capEnd,capY,7,ENAMEL,EDGE);disc(ctx,capEnd,capY,3.5,'#d6b372');
 const trackX=dealerX-83*shoeScale,trackY=dealerBottom-12,trackBottom=shoeY+20;
 feedChute(ctx,trackX,trackY+7,166*shoeScale,trackBottom-trackY-10);
 controls(ctx,scene,records,latest,t,layout);
 cardShoe(ctx,dealerX-105*shoeScale,shoeY,shoeScale,records.length-visible.length-(latest?1:0));
 ctx.save();ctx.translate(bedX,bedY);ctx.scale(bedScale,bedScale);recess(ctx,0,0,240,320,15);for(const x of [-10,250])for(const y of [-10,330])screw(ctx,x,y,1.5);line(ctx,[[120,322],[120,329]],'#aaa08e',.8);label(ctx,'出牌区',120,308,9,MUTED,'center');ctx.restore();
 if(latest){
  const age=Math.max(0,t-latest.born),feeding=!state.reducedMotion&&age<.28,spring=state.reducedMotion?1:1-Math.exp(-8*Math.max(0,age-.28))*Math.cos(12*Math.max(0,age-.28));
  const x=feeding?dealerX:lerp(dealerX,playX,spring),y=feeding?lerp(dealerBottom+97*shoeScale,shoeCenter,ease(age/.28)):lerp(shoeCenter,playY,spring),scale=feeding?shoeScale:lerp(shoeScale,bedScale,clamp(spring));
  ctx.save();if(feeding){ctx.beginPath();ctx.rect(trackX,trackY+7,166*shoeScale,height-trackY-16);ctx.clip();}ctx.translate(x,y);ctx.scale(scale,scale);playingCard(ctx,latest,0,0,feeding?142:lerp(142,176,clamp(spring)),feeding?194:lerp(194,264,clamp(spring)),feeding?0:(1-spring)*.16,true);ctx.restore();
 }else{ctx.save();ctx.translate(playX,playY);ctx.scale(bedScale,bedScale);box(ctx,-88,-132,176,264,8,'#f6f3eb','#d4cbb9');label(ctx,'等待真实工具调用',0,5,12,MUTED,'center');ctx.restore();}
 const needleY=lerp(height*.48,551,portrait);panel(ctx,251,needleY,80,40);box(ctx,260,needleY+9,18,21,2,'#eeece5','#bcb4a3');for(let i=0;i<4;i++)line(ctx,[[287,needleY+9+i*5],[317,needleY+9+i*5]],'#c5bcaa',1.3);polygon(ctx,[[233,needleY+20],[248,needleY+15],[248,needleY+25]],'#514b3e');
 handTray(ctx,handY,handHeight,height);
 visible.forEach((r,i)=>{const n=visible.length,u=n>1?i/(n-1)*2-1:0,x=82+i*Math.min(57,782/Math.max(1,n-1)),age=Math.max(0,t-r.born),spring=state.reducedMotion?1:1-Math.exp(-7*age)*Math.cos(10*age),y=handY+lerp(100,107,portrait)+u*u*lerp(6,12,portrait);ctx.save();ctx.translate(lerp(dealerX,x,spring),lerp(shoeCenter,y,spring));ctx.scale(handScale,handScale);playingCard(ctx,r,0,0,130,215,u*.035);ctx.restore();});
 if(!visible.length)label(ctx,'RETAINED HAND / NO TOOL TRAFFIC',29,height-38,9,MUTED);
}
export default class Chips{
 constructor(){this.calls=new Map();this.eventCount=0;this.combo=0;this.lastEventAt=-Infinity;this.selectedId=null;}
 onEvent(event,t){const{changed}=upsertCall(this.calls,event,t);if(!changed)return;this.eventCount++;this.combo=t-this.lastEventAt<1.6?Math.min(99,this.combo+1):1;this.lastEventAt=t;this.selectedId=event.callId||event.id;}
 render(ctx,t,dt,state={}){
  const height=clamp(state.viewport?.height??1100,620,1100);
  if(height<1100){ctx.save();landscape(ctx,this,t,state,height);ctx.restore();return;}
  ctx.save();const records=[...this.calls.values()],latest=this.calls.get(this.selectedId),visible=records.filter(r=>r!==latest).slice(-16);
  // Broad enamel cabinet, left cropped rotor, bottom hand, and a tall right shoe.
  tablePlate(ctx,350,78,height,838,1);
  dialArc(ctx,DIAL_X,510,1015,-1.2,1.2,'#cfc7b7');
  for(let i=0;i<7;i++){
   const a=-.66+i*.22,r=916,x=DIAL_X+Math.cos(a)*r,y=510+Math.sin(a)*r;ctx.save();ctx.translate(x,y);ctx.rotate(a);
   glyph(ctx,TOOLS[i%6],0,-12,11,'#969083');label(ctx,['Read','Shell','Search','Web','Agents','Tool'][i%6],0,16,12,'#8a8477','center');ctx.restore();
  }
  // An amber pressure capillary follows the cropped rotor's outside edge.
  ctx.beginPath();ctx.moveTo(370,109);ctx.bezierCurveTo(405,263,430,458,437,649);ctx.strokeStyle='#cbc4b4';ctx.lineWidth=10;ctx.stroke();ctx.strokeStyle='#fffdf8';ctx.lineWidth=7;ctx.stroke();
  ctx.beginPath();ctx.moveTo(370,109);ctx.bezierCurveTo(405,263,430,458,437,649);ctx.strokeStyle='#d8ad68';ctx.lineWidth=3;ctx.stroke();disc(ctx,437,649,8,ENAMEL,EDGE);disc(ctx,437,649,4,'#d6b372');
  for(let k=0;k<16;k++){const y=113+k*32,x=370+Math.sin(k/16*Math.PI/2)*67;line(ctx,[[x+8,y],[x+13+(k%4===0?5:0),y]],'#ada594',.7);}
  // Narrow beveled guides connect the dealer mouth to the lower-right card shoe.
  feedChute(ctx,979,400,166,638);
  controls(ctx,this,records,latest,t);
  cardShoe(ctx,957,842,1,records.length-visible.length-(latest?1:0));
  recess(ctx,520,400,240,320,15);for(const x of [510,770])for(const y of [390,730])screw(ctx,x,y,1.5);line(ctx,[[640,722],[640,729]],'#aaa08e',.8);label(ctx,'出牌区',PLAY_X,708,9,MUTED,'center');
  if(latest){
   const age=Math.max(0,t-latest.born),feeding=!state.reducedMotion&&age<.28;
   const spring=state.reducedMotion?1:1-Math.exp(-8*Math.max(0,age-.28))*Math.cos(12*Math.max(0,age-.28));
   const x=feeding?DEALER_X:lerp(DEALER_X,PLAY_X,spring),y=feeding?lerp(510,959,ease(age/.28)):lerp(959,560,spring);
   ctx.save();if(feeding){ctx.beginPath();ctx.rect(979,400,166,672);ctx.clip();}
   playingCard(ctx,latest,x,y,feeding?142:lerp(142,176,clamp(spring)),feeding?194:lerp(194,264,clamp(spring)),feeding?0:(1-spring)*.16,true);ctx.restore();
  }else{box(ctx,552,428,176,264,8,'#f6f3eb','#d4cbb9');label(ctx,'等待真实工具调用',PLAY_X,565,12,MUTED,'center');}
  panel(ctx,251,551,80,40);box(ctx,260,560,18,21,2,'#eeece5','#bcb4a3');for(let i=0;i<4;i++)line(ctx,[[287,560+i*5],[317,560+i*5]],'#c5bcaa',1.3);polygon(ctx,[[233,571],[248,566],[248,576]],'#514b3e');
  pipe(ctx,[[331,571],[402,571]],5);
  // A shallow fan uses the full lower width while preserving the reference's overlapping hand.
  handTray(ctx,838,246,height);
  visible.forEach((r,i)=>{const n=visible.length,u=n>1?i/(n-1)*2-1:0,step=Math.min(57,782/Math.max(1,n-1)),x=82+i*step,age=Math.max(0,t-r.born),spring=state.reducedMotion?1:1-Math.exp(-7*age)*Math.cos(10*age),y=945+u*u*12;playingCard(ctx,r,lerp(DEALER_X,x,spring),lerp(959,y,spring),130,215,u*.035);});
  if(!visible.length)label(ctx,'RETAINED HAND / NO TOOL TRAFFIC',29,1062,9,MUTED);
  ctx.restore();
 }
}
