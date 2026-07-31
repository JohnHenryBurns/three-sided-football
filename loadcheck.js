// ── DOES THE PAGE ACTUALLY RUN? ─────────────────────────────────────────────
// A parse check says the syntax is valid. It does not say the page works.
//
// Edit mode shipped with `editMode`, `grabbed` and `editHalo` declared a thousand lines BELOW the
// render loop that reads them. `let` and `const` do not hoist a value, so every frame threw on the
// first reference and the whole scene went black — no 3D at all. AND IT PARSED PERFECTLY. The
// check I ran after every single edit today could never have caught it.
//
// This runs the engine and the page top to bottom against a stubbed browser. It catches
// temporal-dead-zone errors, missing globals, and anything else that only fails when a line
// actually executes.
//
//   node loadcheck.js
//
// It cannot catch a runtime error inside a callback that never fires here — the render loop, the
// pointer handlers. But everything at module scope has to survive this, and that is where the
// declaration-order faults live.

const fs=require("fs");
const t=fs.readFileSync("/home/claude/tsf/index.html","utf8");
const src=t.match(/<script>\n([\s\S]*)<\/script>/)[1];
const eng=fs.readFileSync("/home/claude/tsf/engine.js","utf8");
const stub=`
  const __noop=()=>{};
  const __obj=()=>new Proxy(function(){},{
    get:(t,k)=>{ if(k===Symbol.toPrimitive) return ()=>0;
                 if(k==="length") return 0; return __obj(); },
    apply:()=>__obj(), construct:()=>__obj(), set:()=>true });
  var THREE=__obj(), document=__obj(), window=__obj(), performance={now:()=>0},
      navigator=__obj(), localStorage=__obj(), speechSynthesis=__obj(),
      SpeechSynthesisUtterance=function(){}, requestAnimationFrame=__noop,
      addEventListener=__noop, setTimeout=__noop, setInterval=__noop,
      screen=__obj(), matchMedia=()=>__obj(), Image=function(){}, devicePixelRatio=2,
      innerWidth=800, innerHeight=600, cancelAnimationFrame=__noop, alert=__noop,
      fetch=()=>Promise.resolve(__obj()), Audio=function(){}, AudioContext=function(){},
      ResizeObserver=function(){this.observe=__noop;this.disconnect=__noop;},
      IntersectionObserver=function(){this.observe=__noop;}, MutationObserver=function(){this.observe=__noop;}, location=__obj(),
      history=__obj(), URL=function(){return __obj();}, URLSearchParams=function(){return __obj();};
`;
try{ new Function(stub + eng + "\n" + src)(); console.log("  ran top to bottom: no error"); }
catch(e){ console.log("  THREW: " + e.message.slice(0,110)); }
