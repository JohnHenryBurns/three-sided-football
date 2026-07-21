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
