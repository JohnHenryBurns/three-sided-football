# Actions and instructions — status

**Measured through `lab.js`, six seeds, 3-minute matches, identities on.**

```
instructions   45
actions        23
goals          4.3 / match
loose          87%
crowd          1.89
engine         287 KB
```

## Where this stands

**The cascade is gone.** 495 lines, then 240, then 68 more. No `steer()` exists outside
the lists and `jobFallback` fires zero times a match.

**Every restart is on the state machine** — throw, corner, goal kick, free kick, penalty.
Fetch → carry → stand → take, driven by where the ball is rather than by flags. **One
teleport remains and it is the kick-off**, which is a reset rather than a jump.

**Penalties exist again.** Nothing had awarded one since the cascade went; the trigger was
missing and the action would have crashed if it had fired. The keeper now guesses left,
right or middle, and separately high or low, before the ball is struck.

**The coach multiplies rather than adds**, which took the identity spread from 1.2:1 to
1.74:1 on passing.

## THE OPEN QUESTION, and it blocks the rock-paper-scissors work

```
passes per match, ten seeds

TikiTaka   92.7 ± 70.0
RouteOne   65.5 ± 59.8

separation 0.42 SD — inside the noise
```

**A three-minute match varies by ±75% seed to seed.** Every identity comparison made this
session was reading noise, including one I reported as an inversion that was nothing.

**Nothing about coaching can be calibrated until this is resolved.** Two options, and it is
a judgement about feel rather than arithmetic:

- **ten-minute matches for calibration** — cuts the relative spread by roughly √3, slow but
  honest, and the only way to see a real matchup matrix
- **sharper dials** — `/25` instead of `/45` spans 3:1 and is visible in three minutes, at
  the risk of caricature

## Next session, in order

**1. Resolve the noise floor.** Nothing else in this list is measurable first.

**2. Then the RPS triangle**, built in the channel that works — positioning, not weights:

```
GEGENPRESS  beats  TIKI-TAKA     bodies near the carrier kill short passing
TIKI-TAKA   beats  BUNKER        patient circulation finds a low block's gap
ROUTE ONE   beats  GEGENPRESS    a high line leaves grass behind it
```

**The triangle is currently commentary only.** `styleLines()` asserts these counters from
"the lab's matchup matrix", which no longer exists. **Measure the matrix and regenerate the
commentary from it** — if patience does not eat the press, the line comes out.

**3. Smaller things:** `stepStats()` for ~25 loose counters; the Mayhem ceiling (a called
foul stops play, so a strict referee suppresses the count he punishes — *fouls per minute
of open play* is the honest measure); `PEN_R` at 132 gives 1.7 penalties a match against a
target under 1.

## Method notes — these cost the most to learn

**A trace beats an inference.** Four inferences on the corner moved nothing; one trace
found two bugs in a single run. The same held for the goal line, the woodwork, the restart
stall and the carry threshold.

**A measurement showing no change means nothing until the change is confirmed on disk.**
Five string-anchored edits failed silently this session. **Edit by line number.**

**Ad-hoc measurement loops lie.** They skip the celebration hold that `lab.js` and both
browsers honour, and they play a different match. Measure through `lab.js` only.

**Cosmetic randomness must not share the simulation's stream.** `RNG_COS()` exists because
adding a commentary line was changing match outcomes, and the resulting numbers looked
plausible.

**One seed is an anecdote.** Six consistent observations from one seed are one observation.

**A screenshot beat six sweeps.** The surviving cascade, the hovering ball, the phantom
save and the goal-kick teleport were all found from a picture or a sentence, not from the
harness.

---

## New priorities — from watching matches

**1. Instruction state flickers during transitions — MEASURED, NOT FIXED.**

```
job changes in one match: 18,853 — 105 a second

4452  holding the line -> showing for a throw
4452  showing for a throw -> holding the line
3750  closing it down -> standing over it
3750  standing over it -> closing it down
```

**Perfectly symmetric pairs.** Two instructions trading a player every frame, 8,904 frames
of a 10,800-frame match on the top pair alone. That is the flicker, and it reads as
indecision because it is.

**Two attempts, neither worked:**

- proportional commitment `sc*1.09+40` — **worse, 140/s.** `sc` includes the tier constant,
  so ×1.09 on a SCRIPT instruction added 360 and reshuffled which script won. **A bonus
  must apply to the decision, not to the tier.**
- flat 150 — **identical to the multiply, also 140/s**, which means the commitment bonus is
  not the mechanism at all.

**Third attempt: hysteresis on the arrival predicate — also no change.** And instrumenting
it produced the contradiction worth handing over:

```
`standing over it` applies      25,276 times a match
its act() runs                       0 times
the job label reads it           3,750 times
```

**It is chosen and its body never executes.** Three instructions outrank it —
`fetching the ball` 4960, `carrying it to the mark` 4958, `standing over a free kick` 4960
— but that explains it never being chosen, not being chosen and not running.

**Ruled out:** the harness reads the engine fresh (`COMMIT=999999` changes the result), the
scores are constants with no randomness, and only one `job()` call site remains.

**The next thing to check is `runInstruction` itself** — specifically whether `job()` is
set from a different instruction than the one whose `act()` is called. If the label and the
body can disagree, then the flicker is in the label rather than the behaviour, and the
players may not be flickering at all.

**Old lead, now weaker:** `job()` is called more than once per frame by design — there
is a comment saying so. If the flicker is instructions *within* a frame rather than across
frames, the counter is measuring something real but not what it appears to, **and the fix
is elsewhere entirely.** Confirm what a single frame actually does before changing anything
else. Some players change job several times
a second while a restart is being set up. A man who is walking somewhere should keep
walking there; flicker means two instructions are trading a player frame by frame, and it
reads as indecision.

### `pending the kick` — three attempts, and the last one is the informative failure

**Not shipped.** The design is right and something structural resists it.

```
                                    flips/match   goals   throws
baseline (no pending)                    11,183     7.0      19
attempt 1 — pending, sidesSet broken      2,315     1.7       -
attempt 2 — pending, sidesSet fixed       3,645     2.7       -
attempt 3 — pending on a working main    32,993     2.2       9
attempt 3b — guard instead of ranking    68,701     2.8       8
```

**Attempt 3b is the one to understand.** John's correction was right — guard `standing over
it` so it cannot apply to a man already on the spot, rather than making `pending` outrank
it. Arbitration between two instructions that both believe they apply is a patch; a guard
makes the contradiction impossible.

**And the flips went to 68,701, in instructions that have nothing to do with restarts:**

```
20814  pushing up
10299  getting depth
 7733  covering a roll lane
```

**Holding the taker still destabilises the rest of the pitch.** That is the finding: the
problem is not the handoff, the threshold, the ranking or the gate — **a stationary taker
changes the state that thirteen other men are reading**, and their predicates start
oscillating instead.

**Which suggests the next attempt should not be another variation on `pending`.** It should
be finding out why `pushing up` and `getting depth` care whether one man is standing still —
and those are two of the fourteen classification thresholds already listed above as needing
hysteresis. **Fix those first, then try `pending` on a stable pitch.**

### Superseded: traced, one gate found

**The trace finally, and it found a real bug that predates the pending work.**

```
`pending the throw` runs   15,041 frames
throw-in action fires           0 times
sidesSet() evaluated       15,043 times, TRUE ZERO TIMES
```

**`sidesSet()` counts the wrong men.** It waits for 40% of everybody to be back in their own
third — but `positioning for a restart` sends **the taking side forward**, toward the mark,
which is away from their own goal. **The gate could never open**, so the taker stood over
the ball forever.

**A restart waits for the OPPOSING sides to reset.** The taking side is supposed to be
pushing up — that is what showing for a throw means — and counting them as "not set" is
penalising them for doing their job.

**Fixed, and it is not enough:**

```
                       flips/match   goals   loose
working state (no pending)  11,183     6.5     81%
pending, sidesSet broken     2,315     1.7     99%
pending, sidesSet fixed      3,645     2.7     98%
```

**Loose at 98% says the ball still sits on the mark most of the match.** Something else in
the chain is holding it, and `sidesSet` was one gate of at least two.

**Reverted to the working state.** The `sidesSet` fix is correct and is worth applying on
its own, separately from the pending work, where it can be measured without a second
variable.

**Next: the same trace, but on the frame the throw SHOULD fire** — print every clause of
the action's `can()` and find which one returns false. Four clauses, one run.

### Superseded: the design is right, the wiring is not

**John's design, and it is the correct shape:** once the taker reaches his spot, hand him to
a new instruction — `pending the throw`, `pending the corner`, `pending the kick` — which
holds him there. **The ripening belongs in that state**, and the label makes the pause
legible on screen.

**Built, and it does what it should to the churn:**

```
predicate flips   11,183 -> 2,299 a match   (79% down)
`standing over it` leaves the leaderboard entirely
```

**And the game breaks: goals 6.5 → 1.7, loose 99%.** Restarts stop completing.

**Ruled out:** the radius mismatch. `pending the kick` holds him at up to 22 and the throw
action demanded 10, so a man pending at 18 could never throw — aligning both to 22 changed
nothing, so that was real and not the cause.

**What is left to check:** whether `pending the kick` at SCRIPT 4950 outranks the restart
actions' own tier, or whether holding him with a light steer is enough to keep `dist(ball,
mark) <= 12` true. Loose at 99% means the ball sits on the mark all match — **it is placed
and never struck.**

**Three attempts on this instruction, each leaving the game worse than it found it.** The
design is not the problem; the handoff is losing something. Next time: trace one restart
from staging to strike, printing which instruction and which action fire each frame, before
changing a number.

### Unreachable targets and oscillating predicates — the full audit

**John's distinction, and it is the one that matters:** a threshold that **completes**
something must be reachable; a threshold that **classifies** a state needs hysteresis. Some
need both, and applying the wrong one makes things worse — raising `standing over it` from
8 to 16 moved the boundary he sits on and cost two goals a match.

**Measured: 11,183 predicate flips a match across 28 instructions.**

```
7505  standing over it        <- ten times the next worst
 741  showing for a throw     (already hysteresised)
 682  pushing up
 348  chasing at pace
 331  closing it down
```

**Twenty-two bare distance thresholds exist in predicates.** By type:

```
COMPLETION — must be reachable
  fetching the ball 12   carrying it to the mark 14   standing over it 12
  corner-swing 12   throw-in 12   penalty 12/26   goal-kick 20   penalty guess 12

CLASSIFICATION — needs hysteresis
  denying a throw 150   intercepting 120   holding the line 55   coming for it 55
  sweeping 190   gk-roll 110   gk-clear 110   clearing his lines 82
  intentional foul 30   tackle 26   staying up 260   dive 260   head it 11
```

**Attempted and reverted:** making arrival a latched state (`p.__atSpot`, reachable at 18,
cleared on a new restart). **Flips fell 41% and `standing over it` left the top four — and
goals fell 6.5 → 2.2 with loose at 97%.** Once he has arrived the instruction stops applying
and *nothing holds him there*, so he wanders off the mark and the restart never completes.

**The missing piece: a latched arrival needs a `staying there` behaviour**, not just a
predicate that goes quiet. Either the instruction keeps applying and its `act()` becomes a
hold, or a lower-tier instruction has to be a sensible place to fall to. That is the design
question to settle before trying again.

**2. Too many throw-ins, and the cause is passing.** A pass that goes out is a pass that
should not have been played. `bestPass` scores on ground gained, lane, and crowding — **it
does not ask whether the ball will still be on the pitch when it arrives.** Adding a
boundary term should cut throws at the source rather than by slowing restarts.

**3. Reduce clustering — more 1v1 and 2v1.** The interesting football is a man with the
ball and one or two opponents, not fifteen in a scrum. `crowd` sits at 1.89 and wants to
come down; the levers are the spread in `finding space`, the separation radius, and how
many men `closing it down` sends to the same ball.

---

# Roadmap — the 3D pitch

Outstanding ideas, ranked, with what's known and what isn't. `three.html` is the
default-to-be; `index.html` is the reference for anything already solved there.

**Read this first:** the headless harness (`node lab.js`) is trustworthy on ball *state*
— loose %, airborne %, gloves %, dead time, jump size — and worthless on *event counts*.
It has been wrong by 4× on goals, 25× on throw-ins, and infinitely on corners. Anything
event-shaped gets settled by a browser match report, not by the harness.

---

## 1. The goal mouth is twice as tall as the rule

A ball crossing the line scores only if `ball.z < 28`. **The crossbar is drawn at 54.**

So a ball between 28 and 54 passes visibly *under* the bar, inside the frame, and is
handled as an ordinary out-of-bounds. Nothing could reach that band until punts went to
76 this session, which makes it reachable now and therefore visible.

This is the highest-value item because it's an inconsistency rather than a tuning
choice: the picture and the rule disagree, and the picture is the one people believe.

**Wants:** the goal test raised to the bar, and then the three outcomes below.

## 2. Over the bar, off the bar, off the post

There is no woodwork. A shot is a goal, a save, or out — never *nearly*.

- **over the bar** — a distinct outcome with its own commentary, and a goal kick
- **off the crossbar** — the ball comes down, and what happens next is live
- **off the post** — same, and the best sound in football

The geometry is already there and exact: posts are cylinders at a known radius,
the bar is a known height, and the ball has a real z. This is a physics test against
shapes that exist, not new shapes.

## 3. Jumping should count — FOR DISCUSSION

**Where it stands:** the keeper's jump is real, the outfielders' is not.

- keeper — engine (PR #104). A high ball he's under gives him reach **23** instead of
  17, the same as a dive. `z 34–68`, which is exactly the band a shot passes through
  to reach a bar at 54.
- everyone else — renderer only. `_jump` appears **zero times** in `engine.js`, and an
  outfielder's reach is a flat **13** whether he's on the ground or at full stretch.

So a player visibly leaps for a cross and it changes nothing about who gets it.

### What it could become

**Jumps target headers.** Rather than jumping *because* the ball is near, a player
decides to *go for it* — which makes the jump a choice with a cost, and a failed one
leaves him on the ground while the ball runs on. That's the difference between an
animation and a duel.

**Boost gives extra oomph.** The burst mechanic already exists, is already spent on
sprints and dives, and is already visible as fire. Spending it on a leap costs the
same 0.6 a dive costs and buys height the same way — which would make an aerial duel
a resource decision rather than a dice roll.

### THE DESIGN (John, settled)

**A jump is a real arc.** Up, over, down — the same physics the ball already obeys.
A player's effective height is wherever his head actually is at that instant, so
nothing needs to ask who jumped first or who is taller.

That single decision answers everything the questions below were circling:

- **How much reach?** Whatever your head has reached. No table, no constant.
- **Who wins a duel?** Whoever is higher at the moment the ball arrives. Timing, not
  priority.
- **Commit early?** Yes — and it can cost you. Jump before you know where the ball is
  going and you may be on the way down when it gets there.
- **Does a failed jump hurt?** A cooldown before you can jump again, so you land, you
  recover, and the ball has gone.

**Boost buys height.** The burst mechanic already exists, already costs 0.6 for a
dive, and is already visible as fire. Spend it on a leap and go higher — which makes
an aerial duel a resource decision rather than a coin flip, and puts the fire
somewhere new.

**Nobody knows what anybody else is doing.** Players don't share a plan, don't know
who else is jumping, and don't know precisely where the ball will land. Two defenders
can both go and both miss. That's the drama, and it comes free from every player
deciding alone.

### What this needs before it can be written

**Numbers, and only numbers:**

- launch velocity for a free jump, and for a boosted one
- gravity for a person — probably not the ball's 0.14, since a body falls differently
  from a ball and a hang time that feels right matters more than realism
- the landing cooldown
- how early the AI is willing to commit, which is the dial that decides whether aerial
  play reads as skilful or as chaotic

Every one of those is a feel question best answered by watching it, not by arithmetic.
Build it loose, run a match, read the telemetry: **aerial duels won, jumps that missed,
boost spent on height.**

### The earlier open questions, now closed



**How much reach should a jump buy?** A keeper gets 23 diving. If a jumping outfielder
gets the same, the keeper's positional advantage disappears; if he gets much less,
jumping isn't worth the commitment. There's a number here that makes contested crosses
interesting and it isn't obvious what it is.

**Who wins a two-player aerial duel?** Today the nearest player takes the ball. If both
jump, is it whoever jumped earlier, whoever spent more burst, whoever is taller — or is
a coin-flip actually the right answer for a game with cylinder people?

**Does the AI need to decide to jump before the ball arrives?** Real defenders commit to
a cross early. A player who leaps at the last instant always wins, which would make the
whole thing an accuracy check rather than a reading-the-game one.

**And should a failed jump hurt?** Landing takes time. A player who goes up and misses
should be out of the play for a moment, or there's no reason not to jump at everything.

### What's already true and useful

The band is derived, not chosen: `H_HEAD` is 34, "too high to control" is 34, and the
header window sits above it. Punts now reach 76 and the bar is at 54. Those numbers
already agree — whatever gets built here has real geometry to sit on.

## 3b. Original note



Jumping is currently **render-only** (PR #99). A player leaves the ground for a ball
between 21 and 64, capped at 16, which puts his head at 50.

To make it real: a jumping player's reach in the aerial contest scales with how high he
got, so winning a header becomes a function of arriving in time rather than of standing
in the right place. The engine already resolves aerial duels — this would feed them.

**And the keeper jumps.** He dives sideways (PR #67) and cannot go up, which is the
wrong answer to a ball over his head. A high shot should be met with a jump, and his
reach while airborne is the thing that decides whether item 2's crossbar gets hit.

## 4. Nobody moves during a restart — DONE for the kick-off taker

The kick-off taker walks out during the celebration hold and turns to face the ball
coming back to him (PR #109). From most of the pitch he beats it there; from the far
side they arrive together. Either way nobody materialises.

**Still frozen:** everybody else, and the takers of throw-ins, corners and goal kicks
— though those go through `pendingRestart`, which the engine already walks. Worth
checking whether they are actually frozen or merely look it.

### The original note



Play is held for a celebration, so `think()` never runs and every player is frozen
while the ball is booted back to the centre. **The kickoff taker doesn't walk to meet
it.**

The pattern to copy is the walk of shame: a hold-time behaviour that moves one named
player while the simulation is paused. Same shape, opposite direction.

## 5. THE GOLD STANDARD: the ball never teleports

**Every movement of the ball honours the engine's physics. No exceptions.**

Where it is now impossible for the ball to travel — because it has gone into the stands,
or because it is further from the taker than a person would walk — somebody puts it
back:

- **into the crowd** — the fans lob it back, which is a restart *and* a commentary
  opportunity nothing else in the game offers
- **out on the pitch, far from where it's needed** — a player retrieves it and kicks
  it to the spot, the way the post-goal return already works (PR #93, #97)
- **out on the pitch, close** — he carries it there

Each of these is a journey rather than a jump, and the pattern exists already: two
fixed points, a parameter from 0 to 1, over a hold. It cannot overshoot and it cannot
be raced by a dropped frame.

**The list is now self-checking.** A catch-all counts any frame where the ball moved
more than 25 units and *nothing declared itself*. If that reads 0, the list below is
complete — not because the hunt went well, but because nothing else can move the
ball. It currently reads **2 headless, largest 132**, so there are still unnamed
sources.

**Instrumented as of this session.** Every place the engine moves the ball instantly
now names itself, and the report prints the tally by cause — kickoff, throw-in, corner,
goal kick, and a claim that snapped the ball to the claimer. Eight sources.

Four browser matches reported the largest jump as **314, 317, 321, 325**, and until now
I could not have told you what any of them was. **The target is that every line in that
table reads 0.**

## 5b. What is already fixed

The post-goal return travels (PR #93, #97). John reports it still teleports *after* the
initial kick, which is the handover from the returning ball to the engine's own position
at kick-off — the taker is standing on the spot and the ball arrives at the spot, so
they should meet rather than swap. Related to item 4: the taker is frozen during the
hold and does not walk to receive.

## 6. The other restarts



Largest single ball jump in three consecutive browser matches: **314, 317, 321** on a
680-wide pitch. The post-goal return is fixed (PR #93, #97); throw-ins, goal kicks and
corners still snap the ball into place.

Same treatment: interpolate between two fixed points over a hold. Cosmetic, and cheap
now that the pattern exists.

## 7. Throw-in rate

~300–680 per 90 across three logs, against a real ~40. Consistently high, so real.

John's read is that it's a positioning problem rather than a rules problem, and the
crowding figure agrees: **1.9 players within 60 of the ball, against 4–6 in football.**
Nobody is close enough to cut the ball off before it runs out. Fixing the chase and
support shape should collapse the throw-in count without touching the boundary rule.

## 8. Does the new ball height read as anticipation or as dead time?

Punts now reach 76 where they topped out at 45. The engine has always had a
landing-run: above `z 34` and fast, one player per team runs to where it will *land*.
That almost never fired before, because the ball almost never got there.

**Unknown:** whether more time with the ball above catchable height reads as a game
waiting for a header, or as a game standing around. The numbers to watch in the next
log are `loose %` and `loose with nobody within 40`, which were 55% and 20%.

---

## Not on this list, deliberately

**Strategy and tactics.** Three logs show possession at 37/31/31, 40/22/38 and
28/40/32 — the three-way balance works, the coalition behaviour fires, and the
tactical identities visibly change play. It's the healthiest part of the game.

**Goals per match.** Six in a real match, decided at full time or golden goal. That's
a football scoreline. My harness said 20–30; the harness was wrong.

**Keeper hold time.** 43% of owned time in gloves against a real ~5%, and it is *fine*
— he's holding in his box, not playing outfield. The generic commentary made it look
otherwise and now doesn't (PR #97). Left alone on purpose.

**Keeper juggling.** 3–5 scrambles a match involve a keeper. Not visible, not a
problem, and the metric that made it look like one was mislabelled (PR #92).

---

## Working rules for this file

- A browser match report settles event counts; the harness settles ball state.
- If a metric disagrees with what somebody watching sees, the metric is wrong first.
- If the engine resets it and the engine prints it, the engine writes it.
- A hook is for drawing. If the rules depend on it, it isn't a hook.
- Verify an edit landed by reading the file back, not by trusting the replace.

---

# The instruction system

**John's design.** Players should sometimes decide for themselves and sometimes be told,
and they should not flicker between the two.

## Two kinds of instruction

**Autonomous** — he reads his position and the state of play and picks. Chasing,
supporting, dropping, pressing, holding the middle. This is most of a match and it is
what the cascade already does.

**Explicit** — during a transition he is *told*. Fetch that ball. Get in the box. Retreat
ten yards. Stand over it. He does not get a vote, because a restart is choreography and
a player choosing his own part in it is the thing that made throw-ins look wrong.

The engine already has both; it just has no word for either, and no line between them.

## Commitment, and the degree factor

**The fault to avoid is popping.** A cascade re-decides from scratch sixty times a second,
so a player half-way between two branches oscillates — and that is why some of them look
indecisive rather than nimble.

**The fix is a cost to switching, not a lock.** An instruction taken should carry a small
commitment: a fraction of a second where a competing branch has to be *better*, not merely
equal, to take over. That is the degree factor John describes — turn it up and the side
plays with conviction and gets caught out; turn it down and they are twitchy but quick.

**It belongs in the tactics.** ATK/DEF/AGG already change how a side plays; *how decisively*
it plays is the axis that is missing, and it is a real one — a pressing side and a patient
side differ in commitment as much as in shape.

## What it needs first: names

`job()` tags nine branches of fifty-three (PR #127). The rest have to be named before
any of this can be built, because you cannot put a cost on switching between things you
cannot tell apart.

**Three sources, in order of reliability:**

- **steer targets** — the best evidence, and readable. `steer(p, ball.x, ball.y, 2.6)` is
  chasing; `steer(p, CX, CY, 0.9)` is holding the middle; `steer(p, og5.x+ax5*0.55, ...)`
  is dropping toward his own goal. **34 steer calls, and what a branch DOES is what it is.**
- **comments** — only 7 of 53 returns carry one that names the branch, and most of those
  were written this week.
- **git history** — one commit message in the last thirty names a behaviour. Not a source.

So: name from the targets, and where a target is ambiguous leave it blank rather than
guess. A confidently wrong label is worse than a missing one, especially in a system whose
whole purpose is to tell instructions apart.

## Should each instruction be its own function?

**Yes — and the commitment system practically requires it.**

To charge a cost for switching, you have to compare the instruction a player is *on*
against the one he *might take*. A cascade cannot do that: an early return is not a
value, it is a position in a list, and you cannot weigh a position against another
position. Instructions have to become things before they can be compared.

**The shape that works:**

```
  instruction(p, world) -> null            not applicable to him right now
                        -> { score, act }  applicable, this is how much it wants him,
                                           and here is what he does
```

Then `think()` becomes: score them all, add the commitment bonus to whichever he is
already on, take the best, run its `act`. **That is the whole system**, and the degree
factor is one number in one line.

**What the cascade encodes that a list must not lose:**

**Order is priority.** Fifty-three early returns in a sequence are a preference ranking
written as control flow. Extracting them to functions throws that away unless the scores
reproduce it deliberately — so the first pass should give each instruction a base score
matching its old position, and only then start tuning.

**A return means "I acted, stop."** Some branches steer, some kick, some do nothing but
prevent a later branch from firing. That third kind is invisible as a function unless it
is written as a real instruction — *stand still, deliberately* — which it is.

**How to do it without a big bang:**

Not all fifty-three. Take the ones already named by `job()` — nine — and give them the
new shape, with the cascade kept underneath as the default branch. A player picks from
the extracted instructions if any apply, and falls through to the old cascade if none
do. **Both systems run side by side until the list is long enough to delete the
fallback.**

That way the refactor is testable at every step, `?jobs` shows which system is driving
each player, and nothing has to work first time.

## Progress

**Started (PR #130).** The framework is in and three instructions are live, with the
cascade underneath as the fallback:

```
fetching the ball             explicit,   900
retreating from a free kick   explicit,   880
into the box                  explicit,   860
marking at a corner           explicit,   850
showing for a throw           autonomous, 760
denying a throw               autonomous, 750
just restarted — offering     autonomous, 700
```

**Ten of fifty-three.** PR #132 added three more, two of them named from their
*condition* rather than their target:

```
the bus — dropping in   autonomous, 520   TT.bunker>0.5 && role M
holding the counter     autonomous, 510   TT.bunker>0.5 && role F
intercepting            autonomous, 480   ball.x + ball.vx*6 — six frames AHEAD
```

**The bus pair matters more than its size.** `TT.bunker` is a coach setting that
changes *which instruction applies* rather than tweaking a number — so the coach menu
was already reaching into the cascade before this list existed. The list makes that
legible rather than buried, and it is the model for everything John wants next.

**`intercepting` is the first instruction with a real `score()`.** It falls off with
distance, so the nearest man wants it most and the others go and do something else —
which a cascade could not express, because a branch fires or it doesn't.

### Unresolved: the steer that moves somebody else

`steer(owner, adv.x, adv.y, 1.1)` in the keeper block steers the ball's **owner**,
not the player being considered. Everything else in `think()` steers `p`.

I flagged this as an asymmetry, then checked three times and got contradictory
answers about which scope it is in — `p`'s loop opens 29,000 characters earlier, and
whether it is still in scope there needs reading the nesting properly rather than
grepping offsets. **Left alone deliberately.** It works, and converting a block I do
not understand is how a working thing becomes a broken one.

**Seven of fifty-three**, and the four added in PR #131 were named from their steer
targets exactly as planned — `steer(p, g9.x+e9.nx*46+e9.ux*lat, ...)` is *get in the
box and spread across its width*, and `steer(p, mk.x+gx/gl*15, ...)` is *fifteen units
from your man on the line to the goal*, which is goal-side marking.

The cascade copies were **deleted rather than left in place**. Two copies of a decision
is how they drift apart.

### On the popping number

**John does not see flickering in the app**, and the browser says 9.9 switches per
player per second.

Both can be true. **A switch between two instructions that steer a player to the same
place is invisible** — *intercepting* and the cascade's chase both send him at the
ball, so alternating between them looks like one continuous run. The number counts
identity changes; the eye counts movement changes.

So the metric may be measuring something real and unimportant, which is exactly what
the "199 keeper claims" turned out to be. **Do not tune against it until a switch is
shown to change where somebody goes.** The useful version would compare the steer
*target* before and after a switch, not the name.

### Where this leads

The list makes things possible that a cascade could not express:

- **plays** — an instruction that applies to several players at once, each with a
  different part, sharing a trigger
- **coaching by relative position** — a `score()` can read where everybody is, so an
  instruction can want a player *more* when the shape is right for it
- **per-side commitment** — `COMMIT` in the coach menu beside ATK/DEF/AGG

`runInstruction(p)` scores everything that applies, adds `COMMIT` to whatever he is
already on, and runs the winner. Explicit instructions get +1000, so being **told**
always beats choosing — which is the line between the two kinds.

`COMMIT` is **12** and global. It becomes per-side, in the coach menu, once there are
enough instructions for the difference to show.

**Three of fifty-three.** If none applies, the player falls through to the cascade
exactly as before, so both systems run side by side and nothing had to work first time.

## The order

1. name the branches from their steer targets
2. mark each one autonomous or explicit
3. add the switching cost, with a per-side degree
4. expose the degree in the coach menu next to ATK/DEF/AGG
5. watch it with `?jobs` and adjust

Nothing here needs new physics. It is the same cascade, named, with a memory.


---

# What the cascade is doing

Mapped properly rather than branch by branch. `think()` has four parts:

**1. Preamble, before any per-player decision**
- sprint and burst bookkeeping for everybody
- coalition flags — who is allied with whom this instant
- a `gkHolding()` block that moves opponents
- a per-team pass that picks targets

**2. The main loop, `players.forEach(p => ...)`** — 16 early returns before anything
else gets a look:
- `pendingRestart` — the taker's own walk
- `gkHolding` × 4 — own side showing, opponents, an ally, defenders dropping
- `holdActive` × 6 — throw and corner choreography, including ally variants
- want-detection — should he chase, and how hard

**3. `runInstruction(p)` — and this is the finding**

It sits **13,651 characters into the loop, behind 16 early returns.** I have been
describing it as "first refusal" and writing that into commit messages, and it has
never been anything of the sort. **It is sixteenth refusal.**

That is the whole explanation for 97% cascade / 3% list. The list is not losing to the
cascade on merit — it is being handed the players nobody else wanted.

**4. After it:** free kicks, no-chase, headers, landing runs, sprint decisions, the
owner's own movement, and collision and wall avoidance.

## What this means for the rebuild

**Move the call to the top first, and change nothing else.** That one edit tells us
what the ten instructions actually do when they get a real say — and it is reversible
in a line if the answer is "chaos".

Everything measured about the instruction system so far was measured through a
bottleneck I put there and then forgot about. **The 3% coverage, the 95% pop rate and
the 0.28s dwell are all numbers about sixteenth refusal**, not about the design.

## What is worth preserving

The tuning, and it is mostly in the parts that are not decisions at all:

- **the preamble** — burst, coalitions, targets. Not branches; state everything else
  reads. It should stay exactly where it is.
- **want-detection** — the chase logic has real hysteresis (`sprintMin`, `deniedLatch`)
  that stops players flapping. That is the same problem `COMMIT` solves, solved once
  already, and better: it is worth reading before writing a second version.
- **collision and wall avoidance** — runs *after* a decision and modifies it. Not an
  instruction, a correction, and it should stay a correction.

The decisions themselves are the part to rebuild. There are about thirty of them, they
are mostly named now, and the ones already converted came across cleanly.
