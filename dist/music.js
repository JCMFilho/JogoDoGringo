/* Original chiptune: a light Brazilian arcade groove, synthesized offline. */
'use strict';
const FamilyMusic=(()=>{
  const MELODY=[72,0,76,79,76,0,74,72,69,0,72,76,74,72,69,0,69,0,72,77,76,0,72,69,67,0,71,74,72,71,67,0,72,76,79,0,81,79,76,72,69,72,76,0,77,76,72,69,69,72,77,0,79,77,72,69,71,74,79,0,77,74,71,0];
  const ROOTS=[48,48,45,45,53,53,55,55];
  const frequency=n=>440*Math.pow(2,(n-69)/12);
  class Player{
    constructor(getContext,timers={}){this.getContext=getContext;this.timers={set:timers.set||((fn,ms)=>setInterval(fn,ms)),clear:timers.clear||(id=>clearInterval(id))};this.context=null;this.master=null;this.timer=null;this.nodes=new Set();this.step=0;this.nextTime=0;this.playing=false;}
    start(){
      if(this.playing)return true;const ctx=this.getContext();if(!ctx)return false;
      if(this.context!==ctx){this.context=ctx;this.master=ctx.createGain();this.master.connect(ctx.destination);}
      this.master.gain.setValueAtTime(.24,ctx.currentTime);this.nextTime=ctx.currentTime+.04;this.playing=true;this.schedule();this.timer=this.timers.set(()=>this.schedule(),100);return true;
    }
    note(midi,at,duration,volume,type){
      const ctx=this.context,osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=type;osc.frequency.setValueAtTime(frequency(midi),at);gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(volume,at+.008);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);osc.connect(gain);gain.connect(this.master);this.nodes.add(osc);osc.onended=()=>{this.nodes.delete(osc);osc.disconnect();gain.disconnect();};osc.start(at);osc.stop(at+duration+.02);
    }
    schedule(){
      if(!this.playing)return;const ctx=this.context,eighth=60/112/2;
      // A paused/slow tab never schedules a backlog of missed notes.
      if(this.nextTime<ctx.currentTime)this.nextTime=ctx.currentTime+.02;
      while(this.nextTime<ctx.currentTime+.22){const i=this.step%64,bar=Math.floor(i/8),beat=i%8,at=this.nextTime,melody=MELODY[i],root=ROOTS[bar];
        if(melody)this.note(melody,at,eighth*.78,.09,'triangle');
        if(beat===0||beat===4)this.note(root,at,eighth*1.45,.16,'sine');
        if(beat===2||beat===6){this.note(root+12,at,eighth*.46,.045,'triangle');this.note(root+19,at,eighth*.42,.025,'triangle');}
        if(beat%2===1)this.note(91+(beat%3),at,.035,.016,'square');
        this.step=(this.step+1)%64;this.nextTime+=eighth;
      }
    }
    stop(){this.playing=false;if(this.timer!==null){this.timers.clear(this.timer);this.timer=null;}if(this.master&&this.context)this.master.gain.setValueAtTime(0,this.context.currentTime);for(const osc of this.nodes){try{osc.stop();}catch{}}this.nodes.clear();}
    setPlaying(playing){if(playing&&!this.playing)this.start();else if(!playing&&this.playing)this.stop();}
  }
  return {Player};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=FamilyMusic;
if(typeof globalThis!=='undefined')globalThis.FamilyMusic=FamilyMusic;
