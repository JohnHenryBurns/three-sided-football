// Offline twin of the in-page goalCry() — identical DSP, renders a .wav to audition.
const fs=require("fs");
const SR=44100;

// ---- RBJ bandpass (constant 0 dB peak gain) — matches Web Audio's "bandpass" ----
function bp(f0,Q,fs){
  const w0=2*Math.PI*f0/fs, a=Math.sin(w0)/(2*Q), c=Math.cos(w0);
  const a0=1+a;
  return {b0:a/a0, b1:0, b2:-a/a0, a1:-2*c/a0, a2:(1-a)/a0};
}
function mkFilt(){ return {x1:0,x2:0,y1:0,y2:0}; }
function run(st,co,x){
  const y=co.b0*x+co.b1*st.x1+co.b2*st.x2-co.a1*st.y1-co.a2*st.y2;
  st.x2=st.x1; st.x1=x; st.y2=st.y1; st.y1=y; return y;
}
// ---- helpers ----
const lerp=(a,b,t)=>a+(b-a)*t;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function seg(t,pts){                      // piecewise-linear automation, like linearRampToValueAtTime
  if(t<=pts[0][0]) return pts[0][1];
  for(let i=1;i<pts.length;i++){
    if(t<=pts[i][0]){
      const [t0,v0]=pts[i-1],[t1,v1]=pts[i];
      return lerp(v0,v1,(t-t0)/Math.max(1e-6,t1-t0));
    }
  }
  return pts[pts.length-1][1];
}

// ================= THE CRY =================
// Vowel formants: "oh" -> "aah" -> dark "l"
const VOW={ oh:[400,760,2500], ah:[720,1160,2550], l:[350,900,2600] };

function renderCry(D=2.7,seed=1){
  let rnd=(()=>{let t=seed>>>0;return()=>{t+=0x6D2B79F5;let r=Math.imul(t^t>>>15,1|t);r=r+Math.imul(r^r>>>7,61|r)^r;return((r^r>>>14)>>>0)/4294967296};})();
  const N=Math.floor(SR*(D+0.35));
  const out=new Float32Array(N);

  // formant morph schedule (fractions of D)
  const fSched=i=>{
    const t=i;
    if(t<0.60) return VOW.oh.map((v,k)=>lerp(v,VOW.oh[k],0));           // hold "oh"
    if(t<0.87) return VOW.oh.map((v,k)=>lerp(v,VOW.ah[k],(t-0.60)/0.27)); // open to "aah"
    return VOW.ah.map((v,k)=>lerp(v,VOW.l[k],clamp((t-0.87)/0.13,0,1)));  // close to "l"
  };
  // pitch contour: the shout climbs, strains, then falls away
  const pitchPts=[[0,150],[0.08*D,178],[0.55*D,206],[0.82*D,212],[D,164],[D+0.3,150]];
  // amplitude: fast attack, long plateau, release
  const ampPts=[[0,0],[0.035,1.0],[0.12*D,0.92],[0.70*D,1.0],[0.90*D,0.85],[D,0.12],[D+0.25,0]];
  // vibrato depth grows as the voice strains
  const vibPts=[[0,0.6],[0.4*D,4.5],[0.8*D,9.5],[D,7]];
  // crowd swell
  const crowdPts=[[0,0],[0.15*D,0.25],[0.6*D,0.5],[D,0.62],[D+0.3,0.15]];

  const f1=mkFilt(),f2=mkFilt(),f3=mkFilt();
  const rasp=mkFilt(), crowdA=mkFilt(), crowdB=mkFilt();
  let phase=0, vibPhase=0, co1=bp(400,8,SR), co2=bp(760,10,SR), co3=bp(2500,12,SR);
  let coRasp=bp(1600,1.2,SR), coCa=bp(700,0.7,SR), coCb=bp(2000,0.8,SR);
  let crowdSmooth=0;

  for(let n=0;n<N;n++){
    const t=n/SR, frac=clamp(t/D,0,1);

    // recompute time-varying coefficients periodically (cheap, smooth enough)
    if((n&63)===0){
      const F=fSched(frac);
      co1=bp(F[0],8,SR); co2=bp(F[1],10,SR); co3=bp(F[2],12,SR);
    }

    // glottal source: sawtooth with vibrato
    const vibDepth=seg(t,vibPts);
    vibPhase+=2*Math.PI*5.6/SR;
    const f0=seg(t,pitchPts)+Math.sin(vibPhase)*vibDepth;
    phase+=f0/SR; if(phase>=1)phase-=1;
    let src=2*phase-1;                                   // sawtooth
    src=src*0.7 + (rnd()*2-1)*0.06*Math.min(1,frac*2);   // breath rasp grows

    // grit: soft clip (the strained-voice harmonics)
    const drive=1.6+2.2*frac;
    src=Math.tanh(src*drive)/Math.tanh(drive);

    // parallel formants
    let v=run(f1,co1,src)*1.0 + run(f2,co2,src)*0.62 + run(f3,co3,src)*0.26;
    v+=run(rasp,coRasp,(rnd()*2-1))*0.05*frac;           // airy edge

    // the "G" onset: a short low burst
    if(t<0.055){ v+=(rnd()*2-1)*0.5*(1-t/0.055)*(1-t/0.055); }

    // crowd roar: band-limited noise with slow fluctuation
    const nz=rnd()*2-1;
    let cr=run(crowdA,coCa,nz)*0.8+run(crowdB,coCb,nz)*0.5;
    crowdSmooth+=((rnd()*0.6+0.7)-crowdSmooth)*0.00008;  // slow swell/ebb
    cr*=crowdSmooth;

    const amp=seg(t,ampPts);
    out[n]=clamp(v*amp*0.62 + cr*seg(t,crowdPts)*0.30, -1, 1);
  }

  // gentle normalize
  let peak=0; for(let n=0;n<N;n++) peak=Math.max(peak,Math.abs(out[n]));
  if(peak>0){ const g=0.92/peak; for(let n=0;n<N;n++) out[n]*=g; }
  return out;
}

// ---- 16-bit PCM WAV ----
function writeWav(path,data){
  const buf=Buffer.alloc(44+data.length*2);
  buf.write("RIFF",0); buf.writeUInt32LE(36+data.length*2,4); buf.write("WAVE",8);
  buf.write("fmt ",12); buf.writeUInt32LE(16,16); buf.writeUInt16LE(1,20);
  buf.writeUInt16LE(1,22); buf.writeUInt32LE(SR,24); buf.writeUInt32LE(SR*2,28);
  buf.writeUInt16LE(2,32); buf.writeUInt16LE(16,34);
  buf.write("data",36); buf.writeUInt32LE(data.length*2,40);
  for(let i=0;i<data.length;i++) buf.writeInt16LE(Math.round(clamp(data[i],-1,1)*32767),44+i*2);
  fs.writeFileSync(path,buf);
}

const D=parseFloat(process.env.DUR||"2.7");
const pcm=renderCry(D,parseInt(process.env.SEED||"7"));
writeWav(process.argv[2]||"/home/claude/goal-cry.wav",pcm);

// sanity stats
let rms=0,peak=0; for(const v of pcm){ rms+=v*v; peak=Math.max(peak,Math.abs(v)); }
rms=Math.sqrt(rms/pcm.length);
console.log(`rendered ${(pcm.length/SR).toFixed(2)}s  peak=${peak.toFixed(3)}  rms=${rms.toFixed(3)}`);
