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

## 4. Nobody moves during a restart

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
