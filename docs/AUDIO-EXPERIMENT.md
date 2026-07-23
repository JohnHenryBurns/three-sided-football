# Chasing a GOOOOAAALLL

### Two days of formant synthesis in the browser, told through the animals it sounded like

*A ghost, a sasquatch, a cow, a Spanish-speaking man, and a sheep. In that order.*

---

## The brief

The game is a three-sided football simulator that narrates itself. It has a commentator, a
crowd, sixteen teams, and a play-by-play feed. What it did not have was the one sound that
actually matters — the long ragged **GOOOOAAALLL** that a human being produces when a ball
crosses a line.

Two obvious routes were rejected before starting.

A **recorded sample** would mean shipping a binary asset, and worse, the identical shout on
every goal forever. Kids notice that by the third match.

**Text-to-speech** had already failed us once. Feed a browser speech engine the string
"GOOOAL" and it says *gull* — it treats the stretched spelling as a word to be parsed rather
than a duration to be honored. We'd worked around that months' worth of commits ago by
normalizing the text and moving all the emphasis into `rate` and `pitch`.

So: synthesize it. Build a voice out of oscillators and filters, and get infinite variation
for free — every goal a slightly different shout, no assets, no network.

## Building a voice out of a sawtooth

The theory here is old and elegant. **Fant's source–filter model** (1960) says a voice is two
things multiplied together: a buzzy *source* at the vocal folds, and a *filter* — the throat,
mouth, and lips — that sculpts it. The source sets the pitch. The filter sets the vowel.

For anyone who patches modular, it's a completely familiar signal chain:

| Speech | Module |
|---|---|
| glottal source | VCO, sawtooth |
| vocal-fold irregularity | slow random CV → VCO FM |
| vocal effort | waveshaper |
| vocal tract resonances (formants) | three peaking EQs |
| jaw and tongue movement | envelopes on those EQ frequencies |
| loudness contour | VCA |

The interesting part is what a *word* becomes in this framing. Vowel identity lives almost
entirely in the first two formants — F1 tracks inversely with tongue height, so raising F1 is
essentially opening your jaw. Which means "GOAL" isn't a recording or a phoneme sequence.
It's a **path through formant space**, scheduled over time:

```
/g/      F1 260   F2 1950   F3 2250     the velar release
 "oh"    F1 520   F2  880   F3 2600
 "aah"   F1 790   F2 1240   F3 2700     the jaw opens
 /l/     F1 360   F2 1020   F3 3000     lateral: low F2, high F3
```

Pitch climbs from 208 to 254 Hz across the shout and falls away at the end. Jitter rides on
top. Nothing is sampled. **The word is a curve.**

## Working blind

One problem: the development environment had no speakers. I was building a sound I could not
hear.

The workaround turned out to be the most useful thing in the project. I wrote the whole synth
**twice** — once in Web Audio for the page, and once in Node with hand-rolled RBJ biquads and
phase-accumulator oscillators, rendering identical parameters to a `.wav` file. That twin
could be measured: autocorrelation for the pitch contour, band-energy DFT to confirm the
vowel was actually moving, envelope analysis for tremolo, sample-jump counts for clicks.

So the project ran on two instruments. **Numbers from the renderer, adjectives from John.**
The adjectives turned out to be better.

---

## A ghost in the machine

The first version was hollow and disembodied. Not a voice — a haunting.

The cause was architectural. I'd built the three formants as **parallel bandpass filters**
at Q 8–12, summed together. That leaves only three narrow slivers of spectrum in the output
and nothing in between: a vocoder, not a throat. Signal body was thin, RMS 0.233.

Rebuilding them as **peaking filters in series** — emphasize the formant regions but pass
everything else — roughly doubled the body to 0.535 and the hollowness vanished.

Klatt had this settled in 1980. His synthesizer offers *both* cascade and parallel branches,
and cascade is the standard choice for vowels precisely because the relative amplitudes of
the formants then fall out of the model rather than having to be dialed in by hand. Parallel
isn't wrong — it's the normal choice for fricatives and stops. I'd simply built a bad parallel
bank and blamed the topology.

Then I added pitch jitter, about 1%, because perfectly periodic vocal folds don't exist.

## "A staticy sasquatch"

Better. Recognizably a creature now, which is progress, but the wrong creature.

*Sasquatch* decoded cleanly into two numbers. The voice was sitting at **201 Hz** — low-male
territory — with a subharmonic square wave an octave below it that I'd added for "growl."
Excited sports commentators shout at 220–280 Hz. Raising the fundamental to 248 Hz and cutting
the subharmonic to a trace evicted Bigfoot immediately.

*Staticy* was harder, and it's where the story goes wrong.

## The static that wasn't there

I measured the spectral slope in the top octave and got **−3 dB/oct**. Real voices roll off
much faster than that. I had a tidy explanation ready: a sawtooth falls at −6 dB/octave while
real glottal flow falls at about −12, so my source was roughly twice as bright as a human
throat, and that surplus was the buzz.

So I darkened the source with a lowpass ahead of the formants — the classic source–filter
move, let the glottis be dull and the tract supply the brightness. Slope went to −10.9 dB/oct.
It sounded better. I wrote it up as a finding.

**It was wrong.**

The explanation ignores **lip radiation**. Sound escaping the mouth is high-pass filtered by
the geometry of the head, adding roughly **+6 dB/octave**. So the standard decomposition is
−12 at the glottis, +6 at the lips, netting about **−6 dB/oct at the listener** — which is
exactly what a sawtooth gives you. That's *why* sawtooths are the conventional source in
simple formant synths. My diagnosis was precisely backwards.

Worse, when I went back to find the real culprit, I couldn't. I tested a naive sawtooth, a
band-limited sawtooth, and a heavily soft-clipped sawtooth: **all three measured −6.0 dB/oct.**
Adding flat broadband breath noise at the levels the patch used moved it by 0.3 dB. Three
plausible causes, three disproven.

The most likely truth is that the original −3 dB/oct reading was **measurement error**. I was
probing single frequency bins on a signal whose harmonics were sliding around under jitter and
vibrato. That is not a reliable way to measure spectral tilt; the right tool is LPC or cepstral
envelope estimation, which is what Praat does and what I should have used.

The lowpass did audibly help. Something in that revision was contributing buzz — most plausibly
the square-wave component and the waveshaper drive, both of which I reduced in the same commit,
which is its own methodological sin. But the mechanism I published was not the mechanism.

Worth noting: Klatt's synthesizer does carry an explicit spectral-tilt parameter (`TL`), so
manipulating source tilt is entirely standard — for modeling voice quality along the
breathy-to-pressed axis. Though a full-throated shout is *pressed* voice, which implies **less**
tilt, not more. Another reason to distrust the fix.

## A cow, briefly

Overcorrection. Having darkened the source, the next report was **"more like a moo."**

Which was exactly right, and the inverse of the previous problem. F1 was sitting at 430 Hz —
that's an "oo," a closed vowel — and my source tilt at 1500 Hz was burying F2 and F3 before the
formant filters could restore them. Dark spectrum, closed vowel: cow.

The fix was to open the vowel toward "aw" (F1 climbing 520 → 790 across the shout), lift the
tilt to 2000 Hz, and push the F2/F3 boosts from +11/+7 dB to +15/+13. Measured brightness — the
ratio of energy above 1200 Hz to energy below 900 — went from 0.03 to 1.40. A 47× change, and
the largest single perceptual jump of the whole project.

## "Almost a Mexican accent"

This was the best bug report I have ever received.

It was correct, it was precise, and it identified an engineering defect that I had been
treating as two unrelated complaints.

Spanish *gol* is a pure open vowel that simply stops. English *goal* resolves onto a clear
**lateral** — the tongue rises to the alveolar ridge and you *land* on the L. If you drop that
L, the word doesn't become unintelligible. It becomes **Spanish**.

And my L was missing, because of an envelope bug. The amplitude release was beginning at 88%
of the duration while the formants were still traveling toward the /l/ target. The consonant
was being articulated *during a fade-out*. It was there in the automation and inaudible in the
output.

That single defect had been generating two separate complaints for several iterations —
*"not very enunciated"* and *"a noticeable clip at the end."* The word wasn't clipped; it was
being cut off mid-consonant. Giving /l/ its own sustained phase — reached by 84%, held at 0.80
through 97%, *then* released over 500 ms — fixed both at once.

An untrained ear had localized a bug that my instrumentation hadn't even flagged.

## The G that wasn't a G

Meanwhile the consonant at the front had its own problems, and they were instructive.

First, a plain engineering trap: I boosted the /g/ burst by 3× and **the measurement didn't
move at all**. The soft-limiter downstream was flattening exactly the fast transient that makes
a stop consonant audible. Any engineer who has over-compressed a snare drum knows this failure
in their hands. Routing the burst around the compressor fixed it instantly.

Second, and more interesting: **a burst alone is not a consonant.** It's a click. What the ear
actually uses to identify a velar stop is the **velar pinch** — F2 and F3 converging at the
moment of release, then springing apart into the following vowel. Encode that transition and
you get a "g." Omit it and no amount of burst energy will help.

This is locus theory (Delattre, Liberman & Cooper, 1955) in practice: **the transitions carry
the consonants, the steady states carry the vowels.** Which also explained a nagging quality
problem — continuously morphing between vowel targets across three seconds produces something
smeared and song-like. Real speech *holds* a configuration and then moves fast. Restructuring
the schedule into hold / snap / hold / snap / hold was a bigger perceptual win than any single
filter change.

*(One caveat for anyone building on this: the velar locus is context-dependent, running high —
2500–3000 Hz — before front vowels and considerably lower before back vowels. "Goal" has a back
vowel, so the 1950/2250 Hz pinch I used is probably too high for the phonetic context.)*

## The sheep

Nine versions in, one animal remained: **"the middle is still more sheep than human."**

Bleating, acoustically, is tremolo. And the patch had two sources of it: about 5 Hz of vibrato,
plus an amplitude envelope whose automation stepped every 91 ms — an **11 Hz wobble** sitting
right in the 4–9 Hz band where the ear hears "bleat." Both of which I had added deliberately,
in the name of realism.

The correction is counterintuitive but obvious in hindsight: **a person shouting at full effort
is remarkably steady.** Vibrato is for singing, not for yelling. Cutting total modulation depth
to about 1% removed the sheep completely.

Which is the whole project in miniature. Nearly every "realism" feature I added — vibrato,
shimmer, growl, breath noise — made it sound *less* human, because I was adding the wrong kinds
of irregularity in the wrong amounts.

---

## Where it stopped

The verdict on version nine: *"the best one yet — but still not production worthy."*

That's the correct call, and I don't think more tuning would have closed it. The remaining gap
isn't a parameter, it's the approach. A sawtooth through five filters can produce a convincing
*vowel*. What it can't produce is the fine structure that makes a sound register as a **person**
rather than an **instrument**: the actual shape of a single glottal pulse, nasal coupling, the
micro-timing of articulation, the way real vocal folds fail to repeat themselves.

For the game, the pragmatic answer turns out to be the one we dismissed at the start. The old
"gull" bug was a *spelling* artifact, not a *stretching* one — the engine was mis-parsing the
word, not refusing to hold it. Hand a browser speech engine the correctly spelled word "goal"
at a very low `rate`, and it will stretch it into a drawn-out shout using a **real trained voice
model**. Nine iterations of synthesis versus one line of configuration.

The experiment still earned its place. It produced a reusable measurement rig, a set of findings
about hearing, and a fairly bracing demonstration that confident technical diagnoses need to
survive a second look.

## What it actually taught

**On voices.** The formants tell you *which vowel*. The transitions tell you *which word*. The
irregularity tells you *whether it's a person*. This experiment got the first right, eventually
got the second right, and never really got the third.

**On measurement.** Every number in this document came from code I wrote to check code I wrote.
That's a closed loop, and it failed exactly where you'd expect: the spectral-slope measurement
that produced my most confident wrong conclusion was itself the least reliable measurement in
the project. Praat existed the entire time.

**On ears.** The perceptual reports — *ghost, sasquatch, moo, Mexican accent, sheep* — were
better diagnostics than my instruments, every single time. Each one localized a real defect,
and one of them found a bug my measurements had entirely missed. A listener with no DSP
vocabulary described the spectrum more accurately than a developer with a DFT.

---

## Where to go next

**Foundations.**
**Klatt (1980)**, *"Software for a cascade/parallel formant synthesizer,"* JASA — still the
reference implementation; Klatt & Klatt (1990) extends it to voice quality, and KLSYN88 adds a
proper glottis model with the `TL` tilt parameter. **Fant, Liljencrants & Lin (1985)** — the LF
model, a five-parameter description of the *derivative of glottal flow*, and the principled
replacement for a sawtooth. This is almost certainly the single biggest available upgrade to
everything described above. **Fant (1960)**, *Acoustic Theory of Speech Production* — the origin
of source–filter, and the place to check claims like the one I got wrong. **Delattre, Liberman &
Cooper (1955)** — locus theory. **Peterson & Barney (1952)** and **Hillenbrand et al. (1995)** —
the measured formant tables for English vowels, i.e. better numbers than the ones I guessed.

**Things you can actually play with.**
**Pink Trombone** (Neil Thapen, 2017) at `dood.al/pink-trombone` — a real-time *articulatory*
synthesizer in a browser tab: a Kelly–Lochbaum digital waveguide model of the vocal tract that
you manipulate directly with a cursor, moving the tongue and pinching constrictions. It models
the *tube* rather than its resonances, which is a full step beyond anything here, and it is
startling how fast it crosses into sounding human. Open source, Web Audio, with AudioWorklet
forks for programmatic control. **Praat** (Boersma & Weenink) — spectrograms, formant tracking,
pitch extraction, and a KlattGrid synthesizer; would have replaced every line of my measurement
code and caught the error in §"The static that wasn't there." **eSpeak NG** — open-source formant
synthesis, compact enough to actually read. **Csound** for **FOF synthesis** (Rodet, IRCAM; the
`fof`/`fof2` opcodes) — granular formant synthesis built for *singing* voice, and arguably a
better fit for a sustained shout than a filtered sawtooth. **Mutable Instruments source**
(Émilie Gillet) — *Plaits* and *Braids* contain speech and vowel models written for a
microcontroller, and are probably the most Eurorack-legible expression of these ideas in code.

---

*Nine versions, two days, one shelved feature, and a document that had to retract its own
headline finding. The branch is `audio-experiment` if you want to hear the sasquatch.*
