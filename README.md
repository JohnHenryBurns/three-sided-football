# Three-Sided Football ⚽⚽⚽

A browser simulation of **three-team soccer** on a hexagonal pitch — three teams, one ball,
two enemies each, and no permanent friends.

Based on [three-sided football](https://en.wikipedia.org/wiki/Three_sided_football), invented
by Danish situationist philosopher Asger Jorn in the 1960s as an argument against binary
us-vs-them thinking. This version started as a backyard thought experiment with my son and
escalated.

**Play it:** open `index.html` in any browser or view the [Github page](https://johnhenryburns.github.io/three-sided-football/). No build step, no dependencies — one self-contained file.

## The game

- Hexagonal pitch with penalty areas and netted goals, three sides: **Spain, Argentina,
  England** (2026 World Cup squads — Yamal, Messi, Bellingham, and friends)
- **Two scoring modes**, chosen at match setup:
  - **±1 points** (default): +1 to the scorer, −1 to the conceder — every goal is a
    two-point swing and the third team is untouched
  - **Classic** (Jorn's original): fewest goals conceded wins
- **Match structure**: 1-minute blitz (default), 3, 5, or 10 minutes, plus randomized
  **stoppage time** that grows with fouls, cards, and penalties. At full time, ties break
  FIFA-style on goals scored. Still level? **Golden-concession overtime**: concede and
  you're eliminated (players leave, your goal visibly seals), survivors play golden goal.
- Teams dynamically re-target the current leader, so alliances form and betray in real time.

## The referee 🟨🟥

- **Fouls**: clumsy or cynical challenges — more likely from tired or aggressive defenders,
  rarer inside the box. Open-play fouls give the victim a one-second free-kick advantage.
- **Cards**: yellows and (rare) straight reds, each pausing the match with a popup naming
  the offense — drawn from a book of crimes ranging from "tactical hug" to "rugby-tackled
  him out of pure nostalgia." Booked players wear a card pip; second yellow means red.
- **The walk of shame**: a red card stops everything. The camera escorts the offender on
  his long trudge to the touchline, name and card overhead, before play resumes a man down.
- **Penalty kicks**: fouls in the box point to the spot — staged run-up, keeper on his
  line, conversion decided by real keeper physics (~74%, matching the real world).
- **Referee dial** at match setup: Off, Balanced, Aggressive, or MAYHEM.

## Features

- 15 autonomous agents with roles (keeper / defenders / mid / forward), passing lanes,
  solid-body collision, and facing indicators on every player
- **Touch dribbling**: the ball is its own body — long pushes in space, close control under
  pressure, and heavy touches that anyone can pounce on ("poked away!")
- **The aerial game**: long balls fly over the press, header duels where crosses land,
  and a crossbar that shots can sail over
- **Enforce offsides** (optional house rule, default on): no attacker may enter the penalty
  area before the ball — kills goal-hanging, rewards timed runs and crosses
- **Tap-to-coach**: tap 🎯 on a score chip to take a bench, then tap a rival to dictate the
  hunt. Coach multiple benches at once while the AI plays kingmaker.
- **Fatigue**: stamina rings drain on sprints and swing on events; gassed carriers are
  easier to rob, gassed defenders foul more
- **Underdog fire**: score while strictly trailing for a 20-second boost
- **Broadcast presentation**: score-bug HUD floating over the pitch, steadicam chase camera
  with four zoom levels, play-by-play feed, optional **spoken narrator** (Web Speech API),
  team-colored on-pitch annotations, goal celebrations with confetti
- **Champion card**: standings, per-team stats, goal timeline, weighted Player of the Match
- Mobile-first layout for portrait and landscape

## The science (yes, really)

`sim/strategy-lab.js` is a headless harness that has run thousands of matches to tune the
game — every mechanic above survived falsification testing before shipping:

- **Strategy tournaments**: hunting the leader beats all rival targeting policies under
  both scoring modes. Offense is defense.
- **Six tactical dials** (tempo, risk, line, press, directness, bunker posture) validated
  individually, then combined into named identities — Tiki-Taka, Route One, Gegenpress,
  Park the Bus — and tuned until a genuine **rock-paper-scissors counter cycle** emerged:
  patient probing outlasts the press's dead legs, direct play flies over it, the press
  devours risky short passing early. Groundwork for a coach-simulator mode (`docs/ROADMAP.md`).
- **Falsified en route** (five times): blind give-and-go runs, and every shape-based
  offensive scheme — overload, switch, direct — even after adding man-marking,
  space-valued shooting, and openness-valued passing. Mechanism-level intelligence beats
  shape prescriptions; strategy lives in dials, not diagrams.
- Also discovered and fixed: keepers passing into their own net (31% own-goal rate), shots
  tunneling through keepers between frames, fifteen players phase-locking into a
  synchronized shimmy (the Millennium Bridge wobble), one Bellingham posting 11 tackles in
  60 seconds, and a goalkeeper credited as a tackling machine for what were, on review,
  smothers.

Run it: `node sim/strategy-lab.js`

## Files

| File | What |
|---|---|
| `index.html` | The full game (World Cup edition) |
| `classic.html` | The original minimal version — anonymous teams, no mechanics |
| `sim/strategy-lab.js` | Headless lab: feature flags, tactical dials, tournaments |
| `sim/headless.js` | The original batch-experiment harness |
| `docs/ROADMAP.md` | Coach-simulator vision, findings ledger, preset design |

## License

MIT
