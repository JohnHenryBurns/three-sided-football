// Extract the REAL speak() + state from the shipped file; drive the goal-burst scenario.
const fs=require("fs");
const html=fs.readFileSync("/mnt/user-data/outputs/three-sided-worldcup.html","utf8");
function extractFn(src,sig){
  const i=src.indexOf(sig); if(i<0) throw new Error("sig not found: "+sig);
  let d=0,j=src.indexOf("{",i);
  for(let k=j;k<src.length;k++){ if(src[k]==="{")d++; if(src[k]==="}"){d--; if(d===0)return src.slice(i,k+1);} }
}
const speakSrc=extractFn(html,"function speak(html,prio){");
const stateLine=html.match(/let lastCancelAt=0[^\n]*\n/)[0];
const log=[];
const eng={
  speaking:false, pending:false, _cur:null,
  speak(u){ this._cur=u; this.speaking=true; log.push("SPEAK: "+u.text.slice(0,30)); },
  cancel(){ log.push("CANCEL"); const c=this._cur; this._cur=null; this.speaking=false;
    if(c&&c.onend) setTimeout(()=>c.onend(),15); },   // Android ghost onend
  finish(){ const c=this._cur; if(c){ this._cur=null; this.speaking=false; c.onend&&c.onend(); } },
  resume(){},
};
const ctx=`
  const voiceOn=true, speechOK=true, narrator=null;
  let queuedUtter=0, speechBeat=0;
  ${stateLine}
  ${speakSrc}
  module.exports={speak, eng:speechSynthesis, state:()=>({highQ:highQ.slice(),speakingPrio,queuedUtter})};
`;
const Module=require("module");
const m=new Module("t");
m._compile(`const speechSynthesis=arguments[0].eng; const SpeechSynthesisUtterance=arguments[0].U; const performance={now:()=>Date.now()};\n${ctx}`,"t.js");
// _compile doesn't take args; do it the plain way instead:
const fn=new Function("speechSynthesis","SpeechSynthesisUtterance","performance","setTimeout","clearTimeout",
  ctx.replace("module.exports=","return "));
const api=fn(eng,function(t){this.text=t;},{now:()=>Date.now()},setTimeout,clearTimeout);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  // scene: chatter is mid-sentence
  api.speak("the crowd is in good voice tonight","low");
  // the goal burst: three big calls in one tick
  api.speak("GOOOAL! Gimenez scores! plus one","high");
  api.speak("Mexico catch fire! twenty seconds","high");
  api.speak("Tactical switch, guns turn on Mexico","high");
  await wait(150);        // Android defer window elapses -> goal fires
  eng.finish();           // goal line ends -> drain #2
  await wait(80);
  eng.finish();           // fire line ends -> drain #3
  await wait(80);
  eng.finish();
  await wait(60);
  // chatter must be refused during the burst window (lock + queue)
  api.speak("late chatter should be refused","low");
  const spoken=log.filter(l=>l.startsWith("SPEAK")).map(l=>l.slice(7));
  console.log(log.join("\n"));
  const ok =
    spoken.length===4 &&
    spoken[0].startsWith("the crowd") &&
    log.includes("CANCEL") &&
    spoken[1].startsWith("goal") &&
    spoken[2].startsWith("Mexico catch fire") &&
    spoken[3].startsWith("Tactical switch");
  console.log(ok?"SPEECH PRIORITY TEST PASS: goal survives its entourage, in order, chatter locked out"
               :"SPEECH PRIORITY TEST FAIL");
  process.exit(ok?0:1);
})();
