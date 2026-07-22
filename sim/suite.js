// THE GATE: one command, one verdict, reproducible failures.
// Usage: node suite.js   (exit 0 = shippable)
const {spawnSync}=require("child_process");
const R=[]; let fail=false;
function step(name,cmd,env,check){
  const r=spawnSync("node",[cmd],{env:{...process.env,...env},encoding:"utf8",timeout:150000});
  const out=(r.stdout||"")+(r.stderr||"");
  let ok=r.status===0, note="";
  if(ok&&check){ const c=check(out); ok=c.ok; note=c.note||""; }
  if(!ok){ fail=true; note=note||out.split("\n").filter(l=>/Error|FAIL|CRASH/.test(l)).slice(0,2).join(" | "); }
  R.push({name,ok,note,env:JSON.stringify(env)});
  return out;
}
// 1) speech priority sequences
step("speech","test-speech.js",{});
// 2) smoke matrix: rules combos x seeds — failures replay with SEED=<n>
const seeds=[11,12];
for(const rules of [{FORCE_OOB:"1"},{FORCE_OOB:"0"}])
  for(const sd of seeds)
    step(`smoke oob=${rules.FORCE_OOB} seed=${sd}`,"game-smoke.js",{RUNS:"4",SEED:String(sd),...rules});
// 3) study with metric bands
const so=step("study","gk-study.js",{GKSTUDY:"1",RUNS:"12",SEED:"77"},out=>{
  try{
    const d=JSON.parse(out.trim().split("\n").pop());
    const bands={goalsPerMin:[0.9,4.6],throwRepeatPct:[0,10],rapidReclaimPct:[0,32],
                 rollForwardPct:[88,100],denialPct:[10,75]};
    const bad=Object.entries(bands).filter(([k,[lo,hi]])=>{
      const v=d[k]; return v==null||v<lo||v>hi; });
    return bad.length?{ok:false,note:"band breach: "+bad.map(([k])=>k+"="+JSON.stringify(
      (JSON.parse(out.trim().split("\n").pop()))[k])).join(", ")}:{ok:true,note:JSON.stringify(
      Object.fromEntries(Object.keys(bands).map(k=>[k,d[k]])))};
  }catch(e){ return {ok:false,note:"study output unparseable"}; }
});
console.log("\n===== SUITE VERDICT =====");
for(const s of R) console.log(`${s.ok?"✅":"❌"} ${s.name} ${s.note?("— "+s.note):""}`);
console.log(fail?"\n🔴 NOT SHIPPABLE — failing seeds/configs above replay exactly.":"\n🟢 SHIPPABLE");
process.exit(fail?1:0);
