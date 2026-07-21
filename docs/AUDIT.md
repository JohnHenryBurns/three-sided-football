# Code Audit — Three-Sided Football
*Performance · Architecture · Bugs — conducted at the close of the touchlines/nations era.*

## Executive summary

The codebase is in genuinely good health for what it is: a ~2,100-line single-file
browser game grown feature-by-feature over an intense period. The disciplined habits
(lab-first mechanics, smoke harness, content-level push verification) have kept
correctness high — this audit found **no critical bugs**, one latent low-severity bug
(fixed), meaningful hot-path waste (fixed), and a set of architectural risks worth
naming before the next growth phase. Ten Mayhem smoke matches pass post-fixes.

---

## Performance

### Hot path anatomy (per 60fps frame)
`loop → think(15 players) → physics (integration, 2-pass body relax, claims, walls)
→ colorCommentary (throttled) → clock/HUD → draw (camera + ~15 actors + ball/trail)`.
At n=15 actors the O(n²) pair loops (~105 pairs) are trivial; the game is nowhere near
CPU-bound on modern phones. The budget threats were **allocation churn** (GC pauses on
low-end devices), not arithmetic.

### Fixed in this audit
| Issue | Cost | Fix |
|---|---|---|
| `fieldersLeft()` ran `players.filter(...)` per call; called from chaser selection (per player!), keeper logic, and ally pricing — dozens of array allocations per frame | Steady GC pressure | Per-frame cache `FL[3]` computed once at `think()` top |
| Ally desperation (foe lead, shortfall, penalty) recomputed **per pass candidate** inside the scoring forEach — identical for all candidates | Redundant work on every pass decision | Hoisted to a single computation per decision |

### Acceptable as-is (reviewed, no action)
- **Feed rendering**: `say()` rebuilds the 40-entry feed via `innerHTML = join()` —
  fine at ~0.5 msgs/sec; revisit only if the feed grows or message rate spikes.
- **DOM writes in draw()**: ~90 `setAttribute` calls/frame — normal for SVG games at
  this actor count; batching would add complexity for no visible gain.
- **Hygiene confirmed**: feed capped (40), pings pruned on expiry, trail fixed-size,
  speech queue decrements on `onend/onerror` and hard-cancels when 3+ behind,
  `pointermove` uses `getBoundingClientRect` only during gestures.
- **Rebuild churn**: `rebuildWorld()` (team change) and `drawBoards()` (per match)
  recreate nodes wholesale — correct trade; these are rare events.

### Watch list
- If actor count ever grows (subs, 22-player mode), the claim/tackle/lane loops go
  O(n²)-relevant; spatial hashing becomes worthwhile around n≥30.
- `performance.now()` is called many times per frame across systems; harmless today,
  but a single per-frame `now` passed down would be cleaner (deferred: wide diff).

---

## Architecture

### The shape of the thing
One HTML file containing: data (team library, commentary pools, offense books) →
geometry → match state → engine (`think`/`physics`) → presentation (SVG build, draw,
camera) → UI shells (setup, coach menu, nation picker) → boot. Sections are
well-bannered and the file reads top-down. **Verdict: single-file is still the right
architecture** for this project — zero build step, trivially deployable, and the smoke
harness depends on extracting one `<script>` block. Do not modularize for its own sake.

### Strengths worth preserving
- **Data-driven identity** (the recent index-keying bug → motif system refactor is the
  model): nations, presets, offenses, lore are all tables; behavior keys off data, not
  positions. Zero index-keyed special cases remain (audited: the England cross and
  keeper-outline cases were the last two).
- **The dial layer**: every tactical behavior routes through `T(t)` — one seam where
  strategy meets mechanics. This is why presets, nations, and the coach menu composed
  cleanly.
- **Two-lab conscience**: strategy-lab (balance) + game-smoke (survival) cover the two
  failure classes this project actually hits.

### Named risks (no action tonight; awareness items)
1. **Global state inventory is large** (~45 mutable top-levels: match, staging,
   camera, coach, restart, walk-of-shame, corner, ally...). Each new staged sequence
   (penalty → walk → restart → corner) adds flags that must be cleared in
   `resetMatch`/`kickoff`. This is the most likely source of future bugs.
   *Recommendation*: a single `stage` object owning all sequence state, cleared
   atomically — good candidate for a dedicated refactor session, not a drive-by.
2. **Lab/game duality drift**: the engines are cousins, not twins (lab carries
   man-marking/openness substrate; game carries restarts staging, walk-of-shame).
   Every port has hit at least one anchor/semantics mismatch. *Recommendation*: keep
   the existing habit — grep-first, exact anchors — and when a mechanic ships to both,
   note it in the ledger with any intentional differences.
3. **Template-pool grammar contract**: offense strings must be past-tense verb
   phrases completing "he ___" (four consumer frames depend on it). Documented here so
   future pool additions don't regress the Romero bug.
4. **`el()` default-parent footgun**: helpers appending to the live SVG unless given a
   parent — fine, but every new build-time function must pass parents deliberately
   (the picker badges do this correctly).

---

## Bugs

### Found and fixed tonight
| Severity | Bug | Fix |
|---|---|---|
| Low (latent) | Sent-off players weren't excluded from the **foul offender** loop — unreachable today only because play freezes between card and walk; one refactor away from ghost fouls | `o.sentOff` guard added |
| Trivial | Long-strike gate carried a vestigial always-true `oobRule!==undefined` condition (confusing, no effect) | Removed |

### Audited and cleared (representative sample)
- Restart chain re-entrancy: dead ball unclaimable; taker protected through grant;
  empty-candidate paths guarded (keeper-wars); eliminated-team corners fall through
  correctly; `allyPass` flag cleared on kick/OOB/claim.
- Walk-of-shame interactions: kickoff teleports, camera booking, bench seating,
  total-sendoff endgame — all exercised by smoke at Mayhem density.
- Free-camera mode: bounds clamped, follow-reset restores presets, gesture handlers
  registered once, no listeners leak on rebuild (svg node persists; only children
  are replaced).
- Grammar frames, luminance-keyed outlines, duplicate-nation slot swaps.

### Test infrastructure recommendation (deferred)
`game-smoke.js` proves *survival*, not *liveness*. Worth adding cheap assertions:
matches end (phase reaches "over"), goals occur across a batch, no position becomes
NaN. Low effort, would catch soft-locks of the "eternal scoreless OT" family that
crash-checking misses.

---

## Protocol retrospective (how we got away with this pace)
The verification ladder that accreted through incidents is the real asset:
exact-anchor greps before edits → all-or-nothing edit scripts → `node --check` →
smoke pass → verbose push → **grep the fix text on the remote** → post-merge diff of
main vs build. Every rung was paid for by a specific silent failure. Keep the ladder.
