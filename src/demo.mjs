const tools=[['Read','files','renderer.mjs'],['Shell','shell','npm'],['Grep','search','scene'],['WebFetch','web','docs.example.org'],['spawn_agent','agents','worker'],['Edit','files','engine.mjs'],['Glob','search','src'],['Write','files','loom.mjs']];
export function demoEvent(i,status='started',now=Date.now()) {
  const [tool,toolType,target]=tools[i%tools.length], child=i%7===4;
  return {id:`demo-${i}-${status}`,callId:`demo-${i}`,sessionId:'demo-session',agentId:child?'worker-01':i%11===3?'worker-02':'main',parentAgentId:child||i%11===3?'main':null,timestamp:new Date(now).toISOString(),source:'demo',tool,toolType,status,target};
}
export class DemoPlayer {
  constructor(emit){this.emit=emit;this.i=0;this.next=0;this.ends=[];}
  tick(t){
    if(t>=this.next){
      const i=this.i++;this.emit(demoEvent(i));
      this.ends.push({at:t+.7+(i%4)*.4,i,waitAt:i%9===5?t+.4:null});this.next=t+.8+(i%3)*.22;
      if(i%17===8){this.emit(demoEvent(this.i));this.ends.push({at:t+2,i:this.i++});}
    }
    this.ends=this.ends.filter(x=>{if(x.waitAt!=null&&!x.waitSent&&t>=x.waitAt){this.emit(demoEvent(x.i,'waiting'));x.waitSent=true;}if(t<x.at)return true;this.emit(demoEvent(x.i,x.i%13===10?'failed':x.i%19===14?'unknown':'completed'));return false;});
  }
}
