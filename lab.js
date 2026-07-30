// ── THE MATCH HARNESS ───────────────────────────────────────────────────────
//
// Plays whole matches under node, with no browser and no screen, and measures them.
//
// The point of it is a single fake clock. The engine reads time through ENGINE_CLOCK.now(), and
// this drives that clock forward in step with the match — so a restart hold of 2.6 seconds is
// 2.6 seconds of MATCH time rather than 2.6 seconds of the harness operator's life.
//
// Without that they disagree, and everything the engine does with a timer breaks in a way that
// looks like a football problem. It cost me four wrong audits before I understood which of us
// was lying.
//
//   node lab.js            eight matches, the standard sheet
//   node lab.js 20         twenty matches
//
'use strict';
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf8');

const HOOKS = ['say','spawnNote','spawnPing','renderScore','crownChampion','eliminateTeam',
  'showCelebration','showNotice','flash','flamePop','openCoachMenu','showSetup','renderTeamSlots',
  'closeCoachMenu','resetGoals','drawBoards','clearMarks'];

/** One match, played to full time on a clock we control. */
function play(opts){
  const o = Object.assign({ minutes: 5, teams: [0,1,2], first: 0, rules: {} }, opts || {});
  const E = new Function(SRC + `
    return { ENGINE_CLOCK, ENGINE_HOOKS, resetMatch, kickoff, think, physics, computeTargets,
             colorCommentary, resolveFullTime, applyTeamSelection, selTeams, goalCenter, rankCmp,
             CX, CY, EDGES, GOAL_EDGE, fieldersLeft,
             get players(){return players}, get ball(){return ball}, get score(){return score},
             get scored(){return scored}, get conceded(){return conceded}, get stats(){return stats},
             get goalsLog(){return goalsLog}, get phase(){return phase}, get speed(){return speed},
             get clockSec(){return clockSec}, set clockSec(v){clockSec=v},
             set matchLen(v){matchLen=v}, get matchLen(){return matchLen},
             get stoppageLen(){return stoppageLen},
             set oobRule(v){oobRule=v}, set zoneRule(v){zoneRule=v}, set foulMult(v){foulMult=v},
             set momentumOn(v){momentumOn=v}, set scoreMode(v){scoreMode=v},
             get retargetTimer(){return retargetTimer}, set retargetTimer(v){retargetTimer=v},
             get pendingRestart(){return pendingRestart}, get restartHold(){return restartHold},
             get pendingKickoff(){return pendingKickoff}, set pendingKickoff(v){pendingKickoff=v} };`)();

  // ── THE CLOCK ─────────────────────────────────────────────────────────────
  // Milliseconds of MATCH time, advanced by the loop. Everything the engine waits on now waits
  // on this, so a hold measured in seconds actually costs seconds of the match.
  let ms = 0;
  E.ENGINE_CLOCK.now = () => ms;

  const ev = { goals:0, ownGoals:0, shots:0, fouls:0, cards:0, reds:0, throws:0, corners:0,
               pens:0, saves:0, dives:0, lines:0, holdFrames:0 };
  for (const k of HOOKS) E.ENGINE_HOOKS[k] = () => {};
  // A celebration holds play, exactly as both front ends do it. Without this the same team
  // scores into a pitch that never resets and the scoreline runs away.
  let hold = 0;
  E.ENGINE_HOOKS.showCelebration = (c, big) => {
    ev.goals++;
    if (/OWN GOAL/i.test(String(big))) ev.ownGoals++;
    hold = Math.round(60 * 3.5);
  };
  E.ENGINE_HOOKS.say = () => ev.lines++;
  E.ENGINE_HOOKS.flamePop = () => ev.dives++;
  E.ENGINE_HOOKS.spawnNote = (x, y, t) => {
    const s = String(t);
    if (/shot/i.test(s))     ev.shots++;
    if (/FOUL/i.test(s))     ev.fouls++;
    if (/throw/i.test(s))    ev.throws++;
    if (/corner/i.test(s))   ev.corners++;
    if (/PENALTY/i.test(s))  ev.pens++;
    if (/secured|smothered/i.test(s)) ev.saves++;
  };
  E.ENGINE_HOOKS.showNotice = (c, big) => {
    const s = String(big);
    if (/CARD/i.test(s)) ev.cards++;
    if (/RED/i.test(s))  ev.reds++;
  };

  for (let i = 0; i < 3; i++) E.selTeams[i] = o.teams[i];
  E.applyTeamSelection();
  E.resetMatch();
  E.matchLen = o.minutes * 60;
  if ('oob'   in o.rules) E.oobRule    = o.rules.oob;
  if ('zone'  in o.rules) E.zoneRule   = o.rules.zone;
  if ('ref'   in o.rules) E.foulMult   = o.rules.ref;
  if ('fire'  in o.rules) E.momentumOn = o.rules.fire;
  if ('score' in o.rules) E.scoreMode  = o.rules.score;
  E.kickoff(o.first);

  const own = [0,0,0], third = [0,0,0];
  let loose = 0, aerial = 0, keeper = 0, crowd = 0, frames = 0, guard = 0;
  const STEP = (1/60) * 0.75;                      // sim-seconds a frame advances the match clock

  while (E.phase !== 'over' && guard++ < 400000) {
    ms += 1000 / 60;                               // the fake clock runs at 60fps of MATCH time
    if (hold > 0) { hold--; ev.holdFrames++; continue; }
    // THE RESTART AFTER A GOAL. The engine sets pendingKickoff and expects the front end to act
    // on it — both pages do, in their loops. Without it the ball simply stays in the net and
    // scores again on the next frame, which is where sixteen hundred goals a match came from.
    if (E.pendingKickoff !== null && E.pendingKickoff !== undefined) {
      E.kickoff(E.pendingKickoff);
      E.pendingKickoff = null;
      continue;
    }
    const step = STEP * E.speed;
    E.clockSec += step;
    E.retargetTimer += step;
    if (E.retargetTimer > 6) { E.retargetTimer = 0; E.computeTargets(); }
    E.think(step); E.physics(step); E.colorCommentary();
    // ONCE. Calling it every frame after the clock expires fires a title celebration on each
    // one — which is where 1,700 goals a match came from, and why nothing ever reached full
    // time: the guard was exhausted by holds for celebrations that should never have happened.
    // Full time, then overtime if the engine wants one. resolveFullTime can move the match into
    // OT rather than ending it, so this re-arms on a phase change instead of firing once and
    // giving up — which is why matches ran 380,000 frames for a 24,000-frame match and never
    // finished.
    // FULL TIME, GATED ON THE PHASE — the same gate both front ends use, and the one my harness
    // was missing. Calling resolveFullTime() on a match already in overtime is what made every
    // match run forever, and I wrongly reported that as a possible finding about golden goals.
    if (E.phase === 'regulation' && E.clockSec >= E.matchLen + E.stoppageLen) {
      try { E.resolveFullTime(); } catch (e) {}
    }
    // Overtime is golden-concession: it ends when somebody concedes. A generous ceiling in case
    // nobody does, so a stalemate is reported rather than hanging.
    if (E.clockSec > E.matchLen * 3) break;
    frames++;

    const b = E.ball;
    if (b.owner) { own[b.owner.team]++; if (b.owner.role === 'K') keeper++; } else loose++;
    if ((b.z || 0) > 4) aerial++;
    let near = 0, nd = 1e9;
    for (let t = 0; t < 3; t++) {
      const g = E.goalCenter(t), d = Math.hypot(b.x - g.x, b.y - g.y);
      if (d < nd) { nd = d; near = t; }
    }
    third[near]++;
    let n = 0;
    for (const p of E.players) if (!p.out && Math.hypot(p.x - b.x, p.y - b.y) < 60) n++;
    crowd += n;
  }

  const owned = own.reduce((a, c) => a + c, 0) || 1;
  const per90 = x => x * (90 / o.minutes);
  return {
    minutes: o.minutes, frames, stoppage: E.stoppageLen, finished: E.phase === 'over', phase: E.phase, clock: E.clockSec,
    ev, per90: {
      goals: per90(ev.goals), shots: per90(ev.shots), fouls: per90(ev.fouls),
      cards: per90(ev.cards), throws: per90(ev.throws), corners: per90(ev.corners),
      saves: per90(ev.saves),
    },
    poss: own.map(x => 100 * x / owned),
    possGap: Math.max(...own.map(x => 100*x/owned)) - Math.min(...own.map(x => 100*x/owned)),
    loosePct: 100 * loose / frames,
    aerialPct: 100 * aerial / frames,
    keeperPct: 100 * keeper / owned,
    thirds: third.map(x => 100 * x / frames),
    busiestThird: Math.max(...third.map(x => 100 * x / frames)),
    crowd: crowd / frames,
    score: E.score.slice(),
  };
}

/** A sheet of matches, with the fixtures varied so this is not one game measured n times. */
function sweep(n, opts){
  const out = [];
  for (let s = 0; s < n; s++) {
    const teams = [(s*3) % 15, (s*3+1) % 15, (s*3+2) % 15];
    out.push(play(Object.assign({ teams, first: s % 3 }, opts)));
  }
  return out;
}

const med = a => { const b = a.slice().sort((x,y)=>x-y); return b[Math.floor(b.length/2)]; };
const avg = a => a.reduce((x,y)=>x+y,0) / a.length;

function report(runs){
  const g = runs.map(r => r.ev.goals);
  const line = (label, got, real) =>
    '   ' + label.padEnd(20) + String(Math.round(got)).padStart(5) +
    (real ? '        ' + real : '');
  console.log('  ' + runs.length + ' matches, ' + runs[0].minutes + ' minutes each, ' +
              runs.filter(r=>r.finished).length + ' reached full time\n');
  console.log('  per 90 minutes        this sim    real football');
  console.log(line('goals',    avg(runs.map(r=>r.per90.goals)),   '~2.7'));
  console.log(line('shots',    avg(runs.map(r=>r.per90.shots)),   '~25'));
  console.log(line('fouls',    avg(runs.map(r=>r.per90.fouls)),   '~22'));
  console.log(line('cards',    avg(runs.map(r=>r.per90.cards)),   '~3.5'));
  console.log(line('throw-ins',avg(runs.map(r=>r.per90.throws)),  '~40'));
  console.log(line('corners',  avg(runs.map(r=>r.per90.corners)), '~10'));
  console.log(line('saves',    avg(runs.map(r=>r.per90.saves)),   '~6'));
  console.log('\n  ball state');
  console.log('   loose               ' + avg(runs.map(r=>r.loosePct)).toFixed(0) + '%        ~35%');
  console.log('   airborne            ' + avg(runs.map(r=>r.aerialPct)).toFixed(0) + '%        ~20%');
  console.log('   held by a keeper    ' + avg(runs.map(r=>r.keeperPct)).toFixed(0) + '%        ~5%');
  console.log('   near the ball       ' + avg(runs.map(r=>r.crowd)).toFixed(1) + ' of 15   ~4-6');
  console.log('\n  balance');
  console.log('   possession gap      median ' + Math.round(med(runs.map(r=>r.possGap))) + '%');
  console.log('   busiest third       median ' + Math.round(med(runs.map(r=>r.busiestThird))) + '%   (33% is even)');
  console.log('   goals per match     ' + g.join(', '));
}

module.exports = { play, sweep, report, med, avg };

if (require.main === module) {
  const n = parseInt(process.argv[2], 10) || 8;
  report(sweep(n, { minutes: 5 }));
}
