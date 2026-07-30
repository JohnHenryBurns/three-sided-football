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

## To investigate

**The corner trio is duplicated.** The three waves are in the list *and* still in the
cascade. The list wins (1300+120 beats a cascade branch that never gets scored) so the
copies are unreachable — but two copies of a decision is how they drift, and I broke
the file twice trying to delete them. Delete carefully, with the brace depth checked.

**Gloves at 55%**, up from 44% then 38% across three logs while I was changing keeper
behaviour. Three moves in one direction is not noise. Suspects: the clearance path, the
area clamp, the crowded-keeper rule.

**Woodwork 0 in ten matches** with 7% of airborne time above the crossbar and a max of
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
