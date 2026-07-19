# Three-Sided Football ⚽⚽⚽

A browser simulation of **three-team soccer** on a hexagonal pitch — three teams, one ball,
two enemies each, and no permanent friends.

Based on [three-sided football](https://en.wikipedia.org/wiki/Three_sided_football), invented
by Danish situationist philosopher Asger Jorn in the 1960s as an argument against binary
us-vs-them thinking. This version started as a backyard thought experiment with my son and
escalated.

**Play it:** open `index.html` in any browser or view the [Github page](https://johnhenryburns.github.io/three-sided-football/). No build step, no dependencies — one self-contained file.

## The game

- Hexagonal pitch, goals on alternating sides: **Spain, Argentina, England** (2026 World Cup
  squads — Yamal, Messi, Bellingham, and friends)
- **Two scoring modes**, chosen at match setup:
  - **±1 points** (default): +1 to the scorer, −1 to the conceder — every goal is a
    two-point swing and the third team is untouched
  - **Classic** (Jorn's original): fewest goals conceded wins
- **Match structure**: 1-minute blitz (default), 3, 5, or 10 minutes. At full time, ties
  break FIFA-style on goals scored. Still level? **Golden-concession overtime**: concede
  and you're eliminated (players leave, your goal seals into a wall), survivors play
  golden goal for the title.
- Teams dynamically re-target the current leader, so alliances form and betray in real time.

## Features

- 15 autonomous agents with roles (keeper / defenders / mid / forward), passing lanes,
  tackles, and solid-body collision
- **Tap-to-coach**: tap 🎯 on a scorecard to take over that team's bench, then tap a rival
  to dictate who they hunt. Coach multiple benches at once — two people can run rival teams
  on the same phone while the AI plays kingmaker.
- **Fatigue**: stamina rings drain on sprints and swing on events — completed passes, goals,
  saves, and won tackles restore legs; getting tackled or intercepted drains them. Gassed
  carriers are easier to dispossess.
- **Underdog fire**: score while *strictly* trailing and your team gets a 20-second pace
  boost (flame on the scorecard, glow on the players)
- **Play-by-play commentary** with an optional **spoken narrator** (Web Speech API, offline)
- **On-pitch annotations**: shot!, SAVE!, tackle!, intercepted! float at the point of action,
  colored by the protagonist's team
- **Match setup dialog** on load and rematch; goal celebrations freeze play with confetti
  and a beat of stillness before each kick-off
- **Champion card**: final standings, per-team stats (goals / saves / tackles / possession),
  a goal-by-goal highlight timeline, and a weighted **Player of the Match**
- Broadcast **chase camera** (Zoom button), shot pings, ball trails, possession halo
- Mobile-first layout for both portrait and landscape

## The science (yes, really)

`sim/headless.js` is a Node harness that ran hundreds of headless matches to tune the game:

- **Strategy tournament** (120 matches per ruleset): *hunting the leader* beats hunting the
  catchable rival or attacking the nearest goal — under both +1/−1 and fewest-conceded
  scoring. Offense is defense: while you're camped in the best defender's zone, nobody is
  near your goal.
- **Fatigue** raises second-half scoring ~13% and increases lead changes.
- **Momentum** makes matches streaky and decisive, which is why the shipped version only
  boosts *trailing* teams.
- Also discovered and fixed en route: keepers passing into their own net (31% own-goal rate),
  shots tunneling through keepers between frames, fifteen players phase-locking into a
  synchronized shimmy (same physics as the Millennium Bridge wobble), and one Bellingham
  posting 11 tackles in a 60-second match before the tackle rate was tuned to Earth physics.

Run it: `node sim/headless.js`

## Files

| File | What |
|---|---|
| `index.html` | The full game (World Cup edition) |
| `classic.html` | The original minimal version — anonymous teams, no mechanics |
| `sim/headless.js` | Headless batch-experiment harness |

## License

MIT
