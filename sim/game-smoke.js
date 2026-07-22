// Headless smoke test: runs the REAL game script with a stubbed DOM and pumps the loop.
const fs=require("fs"), vm=require("vm");
const html=fs.readFileSync(process.argv[2]||"/mnt/user-data/outputs/three-sided-worldcup.html","utf8");
const script=html.match(/<script>([\s\S]*)<\/script>/)[1];

function mkEl(id){
  const el={ _id:id, style:{setProperty(){},removeProperty(){}}, dataset:{},
    classList:{add(){},remove(){},toggle(){},contains(){return false}},
    children:[], value:"1", checked:true,
    setAttribute(){}, getAttribute(){return null}, removeAttribute(){},
    appendChild(c){this.children.push(c);return c}, removeChild(){}, remove(){},
    querySelector(){return mkEl(id+">q")}, querySelectorAll(){return []},
    addEventListener(){}, insertBefore(c){return c}, replaceChildren(){},
    scroll(){}, scrollTo(){}, focus(){}, click(){},
    getBoundingClientRect(){return {width:390,height:700,left:0,top:0}} };
  Object.defineProperty(el,"textContent",{set(){},get(){return ""}});
  Object.defineProperty(el,"innerHTML",{set(){},get(){return ""}});
  Object.defineProperty(el,"onclick",{set(f){this._onclick=f},get(){return this._onclick}});
  return el;
}
const byId={};
// give the setup dialog sensible values
const values={setLen:"60",setRef:"3.5"};
function getEl(id){
  if(!byId[id]){ byId[id]=mkEl(id); if(values[id])byId[id].value=values[id]; }
  return byId[id];
}
let rafCb=null; let simNow=0;
const sandbox={
  console, Math, JSON, parseFloat, parseInt, isFinite, NaN, Infinity,
  performance:{now:()=>simNow},
  requestAnimationFrame:(cb)=>{rafCb=cb},
  setTimeout:(cb)=>{}, clearTimeout(){}, setInterval(){}, clearInterval(){},
  document:{
    getElementById:getEl,
    createElementNS:(ns,tag)=>mkEl("svg:"+tag),
    createElement:(tag)=>mkEl("html:"+tag),
    body:mkEl("body"), documentElement:mkEl("root"),
    addEventListener(){}, querySelector:()=>mkEl("q"), querySelectorAll:()=>[]
  },
  navigator:{userAgent:"smoke"}, location:{href:"smoke"},
};
sandbox.window=sandbox;
// speech stubs: exercise the announcer path (SPEECH=1 default on)
sandbox.speechSynthesis={
  _q:[], speaking:false, pending:false,
  speak(u){ this._q.push(u); setTimeout(()=>{ const i=this._q.indexOf(u); if(i>=0)this._q.splice(i,1); u.onend&&u.onend(); },3); },
  cancel(){ this._q.length=0; },
  getVoices(){ return []; },
  onvoiceschanged:null
};
sandbox.SpeechSynthesisUtterance=function(t){ this.text=t; };

vm.createContext(sandbox);
try{ vm.runInContext(script,sandbox,{filename:"game.js"}); }
catch(e){ console.log("LOAD CRASH:\n",e.stack); process.exit(1); }

// press Kick off
simNow=1000;
try{ byId["btnStart"]._onclick(); }
catch(e){ console.log("START CRASH:\n",e.stack); process.exit(1); }

// module mode: expose the booted sandbox + a frame stepper for drills
module.exports={ sandbox, byId, step(ms){ simNow+=(ms||16.7); const cb=rafCb; rafCb=null; if(!cb)throw new Error("loop died"); cb(simNow); } };
if(process.env.NOPUMP==="1") return;

// pump: N simulated minutes at 60fps, multiple runs for randomness
const RUNS=parseInt(process.env.RUNS||"6");
for(let run=0;run<RUNS;run++){
  if(run>0){ try{ byId["btnStart"]._onclick(); }catch(e){ console.log(`RESTART CRASH run ${run}:\n`,e.stack); process.exit(1);} }
  const frames=60*90; // 90s covers a blitz + stoppage + some OT
  for(let f=0;f<frames;f++){
    simNow+=16.7;
    const cb=rafCb; rafCb=null;
    if(!cb){ console.log(`LOOP DIED SILENTLY at run ${run} frame ${f} (no rAF re-queued)`); process.exit(1); }
    try{ cb(simNow); }
    catch(e){ console.log(`RUNTIME CRASH run ${run} frame ${f} (t=${(f/60).toFixed(1)}s):\n`,e.stack); process.exit(1); }
  }
  {
    const cs=sandbox.__probe?sandbox.__probe().clockSec:undefined;
    // Threshold rationale: the game clock runs 0.75x wall by design, so 90 sim-sec holds
    // at most 67.5 clock-sec; an eventful match (4 goals + red card + 6.6s countdown)
    // spends ~46s on celebrations/holds, legitimately landing ~30-35 clock-sec.
    // Real stalls (the oppOf class) freeze in the opening seconds — 15 discriminates cleanly.
    const PRV=sandbox.__probe?sandbox.__probe():{};
    const legitEnd=PRV.phase==="over"||PRV.champ;
    if(typeof cs==="number"&&cs<15&&!legitEnd)
      throw new Error("LIVENESS FAIL: clock "+cs.toFixed(1)+"s/90 phase="+PRV.phase);
    if(typeof cs==="number"&&cs<40) console.log("   (short clock "+cs.toFixed(1)+"s — eventful match, ceremony budget)");
  }
  console.log(`run ${run}: 90 simulated seconds clean`);
}
console.log("SMOKE PASS: no crashes across",RUNS,"matches on MAYHEM settings");
