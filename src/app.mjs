import {paper} from './porcelain.mjs';
import Dial from './scenes/dial.mjs';
import DataFlow from './scenes/dataflow.mjs';
import Factory from './scenes/factory.mjs';
import Chips from './scenes/chips.mjs';
import Rhythm from './scenes/rhythm.mjs';
import Loom from './scenes/loom.mjs';
import Slots from './scenes/slots.mjs';
import Roulette from './scenes/roulette.mjs';
import {EventStore,AnimationQueue,COLORS,TYPES} from './state.mjs';
import {DemoPlayer} from './demo.mjs';
const icons={dial:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v3m9 6h-3M12 21v-3M3 12h3m6 0 5-5"/>',factory:'<path d="M3 16h18v5H3zM6 16V9l6-5 5 4-4 4m-1-8V2m1 10 4 4m-3-3 3-3"/><path d="M6 18.5h.01m6 0h.01m6 0h.01"/>',chips:'<rect x="8" y="3" width="12" height="18" rx="2"/><path d="m5 5-3 1 2 15 3-.5M14 8l3 4-3 4-3-4z"/>',rhythm:'<path d="M8 3 2 21m9-18-2 18m4-18 2 18m1-18 6 18M4 17h16M8 8h8"/><rect x="10" y="12" width="4" height="2"/>',loom:'<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M7 3v18m5-18v18m5-18v18M3 8h18M3 16h18m-12-4h9"/>',dataflow:'<path d="m12 10-7-5m9 5 5-5M12 14l-7 5m9-5 5 5"/><circle cx="12" cy="12" r="3"/><circle cx="4" cy="4" r="2"/><circle cx="20" cy="4" r="2"/><circle cx="4" cy="20" r="2"/><circle cx="20" cy="20" r="2"/>',pin:'<path d="m9 3 6 0-1 7 4 4H6l4-4-1-7m3 11v7"/>',pause:'<path d="M8 5v14M16 5v14"/>',play:'<path d="m8 5 11 7-11 7z"/>',focus:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',mark:'<path d="M4 5h16M4 19h16M7 3v18m5-18v18m5-18v18M3 11h18m-18 3h18"/>'};
const svg=name=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
const defs=[['dial','Westworld','PRECISION ENGINE','',Dial],['loom','Loom','EVENT TEXTILE','',Loom],['factory','Factory','ASSEMBLY LINE','',Factory],['chips','Chips','TOOL HANDS','',Chips],['rhythm','Rhythm','SIGNAL SEQUENCER','',Rhythm],['slots','Slots','TOOL REELS','',Slots],['roulette','Roulette','CALL ORBIT','',Roulette],['dataflow','DataFlow','TOOL CONNECTIONS','',DataFlow]];
const statusNames={started:'进行中',completed:'已完成',failed:'失败',unknown:'未知',waiting:'等待'};
const $=selector=>document.querySelector(selector);
document.querySelector('#app').innerHTML=`<div class="app-shell">
<main class="main-stage"><div class="stage-surface"><canvas id="stage" class="stage-canvas" role="img" aria-label="Westworld 事件可视化"></canvas></div>
<nav class="mode-rail" aria-label="动画场景">${defs.map((d,i)=>`<button class="scene-button" data-scene="${d[0]}" aria-current="${i===0}" title="${d[1]} · ${i+1}">${d[1]}</button>`).join('')}</nav>

<div class="stage-status"><span id="scene-title">Westworld</span><span id="stage-summary"></span><span class="status-tally">AGENT <b id="agent-tally">0</b> 工具 <b id="tool-tally">0</b> 调用 <b id="total-tally">0</b> 文件 <b id="file-tally">0</b> 失败 <b id="error-tally">0</b></span></div>
<div id="toast" class="toast" hidden></div></main>
<section class="instrument-tray">
<div class="tray-card stream-card"><div class="tray-heading"><span>工具流</span><span id="stream-mode" class="stream-badge">LIVE</span></div><ol id="stream" class="stream" aria-label="最近工具调用"></ol></div>
<div class="tray-card rate-card"><div class="tray-heading"><span>调用率 / 15 秒</span><span id="render-rate">—</span></div><canvas id="rate-chart" aria-label="最近十五秒真实调用节奏"></canvas><div id="stage-queue" class="tray-small"></div></div>
<div class="tray-card status-card"><div class="tray-heading"><span>会话状态</span></div><div class="health-line"><span>调用 / 完成</span><strong id="call-count">0 / 0</strong></div><div class="health-line"><span>进行中 / 未知</span><strong id="active-count">0 / 0</strong></div><div class="health-line"><span>失败 / Agents</span><strong id="failed-count">0 / 0</strong></div><div class="health-line"><span>队列 / 已折叠</span><strong id="queue-count">0 / 0</strong></div></div>
<div class="tray-card source-card-main"><div class="tray-heading"><span>本地来源</span><button id="info" class="tiny-icon" aria-label="数据源与使用说明">${svg('info')}</button></div><label class="session-label" for="session">观察会话</label><select id="session" class="session-select"><option value="all">全部会话</option></select><button id="connection" class="connection-button"><span id="connection-dot" class="dot warn"></span> <span id="connection-text">正在连接</span></button><span id="last-event" class="tray-small">尚无事件</span></div>
</section>
<header class="topbar"><span class="brand-name">Relay Atelier</span><div class="source-switch" role="group" aria-label="事件来源"><button data-mode="live" aria-pressed="true">Live</button><button data-mode="replay" aria-pressed="false">Replay</button><button data-mode="demo" aria-pressed="false">Demo</button></div><span class="signal-tag"><span id="stage-dot" class="dot"></span><span id="stage-mode">LIVE / READ ONLY</span></span><div id="replay-controls" class="replay-controls" hidden><button id="replay-restart">重新播放</button><label for="replay-speed">速度</label><select id="replay-speed"><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select><span id="replay-progress"></span></div><div class="toolbar-right"><button id="pause" aria-label="暂停动画" aria-pressed="false" title="暂停 · Space">${svg('pause')}</button><button id="focus" aria-label="专注视图" aria-pressed="false" title="专注视图 · F">${svg('focus')}</button><button id="theme" aria-label="切换明暗外观" title="外观">${svg('sun')}</button><button id="pin" class="pin" aria-label="窗口置顶" aria-pressed="false" title="窗口置顶">${svg('pin')}</button></div></header>
<span id="eyebrow" hidden></span><span id="scene-subtitle" hidden></span><span id="legend" hidden></span></div>
<dialog id="source-dialog"><div class="dialog-top"><h2>本地事件观察器</h2><button id="close-dialog" aria-label="关闭说明">${svg('close')}</button></div><p>继续在原来的终端或客户端使用 Agent。程序仅读取会话事件，不启动模型，不写入 Hooks，也不上传会话。</p><div id="source-details"></div><p class="dialog-note"><strong>Live</strong> 监听真实来源，启动前的历史只进入状态。<strong>Replay</strong> 回放已读取历史，长间隔压缩至 1.4 秒。<strong>Demo</strong> 使用模拟数据。筹码、倍率与节奏是演出，不代表任务质量。<br>数据保留最近 6,000 次调用；高密度动画按批次合并，显示折叠数量。</p><div class="kbd-hints"><span><kbd>1—8</kbd> 场景</span><span><kbd>Space</kbd> 暂停</span><span><kbd>F</kbd> 专注</span></div></dialog>`;
for(const el of document.querySelectorAll('[style-placeholder]')){el.style.background=COLORS[el.getAttribute('style-placeholder')];el.removeAttribute('style-placeholder');}
let mode='live',sceneId=localStorage.getItem('relay-scene')||'dial',sessionId='all',paused=false,focus=false;
let scenes=new Map(defs.map(d=>[d[0],new d[4]()])),liveStore=new EventStore(),store=liveStore,queue=new AnimationQueue();
let snapshot={events:[],sources:[],sessions:[]},connected=false,liveHistory=[],replay=[],replayIndex=0,replayNext=0,replaySpeed=1,demo=null;
let simTime=0,lastTime=performance.now(),lastDraw=0,lastUi=0,lastActivity=-999,lastRevision=-1,frames=0,fpsAt=performance.now(),fps=0,rendered=0,toastTimer,transport=null;
let windowVisible=true;
window.relay?.onVisibility(value=>windowVisible=value);
let reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',e=>reducedMotion=e.matches);
const canvas=$('#stage'),ctx=canvas.getContext('2d',{alpha:false});
const MAX_HISTORY=4000;
function shortId(id){return id==='main'?'main':id.length>12?id.slice(0,4)+'…'+id.slice(-5):id;}
function showToast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4000);}
function resetScenes(){canvas.removeAttribute('title');scenes=new Map(defs.map(d=>[d[0],new d[4]()]));queue.clear();lastActivity=-999;}
// Existing history may identify Loom spools before the first new Live event.
function seedLiveSpools(){
 if(mode==='live')scenes.get('loom').seedTools(liveStore.view(sessionId).calls);
}
function receive(e){
 if(liveStore.apply(e)){
  liveHistory.push(e);if(liveHistory.length>MAX_HISTORY)liveHistory.shift();
  if(mode==='live'&&(sessionId==='all'||e.sessionId===sessionId)){queue.push(e);lastActivity=simTime;}
 }
}
function emit(e){if(store.apply(e)){if(sessionId==='all'||e.sessionId===sessionId){queue.push(e);lastActivity=simTime;}}}
function updateMetadata(s){if(s.events){for(const e of s.events){if(liveStore.apply(e))liveHistory.push(e);}liveHistory=liveHistory.slice(-MAX_HISTORY);}if(s.sources)snapshot.sources=s.sources;if(s.sessions)snapshot.sessions=s.sessions;if(s.revision)snapshot.revision=s.revision;updateSessions();updateSources();}
async function resync(initial=false){
 try{
  const s=window.relay?await window.relay.snapshot():await fetch('/api/snapshot').then(r=>{if(!r.ok)throw new Error('Disconnected');return r.json();});
  // History seeds the state on the first snapshot. On reconnect, missing transitions recover into the queue.
  for(const e of s.events||[]){if(initial){liveStore.apply(e);}else receive(e);}
  if(initial)liveHistory=(s.events||[]).slice(-MAX_HISTORY);
  updateMetadata(s);connected=true;lastRevision=-1;
  if(initial)seedLiveSpools();
 }catch{connected=false;}
}
function updateSessions(){
 const select=$('#session'),old=select.value;
 const items=mode==='demo'?[{id:'demo-session',label:'模拟会话',source:'demo'}]:snapshot.sessions||[];
 const signature=mode+items.map(s=>s.id).join('|');if(select.dataset.signature===signature)return;select.dataset.signature=signature;
 select.replaceChildren(new Option('全部会话','all'));
 for(const s of items.slice(0,150)){select.add(new Option(`${s.source} · ${s.label||shortId(s.id)}`,s.id));}
 select.value=[...select.options].some(o=>o.value===old)?old:'all';sessionId=select.value;
}
function updateSources(){
 const host=$('#source-details');host.replaceChildren();
 for(const source of snapshot.sources||[]){
  const box=document.createElement('div');box.className='source-card';
  const top=document.createElement('div');top.className='source-heading';const title=document.createElement('strong');title.textContent=source.source.toUpperCase();
  const status=document.createElement('span');status.textContent=source.status==='connected'?`只读监听 · ${source.files||0} 个会话文件`:source.status==='missing'?'未发现数据源':'连接异常';top.append(title,status);
  const detail=document.createElement('code');detail.textContent=source.detail||'自动发现本地默认路径';
  const last=document.createElement('code');last.textContent=`最近事件：${source.lastEventAt?new Date(source.lastEventAt).toLocaleString('zh-CN'):'尚无事件'}`;
  box.append(top,detail,last);host.append(box);
 }
 if(!host.children.length){const p=document.createElement('p');p.textContent='正在扫描本地会话目录…';host.append(p);}
}
function selectScene(id){canvas.removeAttribute('title');if(!scenes.has(id))id='dial';sceneId=id;document.body.dataset.activeScene=id;localStorage.setItem('relay-scene',id);const d=defs.find(x=>x[0]===id);$('#eyebrow').textContent=`0${defs.indexOf(d)+1} / ${d[2]}`;$('#scene-title').textContent=d[1];$('#scene-subtitle').textContent=d[3];canvas.setAttribute('aria-label',`${d[1]} · ${mode==='demo'?'模拟':mode==='replay'?'历史回放':'真实事件监听'}可视化`);document.querySelectorAll('[data-scene]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.scene===id)));}
function makeReplay(){replay=liveHistory.filter(e=>sessionId==='all'||e.sessionId===sessionId).slice().sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp));replayIndex=0;replayNext=simTime+.2;store=new EventStore();resetScenes();if(!replay.length)showToast('所选会话没有可回放的工具事件。');}
function setMode(next){
 mode=next;paused=false;setPause(false);resetScenes();sessionId='all';$('#session').value='all';
 if(mode==='live'){store=liveStore;demo=null;}
 if(mode==='demo'){store=new EventStore();demo=new DemoPlayer(emit);demo.next=simTime+.15;}
 if(mode==='replay'){demo=null;makeReplay();}
 document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
 $('#stream-mode').textContent=mode.toUpperCase();$('#stage-mode').textContent=mode==='demo'?'DEMO / SIMULATED':mode==='replay'?'REPLAY / HISTORY':'LIVE / READ ONLY';
 $('#replay-controls').hidden=mode!=='replay';$('#legend').hidden=mode==='replay';lastRevision=-1;updateSessions();seedLiveSpools();selectScene(sceneId);updateUi(store.view(sessionId));
}
function setPause(value){paused=value;$('#pause').setAttribute('aria-pressed',String(paused));$('#pause').setAttribute('aria-label',paused?'继续动画':'暂停动画');$('#pause').innerHTML=`${svg(paused?'play':'pause')} <span>${paused?'继续':'暂停'}</span>`;}
function toggleFocus(){focus=!focus;document.body.classList.toggle('focus-mode',focus);$('#focus').setAttribute('aria-pressed',String(focus));}
function setTheme(porcelain){document.body.classList.toggle('porcelain',porcelain);document.body.classList.toggle('night-mode',!porcelain);localStorage.setItem('relay-theme',porcelain?'porcelain':'graphite');$('#theme').setAttribute('aria-label',porcelain?'切换到石墨外观':'切换到瓷白外观');}
setTheme(localStorage.getItem('relay-theme')!=='graphite');selectScene(sceneId);
document.querySelectorAll('[data-scene]').forEach(b=>b.addEventListener('click',()=>selectScene(b.dataset.scene)));
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
$('#pause').addEventListener('click',()=>setPause(!paused));$('#focus').addEventListener('click',toggleFocus);$('#theme').addEventListener('click',()=>setTheme(!document.body.classList.contains('porcelain')));
$('#pin').addEventListener('click',async()=>{if(!window.relay){showToast('置顶功能可在独立桌面窗口中使用。');return;}const v=await window.relay.pin($('#pin').getAttribute('aria-pressed')!=='true');$('#pin').setAttribute('aria-pressed',String(v));});
const openInfo=()=>{updateSources();$('#source-dialog').showModal();};$('#info').addEventListener('click',openInfo);$('#connection').addEventListener('click',openInfo);$('#close-dialog').addEventListener('click',()=>$('#source-dialog').close());
$('#session').addEventListener('change',()=>{sessionId=$('#session').value;resetScenes();lastRevision=-1;if(mode==='replay')makeReplay();else seedLiveSpools();});
$('#replay-restart').addEventListener('click',makeReplay);$('#replay-speed').addEventListener('change',()=>replaySpeed=Number($('#replay-speed').value));
window.addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea')||$('#source-dialog').open)return;if(e.key>='1'&&e.key<='8')selectScene(defs[Number(e.key)-1][0]);else if(e.code==='Space'){e.preventDefault();setPause(!paused);}else if(e.key.toLowerCase()==='f')toggleFocus();});
function timeLabel(ts){if(!ts)return '尚无事件';const d=new Date(ts);return Number.isFinite(d.getTime())?d.toLocaleTimeString('zh-CN',{hour12:false}):'时间未知';}
function updateUi(view){
 $('#agent-tally').textContent=view.agents.length;$('#tool-tally').textContent=new Set(view.calls.map(e=>e.tool)).size;$('#total-tally').textContent=view.counts.total;$('#file-tally').textContent=new Set(view.calls.filter(e=>e.toolType==='files').map(e=>e.target).filter(Boolean)).size;$('#error-tally').textContent=view.counts.failed;
 const rc=$('#rate-chart'),rb=rc.getBoundingClientRect();rc.width=rb.width*2;rc.height=rb.height*2;const rg=rc.getContext('2d');rg.scale(2,2);rg.strokeStyle='#e5dfd2';rg.setLineDash([3,3]);rg.beginPath();rg.moveTo(0,rb.height-2);rg.lineTo(rb.width,rb.height-2);rg.stroke();rg.fillStyle='#aaa69a';const seconds=Date.now()/1000;for(let i=0;i<30;i++){const n=view.calls.filter(e=>{const age=seconds-Date.parse(e.startedAt||e.timestamp)/1000;return age>=i*.5&&age<(i+1)*.5;}).length;const h=Math.min(rb.height-8,n*6);rg.fillRect(rb.width-(i+1)*rb.width/30,rb.height-2-h,rb.width/30-2,h);}
 $('#call-count').textContent=`${view.counts.total} / ${view.counts.completed}`;$('#active-count').textContent=`${view.counts.active} / ${view.counts.unknown}`;$('#failed-count').textContent=`${view.counts.failed} / ${view.agents.length}`;$('#queue-count').textContent=`${queue.items.length} / ${queue.folded}`;$('#stage-queue').textContent=queue.items.length?`${queue.items.length} QUEUED`:paused?'PAUSED':'SIGNAL READY';$('#render-rate').textContent=fps+' fps';
 const sourceCount=snapshot.sources.filter(s=>s.status==='connected').length;
 $('#connection-text').textContent=!connected?'数据源连接断开 · 正在重连':sourceCount?`${sourceCount} 个本地来源 · 只读监听`:'未发现本地会话 · 等待数据源';
 $('#connection-dot').className=`dot ${!connected?'error':sourceCount?'':'warn'}`;
 const liveLast=liveStore.recent[0]?.timestamp;$('#last-event').textContent=`最近真实事件 ${timeLabel(liveLast)}`;
 $('#stage-dot').className=`dot ${mode==='live'&&!connected?'error':mode!=='live'?'warn':''}`;
 const summary=$('#stage-summary');summary.replaceChildren();const strong=document.createElement('strong');strong.textContent=String(view.counts.total).padStart(3,'0');summary.append(strong,document.createTextNode(`次调用${mode==='demo'?' · 模拟演示':mode==='replay'?' · 历史回放':' · 含已读历史'}${paused?' · 演出暂停，监听继续':!view.counts.active&&queue.items.length===0?' · 静候下一束信号':''}`));
 $('#replay-progress').textContent=`${replayIndex}/${replay.length}`;
 if(lastRevision===store.revision)return;lastRevision=store.revision;
 const stream=$('#stream');stream.replaceChildren();const calls=view.calls.sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp)).slice(0,15);
 if(!calls.length){const empty=document.createElement('li');empty.className='empty-state';empty.textContent=mode==='live'?'等待真实工具事件。继续在原来的终端或客户端使用 Agent；也可以切到 Demo 预览八种演出。':'尚无事件。';stream.append(empty);}
 for(const e of calls){const li=document.createElement('li');li.className='stream-item';
  const meta=document.createElement('div');meta.className='stream-meta';const dot=document.createElement('i');dot.className='dot';dot.style.background=COLORS[e.toolType];const agent=document.createElement('span');agent.className='agent';agent.textContent=shortId(e.agentId);const time=document.createElement('time');time.textContent=timeLabel(e.timestamp);meta.append(dot,agent,time);
  const tool=document.createElement('div');tool.className='stream-tool';const name=document.createElement('span');name.className='tool-name';name.textContent=e.tool;const status=document.createElement('span');status.className='status-label';status.dataset.status=e.status;status.textContent=e.inferred?'未知·超时':statusNames[e.status];tool.append(name,status);
  const target=document.createElement('div');target.className='stream-target';target.textContent=e.target||'—';li.append(meta,tool,target);stream.append(li);
 }
}
let loomOrigin, loomPointer;
function updateLoomHover(){
 if(!loomOrigin||!loomPointer||sceneId!=='loom')return;
 const x=(loomPointer.x-loomOrigin.left)/loomOrigin.scale;
 const y=(loomPointer.y-loomOrigin.top)/loomOrigin.scale;
 const title=scenes.get('loom').toolNamesAt(x,y).join(' · ');
 if(title===canvas.title)return;
 if(title)canvas.title=title;
 else canvas.removeAttribute('title');
}
canvas.addEventListener('pointermove', e=>{
 loomPointer={x:e.clientX,y:e.clientY};
 updateLoomHover();
});
canvas.addEventListener('pointerleave',()=>{
 loomPointer=null;
 canvas.removeAttribute('title');
});
function draw(t,dt,view){
 const box=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
 const w=Math.round(box.width*dpr),h=Math.round(box.height*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 ctx.setTransform(dpr,0,0,dpr,0,0);
 const worldH=Math.min(1100,Math.max(620,1200*box.height/box.width));const scale=Math.min(box.width/1200,box.height/worldH),ox=(box.width-1200*scale)/2,oy=(box.height-worldH*scale)/2;
 paper(ctx,0,0,box.width,box.height);
 ctx.save();ctx.translate(ox,oy);ctx.scale(scale,scale);paper(ctx,0,0,1200,worldH);
 if(sceneId==='loom')loomOrigin={left:box.left+ox,top:box.top+oy,scale};
 const nav=$('.mode-rail').getBoundingClientRect(),navigation={left:(nav.left-box.left-ox)/scale,right:(nav.right-box.left-ox)/scale,bottom:(nav.bottom-box.top-oy)/scale};
 scenes.get(sceneId).render(ctx,t,dt,{...view,reducedMotion,viewport:{width:1200,height:worldH,navigation}});ctx.restore();rendered++;
 if(sceneId==='loom')updateLoomHover();
}
function tick(now){
 const elapsed=Math.min((now-lastTime)/1000,.1);lastTime=now;
 if(!document.hidden&&windowVisible){
  if(!paused)simTime+=elapsed;
  if(!paused){if(mode==='demo')demo.tick(simTime);if(mode==='replay'){
    let budget=15;while(replayIndex<replay.length&&simTime>=replayNext&&budget-->0){emit(replay[replayIndex]);const before=replay[replayIndex++];const gap=replayIndex<replay.length?(Date.parse(replay[replayIndex].timestamp)-Date.parse(before.timestamp))/1000:0;replayNext=simTime+Math.min(1.4,Math.max(.045,gap))/replaySpeed;}
   }
   queue.drain(simTime,(e,t)=>{for(const scene of scenes.values())scene.onEvent(e,t);lastActivity=t;});
  }
  const targetFPS=paused?2:reducedMotion?10:simTime-lastActivity<6||queue.items.length?60:12;
  if(now-lastDraw>=1000/targetFPS-1){const view=store.view(sessionId);draw(simTime,paused?0:(now-lastDraw)/1000,view);lastDraw=now;frames++;if(now-lastUi>350){updateUi(view);lastUi=now;}}
  if(now-fpsAt>=1000){fps=Math.round(frames*1000/(now-fpsAt));frames=0;fpsAt=now;}
 }
 if(document.hidden||!windowVisible)setTimeout(()=>tick(performance.now()),1000);else requestAnimationFrame(tick);
}
if(window.relay){window.relay.onEvent(receive);window.relay.onStatus(updateMetadata);await resync(true);}else{
 await resync(true);transport=new EventSource('/api/events');transport.addEventListener('tool',e=>{try{receive(JSON.parse(e.data));}catch{}});transport.addEventListener('status',e=>{try{updateMetadata(JSON.parse(e.data));}catch{}});transport.onopen=()=>{connected=true;resync();};transport.onerror=()=>{connected=false;};
 $('#pin').title='独立桌面窗口支持置顶';
}
setInterval(()=>resync(),10000);updateUi(store.view());
await document.fonts.ready;
requestAnimationFrame(tick);
// Read-only diagnostics for repeatable tests. No UI injection or tool execution surface.
window.relayDiagnostics=()=>({mode,scene:sceneId,paused,connected,counts:store.view(sessionId).counts,agents:store.view(sessionId).agents.length,queue:queue.items.length,folded:queue.folded,delivered:queue.delivered,rendered,fps,simTime,sources:snapshot.sources.map(({source,status,files,lastEventAt})=>({source,status,files,lastEventAt})),replayIndex,replayLength:replay.length,reducedMotion,windowVisible,documentHidden:document.hidden});
