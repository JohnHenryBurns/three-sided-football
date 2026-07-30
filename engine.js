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
  stoppageLen=Math.min(55,matchLen*0.2)*(0.85+Math.random()*0.3);
  notes.forEach(n=>n.e.remove()); notes=[];
  ENGINE_HOOKS.clearMarks();   // the page throws away its own pings and notes
  boostUntil=[0,0,0]; lastPossessTeam=null; lastPossessComment=-99; lastFatigueComment=0; lastColorComment=0;
  for(let t=0;t<3;t++) formation(t).forEach((f,i)=>players.push(
    {team:t,role:f.role,name:TEAMS[t].roster[i],x:f.x,y:f.y,vx:0,vy:0,stamina:1,burst:1,sprint:null,deniedLatch:false,sprintMin:0,sprintCd:0,
     k1:0.64+Math.random()*0.10, k2:0.82+Math.random()*0.16,  // unique spring constants
     hx:0,hy:0, goals:0,tackles:0,saves:0, yellows:0,sentOff:false}));                                             // smoothed heading for ball carry
  ball={x:CX,y:CY,vx:0,vy:0,owner:null,lastTouch:null,lastKicker:null,isShot:false,noClaim:null,noClaimF:0,
    touchT:0,strayer:null,strayF:0,z:0,zv:0};
  computeTargets();
  const first=Math.floor(Math.random()*3);
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
const GOAL_EDGE=[0,2,4], GOAL_HALF=0.21;
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
function applyPresets(t){
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
function pick(a){return a[Math.floor(Math.random()*a.length)];}

// The centre circle, which nothing used to respect. In two-goal football only the side kicking
// off may stand inside it; the same rule here just has two sets of opponents to hold back rather
// than one.
const CIRCLE_R = 70;

function kickoff(toTeam){
  let i=0;
  for(let t=0;t<3;t++){ formation(t).forEach(f=>{const p=players[i++]; p.x=f.x;p.y=f.y;p.vx=0;p.vy=0;}); }
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
  if(Math.random()>0.6)return;
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
  if(gk.burst>0.6&&(flame||Math.random()<0.12)){
    gk.burst-=0.6; gk.diveUntil=clockSec+1.2;
    GKSTAT.diveBurns=(GKSTAT.diveBurns||0)+1;
    ENGINE_HOOKS.flamePop(gk);
    if(flame){
      GKSTAT.duels=(GKSTAT.duels||0)+1;
      sayLogged(pick([
        `FIRE MEETS FIRE — both tanks emptied in one heartbeat!`,
        `${gk.name} answers the flame with a flame of ${PRN(gk).his} own!`,
        `A duel! Burning shot, burning dive — somebody's fire dies here!`]),true,"lowvoice");
    } else if(Math.random()<0.4){
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
function kick(tx,ty,power,isShot){
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
  const chaser=[];
  for(let t=0;t<3;t++){
    let best=null,bd=1e9;
    players.forEach(p=>{ if(p.team===t&&(p.role!=="K"||FL[t]===0)&&!p.out&&!p.sentOff){const d=dist(p,ball); if(d<bd){bd=d;best=p;}}});
    chaser[t]=best;
  }
  players.forEach(p=>{
    if(p.out||p.sentOff||targets[p.team]===null)return;
    if(pendingRestart){
      const R=pendingRestart;
      if(p===R.p){
        // throwers take their mark BEHIND the chalk; corner and goal-kick takers stand on their spot
        let sx8=R.x, sy8=R.y;
        if(cornerTaker!==p&&p.role!=="K"){
          // FULLY BEHIND THE CHALK. This was 9, and the ball sits 6 INSIDE the line — so a
          // thrower with an 11-unit body ended up straddling it, standing half on the pitch to
          // take a throw-in. 20 puts his whole body outside, which is the rule and is also what
          // makes the restart read as a restart rather than a pass.
          //
          // He steps back over once the ball leaves him, because this only applies while
          // pendingRestart names him.
          const odx=R.x-CX, ody=R.y-CY, ol=Math.hypot(odx,ody)||1;
          sx8=R.x+odx/ol*20; sy8=R.y+ody/ol*20;
        }
        steer(p,sx8,sy8,2.6);
        if((dist(p,{x:sx8,y:sy8})<10&&nowMs()>(R.readyAt||0))||nowMs()>R.cap){
          p.x=sx8; p.y=sy8; p.vx=0; p.vy=0;
          ball.owner=p; ball.lastTouch=p.team; ball.lastKicker=p; ball.touchT=0.4;
          restartHold=nowMs()+(cornerTaker===p?500:260);
          if(cornerTaker!==p){ throwPending=p; GKSTAT.lastThrower=p; }   // a throw must find a teammate
          pendingRestart=null;
        }
        return;
      }
    }
    if(gkHolding()&&p.team===ball.owner.team&&p!==ball.owner&&p.role!=="K"){
      // spread into outlet positions: the roll should never have to go backwards
      const og3=goalCenter(p.team);
      const ax=CX-og3.x, ay=CY-og3.y, al=Math.hypot(ax,ay)||1;
      const ux3=ax/al, uy3=ay/al, px3=-uy3, py3=ux3;
      const depth=(p.role==="D"?0.62:p.role==="M"?0.95:1.25);   // outlets sit AHEAD of shape, not behind it
      const lat=((p.k1*997)%1-0.5)*340;
      steer(p, og3.x+ux3*al*depth+px3*lat, og3.y+uy3*al*depth+py3*lat, 1.25);
      return;
    }
    if(gkHolding()&&p.team!==ball.owner.team&&p.role!=="K"){
      // coached response to a keeper hold — jobs, not a repulsion ring
      // (the old 64-in/72-out ring fought the chase logic at its boundary: judder)
      const gk2=ball.owner, og5=goalCenter(p.team);
      const ax5=CX-og5.x, ay5=CY-og5.y;
      if(allied(p.team,gk2.team)){
        // no pressing a friend's keeper — drop into your own shape
        steer(p, og5.x+ax5*0.55, og5.y+ay5*0.55, 0.9); return;
      }
      if(p.role==="D"){
        // retreat: get depth to defend the long ball
        const pl5=Math.hypot(ax5,ay5)||1, px5=-ay5/pl5, py5=ax5/pl5;
        const lat6=((p.k1*997)%1-0.5)*240;
        steer(p, og5.x+ax5*0.34+px5*lat6, og5.y+ay5*0.34+py5*lat6, 1.15); return;
      }
      // M/F: cover the roll lanes — stand between the keeper and his outlets
      const outs=players.filter(m=>m.team===gk2.team&&m.role!=="K"&&!m.out&&!m.sentOff);
      if(outs.length){
        const o5=outs[Math.floor(((p.k1*769)%1)*outs.length)%outs.length];
        let lx=gk2.x+(o5.x-gk2.x)*0.62, ly=gk2.y+(o5.y-gk2.y)*0.62;
        const dgk=Math.hypot(lx-gk2.x,ly-gk2.y);
        if(dgk<85){ lx=gk2.x+(lx-gk2.x)/(dgk||1)*85; ly=gk2.y+(ly-gk2.y)/(dgk||1)*85; }
        GKSTAT.laneCover=(GKSTAT.laneCover||0)+1;
        steer(p,lx,ly,1.2); return;
      }
      steer(p,CX,CY,0.9); return;
    }
    if(holdActive){
      const rx=pendingRestart?pendingRestart.x:ball.x, ry=pendingRestart?pendingRestart.y:ball.y;
      const rteam=pendingRestart?pendingRestart.team:(ball.owner?ball.owner.team:-1);
      GKSTAT.holdEnter=(GKSTAT.holdEnter||0)+1;
      const isThrow=pendingRestart&&pendingRestart.p&&pendingRestart.p!==cornerTaker&&pendingRestart.p.role!=="K";
      if(isThrow)GKSTAT.isThrowFrames=(GKSTAT.isThrowFrames||0)+1;
      const isCorner=cornerTaker&&pendingRestart&&pendingRestart.p===cornerTaker;
      if(isThrow&&p.team===rteam&&p!==pendingRestart.p&&p.role!=="K"){
        // receiving lanes: staggered infield options, not a shuffle on the line
        const inx=CX-rx, iny=CY-ry, il=Math.hypot(inx,iny)||1;
        const nix=inx/il, niy=iny/il, pux=-niy, puy=nix;
        GKSTAT.laneSteer=(GKSTAT.laneSteer||0)+1;
        const lat2=((p.k1*997)%1-0.5)*260;
        const dep2=70+((p.k2*613)%1)*95;
        steer(p, rx+nix*dep2+pux*lat2, ry+niy*dep2+puy*lat2, 1.35);
        return;
      }
      if(isThrow&&p.team!==rteam&&p.role!=="K"&&allied(p.team,rteam)){
        // allied third team: deep supplementary outlets across battle lines
        const inx=CX-rx, iny=CY-ry, il=Math.hypot(inx,iny)||1;
        const nix=inx/il, niy=iny/il, pux=-niy, puy=nix;
        const lat5=((p.k1*733)%1-0.5)*330;
        const dep5=140+((p.k2*541)%1)*90;
        steer(p, rx+nix*dep5+pux*lat5, ry+niy*dep5+puy*lat5, 1.15);
        return;
      }
      if(isThrow&&p.team!==rteam&&p.role!=="K"){
        // coached marking: pick a lane runner and shadow the passing line
        const recs=players.filter(m=>m.team===rteam&&m!==pendingRestart.p&&!m.out&&!m.sentOff&&m.role!=="K");
        if(recs.length){
          const r2=recs[Math.floor(((p.k1*769)%1)*recs.length)%recs.length];
          const dx4=rx-r2.x, dy4=ry-r2.y, dl4=Math.hypot(dx4,dy4)||1;
          let mx=r2.x+dx4/dl4*26, my=r2.y+dy4/dl4*26;
          const dspot=Math.hypot(mx-rx,my-ry);
          if(dspot<54){ mx=rx+(mx-rx)/dspot*54; my=ry+(my-ry)/dspot*54; }   // ring respected
          steer(p,mx,my,1.25); return;
        }
      }
      if(isCorner&&p!==cornerTaker&&p.role!=="K"){
        const g4=goalCenter(cornerGoal), e4=EDGES[GOAL_EDGE[cornerGoal]];
        const u4x=-e4.ny, u4y=e4.nx;
        if(p.team===rteam){
          // attackers flood the mouth: big bodies forward, staggered slots
          const lat4=((p.k1*883)%1-0.5)*e4.len*GOAL_HALF*1.5;
          const dep4=30+((p.k2*577)%1)*42;
          steer(p, g4.x+e4.nx*dep4+u4x*lat4, g4.y+e4.ny*dep4+u4y*lat4, 1.75); return;
        }
        if(p.team===cornerGoal){
          // defenders pack the near zone, goal-side of the flood
          const lat4=((p.k1*883)%1-0.5)*e4.len*GOAL_HALF*1.2;
          const dep4=16+((p.k2*577)%1)*18;
          steer(p, g4.x+e4.nx*dep4+u4x*lat4, g4.y+e4.ny*dep4+u4y*lat4, 1.45); return;
        }
        if(allied(p.team,rteam)){
          // allied third team: second wave at the edge of the mix
          const lat4=((p.k1*733)%1-0.5)*e4.len*GOAL_HALF*1.9;
          const dep4=62+((p.k2*541)%1)*40;
          GKSTAT.allySiege=(GKSTAT.allySiege||0)+1;
          steer(p, g4.x+e4.nx*dep4+u4x*lat4, g4.y+e4.ny*dep4+u4y*lat4, 1.2); return;
        }
        // third team: counter stations near midfield — vultures with patience
        const og4=goalCenter(p.team);
        steer(p, og4.x+(CX-og4.x)*0.85, og4.y+(CY-og4.y)*0.85, 1.0); return;
      }
      if(p.team!==rteam){
        const dd2=Math.hypot(p.x-rx,p.y-ry);
        if(dd2<46){
          let tx2=rx+(p.x-rx)/(dd2||1)*54, ty2=ry+(p.y-ry)/(dd2||1)*54;
          for(const e2 of EDGES){                       // never ask a man to stand off the pitch
            const de=(tx2-e2.p1.x)*e2.nx+(ty2-e2.p1.y)*e2.ny;
            if(de<20){ tx2+=e2.nx*(20-de); ty2+=e2.ny*(20-de); }
          }
          steer(p, tx2, ty2, 2.0); return;
        }
      }
    }
    // ---- burst decisions: when to spend the legs ----
    {
      let want=null;
      const bd7=dist(p,ball);
      if(!ball.owner&&ball.z<20&&bd7<200){
        let rival=1e9;
        players.forEach(q=>{ if(q!==p&&!q.out&&!q.sentOff&&q.team!==p.team) rival=Math.min(rival,dist(q,ball)); });
        const margin=Math.abs(bd7-rival);
        // a race is a DEAD HEAT on a settled ball — everything else is jogging
        if(margin<22&&bd7<170&&bd7<rival+30&&Math.hypot(ball.vx,ball.vy)<6){
          let mateNearer=false;
          players.forEach(q=>{ if(q.team===p.team&&q!==p&&!q.out&&!q.sentOff&&dist(q,ball)<bd7) mateNearer=true; });
          if(!mateNearer) want="race";                          // one racer per team — the nearest
        }
      }
      if(!want&&ball.owner&&ball.owner.team!==p.team&&p.role!=="K"){
        const og7=goalCenter(p.team);
        if(dist(ball.owner,og7)<260&&dist(p,ball.owner)<300){
          let nearer=false;
          players.forEach(q=>{ if(q.team===p.team&&q!==p&&!q.out&&!q.sentOff&&q.role!=="K"
            &&dist(q,ball.owner)<dist(p,ball.owner)) nearer=true; });
          if(!nearer) want="emerg";                             // last man: close him down NOW
        }
      }
      if(!want&&!ball.owner&&ball.z>34&&Math.hypot(ball.vx,ball.vy)>3.5&&bd7<260){
        let mateNearer=false;                                   // true punts only — one chaser per team
        players.forEach(q=>{ if(q.team===p.team&&q!==p&&!q.out&&!q.sentOff&&dist(q,ball)<bd7) mateNearer=true; });
        if(!mateNearer) want="landing";
      }
      if(want&&!p.sprint&&clockSec>p.sprintCd){
        if(p.burst>0.65){
          p.sprint={why:want,blaze:Math.random()<0.12}; p.sprintMin=clockSec+0.5;   // commit — and 1-in-8 lights the FULL fire
          if(p.sprint.blaze) blazeCall(p);
          GKSTAT.bursts=(GKSTAT.bursts||0)+1; GKSTAT["b_"+want]=(GKSTAT["b_"+want]||0)+1;
          p.deniedLatch=false;
        } else if(!p.deniedLatch){                              // wanted the legs, tank said no
          GKSTAT.denied=(GKSTAT.denied||0)+1; p.deniedLatch=true;
        }
      }
      if(!want) p.deniedLatch=false;
      if(p.sprint&&clockSec>p.sprintMin){                       // hysteresis: release only when resolved
        const w=p.sprint.why;
        let done=false;
        if(w==="race"&&(ball.owner||dist(p,ball)>320)) done=true;
        else if(w==="emerg"&&(!ball.owner||ball.owner.team===p.team)) done=true;
        else if(w==="landing"&&(ball.owner||(ball.z<4&&dist(p,ball)>200))) done=true;
        else if(w==="sweep"&&ball.owner) done=true;
        if(done){ p.sprint=null; p.sprintCd=clockSec+2.2; }     // cooldown: claims flicker, sprints shouldn't
      }
      if(p.sprint){ GKSTAT.burstSec=(GKSTAT.burstSec||0)+dt;
        GKSTAT.sprintDist=(GKSTAT.sprintDist||0)+Math.hypot(p.vx,p.vy)*dt*60; }
    }
    const own=goalCenter(p.team), tgt=goalCenter(targets[p.team]);
    if(p===owner){
      let near=null,nd=1e9;
      oppOf(p.team).forEach(o=>{const d=dist(o,p); if(d<nd){nd=d;near=o;}});
      let dx=tgt.x-p.x, dy=tgt.y-p.y; let dl=Math.hypot(dx,dy)||1; dx/=dl;dy/=dl;
      if(near&&nd<60){ dx+=(p.x-near.x)/nd*0.9; dy+=(p.y-near.y)/nd*0.9; }
      // wall awareness: cut infield instead of grinding the touchline
      let wd=1e9,we=null;
      for(const e2 of EDGES){const d2=(p.x-e2.p1.x)*e2.nx+(p.y-e2.p1.y)*e2.ny; if(d2<wd){wd=d2;we=e2;}}
      const inMouth=we&&we.goal&&we===EDGES[GOAL_EDGE[targets[p.team]]]&&
        Math.abs((p.x-we.mx)*we.ux+(p.y-we.my)*we.uy)<we.len*GOAL_HALF*1.3;
      const wallR=oobRule?95:70, wallW=oobRule?1.6:1.1;
      if(wd<wallR&&!inMouth){ const w=(wallR-wd)/wallR*wallW; dx+=we.nx*w; dy+=we.ny*w; }
      steer(p,p.x+dx*80,p.y+dy*80,2.05);
    } else if(p.role==="K"&&(FL[p.team]>0||dist(ball,goalCenter(p.team))<210)){
      if(!ball.owner&&!holdActive){
        const og2=goalCenter(p.team), bd2=dist(ball,og2);
        if(bd2<190){
          let oppNear=1e9;
          players.forEach(q=>{ if(q.team!==p.team&&!q.out&&!q.sentOff&&q.role!=="K")
            oppNear=Math.min(oppNear,dist(q,ball)); });
          if(dist(p,ball)<oppNear-18||oppNear>120){
            if(!p.sprint&&p.burst>0.25){ p.sprint={why:"sweep",blaze:Math.random()<0.12}; GKSTAT.b_sweep=(GKSTAT.b_sweep||0)+1;
              if(p.sprint.blaze) blazeCall(p); }
            GKSTAT.sweepSec+=dt; steer(p,ball.x,ball.y,1.5); return; }
        }
      }
      const e=EDGES[GOAL_EDGE[p.team]];
      let along=(ball.x-e.mx)*e.ux+(ball.y-e.my)*e.uy;
      const lim=e.len*GOAL_HALF*0.9; along=Math.max(-lim,Math.min(lim,along));
      steer(p, e.mx+e.ux*along+e.nx*20, e.my+e.uy*along+e.ny*20, 1.9);
      if(dist(p,ball)<55 && (!owner||owner.team!==p.team)) steer(p,ball.x,ball.y,2.3);
    } else if(p===chaser[p.team] && (!owner || owner.team!==p.team)){
      if(holdActive&&owner){
        const dx3=p.x-ball.x, dy3=p.y-ball.y, d3=Math.hypot(dx3,dy3)||1;
        steer(p, ball.x+dx3/d3*52, ball.y+dy3/d3*52, 1.9);   // prowl the ten yards
      } else
      steer(p, ball.x+ball.vx*6, ball.y+ball.vy*6, 2.15+0.4*T(p.team).press);
    } else if(p.role==="D"){
      const ds=players.filter(q=>q.team===p.team&&q.role==="D");
      const idx=ds.indexOf(p), TT=T(p.team), lineShift=(TT.line-0.5)*0.22;
      let f=(idx===0?0.38:0.62)+lineShift;
      if(TT.bunker>0.5) f=(idx===0?0.28:0.48)+lineShift*0.5;
      const bx=own.x+(ball.x-own.x)*f, by=own.y+(ball.y-own.y)*f;
      const e=EDGES[GOAL_EDGE[p.team]];
      steer(p, bx+e.ux*(idx===0?34:-34), by+e.uy*(idx===0?34:-34), 2.0);
    } else {
      const TT=T(p.team);
      if(TT.bunker>0.5&&p.role==="M"){    // bus: the mid drops in (partial — the refund)
        steer(p, own.x+(ball.x-own.x)*0.62, own.y+(ball.y-own.y)*0.62, 2.0);
        return;
      }
      if(TT.bunker>0.5&&p.role==="F"){    // lone outlet holds the counter station
        steer(p,(own.x+tgt.x)/2,(own.y+tgt.y)/2,2.0);
        return;
      }
      const f=p.role==="M"?0.45:(0.72+(TT.direct-0.5)*0.26);
      let sx=ball.x+(tgt.x-ball.x)*f, sy=ball.y+(tgt.y-ball.y)*f;
      const side=(p.role==="M"?1:-1);
      // fan out as play compresses near the target goal — width instead of pile-in
      const dBallGoal=dist(ball,tgt);
      const spread=55+Math.max(0,(230-dBallGoal))*0.45;
      const ang=Math.atan2(tgt.y-ball.y,tgt.x-ball.x)+Math.PI/2;
      sx+=Math.cos(ang)*spread*side; sy+=Math.sin(ang)*spread*side;
      steer(p,sx,sy,2.0);
    }
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
  if(owner){
    if(holdActive){ owner.vx*=0.85; owner.vy*=0.85; return; }
    if(throwPending===owner){
      throwPending=null;
      const mates=players.filter(m=>m.team===owner.team&&m!==owner&&!m.out&&!m.sentOff);
      let pickM=null,bs=-1e9;
      mates.forEach(m=>{
        const d=dist(m,owner); if(d<40||d>240)return;
        let open3=1e9;                              // the loft sails OVER the lane — score the landing, not the path
        players.forEach(o2=>{ if(o2.team===owner.team||o2.out||o2.sentOff||o2.role==="K")return;
          open3=Math.min(open3,dist(o2,m)); });
        const sc=Math.min(open3,110)*0.9-d*0.25+Math.random()*20;
        if(sc>bs){bs=sc;pickM=m;}
      });
      if(!pickM&&mates.length) pickM=mates.sort((a,b)=>dist(a,owner)-dist(b,owner))[0];
      if(!pickM){
        const allies=players.filter(m=>allied(owner.team,m.team)&&!m.out&&!m.sentOff&&m.role!=="K"
          &&dist(m,owner)>40&&dist(m,owner)<260)
          .sort((a,b)=>dist(a,owner)-dist(b,owner));
        if(allies.length){ pickM=allies[0]; }
      }
      if(pickM){
        kick(pickM.x+pickM.vx*4, pickM.y+pickM.vy*4, Math.min(6.2,3.2+dist(pickM,owner)*0.015), false);
        ball.zv=2.4;                                // the arc carries it — power dialed for flight, not friction
        if(allied(owner.team,pickM.team)) ball.allyPass=true;
        return;
      }
      // truly alone in the world — he plays on himself, dribbling in
      return;
    }
    if(cornerTaker===owner){
      cornerTaker=null;
      const e2=EDGES[GOAL_EDGE[cornerGoal]], g=goalCenter(cornerGoal);
      GKSTAT.cornerDel=(GKSTAT.cornerDel||0)+1;
      players.forEach(q=>{ if(q.out||q.sentOff||q.role==="K")return;
        const dg=dist(q,g);
        if(q.team===owner.team&&dg<150)GKSTAT.cornerAtk=(GKSTAT.cornerAtk||0)+1;
        if(q.team===cornerGoal&&dg<110)GKSTAT.cornerDef=(GKSTAT.cornerDef||0)+1;
        if(q.team!==owner.team&&q.team!==cornerGoal&&allied(q.team,owner.team)&&dg<170)GKSTAT.cornerAllyIn=(GKSTAT.cornerAllyIn||0)+1; });
      const nearSign=Math.sign((owner.x-g.x)*e2.ux+(owner.y-g.y)*e2.uy)||1;
      const farPost=Math.random()<0.45;
      const off2=farPost
        ? -nearSign*e2.len*GOAL_HALF*(0.5+Math.random()*0.25)   // whipped to the FAR stick
        : (Math.random()*2-1)*e2.len*GOAL_HALF*0.7;
      const txc=g.x+e2.ux*off2+e2.nx*44, tyc=g.y+e2.uy*off2+e2.ny*44;
      kick(txc,tyc,6.8,false);
      // A corner should clear the defenders it is aimed over: 3.6 peaks at 46, above every
      // head on the pitch, where 2.8 peaked at 28 and arrived at chest height.
      ball.zv=3.6;                       // it swings in high, whatever the distance
      if(farPost){ GKSTAT.farPost=(GKSTAT.farPost||0)+1;
        if(Math.random()<0.6) sayLogged(pick([
          `Coach Eric's voice carries clear across the pitch: FAR POST! FAR POST!`,
          `You can hear Coach Eric from here — "FAR POST!" — and the ball obeys.`,
          `Far post, just like Coach Eric drills it at 91 Bulldogs practice.`]),true,"lowvoice");
      }
      cornerGoal=null;
      return;
    }
    if(penaltyShooter===owner){
      penaltyShooter=null;
      const e=EDGES[GOAL_EDGE[penaltyGoalTeam]], g=goalCenter(penaltyGoalTeam);
      const off2=(Math.random()*2-1)*e.len*GOAL_HALF*1.0;
      stats.shots[owner.team]++;
      kick(g.x+e.ux*off2, g.y+e.uy*off2, 10.8, true);
      gkDiveCheck(penaltyGoalTeam,false);
      return;
    }
    if(owner.role==="K"){
      const og=goalCenter(owner.team);
      // THE GRAB: he's caught it — his ball, his moment, his name in lights
      if(gkHolder!==owner){
        gkHolder=owner; gkHoldUntil=clockSec+1.6; GKSTAT.holds++;
        ENGINE_HOOKS.spawnNote(owner.x,owner.y-26,"🧤 secured!",TEAMS[owner.team].color,TEAMS[owner.team].accent);
      }
      if(clockSec<gkHoldUntil){
        // stride off the line, survey the field
        const adv={x:og.x+(CX-og.x)*0.22, y:og.y+(CY-og.y)*0.22};
        steer(owner,adv.x,adv.y,1.1);
        return;
      }
      gkHolder=null;
      // DISTRIBUTION: roll it short, or launch it across the county
      let near=null,nd2=1e9, far=null,fd=-1,fs=-1e9, anyNear=null,anyD=1e9;
      players.forEach(m=>{ if(m.team!==owner.team||m===owner||m.out||m.sentOff||m.role==="K")return;
        const d=dist(m,owner);
        const adv2=dist(m,og);
        if(adv2>dist(owner,og)+15){ if(d<nd2){nd2=d;near=m;} }   // forward outlets first
        if(d<anyD){anyD=d;anyNear=m;}
        let open2=1e9;
        players.forEach(q=>{ if(q.team!==owner.team&&!q.out&&!q.sentOff&&q.role!=="K")
          open2=Math.min(open2,dist(q,m)); });
        const sc3=adv2+Math.min(open2,140)*1.5;                  // deep AND alone
        if(sc3>fs){fs=sc3;far=m;fd=adv2;}});
      const fwdRoll=!!near;
      if(!near){ near=anyNear; nd2=anyD; }                       // backwards only if truly alone
      const wantPunt=far&&(fd>255)&&(nd2>140||Math.random()<0.11);
      if(wantPunt){
        const dTo=dist(owner,far);
        const pw=Math.min(13.5, 5.5+dTo*0.014);   // drop it TO the man, not past him
        kick(far.x+far.vx*7, far.y+far.vy*7, pw, false);
        // 4.6, not 3.4. A real match measured the ball ABOVE THE CROSSBAR for 0% of its
        // airborne time, topping out at 45 against a bar of 54 — so nothing in the game ever
        // cleared it, and "up into the lights" reached shoulder height. At 4.6 this punt peaks
        // near 76, comfortably over, and hangs for 1.1s instead of 0.8 — long enough for the
        // far side to actually get under it, which is what the comment always claimed.
        ball.zv=4.6;   // up into the lights — headers await on the far side
        GKSTAT.punts++; ball.puntBy=owner.team;
        sayLogged(pick([
          `${owner.name} LAUNCHES it — a drop kick clearing the county line!`,
          `${owner.name} sends it to the MOON. Somebody on the far side has a decision to make.`,
          `A monster punt from ${owner.name} — the ball has its own weather now.`,
          `${owner.name} with the full field-flip. From ${PRN(owner).his} box to their problem.`]),true,"lowvoice");
      } else if(near&&nd2<180){
        GKSTAT.rolls++; if(fwdRoll)GKSTAT.rollsFwd++;
        kick(near.x+near.vx*8, near.y+near.vy*8, Math.min(6.5,nd2*0.04+3.5), false);
        if(Math.random()<0.35) sayLogged(pick([
          `${owner.name} rolls it out calmly. Playing from the back.`,
          `${owner.name}, unhurried, feeds it short. Composure.`]),false);
      } else kick(CX,CY,9);
      return;
    }
    if(!owner.sprint&&owner.burst>0.65&&owner.role!=="K"&&!holdActive&&clockSec>owner.sprintCd){
      const tg7=goalCenter(targets[owner.team]);
      let blockers=0;
      players.forEach(q=>{ if(q.team!==owner.team&&!q.out&&!q.sentOff&&q.role!=="K"&&dist(q,owner)<180
        &&((q.x-owner.x)*(tg7.x-owner.x)+(q.y-owner.y)*(tg7.y-owner.y))>0) blockers++; });
      if(blockers===0&&dist(owner,tg7)<520){ owner.sprint={why:"break",blaze:Math.random()<0.12}; GKSTAT.b_break=(GKSTAT.b_break||0)+1;
        if(owner.sprint.blaze) blazeCall(owner); }
    }
    if(owner.sprint&&owner.sprint.why==="break"&&ball.owner!==owner&&clockSec>owner.sprintMin){ owner.sprint=null; owner.sprintCd=clockSec+0.8; }
    const tgt=goalCenter(targets[owner.team]);
    const e=EDGES[GOAL_EDGE[targets[owner.team]]];
    const dGoal=dist(owner,tgt);
    let pressure=1e9; oppOf(owner.team).forEach(o=>pressure=Math.min(pressure,dist(o,owner)));
    // pinned on the touchline under pressure: don't grind — play the outlet
    {
      let wd=1e9,we=null;
      for(const e2 of EDGES){const d2=(owner.x-e2.p1.x)*e2.nx+(owner.y-e2.p1.y)*e2.ny;if(d2<wd){wd=d2;we=e2;}}
      const mouth=we&&we.goal&&Math.abs((owner.x-we.mx)*we.ux+(owner.y-we.my)*we.uy)<we.len*GOAL_HALF*1.3;
      if(wd<34&&pressure<58&&!mouth&&Math.random()<0.22*dt*60){
        let best=null,bs=1e9;
        players.forEach(m=>{if(m.team===owner.team&&m!==owner&&!m.out&&!m.sentOff&&m.role!=="K"){
          const dc=dist(m,{x:CX,y:CY}); if(dc<bs){bs=dc;best=m;}}});
        if(best) kick(best.x+best.vx*8,best.y+best.vy*8,Math.min(9,dist(best,owner)*0.045+4.5));
        else kick(CX,CY,7);
        return;
      }
    }
    {
      const RK=T(owner.team).risk;
      // THE LONG STRIKE: open lane + decent angle + space = have a go from range
      if(dGoal>125&&dGoal<250&&pressure>42){
        const hw2=e.len*GOAL_HALF;
        const latOff=Math.abs((owner.x-tgt.x)*e.ux+(owner.y-tgt.y)*e.uy);
        if(latOff<hw2*1.5){
          let laneClear=true;
          oppOf(owner.team).forEach(o=>{
            const tt=((o.x-owner.x)*(tgt.x-owner.x)+(o.y-owner.y)*(tgt.y-owner.y))/(dGoal*dGoal);
            if(tt>0.12&&tt<0.85){const lx=owner.x+(tgt.x-owner.x)*tt,ly=owner.y+(tgt.y-owner.y)*tt;
              if(o.role!=="K"&&Math.hypot(o.x-lx,o.y-ly)<26)laneClear=false;}
          });
          if(laneClear&&Math.random()<0.016*(0.4+1.2*RK)*dt*60){
            const scL=(0.6+0.8*RK)*(0.75+dGoal*0.0035);   // range punishes accuracy
            const offL=(Math.random()*2-1)*hw2*scL;
            ENGINE_HOOKS.spawnNote(owner.x,owner.y-24,"from distance!",TEAMS[owner.team].accent);
            if(Math.random()<0.4) sayLogged(pick([
              `${owner.name} sees the lane and LETS FLY from range!`,
              `${owner.name} has a go from distance — dip and swerve!`,
              `No hesitation — ${owner.name} rips one from ${Math.round(dGoal/8)} yards!`,
              `${owner.name} says why not, and unloads!`]),true);
            const SSL=owner.burst>0.7&&Math.random()<0.5;
            if(SSL){ owner.burst-=0.6; GKSTAT.superShots=(GKSTAT.superShots||0)+1; }
            kick(tgt.x+e.ux*offL*(SSL?0.75:1), tgt.y+e.uy*offL*(SSL?0.75:1), SSL?13.2:11.2, true);
            if(SSL){ ball.flameShot=true; ball.flameShe=!!(TEAMS[owner.team]&&TEAMS[owner.team].she); superSay(owner); }
            gkDiveCheck(targets[owner.team], SSL);
            return;
          }
        }
      }
      if(dGoal<(150+50*RK) && Math.random()<0.025*(0.5+1.0*RK)*dt*60){
        let sc=0.6+0.8*RK;                                   // patience = precision
        if(T(targets[owner.team]).bunker>0.5) sc*=1.35;      // packed boxes deflect
        const off=(Math.random()*2-1)*e.len*GOAL_HALF*sc;
        const SS=owner.burst>0.7&&Math.random()<0.4;
        if(SS){ owner.burst-=0.6; GKSTAT.superShots=(GKSTAT.superShots||0)+1; }
        kick(tgt.x+e.ux*off*(SS?0.75:1), tgt.y+e.uy*off*(SS?0.75:1), (9.5+Math.random()*1.5)*(SS?1.3:1), true);
        if(SS){ ball.flameShot=true; ball.flameShe=!!(TEAMS[owner.team]&&TEAMS[owner.team].she); superSay(owner); }
        gkDiveCheck(targets[owner.team], SS);
        return;
      }
    }
    if(pressure<48 && Math.random()<(0.05+0.10*T(owner.team).tempo)*dt*60){
      let best=null,bs=-1e9;
      const matesLeft=FL[owner.team]-(owner.role!=="K"?1:0);
      let allyPen=null;   // computed once: identical for every allied candidate
      {
        const foe=targets[owner.team];
        if(foe!==null){
          const foeLead=score[foe]-score[owner.team];
          const shortfall=FL[foe]-FL[owner.team];
          let desp=Math.max(0,foeLead)*0.28+Math.max(0,shortfall)*0.4+(FL[owner.team]===0?0.45:0);
          let pen=850*Math.max(0,1-desp);
          if(matesLeft===0) pen-=80;
          if(pressure>32) pen*=0.8;
          allyPen=pen;
        }
      }
      players.forEach(m=>{
        const allyOk=allied(owner.team,m.team);
        if((m.team!==owner.team&&!allyOk)||m===owner||m.role==="K"||m.out||m.sentOff)return;
        const d=dist(m,owner); if(d<60||d>210+140*T(owner.team).direct)return;
        const gain=dist(owner,tgt)-dist(m,tgt);
        let laneOk=true;
        oppOf(owner.team).forEach(o=>{
          if(allied(owner.team,o.team))return;   // allies don't block the lane story
          const t=((o.x-owner.x)*(m.x-owner.x)+(o.y-owner.y)*(m.y-owner.y))/(d*d);
          if(t>0.1&&t<0.9){const lx=owner.x+(m.x-owner.x)*t, ly=owner.y+(m.y-owner.y)*t;
            if(Math.hypot(o.x-lx,o.y-ly)<(30-12*T(owner.team).risk)+5*(T(o.team).press-0.5)*2) laneOk=false;}
        });
        let s=gain*(0.6+0.8*T(owner.team).direct)+(laneOk?0:-500)+Math.random()*30;
        if(allyOk&&allyPen!==null) s-=allyPen;   // scoreboard-priced treason, computed once above
        if(s>bs){bs=s;best=m;}
      });
      if(best&&bs>-100){
        kick(best.x+best.vx*8, best.y+best.vy*8, Math.min(9,dist(best,owner)*0.045+4));
        if(allied(ball.lastKicker?ball.lastKicker.team:-1,best.team)) ball.allyPass=true;
        return;
      }
    }
    // FOULS: clumsy or cynical challenges — aggression is now a priced behavior
    for(const o of oppOf(owner.team)){
      if(o.role==="K"||o.out||o.sentOff)continue;
      if(suppress&&suppress.team===o.team&&clockSec<suppress.until)continue;
      if(dist(o,owner)>=28)continue;
      const inBox=dist(owner,goalCenter(o.team))<110;
      const fc=(holdActive?0:0.0022)*foulMult*AGG_PRESETS[teamAGG[o.team]].f
        *(0.4+1.2*T(o.team).press*(coalAlly[o.team]?0.7:1))*(1.5-0.7*o.stamina)*(inBox?0.4:1.0);
      if(Math.random()<fc*dt*60){
        const victim=owner;
        ENGINE_HOOKS.spawnNote(victim.x,victim.y-24,"FOUL!","#ffd166");
        addStoppage(1.2);
        const r=Math.random();
        const redP=0.035*(0.5+0.5*foulMult);   // stricter referees reach for red
        const yelP=0.20*(0.6+0.4*foulMult);
        let card=null;
        if(r<redP) card="red";
        else if(r<redP+yelP) card=(o.yellows>=1)?"second":"yellow";
        if(card==="yellow") o.yellows++;
        let off=(card==="red"?pick(RED_OFFENSES):pick(YELLOW_OFFENSES)).replaceAll("{V}",victim.name);
        if(AGG_PRESETS[teamAGG[o.team]].f>1.5&&coached[o.team]) off+=" — entirely on the manager's instructions";
        const shortT=TEAMS[o.team].short, col=TEAMS[o.team].color;
        if(inBox){
          pendingPenalty={shooter:victim, conceder:o.team};
          addStoppage(4);
        } else {
          suppress={team:o.team, until:clockSec+1.0};
        }
        const penTag=inBox?` <b style="color:#ffd166">AND IT'S A PENALTY!</b>`:"";
        if(card==="red"||card==="second"){
          addStoppage(3);
          o.sentOff=true; o.redCard=true; walkPending=o;   // the walk follows the popup
          const left=players.filter(q=>q.team===o.team&&!q.out&&!q.sentOff).length;
          const leftTxt=left===1?`only the goalkeeper remains for ${tm(o.team)}!`:`${tm(o.team)} down to ${left} men.`;
          ENGINE_HOOKS.showNotice(col, card==="second"?"🟨🟥 SECOND YELLOW":"🟥 RED CARD",
            `${o.name} (${shortT})`,
            `${PRN(o).His} crime: ${PRN(o).he} ${off}.${penTag}<br>OFF! The walk of shame begins — ${leftTxt}`, 5200);
          sayLogged(pick([
            `🟥 <b>RED CARD!</b> ${o.name} is off — ${PRN(o).he} ${off}. ${tm(o.team)} play on a ${PRN(o).man} short!`,
            `🟥 <b>RED CARD!</b> ${o.name} is EXCOMMUNICADO — ${PRN(o).he} ${off}. No services, no help, and ${tm(o.team)} play a ${PRN(o).man} short!`,
            `🟥 <b>RED CARD!</b> Hasta la vista, ${o.name} — ${PRN(o).he} ${off}. ${PRN(o).He}'ll be back next match. ${tm(o.team)} a ${PRN(o).man} short!`,
            `🟥 <b>RED CARD!</b> ${o.name}, that is a DIRECT violation — ${PRN(o).he} ${off}. ${PRN(o).He} has the right to remain benched.`,
            `🟥 <b>RED CARD!</b> WITNESS ${o.name.toUpperCase()}! ${PRN(o).He} ${off}, and now rides shiny and chrome to the Valhalla of the bench!`,
            `🟥 <b>RED CARD!</b> ${o.name} ${off}. "'Tis but a scratch," ${PRN(o).he} protests. The referee begs to differ — OFF!`,
            `🟥 <b>RED CARD!</b> ${o.name} ${off}. As the family says: just do the next right thing. The next right thing is the bench.`,
            `🟥 <b>RED CARD!</b> ${o.name} ${off} — and gets taken to the train station, hex edition. ${tm(o.team)} a ${PRN(o).man} short!`,
            `🟥 <b>RED CARD!</b> ${o.name} ${off}. NOBODY expected the disciplinary inquisition. OFF!`,
            `🟥 <b>RED CARD!</b> ${o.name} ${off}. The hex don't tolerate rude behavior. ${PRN(o).He} rides for the bench.`,
            `🟥 <b>RED CARD!</b> ${o.name} ${off} — ELIMINATED! Back to the lobby, and ${tm(o.team)} face the storm a ${PRN(o).man} short.`,
            `🟥 <b>RED CARD!</b> ${o.name} ${off}. Respawn point: the bench. Inventory: regret.`,
            `🟥 <b>RED CARD!</b> ${o.name} ${off}. Orion, Morale Officer of the Baby Chaos Division, has reviewed it: unacceptable chaos, even by division standards.`,
            `🟥 <b>RED CARD!</b> ${o.name} ${off}. Dampy rules it a catastrophic splash violation. Straight red.`,
            `🟥 <b>RED CARD!</b> ${o.name} ${off}. Momo watched from the rafters and did not blink. The referee agrees. OFF!`,
            `🟥 <b>RED CARD!</b> ${o.name} ${off}. Grandma Bridget's review: "bold, but ultimately indefensible." RED.`]),true);
        } else if(card==="yellow"){
          addStoppage(3);
          ENGINE_HOOKS.showNotice(col,"🟨 YELLOW CARD",`${o.name} (${shortT})`,
            `${PRN(o).His} crime: ${PRN(o).he} ${off}. Into the book ${PRN(o).he} goes.${penTag}`, 4200);
          sayLogged(pick([
            `🟨 ${o.name} is booked — ${off}.`,
            `🟨 ${o.name} booked — ${off}. The High Table has been notified.`,
            `🟨 A citation for ${o.name} — ${off}. One more directive violation and it's over.`,
            `🟨 ${o.name} booked — ${off}. Judgment Day is exactly one more card away.`,
            `🟨 ${o.name} into the book — ${off}. "MEDIOCRE!" shouts someone from the cheap seats.`,
            `🟨 ${o.name} booked — ${off}. The physio's flesh-wound report is under review.`,
            `🟨 ${o.name} booked — ${off}. Best to let this one go before it becomes two.`,
            `🟨 ${o.name} running hot — ${off}. The referee attenuates the signal with a yellow.`,
            `🟨 ${o.name} booked — ${off}. Coaches Eric and Dan teach cleaner timing than THAT.`,
            `🟨 ${o.name} booked — ${off}. No instruments required — the whole stadium saw it.`,
            `🟨 ${o.name} booked — ${off}. Ten thousand thundering typhoons of protest change nothing.`,
            `🟨 ${o.name} booked — ${off}. To be precise: booked.`,
            `🟨 ${o.name} booked — ${off}. Even Bandit would sit ${PRN(o).him} out for that one.`,
            `🟨 ${o.name} booked — ${off}. The storm is closing on ${PRN(o).his} discipline.`,
            `🟨 ${o.name} booked — ${off}. Half a heart of damage, minimum.`,
            `🟨 ${o.name} booked — ${off}. One bonus item, deducted.`,
            `🟨 ${o.name} booked — ${off}. Grandma Gloria lights a candle for ${PRN(o).his} discipline.`,
            `🟨 ${o.name} booked — ${off}. Grampy Cliff logs it as improper equipment operation.`,
            `🟨 ${o.name} booked — ${off}. Continental rules: none of THAT on hex grounds.`,
            `🟨 ${o.name} booked — ${off}. The hens on the fencepost all turned to look at once.`]),true);
        } else if(inBox){
          ENGINE_HOOKS.showNotice(TEAMS[victim.team].color,"⚠️ PENALTY!",
            `${victim.name} is brought down in the box!`,
            `${o.name} ${off} — the referee points to the spot.`, 4600);
          sayLogged(`<b style="color:${TEAMS[victim.team].color}">PENALTY to ${tm(victim.team)}!</b>`,true);
        } else if(Math.random()<0.5){
          sayLogged(pick([
            `Free kick — ${o.name} ${off}.`,
            `The whistle goes. ${o.name} ${off}.`,
            `Referee's seen it: ${o.name} ${off}. Free kick.`]));
        }
        return;
      }
    }
    // tackles (fatigue and momentum affect steal odds; radius sits just outside body contact)
    oppOf(owner.team).forEach(o=>{
      if(suppress&&suppress.team===o.team&&clockSec<suppress.until) return;
      let tc=holdActive?0:0.010*(0.6+0.8*T(o.team).press)*AGG_PRESETS[teamAGG[o.team]].t; // aggression bites harder; dead balls untouchable
      tc*=(0.55+0.45*o.stamina);             // fresh tacklers bite harder
      tc*=(1.35-0.5*owner.stamina);          // gassed carriers are easier to rob
      if(momentumOn&&clockSec<boostUntil[o.team]) tc*=1.3;
      if(owner.role==="K"&&gkHolding())return;
      if(dist(o,owner)<26 && Math.random()<tc*dt*60){   // MUST stay > body radius 23
        const victim=owner;
        ball.owner=o; ball.lastTouch=o.team; ball.lastKicker=o; ball.isShot=false;
        if(o.role==="K"){
          // keeper smothering a dribbler is goalkeeping, not a tackle — no tackle credit
          ENGINE_HOOKS.spawnNote(o.x,o.y-20,"smothered!",TEAMS[o.team].color,TEAMS[o.team].accent);
        } else {
          stats.tackles[o.team]++; o.tackles++;
          ENGINE_HOOKS.spawnNote(o.x,o.y-20,"tackle!",TEAMS[o.team].color,TEAMS[o.team].accent);
        }
        stam(o,+0.10); stam(victim,-0.12);
        if(o.role!=="K" && Math.random()<0.28) sayLogged(pick([
          `${o.name} muscles ${victim.name} off the ball!`,
          `Crunching challenge — ${o.name} strips it from ${victim.name}.`,
          `${o.name} picks ${victim.name}'s pocket!`,
          `${victim.name} dwells too long and ${o.name} makes him pay.`,
          `Textbook from ${o.name} — shoulder in, ball won, no arguments.`,
          `${o.name} reads it like a bedtime story. Possession stolen.`,
          `Nothing gentle about that — ${o.name} simply takes it off ${victim.name}.`,
          `${victim.name} had it on a plate and ${o.name} ate first.`,
          `${o.name} arrives like a tax bill. ${victim.name} pays in full.`,
          `${o.name} sends ${victim.name} straight back to the lobby.`,
          `Dutton rules from ${o.name} — that's HIS grass ${victim.name} was standing on.`,
          `${o.name} with a tackle Grampy Cliff would call proper equipment maintenance.`,
          `${o.name} arrives with full Atlas-zoomies energy. ${victim.name} never stood a chance.`,
          `${o.name} chops ${victim.name} down. 'Tis but a scratch, surely.`,
          `RUN AWAY! ${victim.name} heeds the classic advice one moment too late.`]));
      }
    });
  }
}

// ---------- Physics ----------
function physics(dt){
  const S=dt*60;
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
    if(throwPending===ball.owner){ ball.vx=0; ball.vy=0; return; }   // the ball waits ON THE CHALK — the thrower stands behind it
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
        const near=players.filter(p=>!p.out&&dist(p,ball)<62);
        const teams=new Set(near.map(p=>p.team));
        if(near.length>=2&&teams.size>=2){
          // header duel — highest man wins
          let win=null,wt=0;
          near.forEach(p=>{const w=(1/(dist(p,ball)+8))*(0.6+0.8*Math.random()); if(w>wt){wt=w;win=p;}});
          const tgt2=goalCenter(targets[win.team]??win.team);
          ball.lastTouch=win.team; ball.lastKicker=win;
          ENGINE_HOOKS.spawnNote(ball.x,ball.y-24,"header!",TEAMS[win.team].color,TEAMS[win.team].accent);
          if(Math.random()<0.4) sayLogged(pick([
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
            const off2=(Math.random()*2-1)*e2.len*GOAL_HALF*1.35;
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
      const sx=ball.x-px0, sy=ball.y-py0, sl=sx*sx+sy*sy;
      let t=sl>0?((p.x-px0)*sx+(p.y-py0)*sy)/sl:0;
      t=Math.max(0,Math.min(1,t));
      const d=Math.hypot(p.x-(px0+sx*t), p.y-(py0+sy*t));
      const reach=p.role==="K"?(p.diveUntil&&clockSec<p.diveUntil?23:17):13;
      if(d<reach&&d<bd){bd=d;best=p;}});
    if(best){
      const wasShot=ball.isShot, spd=Math.hypot(ball.vx,ball.vy), kicker=ball.lastKicker;
      const strayer=(ball.strayF>0)?ball.strayer:null;
      if(ball.allyPass&&ball.lastKicker&&best.team!==ball.lastKicker.team&&allied(ball.lastKicker.team,best.team)
        &&Math.random()<0.5){
        sayLogged(pick([
          `The alliance is real — ${ball.lastKicker.name} slips it to ${best.name}!`,
          `Enemy of my enemy: ${ball.lastKicker.name} finds ${best.name} across battle lines!`,
          `A pass BETWEEN teams! ${ball.lastKicker.name} to ${best.name} — the leader should worry.`,
          `${ball.lastKicker.name} and ${best.name} wear different shirts and share one grudge.`]),true);
      }
      ball.allyPass=false;
      if(ball.puntBy!==undefined){ GKSTAT.puntSeen++; if(best.team===ball.puntBy)GKSTAT.puntSame++; ball.puntBy=undefined; }
      if(Math.hypot(ball.x-best.x,ball.y-best.y)>25) telPort('claim: ball snapped to the claimer');
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
          if(Math.random()<0.18) sayLogged(pick([
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
        if(spd>8.5 && Math.random()<0.4){
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
          if(Math.random()<0.6) sayLogged(pick([
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
        if(Math.random()<0.5) sayLogged(pick([
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
          if(Math.random()<0.22) ENGINE_HOOKS.spawnNote(best.x,best.y-20,"pass ✓",TEAMS[best.team].color,TEAMS[best.team].accent);
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
    if(d<7){
      const along=(ball.x-e.mx)*e.ux+(ball.y-e.my)*e.uy;
      const gTeam=e.goal?GOAL_EDGE.indexOf(k):-1;
      const inMouth=e.goal && !out[gTeam] && Math.abs(along)<e.len*GOAL_HALF;
      if(inMouth){
        if(d<-6){
          if(ball.z<28){ goalScored(GOAL_EDGE.indexOf(k)); return; }
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
  const scorerTeam=ball.lastTouch;
  const scorer=(ball.owner&&ball.owner.team===scorerTeam)?ball.owner
    :((ball.lastKicker&&ball.lastKicker.team===scorerTeam)?ball.lastKicker:null);
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
    pendingKickoff=survivors[Math.floor(Math.random()*2)];
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
  zLow:0, zMid:0, zHigh:0, zSky:0, zMax:0, port:{},
  stall:0, stalls:0, worstStall:0, shots:0, blocked:0
};
function telReset(){
  Object.assign(TEL, { frames:0, loose:0, deadFrames:0, aerial:0, throwIns:0, corners:0,
    goalKicks:0, keeperClaims:0, keeperFrames:0, ownedFrames:0, poss:[0,0,0], jumps:0,
    claims:0, gkClaims:0, rapid:0, gkRapid:0, behindGoal:0, behindOwn:0, behindOther:0,
    zLow:0, zMid:0, zHigh:0, zSky:0, zMax:0, port:{}, port:{},
  zLow:0, zMid:0, zHigh:0, zSky:0, zMax:0, port:{}, behindGoal:0, behindOwn:0, behindOther:0,
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
function telPort(why){ TEL.port[why] = (TEL.port[why] || 0) + 1; }

function telFrame(){
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
    TEL.jumps++; if(j>25) TEL.bigJumps++; if(j>TEL.maxJump) TEL.maxJump=j;
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
  md+=`| highest the ball got | ${Math.round(TEL.zMax)} | | crossbar is 54 |\n`;
  md+=`| in a keeper's gloves | ${Math.round(100*TEL.keeperFrames/ow)}% of owned | | ~5% |\n`;
  md+=`| loose with nobody within 40 | ${Math.round(100*TEL.deadFrames/f)}% | | |\n`;
  md+=`| stalls over 0.5s | ${TEL.stalls} | ${p90(TEL.stalls)} | |\n`;
  md+=`| longest stall | ${(TEL.worstStall/60).toFixed(1)}s | | |\n`;
  md+=`| ball jumps over 25 units | ${TEL.bigJumps} | ${p90(TEL.bigJumps)} | |\n`;
  // WHICH restart moved it, so the gold standard has something to aim at.
  const ports=Object.entries(TEL.port).sort((a2,b2)=>b2[1]-a2[1]);
  for(const [why,n2] of ports) md+=`| \u2014 ${why} | ${n2} | ${p90(n2)} | should be 0 |\n`;
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
  kickoff(leaders[Math.floor(Math.random()*leaders.length)]);
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
  if(clockSec-lastStyleAt>45&&Math.random()<0.4){
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
  if(matchBoards.length&&Math.random()<0.25)
    cand.push(`Tonight's match brought to you in part by ${matchBoards[Math.floor(Math.random()*matchBoards.length)].toLowerCase()}.`);
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
  const cands=players.filter(q=>q.team!==toucher&&q.role!=="K"&&!q.out&&!q.sentOff)
    .sort((a,b)=>dist(a,{x:sx,y:sy})-dist(b,{x:sx,y:sy}));
  const thr=cands[0];
  if(!thr){ telPort('throw-in: nobody to take it'); ball.x=CX; ball.y=CY; return; }
  telPort('throw-in'); ball.owner=null; ball.x=sx; ball.y=sy;
  pendingRestart={p:thr, x:sx, y:sy, team:thr.team, cap:nowMs()+2000, readyAt:nowMs()+1100};
  suppress={team:toucher,until:clockSec+0.8};
  ENGINE_HOOKS.spawnNote(sx,sy-24,"throw-in!",TEAMS[thr.team].color,TEAMS[thr.team].accent);
  if(Math.random()<0.4) sayLogged(pick([
    `Out of play — throw-in ${tm(thr.team)}, quickly taken.`,
    `Into touch. ${thr.name} hurls it back in for ${tm(thr.team)}.`,
    `${tm(thr.team)} with the throw — no time wasted.`,
    `Over the line! ${thr.name} takes it quickly.`]));
  restartHold=nowMs()+2200;   // shortened the moment the taker arrives
}
function stageGoalKick(t){
  const gk=players.find(q=>q.team===t&&q.role==="K"&&!q.out);
  if(!gk){ telPort('goal kick: no keeper'); telPort('goal kick'); ball.x=CX; ball.y=CY; return; }
  ball.owner=gk; ball.lastTouch=t; ball.lastKicker=gk;
  ball.x=gk.x; ball.y=gk.y; ball.touchT=0.4;
  ENGINE_HOOKS.spawnNote(gk.x,gk.y-24,"goal kick",TEAMS[t].color,TEAMS[t].accent);
  if(Math.random()<0.35) sayLogged(pick([
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
  const cx2=vtx.x+e.nx*14, cy2=vtx.y+e.ny*14;
  ball.owner=null; ball.x=cx2; ball.y=cy2;
  pendingRestart={p:taker, x:cx2, y:cy2, team:att, cap:nowMs()+2400, readyAt:nowMs()+1250};
  cornerTaker=taker; cornerGoal=ownerT;
  restartHold=Math.max(restartHold,nowMs()+2900);   // corners earn a longer ceremony — let the box fill GKSTAT.cornerStage=(GKSTAT.cornerStage||0)+1;
  ENGINE_HOOKS.spawnNote(taker.x,taker.y-26,"corner!",TEAMS[att].color,TEAMS[att].accent);
  sayLogged(pick([
    `<b style="color:${TEAMS[att].color}">Corner to ${tm(att)}</b> — ${taker.name} to swing it in...`,
    `<b style="color:${TEAMS[att].color}">Corner ${tm(att)}!</b> Big bodies forward... ${taker.name} over the flag.`,
    `<b style="color:${TEAMS[att].color}">Corner to ${tm(att)}</b> — the box fills. ${taker.name} whips it...`,
    `<b style="color:${TEAMS[att].color}">Corner!</b> ${taker.name} raises an arm... here it comes...`]),true);
  restartHold=nowMs()+2600;   // shortened once he's over the ball
}
function stagePenalty(){
  const pen=pendingPenalty; pendingPenalty=null;
  const shooter=pen.shooter, conceder=pen.conceder;
  if(out[conceder]||shooter.out) return;
  const e=EDGES[GOAL_EDGE[conceder]], g=goalCenter(conceder);
  const sx=g.x+e.nx*110, sy=g.y+e.ny*110;
  ball.owner=shooter; ball.lastTouch=shooter.team; ball.lastKicker=shooter;
  telPort('corner'); ball.x=sx; ball.y=sy; ball.vx=0; ball.vy=0; ball.z=0; ball.zv=0;
  ball.touchT=99;   // no dribble touches during the run-up
  shooter.x=sx+e.nx*16; shooter.y=sy+e.ny*16; shooter.vx=0; shooter.vy=0;
  const gk=players.find(q=>q.team===conceder&&q.role==="K"&&!q.out);
  if(gk){ gk.x=g.x+e.nx*12; gk.y=g.y+e.ny*12; gk.vx=0; gk.vy=0; }
  players.forEach(q=>{ if(q===shooter||q===gk||q.out)return;
    const d=dist(q,g)||1;
    if(d<170){ q.x=g.x+(q.x-g.x)/d*178; q.y=g.y+(q.y-g.y)/d*178; }});
  penaltyShooter=shooter; penaltyGoalTeam=conceder;
  ENGINE_HOOKS.spawnNote(sx,sy-28,"PENALTY!","#ffd166");
  sayLogged(pick([
    `${shooter.name} places the ball on the spot... the keeper crouches...`,
    `${shooter.name} steps up. The stadium holds its breath...`,
    `Twelve yards between ${shooter.name} and glory. The keeper waits...`,
    `${shooter.name} takes a long breath and starts the run-up...`]),true);
  resumeAt=nowMs()+1000;
}
