# Epic: The Midfield

A multi-session build. This document is the plan and the ledger — it holds the design, the
decomposition into shippable slices, and (as we go) what each slice actually measured. Nothing
here ships without the gate green and the two-bank bench clean, same as everything else.

## The ask (John)

> Add a midfield position. It could depend on the coaching strategy whether a team goes two
> forwards + two defenders, or puts either a forward or defender in mid. Midfielders should float
> between offense and defense depending on the score and ball position. Forwards and midfielders
> should start more forward / spread out on the third-field dividers at kickoff. Mids should help
> the forward by positioning back from the goal for long shots and assists to the forwards.
> Ensure the list of teams has a good mix of default role assignments based on their coaching
> strategy.

## What already exists (so we build on it, not over it)

Measured from the shipped engine before writing a line of this:

- **The `M` role is already real.** `formation()` returns `K, D, D, M, F` per team, and the
  cascade already has `M`-specific instructions: a bunker-mode screen (`applies: role==='M' &&
  bunker>0.5`, sits at 0.62 of the way from own goal toward the ball) and a shared M/F
  "supporting the attack" instruction where `M` holds at 0.45 of the way to the target goal and
  `F` pushes to `0.72 + (direct-0.5)*0.26`, each offset laterally to a side. So a midfielder
  today is a forward that hangs back and screens in a bus. That is the seed we grow.
- **Coaching strategy is already a vector, not a label.** Each team carries
  `id:{atk, def, agg}`. `def` selects a `DEF_PRESET` (`line`, `press`, `bunker`), `atk` is an
  attacking style, `agg` an aggression tier. `T(t)` / `TACTICS(t)` expose the live tactic vector;
  `nudge:{...}` on a team overrides individual dials. This is what role composition should key
  off — not a new parallel system.
- **Score-awareness exists.** `leaderIdx()` and `score[]` are available; nothing in positioning
  reads them yet. The float-with-the-score behavior is new territory but the inputs are there.
- **Formation geometry is a clean function.** `formation(t)` builds every slot from the goal
  center, the goal-edge basis (`fx,fy` toward center, `px,py` lateral), so new shapes are new
  arithmetic in one place, and `sidesSet()` / kickoff / post-goal setup all read it. Change the
  shape once and the whole restart machinery follows.

## The one lesson we do not get to relearn

ROADMAP.md, in blood: **shape-level prescriptions lose to mechanism-level intelligence.** Rigid
offensive schemes (overload / switch / direct) lost to a plain "find the open man, shoot when
open, mark threats" baseline five times, 16–24% win rates against a 33% chance line. The midfield
must therefore be built as *better mechanisms and better starting positions*, not as a
choreographed scheme the players are forced to obey. A midfielder floats because the cascade
scores a float instruction higher when the situation calls for it — not because a script pins him
to a coordinate. Every slice below is a mechanism or a geometry change, never a play.

## Design

### 1. Role composition is a property of strategy, not a fixed 1-1-2-1

Today every team is `K/D/D/M/F`. The ask is that strategy decides the outfield four. Proposed
compositions, keyed off the existing `def`/`atk` vectors:

| Shape        | Outfield         | Fits (existing presets)                     |
|--------------|------------------|---------------------------------------------|
| Balanced     | `D D M F`        | `def:Balanced` (England, Brazil)            |
| Bus          | `D D D F`        | `def:ParkTheBus` (Italy) — a mid drops to D |
| Press/attack | `D M F F`        | `def:Gegenpress` + high `line` (Spain, NL)  |
| Trap/counter | `D D M F` w/ deep M | `def:Trap` (Argentina, Mexico)           |

The keeper is always `K`. The composition is derived once, at team setup, from the team's `id`,
and written into the roster's role list — so `formation()` and every downstream reader see it
without new plumbing. A `D M F F` team genuinely fields two forwards; a bus fields three at the
back. This is the "good mix of default role assignments based on coaching strategy" made literal.

**Open question for a later slice:** rosters are fixed 5-man lists with a designated `star`. When
a team shifts a D into midfield or a mid up to forward, which named player moves? Cleanest is a
per-team `roles:[...]` default in `TEAM_LIBRARY` so the assignment is authored, not inferred — a
mid is whoever the team says it is. That keeps Rodri a mid and Messi a forward regardless of shape.

### 2. Kickoff spread — forwards and mids start on the third dividers

The hex is three teams' thirds. At kickoff the ask is that forwards and mids start *more forward
and spread out along the third-field dividers*, not clustered near their own goal. `formation()`
currently pulls everyone back toward the goal (F at depth 250 of ~ a third). The change: push F
and M starting depths outward and fan them laterally so a team's attacking band sits on the
dividing lines between its third and its neighbors' — visually a team "spreads to the borders"
ready to press, rather than huddling. Geometry only, in `formation()`; the restart machinery
(`sidesSet` at 130-unit tolerance, the post-goal `taking up position`) already tracks whatever
shape it returns.

Constraint that bit us before (#319 era): keepers and everyone must be *at their formation spot*
for `sidesSet()` to release the kickoff. Spreading the shape must not put a man so far from his
spot that the kickoff never ripens — validate arm-delay after the change.

### 3. The floating midfielder

The heart of it. A midfielder is neither a forward nor a defender but slides along the axis
between his own goal and the one he attacks, and *where* he sits is a function of two live inputs:

- **Ball position** — ball in our attacking third, the mid pushes up to become a second wave
  behind the forward (the "back from the goal for long shots and assists" station). Ball in our
  defensive third, the mid drops to screen in front of the back line.
- **Score** — chasing a deficit floats the whole midfield line forward (more support, more
  bodies near the F); protecting a lead floats it back (a third defender in all but name). This
  is the `leaderIdx()` / `score[]` read that nothing uses yet.

As a mechanism, not a script: this is a cascade instruction whose *target* is computed from
(own goal, attack goal, ball, score) and whose *score()* rises when the mid is the right man to
float — leaving the actual movement to `steer()` and the actual arbitration to the cascade, so it
competes with chasing, intercepting, and supporting like everything else. The "position back from
the goal for long shots and assists to the forwards" line is a specific target: not level with the
F, but a set distance behind and offset, where a cut-back or a lay-off finds him and where he is a
shooting option the defense has to honor.

### 4. The mid helps the forward

Concretely, three behaviors that are all target-and-score tweaks on the existing support
instruction, not new scripts:

- **The trailing shooting station** — when the F is engaged near the box, the M holds 20–30 units
  behind the ball, central, as the long-shot / rebound outlet.
- **The overlap** — when the F carries wide, the M fills the space the F vacated so a cut-back has
  a target. (Watch the give-and-go lesson: only offer the return to an *open* man; a blind overlap
  into traffic is the falsified v1 pattern.)
- **The second-wave arrival** — the M times a late run into the box rather than arriving with the
  F, so two waves attack the same ball a beat apart. Timing, not a fixed slot.

## Decomposition into shippable slices

Each is one PR, single concern, gate-green, two-bank bench, in order. Later slices assume earlier.

- **M0 — Authored roles.** Add a `roles:[...]` default per team in `TEAM_LIBRARY` (still `K D D M
  F` for everyone) and have setup read it instead of the hardcoded `formation()` order. Pure
  refactor, zero behavior change — the bench must be *identical*. This is the seam everything else
  needs; landing it alone proves the seam is invisible.
- **M1 — Strategy compositions.** Give teams their real shapes (`D D D F` bus, `D M F F` press,
  etc.) via the M0 seam. Now `formation()` and the cascade field different outfield fours. Bench
  each composition; expect real economic shifts (a `D M F F` side should score more and concede
  more) — the point is they should be *sensible* per strategy, and stable across both banks.
- **M2 — Kickoff spread.** Push F/M starting depths onto the third dividers, fan them laterally.
  Geometry only. Validate kickoff arm-delay unchanged and `sidesSet` still releases.
- **M3 — The float.** The score+ball floating target for the M, as a cascade instruction. This is
  the one most at risk of the shape-lesson trap — build it as a mechanism, bench it against a
  no-float control, and be ready to falsify it if a static mid outperforms.
- **M4 — Forward support.** Trailing shooting station, honest overlap, second-wave timing. Each a
  small target/score change, each benched for whether it actually helps (goals up, or assists up,
  without a turnover tax) rather than merely looking busy.
- **M5 — Team-mix pass.** With all mechanisms in, tune the 15-team `id`/`roles` table so the
  league has a genuine spread — buses, pressers, balanced sides — and the defaults *read* like the
  teams they name. A findings pass, not new code.

## How each slice proves itself

Same discipline as the rest of the engine:
- Gate exits 0 before any push.
- Two independent seed banks (48 matches/side); one bank lies.
- Measure the specific claim — for M3, a float-vs-static control; for M4, assists and shot quality,
  not motion. A prettier-looking midfield that loses is a falsified slice, and we say so here.
- No teleporting players; the kickoff is the one declared exception, and M2 must not add another.
- Land baseline-moving changes (M1 especially) alone, never stacked with a second concern.

## Ledger (filled in as slices land)

- *(pending)* M0 — authored roles seam.
- *(pending)* M1 — strategy compositions.
- *(pending)* M2 — kickoff spread.
- *(pending)* M3 — the float.
- *(pending)* M4 — forward support.
- *(pending)* M5 — team-mix pass.
