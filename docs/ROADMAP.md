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
