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

## The harness is seeded

`RNG()` replaces all 56 `Math.random()` calls in the engine. **Seeding is opt-in**:
unseeded it delegates to `Math.random`, so the browser is unchanged — a real match should
be unpredictable. The harness seeds from its configuration.

```
same match, run first and run seventh
  goals 20, throws 76, loose 57.831%   both times
```

**Which makes the degenerate matches investigable at last.** Three of twelve, and each
one now has a seed that replays it exactly:

```
seed 1001   loose 23%   ball held too long
seed 1004   loose 77%   nobody chasing
seed 1007   loose 30%   ball held too long
```

**Those three seeds are the next piece of work.** Two of the three are the ball being
held, which is the signature the watchdog does not catch.

## restartHold does not mean "pause"

I moved the kick-off pause into the engine — right instinct, since a fixed 900ms in
`index.html` is a fact about the game living where only one renderer can see it — and
lengthened it to a sampled 1.6–3.4s, as planned for throws and corners.

**4/6 usable, against a baseline of 6/6.**

**The cause is that `restartHold` means *a restart is being staged*, not *play is
paused*.** Nine instructions read it that way:

```
offering a lane        flooding the mouth      prowling
an ally offers deep    packing the near zone   closing it down
vultures with patience the second wave         sweeping
```

Setting it after a kick-off tells all nine that a throw or a corner is being set up when
none is — so men prowl a ball nobody is taking and vultures wait at midfield for a
restart that has already happened.

**What the kick-off pause needs is its own state**, meaning "play has not begun yet", read
by the loop and by nothing else. Two concepts sharing one variable, which is the same
fault as `out` and `sentOff` and the same fault as `lastTouch` doing two jobs at the goal
line.

**Third instance today.** The shape is always: one flag, two meanings, and the bug appears
only where the meanings diverge.

## Action instructions

Designed and analysed in **`ACTIONS.md`**, not built. The short version:

- **headers are not an instruction** — *going for the header* is a `job()` tag on a
  surviving cascade branch, which is why it reads 0% in every log
- actions cannot join the position list, because **instructions steer** and `mustKick`
  proved it at 6/6 → 3/6
- they want a **second list**, because a carrier moves *and* decides at once
- **only three of ten kick sites have a readable guard.** The rest are positions inside a
  larger block — so several action decisions **do not exist yet** and would have to be
  authored rather than extracted

That last point is the important one: the position extraction was safe because it moved
code without changing behaviour. An action extraction cannot be, because half of it is
new judgement.

## Not everything is an instruction

**John asked whether the back-pass rule is one. I tried it and it should not be.**

```
mustKick as a flag             6/6 usable, gloves 39%
as a REQUIREMENT instruction   3/6 usable, gloves 31%
```

**Instructions steer.** Every one of the 38 ends in a `steer()` — that is what an
instruction *is* here: a decision about where a player goes. The back-pass rule is not
about where the keeper goes. It is about **what he may do with the ball once he has it**,
and dressing it as a steering decision made him walk about instead of clearing.

**The boundary this draws:**

```
instruction   where a player goes            steer()
rule          what may happen to the ball    a condition on an action
correction    what modifies a chosen move    collision, walls
```

`noChase` genuinely was a missing instruction — it was about movement and I had written
it as a prohibition. `mustKick` is not. **The lesson from the noChase fix does not
generalise to every flag**, and I applied it without checking.

**Kept as a flag**, with the tier vocabulary borrowed only for the comment: it is a
REQUIREMENT in spirit, and a condition in code.

## Air is not grass — worth doing, not yet safe

**The ball gets ground friction while airborne.** `0.985` per frame is applied to every
loose ball, so a punt fifty feet up is slowed by grass it is nowhere near. That is why
long balls die, and why the punt power had to be cut so hard to stop them going out.

Split into `0.997` in the air and `0.985` on the ground, a punt carries **252 through
the air then 203 rolling** rather than 254 in total. That is the arc John wants: the
flight does the distance and the grass does the stopping.

**But on six identical seeds:**

```
back-pass rule alone   6/6
air drag alone         5/6
both together          3/6
```

**The two interact**, which is the interesting part — a keeper forced to kick and a ball
that carries properly are individually fine and together produce three degenerate
matches. Likely: forced distribution now reaches much further, so possession swings
further and faster than anything else is tuned for.

**Shipped the back-pass rule; held the drag split.** The drag is the more correct change
of the two and it wants its own session with the punt power re-derived around it.

## The teleport standard, measured

**Eight seeded matches, every remaining teleport by cause:**

```
22   kickoff        ~2.8 a match
13   goal kick      ~1.6 a match
 3   unattributed   across all eight
```

**Throw-ins and corners no longer appear at all** — both fetch, and the ball never jumps.
That is most of the way to the standard, from a list that once had eight named sources
and fourteen unnamed.

### The goal kick resists the fetch

I gave it the same treatment: ball placed in the six-yard box, keeper walks to it. **On
six identical seeds it went from 6/6 usable to 3/6** — three matches degenerated, two
with the ball held and one with nobody chasing.

**That is the seeded harness earning its cost.** Before today I would have shipped it,
seen a noisy sample, and argued about whether it helped. The A/B is on the same six
matches and the answer is unambiguous.

**Two fetch designs tried, both worse, on identical seeds:**

```
baseline (teleport)          6/6 usable
keeper walks out to fetch    3/6      two held, one nobody-chasing
a defender fetches instead   1/6      five nobody-chasing, loose 78-96%
```

The second was the fix for the first — keep the keeper on his line, send the nearest
outfielder — **and it was much worse.** Loose at 94-96% means the ball sits and nobody
goes for it at all, so the restart never completes.

**What that says:** the fault is not *which player* fetches. It is that `pendingRestart`
with a non-thrower taker does not complete for a goal kick — a throw-in ends when the
thrower reaches his mark and throws, and there is no equivalent step here. The fetcher
arrives, puts the ball down, and nothing takes it.

**So the goal kick needs the completion path examined, not another fetcher.** Two
attempts at the wrong layer is enough.

**The kick-off and the goal kick remain the last two teleports.**

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

## Design: the taker should wait

**What happens now.** A throw-in is ready at `readyAt` — about 1.1s — and a corner at
roughly 2.9s. Both are fixed. The taker arrives, the ball is live, and the men who were
supposed to be making runs are still making them.

**What it should be.** John: *"the average should be 2x the current pause or more,"* and
crucially **"sometimes they can move quick."** Those are two different asks and both
matter:

**The average goes up.** A restart is the only moment either side gets to arrange itself,
and rushing it wastes the one bit of choreography the game has. Roughly 2.5s for a throw,
5–6s for a corner.

**The variance goes up more.** A fixed longer pause is just a slower game. What makes a
restart dramatic is *not knowing* — a quick throw that catches a defence still walking
back is worth having precisely because the last one took six seconds. So: sample the
wait, don't set it.

**Shape it wants:**

```
throw-in   0.6s to 4s, mean ~2.5    quick ones are a real tactic
corner     3s to 9s, mean ~5.5      nobody takes a quick corner
free kick  unchanged                already has the wall-clear condition,
                                    which is a better trigger than a timer
```

**And the wait should end early on a condition, not only on a clock** — when his side's
runs have actually formed. That is the same shape as `wallClear()` for the free kick:
*take it when it is ready, or when you have waited long enough.* A timer alone means the
pause is dead time; a condition means it is anticipation.

**Order:** wants the seeded harness, because "does a longer pause make the game better"
is exactly the question a tournament answers and an opinion does not.

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
