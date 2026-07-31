// -----------------------------------------------------------------------------
// THE ENGINE.
//
// Three-sided football, without a screen. Nothing here touches the DOM: it keeps the pitch
// geometry, the teams, the players, the ball, the rules, the AI and the commentary text, and it
// produces state. What draws that state is somebody else's problem.
//
// It was extracted from index.html, where it had always been separable and never separate --
// think() and physics() are 52,000 characters between them with not one DOM call. The reason to
// make it a file is that a second renderer had to copy the whole page to reach it: 93 per cent of
// three.html was index.html, and every fix to the rules would have needed making twice. That is
// the same fault that had already made one roster change land in two files.
//
// -- WHAT IT ASKS THE FRONT END FOR -------------------------------------------
//
// The simulation announces; it does not render. Every hook defaults to a no-op, so the sim runs
// headless -- which is what makes it testable without a browser, and what stops a missing hook
// being a crash rather than a silence.
// ── THE CLOCK ───────────────────────────────────────────────────────────────
//
// Everything here that waits — restart holds, celebration pauses, the beat before a corner is
// taken — measured itself against `performance.now()`, which is real wall-clock time. In a
// browser that is exactly right: a hold of 2.6 seconds should be 2.6 seconds of somebody's life.
//
// It makes the engine untestable. A harness advancing the match clock faster than real time —
// which is the whole point of a harness — outruns those timers. A throw-in is staged, its hold
// is set 2.6 REAL seconds out, and five simulated minutes pass before it expires. The ball sits
// on the touchline for the entire match, and every metric taken from that run measures the
// harness rather than the football.
//
// That fooled me four times over two days. So there is ONE time source now, and a harness can
// replace it:
//
//   ENGINE_CLOCK.now = () => myFakeMilliseconds;
//
// In a browser nothing changes — it is performance.now() and always was. Under a harness the
// same fake clock drives both the match clock and the holds, so they finally agree about how
// long a second is.
const ENGINE_CLOCK = { now: () => performance.now() };
function nowMs(){ return ENGINE_CLOCK.now(); }

// Every line the engine says goes through here, so the log cannot miss one and cannot double it.
function sayLogged(html, big, voice){
  logLine(html);
  ENGINE_HOOKS.say(html, big, voice);
}

// ── THE LOG ─────────────────────────────────────────────────────────────────
// `matchLog` is reset by resetMatch() and printed by buildMatchReport(), both in here — and was
// PUSHED only by index.html. So the 3D page produced a report with an empty play-by-play section,
// which is the same split that broke champInfo: state the engine owns, fed by one front end.
//
// The engine logs its own commentary now, at the moment it decides to say something, and neither
// page has to remember.
function logLine(html){
  const mm=String(Math.floor(Math.max(0,clockSec)/60)).padStart(2,"0");
  const ss=String(Math.floor(Math.max(0,clockSec)%60)).padStart(2,"0");
  matchLog.push(`**${mm}:${ss}** ${String(html).replace(/<[^>]*>/g,"")}`);
}

const ENGINE_HOOKS = {
  say: () => {},
  spawnNote: () => {},
  spawnPing: () => {},
  renderScore: () => {},
  crownChampion: () => {},
  eliminateTeam: () => {},
  showCelebration: () => {},
  showNotice: () => {},
  flash: () => {},
  flamePop: () => {},
  openCoachMenu: () => {},
  showSetup: () => {},
  renderTeamSlots: () => {},
  closeCoachMenu: () => {},
  resetGoals: () => {},
  drawBoards: () => {},
  clearMarks: () => {},
};

// Every call below goes through ENGINE_HOOKS explicitly. An earlier version declared shim
// functions with the same names as the front end's, which worked only because the front end's
// script ran second and its declarations won. Two functions with one name, and script order
// deciding which is real, is a bug that happens to behave.
// -----------------------------------------------------------------------------

// ── SHIRT NUMBERS ───────────────────────────────────────────────────────────
//
// The first block is READ OFF THE OFFICIAL FIFA SQUAD LIST for the 2026 World Cup, published
// 19 July 2026, where players appear in shirt-number order 1 to 26. Forty-five of the sixty are
// from there and are exactly what the player wore.
//
// The second block is NOT. It is marked separately because the difference matters and would
// otherwise be invisible: five of the real players did not make their country's 2026 squad at
// all — Militão, ter Stegen, De Ligt, Araujo and Mitoma — so there is no 2026 number to give
// them, and Italy's and the USA's lists were not consulted. Those, and the three invented teams,
// carry plausible numbers by position rather than recorded ones.
//
// Anyone tempted to cite this as a source: use the first block, not the second.
const SHIRT = {
  "Unai Simón":          23,
  "Laporte":             14,
  "Cucurella":           24,
  "Rodri":               16,
  "Lamine Yamal":        19,
  "Dibu Martínez":       23,
  "Romero":              13,
  "Tagliafico":          3,
  "Enzo Fernández":      24,
  "Messi":               10,
  "Pickford":            1,
  "Stones":              5,
  "Guéhi":               6,
  "Bellingham":          10,
  "Kane":                9,
  "Maignan":             16,
  "Saliba":              17,
  "Koundé":              5,
  "Tchouaméni":          8,
  "Mbappé":              10,
  "Diogo Costa":         1,
  "Rúben Dias":          3,
  "Cancelo":             20,
  "Vitinha":             23,
  "Ronaldo":             7,
  "Alisson":             1,
  "Marquinhos":          4,
  "Bruno Guimarães":     8,
  "Vinícius Jr":         7,
  "Rüdiger":             2,
  "Tah":                 4,
  "Musiala":             10,
  "Havertz":             7,
  "Verbruggen":          1,
  "Van Dijk":            4,
  "Frenkie de Jong":     21,
  "Gakpo":               11,
  "Ochoa":               13,
  "Montes":              3,
  "Edson Álvarez":       4,
  "Santiago Giménez":    11,
  "Zion Suzuki":         1,
  "Tomiyasu":            22,
  "Itakura":             4,
  "Kamada":              15,
  // ── invented or unverified, per the note above ──
  "Militão":             3,
  "ter Stegen":          1,
  "De Ligt":             4,
  "Araujo":              2,
  "Mitoma":              9,
  "Donnarumma":          1,
  "Bastoni":             23,
  "Di Lorenzo":          2,
  "Barella":             18,
  "Retegui":             9,
  "Turner":              1,
  "Richards":            3,
  "Robinson":            5,
  "McKennie":            8,
  "Pulisic":             10,
  "Bo Niboaur":          1,
  "Lincoln Gingrich":    4,
  "Cole Storm":          7,
  "Easton George":       8,
  "Jupiter Burns":       10,
  "Amos Baldwin":        1,
  "Smith Ellars":        5,
  "Ezra Baldwin":        6,
  "Owen Gingrich":       9,
  "Maximus Burns":       11,
  "Margo Tillo":         1,
  "Marg Niboaur":        3,
  "Reese Waite":         7,
  "Sloan Ellars":        10,
  "Solana Burns":        11,
};
const shirtOf = n => SHIRT[n] || 0;

function resetMatch(){
  players=[]; score=[0,0,0]; conceded=[0,0,0]; scored=[0,0,0]; clockSec=0; feed.length=0;
  phase="regulation"; out=[false,false,false]; otGolden=false; champInfo=null; telReset();
  coached=[false,false,false]; coachTarget=[null,null,null]; activeCoach=null;
  for(let t=0;t<3;t++){
    teamATK[t]=TEAMS[t].id.atk; teamDEF[t]=TEAMS[t].id.def; teamAGG[t]=TEAMS[t].id.agg;
    applyPresets(t);
  }
  menuTeam=null; ENGINE_HOOKS.closeCoachMenu();   // the page shuts its own menu
  stats={shots:[0,0,0],saves:[0,0,0],tackles:[0,0,0],poss:[0,0,0]};
  goalsLog=[]; goldenScorer=null; matchLog=[]; gkHolder=null; gkHoldUntil=-1;
  matchStadium=pick(STADIUMS);
  GKSTAT.lastThrowAt=-99; GKSTAT.lastClaimAt=-99;   // metrics never bleed across matches
  ENGINE_HOOKS.resetGoals();   // the page puts its own goal frames back
  ENGINE_HOOKS.drawBoards();   // fresh sponsors every match, drawn by whoever is drawing
  suppress=null; pendingPenalty=null; penaltyShooter=null; penaltyGoalTeam=null;
  stoppageAnnounced=false;
  stoppageLen=Math.min(55,matchLen*0.2)*(0.85+RNG()*0.3);
  notes.forEach(n=>n.e.remove()); notes=[];
  ENGINE_HOOKS.clearMarks();   // the page throws away its own pings and notes
  boostUntil=[0,0,0]; lastPossessTeam=null; lastPossessComment=-99; lastFatigueComment=0; lastColorComment=0;
  for(let t=0;t<3;t++) formation(t).forEach((f,i)=>players.push(
    {team:t,role:f.role,name:TEAMS[t].roster[i],x:f.x,y:f.y,vx:0,vy:0,stamina:1,burst:1,sprint:null,deniedLatch:false,sprintMin:0,sprintCd:0,
     k1:0.64+RNG()*0.10, k2:0.82+RNG()*0.16,  // unique spring constants
     hx:0,hy:0, goals:0,tackles:0,saves:0, yellows:0,sentOff:false,
     // jz MUST START AT ZERO. Left undefined, `p.jz > 0` and `p.jz <= 0` are BOTH false — so
     // tryJump's guard never blocked and the caller's gate never opened. The jump was counted
     // 18,967 times in an 18,968-frame match and never once happened.
     jz:0, jzv:0, jumpCd:0}));                                             // smoothed heading for ball carry
  ball={x:CX,y:CY,vx:0,vy:0,owner:null,lastTouch:null,lastKicker:null,isShot:false,noClaim:null,noClaimF:0,
    touchT:0,strayer:null,strayF:0,z:0,zv:0};
  computeTargets();
  const first=Math.floor(RNG()*3);
  kickoff(first);
  sayLogged(`We're underway at ${matchStadium}! ${tm(0)}, ${tm(1)} and ${tm(2)} — one ball, two enemies each. ${tm(first)} get us started.`,true);
  ENGINE_HOOKS.renderScore();
}


"use strict";
// ---------- Teams & rosters (2026 WC squads) ----------
// `ours` marks the three invented sides — the ones made of family rather than nations. It is a
// real flag rather than "the last three in the library", because position is not a fact about a
// team and reordering the list should not change how anybody is named.
//
// What it means in practice: a nation's player is known by his SURNAME (Messi, Kane), and one of
// ours is known by her GIVEN name (Jupiter, Solana, Maximus). A label showing "Burns" three times
// tells you nothing at all.
const TEAM_LIBRARY=[
  {name:"Spain", short:"ESP", color:"#e63946", accent:"#f7c948",
   roster:["Unai Simón","Laporte","Cucurella","Rodri","Lamine Yamal"],
   third:"#8a1024", motif:{t:"hband",c:["#f7c948"]},
   id:{atk:"TikiTaka",def:"Gegenpress",agg:"Clean"}, star:"Lamine Yamal",
   blurb:"Death by a thousand touches, then a teenager ruins your night."},
  {name:"Argentina", short:"ARG", color:"#6fb7e3", accent:"#ffffff",
   roster:["Dibu Martínez","Romero","Tagliafico","Enzo Fernández","Messi"],
   third:"#f7c948", motif:{t:"sun",c:["#f7c948"]},
   id:{atk:"Probe",def:"Trap",agg:"Nasty"}, star:"Messi",
   blurb:"Patient, cynical, and utterly certain it will end their way."},
  {name:"England", short:"ENG", color:"#f2f2f2", accent:"#cf1020",
   roster:["Pickford","Stones","Guéhi","Bellingham","Kane"],
   third:"#28418f", motif:{t:"cross",c:["#cf1020"]},
   id:{atk:"RouteOne",def:"Balanced",agg:"Firm"}, star:"Bellingham",
   blurb:"Over the top, second balls, and belief that hurts to watch."},
  {name:"Brazil", short:"BRA", color:"#f7d117", accent:"#1d8a4e",
   roster:["Alisson","Marquinhos","Militão","Bruno Guimarães","Vinícius Jr"],
   third:"#2a4db8", motif:{t:"diamond",c:["#1d8a4e","#2a4db8"]},
   id:{atk:"Swashbuckle",def:"Balanced",agg:"Clean"}, star:"Vinícius Jr",
   blurb:"Jogo bonito. Goals at both ends and no apologies at either."},
  {name:"Germany", short:"GER", color:"#6a7280", accent:"#ffce00",
   roster:["ter Stegen","Rüdiger","Tah","Musiala","Havertz"],
   third:"#c8102e", motif:{t:"hbands2",c:["#c8102e","#ffce00"]},
   id:{atk:"Balanced",def:"Gegenpress",agg:"Firm"}, star:"Musiala",
   blurb:"The machine hunts in packs and never stops running."},
  {name:"Italy", short:"ITA", color:"#1268c3", accent:"#f5f5f5",
   roster:["Donnarumma","Bastoni","Di Lorenzo","Barella","Retegui"],
   third:"#1d8a4e", motif:{t:"vbands",c:["#1d8a4e","#f5f5f5","#c8102e"]},
   id:{atk:"Probe",def:"ParkTheBus",agg:"Nasty"}, star:"Donnarumma",
   blurb:"Catenaccio lives. You shall not pass, and you may get kicked."},
  {name:"France", short:"FRA", color:"#28418f", accent:"#e63946",
   roster:["Maignan","Saliba","Koundé","Tchouaméni","Mbappé"],
   third:"#f5f5f5", motif:{t:"vbands",c:["#28418f","#f5f5f5","#e63946"]},
   nudge:{line:.28}, id:{atk:"Swashbuckle",def:"Trap",agg:"Firm"}, star:"Mbappé",
   blurb:"Invites you forward, then breaks your heart at full sprint."},
  {name:"Netherlands", short:"NED", color:"#ff7a1a", accent:"#f5f5f5",
   roster:["Verbruggen","Van Dijk","De Ligt","Frenkie de Jong","Gakpo"],
   third:"#28418f", motif:{t:"hbands3",c:["#c8102e","#f5f5f5","#28418f"]},
   nudge:{line:.9}, id:{atk:"TikiTaka",def:"Gegenpress",agg:"Firm"}, star:"Van Dijk",
   blurb:"Total football, high line, higher self-regard."},
  {name:"Mexico", short:"MEX", color:"#1d8a4e", accent:"#f5f5f5",
   roster:["Ochoa","Montes","Araujo","Edson Álvarez","Santiago Giménez"],
   third:"#d22d3d", motif:{t:"vbands",c:["#1d8a4e","#f5f5f5","#d22d3d"]},
   id:{atk:"TikiTaka",def:"Trap",agg:"Nasty"}, star:"Santiago Giménez",
   blurb:"El Tri: slick touches, high drama, and the Azteca travels with them."},
  {name:"Japan", short:"JPN", color:"#f5f0e8", accent:"#d7003a",
   roster:["Zion Suzuki","Tomiyasu","Itakura","Kamada","Mitoma"],
   third:"#b3002d", motif:{t:"disc",c:["#d7003a"]},
   nudge:{tempo:.95}, id:{atk:"TikiTaka",def:"Gegenpress",agg:"Clean"}, star:"Mitoma",
   blurb:"Relentless tempo, immaculate manners, zero mercy."},
  {name:"Portugal", short:"POR", color:"#a91d45", accent:"#1d8a4e",
   roster:["Diogo Costa","Rúben Dias","Cancelo","Vitinha","Ronaldo"],
   third:"#1d8a4e", motif:{t:"vsplit",c:["#1d8a4e","#c8102e","#f7c948"]},
   nudge:{risk:1.0}, id:{atk:"Swashbuckle",def:"Trap",agg:"Firm"}, star:"Ronaldo",
   blurb:"Flair everywhere, and a 41-year-old who still believes."},
  {name:"USA", short:"USA", color:"#2a4d9b", accent:"#f0f0f0",
   roster:["Turner","Richards","Robinson","McKennie","Pulisic"],
   third:"#d22d3d", motif:{t:"stars",c:["#f0f0f0","#d22d3d"]},
   nudge:{direct:.65}, id:{atk:"Balanced",def:"Gegenpress",agg:"Firm"}, star:"Pulisic",
   blurb:"Grit, lungs, and a nation that just learned the rules."},
  {name:"91 Bulldogs", ours:true, short:"91B", color:"#1e5bc6", accent:"#f7c948",
   roster:["Bo Niboaur","Lincoln Gingrich","Cole Storm","Easton George","Jupiter Burns"],
   third:"#8a8d93", motif:{t:"bulldog",c:["#9aa0a8"]},
   id:{atk:"Swashbuckle",def:"Gegenpress",agg:"Clean"}, star:"Jupiter Burns",
   blurb:"Whiskey Hill Road's finest. Young legs, zero fear, show-and-tell on Monday."},
  {name:"Banana Wizards", ours:true, short:"BAN", color:"#f5c518", accent:"#141414",
   roster:["Amos Baldwin","Smith Ellars","Ezra Baldwin","Owen Gingrich","Maximus Burns"],
   third:"#a67c00", motif:{t:"banana",c:["#141414"]},
   id:{atk:"TikiTaka",def:"Balanced",agg:"Clean"}, star:"Maximus Burns",
   blurb:"Two sets of twins and a wizard up front. The commentary box boggles; the banana abides."},
  {name:"Sparkle Princesses", ours:true, short:"SPK", color:"#f26bb5", accent:"#ffd166",
   roster:["Margo Tillo","Marg Niboaur","Reese Waite","Sloan Ellars","Solana Burns"],
   third:"#b58ae0", motif:{t:"sparkle",c:["#6b2d8f"]},
   id:{atk:"Swashbuckle",def:"Balanced",agg:"Nasty"}, star:"Solana Burns", she:true,
   blurb:"Dramatic entrances, perfect landings, zero mercy. The judges score the performance; the opponents feel it."},
];
let selTeams=[0,1,2];
const TEAMS=[TEAM_LIBRARY[0],TEAM_LIBRARY[1],TEAM_LIBRARY[2]];
function applyTeamSelection(){
  for(let i=0;i<3;i++) TEAMS[i]=TEAM_LIBRARY[selTeams[i]];
}
const ROLES=["K","D","D","M","F"];

// ---------- Geometry ----------
const CX=450, CY=405, R=340;
const V=[]; for(let k=0;k<6;k++){const a=(-90+60*k)*Math.PI/180; V.push({x:CX+R*Math.cos(a), y:CY+R*Math.sin(a)});}
const EDGES=[];
for(let k=0;k<6;k++){
  const p1=V[k], p2=V[(k+1)%6];
  const mx=(p1.x+p2.x)/2, my=(p1.y+p2.y)/2;
  const len=Math.hypot(p2.x-p1.x,p2.y-p1.y);
  const ux=(p2.x-p1.x)/len, uy=(p2.y-p1.y)/len;
  let nx=CX-mx, ny=CY-my; const nl=Math.hypot(nx,ny); nx/=nl; ny/=nl;
  EDGES.push({p1,p2,mx,my,len,ux,uy,nx,ny,goal:(k%2===0)});
}
// ── THE GOAL IS A SHAPE, NOT A RULE ─────────────────────────────────────────
// The WIDTH has always been geometric: `|along| < e.len*GOAL_HALF` is literally "between the
// posts". The HEIGHT was `ball.z < 28`, a bare number chosen from nothing — because there was
// nothing to choose it from. The crossbar height lived only in three.html as HGT = 54, so the
// engine did not know how tall its own goals were.
//
// That is the whole bug. A goal should be the ball passing the plane, and it could not be, because
// half the plane was in a file the rules cannot see.
//
// GOAL_H is here now, next to the width, and both renderers read it. The goal test becomes
// exactly "past the line, between the posts, under the bar" — three geometric facts and no
// magic number. Change the bar and the rule follows, which is the property that was missing.
const GOAL_EDGE=[0,2,4], GOAL_HALF=0.21, GOAL_H=54;
// A player's height, which the renderer draws and the rules test against. Same reasoning as
// GOAL_H: a number both sides need is a number neither side should own privately.
const H_HEAD=34;

// ── THE JUMP ────────────────────────────────────────────────────────────────
// A real arc: up, over, down. A player's effective height is wherever his head actually is, so
// nothing has to ask who jumped first or who is taller — whoever is higher when the ball arrives
// wins it, and that is timing rather than priority.
//
// GRAVITY 0.22 AGAINST THE BALL'S 0.14, deliberately. A body comes down faster than a football,
// and that difference is the whole contest: the ball hangs 1.1 seconds and you hang 0.33, so
// going early is a real risk and going late is a miss.
const JUMP_G   = 0.22;
const JUMP_ZV  = 2.2;    // free:    apex 11, head reaches 45
const JUMP_BZV = 3.0;    // boosted: apex 20, head reaches 54 — which is the crossbar
const JUMP_CD  = 0.55;   // seconds on the floor after landing, so missing costs you

/** Send a player up. Costs burst if he pays for the extra, and refuses if he is still recovering. */
function tryJump(p, boost){
  if(p.jz>0 || clockSec<(p.jumpCd||0) || p.out || p.sentOff) return false;
  const pay = boost && p.burst>0.6;
  if(pay) p.burst-=0.6;
  p.jzv = pay ? JUMP_BZV : JUMP_ZV;
  p.jz  = 0.01;
  TEL.jumps++; if(pay) TEL.jumpsBoosted++;
  return true;
}

/** Age every jump. Called once a frame from physics, before anybody reaches for the ball. */
function stepJumps(S){
  players.forEach(p=>{
    if(p.jz<=0) return;
    p.jz += p.jzv*S;
    p.jzv -= JUMP_G*S;
    if(p.jz<=0){                                   // landed
      p.jz=0; p.jzv=0;
      p.jumpCd = clockSec + JUMP_CD;
      if(!p._gotIt) TEL.jumpsMissed++;              // went up, came down, no ball
      p._gotIt = false;
    }
  });
}
const goalCenter=t=>{const e=EDGES[GOAL_EDGE[t]];return {x:e.mx,y:e.my};};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

// ---------- State ----------
let matchLen=60;       // game-time seconds until full-time resolution (blitz default)
let stats, goalsLog, notes=[], resumeAt=0, goldenScorer=null;
// The commentary log. The TEXT is the simulation's — it decides what happened and how to say
// it — and only the element that shows it belongs to a page.
// Which ground the match is at, and the list to draw from. A stadium is a fact about the
// match, not furniture on a page — the commentary says its name.
const STADIUMS=[
  "The Hex at Whiskey Hill","Hazelnut Park","Willamette Field","Pumpkin Patch Grounds",
  "The Barnyard Bowl","Fencepost Stadium","Rafter Arena","The Grail Ground",
  "Thunderdome Pasture","Cascadia Coliseum","The Sparkle Dome","Bulldog Field at Ninety-One",
  "The Banana Bowl","Orchard Park","Blueberry Row Stadium","The Coop",
  "Grampy Cliff's Tractor Yard","Camelot Grounds","The Mesa Bowl","Morale Field"];
let matchStadium=STADIUMS[0];
const feed=[];
let players=[], ball, score, conceded, scored, targets, clockSec, running=true, speed=1;
let phase="regulation", out=[false,false,false], otGolden=false, scoreMode="points";
// MATCH STATE, not front-end state. buildMatchReport() reads this, and it was declared only in
// index.html — so the report threw on any other page the moment it was asked for. That is the
// second reason the 3D download did nothing: the button was blocked by Chrome AND the thing
// behind it would have thrown anyway.
let champInfo=null;
let coached=[false,false,false], coachTarget=[null,null,null], activeCoach=null;
// ---------- Tactics: six lab-validated dials, bundled into identities ----------
const ATK_PRESETS={Balanced:{tempo:.5,risk:.5,direct:.5},TikiTaka:{tempo:.9,risk:.3,direct:.15},
  RouteOne:{tempo:.3,risk:.7,direct:.95},Swashbuckle:{tempo:.8,risk:.95,direct:.5},
  Probe:{tempo:.35,risk:.25,direct:.3}};
const DEF_PRESETS={Balanced:{line:.5,press:.5,bunker:0},Gegenpress:{line:.8,press:.95,bunker:0},
  ParkTheBus:{line:.15,press:.2,bunker:1},Trap:{line:.35,press:.6,bunker:0}};
const ATK_AB={Balanced:"BAL",TikiTaka:"TT",RouteOne:"R1",Swashbuckle:"SB",Probe:"PR"};
const DEF_AB={Balanced:"BAL",Gegenpress:"GP",ParkTheBus:"BUS",Trap:"TRP"};
const AGG_PRESETS={Clean:{f:.55,t:.92},Firm:{f:1,t:1},Nasty:{f:1.8,t:1.18},Filthy:{f:2.8,t:1.38}};

// ── THE REFEREE ─────────────────────────────────────────────────────────────
// John's design: a side's aggression decides how often it fouls ON PURPOSE; the referee decides
// what that costs. The two are independent, which is what makes a cynical side a gamble rather
// than a fixed price.
//
//   sees   how much of what happens gets called at all
//   zeal   how readily a call becomes a card
//
// MAYHEM calls everything intentional and most of what is not. PLAY ON calls nothing, even when
// it plainly was — which makes a Filthy side under a Play On referee the most dangerous
// combination in the game, and a Clean side under Mayhem an unlucky one.
// WIDER SPREAD, John's numbers: 5, 25, 60, 80, 100. The old set ran 10/45/80/95/100 and the top
// three were nearly the same referee — Fair and Strict differed by fifteen points and Mayhem by
// five more, so three of the five choices barely changed the game.
//
// At 5% a professional foul is essentially free and a cynical side should take every one going.
// At 60% it is a real gamble. The gap between Play On and Fair is now TWELVEFOLD, which is what
// makes choosing a referee a decision rather than a flavour.
// HOW READILY A SIDE FOULS ON PURPOSE. Not a multiplier on a shared base — an explicit weight
// per identity, because the spread John wants is 300:1 and a multiplier cannot express that
// while a linear one is also what made Clean and Filthy measure identically.
const INTENT_W = { Clean:3, Firm:45, Nasty:260, Filthy:900 };

const REF_PRESETS = {
  "Play On":   { sees:0.05, zeal:0.15, blurb:"Lets it go. All of it." },
  "Lenient":   { sees:0.25, zeal:0.45, blurb:"Gives you a warning first." },
  "Fair":      { sees:0.60, zeal:0.80, blurb:"Calls what he sees." },
  "Strict":    { sees:0.80, zeal:1.25, blurb:"Book first, ask later." },
  // MAYHEM'S ZEAL IS 3.6, NOT 1.8. At 1.8 a foul became a red 21% of the time, and because every
  // called foul stops play for a free kick, only six fouls fit into three minutes — so a Filthy
  // side finished with eleven men and a caution. The referee was suppressing the very count he
  // was supposed to punish.
  //
  // At 3.6: booked on essentially every foul, red on most of those. Six fouls become four or
  // five sendings-off, and a side that keeps fouling runs out of players. Which is the setting.
  "Mayhem":    { sees:1.00, zeal:3.60, blurb:"Calls everything, and some things that never happened." }
};
let refLevel = "Fair";
function REF(){ return REF_PRESETS[refLevel] || REF_PRESETS.Fair; }

/** Award a free kick to the fouled side, at the spot. Extracted so an action can call it —
 *  the cascade built this inline and nothing else could reach it. */
/** Is this spot inside somebody's penalty area? Returns the defending team, or null.
 *
 *  THE TRIGGER THAT DID NOT SURVIVE. `pendingPenalty` is declared, cleared at reset, and
 *  consumed by stagePenalty() — and NOTHING EVER SET IT. John guessed exactly that: the
 *  mechanism went with the cascade, and the penalty has been unreachable ever since.
 *
 *  The area is the region within PEN_R of a goal centre. Fouls there are penalties. */
const PEN_R = 132;
function penaltyAreaOf(x, y){
  for(let t=0;t<3;t++){
    if(out[t]) continue;
    const g=goalCenter(t);
    if(Math.hypot(x-g.x, y-g.y) < PEN_R) return t;
  }
  return null;
}

function awardFreeKick(victim, offender){
  // ── A FOUL IN THE AREA IS A PENALTY ───────────────────────────────────────
  // Only against the side who owns the area, and only if the offender is not defending his own
  // — a man fouling inside his OWN box concedes; fouling inside somebody else's is just a free
  // kick to them.
  const area = penaltyAreaOf(ball.x, ball.y);
  if(area !== null && area === offender.team && victim.team !== area){
    pendingPenalty = { shooter:victim, conceder:offender.team, at:clockSec };
    stagePenalty();
    TEL.penalties=(TEL.penalties||0)+1;
    return;
  }
  const aimT = null;   // aim selection stays with the cascade for now; ported separately
  freeKick = { taker:victim, x:ball.x, y:ball.y, team:victim.team, at:clockSec,
               wall:offender.team, aim:(aimT!==null&&aimT!==undefined)?aimT:offender.team };
  ball.owner=null; ball.vx=0; ball.vy=0; ball.z=0; ball.zv=0;
  TEL.freeKicks++;
  restartHold = Math.max(restartHold, nowMs()+1200);
}

/** Book a man. `red` sends him off. The walk itself is the front end's, as before. */
/** An INCIDENTAL foul — the mistimed challenge. Not a decision: a consequence of an action that
 *  went wrong. It can happen on a tackle, on a shot, or on a header, because all three put a boot
 *  or a body where somebody else's is.
 *
 *  John's distinction: the professional foul is chosen and priced by aggression; this one is an
 *  accident and priced by how clumsy the challenge was. A Clean side still commits these.
 *
 *  Returns true if it fouled, so the calling action can abandon what it was doing. */
function incidentalFoul(p, victim, clumsiness){
  if(!victim || !onPitch(p) || !onPitch(victim)) return false;
  if(victim.team===p.team || allied(p.team,victim.team)) return false;
  const agg = AGG_PRESETS[teamAGG[p.team]].f;
  // fatigue makes a man clumsy, which is where late-match cards come from
  const tired = 1 + (1-p.stamina)*0.8;
  // ── THE MAYHEM DIAL ───────────────────────────────────────────────────────
  // 0.05 gave two incidental fouls a match at Filthy — about 14% of a tackle. John's target is
  // three Filthy sides under a Mayhem referee OFTEN FINISHING WITH ONLY THE GOALKEEPERS, which
  // is twelve reds; at a 21% foul-to-red rate that needs roughly fifty-six fouls.
  //
  // 0.18. At Filthy that is half of all tackles and a third of headers becoming fouls, which is
  // absurd — and absurd is the setting. At Clean it is 10%, which is a clumsy challenge now and
  // then, and that is the setting too.
  if(RNG() > clumsiness*agg*tired*0.18) return false;
  TEL.incidental++;
  const R=REF();
  if(RNG() > R.sees){ TEL.foulMissed++; return true; }   // it happened; nobody called it
  awardFreeKick(victim, p);
  if(RNG() < 0.16*R.zeal) bookPlayer(p, RNG() < 0.14*R.zeal);
  return true;
}

function bookPlayer(p, red){
  if(red || p.yellows>=1){
    p.yellows++;
    p.sentOff=true; p.redCard=true; walkPending=p;
    setWalking && setWalking(p);
    ENGINE_HOOKS.spawnNote(p.x,p.y-26,"\u{1F7E5} RED","#e63946");
    sayLogged(`${p.name} is sent off. ${PRN(p).He} knew what ${PRN(p).he} was doing.`, true);
  } else {
    p.yellows++;
    ENGINE_HOOKS.spawnNote(p.x,p.y-26,"\u{1F7E8} booked","#f7c948");
    sayLogged(`${p.name} goes into the book — a professional foul, and everyone saw it.`, true);
  }
}
const ATK_D={Balanced:"No special instructions.",
  TikiTaka:"Rapid short passing — death by a thousand touches.",
  RouteOne:"Long balls over the press, straight to the striker.",
  Swashbuckle:"Shoot on sight. Goals at both ends, no apologies.",
  Probe:"Patient and precise — wait for the perfect chance."};
const DEF_D={Balanced:"No special instructions.",
  Gegenpress:"Hunt the ball high. Wins turnovers, burns legs, draws cards.",
  ParkTheBus:"Everyone behind the ball. You shall not pass.",
  Trap:"Sit mid, invite them in, snap shut on risky passes."};
const AGG_D={Clean:"Soft challenges, spotless disciplinary record.",
  Firm:"Standard football.",
  Nasty:"Harder tackles, more fouls. The book awaits.",
  Filthy:"Win the ball by any means. The referee is watching."};
let teamATK=["Balanced","Balanced","Balanced"], teamDEF=["Balanced","Balanced","Balanced"],
    teamAGG=["Firm","Firm","Firm"];
let tac=[null,null,null], menuTeam=null, coalAlly=[false,false,false];
// ── NEUTRAL COACHING, FOR TUNING ────────────────────────────────────────────
// Three sides with three tactical identities means every measurement mixes the behaviour being
// tuned with the tactics shaping it. Spain's TikiTaka and a Route One side are not the same
// experiment, and averaging them tells you about neither.
//
// With this on, every side plays Balanced/Balanced/Firm and no identity nudge applies — so a
// change to a weight is visible as a change to the weight rather than as a change to how three
// different teams respond to it.
//
// OFF BY DEFAULT. This is a laboratory setting, not a game setting: the identities are most of
// what makes the sides feel different, and they go back on once the baseline is right.
let NEUTRAL_COACHING = false;

function applyPresets(t){
  if(NEUTRAL_COACHING){
    tac[t]={...ATK_PRESETS.Balanced, ...DEF_PRESETS.Balanced};
    return;
  }
  tac[t]={...ATK_PRESETS[teamATK[t]],...DEF_PRESETS[teamDEF[t]]};
  const L=TEAMS[t];
  if(L&&L.nudge&&teamATK[t]===L.id.atk&&teamDEF[t]===L.id.def) Object.assign(tac[t],L.nudge);
}
function fieldersLeft(t){ return players.filter(q=>q.team===t&&!q.out&&!q.sentOff&&q.role!=="K").length; }
function allied(a,b){ return a!==b&&targets[a]!==null&&targets[a]===targets[b]&&targets[a]!==b&&targets[b]!==a; }
function T(t){ return tac[t]; }
let boostUntil=[0,0,0], momentumOn=true;
let lastPossessTeam=null, lastPossessComment=-99, lastFatigueComment=0, lastColorComment=0;

function formation(t){
  const g=goalCenter(t), e=EDGES[GOAL_EDGE[t]];
  const ax=(CX-g.x), ay=(CY-g.y); const al=Math.hypot(ax,ay);
  const fx=ax/al, fy=ay/al, px=e.ux, py=e.uy;
  return [
    {role:"K", x:g.x+fx*16,       y:g.y+fy*16},
    {role:"D", x:g.x+fx*80+px*70, y:g.y+fy*80+py*70},
    {role:"D", x:g.x+fx*80-px*70, y:g.y+fy*80-py*70},
    {role:"M", x:g.x+fx*170+px*40,y:g.y+fy*170+py*40},
    {role:"F", x:g.x+fx*250-px*30,y:g.y+fy*250-py*30},
  ];
}
function tm(t){return `<span class="tm" style="color:${TEAMS[t].color}">${TEAMS[t].name}</span>`;}
function pick(a){return a[Math.floor(RNG_COS()*a.length)];}   // line choice is theatre

// The centre circle, which nothing used to respect. In two-goal football only the side kicking
// off may stand inside it; the same rule here just has two sets of opponents to hold back rather
// than one.
const CIRCLE_R = 70;

function kickoff(toTeam, firstWhistle){
  // ── FORMATION ONLY AT THE FIRST WHISTLE ───────────────────────────────────
  // John: formation() is right for the start of a match; after a goal and in overtime the
  // players should position themselves through mandatory instructions.
  //
  // Snapping fifteen men to coordinates is the game placing them. Walking them there is the
  // game telling them where to be — and `taking up position` already exists to do it, SCRIPT
  // tier, one third of the hex each, spread by the usual stable hash.
  //
  // So the snap happens once. Every kick-off after that is a restart like any other.
  let i=0;
  if(firstWhistle){
    for(let t=0;t<3;t++){ formation(t).forEach(f=>{const p=players[i++]; p.x=f.x;p.y=f.y;p.vx=0;p.vy=0;}); }
  }
  // NOBODY BUT THE KICKING SIDE INSIDE THE CIRCLE. The formation puts each team's forward about
  // 44 units from the centre spot, which is inside a circle of 70 — so all three forwards began
  // every kick-off standing in it, including the two who had no business being there.
  //
  // Pushed straight out along their own line from the spot, so a team keeps the shape it was
  // given and only the distance changes.
  players.forEach(p => {
    if (p.out || p.sentOff || p.team === toTeam) return;
    const dx = p.x - CX, dy = p.y - CY, d = Math.hypot(dx, dy);
    if (d >= CIRCLE_R + 4) return;
    const k = (CIRCLE_R + 6) / (d || 1);
    p.x = CX + dx * k;
    p.y = CY + dy * k;
  });
  telPort('kickoff'); ball.x=CX; ball.y=CY; ball.vx=0; ball.vy=0; ball.owner=null; ball.noClaim=null; ball.isShot=false;
  ball.touchT=0; ball.strayer=null; ball.strayF=0; ball.z=0; ball.zv=0;
  cornerTaker=null; cornerGoal=null; restartHold=0; pendingRestart=null; throwPending=null;
  // ── EVERY PIECE OF PER-MATCH STATE, CLEARED ────────────────────────────────
  // A match could begin holding a stale free kick, a stale goal restart, or a chaser pointing at
  // a player from the previous game — because these are module-level and resetMatch() did not
  // touch them. Run one match and it is invisible; run ten back to back and roughly one in ten
  // starts in somebody else's leftovers.
  //
  // THE BROWSER NEVER SHOWED IT because a page load is a fresh module. Eleven real matches, all
  // normal, while the harness produced 27%-loose and 87%-loose matches — and I spent three
  // commits treating that as a property of the game.
  //
  // FIVE OF THESE I ADDED TODAY: chaser, goalRestart, walking, cornerPending, freeKick. Each one
  // was hoisted to module scope so instructions could see it, and each time I did not ask what
  // clears it.
  freeKick=null; goalRestart=null; walking=null; cornerPending=null; cornerSpot=null;
  justDelivered=null;
  chaser=[null,null,null];
  retargetTimer=0; celebrateUntil=0; camFocusP=null; camFocusUntil=0;
  lastBlazeSay=-99; lastStyleAt=-99; recentChatter=[];
  const fwd=players.find(p=>p.team===toTeam&&p.role==="F"&&!p.out&&!p.sentOff)
    ||players.find(p=>p.team===toTeam&&p.role!=="K"&&!p.out&&!p.sentOff)
    ||players.find(p=>p.team===toTeam&&p.role==="K"&&!p.out);
  if(!fwd) return;
  fwd.x=CX-8; fwd.y=CY; ball.owner=fwd; ball.lastTouch=toTeam;
  // EVERYONE LOOKS AT THE BALL, and this has to come LAST — after the circle has been cleared
  // and after the taker has been walked onto the spot, or the two players who move afterwards
  // keep the heading they were given before they moved.
  //
  // Heading persists across a restart, so a line-up was previously twenty-two players in a neat
  // formation all facing wherever they happened to be running when the last goal went in.
  players.forEach(p => {
    const dx = ball.x - p.x, dy = ball.y - p.y, d = Math.hypot(dx, dy);
    if (d > 0.5) { p.hx = dx/d; p.hy = dy/d; }     // the taker is on top of it; leave his be
  });
  if(nowMs()>resumeAt-2500)   // countdown in progress? the note waits for GO
    ENGINE_HOOKS.spawnNote(CX,CY-46,"kick-off!",TEAMS[toTeam].color,TEAMS[toTeam].accent);
}

// ---------- Diplomacy & ranking ----------
// rating: higher = doing better, under either scoring mode
function rating(t){ return scoreMode==="conceded" ? -conceded[t] : score[t]; }
// full ranking: rating first, then FIFA-style tiebreak on goals scored
function rankCmp(a,b){ return (rating(b)-rating(a)) || (scored[b]-scored[a]); }
function aliveTeams(){ return [0,1,2].filter(t=>!out[t]); }

function computeTargets(){
  const old=targets?targets.slice():null;
  targets=[];
  for(let t=0;t<3;t++){
    if(out[t]){ targets[t]=null; continue; }
    if(coached[t]&&coachTarget[t]!==null&&out[coachTarget[t]]) coachTarget[t]=null; // order died with the team
    if(coached[t]&&coachTarget[t]!==null){ targets[t]=coachTarget[t]; continue; }   // orders are orders
    const others=aliveTeams().filter(o=>o!==t);
    if(!others.length){ targets[t]=null; continue; }
    others.sort((a,b)=>(rating(b)-rating(a))||(conceded[a]-conceded[b]));
  refreshNameColors();   // players now truly exist
    targets[t]=others[0];
  }
  if(old){
    const changed=t=>targets[t]!==null&&old[t]!==targets[t]&&old[t]!==undefined&&!coached[t];
    const mutualDone=[false,false,false];
    for(let a2=0;a2<3;a2++) for(let b2=a2+1;b2<3;b2++)
      if(changed(a2)&&changed(b2)&&targets[a2]===b2&&targets[b2]===a2){
        mutualDone[a2]=mutualDone[b2]=true;
        sayLogged(pick([
          `${tm(a2)} and ${tm(b2)} turn on EACH OTHER — no more pretending!`,
          `It's personal now: ${tm(a2)} and ${tm(b2)} set their sights on each other.`,
          `The hex delivers a grudge match — ${tm(a2)} and ${tm(b2)}, eye to eye.`]),true,"lowvoice");
      }
    for(let t=0;t<3;t++) if(changed(t)&&!mutualDone[t])
    sayLogged(pick([
      `Tactical switch — ${tm(t)} turn their guns on ${tm(targets[t])}!`,
      `The alliance shifts: ${tm(t)} now hunting ${tm(targets[t])}.`,
      `${tm(t)} smell blood — they're going after ${tm(targets[t])} now.`,
      `Word from the ${tm(t)} bench: the new target is ${tm(targets[t])}.`,
      `${tm(t)} have seen enough of ${tm(targets[t])}'s lead. Here they come.`,
      `Friendship over — ${tm(t)} set their sights on ${tm(targets[t])}.`,
      `The hex has no loyalty: ${tm(t)} pivot onto ${tm(targets[t])}.`,
      `${tm(t)} redraw the map. ${tm(targets[t])} are the enemy now.`]),true,"lowvoice");
  }
  ENGINE_HOOKS.renderScore();
}
let retargetTimer=0;

// ---------- Mechanics ----------
const BURST_BURN =(typeof __BURST_BURN !=="undefined")?__BURST_BURN :1.4;  // one big burst, then vulnerable
const BURST_RECHG=(typeof __BURST_RECHG!=="undefined")?__BURST_RECHG:15;   // seconds to refill — scarcity is the point
const BURST_SPD=1.4;                                                       // the rockets
let lastBlazeSay=-99;
const FLAME3=["#ff3d00","#ff8c00","#ffd166"];
const RAINBOW=["#ff5aa7","#ff9f1c","#ffe14d","#5ad66f","#5ab9ff","#b58ae0"];
function firePal(t9){ return TEAMS[t9]&&TEAMS[t9].she?RAINBOW:FLAME3; }
function superSay(p2){
  if(RNG()>0.6)return;
  sayLogged(pick([
    `${p2.name} loads one with John Wick focus — absolute commitment!`,
    `FLAME SHOT! ${p2.name} puts the whole tank behind it!`,
    `${p2.name} with sudden, terrible intent — that ball is SMOKING!`,
    `One breath. One strike. ${p2.name} goes full Baba Yaga!`,
    `${p2.name} empties the clip!`,
    `${p2.name} lobbeth the Holy Hand Grenade! One... two... FIVE— three!`,
    `The pin is out! ${p2.name} counts to three, no more, no less!`]),true,"lowvoice");
}
function gkDiveCheck(defT,flame){
  const gk=players.find(q2=>q2.team===defT&&q2.role==="K"&&!q2.out&&!q2.sentOff);
  if(!gk)return;
  if(gk.burst>0.6&&(flame||RNG()<0.12)){
    gk.burst-=0.6; gk.diveUntil=clockSec+1.2;
    GKSTAT.diveBurns=(GKSTAT.diveBurns||0)+1;
    ENGINE_HOOKS.flamePop(gk);
    if(flame){
      GKSTAT.duels=(GKSTAT.duels||0)+1;
      sayLogged(pick([
        `FIRE MEETS FIRE — both tanks emptied in one heartbeat!`,
        `${gk.name} answers the flame with a flame of ${PRN(gk).his} own!`,
        `A duel! Burning shot, burning dive — somebody's fire dies here!`]),true,"lowvoice");
    } else if(RNG()<0.4){
      sayLogged(pick([
        `${gk.name} EXPLODES across the goal!`,
        `A flame dive — ${gk.name} pays for it from the tank!`]),true,"lowvoice");
    }
  }
}
function blazeCall(p2){
  if(clockSec-lastBlazeSay<6) return;                // one eruption at a time
  lastBlazeSay=clockSec;
  sayLogged(pick([
    `${p2.name} is ON FIRE — an absolute blazing run!`,
    `${p2.name} ERUPTS! There will be scorch marks on this hex!`,
    `Somebody check the grass — ${p2.name} just went FULL afterburner!`,
    `${p2.name} lights it up! Burst of the night, surely!`,
    `Flames off the boots of ${p2.name}! The Sparkle Princesses want that as a home kit!`]),true,"lowvoice");
}
function PRN(x){ const f=x&&TEAMS[x.team]&&TEAMS[x.team].she;
  return f?{he:"she",He:"She",his:"her",His:"Her",him:"her",man:"woman"}
          :{he:"he",He:"He",his:"his",His:"His",him:"him",man:"man"}; }
function speedMult(p){
  let m=0.55+0.45*p.stamina;                       // fatigue: the size of the tank
  if(momentumOn && clockSec<boostUntil[p.team]) m*=1.15;  // underdog fire
  if(p.sprint) m*=BURST_SPD;                       // burst: the throttle
  return Math.min(m,1.6);                          // physics cap: nobody tunnels the tackle radius
}
function leaderIdx(){
  const alive=aliveTeams();
  let best=alive[0]??0;
  for(const t of alive) if(rankCmp(t,best)<0) best=t;
  return best;
}

function stam(p,d){ p.stamina=Math.max(0,Math.min(1,p.stamina+d)); }

// ---------- Helpers ----------
// ── A LIVE BALL MUST BE REACHABLE ───────────────────────────────────────────
// John photographed two men from different sides labelled "closing it down", standing still,
// with the ball sitting on the sideline. `closing it down` requires !holdingPlay(), so play was
// LIVE — and every player except a designated taker is clamped inside the pitch, so a live ball
// outside it can never be reached by anybody.
//
// Measured: the ball is outside the pitch for 33% of a match, and for 25% of a match it is
// outside AND live AND unclaimed. A quarter of the game is spent chasing something unreachable.
//
// The rule: if play is live, the ball belongs on the field. A restart in progress may legitimately
// have it outside — a fetch, a throw being staged — but the moment nothing is pending, it comes
// back to the nearest legal point.
//
// This is the goalkeeping equivalent of the fetch having no end: the restart cleared, and nobody
// put the ball back.
// ── THE STADIUM WALL ────────────────────────────────────────────────────────
// John: "it should have been stopped by the stadium wall and picked up by a fetcher."
//
// A ball 281 units past the touchline is in the car park. Every downstream rule then has to cope
// with a ball nobody can reach — the restart staging, the fetch, the recovery — and each of them
// has failed at it in turn today. The ball simply should not be able to get there.
//
// A HARD BOUND AT 34 UNITS OUTSIDE THE PITCH. Hoardings. It stops dead and drops, and everything
// after this can assume the ball is somewhere a man could walk to.
//
// This is the same lesson as out-of-play being a state: make the bad situation impossible rather
// than handling it everywhere it turns up.
const WALL_OUT = 34;
function stadiumWall(){
  for(const e of EDGES){
    const d=(ball.x-e.p1.x)*e.nx + (ball.y-e.p1.y)*e.ny;
    if(d < -WALL_OUT){
      const push = (-WALL_OUT) - d;
      ball.x += e.nx*push; ball.y += e.ny*push;
      // it hits the boards and stops rather than bouncing back into play
      ball.vx *= -0.18; ball.vy *= -0.18;
      ball.z = 0; ball.zv = 0;
      TEL.hitWall++;
    }
  }
}

function ballOutOfPlayCheck(){
  // ── OUT OF PLAY IS A STATE, NOT A CROSSING ────────────────────────────────
  // The out-of-bounds test fires when the ball CROSSES a line. So a ball that is ALREADY
  // outside — put there by a voided restart, a teleport, or anything that did not cross —
  // sits in a state the rules do not cover: outside and live at the same time, which should
  // not be expressible.
  //
  // John photographed it: two men chasing a ball on the sideline that none of them could reach,
  // because every player is clamped inside the pitch and the ball was not.
  //
  // MY FIRST FIX WAS A PATCH — it nudged the ball back onto the field. This is the rule: if the
  // ball is outside and nothing is being staged, then it is out of play and a restart is due.
  // No special case, no recovery, and the thrower is assigned because that is what staging does.
  //
  // It is the same fault as the woodwork, which cost three sessions: a test asking about a
  // TRANSITION when it should have asked about a STATE. Crossing tests miss everything that
  // arrives by other means.
  if(pendingRestart || freeKick || cornerPending || throwPending || ball.fetch || goalRestart) return;
  if(ball.owner) return;                       // somebody has it; it is by definition in play

  let worst=1e9, we=null, wk=-1;
  for(let k=0;k<EDGES.length;k++){
    const e=EDGES[k];
    const d=(ball.x-e.p1.x)*e.nx + (ball.y-e.p1.y)*e.ny;
    if(d<worst){ worst=d; we=e; wk=k; }
  }
  if(worst >= 0 || !we) return;                // in play

  // ── A BALL IN THE NET IS NOT OUT OF PLAY, IT IS A GOAL ────────────────────
  // This staged a restart for ANY ball past a line — including one that crossed the goal line
  // INSIDE THE MOUTH, which is a goal. With the stadium wall stopping it at 34 out, a ball in
  // the net was caught here and staged as a corner.
  //
  // John: "goals seem to be triggering corners rather than a score." Corners outnumbered goals
  // three to one in the seeds, which is exactly that.
  //
  // The mouth belongs to the goal test. This check must not touch it.
  if(we.goal){
    const along = (ball.x-we.mx)*we.ux + (ball.y-we.my)*we.uy;
    if(Math.abs(along) < we.len*GOAL_HALF) return;
  }

  TEL.oobState++;
  // THE STATE MUST BE CLEARED, NOT JUST REPORTED. Calling outOfBounds() alone staged a restart
  // and left the ball where it was — so the condition was still true next frame and it staged
  // again, ten thousand times a match. A rule that detects a state has to end it.
  //
  // So: bring the ball to the line first, THEN stage from there. The restart gets a legal mark
  // and the condition is false on the next frame whether the staging succeeded or not.
  ball.x += we.nx*(-worst+2); ball.y += we.ny*(-worst+2);
  ball.vx=0; ball.vy=0; ball.z=0; ball.zv=0;
  if(oobRule) outOfBounds(wk, we);
}

function clampInside(p,margin){
  for(const e of EDGES){
    const d=(p.x-e.p1.x)*e.nx+(p.y-e.p1.y)*e.ny;
    if(d<margin){ p.x+=e.nx*(margin-d); p.y+=e.ny*(margin-d); }
  }
}
function steer(p,tx,ty,maxV){
  maxV*=speedMult(p);
  let dx=tx-p.x, dy=ty-p.y; const d=Math.hypot(dx,dy)||1;
  if(d<8){ p.vx*=0.78; p.vy*=0.78; return; }   // arrival deadband: settle, don't orbit
  const sp=Math.min(maxV, d*0.15);
  p.vx=p.vx*p.k1+(dx/d)*sp*p.k2;               // per-player constants — no two spring alike
  p.vy=p.vy*p.k1+(dy/d)*sp*p.k2;
  const v=Math.hypot(p.vx,p.vy); if(v>maxV){p.vx*=maxV/v;p.vy*=maxV/v;}
}
/** Has the offending side backed off the required ten yards? */
function wallClear(fk){
  for(const q of players){
    if(q.team!==fk.wall||q.out||q.sentOff) continue;
    if(Math.hypot(q.x-fk.x, q.y-fk.y)<62) return false;
  }
  return true;
}

function kick(tx,ty,power,isShot){
  freeKick=null;                         // struck: the free kick is over
  // WHO JUST DELIVERED A CORNER, so an instruction can give him something to do. This used to
  // set a `noChase` flag, which is a rule about what he WILL NOT do — and a flag that says what a
  // player is not doing is not an instruction, it is a hole where one should be. It also did not
  // work: noChase is released the moment anybody claims the ball, and a corner is claimed within
  // a second, so he was free to sprint forty yards after his own delivery.
  if(cornerPending===ball.owner && ball.owner){ justDelivered={p:ball.owner, at:clockSec}; }
  cornerPending=null; cornerSpot=null;   // struck: the pin is released
  const o=ball.owner;
  ball.allyPass=false;
  if(oobRule&&!isShot){
    for(const e of EDGES){                       // aim inside the lines
      const dd=(tx-e.p1.x)*e.nx+(ty-e.p1.y)*e.ny;
      if(dd<26){tx+=e.nx*(26-dd);ty+=e.ny*(26-dd);}
    }
    let ux2=tx-ball.x, uy2=ty-ball.y; const ul=Math.hypot(ux2,uy2)||1; ux2/=ul; uy2/=ul;
    let ahead=1e9;                                // don't overhit into touch
    for(const e of EDGES){
      const den=-(ux2*e.nx+uy2*e.ny);
      if(den>0.05){const db=(ball.x-e.p1.x)*e.nx+(ball.y-e.p1.y)*e.ny;
        ahead=Math.min(ahead,(db-8)/den);}
    }
    power=Math.min(power,4+ahead*0.035);
  }
  const dx=tx-ball.x, dy=ty-ball.y, d=Math.hypot(dx,dy)||1;
  ball.vx=dx/d*power; ball.vy=dy/d*power;
  ball.lastTouch=o.team; ball.lastKicker=o; ball.isShot=!!isShot;
  // WHO SHOT IT, kept apart from who last touched it. A keeper who gets a hand to a shot and
  // fails becomes `lastTouch`, and the goal was then credited against his own side as an OWN
  // GOAL — a striker's finish turned into the keeper's mistake because a deflection is a touch.
  if(isShot){ ball.shotBy=o.team; ball.shotByP=o; ball.shotAt=clockSec; }
  ball.noClaim=o; ball.noClaimF=14; ball.owner=null;
  ball.z=0; ball.zv=0;
  // A long ball travels THROUGH THE AIR, which at 3.0 meant an apex of 32 — over a head and
  // under everything else. 3.8 gives 52, which is a ball you have to deal with rather than one
  // you can step under.
  if(!isShot && d>235){ ball.zv=3.8; }   // long balls travel through the air
  if(isShot){ stats.shots[o.team]++; ENGINE_HOOKS.spawnNote(ball.x,ball.y-18,"shot!","#ffd166");
    // The guard here was `typeof spawnPing==="function" && ballHalo` — a check that the front end
    // had both, written when the front end was the only thing there was. After the extraction
    // neither name exists in this file, `typeof` on an undeclared name is "undefined", and the
    // condition became permanently false: twenty-five simulated minutes produced zero pings.
    // The hook defaults to a no-op, which is what the guard was for.
    ENGINE_HOOKS.spawnPing(ball.x,ball.y,TEAMS[o.team].color); }
}

// ---------- AI ----------
// ── WHAT IS HE DOING? ───────────────────────────────────────────────────────
// think() is 894 lines, 53 early returns and no stored state: a cascade where the first branch
// that matches acts and returns. That works, and it means a player's instruction exists for one
// frame and is never written down — so nothing can show it, log it, or check it.
//
// job() names the branch as it is taken. One assignment, no logic, and it makes the AI
// inspectable: a debug overlay can read p.job, the report can count them, and a player stuck
// doing something daft becomes visible rather than inferred from where he is standing.
// job() is also where an instruction change is OBSERVABLE, so it is where the measuring goes. I
// built a commitment system to stop players popping between instructions and had no way to count
// popping, which is the same fault as tuning a flame you cannot see the colour of.
// job() IS CALLED MORE THAN ONCE A FRAME. The list declines a player, job(p,'cascade') fires, and
// then a later cascade branch calls job() again with what he is actually doing — two calls, one
// frame. Counting every call made the switch rate 9.9 a second while the debug overlay, which
// shows the LAST call, sat perfectly stable. John saw the stability and I saw the number and we
// were both right.
//
// So the counting compares against the job he had at the END OF THE LAST FRAME, not against
// whatever was set a microsecond ago. Intra-frame reconsideration is not indecision — it is the
// cascade arriving at an answer.
// `holdActive` is a local inside think(), so an instruction cannot see it — and an instruction
// that cannot see the world it is deciding about is not much of an instruction. The same question,
// asked where anything can ask it.
// ── A HOLD IS ONLY A HOLD IF SOMETHING IS BEING STAGED ──────────────────────
// restartHold was true for 86% of a neutral match, which meant `closing it down` — the chase,
// which requires !holdingPlay() — fired on 1% of frames. Fifteen players held their shape around
// a ball nobody went for, and the loose figure sat at 79%.
//
// The cause is that restarts now RIPEN. The hold used to be a fixed 1-3 seconds and is now
// extended repeatedly while an action waits to become ripe — so `restartHold` in the future no
// longer means "a restart is being staged", it means "one was staged at some point recently".
//
// A hold requires a THING BEING HELD FOR. If nothing is pending, play is live whatever the clock
// says — and the chase is allowed again.
/** Where a taker stands relative to the mark. A thrower is BEHIND the line and the ball is on
 *  it — they are on opposite sides of the chalk, which is what a throw-in is. A corner taker
 *  stands at the flag. Everyone else stands where the ball is. */
/** Are both other sides back in their own third? A restart should not be taken into a pitch
 *  where nobody has reset — John's rule, and it is what makes the pause mean something: the
 *  extra seconds buy a shape, rather than fifteen men standing where the whistle found them.
 *
 *  Measured as: of the players who are not the taker, how many are nearer their own goal than
 *  the halfway point of their own third. Two thirds of them is enough — waiting for all of them
 *  would hang on one man walking back from a corner. */
function sidesSet(taker){
  let want=0, there=0;
  players.forEach(p=>{
    if(p===taker || p.out || p.sentOff || p.role==='K') return;
    want++;
    const own=goalCenter(p.team);
    if(dist(p,own) < dist(own,{x:CX,y:CY})*0.92) there++;
  });
  // 0.66 blocked almost every restart — throws fell from 34 a match to 2 — because waiting for
  // two thirds of thirteen men to be back means waiting for the slowest of them, every time.
  //
  // 0.40 is "most of the pitch has reset", which is what the eye reads as a set piece. It also
  // fails open: with nobody left to position, want===0 and the taker is not held hostage.
  return want===0 || there/want >= 0.40;
}

function restartSpot(p){
  const R=pendingRestart;
  if(!R) return {x:p.x, y:p.y};
  // A CORNER TAKER STANDS BESIDE THE BALL, NOT ON IT. restartSpot used to return the mark
  // itself, so `corner-swing` required him within 10 of a ball at his own feet — and a body
  // radius of 23 makes that hard to satisfy. One corner staged and none taken, all match.
  //
  // Just outside it, on the goal side, which is where a taker actually stands.
  if(R.kind==='corner' || cornerTaker===p){
    const gx=CX-R.x, gy=CY-R.y, gl=Math.hypot(gx,gy)||1;
    return { x:R.x + gx/gl*14, y:R.y + gy/gl*14 };
  }
  const odx=R.x-CX, ody=R.y-CY, ol=Math.hypot(odx,ody)||1;
  return { x:R.x + odx/ol*22, y:R.y + ody/ol*22 };
}

function holdingPlay(){
  // A FETCH RECORD WITHOUT A RESTART IS RUBBISH, NOT A HOLD. corner-swing cleared
  // pendingRestart and left ball.fetch set — and holdingPlay reads ball.fetch, so play was held
  // for 175 SECONDS by a restart that had already been taken. The corner worked and the match
  // stopped anyway.
  //
  // Clearing it here rather than at every site that ends a restart: there are five of those and
  // this is the one place that cares.
  if(ball.fetch && !pendingRestart) ball.fetch=null;
  if(nowMs() >= restartHold) return false;
  return !!(pendingRestart || freeKick || cornerPending || throwPending || goalRestart || ball.fetch);
}

// ── A SEEDED RANDOM, SO A MATCH CAN BE RUN TWICE ────────────────────────────
// RNG() is unseeded, so no run is reproducible: the same configuration gave 23 goals and
// then 15. Which means a degenerate match cannot be investigated because it cannot be repeated,
// and no calibration result can be distinguished from noise.
//
// mulberry32 — small, fast, and good enough for a football match. RNG() replaces every
// RNG() in the engine, and seeding is opt-in: unseeded it delegates to Math.random and
// the browser behaves exactly as before, because a real match SHOULD be unpredictable.
//
// The harness seeds it. That is the whole point: reproducible where it matters, random where it
// does not.
// ── TWO STREAMS: THE MATCH, AND THE THEATRE ─────────────────────────────────
// Eleven RNG() calls are cosmetic — which line the commentator picks, whether a sprint gets a
// flame, whether a note pops. They decide nothing about the football and they all draw from the
// same sequence as the simulation.
//
// So ADDING A COMMENTARY LINE CHANGES THE MATCH. Every before/after I have run on a fixed seed
// across a change that touched commentary was comparing two different games, and I have treated
// those comparisons as exact all session.
//
// A second stream fixes it. RNG() is the match. RNG_COS() is the theatre, seeded alongside but
// drawn separately, so a match plays identically whatever the commentator says.
let __rngState = null;
let __cosState = null;
function seedRNG(n){ __rngState = (n>>>0) || 1; __cosState = ((n>>>0)^0x9E3779B9) || 7; }

/** The cosmetic stream: commentary choices, flame flags, note pops. Never consulted by anything
 *  that moves a player or a ball. */
function RNG_COS(){
  if(__cosState===null) return Math.random();
  __cosState |= 0; __cosState = (__cosState + 0x6D2B79F5) | 0;
  let t = Math.imul(__cosState ^ (__cosState >>> 15), 1 | __cosState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function RNG(){
  if(__rngState===null) return Math.random();
  __rngState |= 0; __rngState = (__rngState + 0x6D2B79F5) | 0;
  let t = Math.imul(__rngState ^ (__rngState >>> 15), 1 | __rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ── IS HE STILL PLAYING? ────────────────────────────────────────────────────
// `out` and `sentOff` are not the same thing and the difference has a window in it: a man given a
// red is sentOff IMMEDIATELY and only becomes out when he reaches the bench. For those few
// seconds he is on the pitch, in the arrays, and eligible for anything that checks only one flag.
//
// Twelve selections in this file check one, the other, or neither. John has seen sent-off players
// used as passing targets, which is exactly what that window produces.
function onPitch(p){ return !!p && !p.out && !p.sentOff && !p.benched; }

// ── IS IT ACTUALLY DEAD? ────────────────────────────────────────────────────
// Eight cascade branches duplicate instructions that are now live. They SHOULD be unreachable —
// the list scores first and returns — but "should be" is how you delete something that was still
// running. This records any that fire, so deletion is evidence-led rather than confident.
const DEADHIT = {};
function DEAD(who){ DEADHIT[who] = (DEADHIT[who]||0) + 1; }

// ── STATE THE INSTRUCTIONS NEED TO SEE ──────────────────────────────────────
// An instruction can only be extracted once everything it reads is visible from outside think().
// That is the main structural obstacle to finishing the extraction, and this is the fix: the
// facts think() computes each frame live out here, so anything can ask.
//
// `chaser` is each side's nearest man to the ball — the one whose job it is to go and get it.
// It was a `const` inside think(), recomputed every frame and invisible to everything else,
// which is why prowling could not be extracted.
let chaser = [null, null, null];

// ── THE GOAL RESTART ────────────────────────────────────────────────────────
// A goal is the most choreographed moment in the game and it was pure front-end animation: the
// ball's flight back, the taker walking out, everybody drifting into shape — all of it in
// three.html, none of it in the engine, and the flat page got none of it.
//
// So it was not a script in the sense we have been using the word. It was a picture of one.
//
// Now the engine owns it: who fetches, who takes it, and where everybody else stands. SCRIPT
// tier, because a restart is the game doing something to the players rather than the players
// deciding — and a renderer that wants to draw it can read the same state.
let goalRestart = null;   // { conceder, taker, fetcher, until }
let justDelivered = null; // { p, at } — the man who just took a corner, for the instruction below

// WHETHER A WALK IS HAPPENING. `walkPending` says one is due; both front ends then run their own
// copy of the walk — three.html and index.html each move the man to their own bench, with their
// own arrival test. That is the champInfo shape again: shared behaviour implemented twice.
//
// Not unifying the walk itself here, because the bench position is genuinely front-end geometry.
// But the engine needs to KNOW a walk is running, because everybody else has something to do
// while it does — and that they had nothing to do is exactly what John spotted.
let walking = null;
function setWalking(p){ walking = p || null; }

// ── THE BENCH ───────────────────────────────────────────────────────────────
// Derived entirely from engine geometry — the goal edge, its half-width, its normal — and yet it
// lived in three.html, computed there and unavailable to anything else. index.html has its own.
// Sixth instance of the same split today.
//
// Behind the goal line and off to one side, which is where a dugout goes.
function benchSpot(t){
  const e = EDGES[GOAL_EDGE[t]], hw = e.len * GOAL_HALF;
  return { x: e.mx - e.nx*30 + e.ux*(hw+62),
           y: e.my - e.ny*30 + e.uy*(hw+62),
           ux: e.ux, uy: e.uy, nx: e.nx, ny: e.ny };
}

// ── AND WHAT HE DOES THERE ──────────────────────────────────────────────────
// A sent-off player arrives at the bench and then simply stops existing: p.out is true, think()
// skips him, and he is a cylinder parked on a seat for the rest of the match.
//
// He should sulk. Facing the pitch he is no longer allowed on, with a slump that deepens for a
// few seconds and then settles into something more like sullen acceptance — because nobody stays
// furious for ninety minutes, they just stay benched.
// ── A RESTART THAT CANNOT FINISH MUST NOT HANG THE MATCH ────────────────────
// Two harness matches in five come out broken in opposite ways — one with the ball owned 97% of
// the time, one with it loose 81% and nobody chasing. Both look like a restart that never
// completes: in the first the taker holds forever, in the second the ball sits dead.
//
// The free kick is the newest and the only one whose completion depends on OTHER PLAYERS moving
// out of the way. If the taker is sent off, or benched, or the wall never clears because
// somebody is stuck, nothing ever sets freeKick.done and the match never restarts.
//
// Eight seconds and it is void, whatever the state. A watchdog is not a fix for the underlying
// fault, and it is written down as such — but a match that cannot restart is worse than a free
// kick that gets abandoned.
function stepRestartWatchdog(){
  if(freeKick && !freeKick.done){
    const t=freeKick.taker;
    const gone = !t || t.out || t.sentOff;
    if(gone || clockSec-freeKick.at>8){
      TEL.restartVoid++;
      freeKick=null;
      if(ball.owner && ball.owner.role!=='K') ball.owner=null;
    }
  }
  if(pendingRestart && pendingRestart.p && (pendingRestart.p.out||pendingRestart.p.sentOff)){
    TEL.restartVoid++;
    pendingRestart=null; ball.fetch=null;
  }
}

function stepBench(){
  players.forEach(p=>{
    if(!p.benched) return;
    if(p.satAt===undefined) p.satAt = clockSec;
    const sat = clockSec - p.satAt;
    // 0 to 1 over the first four seconds, then eases back to a resting slump of 0.55
    p.sulk = sat<4 ? sat/4 : 0.55 + 0.45*Math.max(0, 1-(sat-4)/6);
    // he watches the ball, because of course he does
    const dx = ball.x-p.x, dy = ball.y-p.y, dl = Math.hypot(dx,dy)||1;
    p.hx = dx/dl; p.hy = dy/dl;
  });
}

/** Called when a goal is given. Names the parts; the instructions play them. */
function stageGoalRestart(concederTeam, scorerTeam){
  const kicking = (scorerTeam!==null && scorerTeam!==undefined) ? concederTeam : concederTeam;
  // whoever is nearest the ball goes and gets it, whatever shirt he is wearing — that is what
  // happens, and it is often not the side who will take the kick-off
  let fetcher=null, fd=1e9;
  players.forEach(q=>{ if(q.out||q.sentOff) return; const d=dist(q,ball); if(d<fd){fd=d;fetcher=q;} });
  const taker = players.find(q=>q.team===kicking && q.role==='F' && !q.out && !q.sentOff)
             || players.find(q=>q.team===kicking && q.role!=='K' && !q.out && !q.sentOff) || null;
  goalRestart = { conceder:concederTeam, kicking, taker, fetcher, at:clockSec };
}

function job(p, what, tier){
  TEL.jobFrames[what] = (TEL.jobFrames[what]||0) + 1;
  p.job = what;
  // The tier travels with the job so a reader can colour it. A name alone does not say whether
  // he was told, forbidden, coached or deciding — and that is the thing worth seeing at a glance.
  // `tier` may legitimately be 0 — the cascade passes exactly that to mean "no tier at all" —
  // and `||` treats 0 as absent, so the cascade was being promoted to PLAYER and drawn green.
  // A cascade branch is not a player decision; it is a decision nobody has named yet, and the
  // whole point of the grey is to show how much of that is left.
  // AN UNTIERED CALL MEANS NOBODY ASSIGNED THIS. It used to default to PLAYER, so a cascade
  // branch calling job(p,'fetching the ball') drew GREEN — indistinguishable from a player
  // decision, which is exactly what the colouring exists to distinguish.
  //
  // John spotted a surviving cascade block from that colour after I had declared the cascade
  // gone and spent hours measuring it. The default hid it. Now an absent tier is 0, which the
  // renderer draws GREY, and grey means "nobody named this".
  p.jobTier = (tier === undefined || tier === null) ? 0 : tier;
}

/** Called once per player per frame, after think() has settled on something. */
function jobSettled(p){
  if(p.jobPrev !== p.job){
    if(p.jobPrev){
      TEL.jobSwitch++;
      const held = Math.max(0, clockSec-(p.jobAt||clockSec));
      TEL.jobHeld += held; TEL.jobHeldN++;
      if(held < 0.25) TEL.jobPop++;
    }
    p.jobAt = clockSec;
    p.jobPrev = p.job;
  }
}

// ── THE INSTRUCTION LIST ────────────────────────────────────────────────────
//
// An instruction is a THING, not a position in a cascade. It says whether it applies to a
// player, how much it wants him, and what he does — and because it is a value, two of them can
// be compared, which is the whole reason for this.
//
//   applies(p)  -> false, and it is not considered
//   score(p)    -> how strongly it wants him. Higher wins.
//   act(p)      -> what he does. Returns true if he is done for this frame.
//   explicit    -> he is being TOLD. No commitment bonus can outrank it, because a restart is
//                  choreography and a player choosing his own part in it is what made throw-ins
//                  look like somebody dribbling the ball in.
//
// COMMITMENT is the point. A cascade re-decides sixty times a second, so a player between two
// branches oscillates — that is the popping. An instruction he is already on gets a bonus, so a
// rival has to be BETTER rather than merely equal. Turn it up and a side plays with conviction
// and gets caught out; turn it down and it is twitchy but quick.
const COMMIT = 12;                    // the degree factor. Per-side eventually; one number now.

// ── FOUR TIERS, AND ONLY THREE OF THEM ARE WALLS ────────────────────────────
//
// `explicit` was a boolean worth a thousand points and I used it to mean "this is about a
// restart", which cost a measurable regression. John's model has the resolution it needed:
//
//   SCRIPT       what HAPPENS. The thrower fetches the ball; the sent-off man walks off. Not a
//                decision at all — the game doing something to him.
//   REQUIREMENT  what may NOT happen. Stay out of the penalty area; retreat ten yards. The
//                referee's business, not a tactic and not a choice.
//   COACH        a tactic: which decisions to prioritise and how to coordinate. The bus, getting
//                depth, marking at a corner.
//   PLAYER       what he thinks best with what he can see. Chasing, intercepting, offering.
//                The bottom tier and most of a match.
//
// THE TOP TWO ARE WALLS. A script and a requirement are never preferences and should never lose
// to a good idea, so they sit 1700 clear of anything.
//
// THE BOTTOM TWO OVERLAP ON PURPOSE, which is John's correction and the important part: A PLAY IS
// A WEIGHT, NOT A MUST. A corner routine wants him in the box — and if the ball breaks loose he
// should go for it rather than finish his part like a man following stage directions. So COACH
// sits only 300 above PLAYER. A tactic wins by default; a strong enough decision still beats it.
//
// That 300 is the difference between a routine and a puppet show, and it is the one number in
// here worth arguing about.
const TIER = { SCRIPT: 4000, REQUIREMENT: 3000, COACH: 1300, PLAYER: 1000 };

/** A side's current tactical numbers, so an instruction can read them without knowing where
 *  they live. `T()` already does this; this is the same thing named for readers of the list. */
function TACTICS(t){ return T(t); }

// ── THE ACTION LIST ─────────────────────────────────────────────────────────
//
// An action is a THING A PLAYER DOES WITH THE BALL, as distinct from an instruction, which is
// where he goes. The two run side by side and both can fire on the same frame — a carrier is
// moving somewhere AND deciding whether to shoot, which is exactly why actions could not simply
// be added to the instruction list.
//
//   can(p)     PREREQUISITES. Not "should he", but "is this even available". You must control
//              the ball to consider shooting; a header needs the ball airborne and near you.
//              Most actions are unavailable to most players on most frames, which is the
//              opposite of instructions and the reason for a separate runner.
//   score(p)   how much it wants to happen, within its tier
//   act(p)     do it. Calls kick(), tryJump() or whatever primitive it needs — the primitives
//              are fine and stay exactly as they are.
//   tier       SCRIPT actions are MANDATED: a throw-in gets taken, nobody decides that. PLAYER
//              actions are chosen. That distinction is John's, from the tiers, and it maps onto
//              actions more cleanly than onto positions.
//
// The runner is the instruction runner's shape, with one difference: it may decline. Most frames
// nothing fires, and an action list that always does something is a list of reflexes.
// ── THE THIRTEEN, WRITTEN BUT NOT WIRED ─────────────────────────────────────
//
// Every kick() in the cascade, rewritten as an action. NOTHING BELOW FIRES YET: `ACTIONS_LIVE`
// is false, runAction skips the ported set, and the cascade still does all thirteen exactly as
// it did this morning.
//
// This is the split John's surgery rule allows. The transplant must be atomic — some kicks
// releasing the ball through runAction while others release it inline is the mixture that
// crashed — but WRITING the organ is not the same as fitting it. With the switch off there is
// no mixture: the cascade owns every release, as before.
//
// To finish: flip ACTIONS_LIVE, delete the thirteen cascade sites, run the six seeds against
// baseline.json. One commit, and it either holds or it reverts whole.
const ACTIONS_LIVE = true;

// THE NO-OP'S WEIGHT — the dial that sets how often anything happens at all. A PLAYER action
// scoring 300 against this fires on about a tenth of the frames it is available. Every rate in
// the old cascade is expressible as a ratio to this one number, which is why it is a constant
// rather than a per-action hesitance.
// DERIVED, NOT CHOSEN. The cascade holds the ball about 100 frames a possession; a 360-point
// action against 30,000 fires on 1.2% of frames, which is a hold of ~84. 2800 gave nine frames —
// a fifth of a second — and every ball-releasing action fired the instant a man got it.
//
// I picked 2800 by eye when the only actions were a header and a shield, and never revisited it
// when eleven more arrived. That is what made ten actions look broken when one number was.
// BACK TO 2800, which is what it was designed as: the weight that aligned action rates with the
// cascade's per-frame probabilities. I raised it to 60,000 to stop possession collapsing — and
// that worked only because THE CASCADE WAS STILL THERE TO DO THE WORK. With actions firing on
// 0.6% of frames the game ran on the fallback, and every measurement after that point was of the
// wrong code.
//
// John's reading, and it is right: the cascade was evaluated EVERY FRAME, so a probabilistic
// action set against it could never fire at a sane weight without being drowned out.
//
// Now there is no fallback. If 2800 is wrong the ball will visibly stop, which is the honest
// failure mode and the one this framework was supposed to have from the start.
const PLAY_ON_WEIGHT = 2800;

// THE SETUP NO-OP. A mandated action competes against this while it ripens, so a restart is
// taken on a sampled frame rather than a scheduled one. Smaller than PLAY_ON_WEIGHT because a
// restart should not take all day: an action ripening at 400 a second crosses this in about two
// seconds and is nearly certain by four.
const SETUP_WEIGHT = 900;

/** How ripe a mandated action is. Grows from nothing to well past SETUP_WEIGHT, so it is
 *  unlikely at first, likely soon, and effectively certain in the end — without a deadline
 *  anywhere. `rate` is where a side's urgency enters. */
// RATES QUARTERED, WHICH DOUBLES THE TIME. ripeness is (elapsed^2)*rate, so the moment a given
// weight is reached moves as 1/sqrt(rate) — a quarter of the rate is twice the wait. John asked
// for double the average ripening time on transitions and this is the arithmetic of it, not a
// guess at new numbers.
//
//   throw   240+300*direct  ->  60+75*direct    even odds at ~2.8s, was 1.4
//   corner  180+260*direct  ->  45+65*direct
//   penalty 130             ->  33              the pause IS the drama
function ripeness(since, rate){
  const t = Math.max(0, clockSec - since);
  return t*t*rate;            // quadratic: hesitant, then decisive, which is how people are
}

/** The cascade's RK — a side's appetite for a shot. Named because both shot actions read it and
 *  it was an inline expression in each.
 *
 *  ADDED AFTER THE FACT, and that is worth recording: the shots were filled and referenced this
 *  before it existed. Dormant code does not crash, so a parse check and six green matches said
 *  nothing was wrong. THAT IS THE COST OF THE SWITCH-OFF SPLIT — it buys safety on main and pays
 *  in latent faults that surface only on the flip. Better to know that now than during it. */
/** The cascade's pass search, lifted whole. Both can() and act() need it, the same way the
 *  keeper's outlets are needed by three of his four actions. */
/** The best mate BEHIND the ball — further from the goal he is attacking than the carrier is,
 *  and with room. Used by `pass backwards` when the front is blocked. */
function backPass(p){
  const t9=targets[p.team];
  if(t9===null||t9===undefined) return null;
  const tgt=goalCenter(t9);
  let best=null, bs=-1e9;
  players.forEach(m=>{
    if(m.team!==p.team||m===p||!onPitch(m)) return;
    const back = dist(m,tgt) - dist(p,tgt);
    if(back < 25) return;                       // he must actually be behind
    const d=dist(m,p);
    if(d < 40 || d > 220) return;
    let cover=1e9;
    players.forEach(o=>{ if(o.team!==p.team&&onPitch(o)&&!allied(p.team,o.team))
      cover=Math.min(cover, dist(o,m)); });
    if(cover < 40) return;                      // no point recycling into another scrum
    const sc = Math.min(cover,120) - Math.abs(back-70)*0.4;   // space first, sensible depth
    if(sc>bs){ bs=sc; best=m; }
  });
  return best;
}

function bestPass(p){
  const t9=targets[p.team];
  if(t9===null||t9===undefined) return null;
  const tgt=goalCenter(t9), TT=T(p.team);
  let best=null, bs=-1e9;
  players.forEach(m=>{
    if(m.team!==p.team||m===p||!onPitch(m)||m.role==='K') return;
    const d=dist(m,p);
    if(d<60 || d>210+140*TT.direct) return;
    const gain=dist(p,tgt)-dist(m,tgt);
    let laneOk=true;
    players.forEach(o=>{
      if(o.team===p.team||!onPitch(o)||allied(p.team,o.team)) return;
      const t=((o.x-p.x)*(m.x-p.x)+(o.y-p.y)*(m.y-p.y))/(d*d);
      if(t>0.1&&t<0.9){
        const lx=p.x+(m.x-p.x)*t, ly=p.y+(m.y-p.y)*t;
        if(Math.hypot(o.x-lx,o.y-ly) < (30-12*TT.risk)+5*(T(o.team).press-0.5)*2) laneOk=false;
      }
    });
    // ── HOW CROWDED IS HE? ────────────────────────────────────────────────
    // The search scored on ground gained and a clear lane, and never asked what the receiver
    // was walking into. A man forty yards forward with three opponents round him scored well
    // on gain and got the ball — which is John's "bad passing into contested territory", and
    // it is where the scrums come from.
    //
    // A pass to a covered man should lose to a pass to a free one, even if the free one is
    // square. 34 per opponent inside 45 is enough to make that true without forbidding a
    // contested pass outright: sometimes it is the only ball on.
    let crowd=0;
    players.forEach(o2=>{ if(o2.team===p.team||!onPitch(o2)||allied(p.team,o2.team)) return;
      if(dist(o2,m) < 45) crowd++; });
    const sc=gain*(0.6+0.8*TT.direct)+(laneOk?0:-500)-crowd*34+RNG()*30;
    if(sc>bs){ bs=sc; best=m; }
  });
  return (best && bs>-100) ? best : null;
}

function riskOf(p){
  const t=T(p.team);
  return (t && t.risk!==undefined) ? t.risk : 0.5;
}

/** The keeper's outlet search, which three of his four actions need. Lifted from the cascade
 *  unchanged and computed once per call — the cascade did it once and branched; the list needs
 *  it available to each can(), which is the one real cost of the scored shape. */
/** Is the shooting lane clear? The cascade samples the line to goal and looks for a body near
 *  any point on it. Lifted unchanged, because a shot into a wall of legs is not a shot. */
function shotLaneClear(p, tgt){
  let clear=true;
  for(let t=0.2;t<=0.8;t+=0.2){
    const lx=p.x+(tgt.x-p.x)*t, ly=p.y+(tgt.y-p.y)*t;
    players.forEach(o=>{ if(o.team===p.team||!onPitch(o)||o.role==='K') return;
      if(Math.hypot(o.x-lx,o.y-ly)<26) clear=false; });
  }
  return clear;
}

function gkOutlets(gk){
  let near=null,nd=1e9, far=null,fd=-1,fs=-1e9, anyNear=null,anyD=1e9;
  const og=goalCenter(gk.team);
  players.forEach(m=>{
    if(m.team!==gk.team||m===gk||!onPitch(m)||m.role==='K') return;
    const d=dist(m,gk), adv=dist(m,og);
    if(adv>dist(gk,og)+15){ if(d<nd){nd=d;near=m;} }
    if(d<anyD){anyD=d;anyNear=m;}
    let open=1e9;
    players.forEach(q=>{ if(q.team!==gk.team&&onPitch(q)&&q.role!=='K') open=Math.min(open,dist(q,m)); });
    const sc=adv+Math.min(open,140)*1.5;
    if(sc>fs){fs=sc;far=m;fd=adv;}
  });
  if(!near){ near=anyNear; nd=anyD; }
  let wolves=0;
  players.forEach(q=>{ if(q.team!==gk.team&&onPitch(q)&&dist(q,gk)<95) wolves++; });
  return { near, nd, far, fd, crowded: wolves>=2 };
}

const PORTED = [
  // ── SCRIPT: the game takes these ──────────────────────────────────────────
  // ── THE CORNER, ON THE SAME MACHINE ───────────────────────────────────────
  // It used to require ball.owner===p — and the state machine puts the ball DOWN on the mark, so
  // that could never be true. Same fault the throw had. A corner taker stands at the flag with
  // the ball on it; he does not hold it.
  { name:'corner-swing', tier:TIER.SCRIPT, ported:true,
    coach:T => T.direct*30,
    can:p => {
      if(!pendingRestart || pendingRestart.p!==p || ball.owner || !onPitch(p)) return false;
      if(pendingRestart.kind!=='corner') return false;
      const m={x:pendingRestart.x, y:pendingRestart.y};
      if(dist(ball,m) > 12) return false;
      if(dist(p, restartSpot(p)) > 16) return false;   // a swing needs room, not precision
      return true;
    },
    score:p => pendingRestart ? ripeness(pendingRestart.at !== undefined ? pendingRestart.at : clockSec,
                        45 + 65*T(p.team).direct) : 0,   // a corner ripens slower than a throw
    act:p => {
      const e=EDGES[GOAL_EDGE[cornerGoal]], g=goalCenter(cornerGoal);
      const cx2=g.x+e.nx*46, cy2=g.y+e.ny*46;
      ball.owner=p; ball.lastTouch=p.team; ball.lastKicker=p;   // struck, for the instant
      kick(cx2, cy2, 11.5, false);
      ball.zv=3.6;                                              // it swings in high
      ball.owner=null;
      pendingRestart=null; cornerPending=null; cornerTaker=null; ball.fetch=null;  // over
      justDelivered={p, at:clockSec};
      return true;
    } },

  // ── THE THROW ─────────────────────────────────────────────────────────────
  // It RIPENS rather than waiting on readyAt. A side with tempo takes it quickly; a side that
  // wants to settle takes its time; and which frame it actually lands on is sampled, so no two
  // throw-ins in a match look alike.
  //
  // That replaces `readyAt: nowMs()+1100` — a constant that made every throw identical and could
  // not be quick even when quick was right.
  // ── TAKING IT ─────────────────────────────────────────────────────────────
  // The last stage. He is behind the ball, the ball is on the mark, and the action ripens from
  // the moment he got there — so the pause varies and a quick one is the tail of the same
  // distribution rather than a special case.
  //
  // He picks it up for the instant of the throw because kick() reads ball.owner to know who
  // struck it, and lets go immediately after. And THE RESTART ENDS HERE, which is the thing the
  // old version never did: pendingRestart is cleared by the ball being struck, by nothing else.
  { name:'throw-in', tier:TIER.SCRIPT, ported:true,
    coach:T => 0,
    // A THROW, NOT ANY RESTART. Without the kind test this action fired on corners too — the
    // state machine gets a corner taker to stage 4 exactly like a thrower, and whichever action
    // matched first took it. A corner delivered as a throw-in is not a corner.
    can:p => {
      if(!pendingRestart || pendingRestart.p!==p || ball.owner || !onPitch(p)) return false;
      if(pendingRestart.kind && pendingRestart.kind!=='throw') return false;
      const m={x:pendingRestart.x, y:pendingRestart.y};
      if(dist(ball,m) > 12) return false;
      if(dist(p, restartSpot(p)) > 10) return false;
      return sidesSet(p);           // nobody throws into an unset pitch
    },
    // THE CLOCK IS THE STAGING TIME, ALWAYS SET. `since` was only assigned in the carry stage —
    // and when the ball is staged already on the mark, which is most restarts, that stage never
    // runs. So `since` stayed undefined, ripeness got clockSec, elapsed was zero, and the throw
    // could never ripen. The same fault as `restartSince`, one layer further down, and the trace
    // showed it as `since:n` for nineteen consecutive frames.
    score:p => pendingRestart ? ripeness(pendingRestart.since !== undefined ? pendingRestart.since
                        : (pendingRestart.at !== undefined ? pendingRestart.at : clockSec),
                        60 + 75*T(p.team).direct) : 0,
    act:p => {
      const best=bestPass(p);
      const tgt = best || players.find(m=>m.team===p.team && m!==p && onPitch(m) && m.role!=='K');
      ball.owner=p; ball.lastTouch=p.team; ball.lastKicker=p;
      if(tgt){
        const d9=dist(tgt,p);
        kick(tgt.x+tgt.vx*6, tgt.y+tgt.vy*6, Math.min(6.4, Math.max(2.8, d9/66*1.15)), false);
        ball.zv = 2.6 + Math.min(1.6, d9/260*1.6);
      } else kick(CX, CY, 5.5, false);
      ball.owner=null;
      pendingRestart=null; throwPending=null; ball.fetch=null;   // struck: the restart is over
      p.noChase=clockSec+1.0;
      TEL.throwsTaken++;
      return true;
    } },

  { name:'penalty', tier:TIER.SCRIPT, ported:true,
    coach:T => 0,
    // THE THIRD TIME THIS FAULT HAS APPEARED. The throw had it, the corner had it, and now the
    // penalty: an action demanding ball.owner===p when the restart machine deliberately puts the
    // ball DOWN and releases it. A man placing a ball on the spot is not holding it.
    //
    // He must be AT the spot, with the ball on it.
    can:p => {
      if(penaltyShooter!==p || ball.owner || !onPitch(p)) return false;
      if(!pendingRestart || pendingRestart.kind!=='penalty') return false;
      const m={x:pendingRestart.x, y:pendingRestart.y};
      return dist(ball,m) <= 12 && dist(p,m) <= 26;
    },
    // THE DEAD CLOCK AGAIN. `p.restartSince` is read here and set nowhere — the same fault the
    // throw-in had, in the last action still carrying it. Score was permanently zero, so a
    // penalty could be AWARDED (2.38 a match) and never TAKEN.
    //
    // He ripens from the moment the ball is on the spot, and chooses his own moment.
    score:p => pendingRestart ? ripeness(pendingRestart.at!==undefined?pendingRestart.at:clockSec, 33) : 0,
    act:p => {
      const gt=penaltyGoalTeam;
      const e=EDGES[GOAL_EDGE[gt]], g=goalCenter(gt);
      // ── WHERE HE PUTS IT, AND WHETHER THE KEEPER GUESSED RIGHT ────────────
      // A shooter picks a side and a height. A keeper who guessed the same side gets there; one
      // who also guessed the height gets it cleanly. Side right, height wrong is the fingertip
      // that is not quite enough — the most agonising thing in football, and now expressible.
      const shootSide = RNG()<0.44 ? -1 : RNG()<0.79 ? 1 : 0;
      const shootHigh = RNG() < 0.38;
      const off2 = shootSide * (0.45 + RNG()*0.42) * e.len*GOAL_HALF;
      const gkP = players.find(q=>q.team===gt && q.role==='K' && !q.out);
      const guess = gkP && gkP.penGuess;
      const sideRight = guess && guess.side===shootSide;
      const heightRight = guess && guess.high===shootHigh;
      stats.shots[p.team]++;
      penaltyShooter=null;
      // HE STRIKES IT, so he owns it for the instant — kick() reads ball.owner to know who took
      // it, and the restart machine had released the ball when he placed it.
      ball.owner=p; ball.lastTouch=p.team; ball.lastKicker=p;
      kick(g.x+e.ux*off2, g.y+e.uy*off2, 10.8, true);
      if(shootHigh) ball.zv = 3.1;                   // over the keeper's standing reach

      // THE SAVE, decided by the guess rather than by geometry.
      if(sideRight && heightRight){
        ball.vx*=-0.42; ball.vy*=-0.42; ball.zv=1.2;
        stats.saves[gt]++;
        sayLogged(`SAVED! ${gkP.name} went the right way \u2014 and the right height!`, true);
        ENGINE_HOOKS.spawnNote(gkP.x, gkP.y-28, "\u{1F9E4} SAVED", "#7ee787");
      } else if(sideRight){
        ball.vx*=0.86; ball.vy*=0.86;                // a fingertip, not enough
        sayLogged(`${gkP.name} guessed right and got a hand to it \u2014 not enough!`, true);
      }
      ball.owner=null;
      pendingRestart=null;
      // gkDiveCheck WAS DELETED WITH THE CASCADE and this still called it — the penalty would
      // have thrown the moment one was awarded. It never was, so nobody found out.
      // The keeper's own `dive` action handles this now: the ball is a shot, and he reads it.
      return true;
    } },

  // ── THE FREE KICK ─────────────────────────────────────────────────────────
  // Ripens too, but from the moment the wall is legal rather than from the award — waiting for
  // ten yards is not hesitation, it is the rule. A direct side ripens faster, which is a quick
  // free kick becoming a tactic rather than a coin toss.
  { name:'free-kick', tier:TIER.SCRIPT, ported:true,
    coach:T => 0,
    can:p => !!(freeKick && freeKick.taker===p && ball.owner===p),
    score:p => ripeness(freeKick ? freeKick.at : clockSec, 50 + 75*T(p.team).direct),
    act:p => {
      const aim = (freeKick && freeKick.aim!==undefined) ? freeKick.aim : targets[p.team];
      const tgt = goalCenter(aim);
      const d9 = dist(p,tgt);
      if(d9 < 250){                                  // in range: have a go
        const e=EDGES[GOAL_EDGE[aim]];
        const off=(RNG()*2-1)*e.len*GOAL_HALF*0.8;
        kick(tgt.x+e.ux*off, tgt.y+e.uy*off, 10.6, true);
        gkDiveCheck(aim, false);
      } else {
        const best=bestPass(p);
        if(best) kick(best.x+best.vx*8, best.y+best.vy*8, Math.min(8, dist(best,p)/66*1.15));
        else kick(tgt.x, tgt.y, 8.4, false);
      }
      freeKick=null;
      p.noChase=clockSec+1.0;
      return true;
    } },

  // ── PLAYER: his call, weighted by the bench ───────────────────────────────
  // The keeper's four. gk-clear is PLAYER tier now, not COACH — John's correction: the bench
  // WEIGHTS an action, it does not own one. A bunkering side hoofs it readily; a passing side
  // does not; neither of them is being ordered.
  { name:'gk-roll', tier:TIER.PLAYER, ported:true,
    coach:T => (1-T.direct)*60,
    can:p => {
      if(p.role!=='K' || ball.owner!==p) return false;
      const f=gkOutlets(p);
      return !!f.near && !(f.crowded && dist(f.near,p)<110);
    },
    score:p => 300,
    act:p => {
      const f=gkOutlets(p);
      if(!f.near) return false;
      const pw=Math.min(6.2, Math.max(2.4, dist(f.near,p)/66 * 1.15));
      kick(f.near.x+f.near.vx*4, f.near.y+f.near.vy*4, pw, false);
      const throwD=dist(f.near,p);
      ball.zv=2.6 + Math.min(1.6, throwD/260*1.6);
      gkHolder=null;   // he has let go of it
      if(allied(p.team,f.near.team)) ball.allyPass=true;
      return true;
    } },

  // The cascade's outlet search, lifted whole. It runs in can() rather than act() because the
  // whole point of a scored list is that a candidate must be found BEFORE the action is chosen —
  // "is there somebody to punt to" is a prerequisite, not part of the punt.
  // ── THE GOAL KICK ─────────────────────────────────────────────────────────
  // SCRIPT, because it is a restart, and the machine had no way to END one for a goal kick —
  // the ball was staged, made unclaimable, and then sat there because nothing could take it.
  // Loose went to 94%: a ball on the six-yard line for the whole match.
  { name:'goal-kick', tier:TIER.SCRIPT, ported:true,
    coach:T => 0,
    can:p => {
      if(!pendingRestart || pendingRestart.kind!=='goalkick' || pendingRestart.p!==p) return false;
      if(ball.owner) return false;
      const m={x:pendingRestart.x, y:pendingRestart.y};
      return dist(p,m) <= 20;
    },
    score:p => pendingRestart ? ripeness(pendingRestart.at!==undefined?pendingRestart.at:clockSec,
                                        50 + 70*T(p.team).direct) : 0,
    act:p => {
      const f=gkOutlets(p);
      ball.owner=p; ball.lastTouch=p.team; ball.lastKicker=p;
      if(f.far && f.fd>200){
        kick(f.far.x+f.far.vx*7, f.far.y+f.far.vy*7,
             Math.min(9, Math.max(4.2, f.fd/108*1.1)), false);
        ball.zv=4.6;
      } else if(f.near){
        kick(f.near.x+f.near.vx*4, f.near.y+f.near.vy*4,
             Math.min(6.2, Math.max(2.4, f.nd/66*1.15)), false);
      } else kick(CX, CY, 8);
      ball.owner=null;
      pendingRestart=null;
      TEL.goalKicks=(TEL.goalKicks||0)+1;
      return true;
    } },
  { name:'gk-punt', tier:TIER.PLAYER, ported:true,
    coach:T => T.direct*80,
    can:p => {
      if(p.role!=='K' || ball.owner!==p) return false;
      const f=gkOutlets(p);
      return !!(f.far && ((f.fd>255 && (f.nd>140 || RNG()<0.11)) || (f.crowded && f.fd>150)));
    },
    score:p => 310,
    act:p => {
      const f=gkOutlets(p);
      if(!f.far) return false;
      const dTo=dist(p,f.far);
      const pw=Math.min(11.5, Math.max(4.2, dTo/66 * 1.12));
      kick(f.far.x+f.far.vx*7, f.far.y+f.far.vy*7, pw, false);
      ball.zv=4.6;                       // up into the lights, as the cascade has it
      gkHolder=null;   // he has let go of it
      GKSTAT.punts=(GKSTAT.punts||0)+1;
      return true;
    } },

  { name:'gk-clear', tier:TIER.PLAYER, ported:true,
    coach:T => (T.bunker>0.5?110:0),
    can:p => {
      if(p.role!=='K' || ball.owner!==p) return false;
      const f=gkOutlets(p);
      // crowded, and the only outlet is short and in the same trouble
      return f.crowded && (!f.near || dist(f.near,p)<110);
    },
    score:p => 290,
    act:p => {
      const og9=goalCenter(p.team);
      const ax=p.x-og9.x, ay=p.y-og9.y, al=Math.hypot(ax,ay)||1;
      const spread=(RNG()-0.5)*0.5;
      kick(p.x+(ax/al)*300 + (-ay/al)*300*spread,
           p.y+(ay/al)*300 + ( ax/al)*300*spread, 11.5, false);
      gkHolder=null;   // he has let go of it
      ball.zv=4.2;
      return true;
    } },

  // THE FLOOR. Nothing else applied — no outlet near, none far, nobody to aim at. The cascade
  // wrote this as a bare `else kick(CX,CY,9)` and the scored list says the same thing by scoring
  // 100 when everything else scores 290 or more. An else IS the lowest score.
  // ── THE DIVE ──────────────────────────────────────────────────────────────
  // John: does gkDiveCheck become a keeper action? Yes, and it dissolves the crash rather than
  // working around it.
  //
  // gkDiveCheck(defT, flame) was called BY THE SHOOTER, from outside the keeper's frame, reaching
  // across to find the keeper and move him. That is why the flip crashed on a stale `owner`: the
  // shot was reaching for a player through a variable that no longer meant what it did.
  //
  // A DIVE IS SOMETHING THE KEEPER DOES. His prerequisite is "a shot is coming at my goal", which
  // is a fact he can read himself — ball.isShot, moving, and heading his way. Nobody reaches
  // across anything, and the shooter's frame ends when the shot leaves his foot, as it should.
  // ── THE TACKLE ────────────────────────────────────────────────────────────
  // John is right that this belongs here. It is the clearest action in the game — a player takes
  // the ball off another player — and it has been a rate inside a forEach over opponents, run
  // from the CARRIER's frame rather than the tackler's. Same inversion as the dive.
  //
  // The cascade's chance: 0.010 * (0.6+0.8*press) * aggression, times fresh-tackler and
  // gassed-carrier terms. At 60fps that is 0.6-1.5 a second, so a score of roughly 30-70 against
  // PLAY_ON_WEIGHT — and every one of those factors survives as a term.
  // ── SECURE IT ─────────────────────────────────────────────────────────────
  // The keeper catching it — "his ball, his moment, his name in lights", as the cascade puts it.
  // John named this one first, alongside the kick and the dive, and it is the last piece of
  // keeper behaviour still living in the owner block.
  //
  // It is the entanglement that made the separation look expensive: gkHolder and gkHoldUntil are
  // SET here and READ by four instructions. As an action the setting moves out and the reading
  // stays put — which is the whole separation for this piece, and it turns out to be small.
  //
  // Not available on a back-pass: he may not hold what his own side played to him, which is the
  // mustKick rule and it belongs in can() rather than as a check inside the hold.
  { name:'secure it', tier:TIER.SCRIPT, ported:true,
    coach:T => 0,
    can:p => !!(p.role==='K' && ball.owner===p && gkHolder!==p && !p.mustKick && onPitch(p)),
    score:p => 900,                    // he has caught it; there is nothing to decide
    act:p => {
      gkHolder=p; gkHoldUntil=clockSec+1.6; GKSTAT.holds=(GKSTAT.holds||0)+1;
      ENGINE_HOOKS.spawnNote(p.x,p.y-26,"\u{1F9E4} secured!",TEAMS[p.team].color,TEAMS[p.team].accent);
      return false;                    // holding is not releasing: his frame continues
    } },

  // ── AN INTENTIONAL FOUL ───────────────────────────────────────────────────
  // John: a Filthy side's defining behaviour. Available to EVERY player against any opponent
  // with the ball — not the narrow professional-foul condition it had, which required a man
  // breaking away with nobody covering and therefore almost never fired.
  //
  // THE SPREAD IS THE POINT, and a linear aggression multiplier could not deliver it:
  //
  //   Clean      3   essentially never. A Clean side does not do this.
  //   Firm      45   a cynical challenge now and then
  //   Nasty    260   regularly, and they know what they are doing
  //   Filthy   900   24% of the frames it is available. Constant.
  //
  // ── AND AN UNCAUGHT FOUL MUST PAY ─────────────────────────────────────────
  // Previously an unseen foul slowed the victim and nothing else, so fouling was a pure cost:
  // caught, you concede; unseen, you gained nothing. That makes Play On a softer Mayhem rather
  // than a different game.
  //
  // Now an unseen foul WINS THE BALL. Which is what a foul is for, and it makes Filthy under a
  // Play On referee a genuine strategy: you take the ball off people illegally, all match, and
  // nobody stops you.
  { name:'an intentional foul', tier:TIER.PLAYER, ported:true,
    coach:T => T.press*40,
    can:p => {
      if(!onPitch(p) || p.role==='K') return false;
      const o=ball.owner;
      if(!o || o.team===p.team || allied(p.team,o.team)) return false;
      if(o.role==='K' && gkHolding()) return false;
      if(holdingPlay() || pendingRestart) return false;
      return dist(p,o) < 30;
    },
    score:p => INTENT_W[teamAGG[p.team]] || 45,
    act:p => {
      const victim=ball.owner;
      if(!victim) return false;
      const R=REF();
      TEL.intentional++;
      victim.vx*=0.2; victim.vy*=0.2;
      stam(victim,-0.05);

      if(RNG() > R.sees){
        // SEEN BY NOBODY. He takes the ball, which is the entire point of doing it.
        TEL.foulMissed++;
        ball.owner=p; ball.lastTouch=p.team; ball.lastKicker=p; ball.isShot=false;
        suppress={team:victim.team, until:clockSec+1.0};
        ENGINE_HOOKS.spawnNote(p.x,p.y-20,"got away with it","#8fa0ae");
        return false;
      }

      awardFreeKick(victim, p);
      if(RNG() < 0.30*R.zeal) bookPlayer(p, RNG() < 0.22*R.zeal);
      return false;
    } },

  { name:'tackle', tier:TIER.PLAYER, ported:true,
    coach:T => T.press*60,
    can:p => {
      if(!onPitch(p) || p.role==='K') return false;
      const o=ball.owner;
      if(!o || o.team===p.team) return false;
      if(ball.fetch && ball.fetch.by===o) return false;      // nor a man carrying it to a mark
      if(o.role==='K' && gkHolding()) return false;         // you cannot rob a keeper holding it
      if(suppress && suppress.team===p.team && clockSec<suppress.until) return false;
      if(holdingPlay()) return false;
      return dist(p,o) < 26;                                // MUST stay above body radius 23
    },
    score:p => {
      const o=ball.owner;
      let sc = 44 * (0.6+0.8*T(p.team).press) * AGG_PRESETS[teamAGG[p.team]].t;
      sc *= (0.55+0.45*p.stamina);                          // fresh tacklers bite harder
      sc *= (1.35-0.5*(o?o.stamina:1));                     // gassed carriers are easier to rob
      if(momentumOn && clockSec<boostUntil[p.team]) sc *= 1.3;
      return sc;
    },
    act:p => {
      const victim=ball.owner;
      if(!victim) return false;
      // HE MIGHT GET THE MAN INSTEAD. A tackle is the commonest way to give a foul away, and it
      // is not a separate decision — it is this one going wrong.
      if(incidentalFoul(p, victim, 1.0)) return false;
      ball.owner=p; ball.lastTouch=p.team; ball.lastKicker=p; ball.isShot=false;
      if(p.role==='K'){
        ENGINE_HOOKS.spawnNote(p.x,p.y-20,"smothered!",TEAMS[p.team].color,TEAMS[p.team].accent);
      } else {
        stats.tackles[p.team]++; p.tackles++;
        ENGINE_HOOKS.spawnNote(p.x,p.y-20,"tackle!",TEAMS[p.team].color,TEAMS[p.team].accent);
      }
      stam(p,+0.10); stam(victim,-0.06);
      // AND THE VICTIM'S SIDE CANNOT IMMEDIATELY ROB IT BACK. Without this a tackle is a
      // coin-flip loop between two men standing on the ball — the cascade called it `suppress`
      // and it is the one piece of its bookkeeping that is really a rule.
      suppress={team:victim.team, until:clockSec+1.0};
      return false;    // he now HAS the ball; his frame continues so he can carry it
    } },

  // ── STAYING UP ────────────────────────────────────────────────────────────
  // STEP 1 OF THE KEEPER EXPERIMENT. A keeper declining to dive is not nothing — it is a named
  // goalkeeping decision with a payoff: stay on your feet, stay reactive, make him commit first.
  // It is why keepers are coached to do it.
  //
  // The generic PLAY_ON_WEIGHT cannot express that. It carries no coach weight, appears in no
  // report, and cannot be told apart from a frame where nothing was available at all.
  //
  // MECHANICALLY THIS CHANGES ALMOST NOTHING. He already declines most frames; the weight is set
  // so the dive/hold split stays where it was. The point is to make the decision VISIBLE before
  // anything is built on top of it — if he never holds, the dive weight is wrong and that is a
  // one-line fix rather than a new mechanic.
  { name:'staying up', tier:TIER.PLAYER, ported:true,
    coach:T => (1-T.press)*40,          // a patient side keeps its keeper on his feet
    can:p => {
      if(p.role!=='K' || !onPitch(p) || ball.owner) return false;
      if(p.diveUntil && clockSec < p.diveUntil) return false;
      const og=goalCenter(p.team);
      if(dist(ball,og) > 260) return false;
      return !!ball.isShot;             // the same situation the dive reads, for now
    },
    score:p => 2400,                    // holds the existing split: he dives ~12% of the time
    act:p => { TEL.keeperHeld++; return false; }   // he stays where he is, and stays free
  },

  // ── THE PENALTY DIVE: THREE CHOICES, MADE BLIND ───────────────────────────
  // John's design. A keeper facing a penalty picks left, right, or stays — and he picks BEFORE
  // the ball is struck, which is what makes a penalty a penalty. He is not reacting; he is
  // guessing, and a good guess is worth more than good reflexes.
  //
  // Height is a second, independent guess: low or high. Getting the side right and the height
  // wrong is the save that nearly was, which is the most agonising thing in football.
  //
  // Weighted so staying is rarer than diving, because a keeper who stands still looks foolish
  // when beaten and heroic when right, and most of them dive.
  { name:'penalty guess', tier:TIER.SCRIPT, ported:true,
    coach:T => 0,
    can:p => {
      if(p.role!=='K' || !onPitch(p)) return false;
      if(!pendingRestart || pendingRestart.kind!=='penalty') return false;
      if(p.team !== penaltyGoalTeam) return false;
      if(p.penGuess) return false;                   // he only guesses once
      const m={x:pendingRestart.x, y:pendingRestart.y};
      return dist(ball,m) <= 12;                     // the ball is on the spot
    },
    score:p => 700,
    act:p => {
      const r=RNG();
      const side = r<0.42 ? -1 : r<0.84 ? 1 : 0;     // left, right, or stand
      const high = RNG() < 0.34;                     // and a height, guessed separately
      p.penGuess = { side, high, at:clockSec };
      const g=goalCenter(p.team), e=EDGES[GOAL_EDGE[p.team]];
      const half=e.len*GOAL_HALF;
      if(side!==0){
        p.diveUntil = clockSec + 1.2;
        steer(p, g.x + e.ux*half*0.62*side, g.y + e.uy*half*0.62*side, 3.4);
        GKSTAT.penDives=(GKSTAT.penDives||0)+1;
        ENGINE_HOOKS.spawnNote(p.x, p.y-26, side<0?"dives left":"dives right", "#8fa0ae");
      } else {
        GKSTAT.penStands=(GKSTAT.penStands||0)+1;
        ENGINE_HOOKS.spawnNote(p.x, p.y-26, "stands up!", "#ffd166");
      }
      return false;                                  // guessing is not an act on the ball
    } },
  { name:'dive', tier:TIER.PLAYER, ported:true,
    coach:T => 0,
    can:p => {
      if(p.role!=='K' || !onPitch(p) || ball.owner) return false;
      if(!ball.isShot) return false;
      if(p.diveUntil && clockSec < p.diveUntil) return false;   // already committed
      if(p.burst<=0.6) return false;                            // it costs, and he has none
      const og=goalCenter(p.team);
      if(dist(ball,og) > 260) return false;
      // is it actually coming toward his goal?
      return ((og.x-ball.x)*ball.vx + (og.y-ball.y)*ball.vy) > 0;
    },
    // A BURNING SHOT DEMANDS A BURNING DIVE. The cascade expressed that as an if; here it is a
    // score, so a keeper faced with an ordinary shot dives sometimes and one faced with a flame
    // shot dives nearly always — the same behaviour, in the vocabulary the list speaks.
    score:p => ball.flameShot ? 2600 : 330,
    act:p => {
      const flame = !!ball.flameShot;
      p.burst-=0.6; p.diveUntil=clockSec+1.2;
      GKSTAT.diveBurns=(GKSTAT.diveBurns||0)+1;
      ENGINE_HOOKS.flamePop(p);
      if(flame){
        GKSTAT.duels=(GKSTAT.duels||0)+1;
        sayLogged(pick([
          `FIRE MEETS FIRE — both tanks emptied in one heartbeat!`,
          `${p.name} answers the flame with a flame of ${PRN(p).his} own!`,
          `A duel! Burning shot, burning dive — somebody's fire dies here!`]),true,"lowvoice");
      } else if(RNG()<0.4){
        sayLogged(pick([
          `${p.name} EXPLODES across the goal!`,
          `${p.name} throws ${PRN(p).him}self at it!`]),true);
      }
      return false;      // he dives AND stays in his frame: a dive is not a touch on the ball
    } },

  { name:'gk-hopeful', tier:TIER.PLAYER, ported:true,
    coach:T => 0,
    can:p => p.role==='K' && ball.owner===p,
    score:p => 100,
    act:p => { kick(CX,CY,9); return true; } },

  // ── THE PASS ──────────────────────────────────────────────────────────────
  // The cascade's candidate search, whole: every mate between 60 and 210+140*direct away, scored
  // on ground gained toward the target goal, minus 500 if the lane is blocked, plus jitter, minus
  // a treason penalty for passing to an ally when the scoreboard says not to.
  //
  // THE SEARCH LIVES IN A HELPER because can() and act() both need it — the same shape as the
  // keeper's outlets. can() asks whether anybody scores above -100; act() takes the best.
  { name:'pass', tier:TIER.PLAYER, ported:true,
    coach:T => (1-T.direct)*50,
    can:p => ball.owner===p && p.role!=='K' && targets[p.team]!==null && !!bestPass(p),
    // 320 -> 210. At 320 a carrier passed on 10% of frames and a possession lasted about eight
    // frames; at 210 it is 7% and about fourteen. He carries longer, which is what "weight
    // dribbling higher" means when the dribble is the no-op.
    score:p => 210,
    act:p => {
      const best=bestPass(p);
      if(!best) return false;
      kick(best.x+best.vx*8, best.y+best.vy*8, Math.min(9, dist(best,p)*0.045+4));
      if(allied(p.team, best.team)) ball.allyPass=true;
      return true;
    } },

  // ── OUT OF TROUBLE ────────────────────────────────────────────────────────
  // Trapped: near a wall, under pressure, and not in a goal mouth. He finds whoever is nearest
  // the middle and gives it to him. The cascade's rate was RNG()<0.22*dt*60, which is 13 a
  // second — a score of about 460, and by far the most eager thing in the list. That is right:
  // a man pinned on the touchline should be looking to escape almost immediately.
  // ── PASS BACKWARDS ────────────────────────────────────────────────────────
  // The option the engine has never had. A carrier under pressure could shoot, hoof, shield, or
  // pass forward into trouble — there was NO WAY TO KEEP THE BALL BY GOING BACKWARDS, which is
  // the first thing a real side does when the front is blocked.
  //
  // can(): the way forward is crowded. Opponents in the forward arc, and no open mate ahead.
  // act(): the best mate BEHIND the ball, preferring one with space.
  //
  // Scored below `pass` deliberately. Going backwards is what you do when forward is not on,
  // not a preference — and a side that recycles constantly is as wrong as one that hoofs.
  { name:'pass backwards', tier:TIER.PLAYER, ported:true,
    coach:T => (1-T.direct)*60,        // a patient side recycles; a direct one would rather hoof
    can:p => {
      if(ball.owner!==p || p.role==='K' || targets[p.team]===null) return false;
      const tgt=goalCenter(targets[p.team]);
      const fx=tgt.x-p.x, fy=tgt.y-p.y, fl=Math.hypot(fx,fy)||1;
      // how many opponents are in the forward arc, within 80?
      let ahead=0;
      players.forEach(o=>{ if(o.team===p.team||!onPitch(o)||allied(p.team,o.team)) return;
        const dx=o.x-p.x, dy=o.y-p.y, d=Math.hypot(dx,dy);
        if(d>80) return;
        if((dx*fx+dy*fy)/(d*fl||1) > 0.35) ahead++;   // roughly in front of him
      });
      if(ahead < 2) return false;                     // the way forward is open enough
      return !!backPass(p);
    },
    score:p => 240,
    act:p => {
      const b=backPass(p);
      if(!b) return false;
      kick(b.x+b.vx*6, b.y+b.vy*6, Math.min(7, Math.max(3, dist(b,p)/66*1.1)), false);
      TEL.backPasses=(TEL.backPasses||0)+1;
      return true;
    } },

  { name:'pass-safe', tier:TIER.PLAYER, ported:true,
    coach:T => 0,
    can:p => {
      if(ball.owner!==p || p.role==='K') return false;
      let wd=1e9, we=null;
      for(const e2 of EDGES){
        const d2=(p.x-e2.p1.x)*e2.nx + (p.y-e2.p1.y)*e2.ny;
        if(d2<wd){ wd=d2; we=e2; }
      }
      if(wd>=34) return false;
      const mouth = we && we.goal &&
        Math.abs((p.x-we.mx)*we.ux + (p.y-we.my)*we.uy) < we.len*GOAL_HALF;
      if(mouth) return false;
      let pressure=1e9;
      players.forEach(o=>{ if(o.team!==p.team && onPitch(o)) pressure=Math.min(pressure, dist(o,p)); });
      return pressure<58;
    },
    // 460 -> 380. Still the most eager thing in the list, because a man pinned on the touchline
    // should be looking to escape — but not so eager that being near a wall means passing.
    score:p => 380,
    act:p => {
      let best=null, bs=1e9;
      players.forEach(m=>{
        if(m.team!==p.team||m===p||!onPitch(m)||m.role==='K') return;
        const dc=dist(m,{x:CX,y:CY}); if(dc<bs){ bs=dc; best=m; }
      });
      if(best) kick(best.x+best.vx*8, best.y+best.vy*8, Math.min(9, dist(best,p)*0.045+4.5));
      else kick(CX,CY,7);
      return true;
    } },

  // pass-alt was a second copy of the same search in a different branch of the cascade. It is not
  // a different action — it is the same one, reached another way. DELETED rather than ported,
  // which is the first thing this port has removed rather than moved.


  { name:'shot', tier:TIER.PLAYER, ported:true,
    coach:T => T.direct*70,
    can:p => {
      if(ball.owner!==p || p.role==='K' || targets[p.team]===null) return false;
      const tgt=goalCenter(targets[p.team]);
      const dGoal=dist(p,tgt);
      if(dGoal>=230) return false;
      const RK=p.rating||0.5;
      return shotLaneClear(p,tgt) && RNG() < 0.016*(0.4+1.2*RK);
    },
    score:p => 360,
    act:p => {
      const tgt=goalCenter(targets[p.team]), e=EDGES[GOAL_EDGE[targets[p.team]]];
      const hw2=e.len*GOAL_HALF, RK=p.rating||0.5, dGoal=dist(p,tgt);
      const sc=(0.6+0.8*RK)*(0.75+dGoal*0.0035);
      const off=(RNG()*2-1)*hw2*sc;
      kick(tgt.x+e.ux*off, tgt.y+e.uy*off, 11.2, true);
      return true;
    } },

  // ── THE SHOT IS A RATE, NOT A CONDITION ───────────────────────────────────
  // Every other action asks "is this available". The cascade's shot asks something different:
  //
  //   if(laneClear && RNG() < 0.016 * (0.4+1.2*RK) * dt*60)
  //
  // A PER-FRAME PROBABILITY. It is not "can he shoot" but "does he, this frame" — a rate scaled
  // by his rating and by the frame length, so a better player shoots more often rather than more
  // accurately, and the whole thing is frame-rate independent.
  //
  // That does not translate to a score, and pretending it did would change the game. So the rate
  // stays in can(): the action becomes AVAILABLE at a rate rather than under a condition, which
  // is a third shape alongside prerequisite and preference. Worth naming — it is the first thing
  // in this port that the can/score/act shape did not already fit.
  { name:'shot-power', tier:TIER.PLAYER, ported:true,
    coach:T => T.direct*90,
    can:p => {
      if(ball.owner!==p || p.role==='K' || targets[p.team]===null) return false;
      if(p.burst<=0.7) return false;                  // the super shot needs legs
      const tgt=goalCenter(targets[p.team]);
      const dGoal=dist(p,tgt);
      if(dGoal>=260) return false;
      const RK=p.rating||0.5;
      return shotLaneClear(p,tgt) && RNG() < 0.016*(0.4+1.2*RK)*(1/60)*60*0.5;
    },
    score:p => 370,
    act:p => {
      const tgt=goalCenter(targets[p.team]), e=EDGES[GOAL_EDGE[targets[p.team]]];
      const hw2=e.len*GOAL_HALF, RK=p.rating||0.5, dGoal=dist(p,tgt);
      const scL=(0.6+0.8*RK)*(0.75+dGoal*0.0035);
      const offL=(RNG()*2-1)*hw2*scL;
      p.burst-=0.6; GKSTAT.superShots=(GKSTAT.superShots||0)+1;
      kick(tgt.x+e.ux*offL*0.75, tgt.y+e.uy*offL*0.75, 13.2, true);
      ball.flameShot=true;
      return true;
    } },
];

const ACTIONS = [
  // ── HEAD IT ───────────────────────────────────────────────────────────────
  // The first action, and the one that was never real: "going for the header" has only ever been
  // a job() tag on a cascade branch — it reads 0% in every log because nothing was ever extracted.
  //
  // PREREQUISITES, which is what can() is for: the ball must be ABOVE HEAD HEIGHT, COMING DOWN,
  // WITHIN REACH OF WHERE HIS HEAD ACTUALLY IS, and nobody may already own it. That last one
  // matters — you cannot head a ball somebody is dribbling.
  //
  // His head is at H_HEAD + his jump, so a man who has left the ground can reach a ball a
  // standing player cannot. That is the jump becoming worth something beyond the animation, which
  // is what John asked for when the jump was still cosmetic.
  // ── SHIELD IT ─────────────────────────────────────────────────────────────
  // A carrier with somebody on his shoulder and nowhere to go. He turns his back to the nearest
  // opponent and holds the ball, which is a real thing footballers do constantly and the engine
  // has never once done — a man under pressure here either loses it or runs into trouble.
  //
  // PREREQUISITES: he has the ball, somebody is close, and he is NOT already facing a way out.
  // That last one is what stops it firing on every carry.
  //
  // It costs him: shielding is standing still, so it buys safety and gives up ground. That is
  // the trade, and an action without a cost is a reflex.
  { name:'shield it', tier:TIER.PLAYER, base:430,
    can:p => {
      if(ball.owner!==p || !onPitch(p)) return false;
      let nd=1e9;
      players.forEach(q=>{ if(q.team!==p.team && onPitch(q)) nd=Math.min(nd, dist(q,p)); });
      if(nd>26) return false;                       // nobody on him: no reason
      // is there an outlet? if a mate is open ahead, he should be passing, not shielding
      const tgt=goalCenter(targets[p.team]!==null?targets[p.team]:p.team);
      let openMate=false;
      players.forEach(m=>{ if(m.team!==p.team||m===p||!onPitch(m)) return;
        if(dist(m,tgt) < dist(p,tgt) - 20){
          let cover=1e9;
          players.forEach(q=>{ if(q.team!==p.team && onPitch(q)) cover=Math.min(cover, dist(q,m)); });
          if(cover>45) openMate=true;
        } });
      return !openMate;
    },
    score:p => 430,
    act:p => {
      // back to the nearest opponent, ball on the far side of his body
      let near=null,nd=1e9;
      players.forEach(q=>{ if(q.team!==p.team && onPitch(q)){ const d=dist(q,p); if(d<nd){nd=d;near=q;} } });
      if(!near) return false;
      const ax=p.x-near.x, ay=p.y-near.y, al=Math.hypot(ax,ay)||1;
      p.hx=-ax/al; p.hy=-ay/al;                     // facing him, body between
      p.vx*=0.55; p.vy*=0.55;                       // the cost: he is not going anywhere
      ball.x=p.x+ax/al*9; ball.y=p.y+ay/al*9;       // ball on the far side
      TEL.shields++;
      return true;
    } },

  { name:'head it', tier:TIER.PLAYER, base:500,
    can:p => {
      if(!onPitch(p) || ball.owner) return false;
      const head = H_HEAD + (p.jz||0);
      if(ball.z < head*0.72 || ball.z > head + 22) return false;   // in the band his head occupies
      if(ball.zv > 0.4) return false;                              // coming down, not going up
      // A HEADED BALL MAY NOT BE HEADED AGAIN AT ONCE. Without this the ball never lands: one
      // header sets it flying, the next man heads it again, and six matches came back at 97%
      // aerial with nobody chasing anything. The same shape as the woodwork lockout, and the
      // same lesson — an action that produces its own prerequisite needs a refractory period.
      if(clockSec - (ball.headedAt||-9) < 1.2) return false;
      // CALIBRATED DOWN, and this is the number the simulation will argue about. At reach 18 and
      // a 1.2s lockout the game came back 3/6 usable with 37% aerial against a baseline 20% —
      // headers were happening constantly and the ball never settled.
      //
      // 11 is a head's width rather than an arm's, which is what a header actually requires. The
      // right value is a calibration question and this is the first action, so it is deliberately
      // set on the shy side: an action that never fires is a smaller problem than one that
      // dominates, and the telemetry counts it either way.
      return dist(p,ball) < 11;
    },
    score:p => 500 + (p.jz||0)*3,          // a man in the air wants it more than one who is not
    act:p => {
      // headed toward the goal he is attacking, with what pace a head can give it
      const tgt = goalCenter(targets[p.team]!==null?targets[p.team]:p.team);
      const dx=tgt.x-p.x, dy=tgt.y-p.y, dl=Math.hypot(dx,dy)||1;
      const far = dl > 200;
      // kick() reads ball.owner to know who struck it, so he owns it for the instant of contact.
      // A header is a touch, not a possession — he has it for one frame and it is gone, which is
      // exactly what the primitive expects and what I got wrong by nulling the owner first.
      // AN ELBOW IN THE AIR. Whoever else was going for it is who he caught.
      let rival=null, rd=1e9;
      players.forEach(q=>{ if(q.team===p.team||!onPitch(q)) return;
        const dd=dist(q,p); if(dd<26 && dd<rd){ rd=dd; rival=q; } });
      if(rival && incidentalFoul(p, rival, 0.7)) return true;
      ball.owner=p;
      kick(p.x+dx/dl*140, p.y+dy/dl*140, far?5.2:4.0, dl<200);
      ball.owner=null;
      ball.z = Math.max(ball.z, H_HEAD*0.8);
      ball.zv = 1.9;                       // a header loops rather than drills
      ball.lastTouch=p.team; ball.lastKicker=p;
      ball.headedAt = clockSec;
      TEL.headers++;
      ENGINE_HOOKS.spawnNote(p.x, p.y-30, "\u{1F9E0} header!", TEAMS[p.team].color);
      return true;
    } },
];

/** Score every available action, take the best, do it. Returns true if anything happened. */
// ── TIERS DECIDE; WEIGHTS CHOOSE ────────────────────────────────────────────
//
// John's shape, and it is better than what I had. Highest-score-wins fires an action the instant
// it is legal — so I was about to invent a "hesitance" term to stop shots happening at the
// earliest possible frame. That is a fudge for a missing idea.
//
// THE MISSING IDEA IS A WEIGHTED NO-OP. Selection is proportional and "play on" is an action with
// a large weight, so a shot scoring 360 fires on about a ninth of the frames it is available.
// THE RATIO IS THE RATE — which means the cascade's `RNG() < 0.016*(0.4+1.2*RK)*dt*60` ports
// directly instead of being reinterpreted: every situational factor becomes a score term, and the
// part that meant "not every frame" becomes the no-op's weight.
//
// ACROSS TIERS IT STAYS ABSOLUTE. A penalty must be taken; in a lottery a taker would sometimes
// simply not. So the highest available tier wins outright and the weighting happens WITHIN it.
// The no-op exists at PLAYER tier only — "the game acts" stays certain, "he chooses" becomes
// probabilistic, which is the distinction the tiers were for.
/** Who may still act during a restart: the taker, and a fetcher who has not finished fetching.
 *  Everyone else is on `positioning for a restart` and has nothing to do. */
function restartFree(p){
  if(!pendingRestart) return true;
  if(pendingRestart.p===p) return true;                       // he is taking it
  if(ball.fetch && ball.fetch.by===p) return true;            // he is still going to get it
  // AND THE KEEPER FACING A PENALTY. He is not taking the restart, but he is the other half of
  // it — the lock is there to stop players interfering with a set piece, and a keeper guessing
  // is not interference, it is the set piece.
  if(pendingRestart.kind==='penalty' && p.role==='K' && p.team===penaltyGoalTeam) return true;
  return false;
}

// ── COMMENTARY HANGS OFF ACTION NAMES ───────────────────────────────────────
// Fifteen of twenty actions are silent, and the five that speak have their lines hardcoded in
// act(). So every new action arrives mute and somebody has to remember to give it a voice.
//
// A table instead. An action fires, this layer decides whether to say anything about it, and a
// new action gets commentary by adding a row rather than by editing its body.
//
// `rate` is how often it is worth remarking on. A tackle every time would be exhausting; a
// penalty every time is the point.
const ACTION_SAY = {
  'shot':          { rate:0.30, lines:p=>[
      `${p.name} lets fly!`,
      `${p.name} goes for it — no hesitation.`,
      `A sight of goal and ${p.name} takes it.`] },
  'shot-power':    { rate:0.70, lines:p=>[
      `${p.name} from DISTANCE — that is ambitious!`,
      `Absolute howitzer from ${p.name}!`,
      `${p.name} saw the keeper off his line and went for the roof.`] },
  'through ball':  { rate:0.35, lines:p=>[
      `${p.name} slides it through the gap!`,
      `Lovely ball from ${p.name} — into the space, not at the feet.`,
      `${p.name} plays the pass nobody else saw.`] },
  'pass backwards':{ rate:0.14, lines:p=>[
      `${p.name} turns back — nothing on, so he keeps it.`,
      `Sensible from ${p.name}: the front was bolted shut.`,
      `${p.name} recycles. Patience is a tactic.`] },
  'hoof it':       { rate:0.22, lines:p=>[
      `${p.name} wants none of that — hoofed clear!`,
      `${p.name} launches it into the ${pick(['night','stands','general direction of Cascadia'])}.`,
      `Row Z beckons and ${p.name} obliges.`] },
  'shield it':     { rate:0.10, lines:p=>[
      `${p.name} puts ${PRN(p).his} body between man and ball.`,
      `${p.name} shields it — nowhere to go, so nowhere he goes.`] },
  'gk-punt':       { rate:0.20, lines:p=>[
      `${p.name} clears his lines with interest.`,
      `Up and away from ${p.name} — somebody go and find it.`] },
  'gk-clear':      { rate:0.30, lines:p=>[
      `${p.name} is not messing about — gone.`,
      `Panic? Not quite. ${p.name} just did not fancy it.`] },
  'sweeping':      { rate:0.45, lines:p=>[
      `${p.name} races off his line and gets there first!`,
      `Sweeper-keeper stuff from ${p.name}.`] },
  'throw-in':      { rate:0.10, lines:p=>[`${p.name} takes it quickly.`] },
  'corner-swing':  { rate:0.55, lines:p=>[
      `${p.name} swings it in...`,
      `Here comes the delivery from ${p.name}...`] },
  'penalty':       { rate:1.00, lines:p=>[
      `${p.name} steps up. The whole ground holds its breath.`] },
  'free-kick':     { rate:0.40, lines:p=>[
      `${p.name} over it... and strikes!`,
      `${p.name} takes aim from the set piece.`] },
};

function sayAction(name, p){
  const e=ACTION_SAY[name];
  if(!e || RNG_COS()>e.rate) return;
  sayLogged(pick(e.lines(p)));
}

function runAction(p){
  // ── A RESTART LOCKS EVERYBODY BUT THE TAKER AND THE FETCHER ──────────────
  // John's correction, and the lock was wrong without it: I wrote it as "everybody but
  // pendingRestart.p", which assumes the fetcher and the taker are the same man. They happen to
  // be today, and nothing guarantees it — a re-staging or a changed taker splits them, and then
  // the lock freezes the very player who is supposed to be carrying the ball.
  //
  // THE FETCHER IS UNLOCKED UNTIL HE HAS FETCHED. After that he locks like everybody else,
  // unless he is also taking it.
  // ── AND THE TAKER MAY ONLY TAKE THE RESTART ──────────────────────────────
  // He is free to ACT, but only to act on the restart. Being merely unlocked let his ordinary
  // actions fire: he walked 146 units to the ball, picked it up, and PASSED IT 247 UNITS AWAY —
  // then chased it again. That is the corner loop, and it is why four other fixes moved nothing.
  //
  // A man taking a corner is taking a corner. He is not choosing between that and a through
  // ball.
  const inRestart = !!pendingRestart;
  if(inRestart && !restartFree(p)) return false;
  const list = ACTIONS_LIVE ? ACTIONS.concat(PORTED) : ACTIONS;
  const T9 = TACTICS(p.team);

  let topTier = -1;
  const avail = [];
  for(const A of list){
    if(!A.can(p)) continue;
    const t = A.tier||TIER.PLAYER;
    avail.push({A, t});
    if(t>topTier) topTier = t;
  }
  if(!avail.length) return false;

  // during a restart only SCRIPT actions are available — the restart itself, and nothing else
  const pool = avail.filter(x=>x.t===topTier && (!inRestart || x.t===TIER.SCRIPT));
  if(inRestart && !pool.length) return false;
  let total = 0;
  const weights = pool.map(x=>{
    // the coach weights every action rather than owning a tier, which is John's correction
    const w = Math.max(1, x.A.score(p) + (x.A.coach ? x.A.coach(T9) : 0));
    total += w;
    return w;
  });
  // ── AND A NO-OP AT SCRIPT TIER TOO ────────────────────────────────────────
  // John's idea, and it removes every hardcoded restart delay in the engine. A mandated action
  // does not fire the instant it is legal; it RIPENS. Its weight grows each frame against a fixed
  // no-op, so the probability of it happening rises from nearly nothing to a certainty — and
  // WHICH frame it lands on is sampled rather than set.
  //
  // That is the variable pause John asked for on throws, corners and kick-offs, and "sometimes
  // they can move quick" falls out of it rather than being a special case. A quick throw is not
  // a different rule; it is the tail of the same distribution.
  //
  // The growth rate is where tactics reach it: a side that wants tempo ripens fast, one that
  // wants to settle ripens slowly. Same action, different urgency, no second code path.
  if(topTier===TIER.PLAYER) total += PLAY_ON_WEIGHT;
  else if(topTier===TIER.SCRIPT) total += SETUP_WEIGHT;

  let r = RNG()*total;
  for(let i=0;i<pool.length;i++){
    r -= weights[i];
    if(r<=0){
      const A = pool[i].A;
      p.lastAction = A.name;
      TEL.actFrames[A.name] = (TEL.actFrames[A.name]||0) + 1;
      const did = A.act(p)!==false;
      if(did) sayAction(A.name, p);     // the consequence layer, once, after it happened
      return did;
    }
  }
  TEL.actFrames['play on'] = (TEL.actFrames['play on']||0) + 1;
  return false;                       // he carries on, which is most frames
}

const INSTRUCTIONS = [
  // ── THE RESTART, AS A STATE MACHINE ───────────────────────────────────────
  //
  // Built from what should happen rather than from what the cascade did, because the cascade did
  // not work either: hovering balls, wandering takers, eleven-second freezes.
  //
  // FOUR STAGES, and each one asks WHERE THE BALL IS rather than reading a flag. Flags get
  // cleared underneath a player — that is what stranded the last version mid-carry. The ball's
  // position cannot be cleared.
  //
  //   1  he does not have it and it is not on the mark   -> go and get it
  //   2  he has it                                       -> carry it to the mark, put it down
  //   3  it is on the mark and he is not behind it       -> take up position
  //   4  he is behind it                                 -> the action fires when ripe
  //
  // A restart ends when the ball is struck. Nothing else ends it, and no timeout is needed
  // because every stage moves toward the next one.

  { name:'fetching the ball', tier:TIER.SCRIPT, base:960,
    applies:p => !!(pendingRestart && pendingRestart.p===p && !p.out && !p.sentOff
                    && ball.owner!==p
                    && dist(ball, {x:pendingRestart.x, y:pendingRestart.y}) > 12),
    score:p => 960,
    act:p => {
      if(dist(p,ball) > 12){ steer(p, ball.x, ball.y, 2.6); return true; }
      ball.owner=p; ball.vx=0; ball.vy=0; ball.z=0; ball.zv=0;
      ENGINE_HOOKS.spawnNote(ball.x, ball.y-22, "\u{1F450} fetched", TEAMS[p.team].color);
      return true;
    } },

  { name:'carrying it to the mark', tier:TIER.SCRIPT, base:958,
    // ── AND ONLY IF THE BALL IS NOT ALREADY THERE ─────────────────────────
    // Without this the goal kick loops: the ball is placed ON the mark, the keeper standing
    // beside it claims it, THIS fires and carries it to where it already is, places it, releases
    // it — and he claims it again. Loose fell to 3% because the ball was owned all match.
    //
    // A man carrying a ball to a mark has a reason to be carrying it. If the ball is on the mark
    // there is nothing to carry.
    applies:p => !!(pendingRestart && pendingRestart.p===p && ball.owner===p
                    && dist(ball, {x:pendingRestart.x, y:pendingRestart.y}) > 14
                    && !p.out && !p.sentOff),
    score:p => 958,
    act:p => {
      const mx=pendingRestart.x, my=pendingRestart.y;
      ball.x=p.x; ball.y=p.y; ball.z=5; ball.vx=0; ball.vy=0; ball.zv=0;   // it rides with him
      // A CARRY THAT CANNOT ARRIVE MUST STILL END. This instruction held the ball for 48% of a
      // whole match — a man picking it up for a restart and carrying it forever, which glued the
      // ball to him, collapsed loose% to 8%, and registered as every stall in the log.
      //
      // Whatever stops him arriving — clamping, separation, stamina, a mark he cannot stand on —
      // the restart cannot depend on it. Four seconds and he puts it down where he is, which is
      // legal enough: he is on the pitch and the ball is at his feet.
      // ── AN ARRIVAL THRESHOLD HE CAN ACTUALLY REACH ──────────────────────
      // This was `> 9` with a four-second timeout that dropped the ball wherever he stood and
      // MOVED THE MARK TO HIM. John said fix it, do not time-limit it — and he was right, because
      // the timeout hid the real fault and shipped a rule where the mark follows the player.
      //
      // The fault: steer() decelerates as it closes, so the carrier asymptoted at 9.6 and never
      // crossed 9. He carried the ball for 48% of a match. A player's body radius is about 11 —
      // HE CANNOT STAND ON THE MARK. He stands beside it and puts the ball down.
      //
      // 14 is within arm's reach and outside the deceleration band. No timeout, no moved mark.
      if(dist(p,{x:mx, y:my}) > 14){ steer(p, mx, my, 2.6); return true; }

      // DOWN ON THE MARK, and he lets go. Putting it down is the point.
      ball.x=mx; ball.y=my; ball.z=0; ball.vx=0; ball.vy=0; ball.zv=0;
      ball.owner=null;
      // THE RIPENING CLOCK STARTS WHEN THE BALL IS DOWN, not when the restart was awarded. A
      // taker who had to walk forty yards has not been dawdling.
      if(pendingRestart.since===undefined) pendingRestart.since=clockSec;
      ENGINE_HOOKS.spawnNote(mx, my-22, "on the mark", TEAMS[p.team].color);
      return true;
    } },

  { name:'standing over it', tier:TIER.SCRIPT, base:956,
    applies:p => {
      if(!pendingRestart || pendingRestart.p!==p || p.out || p.sentOff) return false;
      if(ball.owner) return false;
      const m={x:pendingRestart.x, y:pendingRestart.y};
      if(dist(ball,m) > 12) return false;              // the ball is not on the mark yet
      return dist(p, restartSpot(p)) > 8;              // and he is not yet behind it
    },
    score:p => 956,
    act:p => { const q=restartSpot(p); steer(p, q.x, q.y, 2.6); return true; } },

  // ── POSITIONING FOR A RESTART ─────────────────────────────────────────────
  // John's rule, and it is the right one: do not protect the fetcher with a special case —
  // give everybody else a MANDATORY instruction that leaves them nothing else to do.
  //
  // The corner was failing because the fetcher picked the ball up and was immediately robbed:
  // he reached it at 13 units, and two samples later the ball was 127 away and he was fetching
  // again. Forever. A tackle does not know a restart is in progress.
  //
  // SCRIPT tier, so it outranks every player decision, and `runAction` declines for anyone
  // holding it — which is what makes it a lock rather than a suggestion. No guard on the ball,
  // no exception in the tackle: the situation simply cannot arise.
  //
  // Where they go depends on whose restart it is, which is the useful part: the taking side
  // spreads into space, the others drop toward their own goal. A restart becomes a shape.
  // ── ON HIS LINE FOR A PENALTY ─────────────────────────────────────────────
  // The keeper used to be teleported onto his line. He walks now — and he is the one player
  // `positioning for a restart` must not sweep away, because his position IS the drama.
  { name:'on his line', tier:TIER.SCRIPT, base:945,
    applies:p => !!(pendingRestart && pendingRestart.kind==='penalty'
                    && p.role==='K' && p.team===penaltyGoalTeam && !p.out && !p.sentOff),
    score:p => 945,
    act:p => {
      const g=goalCenter(p.team), e=EDGES[GOAL_EDGE[p.team]];
      steer(p, g.x+e.nx*12, g.y+e.ny*12, 2.4);
      return true;
    } },
  // ── THE PENALTY BOX EMPTIES ───────────────────────────────────────────────
  // A penalty is the one set piece with no wall — the laws put EVERYBODY outside the area and
  // behind the ball, and the three-sided version makes that more interesting rather than less,
  // because there are two sides who are not taking it and they want different things.
  //
  //   THE ATTACKING SIDE   on the arc, goal-side of the ball, ready for the rebound. They are
  //                        the only ones who benefit from it dropping short.
  //
  //   THE CONCEDING SIDE   the same arc, because a rebound they reach first ends the danger.
  //                        Slightly deeper — they are protecting, not hunting.
  //
  //   THE THIRD SIDE       John's question, and the good one. They care about neither the kick
  //                        nor the rebound. They drop toward their OWN goal and spread — because
  //                        whatever happens next, somebody attacks somebody, and the side that
  //                        did not concede the penalty is the side best placed to counter it.
  //
  // All of them stay out of the box. The keeper is exempt via `on his line`, and the shooter via
  // being the taker.
  { name:'clearing the penalty area', tier:TIER.SCRIPT, base:942,
    applies:p => !!(pendingRestart && pendingRestart.kind==='penalty'
                    && pendingRestart.p!==p && !p.out && !p.sentOff
                    && !(p.role==='K' && p.team===penaltyGoalTeam)),
    score:p => 942,
    act:p => {
      const spot={x:pendingRestart.x, y:pendingRestart.y};
      const g=goalCenter(penaltyGoalTeam);
      // the axis from goal out through the spot: everyone stands beyond the ball on it
      const ax=spot.x-g.x, ay=spot.y-g.y, al=Math.hypot(ax,ay)||1;
      const ux=ax/al, uy=ay/al, px=-uy, py=ux;
      const lat=((p.k1*733)%1-0.5);

      if(p.team===pendingRestart.team){
        // ATTACKING: on the arc, tight, hungry for the rebound
        const dep=PEN_R+26+((p.k2*397)%1)*30;
        steer(p, g.x+ux*dep+px*lat*190, g.y+uy*dep+py*lat*190, 2.2);
      } else if(p.team===penaltyGoalTeam){
        // CONCEDING: the same arc, a little deeper. Protecting, not hunting.
        const dep=PEN_R+40+((p.k2*571)%1)*26;
        steer(p, g.x+ux*dep+px*lat*210, g.y+uy*dep+py*lat*210, 2.2);
      } else {
        // THE THIRD SIDE: neither kick nor rebound is theirs. Home, and spread for the counter.
        const own=goalCenter(p.team);
        const cx2=own.x+(CX-own.x)*0.42, cy2=own.y+(CY-own.y)*0.42;
        const ox=-(own.y-CY), oy=(own.x-CX), ol=Math.hypot(ox,oy)||1;
        steer(p, cx2+(ox/ol)*lat*230, cy2+(oy/ol)*lat*230, 2.1);
      }
      return true;
    } },
  { name:'positioning for a restart', tier:TIER.SCRIPT, base:940,
    applies:p => !!(pendingRestart && !restartFree(p) && !p.out && !p.sentOff
                    && p.role!=='K'),
    score:p => 940,
    act:p => {
      const R=pendingRestart, mine = (p.team===R.team);
      const own=goalCenter(p.team);
      if(mine){
        // show for it: fan out from the mark, at a distance worth throwing to
        const ax=CX-R.x, ay=CY-R.y, al=Math.hypot(ax,ay)||1;
        const px=-ay/al, py=ax/al;
        const lat=((p.k1*911)%1-0.5)*200;
        const dep=70 + ((p.k2*631)%1)*90;
        steer(p, R.x+ax/al*dep+px*lat, R.y+ay/al*dep+py*lat, 2.0);
      } else {
        // and everybody else gets goal-side, which is what defending a restart means
        const ax=R.x-own.x, ay=R.y-own.y, al=Math.hypot(ax,ay)||1;
        const px=-ay/al, py=ax/al;
        const lat=((p.k1*829)%1-0.5)*150;
        steer(p, own.x+ax/al*(al*0.55)+px*lat, own.y+ay/al*(al*0.55)+py*lat, 2.0);
      }
      return true;
    } },

  { name:'standing over a free kick', tier:TIER.SCRIPT, base:960,
    applies:p => !!(freeKick && !freeKick.done && freeKick.taker===p && !p.out && !p.sentOff),
    score:p => 960,
    act:p => {
      const fd=dist(p,{x:freeKick.x,y:freeKick.y});
      if(fd>12){ steer(p, freeKick.x, freeKick.y, 2.4); return true; }
      p.vx=0; p.vy=0;
      ball.owner=p; ball.lastTouch=p.team; ball.lastKicker=p; ball.touchT=0.4;
      if(clockSec-freeKick.at>2.5 || wallClear(freeKick)){
        freeKick.done=true;
        p.noChase=clockSec+1.0;
      }
      return true;
    } },

  // ── THE RETREAT ───────────────────────────────────────────────────────────
  // REQUIREMENT, and the only rule in football that exists purely to make a restart possible.
  // The offending side and nobody else.
  { name:'retreating from a free kick', tier:TIER.REQUIREMENT, base:880,
    applies:p => !!(freeKick && !freeKick.done && p.team!==freeKick.team && !p.out && !p.sentOff
                    && Math.hypot(p.x-freeKick.x, p.y-freeKick.y)<64),
    score:p => 880,
    act:p => {
      const dx=p.x-freeKick.x, dy=p.y-freeKick.y, dl=Math.hypot(dx,dy)||1;
      steer(p, freeKick.x+dx/dl*70, freeKick.y+dy/dl*70, 2.4);
      return true;
    } },

  // ── THE WALL ──────────────────────────────────────────────────────────────
  // COACH. Once he is legal, he stands ON THE LINE between the ball and his own goal, at the
  // required distance — which is what a wall is: bodies in the way of the direct route. Spread
  // laterally by the usual stable hash so three men make a wall rather than a queue.
  // Only the OFFENDING side builds a wall. The third team has retreated like everyone else, but
  // it is not their goal being shot at and they have no reason to stand in front of it.
  // EITHER DEFENDING SIDE MAY NEED A WALL, not just the offender — the kick may be aimed at the
  // third team's goal, and on a hex nobody is told which. A side guards its own goal when it is
  // the one being aimed at, which is the only thing worth guarding.
  { name:'in the wall', tier:TIER.COACH, base:130,
    applies:p => !!(freeKick && !freeKick.done && p.team===freeKick.aim && !p.out && !p.sentOff
                    && p.role!=='K'
                    && Math.hypot(p.x-freeKick.x, p.y-freeKick.y)>=64),
    score:p => 130,
    act:p => {
      const og=goalCenter(p.team);
      const dx=og.x-freeKick.x, dy=og.y-freeKick.y, dl=Math.hypot(dx,dy)||1;
      const px=-dy/dl, py=dx/dl;
      const lat=((p.k1*829)%1-0.5)*46;
      steer(p, freeKick.x+dx/dl*72+px*lat, freeKick.y+dy/dl*72+py*lat, 2.2);
      return true;
    } },

  // ── MAKING A RUN ──────────────────────────────────────────────────────────
  // COACH. The taker's side finds an OPEN LANE: each man picks an angle from the ball by stable
  // hash and runs to it, at a distance that keeps him a real option rather than on top of the
  // kick. A weight, not a must — if the ball comes loose he plays football instead.
  { name:'making a run', tier:TIER.COACH, base:128,
    applies:p => !!(freeKick && !freeKick.done && p.team===freeKick.team && freeKick.taker!==p
                    && !p.out && !p.sentOff && p.role!=='K'),
    score:p => 128,
    act:p => {
      // toward the goal the KICK is aimed at, which is not always the side's standing target
      const tgt=goalCenter(freeKick.aim!==undefined?freeKick.aim:targets[p.team]);
      const base=Math.atan2(tgt.y-freeKick.y, tgt.x-freeKick.x);
      const ang=base + ((p.k1*887)%1-0.5)*1.7;      // fan across the attacking side
      const rad=95 + ((p.k2*673)%1)*85;
      steer(p, freeKick.x+Math.cos(ang)*rad, freeKick.y+Math.sin(ang)*rad, 2.1);
      return true;
    } },

  // ── THE THIRD SIDE KEEPS ITS DISTANCE ─────────────────────────────────────
  // They have retreated with everybody else — the REQUIREMENT above applies to them too. Beyond
  // that they simply hold a sensible station and wait for the ball to be live, which is what a
  // team with no stake in a restart actually does.
  //
  // They do NOT sit in the passing lanes. An informal alliance confers no right to crowd
  // somebody else's free kick, and letting them do it turned a restart into a scrum.
  { name:'covering its own goal', tier:TIER.PLAYER, base:405,
    applies:p => !!(freeKick && !freeKick.done && p.team!==freeKick.team && p.team!==freeKick.aim
                    && !p.out && !p.sentOff && p.role!=='K'
                    && Math.hypot(p.x-freeKick.x, p.y-freeKick.y)>=64),
    score:p => 405,
    act:p => {
      const own=goalCenter(p.team);
      const ax=CX-own.x, ay=CY-own.y, al=Math.hypot(ax,ay)||1;
      const px=-ay/al, py=ax/al;
      const lat=((p.k1*911)%1-0.5)*150;
      steer(p, own.x+ax*0.6+px*lat, own.y+ay*0.6+py*lat, 1.5);
      return true;
    } },


  // ── INTO THE BOX FOR A CORNER ─────────────────────────────────────────────
  // EXPLICIT. Named from its steer target: g9 plus 46 along the goal's inward normal, with a
  // per-player lateral offset — that is "get in the box and spread across its width".
  { name:'into the box', tier:TIER.COACH, base:860,
    applies:p => !!(pendingRestart && cornerTaker===pendingRestart.p && cornerGoal!==null
                    && p!==pendingRestart.p && p.team===pendingRestart.team),
    score:p => 860,
    act:p => {
      const g9=goalCenter(cornerGoal), e9=EDGES[GOAL_EDGE[cornerGoal]];
      const lat=((p.k1*997)%1-0.5)*90;
      steer(p, g9.x+e9.nx*46+e9.ux*lat, g9.y+e9.ny*46+e9.uy*lat, 2.2);
      return true;
    } },

  // ── MARKING AT A CORNER ───────────────────────────────────────────────────
  // EXPLICIT. Target: fifteen units from his man, on the line between that man and the goal —
  // which is goal-side marking, and is the whole of defending a corner.
  { name:'marking at a corner', tier:TIER.COACH, base:850,
    applies:p => !!(pendingRestart && cornerTaker===pendingRestart.p && cornerGoal!==null
                    && p.team===cornerGoal),
    score:p => 850,
    act:p => {
      const g9=goalCenter(cornerGoal);
      let mk=null,mkd=1e9;
      players.forEach(q=>{ if(q.team!==pendingRestart.team||q.out||q.sentOff)return;
        const d9=dist(q,g9); if(d9<mkd){mkd=d9;mk=q;} });
      if(!mk) return false;
      const gx=g9.x-mk.x, gy=g9.y-mk.y, gl=Math.hypot(gx,gy)||1;
      steer(p, mk.x+gx/gl*15, mk.y+gy/gl*15, 2.2);
      return true;
    } },

  // ── SHOWING FOR A THROW ───────────────────────────────────────────────────
  // NOT explicit — he is offering, not obeying. Target: the throw mark itself, from beyond 110,
  // which is "come and be available at throwing distance".
  { name:'showing for a throw', tier:TIER.PLAYER, base:760,
    applies:p => !!(pendingRestart && cornerTaker!==pendingRestart.p && p!==pendingRestart.p
                    && p.team===pendingRestart.team
                    && dist(p,{x:pendingRestart.x,y:pendingRestart.y})>110),
    score:p => 760,
    act:p => { steer(p, pendingRestart.x, pendingRestart.y, 2.0); return true; } },

  // ── DENYING A THROW ───────────────────────────────────────────────────────
  // Target: the midpoint between the thrower and the man he most wants, which is a body in the
  // passing lane rather than a man marking a man.
  { name:'denying a throw', tier:TIER.PLAYER, base:750,
    applies:p => !!(pendingRestart && cornerTaker!==pendingRestart.p
                    && p.team!==pendingRestart.team
                    && dist(p,{x:pendingRestart.x,y:pendingRestart.y})<150),
    score:p => 750,
    act:p => {
      const R=pendingRestart;
      let mk=null,mkd=1e9;
      players.forEach(q=>{ if(q.team!==R.team||q===R.p||q.out||q.sentOff)return;
        const dd=dist(q,{x:R.x,y:R.y}); if(dd<mkd){mkd=dd;mk=q;} });
      if(!mk) return false;
      steer(p, (mk.x+R.x)/2, (mk.y+R.y)/2, 2.0);
      return true;
    } },

  // ── THE BUS: A MIDFIELDER DROPS IN ────────────────────────────────────────
  // Named from its condition, not its target: TT.bunker>0.5 && role M. A coach setting that
  // changes WHICH INSTRUCTION APPLIES rather than tweaking a number — which is what a tactic is,
  // and it was already true before this list existed. The list just makes it legible.
  { name:'the bus \u2014 dropping in', tier:TIER.COACH, base:520,
    // WIDENED to match what the cascade actually did: bunker alone, not bunker-plus-an-opposing-
    // owner. I had added a condition the original never had, so whenever the ball was loose or
    // his own side's the cascade kept him — which is most of the 6% that was left.
    applies:p => p.role==='M' && !p.out && !p.sentOff && targets[p.team]!==null
              && p!==chaser[p.team] && TACTICS(p.team).bunker>0.5,
    score:p => 520,
    act:p => {
      const own=goalCenter(p.team);
      steer(p, own.x+(ball.x-own.x)*0.62, own.y+(ball.y-own.y)*0.62, 2.0);
      return true;
    } },

  // ── THE LONE OUTLET ───────────────────────────────────────────────────────
  // The other half of the bus: while everyone else drops, one forward holds a position between
  // his own goal and the ball, so there is somebody to counter through.
  { name:'holding the counter', tier:TIER.COACH, base:510,
    applies:p => p.role==='F' && !p.out && !p.sentOff && targets[p.team]!==null
              && p!==chaser[p.team] && TACTICS(p.team).bunker>0.5,
    score:p => 510,
    act:p => {
      // the midpoint between his own goal and the one he attacks — a counter station, not a
      // point relative to the ball. The instruction had this as (own+ball)/2, which is a
      // different place entirely and drifts with play instead of holding a post.
      const own=goalCenter(p.team), tgt=goalCenter(targets[p.team]);
      steer(p, (own.x+tgt.x)/2, (own.y+tgt.y)/2, 2.0);
      return true;
    } },

  // ── INTERCEPTING ──────────────────────────────────────────────────────────
  // Target: ball.x + ball.vx*6 — six frames AHEAD of the ball rather than at it. Leading a pass
  // is a different instruction from chasing one, and the target is the only thing that says so.
  { name:'intercepting', tier:TIER.PLAYER, base:480,
    applies:p => !p.out && !p.sentOff && p.role!=='K' && !ball.owner
              && Math.hypot(ball.vx,ball.vy)>2.5 && dist(p,ball)<120,
    score:p => 480 - dist(p,ball)*0.4,           // the nearest man wants it most
    act:p => { steer(p, ball.x+ball.vx*6, ball.y+ball.vy*6, 2.3); return true; } },

  // ── NO PRESSING A FRIEND'S KEEPER ─────────────────────────────────────────
  // Three-sided-specific and it has no analogue in football: an ally's keeper is holding, so you
  // drop into your own shape rather than harassing him. The comment above it already said this;
  // the name just makes it visible.
  { name:"an ally's keeper has it", tier:TIER.PLAYER, base:600,
    applies:p => !!(gkHolding() && ball.owner && p.team!==ball.owner.team && p.role!=='K'
                    && allied(p.team, ball.owner.team)),
    score:p => 600,
    act:p => {
      const og5=goalCenter(p.team), ax5=CX-og5.x, ay5=CY-og5.y;
      steer(p, og5.x+ax5*0.55, og5.y+ay5*0.55, 0.9);
      return true;
    } },

  // ── RETREAT FOR THE LONG BALL ─────────────────────────────────────────────
  // A defender against an opposing keeper who has it: get depth, because what is coming is a
  // punt. The lateral spread is per-player and stable so a back line does not stack.
  { name:'getting depth', tier:TIER.COACH, base:590,
    applies:p => !!(gkHolding() && ball.owner && p.team!==ball.owner.team && p.role==='D'
                    && !allied(p.team, ball.owner.team)),
    score:p => 590,
    act:p => {
      const og5=goalCenter(p.team), ax5=CX-og5.x, ay5=CY-og5.y;
      const pl5=Math.hypot(ax5,ay5)||1, px5=-ay5/pl5, py5=ax5/pl5;
      const lat6=((p.k1*997)%1-0.5)*240;
      steer(p, og5.x+ax5*0.34+px5*lat6, og5.y+ay5*0.34+py5*lat6, 1.15);
      return true;
    } },

  // ── COVERING A ROLL LANE ──────────────────────────────────────────────────
  // A midfielder or forward against a keeper who is holding: stand 62% of the way along the line
  // from him to one of his outlets, so the short distribution has a body in it. Each player picks
  // a DIFFERENT outlet from a stable per-player hash, which is why a whole side does not converge
  // on the same lane.
  //
  // The 85 floor keeps him out of the keeper's area — the same distance the area rule uses, and
  // it was already here before I gave keepers that clamp.
  { name:'covering a roll lane', tier:TIER.COACH, base:580,
    applies:p => !!(gkHolding() && ball.owner && p.team!==ball.owner.team && p.role!=='K'
                    && !allied(p.team, ball.owner.team) && p.role!=='D'
                    && players.some(m=>m.team===ball.owner.team && m.role!=='K' && !m.out && !m.sentOff)),
    score:p => 580,
    act:p => {
      const gk2=ball.owner;
      const outs=players.filter(m=>m.team===gk2.team&&m.role!=='K'&&!m.out&&!m.sentOff);
      const o5=outs[Math.floor(((p.k1*769)%1)*outs.length)%outs.length];
      let lx=gk2.x+(o5.x-gk2.x)*0.62, ly=gk2.y+(o5.y-gk2.y)*0.62;
      const dgk=Math.hypot(lx-gk2.x,ly-gk2.y);
      if(dgk<85){ lx=gk2.x+(lx-gk2.x)/(dgk||1)*85; ly=gk2.y+(ly-gk2.y)/(dgk||1)*85; }
      GKSTAT.laneCover=(GKSTAT.laneCover||0)+1;
      steer(p,lx,ly,1.2);
      return true;
    } },

  // ── NOBODY TO COVER ───────────────────────────────────────────────────────
  // The same situation with no outlets left to stand in front of — a side down to its keeper.
  // He holds the middle, which is the only useful thing left to do.
  { name:'holding the middle', tier:TIER.PLAYER, base:570,
    applies:p => !!(gkHolding() && ball.owner && p.team!==ball.owner.team && p.role!=='K'
                    && !allied(p.team, ball.owner.team) && p.role!=='D'
                    && !players.some(m=>m.team===ball.owner.team && m.role!=='K' && !m.out && !m.sentOff)),
    score:p => 570,
    act:p => { steer(p,CX,CY,0.9); return true; } },

  // ── RECEIVING LANES AT A THROW ────────────────────────────────────────────
  // The taker's own side while play is held. Staggered infield: a per-player lateral spread of
  // 260 and a depth between 70 and 165, both from stable hashes — so five men offer five
  // DIFFERENT options rather than shuffling along the line together.
  //
  // This is the same trick as lane-covering. Two hashes, no communication, and a shape.
  // NOT explicit. Offering yourself is a CHOICE — the same call I made for "showing for a throw"
  // and then contradicted here. Marked explicit these outranked the gkHolding family by a
  // thousand points during any hold, and the measurements said so immediately: loose 50-61% ->
  // 61-68%, crowding 2.0-2.2 -> 1.5-1.9. Players were abandoning useful positions to go and
  // offer for a throw that had not happened yet.
  { name:'offering a lane', tier:TIER.PLAYER, base:840,
    applies:p => !!(holdingPlay() && pendingRestart && pendingRestart.p
                    && pendingRestart.p!==cornerTaker && pendingRestart.p.role!=='K'
                    && p.team===pendingRestart.team && p!==pendingRestart.p && p.role!=='K'),
    score:p => 840,
    act:p => {
      const rx=pendingRestart.x, ry=pendingRestart.y;
      const inx=CX-rx, iny=CY-ry, il=Math.hypot(inx,iny)||1;
      const nix=inx/il, niy=iny/il, pux=-niy, puy=nix;
      GKSTAT.laneSteer=(GKSTAT.laneSteer||0)+1;
      const lat2=((p.k1*997)%1-0.5)*260;
      const dep2=70+((p.k2*613)%1)*95;
      steer(p, rx+nix*dep2+pux*lat2, ry+niy*dep2+puy*lat2, 1.35);
      return true;
    } },

  // ── AN ALLY OFFERS FROM DEEPER ────────────────────────────────────────────
  // Three-sided again, and a nice piece of design: an allied side offers too, but from 140-230
  // rather than 70-165 and spread wider. They are supplementary outlets ACROSS a battle line —
  // available without crowding the ally whose throw it is.
  { name:'an ally offers deep', tier:TIER.PLAYER, base:830,
    applies:p => !!(holdingPlay() && pendingRestart && pendingRestart.p
                    && pendingRestart.p!==cornerTaker && pendingRestart.p.role!=='K'
                    && p.team!==pendingRestart.team && p.role!=='K'
                    && allied(p.team, pendingRestart.team)),
    score:p => 830,
    act:p => {
      const rx=pendingRestart.x, ry=pendingRestart.y;
      const inx=CX-rx, iny=CY-ry, il=Math.hypot(inx,iny)||1;
      const nix=inx/il, niy=iny/il, pux=-niy, puy=nix;
      const lat5=((p.k1*733)%1-0.5)*330;
      const dep5=140+((p.k2*541)%1)*90;
      steer(p, rx+nix*dep5+pux*lat5, ry+niy*dep5+puy*lat5, 1.15);
      return true;
    } },

  // ── THE CORNER, ALL THREE WAVES ───────────────────────────────────────────
  // The same geometry three times with different depths, which is what a corner looks like from
  // above: attackers flood 30-72 out, defenders pack 16-34 goal-side of them, and an ALLIED third
  // side arrives as a second wave at 62-102, wider than either.
  //
  // COACH tier, all three — a routine. And now that a play is a weight rather than a wall, a man
  // in the box who sees the ball break loose can leave his slot and go for it.
  { name:'flooding the mouth', tier:TIER.COACH, base:120,
    applies:p => !!(holdingPlay() && cornerTaker && pendingRestart
                    && pendingRestart.p===cornerTaker && cornerGoal!==null
                    && p!==cornerTaker && p.role!=='K' && p.team===pendingRestart.team),
    score:p => 120,
    act:p => {
      const g4=goalCenter(cornerGoal), e4=EDGES[GOAL_EDGE[cornerGoal]];
      const u4x=-e4.ny, u4y=e4.nx;
      const lat4=((p.k1*883)%1-0.5)*e4.len*GOAL_HALF*1.5;
      const dep4=30+((p.k2*577)%1)*42;
      steer(p, g4.x+e4.nx*dep4+u4x*lat4, g4.y+e4.ny*dep4+u4y*lat4, 1.75);
      return true;
    } },

  { name:'packing the near zone', tier:TIER.COACH, base:118,
    applies:p => !!(holdingPlay() && cornerTaker && pendingRestart
                    && pendingRestart.p===cornerTaker && cornerGoal!==null
                    && p!==cornerTaker && p.role!=='K' && p.team===cornerGoal),
    score:p => 118,
    act:p => {
      const g4=goalCenter(cornerGoal), e4=EDGES[GOAL_EDGE[cornerGoal]];
      const u4x=-e4.ny, u4y=e4.nx;
      const lat4=((p.k1*883)%1-0.5)*e4.len*GOAL_HALF*1.2;
      const dep4=16+((p.k2*577)%1)*18;
      steer(p, g4.x+e4.nx*dep4+u4x*lat4, g4.y+e4.ny*dep4+u4y*lat4, 1.45);
      return true;
    } },

  // An ally turns up to somebody else's corner: wider and deeper than either side contesting it,
  // there to profit from the mess rather than to make it.
  { name:'the second wave', tier:TIER.COACH, base:116,
    applies:p => !!(holdingPlay() && cornerTaker && pendingRestart
                    && pendingRestart.p===cornerTaker && cornerGoal!==null
                    && p!==cornerTaker && p.role!=='K' && p.team!==pendingRestart.team
                    && p.team!==cornerGoal && allied(p.team, pendingRestart.team)),
    score:p => 116,
    act:p => {
      const g4=goalCenter(cornerGoal), e4=EDGES[GOAL_EDGE[cornerGoal]];
      const u4x=-e4.ny, u4y=e4.nx;
      const lat4=((p.k1*733)%1-0.5)*e4.len*GOAL_HALF*1.9;
      const dep4=62+((p.k2*541)%1)*40;
      GKSTAT.allySiege=(GKSTAT.allySiege||0)+1;
      steer(p, g4.x+e4.nx*dep4+u4x*lat4, g4.y+e4.ny*dep4+u4y*lat4, 1.2);
      return true;
    } },

  // ── THE KEEPER HOLDS HIS LINE ─────────────────────────────────────────────
  // Open-field, and the one every match spends most of its time in. He tracks the ball ALONG his
  // own goal line — clamped to 90% of the mouth so he never wanders past a post — and stands 20
  // in front of it. Then, if the ball comes within 55 and is not his side's, he goes for it.
  //
  // Two behaviours in one branch, and the second is the interesting one: a keeper who leaves his
  // line is making a decision, not holding a position.
  { name:'holding the line', tier:TIER.PLAYER, base:400,
    applies:p => p.role==='K' && !p.out && !p.sentOff
              && !(dist(p,ball)<55 && (!ball.owner || ball.owner.team!==p.team)),
    score:p => 400,
    act:p => {
      const e=EDGES[GOAL_EDGE[p.team]];
      let along=(ball.x-e.mx)*e.ux+(ball.y-e.my)*e.uy;
      const lim=e.len*GOAL_HALF*0.9; along=Math.max(-lim,Math.min(lim,along));
      steer(p, e.mx+e.ux*along+e.nx*20, e.my+e.uy*along+e.ny*20, 1.9);
      return true;
    } },

  { name:'coming for it', tier:TIER.PLAYER, base:410,
    applies:p => p.role==='K' && !p.out && !p.sentOff
              && dist(p,ball)<55 && (!ball.owner || ball.owner.team!==p.team),
    score:p => 410,
    act:p => {
      const e=EDGES[GOAL_EDGE[p.team]];
      let along=(ball.x-e.mx)*e.ux+(ball.y-e.my)*e.uy;
      const lim=e.len*GOAL_HALF*0.9; along=Math.max(-lim,Math.min(lim,along));
      steer(p, e.mx+e.ux*along+e.nx*20, e.my+e.uy*along+e.ny*20, 1.9);
      steer(p, ball.x, ball.y, 2.3);
      return true;
    } },

  // ── PROWLING ──────────────────────────────────────────────────────────────
  // The chaser, while play is held: he orbits at 52 rather than standing over the ball. Ten
  // yards, which is the distance a referee gives you — the engine already knew that, and the
  // comment on the branch said "prowl the ten yards".
  //
  // This needed `chaser[]` hoisted out of think() to be extractable at all, which is the
  // structural change this commit is really about.
  { name:'prowling', tier:TIER.PLAYER, base:390,
    applies:p => !!(holdingPlay() && ball.owner && p===chaser[p.team]
                    && ball.owner.team!==p.team && !p.out && !p.sentOff),
    score:p => 390,
    act:p => {
      const dx3=p.x-ball.x, dy3=p.y-ball.y, d3=Math.hypot(dx3,dy3)||1;
      steer(p, ball.x+dx3/d3*52, ball.y+dy3/d3*52, 1.9);
      return true;
    } },

  // ── CLOSING THE BALL DOWN ─────────────────────────────────────────────────
  // The same man when play is NOT held: he leads the ball by six frames rather than chasing
  // where it is, and how hard he presses comes from his side's tactics. Extractable for the same
  // reason — the chaser is now a fact anything can read.
  { name:'closing it down', tier:TIER.PLAYER, base:395,
    applies:p => !!(!holdingPlay() && p===chaser[p.team] && !p.out && !p.sentOff
                    && (!ball.owner || ball.owner.team!==p.team)),
    score:p => 395,
    act:p => {
      steer(p, ball.x+ball.vx*6, ball.y+ball.vy*6, 2.15+0.4*T(p.team).press);
      return true;
    } },

  // ── THE BACK LINE ─────────────────────────────────────────────────────────
  // Where a defender stands when he is not chasing: on the line from his own goal to the ball,
  // at a fraction set by his side's LINE tactic — and the two centre-backs sit 34 either side of
  // that point so they hold a width rather than stacking.
  //
  // The bunker variant is folded in rather than being its own instruction: it is the same act at
  // a different depth, which is what a tactic should do to a position.
  { name:'the back line', tier:TIER.PLAYER, base:380,
    applies:p => p.role==='D' && !p.out && !p.sentOff && targets[p.team]!==null
              && p!==chaser[p.team],
    score:p => 380,
    act:p => {
      const own=goalCenter(p.team), TT=T(p.team);
      // onPitch: a sent-off defender still in the array shifted every remaining man's slot,
      // so a back four became a back three standing in the wrong three places.
      const ds=players.filter(q=>q.team===p.team&&q.role==='D'&&onPitch(q));
      const idx=ds.indexOf(p), lineShift=(TT.line-0.5)*0.22;
      let f=(idx===0?0.38:0.62)+lineShift;
      if(TT.bunker>0.5) f=(idx===0?0.28:0.48)+lineShift*0.5;
      const bx=own.x+(ball.x-own.x)*f, by=own.y+(ball.y-own.y)*f;
      const e=EDGES[GOAL_EDGE[p.team]];
      steer(p, bx+e.ux*(idx===0?34:-34), by+e.uy*(idx===0?34:-34), 2.0);
      return true;
    } },

  // ── FINDING SPACE ─────────────────────────────────────────────────────────
  // Everybody else: a point between the ball and the goal they are attacking, at a fraction set
  // by role and by the DIRECT tactic — and then fanned sideways, midfielders one way and forwards
  // the other.
  //
  // THE SPREAD IS THE GOOD PART. It grows as the ball nears the target goal: 55 normally, up to
  // 158 when play compresses into the last 230. Width instead of pile-in, and it is the reason a
  // crowded box does not become a scrum of everybody.
  { name:'finding space', tier:TIER.PLAYER, base:370,
    applies:p => (p.role==='M'||p.role==='F') && !p.out && !p.sentOff
              && targets[p.team]!==null && p!==chaser[p.team]
              && !(T(p.team).bunker>0.5),
    score:p => 370,
    act:p => {
      const tgt=goalCenter(targets[p.team]), TT=T(p.team);
      const f=p.role==='M'?0.45:(0.72+(TT.direct-0.5)*0.26);
      let sx=ball.x+(tgt.x-ball.x)*f, sy=ball.y+(tgt.y-ball.y)*f;
      const side=(p.role==='M'?1:-1);
      const dBallGoal=dist(ball,tgt);
      const spread=55+Math.max(0,(230-dBallGoal))*0.45;
      const ang=Math.atan2(tgt.y-ball.y,tgt.x-ball.x)+Math.PI/2;
      sx+=Math.cos(ang)*spread*side; sy+=Math.sin(ang)*spread*side;
      steer(p,sx,sy,2.0);
      return true;
    } },

  // ── CARRYING IT ───────────────────────────────────────────────────────────
  // The man on the ball, and the last big thing in the cascade. Three forces added together
  // rather than three branches choosing between them, which is why it never looked like a
  // decision:
  //
  //   toward the goal he is attacking      the direction he wants to go
  //   away from his nearest opponent       only inside 60, weighted 0.9 — a shoulder-drop
  //   away from the nearest wall           inside 95, weighted 1.6, UNLESS that wall is the
  //                                        mouth he is shooting at
  //
  // THE MOUTH EXCEPTION IS THE GOOD PART. Every other boundary pushes him infield; the one he
  // is attacking does not, or he would swerve away from goal at the moment of shooting. That is
  // one condition doing the work of an entire "should I shoot" branch.
  { name:'carrying it', tier:TIER.PLAYER, base:420,
    applies:p => ball.owner===p && !p.out && !p.sentOff && targets[p.team]!==null,
    score:p => 420,
    act:p => {
      const tgt=goalCenter(targets[p.team]);
      let near=null,nd=1e9;
      players.forEach(o=>{ if(o.team!==p.team&&!o.out&&!o.sentOff){ const d=dist(o,p); if(d<nd){nd=d;near=o;} } });
      let dx=tgt.x-p.x, dy=tgt.y-p.y; const dl=Math.hypot(dx,dy)||1; dx/=dl; dy/=dl;
      if(near&&nd<60){ dx+=(p.x-near.x)/nd*0.9; dy+=(p.y-near.y)/nd*0.9; }
      let wd=1e9,we=null;
      for(const e2 of EDGES){ const d2=(p.x-e2.p1.x)*e2.nx+(p.y-e2.p1.y)*e2.ny; if(d2<wd){wd=d2;we=e2;} }
      const inMouth=we&&we.goal&&we===EDGES[GOAL_EDGE[targets[p.team]]]&&
        Math.abs((p.x-we.mx)*we.ux+(p.y-we.my)*we.uy)<we.len*GOAL_HALF*1.3;
      const wallR=oobRule?95:70, wallW=oobRule?1.6:1.1;
      if(wd<wallR&&!inMouth){ const w=(wallR-wd)/wallR*wallW; dx+=we.nx*w; dy+=we.ny*w; }
      steer(p,p.x+dx*80,p.y+dy*80,2.05);
      return true;
    } },

  // ── VULTURES WITH PATIENCE ────────────────────────────────────────────────
  // The third side at somebody else's restart, when it is not their business at all. They hold a
  // counter station 85% of the way from their own goal to the centre — near midfield, out of the
  // mess, and perfectly placed for whatever comes loose.
  //
  // The comment in the cascade called them "vultures with patience" and I have kept the name,
  // because it describes the tactic better than anything I would have written.
  { name:'vultures with patience', tier:TIER.COACH, base:110,
    applies:p => !!(holdingPlay() && pendingRestart && p.role!=='K' && !p.out && !p.sentOff
                    && p.team!==pendingRestart.team
                    && !allied(p.team, pendingRestart.team)
                    && !(cornerGoal!==null && p.team===cornerGoal)),
    score:p => 110,
    act:p => {
      const og4=goalCenter(p.team);
      steer(p, og4.x+(CX-og4.x)*0.85, og4.y+(CY-og4.y)*0.85, 1.0);
      return true;
    } },

  // ── SWEEPING ──────────────────────────────────────────────────────────────
  // A keeper leaving his line for a loose ball — but only when he can genuinely get there first:
  // 18 clear of the nearest opponent, or nobody within 120. That margin is the whole instruction,
  // and it is why this does not read as a keeper wandering.
  //
  // He spends burst on it, which makes it a commitment rather than a drift.
  { name:'sweeping', tier:TIER.PLAYER, base:415,
    applies:p => {
      if(p.role!=='K'||p.out||p.sentOff||ball.owner||holdingPlay()) return false;
      const og2=goalCenter(p.team);
      if(dist(ball,og2)>=190) return false;
      let oppNear=1e9;
      players.forEach(q=>{ if(q.team!==p.team&&!q.out&&!q.sentOff) oppNear=Math.min(oppNear,dist(q,ball)); });
      return dist(p,ball)<oppNear-18 || oppNear>120;
    },
    score:p => 415,
    act:p => {
      if(!p.sprint&&p.burst>0.25){
        p.sprint={why:'sweep',blaze:RNG_COS()<0.12};
        GKSTAT.b_sweep=(GKSTAT.b_sweep||0)+1;
        if(p.sprint.blaze) blazeCall(p);
      }
      steer(p,ball.x,ball.y,1.5);
      return true;
    } },

  // ── PUSHING UP FOR THE KEEPER ─────────────────────────────────────────────
  // His own keeper has the ball and is about to send it somewhere. They push away from their own
  // goal — on a hex that is the only direction that means anything — so there is an outlet to
  // aim at. Added inline this morning when I made keepers clear their lines; it belongs here.
  { name:'pushing up', tier:TIER.PLAYER, base:360,
    applies:p => !!(ball.owner && ball.owner.role==='K' && ball.owner.team===p.team
                    && p!==ball.owner && !p.out && !p.sentOff
                    && Math.hypot(p.x-goalCenter(p.team).x, p.y-goalCenter(p.team).y)<210),
    score:p => 360,
    act:p => {
      const og9=goalCenter(p.team);
      const ax=p.x-og9.x, ay=p.y-og9.y, al9=Math.hypot(ax,ay)||1;
      steer(p, og9.x+ax/al9*250, og9.y+ay/al9*250, 1.9);
      return true;
    } },

  // ── AFTER A GOAL: FETCH IT ────────────────────────────────────────────────
  // SCRIPT. Whoever was nearest goes and gets the ball, whatever shirt he is wearing — which is
  // what actually happens, and it is often not the side taking the kick-off.
  { name:'retrieving after a goal', tier:TIER.SCRIPT, base:950,
    applies:p => !!(goalRestart && goalRestart.fetcher===p && !p.out && !p.sentOff),
    score:p => 950,
    act:p => { steer(p, ball.x, ball.y, 2.4); return true; } },

  // ── AFTER A GOAL: TAKE THE KICK-OFF ───────────────────────────────────────
  // SCRIPT. The man who will restart it walks to the spot and waits, which is why the ball
  // arriving at the centre should meet somebody rather than a bare patch of grass.
  { name:'walking to the spot', tier:TIER.SCRIPT, base:945,
    applies:p => !!(goalRestart && goalRestart.taker===p && !p.out && !p.sentOff),
    score:p => 945,
    act:p => { steer(p, CX-8, CY, 2.2); return true; } },

  // ── AFTER A GOAL: EVERYBODY ELSE ──────────────────────────────────────────
  // SCRIPT, and the reason the whole thing is one: fifteen players walking into a formation is
  // choreography, not fifteen decisions that happen to agree.
  //
  // Each side gathers in ITS OWN THIRD of the hex — the third containing its own goal — spread
  // laterally by the same stable hash the corner waves use, so a formation forms without anybody
  // being told a slot.
  { name:'taking up position', tier:TIER.SCRIPT, base:940,
    applies:p => !!(goalRestart && goalRestart.fetcher!==p && goalRestart.taker!==p
                    && !p.out && !p.sentOff && p.role!=='K'),
    score:p => 940,
    act:p => {
      const own=goalCenter(p.team);
      const ax=CX-own.x, ay=CY-own.y, al=Math.hypot(ax,ay)||1;
      const px=-ay/al, py=ax/al;
      const lat=((p.k1*911)%1-0.5)*180;
      const dep=0.45+((p.k2*631)%1)*0.25;          // 45-70% of the way to the middle
      steer(p, own.x+ax*dep+px*lat, own.y+ay*dep+py*lat, 2.0);
      return true;
    } },

  // ── WAITING OUT A SENDING-OFF ─────────────────────────────────────────────
  // A man is walking to the bench and the other fourteen stood exactly where the foul left them.
  // A sending-off is thirty seconds of dead time and it looked like a freeze-frame with one man
  // moving through it.
  //
  // They take up their kick-off shape while he goes — the same positions as after a goal, which
  // is right, because the same thing happens next. SCRIPT: nobody is deciding this.
  { name:'waiting out a sending-off', tier:TIER.SCRIPT, base:930,
    applies:p => !!(walking && walking!==p && !p.out && !p.sentOff && p.role!=='K'),
    score:p => 930,
    act:p => {
      const own=goalCenter(p.team);
      const ax=CX-own.x, ay=CY-own.y, al=Math.hypot(ax,ay)||1;
      const px=-ay/al, py=ax/al;
      const lat=((p.k1*911)%1-0.5)*180;
      const dep=0.45+((p.k2*631)%1)*0.25;
      steer(p, own.x+ax*dep+px*lat, own.y+ay*dep+py*lat, 1.6);   // no hurry; he has a walk to finish
      return true;
    } },

  // ── HE HAS JUST SWUNG IT IN ───────────────────────────────────────────────
  // What a corner taker does after delivering, which is not "not chase". He drops to the edge of
  // the box — wide of the mess, square to it, and behind the flight — which is where the second
  // ball goes and where he can actually do something about it.
  //
  // This replaces a `noChase` flag. A flag that says what a player is NOT doing is not an
  // instruction, it is a hole where one should be: it also stopped working the moment anybody
  // claimed the ball, which for a corner is about a second.
  //
  // Four seconds, then he is an ordinary footballer again.
  { name:'dropping to the edge', tier:TIER.COACH, base:126,
    applies:p => !!(justDelivered && justDelivered.p===p && clockSec-justDelivered.at<4
                    && cornerGoal!==null && onPitch(p)),
    score:p => 126,
    act:p => {
      const g=goalCenter(cornerGoal), e=EDGES[GOAL_EDGE[cornerGoal]];
      const ux=-e.ny, uy=e.nx;
      // the side he swung it from, so he covers his own flank rather than crossing the box
      const side=((p.x-g.x)*ux+(p.y-g.y)*uy)>=0?1:-1;
      steer(p, g.x+e.nx*128+ux*side*66, g.y+e.ny*128+uy*side*66, 2.0);
      return true;
    } },

  // ── CARRYING IT TO THE MARK ───────────────────────────────────────────────
  // THE MISSING HALF OF THE FETCH. `fetching the ball` walks him to a loose ball and sets
  // `got` — and then stops applying. Nothing else did. He stood holding it until the 20-second
  // cap voided the restart, and play was frozen for the whole time.
  //
  // That is John's throw-in freeze: 11.4 seconds measured on one seed, and he watched it happen
  // in the browser and described it as stalling at the sideline. It was not stalling at the line;
  // it was standing wherever the ball happened to be, with no next instruction.
  //
  // The ball rides with him — a fetched ball is carried, not dribbled — and goes down on the mark
  // when he arrives. THE MARK IS THE ONE THING HE MUST GET RIGHT: put it down anywhere else and
  // the throw is taken from the wrong place, which is the other half of what John saw.
  { name:'just restarted \u2014 offering', tier:TIER.PLAYER, base:700,
    applies:p => !!(p.noChase && clockSec<p.noChase && !(ball.owner && ball.owner!==p)),
    score:p => 700,
    act:p => {
      const bx=ball.x-p.x, by=ball.y-p.y, bl=Math.hypot(bx,by)||1;
      const ix=CX-p.x, iy=CY-p.y, il=Math.hypot(ix,iy)||1;
      steer(p, p.x+ix/il*40, p.y+iy/il*40, 1.6);
      p.hx=bx/bl; p.hy=by/bl;
      return true;
    } },

  // ── CHASING AT PACE ───────────────────────────────────────────────────────
  // The sprint. It went with the cascade and nothing replaced it, so since that cut NOBODY IN
  // THE GAME HAS RUN — burst is spent by the dive, the sweep and the power shot, and by nothing
  // that moves a man.
  //
  // An instruction rather than an action, by our own boundary rule: this is a decision about
  // WHERE HE GOES AND HOW FAST, not about what he does with the ball. It is `closing it down`
  // with the handbrake off.
  //
  // WHEN IT IS WORTH IT is the whole instruction. A loose ball he can reach before anybody else,
  // or one he is losing a race for by a little. Not a ball already lost, and not one he will
  // reach walking — a sprint is a bet, and burst is what he pays.
  { name:'chasing at pace', tier:TIER.PLAYER, base:398,
    applies:p => {
      if(!onPitch(p) || p.role==='K' || ball.owner || holdingPlay()) return false;
      if(p.burst <= 0.35) return false;                  // no legs
      if(p !== chaser[p.team]) return false;             // one man per side
      const d=dist(p,ball);
      if(d < 30 || d > 190) return false;                // not a walk, not a hopeless case
      // is it a race? somebody else within a stride of my distance
      let rival=1e9;
      players.forEach(q=>{ if(q.team!==p.team && onPitch(q)) rival=Math.min(rival, dist(q,ball)); });
      return rival < d + 40;                             // close enough to be worth the legs
    },
    score:p => 398 + (1-Math.min(1,dist(p,ball)/190))*40,   // keener the closer he is
    act:p => {
      if(!p.sprint && p.burst>0.35){
        p.sprint={why:'chase', blaze:RNG_COS()<0.10};
        p.burst -= 0.35;
        GKSTAT.b_chase=(GKSTAT.b_chase||0)+1;
        if(p.sprint.blaze) blazeCall(p);
      }
      const lead=6;
      steer(p, ball.x+ball.vx*lead, ball.y+ball.vy*lead, 2.6);
      return true;
    } },

  // ── OFFERING AFTER A RESTART ──────────────────────────────────────────────
  // NOT explicit: he has taken it and is choosing to make himself available rather than chase.
  // Released by POSSESSION — the moment anybody else has the ball he is a player again — with
  // the clock only as a floor so a throw that runs loose does not strand him.
  { name:'just restarted \u2014 offering', tier:TIER.PLAYER, base:700,
    applies:p => !!(p.noChase && clockSec<p.noChase && !(ball.owner && ball.owner!==p)),
    score:p => 700,
    act:p => {
      const bx=ball.x-p.x, by=ball.y-p.y, bl=Math.hypot(bx,by)||1;
      const ix=CX-p.x, iy=CY-p.y, il=Math.hypot(ix,iy)||1;
      steer(p, p.x+ix/il*40, p.y+iy/il*40, 1.6);
      p.hx=bx/bl; p.hy=by/bl;
      return true;
    } },
];

// I TRIED MAKING THE CASCADE A COMPETITOR with a base score, on the reasoning that a man on it
// carried no commitment. It made things twice as bad — 30.8 switches per player per second
// against 11.4 — because every instruction's base outranks any floor you can give it, so the
// cascade won only when nothing applied, exactly as before, and the extra comparison added
// nothing but churn. Reverted.
/** Score every instruction that applies, favour the one he is on, run the winner. */
function runInstruction(p){
  let best=null, bestScore=-1e9;
  for(const I of INSTRUCTIONS){
    if(!I.applies(p)) continue;
    // Tier plus the instruction's own score, UNCLAMPED — clamping would make every band a wall,
    // and the bottom two are meant to be crossable.
    let sc=(I.tier||TIER.PLAYER) + I.score(p);
    if(p.job===I.name) sc+=COMMIT;               // and he sticks with what he is doing
    if(sc>bestScore){ bestScore=sc; best=I; }
  }
  if(!best) return false;                        // the cascade won, fairly
  job(p, best.name, best.tier);
  return best.act(p)!==false;
}

function think(dt){
  players.forEach(pb=>{
    if(pb.out) return;
    const bcap=0.35+0.65*pb.stamina;               // the tank caps the meter
    if(pb.sprint){
      pb.burst-=dt/BURST_BURN;
      if(pb.burst<=0){ pb.burst=0; pb.sprint=null; }   // ran the well dry
    } else pb.burst=Math.min(bcap, pb.burst+dt/BURST_RECHG);
  });
  const owner=ball.owner;
  const holdActive=nowMs()<restartHold;   // restart staging: ball dead, positioning live
  const FL=[fieldersLeft(0),fieldersLeft(1),fieldersLeft(2)];   // cached: avoids per-player array filters
  for(let a2=0;a2<3;a2++) coalAlly[a2]=allied(a2,(a2+1)%3)||allied(a2,(a2+2)%3);
  if(gkHolding()){
    GKSTAT.scrumSamples++;
    players.forEach(q=>{ if(q.team!==ball.owner.team&&!q.out&&!q.sentOff&&q.role!=="K"&&dist(q,ball.owner)<55)GKSTAT.scrumOpp++; });
  }
  const oppOf=t=>players.filter(p=>p.team!==t&&!p.out&&!p.sentOff);
  // computed here as before, but into the shared array rather than a local
  for(let t=0;t<3;t++){
    let best=null,bd=1e9;
    players.forEach(p=>{ if(p.team===t&&(p.role!=="K"||FL[t]===0)&&!p.out&&!p.sentOff){const d=dist(p,ball); if(d<bd){bd=d;best=p;}}});
    chaser[t]=best;
  }
  // settle last frame's job before this frame's decisions overwrite it
  players.forEach(p=>{ if(!p.out&&!p.sentOff) jobSettled(p); });

  players.forEach(p=>{
    if(p.out||p.sentOff||targets[p.team]===null)return;

    // ── THE FLIP ──────────────────────────────────────────────────────────────
    // A fired action ends his frame; a declined one leaves him free, which is most frames.
    if(runAction(p)) return;

    // ── THE LIST DECIDES; THE CASCADE IS THE FALLBACK ────────────────────────
    // This call sat at the END of five hundred lines of cascade, so every cascade branch ran
    // first and returned, and the instruction list only ever saw what fell through.
    //
    // THE INSTRUCTIONS WERE THE FALLBACK AND THE CASCADE WAS THE GAME. John saw cascade players
    // completing matches, chasing and passing — that is exactly what they were doing: the whole
    // of football, in branches I believed I had replaced.
    //
    // One line, moved to the top. Anything the list declines still falls through to whatever
    // remains below, so nothing is lost — but the list is asked first.
    if(runInstruction(p)) return;

    // ── AND IT GOES BACK BEHIND THE SIXTEEN ───────────────────────────────────
    // Moving it to the top was the right experiment and the answer was chaos. Normalised per
    // player per second — which is the only way these numbers compare — switching went 1.2 -> 11.4
    // -> 30.8, and thirty a second is one every other frame. That is not indecision, it is noise.
    //
    // WHY: the sixteen branches ahead of it were doing stabilising work I had not credited them
    // with. want-detection carries real hysteresis — sprintMin, deniedLatch — and by jumping the
    // queue the list was taking players out of a system that already knew how to hold a decision
    // and putting them in one that did not.
    //
    // So the list stays behind them until its instructions have hysteresis of their own. COMMIT
    // is not hysteresis: it favours the current choice by a constant, where want-detection
    // enforces a MINIMUM TIME before reconsidering. That difference is the whole thing, and it is
    // the next piece to build rather than a number to tune.

    if(pendingRestart){
      const R=pendingRestart;

      // ── THE RESTART CHOREOGRAPHY MOVED TO THE INSTRUCTION LIST ────────────
      // Four instructions now — into the box, marking at a corner, showing for a throw, denying
      // a throw — each named from the steer target that already told you what it did. The block
      // that used to live here is gone rather than duplicated, because two copies of a decision
      // is how they drift apart.
      //
      // They run above via runInstruction(), which is reached before this whole pendingRestart
      // section, so the taker's own branch below is all that is left here.

      // ── THE CASCADE'S RESTART IS GONE ─────────────────────────────────────
    // Sixty-eight lines that survived the main cut and quietly did all the restart work while
    // three extracted instructions sat unused. It did not work either — hovering balls,
    // wandering takers, eleven-second freezes — so this is not a port of it. The instruction
    // list now has a four-stage state machine built from what SHOULD happen.

    }
    // ── THE CASCADE IS GONE, FOR REAL THIS TIME ───────────────────────────
    // 240 lines. Every steer that was not an instruction: the chase, prowling, the back line,
    // finding space, the keeper's line, sweeping, the outlet spread, the bunker, the corner
    // waves. All of it duplicated instructions that were already live.
    //
    // It only stopped mattering when `runInstruction` moved ABOVE it — until then the cascade
    // ran first and returned, and the list was the fallback. Deleting it now is bookkeeping
    // rather than surgery, which is what John asked for two attempts ago and is only true now.
    //
    // If an instruction declines, the player keeps his velocity and coasts. That is the
    // fallback, it is two lines, and it does nothing on purpose.
  });
  // separation (gentler, timestep-scaled)
  const sepS=Math.min(1,dt*60);
  for(let i=0;i<players.length;i++)for(let j=i+1;j<players.length;j++){
    const a=players[i],b=players[j];
    if(a.out||b.out)continue;
    const d=dist(a,b);
    if(d<26&&d>0.01){const push=(26-d)/26*0.45*sepS, dx=(a.x-b.x)/d, dy=(a.y-b.y)/d;
      a.vx+=dx*push;a.vy+=dy*push;b.vx-=dx*push;b.vy-=dy*push;}
  }
  // owner decisions
  // AND ONLY IF HE STILL HAS IT. `owner` is captured before the player loop; an action may have
  // taken the ball since. A block that reasons about a man in possession is wrong the moment he is
  // not in possession — that is the whole crash, in one condition.
  // ── THE CASCADE IS GONE ─────────────────────────────────────────────────────
    //
    // 495 lines. Every kick, every shot, every keeper decision, every foul — all of it now lives
    // in ACTIONS, decided by can/score/act and weighted by the coach.
    //
    // It was left in place through the whole port "in case", and that was the mistake: with
    // something to fall through to, PLAY_ON_WEIGHT could sit at 60,000 and the actions could fire
    // on 0.6% of frames while the game looked fine. Three hours of measurement went into the
    // cascade while I believed it was going into the transplant.
    //
    // What moved out of here on the way:
    //   the twelve kicks        -> the ported actions
    //   gkDiveCheck             -> the keeper's own `dive`
    //   the tackle              -> `tackle`, with incidental fouls inside it
    //   gkHolder / gkHoldUntil  -> `secure it` sets, the distributions clear
    //   suppress                -> `tackle`, which is the only thing that caused it
    //   penaltyShooter=null     -> the `penalty` action
    //
    // Nothing falls through now. If an action does not fire, the ball sits — and that is visible
    // in the first match rather than three hours later.

}

// ---------- Physics ----------
function physics(dt){
  const S=dt*60;
  // WHERE IT WAS. Any test that asks "did it cross" needs the previous position, and nothing was
  // keeping one — which is why the woodwork could only ever ask "is it inside a band".
  ball.px=ball.x; ball.py=ball.y; ball.pz=ball.z;
  stepJumps(S);          // heads move before anybody reaches with one
  stepBench();           // and the disgraced watch from the side
  stepRestartWatchdog(); // and no restart may hang the match
  stadiumWall();         // and it cannot leave the ground at all
  ballOutOfPlayCheck();  // outside is out of play, however it got there
  players.forEach(p=>{
    if(p.out)return;
    const pv=Math.hypot(p.vx,p.vy);
    // A KEEPER WATCHES THE BALL. Heading came only from velocity, so anyone standing still kept
    // whichever way they last walked — and a keeper stands still more than anybody on the pitch,
    // which is why they always seemed to be staring off to one side while play came at them.
    //
    // Outfielders still take their heading from movement: they face where they are going, which
    // is right, and a player who turns to watch the ball while running backwards looks wrong.
    // The keeper is the one position whose job is to face the ball rather than the run.
    if(p.role==="K"){
      const bx=ball.x-p.x, by=ball.y-p.y, bl=Math.hypot(bx,by);
      if(bl>1){ p.hx=p.hx*0.82+(bx/bl)*0.18; p.hy=p.hy*0.82+(by/bl)*0.18; }
    }
    else if(pv>0.15){ p.hx=p.hx*0.85+(p.vx/pv)*0.15; p.hy=p.hy*0.85+(p.vy/pv)*0.15; }
    p.x+=p.vx*S; p.y+=p.vy*S;
    const staging=(pendingRestart&&pendingRestart.p===p)||cornerTaker===p||throwPending===p;
    if(!p.sentOff&&!staging) clampInside(p, p.role==="K"?12:14);
    const v=Math.hypot(p.vx,p.vy), effort=v/2.35;
    p.stamina-=effort*effort*0.0012*S*(0.85+0.5*T(p.team).press*(coalAlly[p.team]?0.7:1));
    p.stamina+=0.0004*S;
    p.stamina=Math.max(0,Math.min(1,p.stamina));
  });
  // hard body collision: players are solid — resolve overlaps positionally (2 passes)
  if(zoneRule){
    players.forEach(p=>{ if(p.out||p.sentOff)return;
      for(let t=0;t<3;t++){ if(t===p.team)continue;
        const g=goalCenter(t);
        if(dist(ball,g)<110)continue;            // ball is in — the zone is open
        if(ball.z>4&&dist(ball,g)<260&&((g.x-ball.x)*ball.vx+(g.y-ball.y)*ball.vy)>0)continue; // timed run: the cross is inbound
        const d=dist(p,g);
        if(d<112){ p.x=g.x+(p.x-g.x)/(d||1)*112; p.y=g.y+(p.y-g.y)/(d||1)*112; }
      }
    });
  }
  const BODY=23;
  for(let pass=0;pass<2;pass++){
    for(let i=0;i<players.length;i++)for(let j=i+1;j<players.length;j++){
      const a=players[i],b=players[j];
      if(a.out||b.out)continue;
      const dx=a.x-b.x, dy=a.y-b.y, d=Math.hypot(dx,dy);
      if(d<BODY&&d>0.01){
        const push=(BODY-d)/2, ux=dx/d, uy=dy/d;
        a.x+=ux*push; a.y+=uy*push; b.x-=ux*push; b.y-=uy*push;
      }
    }
    players.forEach(p=>{ if(!p.sentOff&&!((pendingRestart&&pendingRestart.p===p)||cornerTaker===p||throwPending===p)) clampInside(p, p.role==="K"?12:14); });
  }
  if(ball.owner){
    // THE BALL WAITS WHERE IT WAS PUT, and the taker stands by it. A throw pins it to the mark;
    // a corner had NO SUCH PIN, so the ball followed its owner — which is why moving the corner
    // taker outside the line dragged the ball out with him and collapsed corners to one a match.
    //
    // cornerPending is that pin. Same idea, ball on the ground: it does not move until he takes
    // it, and where he stands is then his own business.
    if(throwPending===ball.owner){ ball.vx=0; ball.vy=0; return; }   // the ball waits ON THE CHALK
    if(cornerPending===ball.owner){ ball.vx=0; ball.vy=0; ball.z=0; ball.zv=0;
      if(cornerSpot){ ball.x=cornerSpot.x; ball.y=cornerSpot.y; }    // pinned to the corner itself
      return; }
    // A free kick pins the same way. The ball is dead on the spot until he strikes it.
    if(freeKick && freeKick.taker===ball.owner){
      ball.x=freeKick.x; ball.y=freeKick.y; ball.vx=0; ball.vy=0; ball.z=0; ball.zv=0;
      return; }
    const o=ball.owner, v=Math.hypot(o.vx,o.vy);
    stats.poss[o.team]+=S;
    if(v>0.1){ o.hx=o.hx*0.85+(o.vx/v)*0.15; o.hy=o.hy*0.85+(o.vy/v)*0.15; }
    const hl=Math.hypot(o.hx,o.hy)||1, hx=o.hx/hl, hy=o.hy/hl;
    // hybrid dribble: the ball is its own body, spring-following the carry point
    const cpx=o.x+hx*15, cpy=o.y+hy*15;
    ball.vx+=(cpx-ball.x)*0.08*S; ball.vy+=(cpy-ball.y)*0.08*S;
    ball.vx*=Math.pow(0.90,S); ball.vy*=Math.pow(0.90,S);
    ball.x+=ball.vx*S; ball.y+=ball.vy*S;
    // A KEEPER MAY NOT CARRY IT OUT OF HIS AREA. Measured over ten minutes: a keeper with the
    // ball was outside his own arc on 97 per cent of the frames he held it, and got as far as
    // 499 from his goal — most of the way to somebody else's. Nothing stopped him, because
    // nothing in the chase logic knows a keeper is different once he has possession.
    //
    // He is held at the arc: he can move anywhere inside it, and the moment he would cross, he
    // is placed back on it. Handing over is his job, and this makes him do it from where a
    // keeper does it.
    if(o.role==="K"){
      const og=goalCenter(o.team);
      const kx=o.x-og.x, ky=o.y-og.y, kd=Math.hypot(kx,ky);
      const AREA=112;
      if(kd>AREA){
        const f=AREA/(kd||1);
        o.x=og.x+kx*f; o.y=og.y+ky*f;
        // My own keeper-area clamp drags the ball 70 per cent of the way back to him, which
        // for a keeper hauled in from 400 out is a jump of nearly 300. Counted now.
        if(Math.hypot(ball.x-o.x,ball.y-o.y)*0.7>25) telPort('keeper hauled back into his area');
        ball.x=o.x+(ball.x-o.x)*0.3; ball.y=o.y+(ball.y-o.y)*0.3;
      }
    }
    // KEEP IT OUT OF HIM. The carry point is 15 ahead, but the ball SPRINGS toward it — so on a
    // turn or a sudden acceleration it lags and passes through the carrier's body. Measured over
    // five minutes: 13 per cent of carried frames had the ball closer than a player's own radius,
    // which in two dimensions is a ball drawn over a shirt and in three is a ball inside a chest.
    //
    // A floor of 13 rather than a repositioning: the ball keeps its own velocity and its own
    // spring, and is only ever pushed back out along the line it already lies on. Nothing about
    // the dribble changes except that the ball stops being swallowed.
    {
      const bx = ball.x - o.x, by = ball.y - o.y, bd = Math.hypot(bx, by);
      const MIN = 13;
      if (bd < MIN) {
        const k = bd > 0.01 ? MIN/bd : 0;
        ball.x = o.x + (bd > 0.01 ? bx*k : hx*MIN);
        ball.y = o.y + (bd > 0.01 ? by*k : hy*MIN);
      }
    }
    ball.touchT-=dt;
    if(ball.touchT<=0 && dist(ball,o)<18){
      // take a touch — long in space, short under pressure
      let pr=1e9; players.forEach(q=>{ if(q.team!==o.team&&!q.out){const d=dist(q,o); if(d<pr)pr=d;}});
      const long=pr>70;
      ball.vx+=hx*(long?3.6:2.2); ball.vy+=hy*(long?3.6:2.2);
      ball.touchT=long?0.75:0.45;
    }
    // heavy touch: the ball got away — it's anyone's now
    if(dist(ball,o)>30){
      ball.strayer=o; ball.strayF=54;
      ball.owner=null; ball.noClaim=o; ball.noClaimF=8;
    }
    if(o.team!==lastPossessTeam){
      if(clockSec-lastPossessComment>6 && lastPossessTeam!==null){
        lastPossessComment=clockSec;
        sayLogged(o.role==="K" ? keeperLine(o) : pick([
          `${o.name} wins it for ${tm(o.team)}.`,
          `${tm(o.team)} on the ball — ${o.name} carries.`,
          `Turnover! ${o.name} takes charge for ${tm(o.team)}.`,
          `New chapter: ${tm(o.team)} in possession through ${o.name}.`,
          `${o.name} gathers, and ${tm(o.team)} start to build.`,
          `The ball changes flags — ${tm(o.team)} have it now.`,
          `${o.name} on it, head up, options everywhere.`,
          `Possession swings to ${tm(o.team)}. The hex spins on.`]));
      }
      lastPossessTeam=o.team;
    }
  } else {
    const px0=ball.x, py0=ball.y;
    ball.x+=ball.vx*S; ball.y+=ball.vy*S;
    ball.vx*=Math.pow(0.985,S); ball.vy*=Math.pow(0.985,S);
    // flight and landing
    if(ball.z>0||ball.zv>0){
      ball.z+=ball.zv*S; ball.zv-=0.14*S;
      if(ball.z<=0){
        ball.z=0; ball.zv=0;
        const near=players.filter(p=>onPitch(p)&&dist(p,ball)<62);
        const teams=new Set(near.map(p=>p.team));
        if(near.length>=2&&teams.size>=2){
          // header duel — highest man wins
          let win=null,wt=0;
          near.forEach(p=>{const w=(1/(dist(p,ball)+8))*(0.6+0.8*RNG()); if(w>wt){wt=w;win=p;}});
          const tgt2=goalCenter(targets[win.team]??win.team);
          ball.lastTouch=win.team; ball.lastKicker=win;
          ENGINE_HOOKS.spawnNote(ball.x,ball.y-24,"header!",TEAMS[win.team].color,TEAMS[win.team].accent);
          if(RNG_COS()<0.4) sayLogged(pick([
            `${win.name} rises highest!`,
            `Up goes ${win.name} — wins it in the air!`,
            `${win.name} climbs above the crowd!`,
            `${win.name} hangs in the air like laundry — and wins it!`,
            `Aerial duel... it's ${win.name} who gets the touch!`,
            `${win.name} out-jumps the lot of them!`,
            `The ball drops into a forest of heads — ${win.name}'s is tallest.`,
            `Meet it? ${win.name} MARRIES it!`,
            `${win.name} rises like something off the mesa — no earthly explanation for that hang time.`]));
          if(targets[win.team]!==null&&dist(ball,tgt2)<160&&win.role!=="K"){
            const e2=EDGES[GOAL_EDGE[targets[win.team]]];
            const off2=(RNG()*2-1)*e2.len*GOAL_HALF*1.35;
            const ddx=tgt2.x+e2.ux*off2-ball.x, ddy=tgt2.y+e2.uy*off2-ball.y, dl2=Math.hypot(ddx,ddy)||1;
            ball.vx=ddx/dl2*8.5; ball.vy=ddy/dl2*8.5; ball.isShot=true;
            stats.shots[win.team]++;
            ENGINE_HOOKS.spawnPing(ball.x,ball.y,TEAMS[win.team].color);
          } else {
            const ddx=tgt2.x-ball.x, ddy=tgt2.y-ball.y, dl2=Math.hypot(ddx,ddy)||1;
            ball.vx=ddx/dl2*5; ball.vy=ddy/dl2*5;
          }
          ball.noClaim=win; ball.noClaimF=10;
        }
      }
    }
    if(ball.noClaimF>0) ball.noClaimF-=S; else ball.noClaim=null;
    if(ball.strayF>0) ball.strayF-=S; else ball.strayer=null;
    let best=null,bd=1e9;
    if(nowMs()<restartHold&&!ball.owner) return;   // dead ball awaits its taker
    if(ball.clearT&&clockSec<ball.clearT) return;            // a clearance in flight escapes the furnace
    players.forEach(p=>{ if(p.out||p.sentOff)return; if(p===ball.noClaim&&ball.noClaimF>0)return;
      if(suppress&&suppress.team===p.team&&clockSec<suppress.until)return;
    if(ball.z>(p.role==="K"?28:12))return;   // sailing over their heads

    // ── A BALL ON A RESTART MARK IS NOT CLAIMABLE ─────────────────────────
    // It is placed and waiting for its taker. Without this the nearest man picks it up — which
    // for a goal kick is the keeper standing beside it — and the restart machine cycles him
    // through carry-and-place forever.
    //
    // Only the taker may touch it, and he does so by taking the restart, not by claiming.
    if(pendingRestart && dist(ball,{x:pendingRestart.x, y:pendingRestart.y}) < 16) return;
      const sx=ball.x-px0, sy=ball.y-py0, sl=sx*sx+sy*sy;
      let t=sl>0?((p.x-px0)*sx+(p.y-py0)*sy)/sl:0;
      t=Math.max(0,Math.min(1,t));
      const d=Math.hypot(p.x-(px0+sx*t), p.y-(py0+sy*t));
      // A KEEPER CAN GO UP. He dives sideways for 23 and stands at 17, and a ball over his head
      // was simply gone — which is wrong for the position and, now that punts reach 76 and the
      // crossbar is a real thing to hit, wrong often.
      //
      // A high ball he is under gets him the same 23 he gets diving, because a jump and a dive
      // are the same act of commitment aimed at different parts of the goal. He is not diving
      // AND jumping: whichever the ball asks for.
      const airborne = p.role==="K" && ball.z>H_HEAD && ball.z<GOAL_H+14;
      // WHATEVER HIS HEAD HAS REACHED. A jumping player's reach grows with his own height, which
      // is the whole design: no table of bonuses, just where he is.
      const lift=p.jz||0;
      const reach=(p.role==="K"
        ? ((p.diveUntil&&clockSec<p.diveUntil)||airborne ? 23 : 17)
        : 13) + lift*0.8;
      if(lift>0 && d<reach) p._gotIt=true;          // so a landing knows it was not wasted
      if(d<reach&&d<bd){bd=d;best=p;}});
    if(best){
      const wasShot=ball.isShot, spd=Math.hypot(ball.vx,ball.vy), kicker=ball.lastKicker;
      const strayer=(ball.strayF>0)?ball.strayer:null;
      if(ball.allyPass&&ball.lastKicker&&best.team!==ball.lastKicker.team&&allied(ball.lastKicker.team,best.team)
        &&RNG()<0.5){
        sayLogged(pick([
          `The alliance is real — ${ball.lastKicker.name} slips it to ${best.name}!`,
          `Enemy of my enemy: ${ball.lastKicker.name} finds ${best.name} across battle lines!`,
          `A pass BETWEEN teams! ${ball.lastKicker.name} to ${best.name} — the leader should worry.`,
          `${ball.lastKicker.name} and ${best.name} wear different shirts and share one grudge.`]),true);
      }
      ball.allyPass=false;
      if(ball.puntBy!==undefined){ GKSTAT.puntSeen++; if(best.team===ball.puntBy)GKSTAT.puntSame++; ball.puntBy=undefined; }
      if(Math.hypot(ball.x-best.x,ball.y-best.y)>25) telPort('claim: ball snapped to the claimer');
      // ── HE MAY NOT PICK UP A BACK-PASS ────────────────────────────────────
      // A keeper cannot handle a ball his own side last played to him — he has to kick it. A real
      // rule, and it was missing entirely: he could gather anything, including a pass from his own
      // defender, and stand there holding it.
      //
      // Recorded rather than enforced by refusing the claim, because refusing would leave the ball
      // loose in his six-yard box and produce a scramble that should not exist. He takes it, and
      // `mustKick` means he cannot HOLD it: the distribution fires immediately.
      if(best.role==='K' && ball.lastTouch===best.team && ball.lastKicker
         && ball.lastKicker.team===best.team && ball.lastKicker.role!=='K'){
        best.mustKick = true;
        TEL.backPass++;
      } else if(best.role==='K') best.mustKick = false;
      // A BALL BEING CARRIED TO A MARK CANNOT BE CLAIMED. The fetcher reached it, picked it up,
      // and somebody else took it off him on the next frame — so he dropped back to fetching and
      // chased it for the rest of the match. That is why John saw "nobody went to fetch it": he
      // went, arrived, and the ball left.
      //
      // A restart is not a contest. Nobody tackles a man carrying the ball to a throw-in.
      if(ball.fetch && ball.fetch.by && ball.fetch.by!==best) return;
      ball.owner=best; ball.lastTouch=best.team; ball.x=best.x; ball.y=best.y; ball.isShot=false;
      if(ball.flameShot&&best.role==="K") ENGINE_HOOKS.spawnNote(best.x,best.y-24,"🔥 extinguished!","#ffd166");
      ball.flameShot=false;
      // EVERY claim by ANYBODY, which is what this has always counted. I put it in the report
      // labelled "keeper claims" and it read as 199 keeper touches in 170 seconds — a number that
      // looked alarming and was simply mislabelled. 199 possession changes in 170 seconds is
      // ordinary football, which is why nothing looked wrong to somebody watching.
      GKSTAT.claims=(GKSTAT.claims||0)+1; TEL.claims++;
      if(best.role==="K") TEL.gkClaims++;
      if(clockSec-(GKSTAT.lastClaimAt||-9)<0.45
         && Math.hypot(ball.x-(GKSTAT.lastClaimX||-999),ball.y-(GKSTAT.lastClaimY||-999))<70)
        { GKSTAT.rapid=(GKSTAT.rapid||0)+1;   // scramble signature: fast AND same spot
        TEL.rapid++; if(best.role==="K") TEL.gkRapid++; }
      GKSTAT.lastClaimAt=clockSec; GKSTAT.lastClaimX=ball.x; GKSTAT.lastClaimY=ball.y;
      if((typeof __NOCLEAR==="undefined")&&best.role!=="K"&&nowMs()>=restartHold){
        // CONFIDENT CLEAR: two+ wolves at the door — boot it out of the scramble first-time
        let wolves=0,wx=0,wy=0;
        players.forEach(q=>{ if(q.team!==best.team&&!q.out&&!q.sentOff&&q.role!=="K"&&dist(q,best)<36){ wolves++; wx+=q.x; wy+=q.y; }});
        if(wolves>=2){
          GKSTAT.clears=(GKSTAT.clears||0)+1;
          let cx9=best.x-(wx/wolves-best.x), cy9=best.y-(wy/wolves-best.y);      // away from the pack
          cx9=best.x+(cx9-best.x)*0.7+(CX-best.x)*0.3*0.4;                       // bent toward safety, not glory
          cy9=best.y+(cy9-best.y)*0.7+(CY-best.y)*0.3*0.4;
          const dl9=Math.hypot(cx9-best.x,cy9-best.y)||1;
          let kx9=best.x+(cx9-best.x)/dl9*260, ky9=best.y+(cy9-best.y)/dl9*260;
          for(const e9 of EDGES){                   // never ask the clearance to leave the pitch
            const de9=(kx9-e9.p1.x)*e9.nx+(ky9-e9.p1.y)*e9.ny;
            if(de9<30){ kx9+=e9.nx*(30-de9); ky9+=e9.ny*(30-de9); }
          }
          for(const e9 of EDGES){                     // a clear NEVER books its own throw-in
            const de9=(kx9-e9.p1.x)*e9.nx+(ky9-e9.p1.y)*e9.ny;
            if(de9<40){ kx9+=e9.nx*(40-de9); ky9+=e9.ny*(40-de9); }
          }
          kick(kx9, ky9, 7.6, false);
          ball.clearT=clockSec+0.4;                            // the escape guarantee: no claims, no headers, just OUT
          if(RNG_COS()<0.18) sayLogged(pick([
            `${best.name} wants none of that scramble — hoofed clear!`,
            `No dwelling from ${best.name}. First time, out of the furnace.`,
            `${best.name} clears ${PRN(best).his} lines. Tidy is for open field.`]),false);
        }
      }
      ball.touchT=0.3; ball.strayer=null; ball.strayF=0;
      ball.lastKicker=best;   // person-level attribution follows possession
      if(strayer && best.team!==strayer.team){
        // won it off the dribbler's touch — positional dispossession
        stam(best,+0.08); stam(strayer,-0.08);
        if(best.role==="K"){
          ENGINE_HOOKS.spawnNote(best.x,best.y-20,"smothered!",TEAMS[best.team].color,TEAMS[best.team].accent);
        } else {
          stats.tackles[best.team]++; best.tackles++;
          ENGINE_HOOKS.spawnNote(best.x,best.y-20,"poked away!",TEAMS[best.team].color,TEAMS[best.team].accent);
        }
      } else
      if(wasShot && best.role==="K" && kicker && best.team!==kicker.team && spd>5){
        // a save: keeper glory, shooter deflation
        stats.saves[best.team]++; best.saves++;
        stam(best,+0.12); stam(kicker,-0.05);
        if(spd>8.5 && RNG()<0.4){
          // parried! pushed wide, not held
          const e2=EDGES[GOAL_EDGE[best.team]];
          const hw3=e2.len*GOAL_HALF;
          const along=(best.x-e2.mx)*e2.ux+(best.y-e2.my)*e2.uy;
          const lat=along>=0?1:-1;                    // push toward the NEARER post
          const need=(hw3+16)-lat*along;              // enough lateral to clear the mouth
          let dx3=e2.ux*lat*need-e2.nx*10, dy3=e2.uy*lat*need-e2.ny*10;
          const dl3=Math.hypot(dx3,dy3)||1;
          ball.owner=null; ball.lastTouch=best.team; ball.lastKicker=best;
          ball.vx=dx3/dl3*spd*0.68; ball.vy=dy3/dl3*spd*0.68;
          ball.noClaim=best; ball.noClaimF=10; ball.isShot=false;
          ENGINE_HOOKS.spawnNote(best.x,best.y-22,"tipped wide!","#ffd166");
          if(RNG_COS()<0.6) sayLogged(pick([
            `${best.name} can only parry it away!`,
            `Strong hands from ${best.name} — pushed wide, still live!`,
            `${best.name} tips it around... danger not cleared!`,
            `Too hot to hold — ${best.name} beats it away!`,
            `${best.name} punches it clear... straight into the chaos!`,
            `Fingertips from ${best.name}! The ball is still loose!`,
            `${best.name} gets SOMETHING on it — scramble on!`]),true);
          return;
        }
        ENGINE_HOOKS.spawnNote(best.x,best.y-20,"SAVE!","#ffd166");
        if(RNG_COS()<0.5) sayLogged(pick([
          `<span class="goal">SAVE!</span> ${best.name} denies ${kicker.name}!`,
          `What a stop by ${best.name} — ${kicker.name} can't believe it!`,
          `${kicker.name} lets fly... ${best.name} gets a strong hand to it!`,
          `${best.name} says NO. Emphatically.`,
          `Robbed! ${kicker.name} had the whole goal and ${best.name} shrank it.`,
          `${best.name} swallows it whole. ${kicker.name} kicks the turf.`,
          `That's a save they'll replay — ${best.name} at full stretch!`,
          `${kicker.name} picks his spot... ${best.name} was already there.`,
          `The wall has a name, and it's ${best.name}.`]),true);
      } else if(kicker && spd>2.2 && best!==kicker){
        if(best.team===kicker.team){
          // completed pass: small lift for both
          stam(kicker,+0.05); stam(best,+0.03);
          if(RNG()<0.22) ENGINE_HOOKS.spawnNote(best.x,best.y-20,"pass ✓",TEAMS[best.team].color,TEAMS[best.team].accent);
        } else if(!wasShot){
          // interception: passer punished, thief energized
          stam(kicker,-0.08); stam(best,+0.06);
          ENGINE_HOOKS.spawnNote(best.x,best.y-20,"intercepted!",TEAMS[best.team].color,TEAMS[best.team].accent);
        }
      }
    }
  }
  // walls & goals
  for(let k=0;k<6;k++){
    const e=EDGES[k];
    const d=(ball.x-e.p1.x)*e.nx+(ball.y-e.p1.y)*e.ny;

    // ── THE CROSSING IS TESTED OUTSIDE THE PROXIMITY GUARD ────────────────────
    // The woodwork test lived INSIDE `if(d<7)`, which is the very band a fast ball skips. So the
    // crossing test I wrote this morning to cure tunnelling was itself sitting behind the
    // tunnelling — it was evaluated 15 times in a whole match, once per goal, always at the frame
    // the goal was awarded and never at the frame the ball actually crossed.
    //
    // A crossing does not care how near the ball is NOW. It cares whether the sign changed.
    {
      const dP = (ball.px!==undefined) ? (ball.px-e.p1.x)*e.nx + (ball.py-e.p1.y)*e.ny : d;
      if(e.goal && dP>0 && d<=0 && !out[GOAL_EDGE.indexOf(k)] && !ball.woodT
         && (ball.isShot||Math.hypot(ball.vx,ball.vy)>4)){
        const tC = dP/Math.max(0.0001, dP-d);
        const aX = (ball.px!==undefined) ? ball.px+(ball.x-ball.px)*tC : ball.x;
        const aY = (ball.py!==undefined) ? ball.py+(ball.y-ball.py)*tC : ball.y;
        const aZ = (ball.pz!==undefined) ? ball.pz+(ball.z-ball.pz)*tC : ball.z;
        const aL = (aX-e.mx)*e.ux + (aY-e.my)*e.uy;
        const half=e.len*GOAL_HALF, R=4.2;
        const hitPost = Math.abs(Math.abs(aL)-half)<R && aZ<GOAL_H;
        const hitBar  = Math.abs(aZ-GOAL_H)<R && Math.abs(aL)<half+R;
        // A COUNTER IN THE ENGINE, not in a patched copy. Three measurements today were built on
        // string anchors that silently failed to match and reported zero — and a zero where zero
        // is expected confirms whatever you already believe. This one cannot miss.
        TEL.wwSeen++;
        TEL.wwNear = Math.min(TEL.wwNear, Math.round(Math.abs(Math.abs(aL)-half)));
        TEL.wwBar  = Math.min(TEL.wwBar,  Math.round(Math.abs(aZ-GOAL_H)));
        if(hitPost||hitBar){
          ball.woodT=clockSec;
          TEL.woodwork++; if(hitBar) TEL.bars++; else TEL.posts++;
          if(hitBar){ ball.zv=-Math.abs(ball.zv)*0.55; }
          else { ball.vx=-ball.vx*0.55; ball.vy=-ball.vy*0.55; }
          ball.isShot=false;
          ENGINE_HOOKS.spawnNote(ball.x,ball.y-24,hitBar?"\u{1F94A} CROSSBAR!":"\u{1F94A} POST!","#ffd166");
        }
      }
    }

    if(d<7){
      const along=(ball.x-e.mx)*e.ux+(ball.y-e.my)*e.uy;
      const gTeam=e.goal?GOAL_EDGE.indexOf(k):-1;
      const inMouth=e.goal && !out[gTeam] && Math.abs(along)<e.len*GOAL_HALF;

      // ── THE WOODWORK ──────────────────────────────────────────────────────
      // Now that the rule and the picture agree about where the frame is, the frame can be HIT.
      // A shot was a goal, a save, or out — never NEARLY, which is most of what makes football
      // worth watching.
      //
      // No new geometry: the post is at |along| == the mouth's half width, the bar is at GOAL_H,
      // and both are the same numbers the goal test already uses. A hit is the ball arriving at
      // the plane within a post's radius of one of them.
      // ── TESTED ON THE CROSSING, NOT THE POSITION ──────────────────────────
      // This asked whether the ball was INSIDE an 8-unit band across the goal plane. A shot
      // travels 8.5 units a frame and a punt 13.5 — so the ball was at d=+4 on one frame and
      // d=-5 on the next, and was never once measured inside the band.
      //
      // ELEVEN MATCHES, ZERO WOODWORK, and I called it rare twice before John pointed out that
      // zero across eleven matches is not rarity. It is textbook tunnelling: a discrete test on
      // a window narrower than one frame of travel.
      //
      // Now it asks whether the ball CROSSED the plane this frame — where it was against where
      // it is — and interpolates the height and the lateral position at the moment of crossing.
      // A window cannot be too narrow if you test the journey instead of the snapshot.
      const dPrev = (ball.px!==undefined)
        ? (ball.px-e.p1.x)*e.nx + (ball.py-e.p1.y)*e.ny
        : d;
      const crossed = dPrev>0 && d<=0;
      const tCross = crossed ? dPrev/Math.max(0.0001, dPrev-d) : 0;
      if(e.goal && !out[gTeam] && crossed && (ball.isShot||Math.hypot(ball.vx,ball.vy)>4) && !ball.woodT){
        const half=e.len*GOAL_HALF, R_POST=4.2;
        // where it was at the instant it met the plane, not where it ended up
        const alongX = (ball.px!==undefined) ? ball.px+(ball.x-ball.px)*tCross : ball.x;
        const alongY = (ball.py!==undefined) ? ball.py+(ball.y-ball.py)*tCross : ball.y;
        const alongC = (alongX-e.mx)*e.ux + (alongY-e.my)*e.uy;
        const zC = (ball.pz!==undefined) ? ball.pz+(ball.z-ball.pz)*tCross : ball.z;
        const offPost=Math.abs(Math.abs(alongC)-half), offBar=Math.abs(zC-GOAL_H);
        const hitPost=offPost<R_POST && zC<GOAL_H;
        const hitBar =offBar<R_POST && Math.abs(alongC)<half+R_POST;
        if(hitPost||hitBar){
          ball.woodT=clockSec;                       // one hit per approach, not one per frame
          TEL.woodwork++;
          const nm=ball.lastKicker?ball.lastKicker.name:"Somebody";
          if(hitBar){
            TEL.bars++;
            // off the bar and DOWN, the way it comes back: vertical speed reversed and bled,
            // and the ball kept live because what happens next is the point of hitting it.
            ball.zv=-Math.abs(ball.zv||2)*0.55;
            ball.vx*=0.45; ball.vy*=0.45;
            sayLogged(pick([
              `<span class="goal">OFF THE BAR!</span> ${nm} is on his knees.`,
              `<span class="goal">CROSSBAR!</span> ${nm} beat the keeper and lost to the woodwork.`,
              `${nm} rattles the bar \u2014 the whole hex heard that one.`,
              `OFF THE UNDERSIDE! It bounces down and the scramble is ON.`,
              `<span class="goal">BAR!</span> An inch lower and ${nm} is a legend.`,
              `${nm} finds the one part of the goal that fights back.`,
              `Woodwork! The bar is still humming and so is ${nm}.`,
              `${nm} hits the top of the frame \u2014 the groundskeeper flinches.`,
              `CROSSBAR! Somewhere a physicist is nodding and ${nm} is not.`,
              `The bar says no. ${nm} asks it politely to reconsider. It does not.`,
              `${nm} strikes it perfectly and the frame strikes back harder.`,
              `OFF THE BAR! Two inches of aluminium between ${nm} and the highlight reel.`]),true);
          } else {
            TEL.posts++;
            // off the post: the sideways component is reversed, so it comes back ACROSS the face
            // rather than straight out — which is where the rebounds people remember come from.
            const sgn=along>0?1:-1;
            const lat=ball.vx*e.ux+ball.vy*e.uy;
            ball.vx-=2*lat*e.ux; ball.vy-=2*lat*e.uy;
            ball.vx+=e.ux*sgn*1.2; ball.vy+=e.uy*sgn*1.2;
            ball.vx-=e.nx*1.6; ball.vy-=e.ny*1.6;    // and back out of the goal
            ball.vx*=0.62; ball.vy*=0.62;
            sayLogged(pick([
              `<span class="goal">OFF THE POST!</span> ${nm} cannot believe it.`,
              `<span class="goal">POST!</span> The width of the paint denies ${nm}.`,
              `${nm} hits the upright \u2014 and it stays live!`,
              `WOODWORK! ${nm} is looking at the sky.`,
              `<span class="goal">POST!</span> ${nm} beat everyone except the geometry.`,
              `It rattles across the face of the goal \u2014 ${nm} had it won.`,
              `${nm} finds the upright, and the upright finds it back.`,
              `POST! The margin was the diameter of a lamp post and ${nm} was on the wrong side of it.`,
              `Off the stick! ${nm} turns away with both hands on his head.`,
              `${nm} strikes it true and the paintwork disagrees.`,
              `UPRIGHT! It stays in, it stays live, and nobody knows where it is going.`,
              `The post. Of all the things ${nm} beat today, the post was not one of them.`]),true);
          }
          ball.isShot=false;
          ENGINE_HOOKS.spawnNote(ball.x,ball.y-24,hitBar?"\u{1F94A} CROSSBAR!":"\u{1F94A} POST!","#ffd166");
          return;                                    // it did not cross; it is still in play
        }
      }
      if(ball.woodT && clockSec-ball.woodT>0.6) ball.woodT=0;

      if(inMouth){
        if(d<-6){
          if(ball.z<GOAL_H){ goalScored(GOAL_EDGE.indexOf(k)); return; }
          else if(ball.isShot){ ENGINE_HOOKS.spawnNote(ball.x,ball.y-20,"over the bar!","#ffd166"); ball.isShot=false; }
          if(oobRule){ outOfBounds(k,e); return; }
        }
      } else if(oobRule){
        if(d<2){
          if(ball.isShot && ball.lastKicker){
            sayLogged(pick([
              `${ball.lastKicker.name} drags it wide!`,
              `Off target — ${ball.lastKicker.name} will want that one back.`,
              `${ball.lastKicker.name} leans back and it sails over!`,
              `Row Z! ${ball.lastKicker.name} tests the crowd's reflexes.`,
              `${ball.lastKicker.name} sends a postcard to the corner flag.`,
              `Wide! The ${TEAMS[ball.lastKicker.team].name} fans behind the goal duck as one.`,
              `${ball.lastKicker.name} built in creative mode there — spectacular, and completely without survival value.`,
              `Wide! The instruments spiked, the ball swerved, and honestly... what IS in that mesa?`,
              `Off it goes — Atlas is already in pursuit somewhere beyond the hoardings.`,
              `Solana's verdict from the royal box: pretty, but the judges require it on target.`,
              `Wide! The Knights who say NI are unimpressed. They wanted a shrubbery anyway.`]));
            ball.isShot=false;
          }
          outOfBounds(k,e); return;
        }
      } else {
        if(ball.isShot && ball.lastKicker){
          sayLogged(pick([
            `${ball.lastKicker.name} drags it wide!`,
            `Off target — ${ball.lastKicker.name} will want that one back.`,
            `${ball.lastKicker.name} shoots... nowhere near it.`,
            `That's closer to the dugout than the goal, ${ball.lastKicker.name}.`,
            `${ball.lastKicker.name} snatches at it — wide and not by a little.`,
            `The shot everyone forgets by full time. Except ${ball.lastKicker.name}.`,
            `${ball.lastKicker.name} with the ambition, not the accuracy.`]));
          ball.isShot=false;
        }
        ball.x+=e.nx*(7-d); ball.y+=e.ny*(7-d);
        const vn=ball.vx*e.nx+ball.vy*e.ny;
        if(vn<0){ ball.vx-=2*vn*e.nx*0.82; ball.vy-=2*vn*e.ny*0.82; }
        ball.vx+=e.nx*0.5; ball.vy+=e.ny*0.5;   // nudge infield so play comes off the wall
      }
    }
  }
}

// ---------- Goal celebration ----------
let celebrateUntil=0, pendingKickoff=null;
let suppress=null, pendingPenalty=null, penaltyShooter=null, penaltyGoalTeam=null;
let stoppageLen=0, stoppageAnnounced=false, zoneRule=true, foulMult=1;
let oobRule=true, cornerTaker=null, cornerGoal=null, restartHold=0, pendingRestart=null, throwPending=null;
let gkHoldUntil=-1, gkHolder=null;
const GKSTAT={holds:0,sweepSec:0,punts:0,puntSame:0,puntSeen:0,rolls:0,rollsFwd:0,scrumSamples:0,scrumOpp:0};
function __forceRules(v){ if(v&&("oob" in v))oobRule=!!v.oob; if(v&&("zone" in v))zoneRule=!!v.zone; }   // headless rules port
function __probe(){ return {GK:GKSTAT, scored:scored?scored.slice():[0,0,0], clockSec,
  EDGES, GOAL_EDGE, players, ball, oob:oobRule, pendingRestart, cornerTaker, phase, champ:champInfo?true:false}; }   // headless measurement port
const gkHolding=()=>ball.owner&&ball.owner===gkHolder&&clockSec<gkHoldUntil;
let camFocusP=null, camFocusUntil=0, walkOff=null, walkPending=null;
let cornerPending=null, cornerSpot=null;   // the corner's own pin, see physics()
let freeKick=null;                         // and the free kick's, see below
function addStoppage(sec){ stoppageLen=Math.min(Math.min(65,matchLen*0.30), stoppageLen+sec); }
const YELLOW_OFFENSES=[
  "cynically confiscated {V}'s shirt as a souvenir",
  "arrived at the tackle three days late",
  "performed a tactical hug on {V}",
  "attempted to check {V}'s pockets for the ball",
  "mistook {V}'s ankles for the ball — twice",
  "described the referee's decision as 'creative fiction'",
  "took {V} down, then briefly claimed to be the victim",
  "treated the shoulder charge as a full-contact art form",
  "asked {V} to hold his drink, then tackled him",
  "applied for planning permission mid-challenge and was denied",
  "offered {V} a guided tour of the turf, face-first",
  "auditioned for a diving competition nobody scheduled",
  "delayed the restart to retie both boots and his life choices",
  "committed a foul so slow the referee aged during it"];
const RED_OFFENSES=[
  "launched a two-footed lunge visible from space",
  "rugby-tackled {V} out of pure nostalgia",
  "attempted a full WWE clothesline — the crowd gasped",
  "challenged {V} to a duel, glove and all",
  "kicked everything except the ball, including the referee's patience",
  "tried to deflate the ball while {V} was still dribbling it",
  "picked {V} up and attempted to file him under 'lost property'",
  "performed a piledriver he'd clearly been saving all season",
  "attempted to trade {V} to another team mid-match, no paperwork",
  "swept {V}'s legs like it was the final of a karate movie",
  "tried to score an own goal with {V}",
  "declared the penalty area sovereign territory and defended the border"];

function goalScored(concederTeam){
  stageGoalRestart(concederTeam, ball.shotBy);
  // A GOAL BELONGS TO WHOEVER SHOT IT, not to whoever touched it last.
  //
  // `lastTouch` was doing both jobs, so any defensive touch on the way in — a keeper's fingertips,
  // a block that deflects rather than stops — handed the goal to the conceding side and the game
  // called it an own goal. That is precisely backwards: a save that fails is still a goal for the
  // striker, and getting a hand to it should not be worse than standing still.
  //
  // A shot from another side inside the last three seconds is the goal's author, whatever it
  // clipped on the way. Beyond that window, or with no shot at all, `lastTouch` decides as before
  // — which is what a genuine own goal looks like: no shot, just somebody putting it in.
  const fresh=(ball.shotBy!==undefined && ball.shotBy!==null &&
               ball.shotBy!==concederTeam && clockSec-(ball.shotAt||-99)<3);
  const scorerTeam=fresh?ball.shotBy:ball.lastTouch;
  const scorer=fresh
    ? (ball.shotByP||null)
    : ((ball.owner&&ball.owner.team===scorerTeam)?ball.owner
      :((ball.lastKicker&&ball.lastKicker.team===scorerTeam)?ball.lastKicker:null));
  if(fresh && ball.lastTouch===concederTeam) TEL.deflected++;
  const wasLeader=leaderIdx();
  // true underdog test: someone ranked STRICTLY above the scorer before this goal
  const wasTrailing=(scorerTeam!==null)&&[0,1,2].some(o=>!out[o]&&o!==scorerTeam&&rankCmp(o,scorerTeam)<0);
  const legit=(scorerTeam!==null && scorerTeam!==concederTeam);
  conceded[concederTeam]++; score[concederTeam]--;
  if(legit){ score[scorerTeam]++; scored[scorerTeam]++; }
  const keeper=players.find(p=>p.team===concederTeam&&p.role==="K");
  const name=legit?((scorer&&scorer.team===scorerTeam)?scorer.name:TEAMS[scorerTeam].name):null;
  if(legit&&scorer&&scorer.team===scorerTeam){ scorer.goals++; stam(scorer,+0.2); }
  goalsLog.push({t:clockSec,name:name||TEAMS[concederTeam].name,scorer:legit?scorerTeam:null,conceder:concederTeam,own:!legit,ot:phase==="overtime"});

  // ---- overtime rules: concede and you're out; golden goal decides it ----
  if(phase==="overtime"){
    if(otGolden || aliveTeams().length===2){
      // two left: this goal settles it
      const champ=legit?scorerTeam:aliveTeams().find(t=>t!==concederTeam);
      if(legit&&scorer&&scorer.team===scorerTeam) goldenScorer=scorer;
      sayLogged(`<span class="goal">⚽ GOLDEN GOAL!</span> ${name??tm(champ)} settles it!`,true);
      champInfo={t:champ,how:legit?`golden goal by ${name}`:`golden goal — own-goal heartbreak for ${TEAMS[concederTeam].name}`};
      ENGINE_HOOKS.crownChampion(champ, champInfo.how);
      return;
    }
    // three left: the conceder is eliminated, survivors play golden goal
    sayLogged(`<span class="goal">💀 ELIMINATED!</span> ${tm(concederTeam)} concede in overtime and they're OUT!`,true);
    knockOut(concederTeam);          // the RULE, not just the announcement
    otGolden=true;
    const survivors=aliveTeams();
    ENGINE_HOOKS.showCelebration(TEAMS[concederTeam].color,"💀 ELIMINATED!",
      `${tm(concederTeam)} are out`,
      `${legit?name+" delivers the killing blow":"an own goal ends it"} — ${tm(survivors[0])} v ${tm(survivors[1])}, next goal wins`,"");
    sayLogged(`Golden goal! ${tm(survivors[0])} against ${tm(survivors[1])} — next goal takes the title!`,true);
    computeTargets();
    ENGINE_HOOKS.flash(concederTeam);
    pendingKickoff=survivors[Math.floor(RNG()*2)];
    return;
  }

  // ---- regulation ----
  let caughtFire=false;
  if(legit){
    const st2=score[scorerTeam];
    const scoreline=scoreMode==="conceded"
      ?`${tm(concederTeam)} now ${conceded[concederTeam]} conceded`
      :pick([                                  // the arithmetic lecture, retired
        `${tm(scorerTeam)} +1`,
        `advantage ${tm(scorerTeam)}`,
        `that's +1 for ${tm(scorerTeam)}`,
        `${tm(scorerTeam)} now ${st2>0?"+":""}${st2}`,
        `${tm(scorerTeam)} climb to ${st2>0?"+":""}${st2}`,
        `${tm(scorerTeam)} +1, and ${tm(concederTeam)} pay the bill`,
        `${tm(scorerTeam)} +1, ${tm(concederTeam)} −1`]);
    sayLogged(pick([
      `<span class="goal">⚽ GOOOAL!</span> ${name} beats ${keeper.name} — ${scoreline}!`,
      `<span class="goal">⚽ GOOOAL!</span> ${name} finds the net! ${scoreline}!`,
      `<span class="goal">⚽ IT'S IN!</span> ${keeper.name} rooted — ${name} scores! ${scoreline}!`,
      `<span class="goal">⚽ GOOOAL!</span> ${name} with ice in the veins — ${scoreline}!`,
      `<span class="goal">⚽ GOOOAL!</span> Nothing ${keeper.name} could do! ${name}! ${scoreline}!`,
      `<span class="goal">⚽ THE NET BULGES!</span> ${name}! ${scoreline}!`,
      `<span class="goal">⚽ GOOOAL!</span> ${name} writes ${scorer?PRN(scorer).his:"their"} name on this match — ${scoreline}!`,
      `<span class="goal">⚽ GOOOAL!</span> ${name} with John Wick calm — one look, one finish. ${scoreline}!`,
      `<span class="goal">⚽ GOOOAL!</span> ${name}! Absolute Victory Royale form! ${scoreline}!`,
      `<span class="goal">⚽ GOOOAL!</span> ${name}! Grandma Gloria's candle is WORKING — ${scoreline}!`,
      `<span class="goal">⚽ GOOOAL!</span> ${name}! Solana scores it a TEN — performance AND presentation! ${scoreline}!`,
      `<span class="goal">⚽ GOOOAL!</span> ${name} — Maximus calculated that finish three passes ago! ${scoreline}!`,
      `<span class="goal">⚽ GOOOAL!</span> ${name} completes the quest — the grail was in the net all along! ${scoreline}!`,
      `<span class="goal">⚽ GOOOAL!</span> HOLY HAND GRENADE from ${name} — the foe, being naughty, hath snuffed it! ${scoreline}!`]),true);
    if(momentumOn && wasTrailing){
      boostUntil[scorerTeam]=clockSec+20;
      caughtFire=true;
      sayLogged(pick([
        `${tm(scorerTeam)} catch fire! 🔥 The underdogs are flying for the next 20 seconds.`,
        `🔥 Belief is a fuel — ${tm(scorerTeam)} are burning it! 20 seconds of fury!`,
        `The comeback spark! 🔥 ${tm(scorerTeam)} find another gear!`,
        `🔥 ${tm(scorerTeam)} down but never out — they're FLYING now!`,
        `Someone lit the touchpaper — ${tm(scorerTeam)} are ablaze! 🔥`]),true);
    }
    ENGINE_HOOKS.showCelebration(TEAMS[scorerTeam].color, "⚽ GOOOAL!",
      `<b>${name}</b> — ${tm(scorerTeam)}`,
      `beats ${keeper.name} · ${tm(concederTeam)} concede (${conceded[concederTeam]})`,
      caughtFire?`🔥 ${TEAMS[scorerTeam].name} catch fire — 20s boost!`:"");
  } else {
    sayLogged(`<span class="goal">⚽ Own goal!</span> Chaos in the box and ${tm(concederTeam)} put it in their own net.`,true);
    ENGINE_HOOKS.showCelebration(TEAMS[concederTeam].color, "😱 OWN GOAL!",
      `${tm(concederTeam)} concede`,
      `chaos in the box — it's in their own net (${conceded[concederTeam]} conceded)`, "");
  }
  computeTargets();
  ENGINE_HOOKS.flash(concederTeam); if(legit) ENGINE_HOOKS.flash(scorerTeam);
  pendingKickoff=concederTeam;   // kickoff happens after the celebration clears
}
// ── TELEMETRY ───────────────────────────────────────────────────────────────
// Counters the match report prints, so a match played in a real browser can be compared against
// what the headless harness claims. The harness has been wrong four times — about the clock, the
// match length, the frame budget and the elimination rule — and each time the tell was a number
// that did not match what somebody was watching.
//
// These are the numbers I could not verify from outside: how often the ball actually goes out,
// how long a keeper really holds it, and how much of a match is nobody-in-reach dead time.
const TEL = {
  frames:0, loose:0, deadFrames:0, aerial:0,
  throwIns:0, corners:0, goalKicks:0, keeperClaims:0, keeperFrames:0, ownedFrames:0,
  poss:[0,0,0], jumps:0, bigJumps:0, maxJump:0, lastX:null, lastY:null,
  claims:0, gkClaims:0, rapid:0, gkRapid:0, behindGoal:0, behindOwn:0, behindOther:0,
  zLow:0, zMid:0, zHigh:0, zSky:0, zMax:0, port:{}, woodwork:0, bars:0, posts:0,
  jumps:0, jumpsBoosted:0, jumpsMissed:0, deflected:0, freeKicks:0,
  jobFrames:{}, jobSwitch:0, jobPop:0, jobHeld:0, jobHeldN:0, jobFallback:0, restartVoid:0, backPass:0,
  actFrames:{}, pOwned:0, pFlight:0, pDead:0, pContested:0, headers:0, shields:0, keeperHeld:0, carryTimeout:0, hitWall:0, throwsTaken:0, ballRecovered:0, oobState:0, intentional:0, incidental:0, foulMissed:0, wwSeen:0, wwNear:9999, wwBar:9999,
  unattributed:0, unattMax:0, portFrame:-1,
  stall:0, stalls:0, worstStall:0, shots:0, blocked:0
};
function telReset(){
  Object.assign(TEL, { frames:0, loose:0, deadFrames:0, aerial:0, throwIns:0, corners:0,
    goalKicks:0, keeperClaims:0, keeperFrames:0, ownedFrames:0, poss:[0,0,0], jumps:0,
    claims:0, gkClaims:0, rapid:0, gkRapid:0, behindGoal:0, behindOwn:0, behindOther:0,
    zLow:0, zMid:0, zHigh:0, zSky:0, zMax:0, port:{}, woodwork:0, bars:0, posts:0,
    jumps:0, jumpsBoosted:0, jumpsMissed:0, deflected:0, freeKicks:0,
    jobFrames:{}, jobSwitch:0, jobPop:0, jobHeld:0, jobHeldN:0, jobFallback:0, restartVoid:0, backPass:0,
    actFrames:{}, pOwned:0, pFlight:0, pDead:0, pContested:0, headers:0, shields:0, keeperHeld:0, carryTimeout:0, carryTimeout:0, hitWall:0, hitWall:0, throwsTaken:0, throwsTaken:0, ballRecovered:0, oobState:0, oobState:0, ballRecovered:0, intentional:0, incidental:0, incidental:0, foulMissed:0, intentional:0, foulMissed:0, wwSeen:0, wwNear:9999, wwBar:9999, wwSeen:0, wwNear:9999, wwBar:9999, shields:0, headers:0,
  actFrames:{}, pOwned:0, pFlight:0, pDead:0, pContested:0, headers:0, shields:0, keeperHeld:0, carryTimeout:0, hitWall:0, throwsTaken:0, ballRecovered:0, oobState:0, intentional:0, incidental:0, foulMissed:0, wwSeen:0, wwNear:9999, wwBar:9999, backPass:0, restartVoid:0,
  jobFrames:{}, jobSwitch:0, jobPop:0, jobHeld:0, jobHeldN:0, jobFallback:0, restartVoid:0, backPass:0,
  actFrames:{}, pOwned:0, pFlight:0, pDead:0, pContested:0, headers:0, shields:0, keeperHeld:0, carryTimeout:0, hitWall:0, throwsTaken:0, ballRecovered:0, oobState:0, intentional:0, incidental:0, foulMissed:0, wwSeen:0, wwNear:9999, wwBar:9999, freeKicks:0,
    unattributed:0, unattMax:0, portFrame:-1,
  unattributed:0, unattMax:0, portFrame:-1, deflected:0,
  jumps:0, jumpsBoosted:0, jumpsMissed:0, deflected:0, freeKicks:0,
  jobFrames:{}, jobSwitch:0, jobPop:0, jobHeld:0, jobHeldN:0, jobFallback:0, restartVoid:0, backPass:0,
  actFrames:{}, pOwned:0, pFlight:0, pDead:0, pContested:0, headers:0, shields:0, keeperHeld:0, carryTimeout:0, hitWall:0, throwsTaken:0, ballRecovered:0, oobState:0, intentional:0, incidental:0, foulMissed:0, wwSeen:0, wwNear:9999, wwBar:9999,
  unattributed:0, unattMax:0, portFrame:-1, woodwork:0, bars:0, posts:0, port:{},
  zLow:0, zMid:0, zHigh:0, zSky:0, zMax:0, port:{}, woodwork:0, bars:0, posts:0,
  jumps:0, jumpsBoosted:0, jumpsMissed:0, deflected:0, freeKicks:0,
  jobFrames:{}, jobSwitch:0, jobPop:0, jobHeld:0, jobHeldN:0, jobFallback:0, restartVoid:0, backPass:0,
  actFrames:{}, pOwned:0, pFlight:0, pDead:0, pContested:0, headers:0, shields:0, keeperHeld:0, carryTimeout:0, hitWall:0, throwsTaken:0, ballRecovered:0, oobState:0, intentional:0, incidental:0, foulMissed:0, wwSeen:0, wwNear:9999, wwBar:9999,
  unattributed:0, unattMax:0, portFrame:-1, behindGoal:0, behindOwn:0, behindOther:0,
    bigJumps:0, maxJump:0, lastX:null, lastY:null, stall:0, stalls:0, worstStall:0,
    shots:0, blocked:0 });
}
/** Called once a frame by whichever front end is driving. Cheap: one hypot and a few adds. */
// ── WHO MOVED THE BALL ──────────────────────────────────────────────────────
// TEL.bigJumps counts every frame-to-frame move over 25 units, which tells you THAT the ball
// teleports and never WHICH restart did it. Four browser matches reported 314, 317, 321 and 325
// as the largest, and I could not say what any of them was.
//
// Each place the engine moves the ball instantly now names itself, and the report prints the
// tally. The goal is that every one of these becomes a journey instead — a player fetching it, or
// the crowd throwing it back — and this is how we watch that number go to zero.
// telPort fires during think() and physics(), which run BEFORE telFrame() increments the counter
// — so recording TEL.frames here records the PREVIOUS frame's number, and the check below never
// matched. Every declared teleport was counted as undeclared and `unattributed` came back exactly
// equal to the total, which is the signature of an off-by-one rather than of missing sources.
function telPort(why){ TEL.port[why] = (TEL.port[why] || 0) + 1; TEL.portFrame = TEL.frames + 1; }

// ── THE CATCH-ALL ───────────────────────────────────────────────────────────
// Naming sources one at a time is a hunt, and a hunt ends when you stop finding things rather
// than when there is nothing left. A real match said 37 jumps over 25 units against 23 that had
// names — so 14 came from somewhere, and I could only have found them by reading every line that
// touches ball.x and hoping.
//
// This closes it instead: any frame where the ball moved more than physics could account for AND
// nothing declared itself gets counted as unattributed. If that number is zero, the list is
// complete — not because I looked hard, but because nothing else can move the ball.
function telUnattributed(dist2){
  // Within one frame either way: a restart can declare itself on the frame the ball moves or on
  // the one before, depending on whether the move happens in think() or in physics().
  if(TEL.portFrame>=TEL.frames-1) return;     // something owned up
  TEL.unattributed++;
  if(dist2>TEL.unattMax) TEL.unattMax=dist2;
}

function telFrame(){
  // ── LOOSE IS FOUR DIFFERENT THINGS ────────────────────────────────────────
  // `loose` counted every frame with no owner, so a pass in flight — the ball doing exactly
  // what it should — read as the ball being lost. With a lot of passing that pushes the figure
  // to 85% and makes a healthy match look broken. John watched the game and said so.
  //
  // Four states, and only one of them is a problem:
  //
  //   owned      at somebody's feet
  //   flight     travelling: a pass or a shot. This is football.
  //   dead       a restart is staged
  //   contested  slow, unowned, nobody has picked it up. THIS is the loose-ball problem.
  //
  // 8 / 32 / 4 / 56 on a typical match. The headline was 85%; the number worth working on is 56.
  if(ball.owner) TEL.pOwned++;
  else if(Math.hypot(ball.vx,ball.vy)>1.2) TEL.pFlight++;
  else if(pendingRestart||freeKick||throwPending||cornerPending) TEL.pDead++;
  else TEL.pContested++;

  TEL.frames++;
  if(ball.owner){ TEL.ownedFrames++; TEL.poss[ball.owner.team]++; if(ball.owner.role==="K") TEL.keeperFrames++; }
  else TEL.loose++;
  if((ball.z||0)>4) TEL.aerial++;
  // HOW HIGH, not just whether. "14% airborne" is true of a game where the ball hops 5 units and
  // of one where it is launched over a stand, and those are different games. Buckets, so a real
  // match can say which this is.
  const bz=ball.z||0;
  if(bz>4){
    if(bz<20) TEL.zLow++; else if(bz<50) TEL.zMid++; else if(bz<100) TEL.zHigh++; else TEL.zSky++;
    if(bz>TEL.zMax) TEL.zMax=bz;
  }
  let nearest=1e9;
  for(const p of players){ if(p.out) continue;
    const d=Math.hypot(p.x-ball.x,p.y-ball.y); if(d<nearest) nearest=d; }
  if(!ball.owner && nearest>40){ TEL.deadFrames++; TEL.stall++; }
  else { if(TEL.stall>30){ TEL.stalls++; if(TEL.stall>TEL.worstStall) TEL.worstStall=TEL.stall; } TEL.stall=0; }
  if(TEL.lastX!==null){
    const j=Math.hypot(ball.x-TEL.lastX, ball.y-TEL.lastY);
    TEL.jumps++; if(j>25) { TEL.bigJumps++; telUnattributed(j); }
    if(j>TEL.maxJump) TEL.maxJump=j;
  }
  TEL.lastX=ball.x; TEL.lastY=ball.y;
}

function buildMatchReport(){
  const totPoss=stats.poss.reduce((a,b)=>a+b,0)||1;
  const idOf=t=>`${teamATK[t]} · ${teamDEF[t]} · ${teamAGG[t]}`;
  let md=`# Three-Sided World Cup — Match Report\n\n`;
  md+=`*${new Date().toLocaleString()}*\n\n`;
  md+=`## Lineup\n\n`;
  for(let t=0;t<3;t++)
    md+=`- **${TEAMS[t].name}** (${TEAMS[t].short}) — ${idOf(t)} — ⭐ ${TEAMS[t].star}\n`;
  if(champInfo) md+=`\n## 🏆 ${TEAMS[champInfo.t].name} are champions — ${champInfo.how}\n`;
  md+=`\n## Final\n\n| Team | Pts | G | Sv | Tk | Poss |\n|---|---|---|---|---|---|\n`;
  for(const m of [0,1,2].sort(rankCmp))
    md+=`| ${TEAMS[m].short} | ${score[m]>0?"+":""}${score[m]} | ${scored[m]} | ${stats.saves[m]} | ${stats.tackles[m]} | ${Math.round(100*stats.poss[m]/totPoss)}% |\n`;
  md+=`\n## Goals\n\n`;
  if(!goalsLog.length) md+=`None. A siege.\n`;
  goalsLog.forEach(g=>{
    const mm2=String(Math.floor(g.t/60)).padStart(2,"0"), ss2=String(Math.floor(g.t%60)).padStart(2,"0");
    md+=g.own?`- 😱 ${mm2}:${ss2} own goal — ${TEAMS[g.conceder].short}${g.ot?" (OT)":""}\n`
      :`- ⚽ ${mm2}:${ss2} ${g.name} (${TEAMS[g.scorer].short}) v ${TEAMS[g.conceder].short}${g.ot?" (OT)":""}\n`;
  });
  md+=`\n## Full play-by-play\n\n`+matchLog.map(l=>`- ${l}`).join("\n")+"\n";
  // ── TELEMETRY ─────────────────────────────────────────────────────────────
  // For comparing a real browser match against the headless harness. If these disagree, the
  // harness is wrong — it has been four times — and this is the section that says so.
  const f=TEL.frames||1, ow=TEL.ownedFrames||1, secs=f/60;
  md+=`\n## Telemetry\n\n`;
  md+=`*A real match, measured while you watched it. Compare against \`node lab.js\`.*\n\n`;
  md+=`| measure | this match | per 90 | real football |\n|---|---|---|---|\n`;
  const p90=x=>Math.round(x*(5400/Math.max(1,secs)));
  md+=`| throw-ins | ${TEL.throwIns} | ${p90(TEL.throwIns)} | ~40 |\n`;
  md+=`| free kicks | ${TEL.freeKicks} | ${p90(TEL.freeKicks)} | ~22 |\n`;
  md+=`| back-passes (keeper must kick) | ${TEL.backPass} | ${p90(TEL.backPass)} | |\n`;
  md+=`| **headers** | ${TEL.headers} | ${p90(TEL.headers)} | ~40 |\n`;
  md+=`| keeper stayed up | ${TEL.keeperHeld} | | vs dives |\n`;
  md+=`| shielding (frames) | ${TEL.shields} | | |\n`;
  md+=`| **restarts voided by the watchdog** | ${TEL.restartVoid} | | should be 0 |\n`;

  // ── INSTRUCTIONS ──────────────────────────────────────────────────────────
  // Whether the list is being used, and whether players stick with what they are told.
  const jf=Object.entries(TEL.jobFrames).sort((a2,b2)=>b2[1]-a2[1]);
  const jTot=jf.reduce((a2,b2)=>a2+b2[1],0)||1;
  md+=`\n### Instructions\n\n`;
  md+=`| instruction | share of instructed frames |\n|---|---|\n`;
  for(const [k,v] of jf) md+=`| ${k} | ${Math.round(100*v/jTot)}% |\n`;
  md+=`\n| | |\n|---|---|\n`;
  md+=`| player-frames on an instruction | ${jTot} |\n`;
  md+=`| player-frames on the old cascade | ${TEL.jobFallback} |\n`;
  // PER PLAYER PER SECOND. A raw total is not comparable between runs of different lengths or
  // with different numbers of men on the pitch, and I quoted three of them at each other before
  // noticing. A human changes their mind twice a second at the very most; anything near a
  // per-frame rate is noise rather than indecision.
  // onPitch, not !out — this is the denominator for switches-per-player-per-second, and counting
  // a man who is walking off inflates the divisor and quietly flatters the number.
  const alive=players.filter(q=>onPitch(q)).length||1;
  const perPS=TEL.jobSwitch/Math.max(1,secs)/alive;
  md+=`| switches | ${TEL.jobSwitch} |\n`;
  md+=`| **switches per player per second** | ${perPS.toFixed(1)} | **should be under ~2** |\n`;
  md+=`| \u2014 that is one every | ${(60/Math.max(0.01,perPS)).toFixed(1)} frames |\n`;
  md+=`| held under 0.25s (popping) | ${TEL.jobPop} (${TEL.jobSwitch?Math.round(100*TEL.jobPop/TEL.jobSwitch):0}%) |\n`;
  md+=`| average time on an instruction | ${(TEL.jobHeld/Math.max(1,TEL.jobHeldN)).toFixed(2)}s |\n`;
  md+=`| ball behind a goal line | ${TEL.behindGoal} | ${p90(TEL.behindGoal)} | |\n`;
  md+=`| \u2014 last touched by the DEFENDING side (corner) | ${TEL.behindOwn} | ${p90(TEL.behindOwn)} | ~10 |\n`;
  md+=`| \u2014 last touched by an attacker (goal kick) | ${TEL.behindOther} | ${p90(TEL.behindOther)} | ~8 |\n`;
  md+=`| possession changes | ${TEL.claims} | ${p90(TEL.claims)} | ~250 |\n`;
  md+=`| of those, to a keeper | ${TEL.gkClaims} | ${p90(TEL.gkClaims)} | ~8 |\n`;
  md+=`| **scrambles** (re-claim <0.45s, same spot) | ${TEL.rapid} | ${p90(TEL.rapid)} | rare |\n`;
  md+=`| of those, a keeper juggling | ${TEL.gkRapid} | ${p90(TEL.gkRapid)} | ~0 |\n`;
  md+=`| ball loose | ${Math.round(100*TEL.loose/f)}% | | ~35% |\n`;
  md+=`| ball airborne | ${Math.round(100*TEL.aerial/f)}% | | ~20% |\n`;
  md+=`| \u2014 ankle to knee (4-20) | ${Math.round(100*TEL.zLow/f)}% | | most of it |\n`;
  md+=`| \u2014 head height (20-50) | ${Math.round(100*TEL.zMid/f)}% | | |\n`;
  md+=`| \u2014 above the crossbar (50-100) | ${Math.round(100*TEL.zHigh/f)}% | | |\n`;
  md+=`| \u2014 over 100 | ${Math.round(100*TEL.zSky/f)}% | | rare |\n`;
  md+=`| highest the ball got | ${Math.round(TEL.zMax)} | | crossbar is ${GOAL_H} |\n`;
  md+=`| **jumps** | ${TEL.jumps} | ${p90(TEL.jumps)} | |\n`;
  md+=`| \u2014 boosted (burst spent for height) | ${TEL.jumpsBoosted} | | |\n`;
  md+=`| \u2014 came down with nothing | ${TEL.jumpsMissed} | | some, or it is too easy |\n`;
  md+=`| goals credited past a defensive touch | ${TEL.deflected} | | these were own goals before |\n`;
  md+=`| **woodwork** | ${TEL.woodwork} | ${p90(TEL.woodwork)} | ~2 |\n`;
  md+=`| \u2014 crossbar | ${TEL.bars} | | |\n`;
  md+=`| \u2014 post | ${TEL.posts} | | |\n`;
  md+=`| in a keeper's gloves | ${Math.round(100*TEL.keeperFrames/ow)}% of owned | | ~5% |\n`;
  md+=`| loose with nobody within 40 | ${Math.round(100*TEL.deadFrames/f)}% | | |\n`;
  md+=`| stalls over 0.5s | ${TEL.stalls} | ${p90(TEL.stalls)} | |\n`;
  md+=`| longest stall | ${(TEL.worstStall/60).toFixed(1)}s | | |\n`;
  md+=`| ball jumps over 25 units | ${TEL.bigJumps} | ${p90(TEL.bigJumps)} | |\n`;
  // WHICH restart moved it, so the gold standard has something to aim at.
  const ports=Object.entries(TEL.port).sort((a2,b2)=>b2[1]-a2[1]);
  for(const [why,n2] of ports) md+=`| \u2014 ${why} | ${n2} | ${p90(n2)} | should be 0 |\n`;
  // THE CHECK. If this is zero the list above is complete — not because I hunted well, but
  // because nothing else can move the ball. If it is not zero, something is still unnamed.
  md+=`| \u2014 **unattributed** | ${TEL.unattributed} | | must be 0, or the list is incomplete |\n`;
  if(TEL.unattributed) md+=`| \u2014 largest unattributed | ${Math.round(TEL.unattMax)} | | |\n`;
  md+=`| largest single jump | ${Math.round(TEL.maxJump)} | | pitch is 680 across |\n`;
  md+=`| possession | ${TEL.poss.map((x,i2)=>TEAMS[i2].short+" "+Math.round(100*x/ow)+"%").join(" \u00b7 ")} | | |\n`;
  md+=`\n*${Math.round(secs)}s of play across ${f} frames.*\n`;
  return md;
}
// ── ELIMINATION IS A RULE, NOT A PICTURE ────────────────────────────────────
// This was done entirely inside the front end's `eliminateTeam` hook — the flat page set out[t],
// marked every player out, dropped the ball if an eliminated player held it, and cleared the
// coach. The 3D page's hook showed a card and did NONE of it.
//
// So on that page nobody was ever actually eliminated. aliveTeams() still returned three, which
// made otGolden false, which meant a match went to three-way overtime with a team on -1 that
// should have been knocked out on the tiebreak — and then overtime concessions eliminated
// nobody either, because the same hook was doing the same nothing.
//
// A hook is for DRAWING. If the rules depend on it, it is not a hook, and this one was carrying
// the whole elimination rule on the assumption that both front ends would implement it
// identically. They did not, and there was nothing to make them.
function knockOut(t){
  if(out[t]) return;
  out[t]=true;
  coached[t]=false; coachTarget[t]=null; if(activeCoach===t) activeCoach=null;
  players.forEach(p=>{ if(p.team===t){ p.out=true; if(ball.owner===p) ball.owner=null; }});
  if(ball.lastKicker&&ball.lastKicker.out) ball.isShot=false;
  ENGINE_HOOKS.eliminateTeam(t);        // now purely the announcement
}

function resolveFullTime(){
  // rank by mode metric, tiebreak on goals scored (FIFA-style)
  const order=[0,1,2].sort(rankCmp);
  const leaders=[0,1,2].filter(t=>rankCmp(t,order[0])===0);
  if(leaders.length===1){ champInfo={t:order[0],how:"at full time"}; ENGINE_HOOKS.crownChampion(order[0],"at full time"); return; }
  // dead level at the top: golden-concession overtime
  phase="overtime";
  [0,1,2].filter(t=>!leaders.includes(t)).forEach(t=>{
    sayLogged(`Full time — ${tm(t)} are eliminated on the tiebreak.`,true);
    knockOut(t);
  });
  otGolden=(aliveTeams().length===2);
  if(otGolden){
    sayLogged(`<span class="goal">FULL TIME — dead level!</span> ${tm(leaders[0])} v ${tm(leaders[1])}: golden goal, next score wins the title!`,true);
    ENGINE_HOOKS.showCelebration("#f7c948","⏱️ OVERTIME",
      `${tm(leaders[0])} v ${tm(leaders[1])}`,
      `Golden goal — next score wins the title`,"");
  } else {
    sayLogged(`<span class="goal">FULL TIME — all three level!</span> Golden-concession overtime: concede and you're OUT.`,true);
    ENGINE_HOOKS.showCelebration("#f7c948","⏱️ OVERTIME",
      `All three teams level`,
      `Golden concession — CONCEDE AND YOU'RE OUT`,"");
  }
  computeTargets();
  kickoff(leaders[Math.floor(RNG()*leaders.length)]);
}

// ---------- Color commentary ----------
let lastStyleAt=-99;
function styleLines(){
  const L=[], A=teamATK, D=teamDEF, G=teamAGG;
  const has=(arr,v)=>arr.indexOf(v);
  const alive=aliveTeams();
  // known counters, from the lab's matchup matrix
  for(const a of alive) for(const b of alive){ if(a===b) continue;
    if(A[a]==="Probe"&&D[b]==="Gegenpress")
      L.push(`The form guide says patience eats the press. ${tm(a)} know the numbers against ${tm(b)}.`);
    if(A[a]==="RouteOne"&&D[b]==="Gegenpress")
      L.push(`Over the top is the antidote to a press — ${tm(a)} keep launching it past ${tm(b)}.`);
    if(A[a]==="TikiTaka"&&D[b]==="ParkTheBus")
      L.push(`A thousand touches against a locked door — ${tm(a)} probing the ${tm(b)} bus.`);
    if(A[a]==="Swashbuckle"&&D[b]==="ParkTheBus")
      L.push(`Artillery versus the bus — ${tm(a)} will hit it from anywhere; ${tm(b)} will take the deflections.`);
    if(A[a]==="TikiTaka"&&D[b]==="Gegenpress")
      L.push(`Dangerous game: the ${tm(b)} press devours short passing. ${tm(a)} are playing with matches.`);
    if(G[a]==="Nasty"&&G[b]==="Nasty")
      L.push(`Two sides who tackle with intent tonight. The referee earns his fee.`);
  }
  // trio-shape lines
  const buses=alive.filter(t=>D[t]==="ParkTheBus").length;
  const presses=alive.filter(t=>D[t]==="Gegenpress").length;
  const swash=alive.filter(t=>A[t]==="Swashbuckle").length;
  if(buses>=2) L.push(`Two parked buses on one hexagon. Bring a book — or wait for the set pieces.`);
  if(presses>=3) L.push(`Three pressing sides. Somebody's legs are going to file a formal complaint.`);
  if(presses===2) L.push(`Two presses on the pitch — the fresh legs at minute one are a loan, not a gift.`);
  if(swash>=2) L.push(`Multiple artillery sides tonight. The keepers have been informed. They are not pleased.`);
  // coalition pressing, live
  for(const t of alive)
    if(coalAlly[t]&&T(t).press>0.7)
      L.push(`${tm(t)} are pressing in coalition — half the bill, twice the menace.`);
  return L;
}
let recentChatter=[];
// ── THE KEEPER GETS HIS OWN LINES ───────────────────────────────────────────
// He was getting the generic carrier commentary — "Unai Simón on it, head up, options
// everywhere", "Unai Simón carries" — which reads as a keeper playing outfield. He is not; he is
// standing in his own box holding the ball, which is 43 per cent of owned time and perfectly
// normal for this game. The lines were the problem, not the football.
//
// A keeper on the ball is doing one of three things: he has just caught it, he is deciding, or
// he is about to distribute. None of those is "options everywhere".
function keeperLine(k){
  const T=tm(k.team);
  return pick([
    `${k.name} has it in his gloves. ${T} take a breath.`,
    `${k.name} looks up from his six-yard box, weighing the options.`,
    `${k.name} shepherds it, and nobody is getting near.`,
    `Safe hands — ${k.name} is in no hurry at all.`,
    `${k.name} surveys the hex from the edge of his area.`,
    `${k.name} has the ball and the whole pitch in front of him.`,
    `All quiet in the ${T} goal. ${k.name} decides when this restarts.`,
    `${k.name} bounces it once, twice \u2014 the tempo is his now.`]);
}

function colorCommentary(){
  try{ ambientChatter(); }catch(e5){}
  // style & matchup color (~every 45s)
  if(clockSec-lastStyleAt>45&&RNG()<0.4){
    const ls=styleLines();
    if(ls.length){ lastStyleAt=clockSec; sayLogged(pick(ls)); }
  }
  // fatigue watch (~every 40s)
  if(clockSec-lastFatigueComment>40){
    let worst=0, wv=1;
    for(const t of aliveTeams()){
      const avg=players.filter(p=>p.team===t).reduce((s,p)=>s+p.stamina,0)/5;
      if(avg<wv){wv=avg;worst=t;}
    }
    if(wv<0.55){
      lastFatigueComment=clockSec;
      sayLogged(pick([
        `Legs are getting heavy for ${tm(worst)} — they're running on fumes.`,
        `${tm(worst)} look gassed out there. The pressing has taken its toll.`,
        `You can see ${tm(worst)} slowing down. Fatigue is real on the hex.`,
        `${tm(worst)} are walking. That's not tactics, that's exhaustion.`,
        `Someone check ${tm(worst)}'s legs — the batteries are blinking red.`,
        `Every sprint costs ${tm(worst)} double now. The late goals are coming.`,
        `${tm(worst)} hands on hips. The universal language of the finished.`]));
      return;
    }
  }
  // tactical picture (~every 30s)
  if(clockSec-lastColorComment>30){
    lastColorComment=clockSec;
    const L=leaderIdx();
    const others=[0,1,2].filter(t=>t!==L);
    if(targets[others[0]]===L && targets[others[1]]===L){
      sayLogged(pick([
        `The pincer is on — ${tm(others[0])} and ${tm(others[1])} are both hunting ${tm(L)}!`,
        `Nobody stays on top for long here: ${tm(L)} lead, so ${tm(others[0])} and ${tm(others[1])} have formed an alliance of convenience.`,
        `Two thieves who agree on the target: everyone wants a piece of ${tm(L)}.`,
        `${tm(L)} against the world — both rivals commit to the siege.`,
        `Heavy is the head: ${tm(L)} lead, and two armies march on them.`,
        `It's ${tm(L)} versus everyone. Asger Jorn smiles somewhere.`,
        `The oldest story on the hex: lead, and be hunted. ${tm(L)}'s turn.`]),false,true);
    }
  }
}

// ---------- Narrator (Web Speech API — built into the phone, works offline) ----------
let voiceOn=true, narrator=null, queuedUtter=0, welcomed=false;

const HOLLERBOX_SRC = 'https://johnhenryburns.github.io/hollerbox/engine/';
let voiceEngineName = 'browser';      // 'browser' | 'hollerbox'
let holler = null;                    // the loaded engine, or null until it is

/** Load Hollerbox and start its audio. Called at match start, NOT at the first goal: an
 *  AudioWorklet is interpreted before it is compiled and is about twice as slow as real time
 *  cold, so the first word out of it drops samples — which sounds exactly like a click. Three
 *  hundred milliseconds of silence at kick-off buys a clean first shout. */

/** Say something, and call back when it is finished. The same shape as an utterance's onend, so
 *  the queue does not need to know which engine it is talking to. */
function hollerSay(text, isGoalCall, onEnd, original){
  if(holler) holler.stretch = original || text;
  if(!holler){ onEnd&&onEnd(); return; }
  const { S, P } = holler;
  try{
    if(holler.wake) holler.wake();
    const v = { ...holler.voice };
    // A GOAL CALL HOLDS THE VOWEL, and this is the whole reason to be here. The text handed in
    // has already had "GOOOOAAALLL" flattened to "goal", because every engine reads the stretched
    // spelling as something else — the phone says "gull" and this one says "goo-oh-l". But the
    // stretch was never in the letters; it is in the DELIVERY, and a physical tract can hold a
    // vowel for as long as there is air. `drawl` is that, and how far it goes is read back off
    // the original spelling: more o's, longer shout.
    if(isGoalCall){
      v.per = (v.per||0.05)*1.35;
      v.acc = Math.min(14,(v.acc||7)+3);
      const os = (String(holler.stretch||'').match(/[OA]/gi)||[]).length;
      v.drawl = Math.max(v.drawl||0, Math.min(1, 0.45 + 0.06*Math.max(0, os-2)));
    }
    const { ph, stress } = S.chainFor(text);
    if(!ph.length){ onEnd&&onEnd(); return; }
    const n = S.tractFor(holler.node, v, holler.n);
    holler.node.port.postMessage({ type:'voice', v });
    const seq = S.planSpeech(ph, v, { n, stress });
    holler.done = onEnd || null;
    holler.node.port.postMessage({ type:'goal', seq });
    // a floor under the callback, so a lost message cannot wedge the queue for the whole match
    const mine = holler.done;
    setTimeout(()=>{ if(holler && holler.done===mine && mine){ holler.done=null; mine(); } },
               (seq.end+1.2)*1000);
  }catch(e){ onEnd&&onEnd(); }
}

function hollerStop(){
  if(holler){ try{ holler.node.port.postMessage({type:'stopSeq'}); }catch(e){} holler.done=null; }
}
const usingHollerbox = () => voiceEngineName==='hollerbox' && !!holler;

// Three more that never touched the DOM and had been left behind by a classifier that judged
// them by the company they kept rather than by what they do.
function ambientChatter(){
  if(!matchLive||!voiceOn||!speechOK) return;
  if(queuedUtter>0||(!usingHollerbox()&&speechSynthesis.speaking)) return;
  const rt=nowMs()/1000;
  if(rt-lastChatterAt<6) return;   // REAL seconds: slow-speed viewing gets a full broadcast
  const cand=[];
  const o=ball.owner;
  if(o&&o.role!=="K"){
    const tgt=targets[o.team];
    cand.push(
      `${o.name} on the ball for ${TEAMS[o.team].name}.`,
      `${o.name} carries it forward.`,
      `Patient stuff from ${TEAMS[o.team].name} — ${o.name} surveying.`,
      `${o.name} with a touch, and another.`,
      tgt!==null?`${o.name} looking toward the ${TEAMS[tgt].name} end.`:`${o.name} in space.`);
    if(o.name===TEAMS[o.team].star)
      cand.push(`The star man — every seat leans in when ${o.name} takes it.`,
        `${o.name}. You can feel the anticipation.`);
    if(o.stamina<0.5) cand.push(`${o.name} looks heavy-legged now.`);
    let nd=1e9; players.forEach(q=>{ if(q.team!==o.team&&!q.out&&!q.sentOff) nd=Math.min(nd,dist(q,o)); });
    if(nd<40) cand.push(`${o.name} under pressure...`,`They're closing ${o.name} down fast.`,
      `Nowhere to hide for ${o.name}.`);
    if(nd>90) cand.push(`Acres of space for ${o.name}.`,`Time and grass for ${o.name}.`);
  } else if(o&&o.role==="K"){
    cand.push(`${o.name} with it at the back — restarting the story.`,
      `The keeper takes his time. Smart.`);
  }
  if(clockSec>25){
    const totP=stats.poss.reduce((a,b)=>a+b,0)||1;
    const lead=[0,1,2].sort((a,b)=>stats.poss[b]-stats.poss[a])[0];
    cand.push(`${TEAMS[lead].name} seeing most of the ball — ${Math.round(100*stats.poss[lead]/totP)} percent possession.`);
    const tk=[0,1,2].sort((a,b)=>stats.tackles[b]-stats.tackles[a])[0];
    if(stats.tackles[tk]>3) cand.push(`${TEAMS[tk].name} lead the tackle count with ${stats.tackles[tk]}.`);
    const mx=Math.max(...score), ldrs=[0,1,2].filter(t=>score[t]===mx);
    if(ldrs.length===1)
      cand.push(`${TEAMS[ldrs[0]].name} top of the pile — and the hex punishes the top of the pile.`,
        `Everyone in this stadium knows who the target is: ${TEAMS[ldrs[0]].name}.`);
    if(ldrs.length===3&&mx===0) cand.push(`Dead level. Someone has to blink.`);
  }
  const tired=players.filter(p2=>!p2.out&&!p2.sentOff&&p2.stamina<0.4);
  if(tired.length>3) cand.push(`Legs are going all over the pitch. This is where character shows.`);
  cand.push(
    `Great atmosphere around the hex tonight.`,
    `The crowd's in good voice.`,
    `Three goals, three keepers, no permanent friends — this sport is undefeated.`,
    `The floodlights doing their work on a beautiful evening for it.`,
    `Asger Jorn drew this pitch on a napkin in 1962. Look at it now.`,
    `Six sides, three teams, one ball. Simple game, really.`,
    `You don't defend a lead on the hex. You survive it.`,
    `Scarves out in all three ends tonight.`,
    // ---- the trope book ----
    `It's a game of thirds out here. Nobody said it had to make sense.`,
    `End-to-end-to-end stuff. This sport needed a new phrase and got one.`,
    `Straight into the mixer — that's where the honest goals live.`,
    `Ole football breaking out in patches tonight.`,
    `Someone's playing for the highlight reel now.`,
    `A proper shift being put in all over the grass.`,
    `He couldn't hit a barn door from there, and yet you feel he might.`,
    `Row Z has seen some traffic tonight.`,
    `Textbook. Whatever textbook this sport uses.`,
    `Against the run of play is the only kind of play the hex knows.`,
    `Bread and butter stuff. Which, coincidentally, smells incredible from the concourse.`,
    // ---- family lore & easter eggs ----
    `Word from the paddock: Atlas the chocolate lab has escaped the dugout area again.`,
    `Somewhere in the Willamette Valley, a Traeger is smoking and this match is on the porch speaker.`,
    `Grampy Cliff says any team that can't fix its own tractor doesn't deserve silverware.`,
    `Nanny's Baking Shop reports the halftime scones are already gone.`,
    `Grandma Bridget's art class has reviewed the hexagon: 'derivative, but bold.'`,
    `The chickens back home have reportedly stopped laying to watch this.`,
    `Legend says a boy named Max invented this sport at the dinner table. The world simply caught up.`,
    `Max FC scouts in the stands tonight. Notebooks out.`,
    `Dampy the Dolphin waves from the family section. Splash responsibly.`,
    `The pumpkin patch sits unguarded tonight. Priorities.`,
    `Out past the floodlights, the hazelnut rows run clear to the river.`,
    `A contest worthy of the Hat Creek outfit, this.`,
    `More twists than a cattle drive to Montana.`,
    `The barnyard is quiet. All eyes here.`);
  if(clockSec<20) cand.push(`Early doors, as they say.`,`Feeling-out phase. Nobody wants to blink first.`,
    `Pre-match checklist complete: bathroom, water, buckle.`);
  if(clockSec>matchLen*0.75&&phase==="regulation")
    cand.push(`Squeaky bum time approaching.`,`Late drama loading — you can feel it.`,
      `Fine margins from here to the whistle.`);
  if(phase==="overtime") cand.push(`Sudden death on a hexagon. Cruelty as entertainment.`,
    `Nobody breathes in overtime. Not even the announcer.`);
  if(matchBoards.length&&RNG()<0.25)
    cand.push(`Tonight's match brought to you in part by ${matchBoards[Math.floor(RNG()*matchBoards.length)].toLowerCase()}.`);
  // ---- state-aware storytelling (batch 2) ----
  {
    // hat-trick watch & man of the moment
    players.forEach(p2=>{
      if(p2.out||p2.sentOff)return;
      if(p2.goals===2) cand.push(`${p2.name} is ONE away from a hat-trick. Everybody in the ground knows it.`);
      if(p2.goals>=3) cand.push(`${p2.name} has a hat-trick and wants more. Greedy. Wonderful.`);
      if(p2.yellows>=1&&p2.role!=="K") cand.push(`${p2.name} walking the tightrope on a yellow.`);
    });
    // save-count heroics
    const svLead=[0,1,2].sort((a,b)=>stats.saves[b]-stats.saves[a])[0];
    if(stats.saves[svLead]>=4){
      const gk=players.find(p2=>p2.team===svLead&&p2.role==="K");
      if(gk) cand.push(`${gk.name} is building a highlight reel tonight — ${stats.saves[svLead]} saves.`);
    }
    // shorthanded valor & bedlam
    for(let t2=0;t2<3;t2++){
      const men=players.filter(p2=>p2.team===t2&&!p2.out&&p2.sentOff).length;
      if(men===1&&!out[t2]) cand.push(`${TEAMS[t2].name} a ${TEAMS[t2].she?"woman":"man"} down and refusing to die. Respect.`);
      if(men>=2&&!out[t2]) cand.push(`${TEAMS[t2].name} down to the bare bones. This is siege survival now.`);
    }
    // scoreline drama
    const mx2=Math.max(...score), mn2=Math.min(...score);
    if(mx2-mn2>=3) cand.push(`A ${mx2-mn2}-point spread. Someone's evening has gone sideways.`,
      `The gap is real now. Alliances form in gaps like this.`);
    if(mn2<=-3) { const worst=[0,1,2].find(t2=>score[t2]===mn2);
      cand.push(`Grim arithmetic for ${TEAMS[worst].name}. But the hex forgives fast — one pincer changes everything.`); }
    const totGoals=scored.reduce((a,b)=>a+b,0);
    if(totGoals>=5) cand.push(`${totGoals} goals already. Absolute bedlam, and nobody's apologizing.`);
    if(totGoals===0&&clockSec>matchLen*0.5) cand.push(`Still goalless. The keepers are winning the argument.`);
    const ccLead=[0,1,2].sort((a,b)=>conceded[b]-conceded[a])[0];
    if(conceded[ccLead]>=3) cand.push(`${TEAMS[ccLead].name} leaky at the back tonight — ${conceded[ccLead]} conceded.`);
    // targeting theater
    for(let a2=0;a2<3;a2++) for(let b2=a2+1;b2<3;b2++)
      if(targets[a2]===b2&&targets[b2]===a2&&!out[a2]&&!out[b2])
        cand.push(`${TEAMS[a2].name} and ${TEAMS[b2].name} are locked in a private war. The third team should be taking notes.`);
    for(let t2=0;t2<3;t2++)
      if(!out[t2]&&[0,1,2].every(o2=>o2===t2||out[o2]||targets[o2]===t2))
        cand.push(`Everyone's guns point at ${TEAMS[t2].name}. That's the price of the summit.`);
    // fire
    for(let t2=0;t2<3;t2++)
      if(clockSec<boostUntil[t2]) cand.push(`${TEAMS[t2].name} still burning — you can see it in the strides.`);
  }
  // ---- Rachel's canon: state-aware ----
  {
    const totG=scored.reduce((a,b)=>a+b,0);
    const redsOut=players.filter(p2=>p2.sentOff).length;
    if(clockSec>matchLen*0.65&&(totG>=4||redsOut>=2))
      cand.push(`This match has reached the exact moment Rachel means when she says: STOP. BEFORE. WE. UNRAVEL.`,
        `Controlled chaos is the family specialty. This match is testing the 'controlled' part.`);
    if(goalsLog.some(g2=>g2.own)||redsOut>=1)
      cand.push(`One mistake doesn't define a match. As the family says: just do the next right thing.`);
    for(let t2=0;t2<3;t2++)
      if(!out[t2]&&teamATK[t2]==="TikiTaka")
        cand.push(`${tm(t2)} running those Spain-style moving triangles Jupiter studies at the dinner table.`);
    if([0,1,2].some(t2=>clockSec<boostUntil[t2]))
      cand.push(`A sudden emotional momentum swing — pure Orion energy sweeping the stadium.`);
    if(!ball.owner){
      let empt=0;
      players.forEach(q=>{ if(!q.out&&!q.sentOff&&q.role!=="K"&&dist(q,ball)<170&&q.burst<0.2) empt++; });
      if(empt>=2) cand.push(`Two empty tanks lumbering after the same ball. Nobody told their legs it's a race.`,
        `A footrace in name only — both men are running on fumes and pride.`);
    }
    {
      const spr=players.find(q=>q.sprint&&!q.out&&!q.sentOff);
      if(spr) cand.push(`${spr.name} finds ANOTHER gear! That's the burst they save for moments like this.`,
        `Look at ${spr.name} GO — afterburners lit.`);
    }
    if(clockSec>matchLen*0.8) cand.push(`We're deep into nap-schedule territory. Play faster, gentlemen.`);
  }
  // ---- lore & tropes, batch 2 ----
  cand.push(
    `At the end of the day, it's twelve men, a hexagon, and consequences.`,
    `They'll take each match as it comes. Mostly because that's how time works.`,
    `The hexagon: six sides, no hiding places. Grandma Bridget calls it honest geometry.`,
    `Grampy Cliff would've cleared that with the loader tractor.`,
    `Nanny's sourdough is rising slower than this backline.`,
    `Atlas just caught a moth in the family section. Biggest save of the night so far.`,
    `The hens are on the fencepost. They can sense drama.`,
    `Rain's holding off. This is Oregon — that's a miracle worth a point.`,
    `The blueberry rows have seen a hundred summers. They've never seen anything like this.`,
    `Word is the Hellfire Club has a table tonight. Say nothing.`,
    `Max FC's academy motto: three sides, no excuses.`,
    `Dampy the Dolphin reminds everyone: hydrate, and splash responsibly.`,
    `Hydration check from Dampy the Dolphin — even the announcer takes a sip. Especially the announcer.`,
    `Dampy's official ruling: water breaks are mandatory, splashing is a privilege.`,
    `These players are gassed. Dampy has seen this before — dehydration, folks. The dolphin is never wrong.`,
    `Rachel has the packing list, the snack bag, and the final say. The officials should be so organized.`,
    `Somewhere Rachel is turning this match into a field trip with historical context.`,
    `An ambitious dinner in the oven, four kids loose, a puppy at large — Rachel manages harder fixtures than this nightly.`,
    `The tactical engineer built this universe hoping for order. The universe had other plans.`,
    `Jupiter clocked that formation change before the announcer did. Scouting eye of a future professional.`,
    `Jupiter finds hidden military history on every family trip. A back line holds no secrets from that kid.`,
    `Maximus has quietly calculated the perfect pass from the stands. He's waiting for the players to catch up.`,
    `Halftime trivia from Maximus: this pitch's geometry traces to a Danish artist in 1962. The kid simply knows things.`,
    `Solana has formally requested a dramatic horse entrance for the next substitution. Petition under review.`,
    `Sparkle check from Solana: this kit combination passes. Barely.`,
    `A word on the Sparkle Princesses: the tutus are decorative. The tackling is not.`,
    `Scouting report on Solana Burns: fearless, sparkly, and genuinely dangerous. In that order.`,
    `Orion, Morale Officer of the Baby Chaos Division, is toddling toward a restricted area. Security is charmed and helpless.`,
    `Three objects have vanished from the technical area. The Morale Officer knows nothing.`,
    `Orion commands the entire household without complete sentences. Same energy as the best captains, honestly.`,
    `Sheet-pan kielbasa night at the farm. The aroma reaches the cheap seats.`,
    `A packed van, one forgotten water bottle, and a prayer — every great family adventure, and most away matches.`,
    `Emergency snacks deployed in the family section. Crisis averted.`,
    `Smoothies and oatmeal built these young athletes. Protein built their father.`,
    `Champoeg one weekend, Fort Vancouver the next — this family treats history like a season ticket.`,
    `The leopard gecko will watch the highlights later. Cold-blooded, but a supporter.`,
    `A prayer before big adventures is family tradition. Tonight, the defenders clearly joined in.`,
    `The 91 Bulldogs are LOUD in the school section. Whiskey Hill Road emptied out for this one.`,
    `Word from Whiskey Hill Road: the Bulldogs have called dibs on the champions for show-and-tell.`,
    `Those two defenders are marking each other again. To be precise: each other. Thomson and Thompson live on.`,
    `That back line is investigating the danger like Thomson and Thompson at a crime scene. Nothing will be found.`,
    `Captain Haddock would have words for that one. Ten thousand thundering typhoons of them.`,
    `A chase worthy of Tintin and Snowy — over the hoardings and off into adventure.`,
    `Professor Calculus reports the match is drifting slightly to the west. The pendulum never lies.`,
    `Coaches Eric and Dan will be reviewing this footage. Jupiter's first touch says he's been listening.`,
    `Eric and Dan teach it right: first touch, head up, do the next right thing.`,
    `That back line is FROZEN solid — Elsa-grade defending. Nothing's getting in.`,
    `Conceded a soft one? As the movie teaches: sometimes you simply have to let it go.`,
    `An ice palace of a defensive shape out there. Somewhere, Elsa approves.`,
    `Warm hugs at full time no matter the score — Olaf's rules, and Tactical Hugs LLC formally approves.`,
    `Somewhere a Traeger just hit temp. Priorities being tested across the valley.`,
    `You'd ride the river with this lot. Most of them, anyway.`,
    `Fine margins. Fine hexagons. Fine evening all around.`,
    // ---- the family section ----
    `Princess Solana watching from the royal box tonight. The hex bows accordingly.`,
    `Solana scored that landing a perfect ten. Gymnastics judges are the toughest crowd here.`,
    `They say Solana could ride a horse around this pitch faster than these midfielders cover it.`,
    `Jupiter's scouting report is in: he could beat this entire back line himself.`,
    `Jupiter has rebuilt this whole stadium in Lego, and frankly, his has better sight lines.`,
    `Jupiter says this reminds him of ancient battles. He would know — the kid's read everything.`,
    `Word from the touchline: Jupiter's stepover is already better than half these professionals.`,
    `Rachel's trail-run route runs past the stadium. She'd lap this midfield twice.`,
    `Rachel and the horses paused at the fence line. Even they respect a good buildup.`,
    `The whole farm runs on Rachel's schedule. This match runs on borrowed time.`,
    `Baby Orion — Chango to those who love him — just walked the length of the touchline. Standing ovation.`,
    `Chango has eaten his weight in berries and is now the loudest supporter in the ground.`,
    `Chango cheers hardest for his brothers and sister. Everything else is background noise.`,
    `The younger fans learn to walk here so that one day they can learn to swashbuckle.`,
    `Momo the barn cat watches from the rafters. Unimpressed. He's seen better footwork from mice.`,
    `Security update: Momo has cleared the stadium of rodents. Clean sheet maintained.`,
    `Momo could trap that ball dead with one paw, and everyone here knows it.`,
    `The barn is quiet tonight. Momo's on patrol, and his record speaks for itself.`,
    `Atlas has taken up position behind the goal. He believes every shot is for him.`,
    `A chocolate lab's match analysis: the ball exists, therefore it must be chased.`,
    `Atlas just did a full lap of the pitch celebrating a goal that hasn't happened yet.`,
    `Kickoff delayed momentarily in spirit — Atlas has the training cones again.`,
    `Atlas and Momo, the farm's own defensive partnership: one guards the goal, one guards the grain.`,
    // ---- gregsbrain LLC: official audio partner ----
    `Stadium audio by gregsbrain of Portland, Oregon — boutique modules, industrial-strength opinions.`,
    `My voice tonight is running through Grandpa Greg's xVox. Four-voice polyphony — one announcer, plus three of my doubts.`,
    `Grandpa Greg's dSpec analyzed that shot in the frequency domain. Verdict: all bass, no treble, straight into Row Z.`,
    `That buildup had a lovely envelope: slow attack, long sustain, heartbreaking release.`,
    `This midfield needs what Grandpa Greg's modules have — faster pitch tracking.`,
    `More patch cables in this tactical setup than a Portland synth rack, and somehow fewer surprises.`,
    `Grandpa Greg hand-assembles his modules. This back line was clearly a DIY kit with steps skipped.`,
    `That defense has a comb filter where the marking should be — everything gets through in stripes.`,
    `The crowd noise tonight: rich harmonics, aggressive modulation. Grandpa Greg would sample it.`,
    `gregsbrain firmware update just dropped. This team could use one too.`,
    // ---- Grandma Gloria, live from sunny California ----
    `Grandma Gloria has lit a candle for this back line. Frankly, they need it.`,
    `Word from sunny California: Grandma Gloria is watching, and the grandkids can do no wrong.`,
    `Grandma Gloria says a prayer at every kickoff. Tonight she said two. She knows something.`,
    `The pre-match anthem was fine, but it was no Grandma Gloria karaoke. That voice fills a parish hall.`,
    `Grandma Gloria could take this microphone and improve the broadcast instantly. Everyone knows it.`,
    `California sunshine and unconditional love — that's Grandma Gloria's scouting report on every grandchild.`,
    `Grandma Gloria loves nothing on this earth more than her grandchildren. The trophy is a distant second.`,
    // ---- the family watchlist ----
    `That tackle had John Wick energy: efficient, personal, and somebody's going to regret it.`,
    `He moves through this midfield like John Wick through a nightclub. Everyone else is furniture.`,
    `The pincer closes like a Fortnite storm — the only safe zone is wherever the leader isn't.`,
    `That defender just got sent back to the lobby.`,
    `The winners will do Fortnite dances at full time. The losers will pretend not to know them.`,
    `A save with Astro Bot precision: small, cheerful, impossibly clean.`,
    `That back line was clearly built in creative mode — lovely to look at, zero survival instincts.`,
    `Tactically speaking, he just mined straight down. Everyone knows the rule.`,
    `Diamond-tier footwork from the man on the ball.`,
    `Keepy-uppy rules in this buildup: the ball simply refuses to touch the ground.`,
    `A move so wholesome it belongs in a Bluey episode. The adults in the crowd are suspiciously misty.`,
    `Even Bandit would say that dad-strength tackle was a bit much.`,
    `Full time can't come soon enough — someone's already warming up Dance Mode.`,
    `Bingo would have scored that one. Just saying.`,
    `That striker ghosted into the box like a creeper. Nobody heard a thing until it was too late.`,
    `He respawned at his spawn point — which in this sport is the walk of shame bench.`,
    `Somebody's cranking nineties in that box — walls, ramps, and absolutely no plan.`,
    `A win tonight is a genuine Victory Royale. The dances are pre-loaded.`,
    `A first touch so clean Astro Bot would collect it as a bonus item.`,
    `Sent off on the hex means one thing: excommunicado. No services, no help, seat on the bench.`,
    `Rachel runs the farm like the Dutton Ranch — same standards, fewer felonies.`,
    `This is Dutton rules territory: protect the land, protect the lead, never sell.`,
    `No earthly explanation for that bounce. File it with Skinwalker Ranch — Rachel will want instruments on it.`,
    `Strange readings over the stadium tonight. Skinwalker Ranch strange. The cows won't look at the pitch.`,
    `That ball just changed direction for no reason at all. I'll say it: what the hell is in that mesa?`,
    `Signal dropout, weird bounces, a keeper acting spooked... folks, what is IN that mesa?`,
    `The instruments are spiking again. Somebody get Travis on the line.`,
    `The defensive line demands a shrubbery before anyone may pass. A nice one. Not too expensive.`,
    `Those two defenders have taken to shouting NI at attackers. Surprisingly effective.`,
    `A courageous retreat from midfield — Sir Robin would be proud. He bravely ran away, you know.`,
    `NOBODY expected that tactical shift. Nobody EVER expects the tactical shift.`,
    `Two fans with coconut halves are providing the gallop sounds. The commitment is admirable.`,
    `The stadium physio has examined the challenge and ruled it merely a flesh wound.`,
    `That pressing pattern was certified by the Ministry of Silly Walks this morning.`,
    `Regarding the airspeed velocity of that punt: African or European? The lab refuses to say.`,
    `Nobody press in the far corner. It's Camelot over there. A silly place.`,
    `Careful with the striker lurking in the box. That's no ordinary striker — look at the bones!`,
    `The Holy Hand Grenade has been consulted on that free-kick routine. Count to three. Not four. Not two. Three.`,
    `Instructions from the bench: lob it toward thy foe, who, being naughty in the referee's sight, shall snuff it.`,
    `And now for something completely different: several minutes of actual football.`,
    `${matchStadium} is absolutely rocking tonight.`,
    `Not a bad seat in ${matchStadium}. Several bad decisions, though.`,
    `${matchStadium}: where legends and livestock share a fence line.`,
    `They say the acoustics in ${matchStadium} carry all the way to the county road.`,
    `Groundskeeping at ${matchStadium} remains impeccable, scorch marks notwithstanding.`,
    `That winger runs on pure guzzoline. WITNESS HIM.`,
    `Shiny and chrome, that counterattack. All it needs is a flame-throwing guitar.`,
    `The back line has three prime directives: protect the goal, protect the lead, and never discuss the third.`,
    `I'd buy that buildup for a dollar.`,
    `That defender is basically a T-1000 — melts under pressure, reforms directly behind you.`,
    `Hasta la vista to THAT scoring chance.`,
    `The keeper guards that goal like it's the last water in the wasteland.`,
    `Somewhere a machine just learned what a pincer movement is. Try not to think about it.`);
  let fresh=cand.filter(l=>!recentChatter.includes(l));
  if(!fresh.length) fresh=cand;
  const line=pick(fresh);
  recentChatter.push(line); if(recentChatter.length>8) recentChatter.shift();
  lastChatterAt=rt;
  speak(line,"low");
}
function outOfBounds(k,e){
  // ── ONE STAGING PER BALL-OUT ──────────────────────────────────────────────
  // This was called 7,191 times in a single match — essentially every frame the ball was
  // outside. The crossing test fires while the ball is still travelling out, so it staged, the
  // staging was cleared or superseded, and it staged again. John watched a corner roll into the
  // stands with nothing happening, and this is why: the restart was being rebuilt from scratch
  // every frame, so it never reached stage two.
  //
  // A ball that is already out of play cannot go out of play again. One staging, until somebody
  // takes it.
  if(pendingRestart || throwPending || cornerPending || ball.fetch) return;

  // ONCE PER DEPARTURE. The ball used to be lifted inside the pitch the instant it went out, so
  // this could not fire twice for the same ball. Now it STAYS where it stopped — which is
  // outside — and the boundary check saw it there every frame and staged a fresh throw-in each
  // time. 586 in five minutes against a browser's fifteen.
  //
  // That is the fetch change's own bug, and the rebuilt harness found it within a minute of
  // being able to reach a throw-in at all.
  // OUT OF PLAY IS A TRANSITION, NOT A STATE. Once a restart has been awarded the ball is dead
  // until it is put back in, and a dead ball lying outside the line must not be awarded again
  // every frame. This is what stops the count running to six hundred; the loop that survived it
  // was a genuinely different fault, of the ball being handed to a man standing out of play.
  if(pendingRestart||ball.fetch||nowMs()<restartHold) return;
  const toucher=ball.lastTouch;
  const ex=ball.x, ey=ball.y;
  ball.vx=0; ball.vy=0; ball.z=0; ball.zv=0; ball.owner=null; ball.noClaim=null; ball.isShot=false; ball.allyPass=false; ball.flameShot=false;
  addStoppage(0.8);
  if(e.goal){
    const ownerT=GOAL_EDGE.indexOf(k);
    TEL.behindGoal++;
    if(toucher===ownerT) TEL.behindOwn++; else TEL.behindOther++;
    if(toucher===ownerT && !out[ownerT]) { TEL.corners++; stageCorner(ownerT,e,ex,ey); }
    else if(!out[ownerT]) stageGoalKick(ownerT);
    else stageThrowIn(toucher,e,ex,ey);
  } else stageThrowIn(toucher,e,ex,ey);
}
function refreshNameColors(){
  NAME_COL=players.map(p=>[p.name,TEAMS[p.team].color])
    .sort((a,b)=>b[0].length-a[0].length);
}

// THE RESTARTS. Throw-ins, goal kicks, corners and penalties: where the ball goes and who
// takes it, which is rules rather than drawing. They stayed behind in the first extraction
// because each calls spawnNote, and a classifier looking for DOM-shaped names counted that as
// touching the page. It is a hook. Found by a ninety-second headless run, where the first
// sixty seconds had simply never put the ball out of play.
function stageThrowIn(toucher,e,ex,ey){ GKSTAT.throwStage=(GKSTAT.throwStage||0)+1; TEL.throwIns++;
  if(clockSec-(GKSTAT.lastThrowAt||-99)<6&&Math.hypot(ex-(GKSTAT.lastThrowX||-999),ey-(GKSTAT.lastThrowY||-999))<70){
    GKSTAT.throwRepeat=(GKSTAT.throwRepeat||0)+1;
    GKSTAT.loopTrace=GKSTAT.loopTrace||[];
    if(GKSTAT.loopTrace.length<10) GKSTAT.loopTrace.push({
      dt:+(clockSec-GKSTAT.lastThrowAt).toFixed(2),
      toucherTeam:toucher, toucherRole:ball.lastKicker?ball.lastKicker.role:null,
      kickerName:ball.lastKicker?ball.lastKicker.name:null,
      wasThrowPass:ball.lastKicker===GKSTAT.lastThrower||null, z:+ball.z.toFixed(1)});
  }
  GKSTAT.lastThrower=null;
  GKSTAT.lastThrowAt=clockSec; GKSTAT.lastThrowX=ex; GKSTAT.lastThrowY=ey;
  restartHold=Math.max(restartHold,nowMs()+2400);   // staging owns its hold
  const sx=ex+e.nx*6, sy=ey+e.ny*6;   // he throws FROM the line, not from midfield
  // NEAREST TO WHERE HE MUST STAND, not to the mark. A thrower stands 22 units OUTSIDE the
  // line and the ball sits on it — sorting by distance to the ball picked a man who then had a
  // hundred-unit walk to his own position, which is a two-second stall after the ball is already
  // in place. The trace showed exactly that: ballToMark 6, meToBall 105.
  const odx0=sx-CX, ody0=sy-CY, ol0=Math.hypot(odx0,ody0)||1;
  const spot0={ x:sx+odx0/ol0*22, y:sy+ody0/ol0*22 };
  const cands=players.filter(q=>q.team!==toucher&&q.role!=="K"&&!q.out&&!q.sentOff)
    .sort((a,b)=>dist(a,spot0)-dist(b,spot0));
  const thr=cands[0];
  if(!thr){ telPort('throw-in: nobody to take it'); ball.x=CX; ball.y=CY; return; }
  // ── THE BALL STAYS WHERE IT WENT OUT ──────────────────────────────────────
  // It used to be lifted to the throw spot the instant the ball crossed the line — from wherever
  // it had run to, which is fifteen jumps of up to three hundred units a match and the single
  // largest source of the ball teleporting.
  //
  // Now somebody fetches it. The ball sits exactly where it stopped, the nearest man walks over,
  // and PLAY CONTINUES AROUND HIM — no hold, no freeze, no waiting for a whistle. That is what a
  // throw-in looks like: the game breathes while one player jogs to the touchline.
  //
  // The hold, if there is one, is however long it takes him to get there. No cap and no cheating
  // the speed: if that turns out to be too much standing about we will see it in the dead-time
  // number and can decide then.
  // REVERTED TO PLACING THE BALL. The fetch version looped: the thrower stands 20 units OUTSIDE
  // the line, the ball rode him there, and a ball outside the line is a ball out of play — so it
  // went out again the moment he picked it up, and again, and again.
  //
  // The guard against re-staging did not help because each throw genuinely DID put the ball out;
  // it was not a double-count, it was a real loop.
  //
  // A teleport is worse than a fetch and far better than a game that cannot restart. The idea is
  // right and it needs the thrower and the ball to end up on opposite sides of the line, which is
  // the part I did not think through.
  // ── THE BALL STAYS WHERE IT WENT OUT ──────────────────────────────────────
  // Somebody fetches it. What broke this the first time was not the fetching — it was that the
  // ball ended up ON the thrower, and a thrower stands twenty units OUTSIDE the line. A ball
  // outside the line is out of play, so it went out again the instant he picked it up.
  //
  // THE RULE THE LOOP VIOLATED: the ball waits on the MARK, six inside the line, and the thrower
  // steps behind it. They are on opposite sides of the chalk — that is what a throw-in IS, and
  // it is why the original placing version never looped.
  //
  // So he fetches it, carries it, and puts it DOWN ON THE MARK. He does not keep hold of it.
  ball.owner=null;
  ball.vx=0; ball.vy=0; ball.z=0; ball.zv=0;
  ball.fetch={ by:thr, sx, sy, team:thr.team, at:clockSec };
  pendingRestart={ kind:'throw', at:clockSec, p:thr, x:sx, y:sy, team:thr.team, fetch:true,
                  cap:nowMs()+20000, readyAt:nowMs()};
  suppress={team:toucher,until:clockSec+0.8};
  ENGINE_HOOKS.spawnNote(sx,sy-24,"throw-in!",TEAMS[thr.team].color,TEAMS[thr.team].accent);
  if(RNG_COS()<0.4) sayLogged(pick([
    `Out of play — throw-in ${tm(thr.team)}, quickly taken.`,
    `Into touch. ${thr.name} hurls it back in for ${tm(thr.team)}.`,
    `${tm(thr.team)} with the throw — no time wasted.`,
    `Over the line! ${thr.name} takes it quickly.`]));
  restartHold=nowMs()+2200;   // shortened the moment the taker arrives
}
function stageGoalKick(t){
  const gk=players.find(q=>q.team===t&&q.role==="K"&&!q.out);
  if(!gk){ telPort('goal kick: no keeper'); ball.x=CX; ball.y=CY; return; }
  ball.owner=null; ball.lastTouch=t; ball.lastKicker=gk;
  // THE GOAL KICK. Untagged until now, which is a large part of the fourteen teleports the
  // report could see but not name: the ball is lifted from wherever it went out and placed on
  // the keeper, which from the far corner is most of the width of the pitch.
  // ── THE LAST TELEPORT ─────────────────────────────────────────────────────
  // This put the ball in the keeper's gloves wherever he stood. John: "he'll be on the right
  // side of the goal, there's a shot wide of the left, and suddenly the keeper is holding it."
  // A save that never happened.
  //
  // The ball goes on the six-yard line and he walks to it, like every other restart.
  const og9=goalCenter(t);
  const gkSpot={ x: og9.x + (CX-og9.x)*0.15, y: og9.y + (CY-og9.y)*0.15 };
  ball.x=gkSpot.x; ball.y=gkSpot.y; ball.z=0; ball.vx=0; ball.vy=0; ball.zv=0; ball.touchT=0.4;
  pendingRestart={ kind:'goalkick', at:clockSec, p:gk, x:gkSpot.x, y:gkSpot.y, team:t };
  ENGINE_HOOKS.spawnNote(gk.x,gk.y-24,"goal kick",TEAMS[t].color,TEAMS[t].accent);
  if(RNG_COS()<0.35) sayLogged(pick([
    `Behind for a goal kick — ${tm(t)} restart.`,
    `${gk.name} places it for the goal kick. Deep breath.`,
    `Nothing doing — goal kick ${tm(t)}.`,
    `All the way through for a goal kick. ${gk.name} resets the board.`]));
  restartHold=nowMs()+650;
}
function stageCorner(ownerT,e,ex,ey){
  restartHold=Math.max(restartHold,nowMs()+2400);   // staging owns its hold
  const alive=[0,1,2].filter(x=>x!==ownerT&&!out[x]);
  const att=alive.find(x=>targets[x]===ownerT)??alive[0];
  if(att===undefined){ telPort('corner: nobody to take it'); ball.x=CX; ball.y=CY; return; }
  const vtx=dist({x:e.p1.x,y:e.p1.y},{x:ex,y:ey})<dist({x:e.p2.x,y:e.p2.y},{x:ex,y:ey})?e.p1:e.p2;
  const taker=players.filter(q=>q.team===att&&q.role!=="K"&&!q.out&&!q.sentOff)
    .sort((a,b)=>dist(a,vtx)-dist(b,vtx))[0];
  if(!taker){ stageGoalKick(ownerT); return; }
  // ON THE CORNER. This was 14 units INSIDE the vertex — which is not the corner, it is a spot
  // near it, and a corner taken from a spot near the corner is a free kick. The flag is the
  // vertex; the ball goes on the vertex.
  const cx2=vtx.x, cy2=vtx.y;
  // ── THE BALL ROLLS TO THE FLAG, IT IS NOT PLACED THERE ────────────────────
  // Same as a throw-in with one difference that matters: A CORNER IS TAKEN FROM THE GROUND. He
  // does not pick it up, so there is nothing to carry — he dribbles it to the flag, which is
  // slower and looks like what it is.
  //
  // The ball stays where it went out. He walks to it, then nudges it across, and only when it is
  // on the arc does the ceremony start.
  ball.owner=null;
  ball.vx=0; ball.vy=0; ball.z=0; ball.zv=0;
  ball.fetch={ by:taker, sx:cx2, sy:cy2, team:att, at:clockSec, ground:true };
  pendingRestart={ kind:'corner', at:clockSec,p:taker, x:cx2, y:cy2, team:att, fetch:true, ground:true,
                  cap:nowMs()+20000, readyAt:nowMs()};
  cornerTaker=taker; cornerGoal=ownerT;
  // The ceremony starts when the ball reaches the flag, not when the corner is awarded — he
  // has to walk there first, and the box should fill while he does rather than before.
  restartHold=Math.max(restartHold,nowMs()+2900);   // corners earn a longer ceremony GKSTAT.cornerStage=(GKSTAT.cornerStage||0)+1;
  ENGINE_HOOKS.spawnNote(taker.x,taker.y-26,"corner!",TEAMS[att].color,TEAMS[att].accent);
  sayLogged(pick([
    `<b style="color:${TEAMS[att].color}">Corner to ${tm(att)}</b> — ${taker.name} to swing it in...`,
    `<b style="color:${TEAMS[att].color}">Corner ${tm(att)}!</b> Big bodies forward... ${taker.name} over the flag.`,
    `<b style="color:${TEAMS[att].color}">Corner to ${tm(att)}</b> — the box fills. ${taker.name} whips it...`,
    `<b style="color:${TEAMS[att].color}">Corner!</b> ${taker.name} raises an arm... here it comes...`]),true);
  restartHold=nowMs()+2600;   // shortened once he's over the ball
}
function stagePenalty(){
  // ── THE PENALTY IS A RESTART, NOT A TABLEAU ───────────────────────────────
  // This teleported FIFTEEN PLAYERS in one frame: the ball to the spot, the shooter behind it,
  // the keeper onto his line, and everybody else shoved to a radius of 178.
  //
  // It is the moment in a match most worth watching and it was the one that snapped hardest.
  // Now: the ball is placed, the shooter walks to it, the keeper walks to his line, and
  // everybody else clears the box under `positioning for a restart` — which already does
  // exactly this job for throws and corners.
  const pen=pendingPenalty; pendingPenalty=null;
  const shooter=pen.shooter, conceder=pen.conceder;
  if(out[conceder]||shooter.out) return;
  const e=EDGES[GOAL_EDGE[conceder]], g=goalCenter(conceder);
  const sx=g.x+e.nx*110, sy=g.y+e.ny*110;

  // the ball is placed. Nothing else moves.
  ball.owner=null; ball.lastTouch=shooter.team; ball.lastKicker=shooter;
  ball.x=sx; ball.y=sy; ball.vx=0; ball.vy=0; ball.z=0; ball.zv=0;
  ball.touchT=99;                       // no dribble touches during the run-up

  pendingRestart={ kind:'penalty', at:clockSec, p:shooter, x:sx, y:sy, team:shooter.team };
  players.forEach(q=>{ q.penGuess=null; });   // a fresh guess for a fresh penalty
  penaltyShooter=shooter; penaltyGoalTeam=conceder;
  ENGINE_HOOKS.spawnNote(sx,sy-28,"PENALTY!","#ffd166");
  sayLogged(pick([
    `${shooter.name} places the ball on the spot... the keeper crouches...`,
    `${shooter.name} steps up. The stadium holds its breath...`,
    `Twelve yards between ${shooter.name} and glory. The keeper waits...`,
    `${shooter.name} takes a long breath and starts the run-up...`]),true);
  resumeAt=nowMs()+1000;
}
