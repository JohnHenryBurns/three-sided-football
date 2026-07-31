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

## Fourteen, and the two inversions

**`dive` and `tackle` were both written from the wrong player's frame**, and that is what
made the flip crash rather than anything about kicks.

```
gkDiveCheck(defT)    called by the SHOOTER, reaching across to move a keeper
the tackle           a rate inside a forEach over opponents, run from the CARRIER's frame
```

Both reach through a variable that means something at the top of the frame and something
else by the time it is read. **Guarding that is impossible from inside the loop; removing
the reach makes it a non-question.**

As actions they belong to the player who acts:

```
dive     his prerequisite is "a shot is coming at my goal"
tackle   his prerequisite is "somebody near me has the ball"
```

**And both return `false`.** A dive is not a touch and a tackle *gains* the ball rather
than releasing it — so the frame continues and the positional instruction still runs. That
distinction is what the runner was built for and these are the first two to use it.

**Rates preserved:** the tackle's `0.010*(0.6+0.8*press)*aggression` with its fresh-tackler
and gassed-carrier terms becomes a score of ~47, which is 1.5% of the frames a tackler is
in range. Every factor survives as a term.

## The flip, attempt two: the crash is fixed, the behaviour is not

**It runs.** No crash, six matches to completion. That is real progress — the crash took
three attempts and is now gone at the root rather than guarded.

**What fixed it, in order of how much it mattered:**

1. **`dive` became a keeper action.** The shooter no longer reaches across to move a
   goalkeeper.
2. **`tackle` became a tackler's action.** The carrier no longer rolls dice for his own
   tacklers.
3. **The owner block requires a *current* owner** — `if(owner && ball.owner===owner)`.
   `owner` is captured before the player loop; an action may have taken the ball since,
   and a block that reasons about a man in possession is wrong when he no longer has it.

That third line is the crash in one condition. **Not a guard on twelve call sites: a
statement that a block about the ball's owner requires the ball's owner.**

### And then it stalls

```
0/6 usable   loose 84-88% on every seed   "nobody chasing"
```

The ball sits. **The ported actions do not reproduce what the cascade was doing** — most
likely their `can()` prerequisites are stricter than the branches they replaced, so
restarts never complete and nobody takes possession.

**That is a behaviour gap, not a structural one**, and it is the right kind of problem to
be left with: fifteen named actions whose conditions can be checked one at a time against
a seed, rather than a crash whose cause is somewhere in 495 lines.

**Next:** instrument which actions fire during a flipped match and which never do. The
ones that never fire are the ones whose `can()` is wrong.

## The instrumentation, and what it says

One flipped match, 300 seconds, 15 players — so roughly **270,000 player-frames**:

```
fired   corner-swing 2   gk-punt 1   gk-clear 1   secure it 2
        tackle 1   pass 3   shield it 1
NEVER   throw-in  penalty  free-kick  gk-roll  dive
        gk-hopeful  pass-safe  shot  shot-power  head it

play on: 142
```

**153 total action opportunities in a whole match.** That is the finding, and it is not
about any individual `can()`.

`runAction` is reached by every player every frame, and for almost all of them nothing
applies — correctly, since they do not have the ball. **But the ball's owner should have
several actions available on nearly every frame he holds it**, and 153 says he almost
never does.

**So the fault is upstream of the conditions.** Either `runAction` is not being reached
for the owner, or the owner exists for far fewer frames than expected. The 84% loose
figure points at the second: **if nobody holds the ball, no ball-owning action can fire,
and every one of the ten looks broken when only one thing is.**

**That reframes the next step.** Not "check ten `can()` conditions" but "find out why
possession barely exists in a flipped match" — one question instead of ten, and the
answer probably restores most of the ten at once.

**Prime suspect:** the claim path. `if(owner && ball.owner===owner)` guards a block with
no `else`, so nothing there handles a loose ball — but if claiming happens somewhere that
depends on that block having run, guarding it would starve possession exactly this way.

## The stall is one constant

```
dormant   1298 owner-frames, 13 possessions won   ~100 frames each
flipped    153 owner-frames, 12 possessions won   ~13 frames each
```

**Possession is won equally often and lost eight times faster.** A carrier releases the
ball within a fifth of a second instead of carrying it.

**`PLAY_ON_WEIGHT = 2800` predicts exactly that.** Actions scoring 300–460 against it fire
on 10–14% of frames, so a hold lasts 7–10 frames. The measurement matches the arithmetic,
which means nothing is broken — the dial is simply wrong.

```
2800    a 360 action fires 11.4% of frames   hold ~9 frames
30000   fires 1.2%                           hold ~84 frames
```

**The cascade holds ~100 frames, so the figure the game already had is around 30,000.** I
chose 2800 by eye when the only actions were a header and a shield, and never revisited it
when eleven more arrived.

**None of the ten "broken" `can()` conditions is broken.** They never fired because nobody
holds the ball long enough for a second action to be considered — the first one available
takes it and ends the possession.

## THE FLIP IS DONE

```
5/6 usable   —   baseline was 4/6
```

Fifteen actions live, the cascade's tackle deleted, its three `gkDiveCheck` calls gone,
and `ACTIONS_LIVE` true.

**What it took, and none of it was the twelve kick sites:**

```
dive -> a keeper action      the shooter stopped reaching across to move a keeper
tackle -> a tackler's        the carrier stopped rolling dice for his own tacklers
if(owner && ball.owner===owner)   a block about the owner requires the owner
PLAY_ON_WEIGHT 2800 -> 60000      the dial that made ten actions look broken
```

**The last one is the lesson.** At 2800 a carrier released the ball within nine frames, so
no second action was ever considered and ten `can()` conditions looked wrong. **One
constant, ten symptoms** — and I only found it by measuring possession directly rather than
inspecting the conditions.

### Where it stands

```
loose 70-76%   baseline 65%     still looser than the cascade
throws 75-96   baseline 38-58   and more of them
goals 18-29    baseline 8-27    in range
```

**Usability is better than baseline and the texture is not.** The ball spends more time
loose, which is the thing to tune next — and it is now tunable, because every release is a
named action with a weight rather than a rate buried in a branch.

That was the point of the whole exercise.

## The keeper/shooter experiment — sequenced

**Why sequenced at all.** Scoring is down a third and there are five plausible causes. If
they go in together the result is one number and no attribution. Each step below changes
ONE thing and is measured on eight seeds against the step before it.

**The current state, and this is the baseline every step is judged against:**

```
goals 11.3/match   gloves 25%   loose 74%   6/8 usable   woodwork ~1 in 8-16 matches
```

---

### Step 1 — `staying up`, and nothing else

A keeper declining to dive is **not nothing**. It is a named goalkeeping decision with a
payoff: stay on your feet, stay reactive, make him commit first. The generic
`PLAY_ON_WEIGHT` cannot express that — it carries no coach weight and appears in no
report.

**Mechanically this changes almost nothing** — he already declines most frames. That is
the point: it makes the decision *visible* before anything is built on top of it.

**Measures:** how often a keeper faces a shooter and holds, versus dives. If the split is
already sensible, the later steps are tuning. If he never holds, the dive weight is wrong
and that is a one-line fix rather than a new mechanic.

**RESULT: the decision is never made.**

```
one match:  stayed up 1, dived 0
goals 12.1 against a baseline of 11.3 — inside noise
```

**A keeper faces a shot and chooses once per match.** The `dive` action has been in the
game since it was built and has essentially never fired — which means every theory about
the keeper suppressing goals was a theory about code that does not run.

**Why:** `can()` requires `ball.isShot && !ball.owner` with the ball inside 260 of his
goal. Either a shot is claimed before a keeper frame comes round, or `isShot` is cleared
early. **Step 2 was going to change what the keeper reads; it now has to establish that he
ever gets asked.**

**This is what step 1 was for.** One measure, one change, and it invalidated the next three
steps before they were built.

### Step 2 — REVISED: why is the keeper never asked?

Not "read the shooter instead of the ball" until we know whether the situation arises at
all. Find where a shot goes between leaving a boot and being gathered, and whether a
keeper ever gets a frame in between.

### Step 2b — the keeper reads the shooter, not the ball

`dive` currently fires on `ball.isShot`, which is an outcome. **You cannot deceive
something that only reads outcomes** — a fake never sets `isShot`, so there is nothing to
fool.

Change the read to *an opponent has the ball, is squared up to my goal, and is in range*.
All observable, all prior to the shot. **Deception becomes possible without building
deception.**

**Noise goes in the timing, not the direction.** A keeper who commits early or late is
beatable; one who commits *wrongly* is just broken.

### Step 3 — the jump becomes a choice

Today the claim test hands him a reach of 23 for high balls **passively**. He gets the top
of the goal for free and never chooses it, which is why a high shot does not beat him.

```
dive        sideways   covers width, commits, 1.2s
jump        upward     covers height, commits
staying up  neither    covers the middle, stays free
```

Three bets against an uncertain input. **The keeper must pay for the top of the goal.**

### Step 4 — the shooter gets goal awareness

The shot offset is uniform across the mouth with **no reference to where the keeper is
standing** — so a third of shots go straight at him by construction. This is the most
likely single cause of the scoring drop and it is deliberately fourth: it should be
measured against a keeper who already commits, or it will be tuned against the wrong
opponent.

### Step 5 — `shot-high`, `shot-far`, `fake-and-pass`

Only once 1–4 are measured. Each is a weight and a coach term; four new weights tuned
against an untested keeper would mean nothing.

**`shot-high` is nearly free:** the keeper cannot claim above z=28 and the bar is at 54.
**A shot aimed between them beats him and risks the woodwork** — real risk and reward
straight out of the geometry, no tuned probability required.

---

**Rule for the sequence:** eight seeds, compared against the previous step, and the result
recorded here before the next step begins. Any step that does not move its own measure
gets reverted rather than kept "because it is more correct".

## RETRACTED: "the carrier has no default"

**Wrong.** John: *"I figured the no-op was effectively the dribble action and they'd follow
their instructions to dribble intelligently."* That is exactly what happens.

```
seed   held%   carrying it / owner-frames
9000      1%   118 / 133   (89%)
9001     27%   2900 / 2921 (99%)
9002     10%   1035 / 1043 (99%)
9003     30%   3186 / 3232 (99%)
9004      4%   441 / 452   (98%)
9005      1%   103 / 123   (84%)
```

**The dribble runs on 84–99% of owner-frames in every seed.** The no-op is the dribble, the
carrier follows `carrying it`, and there is no missing "keep it" action.

**I reported 5% possession from seed 9000 alone** and concluded a whole design gap from it —
after writing the eight-seed rule this morning, and after retracting the loose-ball chain
for exactly this mistake.

### The real shape: it is bimodal

```
matches that work    27%, 30%, 10% held
matches that do not   1%,  4%,  1%
```

**Not a spectrum. Two states.** And it is the same signature as the "degenerate match"
found this morning, which was never solved — only filtered out by the `ok` flag so sweeps
would stop averaging it in.

**So the question is not how much possession a side keeps.** It is why a match sometimes
never establishes possession at all — and that predates the action port, the cascade
deletion and every weight tried today.

## Superseded: the sweep has no answer

**John is right on both counts:** a completed pass is not a turnover, and the weights were
derived against a cascade that ran every frame so they were always going to be too eager.

**But sweeping does not find a value, because the variance dwarfs the effect:**

```
weight    frames the ball is held, four seeds
  2800    1, 50, 12, 3 %
 12000    11, 30, 14, 0 %
 30000    0, 2, 57, 15 %
```

**A dial produces a trend. There is no trend.** Some matches hold the ball half the time
and some effectively never, at every weight tried.

**That says something is absent rather than badly weighted.** The candidate: with the
cascade gone, nothing keeps a possession alive between actions. A man owns the ball, an
action fires and releases it, it flies, and whether anybody recovers it is chance. The
cascade's every-frame evaluation was doing continuous work — carrying, shielding,
re-choosing — that a 3%-per-frame action list does not replicate.

**What is likely missing:** the ball-carrier has no *default*. Every other player has one —
`finding space`, `the back line`. The carrier's only positional instruction is `carrying
it`, and his action list is entirely ways to GIVE THE BALL AWAY. There is no "keep it".

**Next, and it is a design question rather than a tuning one:** should a carrier have a
low-cost action that retains possession — a touch, a turn, a step — so that not-passing is
a positive choice rather than the absence of one? `shield it` is nearly that, but its
`can()` requires pressure within 26.

## The throw-in freeze — half found

**The gap was real and is now filled.** `fetching the ball` walks a man to a loose ball and
sets `got` — **and then stops applying. Nothing else did.** He stood holding the ball until
the 20-second cap voided the restart.

**`carrying it to the mark` is the missing half:** the ball rides with him, goes down on the
mark, and `throwPending` is set so the throw becomes available. Without it the fetch had a
beginning and no end.

**But the freeze survives, and now it is a constant:**

```
seed   longest freeze
9001   10.7s
9003   10.7s
9005   10.7s
9002   13.6s
9004   19.1s
```

**Three seeds freeze for exactly 10.7 seconds.** That is a fixed timeout, not a player
failing to arrive — and it rules out everything about walking distance, clamping, or who
was chosen.

**Ruled out:** the thrower is the closest man to the mark; he *is* exempt from
`clampInside`; `fetching the ball` and the exemption name the same player; and there are
only **2** throw-in stagings in a match, so it is not a re-staging loop.

**Not yet found:** what holds play for 10.7s. `restartHold` is extended by 2400ms at
staging and nothing found so far extends it further.

**Next, and it should be a trace rather than a theory:** log `restartHold`, `pendingRestart`,
`ball.fetch` and `throwPending` every frame through one 10.7s freeze. Four values, 642
frames. That shows what is holding it rather than what might be.

## STILL OWED — the ledger

**Nothing here is done. It is written down so it cannot quietly stop being owed.**

### Not yet ported out of the old cascade

**burst / sprint — an INSTRUCTION, not an action.** By our own boundary rule it is about
*where a man goes and how fast*, so it belongs in the instruction list. The *spending* of
burst already lives inside `dive`, `shot-power` and the sprint itself; what is missing is
the decision to spend it, which is a steering decision. Eleven references went with the
cascade and this behaviour is currently absent.

**stamina and GKSTAT — bookkeeping, not decisions.** Neither is a choice; both are records
kept alongside choices. They want a `stepStats()` that runs each frame, not porting into
anything. Roughly 25 references, all of them counters.

**commentary — a consequence layer.** Fifteen call sites went with the cascade. It should
NOT be ported line by line: an action fires, and a commentary layer decides whether to say
something about it. Hung off action names it works for every future action automatically,
which porting each line would not.

### Owed on the foul system

**Mayhem + Filthy weights that produce a genuinely chaotic match.** John's target: three
Filthy sides under a Mayhem referee should *often* finish a three-minute match with only
the goalkeepers — twelve outfielders sent off.

Also owed at that setting, and currently unverified because the actions never fired:

```
frequent goalie duels        flame shot meets flame dive
unintentional fouls on       shots, headers and tackles — all three are wired,
                             none has ever been observed firing
```

**The incidental foul is built and inert.** It hangs off `tackle`, `head it` and `shot`,
and at 60,000 none of those fired. At 2800 they should — and that is the first thing to
check now that there is no cascade to hide behind.

### The rule that put this list here

Everything above was described, agreed, and then not done — because a measurement went
wrong and the session followed the measurement. **A ledger is cheaper than remembering.**

## Order

1. find the common shape, or establish that there isn't one
2. extract the keeper's distribution first — it is the most tangled and the best
   understood, and `mustKick` and the crowded-keeper rule are already halfway there
3. then shooting, which is where the calibration questions are
4. restart timing last, because it depends on the runs having formed, which needs the
   position list to be reliable — and it now is
