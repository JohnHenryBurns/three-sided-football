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

if(process.env.BURN)sandbox.__BURST_BURN=+process.env.BURN;

if(process.env.RECHG)sandbox.__BURST_RECHG=+process.env.RECHG;
if(process.env.NOCLEAR)sandbox.__NOCLEAR=1;

vm.createContext(sandbox);
try{ vm.runInContext(script,sandbox,{filename:"game.js"}); }
catch(e){ console.log("LOAD CRASH:\n",e.stack); process.exit(1); }

// press Kick off
simNow=1000;
try{ byId["btnStart"]._onclick(); sandbox.__forceRules&&sandbox.__forceRules({oob:true,zone:true}); }
catch(e){ console.log("START CRASH:\n",e.stack); process.exit(1); }

// pump: N simulated minutes at 60fps, multiple runs for randomness
const RUNS=parseInt(process.env.RUNS||"6");
for(let run=0;run<RUNS;run++){
  if(run>0){ try{ byId["btnStart"]._onclick(); sandbox.__forceRules&&sandbox.__forceRules({oob:true,zone:true}); }catch(e){ console.log(`RESTART CRASH run ${run}:\n`,e.stack); process.exit(1);} }
  const frames=60*90; // 90s covers a blitz + stoppage + some OT
  for(let f=0;f<frames;f++){
    simNow+=16.7;
    const cb=rafCb; rafCb=null;
    if(!cb){ console.log(`LOOP DIED SILENTLY at run ${run} frame ${f} (no rAF re-queued)`); process.exit(1); }
    try{ cb(simNow); }
    catch(e){ console.log(`RUNTIME CRASH run ${run} frame ${f} (t=${(f/60).toFixed(1)}s):\n`,e.stack); process.exit(1); }
  }
  {
    const cs=sandbox.clockSec!==undefined?sandbox.clockSec:(sandbox.window&&sandbox.window.clockSec);
    if(typeof cs==="number"&&cs<40)
      throw new Error("LIVENESS FAIL: clock only reached "+cs.toFixed(1)+"s of game time in 90 simulated seconds — play stalled");
  }
  if(!global.GKAGG)global.GKAGG={holds:0,sweepSec:0,punts:0,puntSame:0,puntSeen:0,rolls:0,rollsFwd:0,scrumSamples:0,scrumOpp:0,goals:0,sec:0};
  const PR=(sandbox.__probe?sandbox.__probe():{GK:{},scored:[0,0,0],clockSec:0});
const G=PR.GK||{};
if(process.env.TRACE&&G.loopTrace)console.log('LOOP TRACES:',JSON.stringify(G.loopTrace));
if(process.env.DBG)console.log('oobRule at end of run:',PR.oob);
  for(const k in G)global.GKAGG[k]=(global.GKAGG[k]||0)+(G[k]||0);
  global.GKAGG.goals+=(PR.scored||[0,0,0]).reduce((a,b)=>a+b,0);
  global.GKAGG.sec+=PR.clockSec||0;
  console.log(`run ${run}: 90 simulated seconds clean`);
}
console.log("SMOKE PASS: no crashes across",RUNS,"matches on MAYHEM settings");

if(process.env.GKSTUDY==="1"){
  const A=global.GKAGG||{};
  const mins=(A.sec||1)/60;
  console.log(JSON.stringify({
    matches:parseInt(process.env.RUNS||"6"),
    holdsPerMin:+(A.holds/mins).toFixed(2),
    sweepSecPerMin:+(A.sweepSec/mins).toFixed(2),
    puntsPerMin:+(A.punts/mins).toFixed(2),
    puntKeptByOwnTeamPct:A.puntSeen?+(100*A.puntSame/A.puntSeen).toFixed(0):null,
    rollsPerMin:+(A.rolls/mins).toFixed(2),
    rollForwardPct:A.rolls?+(100*A.rollsFwd/A.rolls).toFixed(0):null,
    avgOppInScrumDuringHold:A.scrumSamples?+(A.scrumOpp/A.scrumSamples).toFixed(2):null,
    goalsPerMin:+(A.goals/mins).toFixed(2),
    cornersPerMin:A.cornerDel?+(A.cornerDel/mins).toFixed(2):0,
    atkInBoxAtDelivery:A.cornerDel?+(A.cornerAtk/A.cornerDel).toFixed(2):null,
    defInBoxAtDelivery:A.cornerDel?+(A.cornerDef/A.cornerDel).toFixed(2):null,
    alliesInMixAtDelivery:A.cornerDel?+((A.cornerAllyIn||0)/A.cornerDel).toFixed(2):null,
    farPostSharePct:A.cornerDel?+(100*(A.farPost||0)/A.cornerDel).toFixed(0):null,
    burstsPerMin:+((A.bursts||0)/mins).toFixed(2),
    denialPct:(A.bursts||A.denied)?+(100*(A.denied||0)/((A.denied||0)+(A.bursts||0))).toFixed(0):0,
    byWhy:{race:A.b_race||0,emerg:A.b_emerg||0,brk:A.b_break||0,land:A.b_landing||0,sweep:A.b_sweep||0},
    burstSecPerMin:+((A.burstSec||0)/mins).toFixed(2),
    claimsPerMin:+((A.claims||0)/mins).toFixed(1),
    clearsPerMin:+((A.clears||0)/mins).toFixed(1),
    rapidReclaimPct:(A.claims)?+(100*(A.rapid||0)/A.claims).toFixed(0):null,
    throwRepeatPct:(A.throwStage)?+(100*(A.throwRepeat||0)/A.throwStage).toFixed(0):null,
    throwRepeatPct:(A.throwStage)?+(100*(A.throwRepeat||0)/A.throwStage).toFixed(0):null,
    avgDistPerBurst:(A.bursts)?+((A.sprintDist||0)/A.bursts).toFixed(0):null,
    throwsPerMin:+((A.throwStage||0)/mins).toFixed(2),
    cornersStagedPerMin:+((A.cornerStage||0)/mins).toFixed(2),
    cornersPerMin:+((A.cornerDel||0)/mins).toFixed(2),
    atkInBoxAtDelivery:(A.cornerDel?+((A.cornerAtk||0)/A.cornerDel).toFixed(2):null),
    defInBoxAtDelivery:(A.cornerDel?+((A.cornerDef||0)/A.cornerDel).toFixed(2):null)
  }));
}
