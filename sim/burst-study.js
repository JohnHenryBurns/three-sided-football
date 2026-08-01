'use strict';
// ── THE BURST STUDY ─────────────────────────────────────────────────────────
//
// What the tank is actually spent on, and when. The design brief: burst events should
// be SEEN — often enough to be interesting, rare enough to stay exciting — and a player
// should keep his powder for moments that matter, not dump it jogging to a throw-in.
//
// Nothing in the engine is patched. The study watches player state frame to frame:
// a sprint appearing is a sprint start (tagged with its why and with whether the ball
// was dead or a restart was staging); a burst drop steeper than the sprint drain is a
// discrete spend; the flame shot, boosted jump and keeper burns come off their own
// counters. Polling, not patching, so this keeps working while the engine moves.
//
//   node sim/burst-study.js          twenty matches, 3 minutes each
//   node sim/burst-study.js 40 5     forty matches, 5 minutes each
//
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'engine.js'), 'utf8');

const HOOKS = ['say','spawnNote','spawnPing','renderScore','crownChampion','eliminateTeam',
  'showCelebration','showNotice','flash','flamePop','openCoachMenu','showSetup','renderTeamSlots',
  'closeCoachMenu','resetGoals','drawBoards','clearMarks'];

const N   = parseInt(process.argv[2] || '20', 10);
const MIN = parseFloat(process.argv[3] || '3');

function play(seed){
  const E = new Function(SRC + `
    return { ENGINE_CLOCK, ENGINE_HOOKS, resetMatch, kickoff, think, physics, computeTargets,
      colorCommentary, seedRNG, GKSTAT, TEL, goalCenter,
      get players(){return players}, get ball(){return ball},
      get targets(){return targets},
      get pendingRestart(){return pendingRestart}, get restartHold(){return restartHold},
      get freeKick(){return freeKick}, get throwPending(){return throwPending},
      get cornerPending(){return cornerPending},
      get phase(){return phase}, get clockSec(){return clockSec}, set clockSec(v){clockSec=v},
      set matchLen(v){matchLen=v}, get resumeAt(){return resumeAt}, set resumeAt(v){resumeAt=v},
      get pendingKickoff(){return pendingKickoff}, set pendingKickoff(v){pendingKickoff=v},
      get retargetTimer(){return retargetTimer}, set retargetTimer(v){retargetTimer=v} };`)();
  let ms = 0; E.ENGINE_CLOCK.now = () => ms;
  for (const k of HOOKS) E.ENGINE_HOOKS[k] = () => {};
  E.seedRNG(seed); E.resetMatch(); E.matchLen = MIN*60; E.kickoff(0); E.resumeAt = 0; E.pendingKickoff = null;

  const st = { starts:{}, startsDead:{}, spends:0, spendsDead:0, entryFees:0, drainDead:0, drainLive:0,
               sprintFrames:0, rangeFrames:0, rangeReady:0, rangeBurstSum:0,
               burstSum:0, burstN:0, sprintLens:[], _open:new Map() };
  const prev = new Map();       // player -> {burst, sprint(bool), why}
  const dt = 1/60;

  while (E.phase === 'regulation' && E.clockSec < MIN*60){
    ms += dt*1000;
    if (E.pendingKickoff != null){ E.kickoff(E.pendingKickoff); E.pendingKickoff = null; E.resumeAt = ms + 900; }
    else if (ms >= E.resumeAt){
      E.clockSec += dt; E.retargetTimer += dt;
      if (E.retargetTimer > 6){ E.retargetTimer = 0; E.computeTargets(); }
      E.think(dt); E.physics(dt); E.colorCommentary();

      const dead = !!(E.pendingRestart || E.freeKick || E.throwPending || E.cornerPending)
                   || ms < E.restartHold;
      for (const p of E.players){
        if (p.out || p.sentOff) continue;
        const was = prev.get(p) || { burst: p.burst, sprint: false, why: null };
        // discrete spend: a drop steeper than one frame of sprint drain (dt/1.4) plus slack.
        // A sprint START also deducts an upfront chunk — that is an entry fee, not a dive or a
        // shot, and lumping them made spends ≈ starts and said nothing. Split by whether the
        // sprint appeared this same frame.
        const drop = was.burst - p.burst;
        const started = !!p.sprint && !was.sprint;
        if (drop > dt/1.4 + 0.05){
          if (started){ st.entryFees++; }
          else { st.spends++; if (dead) st.spendsDead++; }
        }
        // sprint bookkeeping
        const now = !!p.sprint;
        if (now && !was.sprint){
          const why = p.sprint.why || '?';
          st.starts[why] = (st.starts[why]||0)+1;
          if (dead) st.startsDead[why] = (st.startsDead[why]||0)+1;
          st._open.set(p, E.clockSec);
        }
        if (!now && was.sprint && st._open.has(p)){
          st.sprintLens.push(E.clockSec - st._open.get(p)); st._open.delete(p);
        }
        if (now){ st.sprintFrames++; if (dead) st.drainDead += dt/1.4; else st.drainLive += dt/1.4; }
        st.burstSum += p.burst; st.burstN++;
        prev.set(p, { burst: p.burst, sprint: now, why: now ? p.sprint.why : null });
      }
      // the flame-shot opportunity: carrier (not keeper) within 260 of his target goal
      const o = E.ball.owner;
      if (o && o.role !== 'K' && E.targets[o.team] !== null){
        const g = E.goalCenter(E.targets[o.team]);
        if (Math.hypot(o.x-g.x, o.y-g.y) < 260){
          st.rangeFrames++; st.rangeBurstSum += o.burst;
          if (o.burst > 0.7) st.rangeReady++;
        }
      }
    }
  }
  st.jumps   = E.TEL.jumps || 0;
  st.headers = E.TEL.headers || 0;
  st.zHigh   = E.TEL.zHigh || 0; st.zSky = E.TEL.zSky || 0;
  st.flame   = E.GKSTAT.superShots || 0;
  st.gkBurn  = (E.GKSTAT.diveBurns || 0) + (E.GKSTAT.b_dive || 0);
  st.boosted = E.TEL.jumpsBoosted || 0;
  return st;
}

const agg = { starts:{}, startsDead:{}, spends:0, spendsDead:0, entryFees:0, drainDead:0, drainLive:0,
              sprintLens:[], rangeFrames:0, rangeReady:0, rangeBurstSum:0,
              burstSum:0, burstN:0, flame:0, gkBurn:0, boosted:0, jumps:0, headers:0, zHigh:0, zSky:0 };
for (let s = 1; s <= N; s++){
  const r = play(s);
  for (const k of ['spends','spendsDead','entryFees','drainDead','drainLive','rangeFrames','rangeReady',
                   'rangeBurstSum','burstSum','burstN','flame','gkBurn','boosted','jumps','headers','zHigh','zSky']) agg[k] += r[k];
  for (const [k,v] of Object.entries(r.starts)) agg.starts[k]=(agg.starts[k]||0)+v;
  for (const [k,v] of Object.entries(r.startsDead)) agg.startsDead[k]=(agg.startsDead[k]||0)+v;
  agg.sprintLens.push(...r.sprintLens);
}

const per = x => (x/N).toFixed(1);
const L = agg.sprintLens.sort((a,b)=>a-b);
const med = L.length ? L[Math.floor(L.length/2)] : 0;
console.log(`burst study — ${N} matches × ${MIN} min\n`);
console.log('sprint starts per match, by why       (dead-ball share)');
const tot = Object.values(agg.starts).reduce((a,b)=>a+b,0);
for (const [k,v] of Object.entries(agg.starts).sort((a,b)=>b[1]-a[1])){
  const d = agg.startsDead[k]||0;
  console.log(`  ${k.padEnd(10)} ${per(v).padStart(6)}   (${Math.round(100*d/v)}% dead)`);
}
const dTot = Object.values(agg.startsDead).reduce((a,b)=>a+b,0);
console.log(`  ${'TOTAL'.padEnd(10)} ${per(tot).padStart(6)}   (${Math.round(100*dTot/Math.max(1,tot))}% dead)`);
console.log(`\ndiscrete spends per match             ${per(agg.spends)}   (${Math.round(100*agg.spendsDead/Math.max(1,agg.spends))}% dead)`);
console.log(`sprint entry fees per match           ${per(agg.entryFees)}`);
console.log(`sprint drain, tank-equivalents/match  live ${per(agg.drainLive)}   dead ${per(agg.drainDead)}`);
console.log(`median sprint length                  ${med.toFixed(2)}s   (drain empties a full tank in 1.4s)`);
console.log(`mean burst level, all men all frames  ${(agg.burstSum/Math.max(1,agg.burstN)).toFixed(2)}`);
console.log(`\nthe flame-shot picture`);
console.log(`  carrier-in-range frames/match       ${per(agg.rangeFrames)}`);
console.log(`  ...of those, burst>0.7 (ready)      ${per(agg.rangeReady)}  (${Math.round(100*agg.rangeReady/Math.max(1,agg.rangeFrames))}%)`);
console.log(`  mean carrier burst in range         ${(agg.rangeBurstSum/Math.max(1,agg.rangeFrames)).toFixed(2)}`);
console.log(`  flame shots per match               ${per(agg.flame)}`);
console.log(`\nother spectacle per match`);
console.log(`  boosted jumps                       ${per(agg.boosted)}`);
console.log(`  keeper burst dives                  ${per(agg.gkBurn)}`);
console.log(`  jumps / headers                     ${per(agg.jumps)} / ${per(agg.headers)}`);
console.log(`  ball-frames high / sky              ${per(agg.zHigh)} / ${per(agg.zSky)}`);
