// GOAL CRY v2 — fixes the "spooky ghost": keeps the fundamental, adds human irregularity.
const fs=require("fs");
const SR=44100;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;

// ---- RBJ biquads ----
function peaking(f0,Q,dB,fs){
  const A=Math.pow(10,dB/40), w0=2*Math.PI*f0/fs, c=Math.cos(w0), a=Math.sin(w0)/(2*Q);
  const a0=1+a/A;
  return {b0:(1+a*A)/a0,b1:(-2*c)/a0,b2:(1-a*A)/a0,a1:(-2*c)/a0,a2:(1-a/A)/a0};
}
function lowpass(f0,Q,fs){
  const w0=2*Math.PI*f0/fs,c=Math.cos(w0),a=Math.sin(w0)/(2*Q),a0=1+a;
  return {b0:((1-c)/2)/a0,b1:(1-c)/a0,b2:((1-c)/2)/a0,a1:(-2*c)/a0,a2:(1-a)/a0};
}
function highpass(f0,Q,fs){
  const w0=2*Math.PI*f0/fs,c=Math.cos(w0),a=Math.sin(w0)/(2*Q),a0=1+a;
  return {b0:((1+c)/2)/a0,b1:(-(1+c))/a0,b2:((1+c)/2)/a0,a1:(-2*c)/a0,a2:(1-a)/a0};
}
const mkF=()=>({x1:0,x2:0,y1:0,y2:0});
function run(st,co,x){
  const y=co.b0*x+co.b1*st.x1+co.b2*st.x2-co.a1*st.y1-co.a2*st.y2;
  st.x2=st.x1;st.x1=x;st.y2=st.y1;st.y1=y;return y;
}
function seg(t,pts){
  if(t<=pts[0][0])return pts[0][1];
  for(let i=1;i<pts.length;i++){
    if(t<=pts[i][0]){const[t0,v0]=pts[i-1],[t1,v1]=pts[i];return lerp(v0,v1,(t-t0)/Math.max(1e-6,t1-t0));}
  }
  return pts[pts.length-1][1];
}

// vowel targets — F1 rises as the jaw opens
const VOW={oh:[430,800,2500],ah:[760,1220,2600],l:[380,940,2650]};

function renderCry(D=2.6,seed=5){
  let rnd=(()=>{let t=seed>>>0;return()=>{t+=0x6D2B79F5;let r=Math.imul(t^t>>>15,1|t);r=r+Math.imul(r^r>>>7,61|r)^r;return((r^r>>>14)>>>0)/4294967296};})();
  const N=Math.floor(SR*(D+0.3)), out=new Float32Array(N);

  // pitch: fast onset rise, then HOLD (not a glide), quick fall at the end
  const pitchPts=[[0,168],[0.10*D,196],[0.22*D,203],[0.62*D,207],[0.80*D,205],[0.90*D,196],[D,150],[D+0.25,140]];
  // amplitude: hard attack, sustained plateau, short release
  const ampPts=[[0,0],[0.012,1.0],[0.10*D,0.96],[0.72*D,1.0],[0.88*D,0.93],[D,0.10],[D+0.2,0]];
  const vibPts=[[0,0.004],[0.35*D,0.010],[0.75*D,0.020],[D,0.014]];   // vibrato as FRACTION of f0
  const jitPts=[[0,0.006],[0.5*D,0.016],[0.85*D,0.026],[D,0.020]];    // pitch jitter — the human tell
  const crowdPts=[[0,0],[0.12*D,0.30],[0.55*D,0.55],[D,0.66],[D+0.25,0.18]];

  const fm=[mkF(),mkF(),mkF()];
  let cm=[peaking(VOW.oh[0],3.0,14,SR),peaking(VOW.oh[1],3.5,11,SR),peaking(VOW.oh[2],4.0,7,SR)];
  const hp=mkF(),lp=mkF(), cLp=mkF(), cHp=mkF();
  const coHp=highpass(95,0.7,SR), coLp=lowpass(4600,0.8,SR);
  const coCLp=lowpass(2600,0.7,SR), coCHp=highpass(250,0.7,SR);

  let phase=0, subPhase=0, vibPhase=0;
  let jitVal=0, jitTarget=0, jitCd=0;
  let shim=1, shimTarget=1, shimCd=0;
  let crowdEnvSlow=0.8, crowdCd=0;

  for(let n=0;n<N;n++){
    const t=n/SR, frac=clamp(t/D,0,1);

    // formant morph (recompute periodically)
    if((n&63)===0){
      let F;
      if(frac<0.55) F=VOW.oh;
      else if(frac<0.86) F=VOW.oh.map((v,k)=>lerp(v,VOW.ah[k],(frac-0.55)/0.31));
      else F=VOW.ah.map((v,k)=>lerp(v,VOW.l[k],clamp((frac-0.86)/0.14,0,1)));
      cm=[peaking(F[0],3.0,14,SR),peaking(F[1],3.5,11,SR),peaking(F[2],4.0,7,SR)];
    }

    // --- jitter: vocal folds are irregular; this is what kills the theremin ---
    if(--jitCd<=0){ jitTarget=(rnd()*2-1); jitCd=Math.floor(SR*(0.018+rnd()*0.022)); }
    jitVal+=(jitTarget-jitVal)*0.004;
    // --- shimmer: amplitude micro-variation ---
    if(--shimCd<=0){ shimTarget=0.88+rnd()*0.24; shimCd=Math.floor(SR*(0.02+rnd()*0.03)); }
    shim+=(shimTarget-shim)*0.003;

    vibPhase+=2*Math.PI*5.2/SR;
    const base=seg(t,pitchPts);
    const f0=base*(1+Math.sin(vibPhase)*seg(t,vibPts)+jitVal*seg(t,jitPts));

    // --- source: saw + pulse buzz + subharmonic growl at the strain peak ---
    phase+=f0/SR; if(phase>=1)phase-=1;
    subPhase+=(f0*0.5)/SR; if(subPhase>=1)subPhase-=1;
    const saw=2*phase-1;
    const pulse=phase<0.42?1:-1;
    const growl=(subPhase<0.5?1:-1)*0.16*clamp((frac-0.25)/0.3,0,1)*clamp((0.92-frac)/0.2,0,1);
    let src=saw*0.72+pulse*0.20+growl;
    src+=(rnd()*2-1)*(0.05+0.10*frac);           // breath, increasing with strain

    // --- strain: soft clip ---
    const drive=2.0+2.6*frac;
    src=Math.tanh(src*drive)/Math.tanh(drive);

    // --- SERIES peaking formants: emphasize, don't amputate ---
    let v=src;
    v=run(fm[0],cm[0],v); v=run(fm[1],cm[1],v); v=run(fm[2],cm[2],v);
    v=run(hp,coHp,v); v=run(lp,coLp,v);

    // the "G" attack burst
    if(t<0.045){ const k=1-t/0.045; v+=(rnd()*2-1)*0.55*k*k; }

    // --- crowd: WIDE band, not a narrow whistle ---
    if(--crowdCd<=0){ crowdEnvSlow=0.7+rnd()*0.6; crowdCd=Math.floor(SR*(0.05+rnd()*0.12)); }
    let cr=(rnd()*2-1);
    cr=run(cLp,coCLp,cr); cr=run(cHp,coCHp,cr);
    cr*=crowdEnvSlow;

    out[n]=clamp(v*seg(t,ampPts)*shim*0.60 + cr*seg(t,crowdPts)*0.26,-1,1);
  }

  let peak=0; for(let n=0;n<N;n++) peak=Math.max(peak,Math.abs(out[n]));
  if(peak>0){const g=0.93/peak; for(let n=0;n<N;n++) out[n]*=g;}
  return out;
}

function writeWav(path,data){
  const buf=Buffer.alloc(44+data.length*2);
  buf.write("RIFF",0);buf.writeUInt32LE(36+data.length*2,4);buf.write("WAVE",8);
  buf.write("fmt ",12);buf.writeUInt32LE(16,16);buf.writeUInt16LE(1,20);
  buf.writeUInt16LE(1,22);buf.writeUInt32LE(SR,24);buf.writeUInt32LE(SR*2,28);
  buf.writeUInt16LE(2,32);buf.writeUInt16LE(16,34);
  buf.write("data",36);buf.writeUInt32LE(data.length*2,40);
  for(let i=0;i<data.length;i++)buf.writeInt16LE(Math.round(clamp(data[i],-1,1)*32767),44+i*2);
  fs.writeFileSync(path,buf);
}

const pcm=renderCry(parseFloat(process.env.DUR||"2.6"),parseInt(process.env.SEED||"5"));
writeWav(process.argv[2]||"/home/claude/goal-cry-v2.wav",pcm);
let rms=0,peak=0;for(const v of pcm){rms+=v*v;peak=Math.max(peak,Math.abs(v));}
console.log(`v2 rendered ${(pcm.length/SR).toFixed(2)}s peak=${peak.toFixed(3)} rms=${Math.sqrt(rms/pcm.length).toFixed(3)}`);
