# Instructions — working log

Nineteen extracted. The list is in `engine.js`; this is what's known about it and what
needs looking at.

```
SCRIPT       4000   what happens. No agency.
REQUIREMENT  3000   what may not. A veto.
COACH        1300   a tactic. A WEIGHT — 300 above PLAYER, so a strong decision beats it.
PLAYER       1000   what he chooses.
```

## The list

| tier | instruction | notes |
|---|---|---|
| SCRIPT | fetching the ball | the taker walks to a dead ball |
| REQUIREMENT | retreating from a free kick | ten yards; the only rule that exists to make a restart possible |
| COACH | flooding the mouth | corner, attacking wave, 30–72 out |
| COACH | packing the near zone | corner, defending, 16–34 goal-side |
| COACH | the second wave | corner, an **ally** at 62–102, wider than either |
| COACH | into the box | |
| COACH | marking at a corner | goal-side of his man |
| COACH | the bus — dropping in | `TT.bunker>0.5`, midfielder |
| COACH | holding the counter | `TT.bunker>0.5`, lone forward |
| COACH | getting depth | defender vs a holding keeper |
| COACH | covering a roll lane | **each man picks a different outlet** |
| PLAYER | an ally's keeper has it | no analogue in football |
| PLAYER | holding the middle | nothing left to cover |
| PLAYER | offering a lane | throw-in, 70–165 |
| PLAYER | an ally offers deep | throw-in, 140–230, wider |
| PLAYER | showing for a throw | |
| PLAYER | denying a throw | a body in the lane, not a man on a man |
| PLAYER | just restarted — offering | released by **possession**, not a timer |
| PLAYER | intercepting | the only one with a distance-scaled score |

## Blocked on think() locals

An instruction can only be extracted once **everything it reads is visible from outside
`think()`**. Two hit this already:

- **`holdActive`** — solved with `holdingPlay()`, because it is a cheap question to
  re-ask.
- **`chaser[]`** — **solved.** Hoisted to module scope and computed into the shared array
  rather than a local. That unblocked *prowling* and *closing it down*, which are 12% of
  instructed frames between them.

**The pattern for the rest:** a fact `think()` computes each frame should live outside it.
Anything an instruction needs to read is shared state, not a local — and the alternative
is that the extraction stops at whatever the cascade happens to have hoisted already.

## Coverage

**94% of decisions come from the list**, up from 3% when it was first wired in. The
remaining 6% of cascade is mostly the bunker M/F variants and whatever the burst
decision does — small, and the last of it will need care rather than volume.

The two that did it are the two nobody was looking at:

- **the back line** — 29%. Where a defender stands when he is not chasing.
- **finding space** — 27%. Everybody else, fanned sideways, with a spread that grows as
  play compresses toward the target goal. **55 normally, up to 158 in the last 230** —
  width instead of pile-in, and the reason a crowded box is not a scrum.

## What is actually left

Twenty steer calls remain in the per-player loop. **Most are not work — they are dead
copies.** Eight duplicate instructions that are already live: fetching, the corner
waves, holding the line, prowling, closing it down, the back line, retreating from a
free kick, offering after a restart.

They are unreachable, because the list scores first and returns. But *unreachable* and
*deleted* are different, and two copies of a decision is how they drift.

**Now extracted (PR #149):** *vultures with patience*, *sweeping*, *pushing up*. The
cascade is at **2% in the harness**, matching the browser — which is the first time the
two have agreed on anything all session.

**Previously listed as unextracted, best guess: four or five.** A deep line at `og4 + (CX-og4)*0.85`,
a slow chase at 1.5, the keeper's push-up at 250, and one or two around `mx,my` and
`tx2,ty2` that I have not identified.

### Deleting them safely

`DEAD(name)` marks a duplicate branch and counts it. **Zero hits over 300 seconds means
it is genuinely unreachable and safe to cut.** One is instrumented and proven dead; the
other anchors did not match and want doing by hand.

That is the method, and it matters because **I have broken this file twice deleting
cascade blocks by eye.** Evidence first, then the knife.

## Still front-end only

**The walk of shame is implemented twice.** `three.html` moves the man to its bench,
`index.html` moves him to its own, each with its own arrival test. The engine has only
`walkPending`. **That is the `champInfo` shape again** — shared behaviour written twice —
though the bench position genuinely is front-end geometry, so unifying it is not
straightforward.

**The ball's return flight after a goal (`netFly`) is renderer-only.** 27 mentions in
`three.html`, none anywhere else. The flat page teleports the ball; the 3D page animates
it. Same split.

**What is now engine-owned:** who fetches after a goal, who takes the kick-off, where
everybody stands during both a goal restart and a sending-off.

## The harness has no seed, and nothing here is measurable without one

**This is the blocker.** `Math.random()` is unseeded, so no run is reproducible: the same
config gives 23 goals once and 15 the next time. Which means:

- a degenerate match **cannot be investigated**, because it cannot be run again
- a fix **cannot be shown to work**, because before and after are different matches
- the discard rate moves between 1-in-10 and 5-in-15 with nothing changed

I cleared five pieces of leaked per-match state and the discard rate went **up**. That
is not evidence the fix was wrong; it is evidence that **fifteen matches of an unseeded
sim cannot distinguish a real change from noise.**

**Before any tournament: seed the RNG.** A seeded harness turns every one of the open
questions below from an argument into a measurement.

## The degenerate match

**Roughly one in ten, and it is not a fixed code path.** Instrumenting it consumes
`Math.random()`, the sequence shifts, and the match comes out normal — so it is a state
the sim occasionally falls into rather than a branch that is wrong.

Three signatures seen:

```
nobody chasing        loose >75%, crowd <1.4
ball held too long    loose <45%
one side dominant     possession >60%
```

**Every match now reports `ok` and `why`.** A calibration sweep must discard and *count*
the discards — because averaging one 87%-loose match in with nine good ones moved the
goals mean from **25.0 to 19.8**, a 26% error with nothing in the result to say why.

If the discard count climbs during a sweep, something has been broken rather than tuned.
That is the alarm; the filter is not a fix.

## Design: defending a throw-in and a corner

**What exists.** *Denying a throw* puts a body in the lane between thrower and nearest
target. *Marking at a corner* stands goal-side of the nearest attacker. *Packing the
near zone* fills 16–34 out. All three are single-purpose and none of them knows anything
about the state of the match.

**What is missing, and it is the same three things John keeps pointing at:**

**Alliance.** An ally's corner is not a threat, and the current instructions treat it as
one — a marker marks whoever is nearest regardless of shirt. An allied attacker in the
box should be *let alone*, and the men marking him freed to cover somebody who matters.
Alliances are informal, so this is a weight and not a rule: mark him loosely rather than
not at all.

**Score.** Defending at 0-0 and defending two goals down are different jobs. A side that
is bottom should be conceding the near post to keep a man forward, because a corner
survived is worth nothing to them. That is a COACH-tier modifier on how many bodies go
back, and the coach menu already has the axis for it.

**The third goal.** On a hex a corner has *two* defending sides, and only one of them
owns the goal. The other is defending a goal that is not being attacked — and their real
question is whether to commit bodies at all or to hold a counter station. That is
*vultures with patience*, applied to corners, and it does not exist yet.

**Shape it wants:**

```
COACH   marking an ally           loose, and only if nothing better is available
COACH   conceding the near post   when bottom, keep a man high
COACH   committing to the box     the un-attacked side decides how many to send back
PLAYER  covering the second ball  the edge of the box, where a cleared corner lands
```

**And on the throw-in specifically:** nothing currently distinguishes a throw deep in
your own third from one in the opposition's. The first is dangerous and wants bodies;
the second is a chance to press high. Same instruction, one condition, and it should be
a COACH weight on the existing *denying a throw*.

**Order:** this is calibration-shaped work and it wants the seeded harness first. Adding
four instructions and tuning them against an unseeded sim would produce weights that
mean nothing.

## To investigate

**The corner trio is duplicated.** The three waves are in the list *and* still in the
cascade. The list wins (1300+120 beats a cascade branch that never gets scored) so the
copies are unreachable — but two copies of a decision is how they drift, and I broke
the file twice trying to delete them. Delete carefully, with the brace depth checked.

**Gloves at 55%**, up from 44% then 38% across three logs while I was changing keeper
behaviour. Three moves in one direction is not noise. Suspects: the clearance path, the
area clamp, the crowded-keeper rule.

**Woodwork: tunnelling found and fixed, and it was not enough.** The test asked whether
the ball was INSIDE an 8-unit band across the goal plane, and a shot travels 8.5 units a
frame — so it was never once measured inside. Textbook tunnelling. Now it tests the
CROSSING: where the ball was against where it is, with the height and lateral position
interpolated to the moment it met the plane.

**Still zero.** And the diagnosis found something bigger: **the ball crosses a goal plane
only twice in 600 seconds, while forty-odd goals are scored.** So goals are not reaching
this code at all, and the woodwork test is sitting on a path the ball almost never
takes.

**I reported 26,031 duplicate goal calls. That was my own diagnostic, not the engine.**

My loop called `think(); physics();` with no celebration hold, so after a goal the ball
sat past the line and re-scored every frame. Measured through the harness, which holds
play properly:

```
goalScored calls   21
goals reported     21      no duplicates at all
```

Nothing is being swallowed. **The engine was fine and my instrument was wrong**, which
is the fourth time today a measurement has invented a problem.

**What survives the correction:** all 21 goals still have `dPrev <= 0` — the ball is
already past the line on the frame before a goal is given. That is because the goal
needs `d < -6`, so the crossing happens an **earlier** frame than the award. The
woodwork test therefore looks at the wrong frame, and that part of the diagnosis stands.

**Next:** find the frame where the ball actually crosses d=0 and test the woodwork
there, rather than on the frame the goal is given. The
guard is `if(d<7)` inside a six-iteration edge loop — one of those is filtering the
ball out before the crossing test ever sees it.

**Previously: woodwork 0 in ten matches** with 7% of airborne time above the crossbar and a max of
81. That is not rarity, that is a test that does not fire. Check the hit condition
before assuming anything about frequency.

**`unattributed` 24, largest 42.** Consistent across two logs and all small, so not the
camera whip. Almost certainly the throw-in fetch moving the ball onto a carrier and
then onto the mark. Name both.

**The 82% match, and it has now happened three times with the SAME numbers.**

```
loose 82%   crowding 0.8   throws 28-33   goals 9-11
```

Three occurrences, always the first of a run, always the same shape. That is not a bad
seed — a seed produces different wrong numbers each time. Something about the **first
match after a fresh load** puts the game in a state where nobody chases: crowding 0.8
means fewer than one player within 60 of the ball, against a normal 1.7-2.0.

Suspects, in order: `chaser[]` starting as `[null,null,null]` and something reading it
before `think()` first fills it; `targets` being null on the opening frames; the
harness's own first-match setup. **The browser has never shown this**, which points at
the harness — but it points there three times identically, which is worth an hour.

## Notes worth keeping

**Coordination without communication appears three times** — lane-covering, throw-in
lanes, corner waves. Each uses a stable per-player hash so a side spreads out without
anybody agreeing anything. It is the best idea in the engine and it was invisible.

**Naming a family whole finds contradictions.** Marking *offering a lane* explicit when
*showing for a throw* was already autonomous cost a measurable regression, and the
inconsistency was only visible once the two sat together.

**A steer target is the instruction.** `ball.x + ball.vx*6` is intercepting; `ball.x,
ball.y` is chasing. Naming from targets has been reliable; naming from comments has
not, because only 7 of 53 branches carry one.
