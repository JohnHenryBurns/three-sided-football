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
