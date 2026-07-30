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

**One harness match in three came out wrong** after the tier change — 28 throw-ins,
loose 82%, crowding 0.8 against a normal 1.9. Other two normal. Bad seed or a real
edge; unknown.

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
