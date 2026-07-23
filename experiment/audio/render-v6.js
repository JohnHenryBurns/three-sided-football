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
function bpG(f0,Q,fs){
  const w0=2*Math.PI*f0/fs,a=Math.sin(w0)/(2*Q),c=Math.cos(w0),a0=1+a;
  return {b0:a/a0,b1:0,b2:-a/a0,a1:-2*c/a0,a2:(1-a)/a0};
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
const VOW={oh:[520,880,2600],ah:[790,1240,2700],l:[420,1000,2750]};

function renderCry(D=2.6,seed=5){
  let rnd=(()=>{let t=seed>>>0;return()=>{t+=0x6D2B79F5;let r=Math.imul(t^t>>>15,1|t);r=r+Math.imul(r^r>>>7,61|r)^r;return((r^r>>>14)>>>0)/4294967296};})();
  const N=Math.floor(SR*(D+0.3)), out=new Float32Array(N);

  // pitch: fast onset rise, then HOLD (not a glide), quick fall at the end
  const pitchPts=[[0,208],[0.10*D,242],[0.22*D,250],[0.62*D,254],[0.80*D,250],[0.90*D,238],[D,182],[D+0.25,170]];
  // amplitude: hard attack, sustained plateau, short release
  const ampPts=[[0,0],[0.012,1.0],[0.10*D,0.98],[0.55*D,1.0],[0.72*D,1.06],[0.88*D,1.04],[0.94*D,0.92],[D,0.12],[D+0.2,0]];
  const vibPts=[[0,0.0015],[0.35*D,0.0030],[0.75*D,0.0055],[D,0.0040]]; // barely a waver, not a bleat
  const jitPts=[[0,0.003],[0.5*D,0.006],[0.85*D,0.009],[D,0.007]];      // micro-irregularity only
  const crowdPts=[[0,0],[0.12*D,0.30],[0.55*D,0.55],[D,0.66],[D+0.25,0.18]];

  const fm=[mkF(),mkF(),mkF()];
  let cm=[peaking(VOW.oh[0],2.6,15,SR),peaking(VOW.oh[1],3.0,15,SR),peaking(VOW.oh[2],3.2,13,SR)];
  const hp=mkF(),lp=mkF(), cLp=mkF(), cHp=mkF(), gF=mkF();
  const coG=bpG(1800,1.1,SR);
  const coHp=highpass(95,0.7,SR), coLp=lowpass(4200,0.8,SR);
  const coSrc=lowpass(2000,0.6,SR);         // dark, but not muffled
  const srcF=mkF();
  const coCLp=lowpass(1500,0.7,SR), coCHp=highpass(220,0.7,SR);

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
      cm=[peaking(F[0],2.6,15,SR),peaking(F[1],3.0,15,SR),peaking(F[2],3.2,13,SR)];
    }

    // --- jitter: vocal folds are irregular; this is what kills the theremin ---
    if(--jitCd<=0){ jitTarget=(rnd()*2-1); jitCd=Math.floor(SR*(0.018+rnd()*0.022)); }
    jitVal+=(jitTarget-jitVal)*0.004;
    // --- shimmer: amplitude micro-variation ---
    if(--shimCd<=0){ shimTarget=0.88+rnd()*0.24; shimCd=Math.floor(SR*(0.02+rnd()*0.03)); }
    shim+=(shimTarget-shim)*0.003;

    vibPhase+=2*Math.PI*4.4/SR;
    const base=seg(t,pitchPts);
    const f0=base*(1+Math.sin(vibPhase)*seg(t,vibPts)+jitVal*seg(t,jitPts));

    // --- source: saw + pulse buzz + subharmonic growl at the strain peak ---
    phase+=f0/SR; if(phase>=1)phase-=1;
    subPhase+=(f0*0.5)/SR; if(subPhase>=1)subPhase-=1;
    const saw=2*phase-1;
    const pulse=phase<0.42?1:-1;
    const growl=(subPhase<0.5?1:-1)*0.040*clamp((frac-0.30)/0.3,0,1)*clamp((0.88-frac)/0.2,0,1);
    let src=saw*0.82+pulse*0.09+growl;
    src+=(rnd()*2-1)*(0.006+0.014*frac);         // just a trace of air

    // --- strain: soft clip ---
    const drive=1.7+1.4*frac;
    src=Math.tanh(src*drive)/Math.tanh(drive);

    src=run(srcF,coSrc,src);                 // the glottis is DARK; the tract adds the brightness
    // --- SERIES peaking formants: emphasize, don't amputate ---
    let v=src;
    v=run(fm[0],cm[0],v); v=run(fm[1],cm[1],v); v=run(fm[2],cm[2],v);
    v=run(hp,coHp,v); v=run(lp,coLp,v);

    // the "G" attack burst
    if(t<0.026) v*=Math.pow(t/0.026,0.7);       // voicing rises out of the burst

    // --- crowd: WIDE band, not a narrow whistle ---
    if(--crowdCd<=0){ crowdEnvSlow=0.7+rnd()*0.6; crowdCd=Math.floor(SR*(0.05+rnd()*0.12)); }
    let cr=(rnd()*2-1);
    cr=run(cLp,coCLp,cr); cr=run(cHp,coCHp,cr);
    cr*=crowdEnvSlow;

    out[n]=clamp(v*seg(t,ampPts)*shim*0.80,-1,1);   // voice alone — no crowd
  }

  let peak=0; for(let n=0;n<N;n++) peak=Math.max(peak,Math.abs(out[n]));
  if(peak>0){const g=1/peak; for(let n=0;n<N;n++) out[n]*=g;}
  // soft limit: lifts the sustained body without clipping the transient
  for(let n=0;n<N;n++) out[n]=Math.tanh(out[n]*3.0)/Math.tanh(3.0);
  peak=0; for(let n=0;n<N;n++) peak=Math.max(peak,Math.abs(out[n]));
  if(peak>0){const g=0.80/peak; for(let n=0;n<N;n++) out[n]*=g;}
  // the G lands AFTER limiting — a plosive is a transient, and limiters eat transients
  const gS=mkF(), gC=bpG(1800,1.1,SR);
  let gr=(()=>{let t=99;return()=>{t+=0x6D2B79F5;let r=Math.imul(t^t>>>15,1|t);r=r+Math.imul(r^r>>>7,61|r)^r;return((r^r>>>14)>>>0)/4294967296};})();
  const GL=Math.floor(0.024*SR);
  for(let n=0;n<GL;n++){
    const k=1-n/GL;
    out[n]=clamp(out[n]+run(gS,gC,(gr()*2-1))*1.5*k*k,-1,1);
  }
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
