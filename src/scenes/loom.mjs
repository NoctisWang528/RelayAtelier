import { EDGE, ENAMEL, INK, MUTED, box, clamp, controlBox, dialArc, disc, ease, ellipse, label, lerp, line, metal, panel, pipe, screw, serial, short, statusColor, statusMark, uncertain } from './scene-utils.mjs';
import { accept, hash } from './casino-utils.mjs';

const PASS=.30, LEFT=485, RIGHT=1170, ROW=4, WARPS=108;
const THREADS=['#628cc0','#68a57a','#b675ac','#c99954','#47a6a9','#cc6e70','#9077b5','#96a15c'];
// Film order, with a weft-over / warp-over draft per tool. The seventh suffix is ambiguous.
const DRAFTS=[
 ['WRITE',3,1], ['WEBSEARCH',2,2], ['EDIT',1,2], ['GREP',1,1],
 ['GLOB',2,2], ['NOTEBOOKEDIT',2,2], [null,2,1], ['READ',1,2],
 ['TODOWRITE',3,1], ['LS',1,1], ['LSP',3,1], ['WEBFETCH',1,2],
 ['GIT',2,1], ['TASK',2,2], ['LINT',3,1], ['TEST',2,1]
];
const REFERENCE_TOOLS=DRAFTS.map(([tool])=>tool);
const SLOTS=REFERENCE_TOOLS.length, PITCH=(RIGHT-LEFT)/SLOTS, STEP=(RIGHT-LEFT)/WARPS;
const yarn=slot=>THREADS[slot%THREADS.length];
const resultInk=r=>r.event.status==='failed'||uncertain(r.event.status)?statusColor(r.event):yarn(r.spool);
const warpSlot=i=>Math.min(SLOTS-1,Math.floor(i*SLOTS/WARPS));
const center=slot=>LEFT+(slot+.5)*PITCH;

function assignSpool(spools,tool){
 const existing=spools.findIndex(names=>names.has(tool));
 if(existing>=0)return existing;
 const observed=REFERENCE_TOOLS.indexOf(tool.toUpperCase());
 const unmapped=REFERENCE_TOOLS.indexOf(null);
 const preferred=observed>=0?observed:spools[unmapped].size?hash(tool)%SLOTS:unmapped;
 let slot=preferred;
 for(let offset=1;offset<SLOTS&&spools[slot].size;offset++){
  const candidate=(preferred+offset)%SLOTS;
  if(spools[candidate].size<spools[slot].size)slot=candidate;
 }
 spools[slot].add(tool);
 return slot;
}

function plaqueLayout(ctx,height,navBottom){
 const canvas=ctx.canvas;
 const scale=canvas?.clientWidth&&canvas.clientHeight
  ?Math.min(canvas.clientWidth/1200,canvas.clientHeight/height):ctx.getTransform().a;
 const rows=2*PITCH*scale>=80?2:4;
 const columns=SLOTS/rows;
 // In a narrow portrait canvas the rack can extend left of the comb.
 const column=clamp(88/scale,rows*PITCH,(RIGHT-16)/columns);
 const font=clamp(14*scale,13,14)/scale,gap=3/scale,h=font*2.4;
 const y=Math.max(12,navBottom+8/scale),rackBottom=y+rows*(h+gap)-gap;
 const top=rackBottom+20/scale+22;
 const bounds=Array.from({length:SLOTS},(_,slot)=>{
  const row=slot%rows,left=RIGHT-(columns-Math.floor(slot/rows))*column;
  const x=left+(rows+1)*gap;
  return {x,y:y+row*(h+gap),w:column-(rows+2)*gap,h,leadX:left+(row+.5)*gap};
 });
 return {bounds,top,font};
}

function plaqueBase(ctx,slot,{x,y,w,h,leadX},rackBottom,top){
 const color=yarn(slot),mid=y+h/2,pin=center(slot);
 line(ctx,[[x,mid],[leadX,mid],[leadX,rackBottom+2],[pin,top-26],[pin,top-22]],color,1.25);
 ctx.save();ctx.shadowColor='#81796619';ctx.shadowBlur=3;ctx.shadowOffsetY=2;
 box(ctx,x,y,w,h,2,ENAMEL,'#c8c4bb',.7);ctx.restore();
 line(ctx,[[x+1.5,y+3],[x+1.5,y+h-3]],color,2.5);
 disc(ctx,pin,top-22,2,color);
}

// Wrap at an identifier boundary when possible. An exceptionally long operation
// keeps both its leading words and its distinguishing tail.
function nameLines(ctx,name,width){
 const fits=s=>ctx.measureText(s).width<=width;
 if(fits(name))return [name];
 const parts=name.split(/__|::|[./]/u).filter(Boolean),op=parts.pop()||name;
 if(fits(op)){
  const source=parts.pop();
  if(!source||source==='functions')return [op];
  return [op,compact(source)];
 }
 const chars=Array.from(op);
 let cut=1;
 while(cut<chars.length&&fits(chars.slice(0,cut+1).join('')))cut++;
 const prefix=chars.slice(0,cut).join('');
 const boundary=prefix.match(/^.*(?:[_ -]|[a-z0-9](?=[A-Z]))/u)?.[0];
 if(boundary&&fits(op.slice(boundary.length)))return [boundary,op.slice(boundary.length)];
 const rest=op.slice(prefix.length);
 if(!fits(rest)){
  // Prefer complete words ("list_pending…" / "revisions") to fragments.
  const words=op.split(/[_ -]+|(?<=[a-z0-9])(?=[A-Z])/u);
  const last=words.at(-1),first=(/^[_ -]/u.test(rest)?prefix:boundary)?.replace(/[_ -]+$/u,'');
  if(first&&last&&fits(last))return [fits(first+'…')?first+'…':first,last];
 }
 return [prefix,compact(rest)];

 function compact(s){
  if(fits(s))return s;
  const glyphs=Array.from(s);
  let result='…';
  for(let keep=1;keep<glyphs.length;keep++){
   const head=glyphs.slice(0,Math.ceil(keep/2)),tail=glyphs.slice(glyphs.length-Math.floor(keep/2));
   const candidate=head.join('')+'…'+tail.join('');
   if(!fits(candidate))break;
   result=candidate;
  }
  return result;
 }
}
function plaque(ctx,slot,bounds,names,selected,font){
 if(!names.length)return;
 const {x,y,w,h}=bounds,cx=x+w/2,chosen=selected?.spool===slot;
 if(chosen)box(ctx,x,y,w,h,2,null,INK,1.8);
 const name=chosen?selected.tool:names[0],shared=names.length>1;
 ctx.font=`${chosen?'bold':'normal'} ${font}px ComicMono, ui-monospace, monospace`;
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=chosen?INK:'#49463e';
 const inset=shared?Math.max(4,font*.24+2.5):4;
 const lines=nameLines(ctx,name,w-2*inset);
 const countLine=shared&&lines.length===1;
 if(countLine)lines.push(`+${names.length-1}`);
 lines.forEach((s,i)=>{
  if(countLine&&i===1){
   ctx.font=`${font*.86}px ComicMono, ui-monospace, monospace`;
   ctx.fillStyle='#655e50';
  }
  ctx.fillText(s,cx,y+h/2+(i-(lines.length-1)/2)*font);
 });
 // The edge marker also fits beside an operation that needs both text lines.
 if(shared)disc(ctx,x+1.5,y+h/2,font*.24,yarn(slot),INK,.8);
}

function row(ctx,r,y,fraction=1){
 if(fraction<=0)return;
 const w=(RIGHT-LEFT)*fraction, x=r.sequence%2?LEFT:RIGHT-w;
 const color=yarn(r.spool),status=r.event.status;
 ctx.save();ctx.beginPath();ctx.rect(x,y,w,ROW);ctx.clip();
 const [,over,under]=r.draft,repeat=over+under;
 for(let slot=0;slot<SLOTS;slot++){
  const groupLeft=LEFT+slot*PITCH,groupRight=groupLeft+PITCH;
  if(uncertain(status)&&slot===r.spool){
   // Leave the original warp exposed in this call's cell.
   ctx.fillStyle=statusColor(r.event);
   ctx.fillRect(groupLeft+3,y+1,2,2);
   if(status==='waiting')ctx.fillRect(groupLeft+7,y+1,2,2);
   continue;
  }
  const first=Math.ceil(slot*WARPS/SLOTS),end=Math.ceil((slot+1)*WARPS/SLOTS);
  for(let i=first;i<end;){
   const xx=LEFT+i*STEP,phase=(i+r.sequence)%repeat;
   if(phase>=over){
    ctx.fillStyle=yarn(slot);
    ctx.fillRect(xx,y,Math.min(2.7,groupRight-xx),ROW);
    const tieLeft=Math.max(groupLeft,xx-1.1);
    ctx.fillRect(tieLeft,y+1,Math.min(groupRight,xx+3.7)-tieLeft,1.3);
    i++;
    continue;
   }
   const ends=Math.min(over-phase,end-i),span=Math.min(groupRight-xx,ends*STEP);
   // A two-over/two-under pick breaks into three fine dashes. Long floats stay continuous.
   const picks=over===2&&under===2?3:1;
   const spacing=span/picks;
   ctx.fillStyle=color;
   for(let k=0;k<picks;k++)ctx.fillRect(xx+k*spacing,y+1,Math.max(.65,spacing-1.7),picks===3?1.45:2.1);
   i+=ends;
  }
 }
 const cx=center(r.spool);
 if(status==='failed')statusMark(ctx,status,cx,y+ROW/2,2.1);
 else if(!uncertain(status)){
  ctx.fillStyle=color;ctx.fillRect(cx-6,y+.4,12,status==='completed'?3.3:1.3);
 }
 ctx.restore();
}
function carrier(ctx,x,y,color){
 ctx.save();ctx.shadowColor='#81796622';ctx.shadowBlur=4;ctx.shadowOffsetY=3;
 ctx.beginPath();ctx.moveTo(x-32,y);ctx.quadraticCurveTo(x-16,y-11,x+14,y-8);ctx.lineTo(x+33,y);ctx.quadraticCurveTo(x+12,y+12,x-14,y+9);ctx.closePath();ctx.fillStyle=ENAMEL;ctx.fill();ctx.strokeStyle='#aaa79d';ctx.lineWidth=.8;ctx.stroke();
 ctx.shadowBlur=0;ctx.shadowOffsetY=0;box(ctx,x-16,y-5,31,10,3,'#eeece5',EDGE);for(let i=0;i<9;i++)line(ctx,[[x-12+i*3,y-4],[x-12+i*3,y+4]],color,.7);screw(ctx,x-24,y,1.8);screw(ctx,x+24,y,1.8);ctx.restore();
}
function instrumentLayout(amount){
 const controlY=lerp(546,255,amount),cabY=lerp(788,436,amount),cabH=lerp(276,168,amount);
 const infoY=cabY+52,infoH=lerp(62,42,amount),displayY=infoY+infoH+8,displayH=cabH-(displayY-cabY)-12;
 return {controlY,cabY,cabH,infoY,infoH,displayY,displayH};
}
function leftInstruments(ctx,height,amount){
 ctx.save();ctx.translate(-35-70*amount,-25-240*amount);dialArc(ctx,-665,-190,1110,-.1,1.5,'#779bc2',true);ctx.restore();
 const {controlY,cabY,cabH,infoY,infoH,displayY,displayH}=instrumentLayout(amount);
 const probeY=lerp(386,178,amount),probeX=lerp(282,252,amount);
 line(ctx,[[94-70*amount,267-208*amount],[221-70*amount,350-208*amount]],'#777268',1.1);
 pipe(ctx,[[221-70*amount,350-208*amount],[probeX,probeY],[probeX,controlY-1]],7);panel(ctx,probeX-14,probeY-6,28,21);
 for(let y=probeY+20;y<controlY-6;y+=37)metal(ctx,probeX-6,y,12,5,0);
 controlBox(ctx,206,controlY,163,142,'WARP TENSION / LOCAL','');
 // Ribbed actuator, paired sliding jaws and terminal strip visible on the source controller.
 for(let i=0;i<6;i++)line(ctx,[[probeX-5+i*2,probeY+21],[probeX-5+i*2,controlY-7]],'#c4c0b6',.55);
 box(ctx,221,controlY+27,66,67,2,null,'#b4b0a5',.7);
 for(const x of [226,278])line(ctx,[[x,controlY+29],[x,controlY+92]],'#b9b4a9',1);
 for(const [x,y,w]of [[220,controlY+44,25],[267,controlY+48,27]]){metal(ctx,x,y,w,29,1);for(let k=0;k<12;k++)line(ctx,[[x+2,y+2+k*2],[x+w-2,y+2+k*2]],'#b5b1a6',.5);}
 for(let i=0;i<9;i++){box(ctx,219+i*15,controlY+128,13,9,1,ENAMEL,EDGE,.6);screw(ctx,225+i*15,controlY+132,1.5);}
 for(const y of [controlY+42,controlY+98]){pipe(ctx,[[369,y],[447,y]],5);box(ctx,444,y-5,12,10,1,ENAMEL,EDGE,.7);screw(ctx,450,y,1.5);}
 const crossY=(controlY+143+cabY)/2;
 pipe(ctx,[[229,controlY+143],[229,crossY],[145,crossY],[145,cabY-2]],6);
 pipe(ctx,[[337,controlY+143],[337,height-88],[432,height-88],[449,height-74]],6);
 for(const [x,y]of [[205,crossY],[163,crossY],[337,height-340],[337,height-242],[337,height-144]])if(y>controlY+143)panel(ctx,x-3,y-3,7,7);
 panel(ctx,17,cabY,295,cabH);panel(ctx,27,cabY+12,275,29);
 for(const x of [29,296]){metal(ctx,x,cabY+cabH-2,12,8,2);}
 pipe(ctx,[[306,cabY-9],[320,cabY-9],[320,height-48]],4);
 for(let y=cabY+45;y<height-49;y+=132)box(ctx,316,y,8,7,1,ENAMEL,EDGE,.6);
 panel(ctx,258,cabY-23,42,24);for(let x=264;x<295;x+=4)line(ctx,[[x,cabY-17],[x,cabY-7]],'#aba79c',.7);
 disc(ctx,43,cabY+26,10,ENAMEL,EDGE,.7);for(let i=0;i<8;i++){const a=i*Math.PI/4;line(ctx,[[43+Math.cos(a)*7,cabY+26+Math.sin(a)*7],[43+Math.cos(a)*9,cabY+26+Math.sin(a)*9]],'#b7b2a6',.6);}
 for(let i=0;i<6;i++){box(ctx,53+i*40,cabY+18,37,16,2,ENAMEL,EDGE,.6);screw(ctx,56+i*40,cabY+26,1);}
 box(ctx,32,infoY,264,infoH,3,'#eeece5','#c6c2b8');
 panel(ctx,27,displayY,275,displayH);const g=ctx.createLinearGradient(38,displayY+12,270,displayY+displayH-12);g.addColorStop(0,'#e4eff0');g.addColorStop(.45,'#ece9f5');g.addColorStop(1,'#e8dff0');box(ctx,36,displayY+10,257,displayH-19,2,g,'#d9d4cb');
 panel(ctx,317,height-62,110,26);
}
function readouts(ctx,height,amount,selected,queued,shared){
 const {controlY,infoY,infoH,displayY,displayH}=instrumentLayout(amount);
 label(ctx,selected?`S${String(selected.spool+1).padStart(2,'0')}  ${selected.event.status.toUpperCase()}`:'NO TOOL INPUT',219,controlY+117,8,INK);
 const nameLines=selected?selected.tool.match(/.{1,32}/gu):['Awaiting the first thread.'];
 ctx.font=selected&&selected.tool.length<=24?'bold 16px ComicMono, monospace':'12px ui-monospace, monospace';
 ctx.fillStyle=INK;ctx.textAlign='left';ctx.textBaseline='middle';
 nameLines.forEach((part,i)=>ctx.fillText(part,45,infoY+infoH/2+(i-(nameLines.length-1)/2)*13));
 label(ctx,selected?`S${String(selected.spool+1).padStart(2,'0')}${shared?' SHARED':''}`:'Call textile',49,displayY+lerp(37,27,amount),lerp(23,20,amount),INK);
 if(displayH>95){label(ctx,selected?short(selected.event.target||selected.event.status,27):'A session, woven.',49,displayY+70,13,INK);label(ctx,'ONE CALL / ONE ROW',49,displayY+displayH-27,9,MUTED);}
 if(selected)statusMark(ctx,selected.event.status,253,displayY+lerp(displayH-43,displayH/2,amount),10,resultInk(selected));
 label(ctx,`QUEUE  ${queued}`,329,height-49,12,MUTED);
}
function machine(ctx,height,amount,bottom,rack){
  const {top:TOP,bounds}=rack;
  leftInstruments(ctx,height,amount);
  panel(ctx,407,TOP+7,40,bottom-TOP-6);
  for(const y of [TOP+24,bottom-38]){box(ctx,445,y,14,12,2,ENAMEL,EDGE,.7);screw(ctx,452,y+6,1.7);}
  for(const x of [459,1181]){
   const rail=ctx.createLinearGradient(x,0,x+20,0);rail.addColorStop(0,'#ece9e1');rail.addColorStop(.3,'#fdfcf9');rail.addColorStop(.7,'#f6f4ee');rail.addColorStop(1,'#ddd9cf');
   box(ctx,x,TOP-19,20,height-TOP-22,2,rail,EDGE,.7);line(ctx,[[x+8,TOP-12],[x+8,bottom]],'#d3cfc4',.7);line(ctx,[[x+11,TOP-12],[x+11,bottom]],'#fffefa',1);
   for(let y=TOP+18;y<bottom;y+=47)screw(ctx,x+10,y,1.8);
   metal(ctx,x-3,TOP-47,26,8,2);for(const xx of [x+3,x+15])line(ctx,[[xx,TOP-39],[xx,TOP-22]],'#c4c0b6',1);
  }
  metal(ctx,463,TOP-22,724,21,1);metal(ctx,459,bottom,734,20,1);
  const last=bounds.at(-1);
  bounds.forEach((b,i)=>plaqueBase(ctx,i,b,last.y+last.h,TOP));
}

export default class Loom{
 constructor(){
  this.calls=new Map();this.retired=new Set();this.spools=Array.from({length:SLOTS},()=>new Set());
  this.plaqueBounds=[];
  this.latest=null;this.nextAt=0;this.sequence=0;
 }
 seedTools(calls){
  if(this.sequence)return;
  for(const names of this.spools)names.clear();
  const recent=[...calls].reverse().sort((a,b)=>(Date.parse(b.timestamp)||0)-(Date.parse(a.timestamp)||0));
  const tools=new Set();
  for(const {tool} of recent){
   if(typeof tool==='string'&&tool.trim()&&tool.toLowerCase()!=='unknown')tools.add(tool);
   if(tools.size===SLOTS)break;
  }
  // Reserve exact filmed positions before probing for unfamiliar names or case collisions.
  const remaining=[];
  for(const tool of tools){
   const slot=REFERENCE_TOOLS.indexOf(tool.toUpperCase());
   if(slot>=0&&!this.spools[slot].size)this.spools[slot].add(tool);
   else remaining.push(tool);
  }
  for(const tool of remaining)assignSpool(this.spools,tool);
 }
 toolNamesAt(x,y){
  for(const bounds of this.plaqueBounds){
   if(x>=bounds.x&&x<bounds.x+bounds.w&&y>=bounds.y&&y<bounds.y+bounds.h)return [...bounds.names];
  }
  return [];
 }
 onEvent(event,t){
  const change=accept(this.calls,this.retired,event,t);
  if(!change)return;
  const {call,fresh,evicted}=change;
  this.latest=call;
  call.visualCount=event.visualCount??call.visualCount??1;
  if(!fresh)return;
  const all=[...this.calls.values()];
  call.tool=event.tool||event.toolType||'unknown';
  if(evicted&&evicted.tool!==call.tool&&!all.some(r=>r.tool===evicted.tool)){
   this.spools[evicted.spool].delete(evicted.tool);
  }
  call.spool=assignSpool(this.spools,call.tool);
  const observed=REFERENCE_TOOLS.indexOf(call.tool.toUpperCase());
  call.draft=DRAFTS[observed>=0?observed:call.spool];
  call.sequence=++this.sequence;
  const running=all.find(r=>r.weaveAt<=t&&t<r.weaveAt+r.duration);
  const pending=all.filter(r=>r===call||r.weaveAt>t);
  const duration=Math.min(PASS,8/pending.length);
  let cursor=running?running.weaveAt+running.duration:t;
  for(const r of pending){r.weaveAt=cursor;r.duration=duration;cursor+=duration;}
  this.nextAt=cursor;
 }
 drawMachine(ctx,height,amount,bottom,rack){
  if(typeof OffscreenCanvas==='undefined'){
   machine(ctx,height,amount,bottom,rack);
   return;
  }
  const scale=Math.min(2,ctx.getTransform().a);
  const width=Math.ceil(1200*scale),pixelsHigh=Math.ceil(height*scale);
  if(this.machinePlate?.width!==width||this.machinePlate.height!==pixelsHigh){
   this.machinePlate=new OffscreenCanvas(width,pixelsHigh);
   this.machineStamp=null;
  }
  // The moving heddles, all woven rows and the selected outline are drawn independently.
  const stamp=JSON.stringify([height,rack.top,rack.bounds[0].w,scale]);
  if(stamp!==this.machineStamp){
   // Rasterize this stationary plate once in software for consistent edge coverage
   // in both the desktop compositor and CPU-backed frame captures.
   const plate=this.machinePlate.getContext('2d',{willReadFrequently:true});
   plate.setTransform(1,0,0,1,0,0);
   plate.clearRect(0,0,width,pixelsHigh);
   plate.scale(scale,scale);
   machine(plate,height,amount,bottom,rack);
   this.machineStamp=stamp;
  }
  ctx.drawImage(this.machinePlate,0,0,width/scale,pixelsHigh/scale);
 }
 render(ctx,t,dt,state={}){
  ctx.save();const height=clamp(state.viewport?.height??1100,620,1100),amount=(1100-height)/480,bottom=height-51;
  const rack=plaqueLayout(ctx,height,state.viewport?.navigation?.bottom??0),TOP=rack.top;
  const now=state.reducedMotion?Math.max(t,this.nextAt):t,records=[...this.calls.values()];
  const woven=records.filter(r=>now>=r.weaveAt+r.duration);
  const active=records.find(r=>now>=r.weaveAt&&now<r.weaveAt+r.duration);
  const p=active?clamp((now-active.weaveAt)/active.duration):1,traverse=ease((p-.1)/.78);
  const direction=active?.sequence%2?1:-1,clothTop=TOP+22;
  const capacity=Math.max(1,Math.floor((bottom-clothTop-52)/ROW));
  const visible=woven.slice(-capacity),front=clothTop+visible.length*ROW;
  const selected=active||this.latest;
  const queued=records.length-woven.length,shared=Boolean(selected&&this.spools[selected.spool].size>1);
  this.drawMachine(ctx,height,amount,bottom,rack);
  readouts(ctx,height,amount,selected,queued,shared);
  this.plaqueBounds=rack.bounds;
  this.plaqueBounds.forEach((bounds,slot)=>{
   bounds.names=[...this.spools[slot]];
   plaque(ctx,slot,bounds,bounds.names,selected,rack.font);
  });
  // Spaced pastel warp pairs leave the paper visible, as in the empty reference.
  for(let i=0;i<=WARPS;i++){
   const x=LEFT+i*STEP,slot=warpSlot(i),color=yarn(slot),pull=active?.spool===slot;
   const lift=pull?Math.sin(p*Math.PI)*(i%2?1:-1)*2:0;
   line(ctx,[[x,TOP],[x,front+9],[x+lift,Math.max(TOP+39,front+28)],[x,height-55]],`${color}80`,.85);
   if(pull)line(ctx,[[x,TOP],[x,front+9]],color,1.35);
   line(ctx,[[x+1.5,TOP],[x+1.5,height-55]],'#fffefa99',.65);
   for(const dx of [-1.5,1.5])line(ctx,[[x+dx-2,TOP-19],[x+dx+2,TOP-2],[x+dx-2,TOP-2],[x+dx+2,TOP-19]],'#b2ada1',.45);
   if(i%3===0){line(ctx,[[x,height-55],[x,height-38]],'#c3beb2',.6);ellipse(ctx,x,height-38,3,1.1,ENAMEL,EDGE,.6);}
  }
  visible.forEach((r,i)=>row(ctx,r,clothTop+i*ROW));if(active)row(ctx,active,front,traverse);
  const carriage=Math.max(TOP+41,front+15),lift=active?Math.sin(p*Math.PI)*4:0;
  for(let i=0;i<WARPS;i++){const x=LEFT+i*(RIGHT-LEFT)/WARPS;line(ctx,[[x,carriage-4],[x,carriage+22]],'#c7c2b6',.45);ellipse(ctx,x,carriage+9,1,2,null,'#bfb9ab',.4);}
  for(const x of [456,1178]){panel(ctx,x,carriage-9,26,36);box(ctx,x+4,carriage-4,18,25,2,'#f4f2ec','#d2cdc3',.6);}
  for(const y of [carriage-lift,carriage+17+lift]){
   ctx.save();ctx.shadowColor='#81796620';ctx.shadowBlur=3;ctx.shadowOffsetY=2;metal(ctx,464,y,721,5,1);ctx.restore();
   line(ctx,[[468,y+1],[1181,y+1]],'#fffefa',1);for(const x of [469,1187])screw(ctx,x,y+2,1.8);
  }
  if(active){
   const start=direction>0?LEFT:RIGHT, end=direction>0?RIGHT:LEFT, sx=lerp(start,end,traverse);
   line(ctx,[[start,front+1],[sx,front+7]],yarn(active.spool),.9);
   carrier(ctx,clamp(sx,LEFT+32,RIGHT-33),front+7,yarn(active.spool));
  }
  // Park the idle shuttle behind its side cover instead of floating over empty warp.
  for(const [x,y]of [[469,TOP-11],[1191,TOP-11],[469,height-42],[1191,height-42]]){
   panel(ctx,x-13,y-13,26,26);disc(ctx,x,y,8,'#f7f5ef','#ccc7bc');disc(ctx,x,y,4,'#ece9df','#d1cbbf');screw(ctx,x,y,2);
  }
  for(let y=lerp(600,340,amount);y<lerp(661,401,amount);y+=8){box(ctx,463,y,8,3,1,'#f7f5ef','#d2ccc0',.6);box(ctx,1186,y,8,3,1,'#f7f5ef','#d2ccc0',.6);}
  label(ctx,`${woven.length} ROWS${active&&active.duration<PASS?` / ×${(PASS/active.duration).toFixed(1)} FEED`:''}`,485,height-20,9,MUTED);
  if(selected)label(ctx,`${serial(selected.event.callId)}${selected.visualCount>1?` ×${selected.visualCount}`:''}`,1167,height-20,9,resultInk(selected),'right');
  ctx.restore();
 }
}
