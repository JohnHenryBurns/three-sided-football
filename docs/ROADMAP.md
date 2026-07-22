# Coach Simulator Roadmap

## Vision
Evolve the sim into a playable coach simulator: pick your team, pause into a coach menu,
set strategy, call plays. The AI runs the other benches.

## What the simulations taught us (the findings ledger)

All tested in `sim/strategy-lab.js` (headless port of the shipped engine + feature flags),
5-minute matches, 90-game duels vs baseline where noted.

**Validated:**
- **Hybrid dribbling** (spring-carried ball, touch impulses, spatial dispossession at 30px,
  shoulder contests at 26px): healthy scoring (~2.5 g/min), turnovers down ~15%, dispossession
  splits ~50/50 positional vs contested. Green-lit.
- **Give-and-go v2** (return ball only to an OPEN runner, runs curve into space): neutral
  competitively, +20% pass completion, narratable. Ship as flavor.
- **Pincer response** (bunker when both rivals hunt you): works dramatically — halves scoring
  in an all-aware world. Defense-as-strategy is real.

**Falsified (five times):**
- Give-and-go v1 (blind runs, forced returns): 2.8% win rate. Fixed in v2.
- Shape-based offensive schemes (overload / switch / direct): 21–24% win rate vs 33% chance.
- ...even after adding man-marking defenders (so shapes have something to drag): still lose.
- ...even after space-valued shooting (open shooters accurate, smothered ones spray): still lose.
- ...even after openness-valued passing + first-time finishing: **16.7% / 11.1%** — worst yet.

**The conclusion:** in this agent economy, *mechanism-level* intelligence (find the open man,
shoot when open, mark threats) beats *shape-level* prescriptions. Once the substrate mechanics
exist, emergent positioning outperforms any rigid scheme imposed on top — the schemes' fixed
stations (deep target man, flooded flank, parked wide outlet) are pure opportunity cost.

## Design consequence: strategy = dials, not shapes

The coach menu should expose **parameters of proven mechanisms**, each with a real tradeoff:

| Dial | Mechanism | Tradeoff |
|---|---|---|
| Tempo | pass attempt rate | ball movement vs turnovers |
| Risk | shot threshold / lane tolerance | shots vs possession |
| Line height | defensive f-values | compactness vs counter exposure |
| Press | chaser aggression / count | turnovers won vs stamina burned |
| Directness | pass range & progress weighting | fast attacks vs interceptions |
| Posture | bunker (pincer response) on/off | goals against vs goals for |

Plus **callable plays**: bounded, legible contracts (give-and-go v2; kickoff set plays later).

## Build order
1. `feature/dribbling` — port hybrid dribble physics (+ plays v2 riding along).
   ⚠ contest radius MUST exceed the 23px solid-body distance (this bug has now fired twice).
2. Substrate mechanics, tuned: man-marking, space-valued shooting, openness-valued passing,
   first-time finishing. (Note: these suppress scoring in bunker worlds — retune shot rates.)
3. Tactics dials (AI defaults per situation; groundwork for the coach menu).
4. Coach UI: team select at match setup, pause-menu tactics, play-calling. Tap-to-coach
   grows from target orders into the full bench.

## Tactical presets: mix-and-match identities (not raw dials)

Rather than exposing sliders, the coach menu offers **named preset cards on two axes**,
one pick per axis, freely combinable. Each preset is a calibrated bundle of the dial values
above — calibrated in the strategy lab so no pairing dominates.

**Attack identities** (tempo / risk / directness bundles):
- **Tiki-Taka** — high tempo, low risk, short passing. Death by a thousand touches.
- **Route One** — direct, long range, high risk. Get it to the big man.
- **Swashbuckle** — high tempo AND high risk. Goals at both ends, no apologies.
- **The Probe** — patient, low risk. Make the bunker chase until its legs go.

**Defense identities** (line / press / posture bundles):
- **Gegenpress** — max press, high line. Win it back in 6 seconds or die trying.
- **Park the Bus** — bunker posture, deep line, minimal press. You shall not pass.
- **The Trap** — mid-block, press triggers on the wings. Invite them in, snap shut.
- **Balanced** — the shipped defaults.

Combinations produce recognizable footballing cultures for free: Tiki-Taka + Gegenpress
(Barcelona-brain), Route One + Park the Bus (proper lower-league), The Probe + The Trap
(tournament knockout cynicism), Swashbuckle + Gegenpress (chaos, but principled chaos).

**Calibration requirement:** run the preset matrix (4×4 pairings, round-robin duels) in the
strategy lab and tune bundle values until the win-rate matrix is reasonably flat — every
identity viable, matchup texture without a dominant meta. Rock-paper-scissors edges are fine
(press should punish probe; bus should frustrate route one); auto-wins are not.

**Coach flow:** pick team at match setup → pause anytime for the coach menu → swap preset
cards mid-match (with a short "instructions reaching the pitch" delay) → call bounded plays
(give-and-go v2, kickoff set plays) as one-shot commands.

## Out of bounds, throw-ins, and the stadium (probed, not yet built)

**Probe result:** removing walls entirely, with zero AI changes, yields **2.84 OOB/min**
(lab, balanced world). Prior wall-avoidance work (dribbler steering, pinned outlets,
teammate-targeted passing) already keeps play interior — the feared AI overhaul is
actually a modest discipline pass.

**Build phases (sim-first, per house rules):**
1. **Discipline** — clamp all kick targets inside a ~24px margin polygon; cap pass power
   by distance-to-line along the pass direction; strengthen dribbler line-avoidance.
   Target: ~1.5–2 OOB/min.
2. **Restarts** — staged like penalties (brief freeze, thrower at the spot, opponents
   stand off):
   - *Throw-ins* on the neutral edges — short-range restart, cannot score directly
   - *Goal kicks* when the attacker puts it behind; *CORNERS* when the defender does —
     a corner is an automatic lofted delivery from the vertex into the box, which feeds
     directly into the header-duel and timed-run systems already built. Corners should
     raise headers/min meaningfully; measure it.
   - **Three-team question** (open design decision): who gets the throw when the toucher
     concedes it? Candidates: nearest non-touching opponent (spatial, simple — leading
     candidate), the lower-ranked non-toucher (underdog throw, juicy house rule), or
     alternating. Decide in the lab by watching which produces the least weirdness.
3. **Wall retirement** — the pinned-outlet mechanic and wall-aware dribbling get retuned
   or retired; lofted balls that clear the line are simply out (they currently bounce
   off infinitely tall walls).

**Stadium dressing** (can ship independently, and OOB needs the visual space anyway):
extend the viewBox beyond the pitch — concentric crowd rings with team-colored sections
behind each goal, benches on a neutral edge (the coach-sim tie-in: your bench is visible;
the sent-off player's walk of shame ends AT the bench, head in hands), a tunnel, maybe
hex-league ad boards. Crowd opacity pulse on goals later.

**Phase 1–2 lab results (validated, ready to port):**
Full package (discipline + restarts + keeper parries): 3.68 stoppages/min
(throw-ins 1.36, corners 1.04, goal kicks 1.28), goals 2.78/min, headers DOUBLED to
1.0/min via corner deliveries, pens stable. Key findings: the OOB floor is shot misses
(goal kicks are realistic, not a bug); corners cannot exist without **keeper parries**
(clean-catch keepers never concede them) — fast shots now 40% parried wide, which also
adds rebound chaos. Parry direction must push wide-and-out, not infield. Port list:
discipline kicks (clamp + power cap), stronger line-avoidance, throw-in/goal-kick/corner
staging (FAST — ~1.2s, not penalty ceremony), parries with visuals, setup toggle.

## House rule addition (born from the first post-touchlines crash)
`sim/game-smoke.js` runs the REAL index.html script headlessly (stubbed DOM, pumped
loop) across multiple Mayhem matches and reports any exception with a stack trace.
It found a scope bug in the restart hold gate within 60 simulated seconds.
**Protocol: `node sim/game-smoke.js` must pass before any push that touches index.html.**

## Next session: National identities & the team selector

**Vision:** every nation plays like itself. The preset inventory (attack/defense/aggression
identities + dial offsets) gets assigned per-team from real-world reputation, and the
roster expands well beyond the founding three. AI teams then play their NATIONAL identity
by default (retiring the "AI stays Balanced" caveat) — so Spain passes you to death
whether or not anyone coaches them, and every uncoached match has tactical texture.
The coach menu still overrides everything for any bench a human takes.

**Identity assignments (draft — tune by reputation and lab):**
- Spain — Tiki-Taka / Gegenpress-lite, Clean
- Argentina — Probe / Trap, Nasty (the dark arts are heritage)
- England — Route One / Balanced press, Firm
- Brazil — Swashbuckle / Balanced, Clean (jogo bonito)
- Germany — Balanced / Gegenpress, Firm (the machine)
- Italy — Probe / Park the Bus + Trap, Nasty (catenaccio lives)
- France — Swashbuckle-lite / Trap counters, Firm
- Netherlands — Tiki-Taka (total football) / high line, Firm
- Morocco — Park the Bus / lightning counters, Firm
- Japan — high-tempo press, Clean
- Portugal, Croatia, Mexico, USA... (~12-16 total; each needs a 2026 squad roster)

**Team data model:** per nation — colors/accent, squad (K/D/D/M/F names), identity
bundle (atk/def/agg + optional dial nudges), display stats (ATT/MID/DEF/FLAIR/AGGRO
bars derived from the bundle so the UI never lies about the engine), one-line
reputation blurb, star player.

**Team selector UI:** optional "Choose teams" entry from the setup dialog — three
slots, tap a slot to browse the library; each team card shows colors, identity
abbreviations (e.g. TT·GP), stat bars, blurb, and star. Selection writes into the
three TEAMS slots. **Rapid start is sacred:** the default Kick off with
Spain/Argentina/England must remain exactly one tap, zero new friction.

**Lab work before shipping:** a national-identity round-robin to confirm no degenerate
default triple (e.g. three buses producing 0-0-0), using the existing H2H harness.
Smoke harness must pass; selector is pure UI but identity auto-application touches
match init.

**Uneven-squad simulations (5-5-4 and 5-4-3, full OOB package):** zero mechanical
errors — the engine handles asymmetric teams cleanly. The strategic finding is the
surprise: being shorthanded is heavily compensated by hunt-the-leader dynamics.
In 5-5-4 the four-man team finished MID-TABLE (-0.3) while a full-strength rival
finished -1.4; in 5-4-3 the THREE-man team scored the most goals per match (4.8)
and tied for best record. Weak teams never lead, so they never get pincered — an
"invisibility dividend." Jorn's anti-binary thesis, validated computationally.
Implication: red cards sting less than they look in ±1 scoring; no rebalance needed,
but worth knowing for the family meta.

## Alliance passing: weighted-alliance analysis (lab, 4-min balanced worlds)

| weights (base/press) | ally/min | goals | leader conceded | score spread |
|---|---|---|---|---|
| OFF | 0 | 2.65 | 4.9 | 2.32 |
| tuned −320/−150 | 2.4 | 2.58 | 5.0 | 1.92 |
| **shipped −260/−80** | **5.0** | **3.05** | **6.3** | **2.29** |
| liberal −120/−30 | 11.3 | 3.32 | 6.8 | 2.45 |
| free love 0/0 | 21 | 3.08 | **5.0** | **3.61** |

**Findings:**
1. **The loyalty tax IS the targeting system.** Leader punishment follows an inverted-U:
   it peaks near shipped/liberal weights and COLLAPSES back to baseline under free love —
   unlimited fraternization stops aiming at the leader and just inflates variance
   (spread 3.61). Pricing the alliance is what points it at the front-runner.
2. Too-strict weights (tuned) make the mechanic decorative: 2.4 passes/min moved leader
   punishment not at all. Shipped (−260/−80/+20) sits at the knee: near-max anti-leader
   effect (+29% leader goals conceded) at half liberal's frequency. KEEP SHIPPED;
   if it feels chatty on the phone, press 80→110 is the dial.
3. **Asymmetric squads are the mechanic's true home.** In 5-4-3: score spread fell
   from 2.84 to **1.61** (−43%) and leader punishment rose to 7.1 (+34%). The
   shorthanded coalition genuinely functions — combined with the invisibility
   dividend, uneven matches with alliances are now the MOST competitive
   configuration ever measured in this game. The 1v1v2 field report was right.

**Alliance pricing v2 (supersedes the weight table above):** the flat loyalty tax is
replaced by scoreboard-priced desperation: `desp = 0.28×(foe's lead over you) +
0.4×(man shortfall vs foe) + 0.45 if you have no outfielders; penalty = 850×(1−desp)`,
softened 20% under pressure, −80 when alone. Lab validation: **ally passes while the
match is tied: ZERO** (every run); passes vs a runaway leader (margin ≥3): 23–39/match.
The mechanic now reads exactly as designed — nobody robs Peter to pay Paul in a close
game, but a runaway leader or a man-advantage mismatch turns the other two into a
functioning coalition. Solo-survivor combos (1v1v2) preserved via the shortfall and
no-outfielder terms.

**National identities: SHIPPED.** 12-nation TEAM_LIBRARY with grounded identity bundles
(each nation's atk/def/agg from the validated preset inventory), reputation blurbs, and
stars. National identity is now every team's RESTING state — AI teams play their nation
(caveat retired); coach Release returns a team to its national identity, not Balanced.
Team selector: optional "Teams" row in setup → per-slot picker with derived stat bars
(ATT/DEF/PRESS/FLAIR/AGGRO computed FROM the engine bundle), blurb, star; duplicate
picks auto-swap slots; world (crowd sections, goals, dugouts, chips) rebuilds on
selection. Rapid start untouched: ESP/ARG/ENG one-tap kickoff.
Round-robin sanity (lab): BRA/GER/FRA 3.3 goals/min, JPN/POR/USA 2.4 — healthy.
KNOWN TEXTURE: double-bus triples (ITA+MAR) run ~1.15 goals/min — siege football by
design; the preset counter-cycle still decides them (Probe/TikiTaka beat buses).

**Long strikes (from a field report):** shot logic had zero awareness of openness,
lane, or angle — open carriers just dribbled to the keeper (report confirmed at
mechanism level). New branch: 125–250 range + clear lane + decent angle + space
= a ripped 11.2-power drive with distance-scaled scatter. Lab: 1.05 long
strikes/min, goals flat (accuracy tax works), headers +44% via rebounds/corners.

**Own-goal investigation (from a champion-card field report):** breadcrumb-instrumented
the lab ball (shot/pass/tackle/stray/parry tags) and classified every OG over 30
matches. Verdict: UNANIMOUS — 53/53 own goals were keeper parries crossing their own
line ("wide-and-out" exits through the mouth when lateral speed can't clear it in
time; rate 1.77/match, 12.4% of ALL goals). Fix: the parry now aims past the NEAREST
post (computed from the keeper's along-mouth offset) at higher speed. Result: OG
0.07/match (0.5% of goals — football's natural rate), corners fully preserved at
1.1/min, headers 0.72. One cause, one geometric fix, pipeline intact.

**Keeper's-moment study (real-engine headless measurement, 12-match batches):**
Instrumented the live game via a __probe() port and iterated four times. Final:
holds ~30/min; sweeper activity ~9 s/min (keeper genuinely claims loose balls);
**rolls 100% forward** (the backward roll is extinct — outlet spreading + forward-
first selection); **scrum density during holds 0.15–0.22 opponents** (goalmouth
pileups dissolved — the feature's primary goal); punts 5.5/min at distance-scaled
power with space-aware targeting (deep AND alone). Punt retention 35%: in a
three-team contest neutral parity is 33%, so launches beat parity WHILE flipping
the field — territory profit even on losses. Goals 2.95/min (top of healthy).
Journey: naive punts hit 11.5/min at 21% (possession donation); fixed via
distance-scaled power, cadence gating, outlet damping (goals had spiked to 4.2),
and openness-scored targets. gk-study.js committed as the measurement harness.

**Set-piece choreography study (real-engine, 10–12 match batches):**
Coached positioning now begins the moment a restart is called: throw-in receiving
lanes (staggered infield), coached marking of lane runners (shadow the passing
line, stand-off ring respected), corner box-flooding by the attacking team,
near-zone packing by the conceding team, and — the three-sided twist — the third
team reads its alliance: allied → joins the attack (deep outlets at throws,
second wave at corners); hostile → counter stations at midfield. Measured at
delivery: attackers-in-box 1.37→2.0 (hustle 1.75 + corner hold 2.9s), defenders
2.0, ALLIED THIRD-TEAM BODIES 1.94 when alliances active — coalition corners are
sieges. Far-post deliveries 45%-dialed (~55–63% measured after fallback deliveries
vanished), each with a chance of Coach Eric's "FAR POST!" carrying across the
pitch. Delivery softened (6.8 pw, 2.8 zv) after the buffed flood pushed goals to
3.48; settled at 3.05/min with corners as a legitimate weapon. Keeper suite
stayed stable throughout (rolls ~100% forward, scrum ≤0.29). Harness fixes en
route: __forceRules() headless port (stub checkboxes read falsy → oobRule was
off, zero restarts), and a NaN aggregation bug that hid all new counters.

**Liveness false-alarm postmortem (John called it):** No game stall existed. The
clock runs 0.75x wall by design, so 90 sim-sec holds max 67.5 clock-sec; eventful
matches (4 goals + red card + countdown + walks) spend ~46s on ceremony and
legitimately land ~30-35 clock-sec — under the harness's stale 40s threshold,
calibrated before this session's ceremony additions. Verified quantitatively from
probe dumps (predicted ~33, observed 30.3/30.8/31.5/35.2) and by 40 consecutive
clean matches at threshold 15 (real stalls freeze in the opening seconds).
Lesson banked: `cmd | tail -1` masks exit codes — the pipeline reports tail's
status, which is how the alarm initially slipped past a gate.

**Keeper-hold judder fix:** The scrum-clear repulsion ring (push out at 64, chase
pulls back in) created boundary oscillation — defenders vibrating in place. Replaced
with coached jobs during holds: hostile Ds retreat to depth (0.34 axis + lateral
spread) to defend the punt landing; hostile M/Fs cover roll lanes (62% along
keeper→outlet, min 85 from keeper); allies drop into their own shape rather than
pressing a friend's keeper. No opposing force boundaries → no flap. Measured:
punt retention rose to 46% (positioned defenders contest landings), rolls still
100% forward, goals 3.31 (variance band). Scrum metric reads 0.62 but now counts
transit, not orbit.

**Burst energy system (tank + throttle), calibrated by sweep:**
Stamina is now the TANK (slow, caps the meter: 0.35+0.65*stamina); new per-player
BURST is the THROTTLE (1.4x speed, hard physics cap 1.6 combined with fire).
Constants chosen by 3x3 sweep on the real engine: BURN 2.2s to empty, RECHARGE
11s to full — denial rate 20-27% (scarcity is felt; heroes usually answer), goals
in envelope. Triggers (all hysteresis-committed, 0.5s min, 2.2s cooldown, 0.55
meter to start): dead-heat races on settled balls (margin<22, one racer per team),
last-man defensive emergencies, open-grass breakaways, true punt landings
(z>34 + pace, one chaser per team), keeper sweeps. Sweep journey: naive triggers
produced 1671 bursts/min of state-thrash (ownership flicker re-triggering);
fixed via commitment windows, cooldowns, per-team racer election, and killing a
stakes gate that hex geometry made always-true (every point is near SOME goal).
Numbers are Mayhem-stress; family-default churn is far lower. Visual tell:
dashed white afterburner ring while bursting. Set-piece staging speeds untouched.

**Scramble churn + burn-time follow-up (Johns three questions):**
(1) "How much field is 2.2s of burst?" — measured: ~148 u/s sprint speed → 2.2s
continuous = ~325 units, over HALF the pitch width (too much; instinct correct).
Empirically bursts self-resolve in ~0.7s / ~100 units (triggers end when races
end), so burn time really sets BURSTS-PER-TANK, not dash length. Default cut to
1.4s: one big burst then vulnerable (~200-unit max dash, denial ~30%).
(2) Confident clears: claiming under 2+ wolves within 36 → first-time driven boot
(260 units, power 7.6) aimed away-from-pack bent toward midfield ("safety, not
glory" — a target-goal bend turned clears into artillery, goals hit 5.27), with a
0.4s universal claim/header lockout (the escape guarantee — flat clears got
intercepted in the pack, lofted ones got HEADED back into the same spot).
Same-spot rapid-reclaim churn: 22% baseline → 13-18%; total claims -27%.
(3) Booth wired to burst truth: "two empty tanks lumbering after the same ball"
fires only when 2+ nearby contestants have burst<0.2; "finds ANOTHER gear" on
live sprints; clearance lines at 18%.

**Hold-outlet inversion fix:** outlet depths (0.34/0.6/0.85 of goal axis) were all
DEEPER than normal formation — the whole team retreated toward their holding keeper
(the earlier goal-damping had overcorrected into a huddle). Now 0.62/0.95/1.25:
outlets sit ahead of shape, F past midfield as the punt target. Goals 3.45/1.9
across two batches (mean 2.68, centered); rolls 100% forward; churn steady.

**Throw-in loop post-mortem (77% of throws were a self-loop):** The behind-the-
chalk fix stood the thrower 9 units out of bounds — and the spring-dribble carry
(ball chases a point ahead of its owner) dragged the OWNED ball over the line
after him during the pre-throw hold; OOB fired on the carried ball → same-spot
re-throw, forever. Found via loop tracer: every trace read wasThrowPass:true,
z:0, dt≈0.86 (the staging cycle itself). Fix: ball velocity zeroed and carry
suspended while throwPending — the ball waits ON the chalk, thrower behind it.
throwRepeat 77%→0%, throws/min 75→15 (normal). Bonus landed en route: throws now
LOFT (zv 2.4, flight-tuned power) sailing over lane blockers per John's design —
lane-blocking penalty replaced with landing-openness target scoring; clears
edge-clamped; detector cross-match hygiene.

**The fire duo (supershots + dive bursts, one shared tank):**
Shooters with >0.7 burst may spend 0.6 on a FLAME SHOT (40-50% uptake): 1.3x power,
tightened accuracy (0.75 spread), the ball burns in flight, "extinguished!" note
when caught. Keepers answer: dive burst (0.6 tank) extends claim reach 17->23 for
1.2s — ALWAYS against flame shots (fire meets fire: the duel), 12% against
ordinary danger, penalties included. Balance journey: first cut had keepers
diving 9-16/min and NET-NERFED scoring (1.6); rarity-gated to land goals ~2.0 vs
1.9 baseline — the ordered slight buff, partially offset by dives, exactly as
specced. Shared-tank competition is real: denial rose to ~55% because shots,
dives, and sprints all drain the same meter — a striker who empties the clip has
no legs for the recovery run. Booth: John Wick pool (Baba Yaga, empties the clip,
sudden terrible intent), duel calls, keeper explosion lines.
