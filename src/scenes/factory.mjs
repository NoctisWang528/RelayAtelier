import { EDGE, ENAMEL, INK, MUTED, box, clamp, cylinder, disc, ease, ellipse, glyph, label, lerp, line, metal, panel, pipe, polygon, screw, short, statusColor, statusMark, toolColor } from './scene-utils.mjs';
import { accept } from './casino-utils.mjs';

const CYCLE = 1.2;
const PICK = .20, RELEASE = .50;
const BELT_LENGTH = 1320, COAST = .14, MAX_RUNOUT = .85;
const phase = (r, t) => (t - r.start) / r.duration;

// Belt displacement in longitudinal deck coordinates. Every box rides the same slats.
function travelAt(records, t) {
  const r = records.findLast(r => r.start <= t);
  if (!r) return records[0]?.startU ?? 0;
  const progress = phase(r, t);
  const coast = Math.max(0, t - (r.start + r.duration)) * COAST;
  return r.startU + Math.min(r.pitch * clamp(progress) + coast, r.pitch * RELEASE + MAX_RUNOUT);
}

function exitTime(records, distance) {
  const r = records.findLast(r => r.startU < distance);
  const delta = distance - r.startU;
  if (delta <= r.pitch) return r.start + r.duration * delta / r.pitch;
  return r.start + r.duration + (delta - r.pitch) / COAST;
}

function belt(ctx, travel, point) {
  const a = point(-.12, -1), b = point(1.12, -1), c = point(1.12, 1), d = point(-.12, 1);
  ctx.save();
  // Legs sit behind the deck; the near apron masks their upper attachments.
  for (let u=-.07;u<1.12;u+=.135) for (const side of [1,-1]) {
    const [x,y]=point(u,side*1.02);
    polygon(ctx,[[x-12,y+61],[x+17,y+53],[x+29,y+66],[x,y+75]],'#d1cec4',EDGE);
    polygon(ctx,[[x-12,y+58],[x+17,y+50],[x+29,y+63],[x,y+72]],ENAMEL,EDGE);
    polygon(ctx,[[x-3,y+15],[x+9,y+12],[x+9,y+59],[x-3,y+63]],'#e4e1d9','#b7b3a9');
    polygon(ctx,[[x+9,y+12],[x+15,y+18],[x+15,y+57],[x+9,y+59]],'#c8c4b9',EDGE);
    line(ctx,[[x,y+23],[x,y+58]],'#fffefa',2);
    screw(ctx,x-3,y+64,2);screw(ctx,x+20,y+61,2);
  }
  ctx.shadowColor = '#5b534554'; ctx.shadowBlur = 32; ctx.shadowOffsetX = -25; ctx.shadowOffsetY = 45;
  polygon(ctx, [a,b,c,d], '#eeece5', EDGE); ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  polygon(ctx, [a,b,[b[0],b[1]+25],[a[0],a[1]+25]], '#e5e2d9', '#bbb8ae');
  polygon(ctx, [c,d,[d[0],d[1]+24],[c[0],c[1]+24]], '#fdfcf9', EDGE);
  ctx.save(); polygon(ctx,[a,b,c,d]); ctx.clip();
  const offset = travel % .025;
  for (let u = -.15 + offset; u < 1.18; u += .025) {
    polygon(ctx, [point(u,-.96),point(u+.023,-.96),point(u+.023,.96),point(u,.96)], '#f1ece4', '#bdb8af', .9);
    line(ctx,[point(u+.001,-.95),point(u+.001,.95)],'#fffefa',1.4);
  }
  ctx.restore();
  line(ctx,[[a[0],a[1]+22],[b[0],b[1]+22]],'#bcb8ae',1.4);
  line(ctx,[[a[0],a[1]+3],[b[0],b[1]+3]],'#fffefa',2);
  ctx.restore();
}
function beltRail(ctx, point, side) {
  const start=point(-.1,side*1.04),end=point(1.1,side*1.04);
  pipe(ctx,[[start[0],start[1]+5],[end[0],end[1]+5]],5);
  for(let u=-.05;u<1.12;u+=.095){
    const p=point(u,side*1.05);
    polygon(ctx,[[p[0]-7,p[1]+6],[p[0]+6,p[1]+2],[p[0]+10,p[1]+7],[p[0]-3,p[1]+11]],ENAMEL,EDGE);
    polygon(ctx,[[p[0]-3,p[1]+3],[p[0]+3,p[1]+1],[p[0]+3,p[1]-44],[p[0]-3,p[1]-42]],'#fdfcf9','#b1ada3');
    polygon(ctx,[[p[0]+3,p[1]+1],[p[0]+6,p[1]+4],[p[0]+6,p[1]-41],[p[0]+3,p[1]-44]],'#d0ccc1',EDGE);
    screw(ctx,p[0],p[1]+5,2);
  }
  pipe(ctx,[[start[0],start[1]-43],[end[0],end[1]-43]],4);
  pipe(ctx,[[start[0],start[1]-34],[end[0],end[1]-34]],2.5);
  for(let u=-.08;u<1.13;u+=.028){const p=point(u,side*1.05);screw(ctx,p[0],p[1]+16,1.3);}
}

// Local axes follow the slats and the belt edges in both viewport shapes.
function deckProjection(point) {
  const [x,y] = point(0);
  const along = point(1), across = point(0,1);
  const length = Math.hypot(along[0]-x, along[1]-y), width = Math.hypot(across[0]-x, across[1]-y);
  const dx = (along[0]-x)/length, dy = (along[1]-y)/length;
  const wx = (across[0]-x)/width, wy = (across[1]-y)/width;
  return (d,w,z=0) => [dx*d + wx*w, dy*d + wy*w - z];
}

function solid(ctx, p, d0,d1,w0,w1,z0,z1, lid,side,front,edge) {
  polygon(ctx,[p(d0,w0,z0),p(d1,w0,z0),p(d1,w0,z1),p(d0,w0,z1)],side,edge,.8);
  polygon(ctx,[p(d1,w0,z0),p(d1,w1,z0),p(d1,w1,z1),p(d1,w0,z1)],front,edge,.8);
  polygon(ctx,[p(d0,w0,z1),p(d1,w0,z1),p(d1,w1,z1),p(d0,w1,z1)],lid,edge,.8);
}

function cartonSize(event) {
  // Width, depth and wall height are in projected scene units.
  if (/edit|write/i.test(event.tool)) return [48,34,46];
  switch (event.toolType) {
    case 'files': return [98,73,103];
    case 'shell': return [88,78,55];
    case 'search': return [53,48,29];
    case 'web': return [96,65,88];
    case 'agents': return [74,42,60];
    default: return [58,44,46];
  }
}

// In the face's own coordinates, start at its near edge and leave room for the call ID.
function cargoPrint(ctx, r, width, height, sticker=false) {
  const event = r.event, size = Math.min(14,height*.48,width*.38);
  const textX = 2*size+5;
  const font = Math.min(12,height*.68,(width-textX-3)/(.61*r.printId.length));
  if (sticker) {
    const paperW = font>=9 ? width : 2*size+5;
    box(ctx,0,-height/2,paperW,height,0,'#fffcf6');
    if (event.status==='failed' || event.status==='waiting' || event.status==='unknown') {
      disc(ctx,paperW,-height/2,Math.min(3.5,size*.45),statusColor(event));
    }
  }
  if (font>=9) label(ctx,r.printId,textX,0,font,INK);
  const x = size+2;
  if (/edit|write/i.test(event.tool)) {
    ctx.save(); ctx.translate(x,0); ctx.scale(size,size);
    polygon(ctx,[[-.8,.8],[-.64,.15],[.47,-.93],[.92,-.48],[-.19,.65]],null,INK,.17);
    line(ctx,[[.25,-.7],[.69,-.25]],INK,.14);
    ctx.restore();
  } else {
    glyph(ctx,event.toolType,x,0,size,INK);
  }
}

function parcel(ctx, r, at, p, growth, grounded=true) {
  const [width,depth,height] = r.size.map(n => n * lerp(r.packed,1,growth));
  const d = depth/2, w = width/2;
  ctx.save();
  ctx.translate(...at);
  if (grounded) {
    ctx.save(); ctx.translate(-3,3);
    polygon(ctx,[p(-d,-w),p(d,-w),p(d,w),p(-d,w)],'#594f3b26');
    ctx.restore();
  }
  const front = ctx.createLinearGradient(0,-height,0,height*.2);
  front.addColorStop(0,'#aaa496'); front.addColorStop(1,'#918b7e');
  const side = ctx.createLinearGradient(0,-height,-w,height*.3);
  side.addColorStop(0,'#d4cfc2'); side.addColorStop(1,'#b9b4a7');
  solid(ctx,p,-d,d,-w,w,0,height,'#e9e5db',side,front,'#928c80');
  polygon(ctx,[p(-d,-w*.22,height),p(d,-w*.22,height),p(d,w*.22,height),p(-d,w*.22,height)],'#817c71');

  const count = r.visualCount;
  const parts = Math.min(count,4);
  for (let i=1; i<parts; i++) {
    const seam = -d + depth*i/parts;
    line(ctx,[p(seam,-w,0),p(seam,-w,height),p(seam,w,height)],'#746e63',1.9);
  }
  // The next carton can hide the downstream face. Repeat the tool mark on the near wall.
  const [dx,dy] = p(1,0);
  ctx.save(); ctx.translate(...p(-d+2,-w,height*.68)); ctx.transform(dx,dy,0,1,0,0);
  cargoPrint(ctx,r,depth-4,Math.min(26,height*.56));
  if (count>1) label(ctx,`×${count}`,depth*.5,height*.34,Math.min(12,height*.27),INK,'center');
  ctx.restore();

  const [wx,wy] = p(0,1);
  ctx.translate(...p(d,-w*.84,height*.44)); ctx.transform(wx,wy,0,1,0,0);
  cargoPrint(ctx,r,width*.84,Math.min(34,height*.55),true);
  ctx.restore();
}

function feeder(ctx, at, p, halfWidth) {
  ctx.save(); ctx.translate(...at);
  for (const d of [-34,30]) {
    solid(ctx,p,d,d+6,-halfWidth+4,-halfWidth+10,-53,-10,ENAMEL,'#c6c1b5','#aaa598',EDGE);
  }
  solid(ctx,p,-48,48,-halfWidth,halfWidth,-15,-5,'#e8e4da','#b9b4a8','#beb8ac',EDGE);
  for (let d=-47; d<47; d+=16) {
    solid(ctx,p,d,d+12,-halfWidth,halfWidth,-5,0,ENAMEL,'#c6c1b5','#b0ab9f','#b5afa3');
  }
  ctx.restore();
}

// Turned sections share a centreline. Only the crown above the thrust race rotates.
function pedestal(ctx, base, heightScale, yaw) {
  ctx.save();
  ctx.translate(...base);
  ctx.scale(1,heightScale);
  ctx.translate(6,0);
  function section(top, bottom, upperRadius, lowerRadius) {
    const enamel=ctx.createLinearGradient(-lowerRadius,0,lowerRadius,0);
    enamel.addColorStop(0,'#dedbd2'); enamel.addColorStop(.26,'#fffefa');
    enamel.addColorStop(.58,'#f2efe7'); enamel.addColorStop(.86,'#c2bdb2');
    enamel.addColorStop(1,'#ada89d');
    ctx.beginPath();
    ctx.moveTo(-upperRadius,top);
    ctx.ellipse(0,top,upperRadius,upperRadius*.27,0,Math.PI,2*Math.PI);
    ctx.lineTo(lowerRadius,bottom);
    ctx.ellipse(0,bottom,lowerRadius,lowerRadius*.27,0,0,Math.PI);
    ctx.closePath();
    ctx.fillStyle=enamel; ctx.fill(); ctx.strokeStyle='#aaa59a'; ctx.lineWidth=1; ctx.stroke();
    ellipse(ctx,0,top,upperRadius,upperRadius*.27,ENAMEL,'#b7b2a7');
  }
  section(120,127,66,67);
  for (const a of [.32,1.5,2.7]) screw(ctx,61*Math.cos(a),120+16*Math.sin(a),2.4);
  section(72,118,52,55);
  section(68,72,53,53);
  section(60,65,50,51);
  section(30,59,39,48);
  // Small keyway on the rotating skirt tracks the plane of the shoulder and elbow.
  const keyX=22*(1-2*yaw);
  line(ctx,[[keyX,40],[keyX*1.18,69]],'#bbb6aa',1);
  ctx.restore();
}

// The fixed cheeks straddle the shoulder drive and flare into the turntable.
function shoulderCheek(ctx, base, axis, side, foot) {
  ctx.save(); ctx.translate(base[0]+side*axis.x*17,base[1]+side*axis.y*17);
  const enamel=ctx.createLinearGradient(-20,-16,24,foot);
  enamel.addColorStop(0,side<0 ? '#c9c5ba' : '#fffdf7');
  enamel.addColorStop(.6,side<0 ? '#bcb7ab' : '#e9e5da'); enamel.addColorStop(1,'#c2bcae');
  ctx.beginPath(); ctx.moveTo(-25,foot-4);
  ctx.bezierCurveTo(-22,foot-13,-17,12,-18,1);
  ctx.bezierCurveTo(-19,-10,-12,-19,-2,-20);
  ctx.bezierCurveTo(10,-21,18,-14,19,-2);
  ctx.quadraticCurveTo(20,13,26,foot-5);
  ctx.quadraticCurveTo(27,foot,21,foot+1);
  ctx.quadraticCurveTo(-1,foot+4,-23,foot);
  ctx.closePath(); ctx.fillStyle=enamel; ctx.fill();
  ctx.strokeStyle='#aba699'; ctx.lineWidth=1; ctx.stroke(); ctx.restore();
}

function upperCasting(ctx, base, angle, length, yaw) {
  ctx.save(); ctx.translate(...base); ctx.rotate(angle);
  // The gearbox swells on one side of the pivot, with a relieved waist behind the fork.
  const finish=ctx.createLinearGradient(0,-25,0,33);
  finish.addColorStop(0,'#c4bfb2'); finish.addColorStop(.17,'#fdfbf3');
  finish.addColorStop(.42,'#f2efe5'); finish.addColorStop(.79,'#d3cec2');
  finish.addColorStop(1,'#aaa496');
  ctx.beginPath(); ctx.moveTo(-24,-12);
  ctx.quadraticCurveTo(-22,-27,-5,-28);
  ctx.bezierCurveTo(14,-29,25,-25,37,-22);
  ctx.lineTo(length-32,-13);
  ctx.quadraticCurveTo(length-20,-11,length-11,-16);
  ctx.bezierCurveTo(length+7,-24,length+20,-13,length+18,2);
  ctx.quadraticCurveTo(length+16,18,length+1,19);
  ctx.quadraticCurveTo(length-10,19,length-19,10);
  ctx.bezierCurveTo(length-30,1,length-42,4,length*.49,10);
  ctx.bezierCurveTo(length*.37,15,36,31,17,34);
  ctx.bezierCurveTo(0,37,-16,30,-22,17);
  ctx.quadraticCurveTo(-29,3,-24,-12);
  ctx.closePath(); ctx.fillStyle=finish; ctx.fill();
  ctx.fillStyle=`rgba(107,100,86,${.16*(1-yaw)})`; ctx.fill();
  ctx.strokeStyle='#a9a396'; ctx.lineWidth=1; ctx.stroke();

  // Recessed gearcase lid follows the broad shoulder pocket and lifts off at the two screws.
  const lip=ctx.createLinearGradient(0,-20,0,18);
  lip.addColorStop(0,'#c4beb1'); lip.addColorStop(.19,'#f1ede4'); lip.addColorStop(1,'#ded9cd');
  ctx.beginPath(); ctx.moveTo(16,-18);
  ctx.quadraticCurveTo(22,-21,36,-17); ctx.lineTo(length*.66,-9);
  ctx.quadraticCurveTo(length*.72,-6,length*.66,-2);
  ctx.lineTo(49,4); ctx.quadraticCurveTo(40,6,32,14);
  ctx.quadraticCurveTo(21,24,12,18); ctx.quadraticCurveTo(6,13,8,3);
  ctx.lineTo(11,-11); ctx.quadraticCurveTo(12,-16,16,-18); ctx.closePath();
  ctx.fillStyle=lip; ctx.fill(); ctx.strokeStyle='#a39c8d'; ctx.lineWidth=1.3; ctx.stroke();
  screw(ctx,18,12,2); screw(ctx,length*.63,-6,1.6);
  ctx.restore();
}

function forearm(ctx, elbow, target, angle) {
  const dx=target[0]-elbow[0], dy=target[1]-elbow[1], length=Math.hypot(dx,dy);
  ctx.save(); ctx.translate(...elbow); ctx.rotate(angle);
  const light=(.6*dy-.8*dx)/length, crest=.5+light*.32;
  const finish=ctx.createLinearGradient(0,-15,0,15);
  finish.addColorStop(0,`hsl(43 11% ${77-10*light}%)`);
  finish.addColorStop(crest-.15,'#e9e5db'); finish.addColorStop(crest,'#fffef9');
  finish.addColorStop(crest+.15,'#e9e5db');
  finish.addColorStop(1,`hsl(43 11% ${77+10*light}%)`);
  ctx.beginPath(); ctx.moveTo(0,-15);
  ctx.bezierCurveTo(length*.35,-15,length*.77,-7,length,-7.5);
  ctx.quadraticCurveTo(length+4,0,length,7.5);
  ctx.bezierCurveTo(length*.66,7,length*.28,15,0,15);
  ctx.bezierCurveTo(-18,15,-18,-15,0,-15);
  ctx.closePath(); ctx.fillStyle=finish; ctx.fill(); ctx.strokeStyle='#aaa599'; ctx.lineWidth=1; ctx.stroke();
  ctx.restore();
}

// The forearm pivots between the integral far lug and this offset front ear.
function elbowEar(ctx, elbow, axis, angle) {
  ctx.save(); ctx.translate(elbow[0]+axis.x*11,elbow[1]+axis.y*11); ctx.rotate(angle);
  const enamel=ctx.createLinearGradient(0,-17,0,17);
  enamel.addColorStop(0,'#fdfaf2'); enamel.addColorStop(.65,'#e3ded2'); enamel.addColorStop(1,'#bcb6a8');
  ctx.beginPath(); ctx.moveTo(-32,-10); ctx.quadraticCurveTo(-21,-9,-12,-15);
  ctx.bezierCurveTo(2,-24,18,-15,18,-2); ctx.quadraticCurveTo(19,12,7,16);
  ctx.quadraticCurveTo(-2,20,-13,13); ctx.lineTo(-30,3);
  ctx.quadraticCurveTo(-36,-1,-32,-10); ctx.closePath();
  ctx.fillStyle=enamel; ctx.fill(); ctx.strokeStyle='#b1a99b'; ctx.lineWidth=1; ctx.stroke();
  ctx.restore();
}

function pin(ctx, pivot, radius, axis, reach) {
  // Only the lip beyond the outer cheek is exposed.
  const projection=Math.hypot(axis.x,axis.y), end=reach*projection, rx=radius*axis.depth;
  ctx.save(); ctx.translate(...pivot); ctx.rotate(axis.tilt);
  ctx.beginPath(); ctx.ellipse(end-4*projection,0,rx,radius,0,Math.PI/2,3*Math.PI/2);
  ctx.lineTo(end,-radius); ctx.ellipse(end,0,rx,radius,0,-Math.PI/2,Math.PI/2);
  ctx.closePath(); ctx.fillStyle='#b7b0a2'; ctx.fill(); ctx.strokeStyle='#a49e90'; ctx.lineWidth=.8; ctx.stroke();
  ellipse(ctx,end,0,rx,radius,'#ded9cd','#a8a293',.8);
  ellipse(ctx,end,0,rx*.56,radius*.56,'#b4ad9e','#f4f0e7',.8);
  ellipse(ctx,end,0,rx*.23,radius*.23,'#e9e5da','#9d9789',.6);
  ctx.restore();
}

const HEAD_HEIGHT = 28;
function wrist(progress, home, feed, drop, height, compact) {
  const pickY = feed[1]-height-HEAD_HEIGHT, releaseY = drop[1]-height-HEAD_HEIGHT;
  const highY = lerp(Math.min(pickY,releaseY,home[1])-50,Math.min(pickY,releaseY)-40,compact);
  const stops = [
    [0,...home], [.09,feed[0],highY], [.16,feed[0],pickY], [PICK,feed[0],pickY],
    [.29,feed[0],highY], [.38,drop[0],highY], [RELEASE,drop[0],releaseY],
    [.56,drop[0],releaseY], [.76,...home],
  ];
  for (let i=1; i<stops.length; i++) {
    const [end,x,y] = stops[i];
    if (progress>end) continue;
    const [start,ax,ay] = stops[i-1], u = ease((progress-start)/(end-start));
    // The empty tool rises before swinging over the feed, then approaches vertically.
    if (start===0) return [lerp(ax,x,u*u),lerp(ay,y,1-(1-u)**2)];
    return [lerp(ax,x,u),lerp(ay,y,u)];
  }
  return home;
}

function gripper(ctx, target, p, jaw, carried, packedHeight) {
  ctx.save(); ctx.translate(...target);
  // The slides translate along the belt axis, keeping both pad faces parallel.
  ctx.translate(0,HEAD_HEIGHT);
  const finger = side => {
    const inner=side*jaw, d=side<0 ? inner-4 : inner;
    solid(ctx,p,d,d+4,-8,8,-19,0,ENAMEL,'#d3cfc4','#aaa598',EDGE);
    // The far pad faces the viewer. Only the thin edge of the near pad is visible.
    const pad=side<0
      ? [p(inner,-8,-18),p(inner,8,-18),p(inner,8,-4),p(inner,-8,-4)]
      : [p(inner,-8,-18),p(inner+1,-8,-18),p(inner+1,-8,-4),p(inner,-8,-4)];
    polygon(ctx,pad,'#a39f92');
    if (side>0) screw(ctx,...p(d+4,0,-8),1.3);
    solid(ctx,p,d-1,d+5,-8,8,0,5,ENAMEL,'#d2cec4','#b6b1a5',EDGE);
  };
  finger(-1);
  if (carried) parcel(ctx,carried,[0,packedHeight],p,0,false);
  for (const w of [-5,5]) {
    solid(ctx,p,-jaw-1,jaw+1,w-2,w+2,2,5,'#e6e2d7','#989387','#a19c90','#9c9689');
  }
  solid(ctx,p,-9,9,-12,12,1,8,ENAMEL,'#dfdbd1','#bdb8ac','#b1ac9f');
  cylinder(ctx,-8,-12,16,4);
  cylinder(ctx,-5,-21,10,10);
  finger(1);
  ctx.restore();
}
function hose(ctx,draw,width){
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  for(const [color,w,shift]of [['#aaa69c',width+2,0],['#e1ded5',width,0],['#fffefa',width*.3,-1.5]]){
    ctx.save();ctx.translate(shift,shift);ctx.beginPath();draw(ctx);ctx.strokeStyle=color;ctx.lineWidth=w;ctx.stroke();ctx.restore();
  }
  ctx.restore();
}
function generator(ctx,turn){
  // Rear plumbing and mounting feet remain stationary around the turning rotor.
  pipe(ctx,[[1143,518],[1143,277],[1119,277]],5);
  for(const y of [293,455,514]){metal(ctx,1138,y,11,7,0);screw(ctx,1143,y+3,1.5);}
  for(const x of [1007,1095]){
    panel(ctx,x-7,524,25,7);cylinder(ctx,x,485,11,40);
    line(ctx,[[x+3,491],[x+3,520]],'#aaa69c',1);screw(ctx,x+5,526,2);
  }
  for(const y of [379,385,391])pipe(ctx,[[837,y],[878,y]],3);
  pipe(ctx,[[847,401],[847,499]],4);
  line(ctx,[[846,448],[980,448]],'#a4a196',9);
  for(const x of [866,930]){metal(ctx,x,483,18,38,1);box(ctx,x+4,489,10,27,1,'#f2efe7',EDGE);}
  const motor=ctx.createLinearGradient(0,405,0,491);
  motor.addColorStop(0,'#fdfcf9');motor.addColorStop(.2,'#f3f0e8');motor.addColorStop(.7,'#d4d0c6');motor.addColorStop(1,'#a6a297');
  box(ctx,860,406,93,85,0,motor,EDGE);
  ellipse(ctx,953,448,9,42,'#c3bfb5','#a9a599');
  for(let x=862;x<=950;x+=14){
    ctx.beginPath();ctx.ellipse(x,448,6,42,0,-Math.PI/2,Math.PI/2);ctx.strokeStyle='#aaa69b';ctx.lineWidth=1.2;ctx.stroke();
    line(ctx,[[x-1,408],[x-1,486]],'#fffefa',1.2);
  }
  ellipse(ctx,860,448,8,42,'#e4e0d7','#b2aea3');
  metal(ctx,872,366,34,49,0);box(ctx,876,385,27,26,1,'#dedbd2','#b2aea4');
  for(const x of [879,899])for(const y of [389,407])screw(ctx,x,y,1.4);
  metal(ctx,968,414,13,66,0);
  for(let y=418;y<479;y+=4)line(ctx,[[968,y],[980,y]],'#a8a498',1);
  ellipse(ctx,987,445,7,24,'#dfdbd1','#aaa69c');
  // The generator faces the viewer. Its chamber, rotor and bearing share one axis.
  ctx.save();ctx.translate(1053,439);
  disc(ctx,0,0,69,'#c8c4bb','#a9a59b',1.3);
  for(let i=0;i<16;i++){
    const a=i*Math.PI/8;
    ctx.save();ctx.rotate(a);metal(ctx,-5,-74,10,12,3);ctx.restore();
  }
  disc(ctx,0,0,65,'#e5e1d8','#aaa69b',1.1);
  disc(ctx,0,0,59,'#f8f6f0','#aaa69b',1.3);
  const chamber=ctx.createLinearGradient(-40,-45,45,46);
  chamber.addColorStop(0,'#a9a599');chamber.addColorStop(1,'#d6d1c6');
  disc(ctx,0,0,54,chamber);
  ctx.save();ctx.clip();
  for(const radius of [50,46,42])disc(ctx,0,0,radius,null,'#b6b1a5',.8);
  ctx.rotate(turn*.017);
  for(let i=0;i<3;i++){
    ctx.beginPath();ctx.moveTo(-9,8);ctx.bezierCurveTo(-22,-6,-27,-38,-14,-52);ctx.bezierCurveTo(7,-52,34,-36,44,-19);ctx.bezierCurveTo(23,-20,10,-9,7,10);ctx.closePath();
    ctx.fillStyle='#e8e4da';ctx.fill();ctx.strokeStyle='#928d80';ctx.lineWidth=1;ctx.stroke();
    ctx.beginPath();ctx.moveTo(-14,-50);ctx.bezierCurveTo(-7,-28,3,-16,7,-8);ctx.strokeStyle='#fffdf7';ctx.stroke();
    ctx.rotate(Math.PI*2/3);
  }
  ctx.restore();
  disc(ctx,0,0,54,null,'#a8a498',2);
  disc(ctx,0,0,21,'#b8b4a9','#a29e93');disc(ctx,0,0,18,ENAMEL,'#a7a397');
  disc(ctx,0,0,13,'#e3dfd5','#aaa69a');
  for(let i=0;i<10;i++){const a=i*Math.PI/5;screw(ctx,Math.cos(a)*15.5,Math.sin(a)*15.5,1.3);}
  disc(ctx,0,0,7,'#fffdf7','#aaa69b');screw(ctx,0,0,3);
  for(let i=0;i<18;i++){
    const a=i*Math.PI/9,x=Math.cos(a),y=Math.sin(a);
    screw(ctx,x*62,y*62,2.8);
    line(ctx,[[x*56,y*56],[x*58,y*58]],'#a7a398',1.1);
  }
  ctx.restore();
  hose(ctx,p=>{p.moveTo(990,429);p.bezierCurveTo(986,404,1001,397,1004,390);p.bezierCurveTo(1025,375,1077,375,1102,395);p.bezierCurveTo(1114,407,1120,419,1119,439);},4);
  hose(ctx,p=>{p.moveTo(1001,482);p.bezierCurveTo(1027,502,1084,499,1108,477);},4);
  for(const [x,y]of [[1004,390],[1025,382],[1079,385],[1102,395],[1014,490],[1085,489]]){metal(ctx,x-3,y-6,6,12,1);screw(ctx,x,y,1.6);}
  metal(ctx,1028,393,43,8,1);for(const x of [1032,1066])screw(ctx,x,397,1.6);
  cylinder(ctx,1027,355,20,33);ellipse(ctx,1037,355,11,5,ENAMEL);screw(ctx,1037,353,2);
  for(let y=376;y<389;y+=3)ellipse(ctx,1037,y,11,3,null,'#aaa69a',.8);
  cylinder(ctx,1050,367,12,21);for(let y=369;y<387;y+=3)ellipse(ctx,1056,y,7,2,null,'#a9a598',.8);
  hose(ctx,p=>{p.moveTo(1056,364);p.bezierCurveTo(1055,349,1067,347,1077,347);p.lineTo(1102,347);p.quadraticCurveTo(1119,347,1119,330);p.lineTo(1119,281);},10);
  for(let x=1069;x<1098;x+=3){line(ctx,[[x,341],[x,353]],'#a9a598',.8);}
  for(const x of [1069,1098])metal(ctx,x-2,338,5,18,1);
  cylinder(ctx,1109,322,20,30);ellipse(ctx,1119,349,14,5,ENAMEL,'#a9a598');
  for(let y=307;y<=325;y+=4)ellipse(ctx,1119,y,9,3,'#e6e2d9','#b5b0a5',.8);
  for(const y of [283,298])ellipse(ctx,1119,y,8,3,ENAMEL,'#b2aea3');
  pipe(ctx,[[1119,277],[1083,277],[1083,316]],5);
  metal(ctx,1079,302,8,10,1);screw(ctx,1119,276,3);
  line(ctx,[[1100,280],[1115,292]],'#aaa69c',2);
}
function machinery(ctx,latest,turn,count,amount){
  const cableX=415+94*amount,cableY=464-74*amount;
  const bendX=lerp(472,520,amount),bendY=lerp(499,460,amount);
  hose(ctx,p=>{p.moveTo(cableX,cableY);p.bezierCurveTo(cableX+32,cableY,bendX-16,bendY,bendX,bendY);p.bezierCurveTo(lerp(497,529,amount),bendY+7,lerp(520,532,amount),lerp(516,467,amount),531,lerp(493,457,amount));p.quadraticCurveTo(539,lerp(479,451,amount),539,453);p.lineTo(567,453);},12);
  for(const [x,y,a]of [[cableX+9,cableY,.12],[lerp(484,520,amount),lerp(502,460,amount),.2],[531,lerp(490,454,amount),.4]]){ctx.save();ctx.translate(x,y);ctx.rotate(a);metal(ctx,-3,-8,7,17,2);ctx.restore();}
  panel(ctx,526,421,37,39);polygon(ctx,[[544,431],[552,446],[536,446]],null,'#aaa69c');label(ctx,'ϟ',544,441,11,MUTED,'center');
  panel(ctx,550,529,605,15);panel(ctx,564,218,273,312);
  metal(ctx,565,218,272,51,1);
  // The roof grille lies flat. Apply its foreshortening to the rim, spokes and cap together.
  ctx.save();ctx.translate(760,234);ctx.scale(1,.48);
  disc(ctx,0,6,28,'#e2e0d8',EDGE);disc(ctx,0,0,27,ENAMEL,EDGE);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;line(ctx,[[0,0],[Math.cos(a)*24,Math.sin(a)*24]],EDGE,1.2);}
  disc(ctx,0,0,5,'#e5e1d8',EDGE);ctx.restore();
  screw(ctx,586,236,4);screw(ctx,812,236,4);
  disc(ctx,590,286,12,ENAMEL,EDGE);line(ctx,[[590,286],[596,279]],'#8a877c',1.4);
  for(let i=0;i<10;i++)box(ctx,643+i*6,279,5,11,0,i<Math.min(10,count)?'#ddbc65':'#d7d3c7','#b5b1a6',.5);
  panel(ctx,717,278,48,16);line(ctx,[[724,285],[758,285]],EDGE);polygon(ctx,[[784,279],[790,290],[778,290]],null,'#b7b3a8');
  panel(ctx,579,304,243,164,true);
  const screen=ctx.createLinearGradient(589,314,809,458);screen.addColorStop(0,'#eeede7');screen.addColorStop(1,latest?`${toolColor(latest.event)}30`:'#e2e5dc');
  box(ctx,589,314,223,144,1,screen,'#c9c5b9');
  label(ctx,'TOOL TRANSMISSION',603,331,8,'#858276');
  if(latest){glyph(ctx,latest.event.toolType,624,367,18,toolColor(latest.event));label(ctx,short(latest.event.tool,20),603,404,17,INK);label(ctx,short(latest.event.target,30),603,425,9,MUTED);statusMark(ctx,latest.event.status,783,370,14,statusColor(latest.event));label(ctx,latest.event.status.toUpperCase(),603,445,9,statusColor(latest.event));}
  else {label(ctx,'Awaiting',603,369,24,INK);label(ctx,'tool calls.',603,397,24,INK);label(ctx,'READ ONLY / LOCAL EVENT FEED',603,437,8,MUTED);}
  for(let i=0;i<5;i++)line(ctx,[[579,477+i*3],[822,477+i*3]],'#b5b2a8',1);
  for(let i=0;i<6;i++){
    metal(ctx,580+i*40,495,35,25,1);box(ctx,587+i*40,504,21,7,0,'#fffefa',EDGE,.5);
    box(ctx,584+i*40,492,6,5,1,'#bfb8a9',EDGE);line(ctx,[[592+i*40,516],[604+i*40,516]],'#bdb8ad',.8);
  }
  for(const x of [571,829]){metal(ctx,x,360,4,33,0);metal(ctx,x,453,4,23,0);}
  generator(ctx,turn);
  for(let x=581;x<1146;x+=21)screw(ctx,x,538,1.3);
}
function effectNoise(seed,index){
  let n=(seed^Math.imul(index+1,0x9e3779b9))>>>0;
  n^=n<<13;n^=n>>>17;n^=n<<5;return(n>>>0)/4294967296;
}
function mechanicalEffects(ctx,records,t,point,amount,height,travel,runout,exitU){
  const previous = travelAt(records,t-.7);
  let bursts=0,puffs=0;
  ctx.save();ctx.beginPath();ctx.rect(0,0,1200,height);ctx.clip();
  // Reconstruct short-lived particles from the call clock; never accumulate particle state.
  for(let i=records.length-1;i>=0;i--){
    const r=records[i], exitDistance=r.releaseU+runout, exhaust=t-r.start-r.duration*.35;
    const shards=bursts<3 && exitDistance>previous && exitDistance<=travel;
    const smoke=puffs<2 && exhaust>=0 && exhaust<.9;
    if(!shards&&!smoke)continue;
    const seed=r.seed;
    if(shards){
      bursts++;const discharge=t-exitTime(records,exitDistance),origin=point(exitU),fade=1-discharge/.7;
      for(let j=0;j<12;j++){
        const spread=effectNoise(seed,j*4),lift=effectNoise(seed,j*4+1),size=1.5+effectNoise(seed,j*4+2)*3;
        const x=origin[0]+(spread-.5)*170*discharge,y=origin[1]-25-(95+lift*100)*discharge+210*discharge*discharge;
        ctx.save();ctx.translate(x,y);ctx.rotate(effectNoise(seed,j*4+3)*Math.PI*2+(spread-.5)*14*discharge);
        ctx.globalAlpha=fade*.85;polygon(ctx,[[-size,-size*.35],[size*.7,-size],[size*.35,size]],j%3?'#49483f':'#777469');ctx.restore();
      }
    }
    if(smoke){
      puffs++;
      for(let j=0;j<3;j++){
        const age=(exhaust-j*.07)/.76;if(age<=0||age>=1)continue;
        const drift=effectNoise(seed,j+60),x=1119+(drift-.35)*15*age,y=270-130*amount-37*age;
        const radius=2+age*(5+effectNoise(seed,j+70)*3),g=ctx.createRadialGradient(x,y,0,x,y,radius);
        g.addColorStop(0,'#49483f');g.addColorStop(.45,'#77756c');g.addColorStop(1,'#77756c00');
        ctx.globalAlpha=Math.sin(Math.PI*age)*.24;disc(ctx,x,y,radius,g);
      }
    }
    if(bursts===3&&puffs===2)break;
  }
  ctx.restore();
}
export default class Factory {
 constructor() {
   this.calls = new Map();
   this.retired = new Set();
   this.nextAt = 0;
 }
 onEvent(event,t) {
   const change = accept(this.calls,this.retired,event,t);
   if (!change) return;
   const {call: record,fresh,evicted} = change;
   record.visualCount = event.visualCount ?? record.visualCount ?? 1;
   if (!fresh) return;
   const count = Math.min(record.visualCount,4);
   const id = String(event.callId || event.id);
   record.printId = '#' + (id.split(/[-_:]/).pop() || id).slice(-4).toUpperCase();
   record.size = cartonSize(event);
   record.size[1] += (count-1)*9;
   record.packed = Math.min(1,48/record.size[0],42/record.size[1],42/record.size[2]);
   record.pitch = (record.size[1]+22)/BELT_LENGTH;

   const all = [...this.calls.values()];
   const running = all.find(r => r!==record && r.start<=t && phase(r,t)<1);
   const pending = all.filter(r => r===record || r.start>t);
   const duration = Math.min(CYCLE/Math.sqrt(pending.length),9.6/pending.length);
   // Mid-cycle releases space adjacent centres by half of each carton pitch.
   let cursor = running ? running.start+running.duration : t;
   const last = all.findLast(r => r!==record && r.start<=t) ?? evicted;
   let startU = last ? travelAt([last],cursor) : 0;
   for (const r of pending) {
     r.start = cursor;
     r.duration = duration;
     r.startU = startU;
     r.releaseU = startU + r.pitch*RELEASE;
     startU += r.pitch;
     cursor += duration;
   }
   this.nextAt = cursor;
 }
 render(ctx,t,dt,state={}) {
  ctx.save();
  const height=clamp(state.viewport?.height??1100,620,1100), amount=(1100-height)/480;
  const compact=clamp((1028-height)/408);
  // Mid-height clearance prevents the flattening far rail from cutting through the pedestal.
  const beltY=lerp(190,280,amount)+320*amount*(1-amount)+9*compact;
  const x0=lerp(-45,-125,amount), beltDX=lerp(900,1250,amount), beltDY=lerp(980,320,amount);
  const point=(u,v=0)=>[x0+beltDX*u+lerp(65,95,amount)*v,beltY+beltDY*u-lerp(16,33,amount)*v];
  const project=deckProjection(point), dropU=lerp(.235,.306,amount)+.012*compact;
  const exitU=Math.min((height-14-beltY)/beltDY,(1200-20-x0)/beltDX), runout=exitU-dropU;
  const upper=133-23*compact, mountY=lerp(354,150,amount)+58*compact;
  // Allow for the fully raised fork and its flange below the actual navigation rail.
  const shoulderDrop=clamp((state.viewport?.navigation?.bottom??0)+upper+32-mountY,0,24);
  const base=[lerp(366,460,amount),mountY+shoulderDrop];
  const pedestalScale=1-.39*compact-shoulderDrop/120; // Foot stays at the same deck height.
  const drop=point(dropU), feed=point(dropU-.032*compact,1.7);
  feed[1]-=38;
  const home=[drop[0],lerp(280,166,amount)+55*compact];
  const now=state.reducedMotion ? Math.max(t,this.nextAt+MAX_RUNOUT/COAST) : t;
  const records=[...this.calls.values()], travel=travelAt(records,now);
  const job=records.find(r => r.start<=now && phase(r,now)<1);
  const progress=job ? phase(job,now) : 1;
  const queued=records.filter(r => r.born<=now && phase(r,now)<PICK);
  const outgoing=records.filter(r => phase(r,now)>=RELEASE && travel-r.releaseU<runout);
  const latest=records.reduce((a,r)=>!a||r.changed>=a.changed?r:a,null);
  // Draw from the side feeder across the far rail to the near guard.
  ctx.save();ctx.translate(0,-130*amount);machinery(ctx,latest,travel*BELT_LENGTH,queued.length,amount);ctx.restore();
  const packedHeight=job ? job.size[2]*job.packed : 0;
  const target=job ? wrist(progress,home,feed,drop,packedHeight,compact) : home;
  const yaw=ease((target[0]-drop[0])/(feed[0]-drop[0]));
  pedestal(ctx,base,pedestalScale,yaw);
  feeder(ctx,feed,project,lerp(49,69,amount));
  const staged=queued[0];
  if (staged && (staged===job || progress>=.30)) {
    parcel(ctx,staged,feed,project,0);
  }
  if (queued.length>1) {
    const [x,y]=project(48,0,-10);
    label(ctx,`+${queued.length-1}`,feed[0]+x,feed[1]+y,11,INK,'center');
  }
  belt(ctx,travel,point);
  beltRail(ctx,point,1);
  for (let i=outgoing.length-1; i>=0; i--) {
    const r=outgoing[i], distance=travel-r.releaseU;
    parcel(ctx,r,point(dropU+distance),project,ease(distance/.065));
  }
  const forearmLength=157;
  const dx=target[0]-base[0], dy=target[1]-base[1], reach=Math.hypot(dx,dy);
  const bend=Math.acos(clamp((upper*upper+reach*reach-forearmLength*forearmLength)/(2*upper*reach),-1,1));
  const angle=Math.atan2(dy,dx)+bend;
  const elbow=[base[0]+upper*Math.cos(angle),base[1]+upper*Math.sin(angle)];
  const wristAngle=Math.atan2(target[1]-elbow[1],target[0]-elbow[0]);
  // The three transverse shafts share an axis while the vertical tool flange stays level.
  const nx=lerp(.66,-.57,yaw), ny=.36;
  const axis={x:nx, y:ny, depth:Math.sqrt(1-nx*nx-ny*ny), tilt:Math.atan2(ny,nx)};
  const foot=3+33*pedestalScale;
  shoulderCheek(ctx,base,axis,-1,foot);
  upperCasting(ctx,base,angle,upper,yaw);
  shoulderCheek(ctx,base,axis,1,foot);
  pin(ctx,base,13,axis,21);
  forearm(ctx,elbow,target,wristAngle);
  elbowEar(ctx,elbow,axis,angle);
  pin(ctx,elbow,11,axis,17);
  const carried=job && progress>=PICK && progress<RELEASE ? job : null;
  const closure=ease((progress-.15)/.05)*(1-ease((progress-RELEASE)/.06));
  const jaw=lerp(32,job ? job.size[1]*job.packed/2 : 32,closure);
  gripper(ctx,target,project,jaw,carried,packedHeight);
  const wristShell=ctx.createLinearGradient(target[0]-12,target[1]-8,target[0]+9,target[1]+9);
  wristShell.addColorStop(0,'#fffdf6'); wristShell.addColorStop(1,'#c6c0b4');
  ellipse(ctx,...target,12.5,12,wristShell,'#aea79a');
  pin(ctx,target,6,axis,9);
  beltRail(ctx,point,-1);
  if (!state.reducedMotion) mechanicalEffects(ctx,records,t,point,amount,height,travel,runout,exitU);
  ctx.save();ctx.translate(0,height-1100);
  panel(ctx,39,920,405,111,true);label(ctx,latest?short(latest.event.tool,28):'FACTORY / TOOL ASSEMBLY',57,946,12,INK);label(ctx,latest?short(latest.event.target,43):'WAITING FOR TOOL CALLS',57,968,10,MUTED);
  if(latest)statusMark(ctx,latest.event.status,414,950,9,statusColor(latest.event));
  const speed=job?CYCLE/job.duration:1;label(ctx,`${queued.length} IN FEED${speed>1.05?` / ×${speed.toFixed(1)} SPEED`:''}`,57,1008,10,MUTED);
  const archived=records.filter(r=>travel-r.releaseU>=runout);archived.slice(-60).forEach((r,i)=>{const x=58+i%30*11.8,y=984+Math.floor(i/30)*7;box(ctx,x,y,9,4,0,'#eeece5',statusColor(r.event),.6);});
  ctx.restore();
  ctx.restore();
 }
}
