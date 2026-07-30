# Action instructions — design

**Not built.** This is the analysis John asked for after the position extraction landed.

## The question

Position instructions worked: 38 of them, 98% of decisions, and behaviour unchanged
through the whole refactor. Should the same treatment go to *actions* — when a keeper
kicks, dives or secures; when a player shoots, dribbles or passes; when anybody heads it;
and when a restart is actually taken?

## First, a correction

**Headers are not an instruction.** *"Going for the header"* is a `job()` tag on a
surviving cascade branch — one of the nine named before the extraction started. It shows
0% in every log because it is tagged, not extracted. Anybody reading the instruction list
would reasonably assume otherwise.

## Why actions cannot join the position list

**Instructions steer.** All 38 end in `steer()`. That is not a convention, it is what an
instruction *is* here: a decision about where a player goes.

`mustKick` proved it. Written as a REQUIREMENT-tier instruction it went **6/6 → 3/6
usable on identical seeds**, because dressed as a steering decision it made the keeper
walk about instead of clearing. The rule was right and the shape was wrong.

## The structural difference

**Position instructions are exclusive. Action instructions are not.**

One position wins and the player goes there. But a carrier is simultaneously *moving
somewhere* and *deciding whether to shoot* — and he may be doing neither, or both.

```
position   where he goes      one winner, every frame, exclusive
action     what he does       may fire alongside a position, or not at all
```

That means a second list rather than more entries in the first, and a different runner:
`runInstruction` picks a maximum; `runAction` would evaluate a set.

## The tiers fit actions better than positions

```
SCRIPT       the throw is taken now              the game acts
REQUIREMENT  a back-pass may not be held         the referee acts
COACH        hoof it clear when crowded          the bench acts
PLAYER       shoot, or square it to the runner   he acts
```

Every one of those exists today as an inline condition. None is named, comparable, or
measurable.

## The obstacle, and it is real

**There is no common verb to extract toward.**

The position extraction worked because `steer()` gave every branch one readable shape: a
target and an urgency. Actions have no equivalent —

```
kick(tx, ty, power, isShot)     14 sites
tryJump(p, boost)                2
stageThrowIn(toucher, e, x, y)   3
stageCorner(ownerT, e, x, y)     2
goalScored(concederTeam)         2
```

Five signatures, five shapes, nothing in common but the fact that something happens.
**Finding or inventing that common shape is the first task, not a detail** — and if it
cannot be found, the whole idea is worth less than it looks.

A plausible shape: `{ can(p), score(p), do(p) }` where `do` calls whichever primitive it
needs. That preserves the primitives and makes the *decision* extractable, which is the
part that matters — the decision is where the reasoning lives and where it is currently
invisible.

## What this would buy

**The restart timing.** *When* a throw, corner or kick-off is taken is exactly an action
decision — "is now the moment?" As a scattered `readyAt` constant it cannot read whether
the runs have formed. As an action instruction it can, which is the difference between a
pause and anticipation.

**Measurability.** The report can say a player spent 27% of frames *finding space*. It
cannot say how often he shot when a pass was better, because choosing is not named
anywhere. Every calibration question about attacking play is currently unanswerable for
that reason.

**And the fourteen `kick()` sites become legible.** Right now the reasoning is inline
next to each one, in comments, and no two are comparable.

## The analysis, continued: what actually decides each kick

Reading the condition immediately above each site:

```
keeper rolls it short     if(pickM)                     — a target exists
corner delivery           no condition                  — it just happens
throw-in                  buried in an ally check
penalty                   if(penaltyShooter===owner)    — a role
keeper punts              no condition                  — it just happens
clearance under pressure  buried in a stat counter
a pass                    if(best && bs>-100)           — a scored candidate
a shot                    buried in a burst check
```

**Only three of ten have a readable guard**, and two of those are *"a target exists"*
rather than *"this is the right thing to do"*. The rest are positions inside a larger
block: the decision was made further up, by which branch you are in.

**That is the real finding, and it is worse than the missing common verb.** The position
cascade at least had branches — sixteen early returns, each one a decision even if it was
never named. The action code does not have that structure at all. *Whether to shoot* is
not a branch anywhere; it is the consequence of having reached a particular line.

**Which means extraction is not the first job.** For positions, the decisions existed and
were merely unnamed. For actions, **several of the decisions do not exist yet** — a keeper
punts because control flow arrived at a punt, not because anything weighed punting
against rolling.

So the work is:

1. **Give the actions decisions to extract.** Where a kick "just happens", write the
   question it should be answering. This is authoring, not refactoring, and it will
   change behaviour — unlike the position extraction, which did not.
2. Only then look for the common shape.

**And that changes the risk profile entirely.** The position extraction was safe because
it moved code without changing what it did, and the harness could confirm that. An action
extraction cannot be safe in the same way, because half of it is new judgement. Every step
wants seeds and a baseline, and "behaviour unchanged" is not available as a check.

## Built: the framework, and one action

**`ACTIONS` and `runAction(p)` are in**, with the shape John named:

```
can(p)     prerequisites — is this even available
score(p)   how much it wants to happen, within its tier
act(p)     do it, calling kick() or tryJump() as needed
tier       SCRIPT actions are mandated; PLAYER actions are chosen
```

Actions run **before** instructions and **do not consume the frame** — a man who heads
the ball is still somewhere and still wants to be somewhere next. That is the whole
difference from the instruction list.

### The header, and what calibration looks like

The first action, and the one that was never real. Three measurements on six identical
seeds:

```
reach 18, no lockout   0/6   aerial 95-97%   the ball never lands
reach 18, 1.2s lockout 3/6   aerial 37%
reach 11, 1.2s lockout 4/6   aerial 31-34%   baseline is 20%
```

**The first was a headed-ball loop** — one header sets the ball flying, the next man heads
it again, forever. **An action that produces its own prerequisite needs a refractory
period**, which is the same lesson as the woodwork lockout.

**It is still not right.** 4/6 against a baseline 6/6, and aerial at 31–34% against 20%.
The header wants either a tighter band, a cost, or a competing action to lose to — and
that is a simulation question, which is where John said it belongs.

**The framework is the deliverable and it works.** The action fires, is counted, is
tiered, and can be tuned against seeds. That was not possible this morning.

## The transplant, not the scalpel

**John, after I patched around a crash for the third time: "treat it like major surgery
organ replacement not a scalpel cut at a time."** He is right, and the crash is the
evidence.

### What went wrong incrementally

Adding *hoof it* and *through ball* crashed `kick()` with a null owner — **not in my new
code, in the cascade.** Actions run first, an action releases the ball, and everything
below assumes the owner it saw at the top of the frame still exists.

I guarded the per-player path. **It crashed somewhere else.** I was about to armour
`kick()` itself, which would have made a primitive tolerate a state that should never
reach it — hiding the transition rather than finishing it.

**A half-transplanted organ needs finishing, not a splint.**

### The thirteen sites

```
2223  keeper rolls it short          2438  a shot
2255  corner delivery                2451  a shot, the other variant
2280  throw-in                       2490  a pass
2298  penalty                        2953  free kick
2365  keeper punts
2380  clearance under pressure
2384  nowhere to aim
2409  a pass
2410  fallback: hit the middle
```

Two are already actions (*head it* releases the ball correctly because it runs alone).
**Thirteen remain, and they must move together** — because the crash is caused by the
*mixture*, not by any one of them.

### How to do it in one operation

1. **Every one becomes an action** with `can`/`score`/`act`, in a single change. No
   partial state where some kicks are actions and some are cascade.
2. **The cascade's kick sites are deleted, not disabled.** Two copies is how they drift,
   and this time two copies also crashes.
3. **`runAction` becomes the only thing that releases the ball.** Then "an action ended
   his frame" is a rule with one enforcement point rather than a guard sprinkled at each
   call.
4. **Baseline first, on the six seeds.** The position extraction could claim "behaviour
   unchanged"; this one cannot, so the baseline is the only way to know what it cost.

### Why it is safe to do at once, despite the size

The seeded harness. **Six identical matches before and after**, and a discard count that
must not climb. That check did not exist this morning and it is the whole reason a
transplant is now a reasonable thing to attempt rather than a reckless one.

## Step two: written, not wired

**All thirteen exist on the `transplant` branch. None of them fires.**

`ACTIONS_LIVE` is `false`, `runAction` skips the ported set, and the cascade does every
kick exactly as it did this morning. Proven rather than asserted:

```
six seeds against baseline.json, switch off
6/6 IDENTICAL — goals, throw-ins and loose% to two decimals
```

**This is the split the surgery rule allows.** The transplant must be atomic, because the
*mixture* is what crashes — some kicks releasing the ball through `runAction` while
others release it inline. But **writing the organ is not fitting it.** With the switch
off there is no mixture: the cascade owns every release, as before.

### What each one carries

```
SCRIPT   corner-swing  throw-in  penalty  free-kick
PLAYER   gk-roll  gk-punt  gk-clear  gk-hopeful
         pass  pass-safe  pass-alt  shot  shot-power
```

Every one has `can`, `score`, `tier` and **`coach(T)`** — John's correction, that the
bench weights *every* action rather than owning a tier. `gk-clear` is PLAYER now: a
bunkering side weights it +110 and a passing side does not, and neither is being ordered.

**The `score()` floors are the interesting part.** `pass-safe` at 90 and `gk-hopeful` at
100 are deliberately below everything else — they are what happens when nothing better
applies, which is how the cascade's `else` branches translate into a scored list. An
`else` is just the lowest score.

**The `act()` bodies are stubs returning false.** Filling them is the flip: move each
cascade site's body into its action, delete the site, set `ACTIONS_LIVE = true`. One
commit, six seeds, and it either holds or reverts whole.

## The ripening no-op

**John's idea, and it removes every hardcoded restart delay in the engine.**

A mandated action does not fire the instant it is legal. **It ripens** — its weight grows
each frame against a fixed no-op at SCRIPT tier, so the chance of it happening rises from
nearly nothing to a certainty, and *which frame it lands on is sampled rather than set*.

```
0.5s   weight   100   p=0.10
1.0s   weight   400   p=0.31
1.5s   weight   900   p=0.50
2.0s   weight  1600   p=0.64
3.0s   weight  3600   p=0.80
```

Quadratic: **hesitant, then decisive**, which is how people are.

**This is the variable pause, and "sometimes they can move quick" falls out of it** rather
than being a special case. A quick throw is not a different rule — it is the tail of the
same distribution.

**And the growth rate is where tactics reach it:**

```
direct 0.2   rate 328   even odds at 1.7s
direct 0.5   rate 430   1.4s
direct 0.8   rate 532   1.3s
```

Same action, different urgency, no second code path. A penalty ripens at 130 with no
coach term at all — **the pause is the drama there, and nothing about a side's tempo
should hurry it.**

**What it replaces:** `readyAt: nowMs()+1100`, `cap: nowMs()+2000`, `restartHold +2400`,
and the 900ms kick-off pause. Four constants, each of which made every instance of its
restart identical.

## The deletion, scoped properly

**The flip fails on a guard, and the reason is structural.** `gkDiveCheck(targets[owner.team])`
sits at line 2891 — **outside the per-player loop**, in a block that captured `owner` at
the top of the frame. An action releasing the ball leaves that stale, and no guard inside
the loop can reach code that runs after it.

So step 2 is load-bearing, not tidiness. But measuring it changed the estimate:

```
the owner-decision block   495 lines, 12 kick sites
```

**And it is not only kicks.** Interleaved with them:

```
gkHolder / gkHoldUntil     the keeper's hold state
stats.tackles / o.tackles  tackling — not an action at all
owner.noChase, the hop     the thrower's follow-through
ball.puntBy                possession tracking the ally rules read
```

**None of those was ported, because the port was looking for `kick()`.** They are
bookkeeping that happens to live beside kicks.

### What the deletion actually is

Not a deletion. **A separation**: pull the bookkeeping out of the block, leave it running,
and remove only the decision-and-kick pairs the actions now own. The block shrinks rather
than vanishes.

**Three things must survive it:**

1. `gkHolder` — the keeper's hold is read by four instructions
2. tackling — an entire mechanic with no action equivalent
3. `ball.puntBy` and the ally-pass flags — the three-sided rules depend on them

**And `gkDiveCheck` needs an owner that is still valid**, which means either passing the
team explicitly or moving the call into the shot actions where the shooter is known.

### Estimate

Larger than a flip and smaller than a rewrite. **The organ is ready and the cavity needs
preparing** — and knowing that precisely is worth more than another attempt at the boolean.

## Order

1. find the common shape, or establish that there isn't one
2. extract the keeper's distribution first — it is the most tangled and the best
   understood, and `mustKick` and the crowded-keeper rule are already halfway there
3. then shooting, which is where the calibration questions are
4. restart timing last, because it depends on the runs having formed, which needs the
   position list to be reliable — and it now is
