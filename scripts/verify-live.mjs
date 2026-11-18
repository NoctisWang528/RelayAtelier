import {SourceHub} from '../server/hub.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
const report={observedAt:new Date().toISOString(),mode:'real local read-only sources; no model invocation',sources:[],live:{durationSeconds:45,transitions:0,bySource:{},statuses:{},parentLinked:0},notes:[]};
const roots=new SourceHub().roots;await mkdir('evidence',{recursive:true});
for(const source of ['codex','claude','opencode']){
 const hub=new SourceHub({roots:{[source]:roots[source]}});const start=performance.now();await hub.start();const s=hub.snapshot();const src=s.sources.find(x=>x.source===source);const events=s.events;
 report.sources.push({...src,bootstrapMs:Math.round(performance.now()-start),retainedTransitions:events.length,retainedCalls:new Set(events.map(e=>e.callId)).size,agents:new Set(events.map(e=>e.agentId)).size,parentLinked:events.filter(e=>e.parentAgentId).length,tools:[...new Set(events.map(e=>e.toolType))],statuses:Object.fromEntries(['started','completed','failed','waiting','unknown'].map(k=>[k,events.filter(e=>e.status===k).length]))});hub.stop();console.log(source,src.status,events.length,'normalized transitions');
}
const watcher=new SourceHub({pollMs:500});await watcher.start();watcher.on('event',e=>{report.live.transitions++;report.live.bySource[e.source]=(report.live.bySource[e.source]||0)+1;report.live.statuses[e.status]=(report.live.statuses[e.status]||0)+1;if(e.parentAgentId)report.live.parentLinked++;});
await new Promise(r=>setTimeout(r,45000));watcher.stop();report.notes.push('Historical real session parsing is distinct from observing a new live call. Only live.bySource proves new events during this window. No new paid task was launched.');await writeFile('evidence/live-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
