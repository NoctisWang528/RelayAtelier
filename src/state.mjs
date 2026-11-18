export const TYPES = ['files','shell','search','web','agents','other'];
export const COLORS = {files:'#87dfb0',shell:'#efc77b',search:'#85b9f4',web:'#b8a4f5',agents:'#ef9c8e',other:'#b4bbc9'};
export const LABELS = {files:'Files',shell:'Shell',search:'Search',web:'Web',agents:'Subagents',other:'Other'};
const terminal = new Set(['completed','failed','unknown']);
export function validateEvent(e) {
  return e && typeof e.id === 'string' && typeof e.callId === 'string' && typeof e.sessionId === 'string' && typeof e.agentId === 'string' && TYPES.includes(e.toolType) && ['started','completed','failed','unknown','waiting'].includes(e.status) && Number.isFinite(Date.parse(e.timestamp));
}
export class EventStore {
  constructor(limit=6000) { this.limit=limit; this.calls=new Map(); this.seen=new Set(); this.recent=[]; this.revision=0; }
  apply(e) {
    if(!validateEvent(e))return false;
    if(this.seen.has(e.id)){const key=`${e.source}:${e.sessionId}:${e.callId}`;const prior=this.calls.get(key);if(prior&&e.parentAgentId&&prior.parentAgentId!==e.parentAgentId){prior.parentAgentId=e.parentAgentId;this.revision++;}return false;}
    this.seen.add(e.id);
    if(this.seen.size>this.limit*4) this.seen.delete(this.seen.values().next().value);
    const key=`${e.source}:${e.sessionId}:${e.callId}`;
    const old=this.calls.get(key);
    // Late starts must not turn an already finished call back into an active one.
    if (old && terminal.has(old.status) && ['started','waiting'].includes(e.status)) return false;
    if(old?.status===e.status) return false;
    this.calls.set(key,{...old,...e,startedAt:old?.startedAt || (e.status==='started'?e.timestamp:null)});
    while(this.calls.size>this.limit) this.calls.delete(this.calls.keys().next().value);
    this.recent.unshift({...e}); this.recent.length=Math.min(this.recent.length,100);
    this.revision++; return true;
  }
  view(session='all') {
    const calls=[...this.calls.values()].filter(e=>session==='all'||e.sessionId===session).map(e=>['started','waiting'].includes(e.status)&&Date.now()-Date.parse(e.timestamp)>300000?{...e,status:'unknown',inferred:true}:e);
    const counts={total:calls.length,completed:0,failed:0,active:0,unknown:0};
    const agents=new Map();
    for(const e of calls) { if(e.status==='started'||e.status==='waiting') counts.active++; else counts[e.status]++; agents.set(e.agentId,{id:e.agentId,parentId:e.parentAgentId}); }
    return {calls,active:calls.filter(e=>e.status==='started'||e.status==='waiting'),counts,agents:[...agents.values()]};
  }
  clear(){this.calls.clear();this.seen.clear();this.recent=[];this.revision++;}
}
export class AnimationQueue {
  constructor(limit=240){this.limit=limit;this.items=[];this.folded=0;this.nextAt=0;this.delivered=0;}
  push(event){
    if(this.items.length>=this.limit){
      const same=this.items.findLast(x=>x.toolType===event.toolType&&x.status===event.status&&x.agentId===event.agentId);
      if(same){same.visualCount=(same.visualCount||1)+1;this.folded++;return;}
      this.items.shift();this.folded++;
    }
    this.items.push({...event});
  }
  drain(t,fn){
    if(t<this.nextAt||!this.items.length)return;
    const n=this.items.length>100?5:this.items.length>30?3:1;
    for(let i=0;i<n&&this.items.length;i++){fn(this.items.shift(),t);this.delivered++;}
    this.nextAt=t+(this.items.length>30?.075:.16);
  }
  clear(){this.items=[];this.folded=0;this.nextAt=0;this.delivered=0;}
}
