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
