# The Nations Report
*How the twelve national identities actually match up — simulation study, 144 matches.*

## Method
Two experiments in the strategy lab (full modern ruleset: touchlines, corners, parries,
offsides, alliances, aggression): **(1) Power** — each nation in a trio against two
Balanced reference teams, 8 × 4-minute matches, measuring average points (±1 scoring),
goals, and outright-win rate; **(2) Derbies** — six curated all-identity trios, 8
matches each. Read alongside the pairwise counter matrix from the preset-calibration
era. Sample-size honesty: Portugal and France run *identical* profiles yet split
+1.00 vs −2.25 in the power table — that spread IS the noise floor at n=8. Trust
clusters and directions, not decimals.

## The Power Table (vs a neutral field)
| # | Nation | Identity | Pts | GF/GA | Win% |
|---|---|---|---|---|---|
| 1 | Portugal | Swash·Trap·Firm | +1.00 | 5.8/4.8 | 50% |
| 2 | England | Route1·Bal·Firm | +0.50 | 5.4/4.9 | 38% |
| 3 | Brazil | Swash·Bal·Clean | −0.50 | 4.8/5.3 | 38% |
| 3 | Italy | Probe·Bus·Nasty | −0.50 | 2.1/2.6 | 25% |
| 5 | Germany | Bal·Gegen·Firm | −1.25 | 2.6/3.9 | 13% |
| 6 | Japan | Tiki·Gegen·Clean | −1.50 | 2.9/4.4 | 13% |
| 7 | Spain | Tiki·Gegen·Clean | −1.63 | 3.0/4.6 | 13% |
| 7 | USA | Bal·Gegen·Firm | −1.63 | 2.6/4.3 | 13% |
| 9 | Mexico | Tiki·Trap·Nasty | −1.88 | 3.1/5.0 | 13% |
| 9 | Argentina | Probe·Trap·Nasty | −1.88 | 2.5/4.4 | **0%** |
| 11 | Netherlands | Tiki·Gegen·Firm | −2.00 | 1.6/3.6 | 0% |
| 12 | France | Swash·Trap·Firm | −2.25 | 3.9/6.1 | 13% |

**By style cluster** (merging identical identities — the statistically honest view):
Route One (+0.50) > Swash/Bal, Probe/Bus (−0.50) > Swash/Trap (−0.63, huge variance)
> Balanced/Gegen (−1.44) > Tiki/Gegen (−1.71) > Tiki/Trap, Probe/Trap (−1.88).

## The Three-Sided Tax (why the table looks "wrong")
Classical football wisdom inverts on the hex, for three measured reasons:
1. **The pincer tax on strength.** Take the lead against two opponents and both hunt
   you — with alliance passing, they *coordinate*. Styles that grind out narrow leads
   (possession, pressing) spend the rest of the match as the target. Styles that score
   in bursts (Route One, Swashbuckle) bank points faster than the coalition forms.
2. **Pressing pays double.** Gegenpress burns stamina and draws cards against ONE
   opponent's worth of reward — but there are two opponents. Every press-based nation
   (GER, USA, ESP, NED, JPN) sits mid-table or lower. The lab priced this deliberately
   (the stamina surcharge and foul factor); three-sided play doubles the bill.
3. **Volume beats patience under ±1 volatility.** Probe and low-risk Tiki generate too
   few shots to ride the swing; the long-strike era rewards teams that simply hit it.
**In one line: on the hex, verticality lives and possession dies. Jorn's game
rewards punks, not professors.**

## Derby results (8 matches each; pts/outright wins)
- **The Classic — ESP/ITA/BRA:** *Italy wins* (0.0 pts, 3W). The bus eats Tiki-Taka's
  patience and deflects Brazil's artillery. Catenaccio is real.
- **The Group of Death — GER/FRA/ENG:** *France 4W* edges England 3W; Germany starved
  last. The trap feasts on Route One second balls and pressing dead legs alike.
- **The Heavyweights — ARG/BRA/GER:** ***Argentina tops it*** (+0.3) — the same nation
  that went 0% vs a neutral field. Probe is the purest *matchup* style in the game:
  it devours pressers (Probe>Gegen 67% pairwise) and profits from Brazilian chaos.
- **The Press Derby — JPN/NED/USA:** Netherlands wins the triple-press fatigue war;
  Japan 0W. When everyone presses, someone's legs go first.
- **CONCACAF Clash — MEX/ARG/POR:** Mexico tops on points; Portugal takes most wins.
  The Azteca crowd would riot happily.
- **The Tacticians — ITA/FRA/NED:** *Italy again* (3W). Across two derbies the bus
  never finished bottom. Italy is the tournament team of this study.

## The Matchup Guide (from the validated pairwise matrix)
- **Lopsided:** Germany/USA vs Spain-style Tiki (Gegen beats Tiki ~63/37 — the press
  devours short passing early). England vs any presser (Route One goes over the top,
  ~60/40). Argentina vs Germany/USA/Netherlands (Probe outlasts dead legs, ~67/33).
- **The revenge chains:** Spain beats Italy (Tiki>Bus ~60/40) though Italy wins
  neutral derbies; Argentina beats the pressers who beat Spain. Full circle:
  **ITA > ESP > ITA's other prey, ARG > GER > ESP > ITA** — a working food web.
- **Coin flips:** Brazil vs Portugal/France (artillery mirror), England vs Brazil.

## Verdict
Yes, there are clear favorites — **Portugal and England travel best**, Italy is the
derby king, and **Argentina/France are the great volatile matchup teams** — and that's
football. The counter-cycle guarantees every nation has prey and predators: nobody in
the library lacks a winnable trio or a nightmare one. Picking your three IS the first
tactical decision of the match.

*Caveats: n=8 per cell; aggression newly ported to the lab; the live game adds human
coaching and scoreboard-priced alliances on top of everything measured here.*

---
# Addendum: The Rigorous Edition (seeded, rotated, n=20)

The follow-up study upgraded the method: **seeded RNG with paired streams** (every
nation faces the identical random universe per match index), **slot rotation**
(featured nation cycles all three positions), n=20. Proof the pairing works:
identical-identity nations now post IDENTICAL results (FRA=POR, GER=USA, ESP=JPN to
the decimal) — within-style variance eliminated; differences are signal. Bonus
evidence for the noise thesis: three independent n=8 replicates of the old method
crowned three different champions (England, then Argentina, then Germany).

## Power table v2 (by style, vs neutral field)
| Style | Nations | Pts | Win% |
|---|---|---|---|
| Swash·Balanced | BRA | **+0.65** | 45% |
| Swash·Trap | FRA, POR | +0.15 | 50% |
| Balanced·Gegen | GER, USA | −0.45 | 25% |
| Route1·Balanced | ENG | −0.75 | 25% |
| Tiki·Trap | MEX | −0.85 | 25% |
| Tiki·Gegen | ESP, JPN, NED | −0.95..−1.10 | 20% |
| Probe·Bus | ITA | −1.30 (0.9 GF!) | 15% |
| Probe·Trap | ARG | −1.40 | 20% |

Revisions to v1: **Swashbuckle, not Route One, rules the neutral field** (England's
crown was noise); Italy's bus barely scores against balanced opposition — its derby
dominance is pure matchup craft; the pressing tax is real but milder than v1 implied.

## Experiment: aggression, isolated (paired seeds, n=16)
Clean, Firm, and Nasty all score **exactly −0.75 pts** — the tackle bite pays the foul
bill to the decimal. **Filthy costs −0.56 pts**: a genuine self-tax. Verdict: the
aggression economy is fairly priced; Filthy remains the coach's dare, as designed.
No rebalance.

## Experiment: coalition pressing (SHIPPED)
*Mechanic:* when a team shares its hunt target with an ally, its pressing bill
(stamina surcharge + press-driven fouls) is scaled ×0.7 — allied presses share
coverage. *Paired deltas vs baseline:* ESP **+0.90**, JPN **+0.90** (both −1.10 →
−0.20, wins 20%→40%), GER +0.20, NED +0.25. The pressing cluster becomes competitive
without flattening the table (Brazil stays top; the matchup teams stay matchup teams).
Very Jorn: cooperation literally makes the press affordable. **Live in the game.**

## Signature nudges (SHIPPED)
Identity twins gained small dial accents, active only while playing their national
identity (coach overrides untouched): Japan tempo .95 (the fastest touches), the
Netherlands line .9 (the highest line), France line .28 (the deepest trap), Portugal
risk 1.0 (maximum artillery), USA direct .65 (the grit ball). Picker stat bars derive
from bundles, so the UI stays honest automatically.
