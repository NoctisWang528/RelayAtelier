export const P={paper:'#fcfaf6',white:'#fdfcfa',enamel:'#f4f2ec',shade:'#e7e4dc',edge:'#c6c2b9',ink:'#57544d',muted:'#99958b',gold:'#c4a05c',files:'#75a575',shell:'#c6a15b',search:'#789bc3',web:'#ad8aba',agents:'#c78676',other:'#aaa792'};
const paperTiles=new WeakMap();
export function paper(c,x=0,y=0,w=1200,h=1100){let tile=paperTiles.get(c);if(!tile){const image=new OffscreenCanvas(68,68),g=image.getContext('2d');g.scale(4,4);g.fillStyle=P.paper;g.fillRect(0,0,17,17);const dot=g.createRadialGradient(7,8,0,7,8,1.75);dot.addColorStop(0,'#c9bfae');dot.addColorStop(.25,'#c9bfae');dot.addColorStop(1,'#c9bfae00');g.fillStyle=dot;g.fillRect(5,6,4,4);tile=c.createPattern(image,'repeat');tile.setTransform(new DOMMatrix().scale(.25));paperTiles.set(c,tile);}c.fillStyle=tile;c.fillRect(x,y,w,h);}
export const TAU=Math.PI*2;export const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
export function line(c,p,col=P.edge,w=1){c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=col;c.lineWidth=w;c.stroke();}
export function circle(c,x,y,r,f,s,w=1){c.beginPath();c.arc(x,y,r,0,TAU);if(f){c.fillStyle=f;c.fill();}if(s){c.strokeStyle=s;c.lineWidth=w;c.stroke();}}
export function rect(c,x,y,w,h,r=3,f=P.white,s=P.edge,lw=1){c.beginPath();c.roundRect(x,y,w,h,r);if(f){c.fillStyle=f;c.fill();}if(s){c.strokeStyle=s;c.lineWidth=lw;c.stroke();}}
export function label(c,s,x,y,size=12,color=P.ink,align='left',bold=false){c.font=`${bold?'700 ':''}${size}px ComicMono,monospace`;c.textAlign=align;c.textBaseline='middle';c.fillStyle=color;c.fillText(String(s),x,y);}
export function screw(c,x,y,r=2.3,rotation=0){
 circle(c,x+.4,y+.7,r,P.shade);circle(c,x,y,r,P.white,'#bcb9b0',.65);
 const co=Math.cos(rotation),si=Math.sin(rotation),dx=r*(.48*co+.45*si),dy=r*(.48*si-.45*co);
 line(c,[[x-dx,y-dy],[x+dx,y+dy]],'#b7b4ab',.6);
}
export function panel(c,x,y,w,h,inside=P.enamel){c.save();c.shadowColor='#6b62542a';c.shadowBlur=9;c.shadowOffsetY=4;rect(c,x,y,w,h,5,P.white,P.edge);c.restore();rect(c,x+3,y+3,w-6,h-6,3,null,'#e3e0d8',.7);rect(c,x+7,y+7,w-14,h-14,3,inside,'#d4d0c6',.8);for(const px of [x+5,x+w-5])for(const py of[y+5,y+h-5])screw(c,px,py,1.4);}
export function metal(c,x,y,w,h,r=3){const g=c.createLinearGradient(x,y,x,y+h);g.addColorStop(0,'#fcfbf8');g.addColorStop(.12,'#f5f3ef');g.addColorStop(.52,'#e7e4dc');g.addColorStop(.82,'#f7f5ef');g.addColorStop(1,'#d5d0c6');rect(c,x,y,w,h,r,g,P.edge,.85);line(c,[[x+r,y+1.5],[x+w-r,y+1.5]],'#fff',1);}
export function pipe(c,vertices,width=6,color=null){
 c.save();c.lineJoin='round';c.lineCap='round';c.beginPath();
 if(vertices.points){vertices.points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));}
 else{c.moveTo(...vertices[0]);for(let i=1;i<vertices.length-1;i++){const p=vertices[i],n=vertices[i+1],a=vertices[i-1],r=Math.min(width*3,Math.hypot(p[0]-a[0],p[1]-a[1])/2,Math.hypot(n[0]-p[0],n[1]-p[1])/2);if(r)c.arcTo(...p,...n,r);else c.lineTo(...p);}c.lineTo(...vertices.at(-1));}
 for(const [col,w] of [['#bdb9b0',width+2],['#fffefb',width],['#e5e1d8',Math.max(.5,width-2.5)],['#faf9f5',Math.max(.5,width-4)]]){c.strokeStyle=col;c.lineWidth=w;c.stroke();}
 if(color){c.strokeStyle=color;c.lineWidth=1.7;c.stroke();}c.restore();
}
export function clampJoint(c,x,y,vertical=true){c.save();c.translate(x,y);if(!vertical)c.rotate(Math.PI/2);rect(c,-5,-3,10,6,1,P.white,P.edge,.7);line(c,[[-2,-3],[-2,3]],'#ddd8cf',.5);c.restore();}
export function vent(c,x,y,w=40,n=4){for(let i=0;i<n;i++)rect(c,x,y+i*5,w,2,1,P.shade,P.edge,.5);}
export function dial(c,x,y,r,rotation=0,{tools=[],color=null,ticks=true,openCenter=false}={}){
 c.save();c.shadowColor='#756f6330';c.shadowBlur=23;c.shadowOffsetX=9;c.shadowOffsetY=4;circle(c,x,y,r,P.white,P.edge);c.restore();
 const enamel=c.createRadialGradient(x,y,r-410,x,y,r);enamel.addColorStop(0,'#faf9f6');enamel.addColorStop(.1,'#f0eee8');enamel.addColorStop(.14,'#fdfcfa');enamel.addColorStop(.75,'#fdfcfa');enamel.addColorStop(.91,'#f7f5f0');enamel.addColorStop(1,'#e0ddd5');circle(c,x,y,r-2,enamel);
 for(const [rr,col,w] of [[r-2,'#a9a59c',.8],[r-5,'#fcfbf8',3],[r-9,'#c1bdb3',.65],[r-13,'#fdfcfa',4],[r-19,'#b6b1a7',.75],[r-24,'#e1ddd3',5],[r-30,'#fff',2],[r-34,'#c5c0b6',.7],[r-67,'#d0cabe',4],[r-75,'#fff',2],[r-98,'#d2cdc3',.8],[r-105,'#fff',1.5],[r-349,'#cbc6bc',1],[r-359,'#fff',2],[r-371,'#d9d5cb',10],[r-381,'#c7c2b8',.7],[r-394,'#fff',3],[r-402,'#c3bdb2',.7]])circle(c,x,y,rr,null,col,w);
 if(openCenter){c.save();c.beginPath();c.arc(x,y,r-405,0,TAU);c.clip();paper(c);c.restore();}
 if(ticks){for(let i=0;i<1800;i++){const a=i*TAU/1800+rotation,co=Math.cos(a),si=Math.sin(a),px=x+co*(r-9),py=y+si*(r-9);if(px< -35||px>1235||py< -35||py>1135)continue;const major=i%25===0,mid=i%5===0;line(c,[[x+co*(r-(major?30:mid?22:16)),y+si*(r-(major?30:mid?22:16))],[px,py]],major?'#9b978e':'#aaa69d',major?.9:.5);if(major){line(c,[[x+co*(r-31),y+si*(r-31)],[x+co*(r-49),y+si*(r-49)]],'#9f998f',1.2);c.save();c.translate(x+co*(r-55),y+si*(r-55));c.rotate(a);label(c,String(Math.round(i/5)%360).padStart(3,'0'),-3,0,14,P.muted,'right',true);c.restore();}if(mid)line(c,[[x+co*(r-98),y+si*(r-98)],[x+co*(r-(major?88:94)),y+si*(r-(major?88:94))]],'#c2bdb3',.6);}}
 // Half-sector offset keeps the two support beams either side of the read position.
 for(let i=0;i<12;i++){const a=(i+.5)*TAU/12+rotation,co=Math.cos(a),si=Math.sin(a),px=x+co*(r-225),py=y+si*(r-225);if(px< -160||px>1360||py< -150||py>1250)continue;
  const a1=[x+co*(r-99),y+si*(r-99)],a2=[x+co*(r-350),y+si*(r-350)];
  c.save();c.shadowColor='#6b655c37';c.shadowBlur=5;c.shadowOffsetY=3;line(c,[a1,a2],'#c4c0b7',6);c.restore();line(c,[a1,a2],'#fffefa',4.4);line(c,[[a1[0]-si*2,a1[1]+co*2],[a2[0]-si*2,a2[1]+co*2]],'#d6d1c7',.7);
  for(const rr of [r-105,r-344])screw(c,x+co*rr,y+si*rr,2.1);
 }
 for(let i=0;i<tools.length;i++){const tool=tools[i];if(!tool)continue;const a=i*TAU/32+rotation,xx=x+Math.cos(a)*(r-225),yy=y+Math.sin(a)*(r-225);if(xx< -180||xx>1380||yy< -120||yy>1220)continue;
  c.save();c.translate(xx,yy);c.rotate(a);c.beginPath();c.rect(-111,-99,222,198);c.clip();
  line(c,[[-111,-96],[111,-96]],'#d9d4ca',.8);label(c,tool.tool?.toUpperCase().slice(0,21)||tool.type,-104,-69,14,P.ink,'left',true);label(c,String(tool.calls||1).padStart(2,'0'),105,-69,11,P.muted,'right');
  label(c,'S'+String(i+1).padStart(2,'0')+' / '+(tool.status==='started'?'RUNNING':tool.status.toUpperCase()),-104,-85,8,P.muted);
  const rows=(tool.targets||[tool.target]).filter(Boolean).slice(-8);rows.forEach((target,j)=>label(c,String(j+1).padStart(2,'0')+' '+target.slice(0,30),-104,-40+j*14,10,P.muted));
  const col=tool.status==='failed'?'#c57c70':P[tool.toolType]||P.gold;rect(c,-112,-99,224,4,0,col+'45',null);c.restore();
 }
 for(let i=0;i<540;i++){const a=i*TAU/540+rotation,px=x+Math.cos(a)*(r-377),py=y+Math.sin(a)*(r-377);if(px<0||px>1200||py<0||py>1100)continue;circle(c,px+.4,py+.8,4,'#cac5bb');circle(c,px,py,3.7,'#fffefa','#c5c0b7',.65);}
 for(let i=0;i<180;i++){const a=i*TAU/180+rotation;for(const rr of [r-389,r-361]){const xx=x+Math.cos(a)*rr,yy=y+Math.sin(a)*rr;if(xx>0&&xx<1200&&yy>0&&yy<1100)screw(c,xx,yy,1.8);}}
 if(color)circle(c,x,y,r-368,null,color+'b0',2);
 // The cable drum is a separate, much larger-radius circle, as in the reference.
 for(let i=0;i<16;i++)circle(c,-2308,y-35,3098+i*1.5,null,i%3===0?'#aaa69e':'#c9c5bb',.6);
}
export function meter(c,x,y,r=37,value=0){circle(c,x+1,y+2,r+3,'#e0dcd2','#cbc6bb');circle(c,x,y,r,P.white,P.edge);circle(c,x,y,r-4,P.enamel,'#ded9cf');for(let i=0;i<32;i++){const a=Math.PI*.68+i*Math.PI*1.63/31;line(c,[[x+Math.cos(a)*(r-7),y+Math.sin(a)*(r-7)],[x+Math.cos(a)*(r-(i%4?10:14)),y+Math.sin(a)*(r-(i%4?10:14))]],'#969185',.7);}const a=Math.PI*.8+clamp(value)*Math.PI*1.35;line(c,[[x,y],[x+Math.cos(a)*(r-14),y+Math.sin(a)*(r-14)]],'#6f6a5f',1.5);circle(c,x,y,2,P.white,P.edge);}
export function screen(c,x,y,w,h,event=null){panel(c,x,y,w,h);rect(c,x+14,y+15,w-28,h-30,4,'#f8f6ef','#bdb8ad');line(c,[[x+22,y+27],[x+w-22,y+27]],'#e0d9ca');label(c,'TOOL SIGNAL',x+25,y+40,10,P.muted);c.save();c.beginPath();c.rect(x+23,y+46,w-48,h-67);c.clip();const name=event?.tool||'STANDBY';label(c,name.length>27?name.slice(0,26)+'…':name,x+25,y+h*.52,Math.min(25,w/10,(w-48)/Math.max(name.length,7)*1.6),P.ink,'left',true);label(c,(event?.target||'LOCAL / READ ONLY').slice(0,38),x+25,y+h*.72,Math.min(12,w/24),P.muted);c.restore();const col=event?.status==='failed'?'#c87c72':event?P[event.toolType]:'#cec8bb';circle(c,x+w-29,y+h-29,5,col);}
