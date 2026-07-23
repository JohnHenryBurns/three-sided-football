# Synthesizing a "GOOOOAAALLL" Cry in the Browser

*An experiment in formant speech synthesis with the Web Audio API. Nine iterations over
two days, measured rather than heard, ultimately shelved. Notes for anyone who likes this
stuff — especially Greg.*

**Status:** abandoned for production. Preserved on branch `audio-experiment`.
**Goal:** a stadium goal-cry generated entirely in code — no samples, no network, infinite variation.

> **A note on reliability.** This write-up has been through a correction pass. Several
> conclusions reached during development turned out to be wrong on review, and where that
> happened I have said so rather than quietly deleting them — the wrong turns are the most
> useful part of the record. Section 4 retracts a headline finding outright.

---

## Why synthesize at all

Two alternatives were rejected up front:

- **A recorded sample** — a binary asset to ship, and the *same* shout every single goal.
- **Text-to-speech** — the browser's TTS reads stretched spellings like "GOOOAL" as
  "gull," a bug hit earlier in this project and worked around by normalizing the text and
  moving emphasis into `rate` and `pitch`.

Synthesis promised per-goal variation for free and zero assets. So: build a voice.

## The approach — source–filter, i.e. a Eurorack voice patch

The patch rests on **Fant's source–filter theory** (Fant 1960): a voice is a buzzy *source*
(vocal folds) shaped by a *filter* (the vocal tract). It maps cleanly onto modular signal flow:

| Speech term | Module |
|---|---|
| glottal source | VCO (sawtooth) |
| vocal-fold irregularity | slow random CV → VCO FM |
| vocal effort / strain | waveshaper |
| vocal tract resonances (formants) | three peaking EQs |
| jaw and tongue movement | envelope-controlled filter frequency |
| loudness contour | VCA + envelope |

The word itself is **automation**. Vowel identity is largely the position of the first two
formants — F1 correlates inversely with tongue height, so raising F1 is roughly opening the
jaw — which makes "GOAL" a scheduled path through formant space:

```
/g/      F1 260   F2 1950   F3 2250     (velar pinch — see §5 for a caveat on these values)
 "oh"    F1 520   F2  880   F3 2600
 "aah"   F1 790   F2 1240   F3 2700
 /l/     F1 360   F2 1020   F3 3000     (lateral — low F2, high F3)
```

Pitch climbs 208 → 254 Hz and falls at the end, with random jitter on top. Nothing is
sampled. The word is a curve.

## The method: measuring a sound you cannot hear

The development environment had no audio output. So the in-page Web Audio version was
mirrored by a **second implementation in Node** — hand-rolled RBJ biquads, phase-accumulator
oscillators — rendering the same parameters to a `.wav` that could be analyzed numerically:
autocorrelation for pitch, band-energy DFT for formant movement, envelope analysis for
tremolo, sample-jump and full-scale counts for clicks and clipping.

**Two caveats on that method, both discovered late:**

1. **The twin was not exact.** The Node renderer used a naive `2*phase-1` sawtooth; Web
   Audio's `OscillatorNode` is band-limited. The listener was judging rendered WAVs, not the
   in-page synth. (Tested afterwards, this made no measurable difference to spectral slope —
   but it was an unverified assumption for most of the project.)
2. **Single-bin DFT probes on time-varying speech are unreliable.** Several measurements
   sampled energy at fixed frequencies such as 2000 and 4000 Hz, on a signal whose harmonics
   were moving under jitter and vibrato. Where a conclusion rested on that alone, it did not
   survive review. Proper spectral-envelope estimation — LPC or cepstral smoothing, i.e. what
   Praat does — was the right tool and wasn't used.

Human feedback arrived as similes — *ghost, sasquatch, sheep, moo, Mexican accent* — and
most mapped onto a specific, findable defect.

---

## Findings

### 1. Cascade beats parallel for vowels — and the literature already said so

The first version ran the source through three **parallel bandpass** filters at Q 8–12 and
summed them. Result: hollow, disembodied, "ghost." Replacing them with **peaking filters in
series** roughly doubled the signal body (an ad hoc RMS measure went 0.233 → 0.535) and
removed the hollowness.

The correct framing is Klatt's, not mine: his synthesizer offers **both cascade and parallel
branches**, and the cascade configuration is the standard choice for vowels precisely because
the relative amplitudes of the formants then fall out of the model automatically, rather than
having to be set by hand. Parallel formant synthesis is not wrong — it is the normal choice
for fricatives and stops. The actual defect here was narrow Q with no broadband path, so only
three slivers of spectrum survived. "Parallel is bad" would be an overstatement; "I built a
bad parallel bank" is accurate.

### 2. Amplitude modulation in the 4–9 Hz band is a sheep

Bleating is, acoustically, tremolo. The patch had roughly 5 Hz vibrato *plus* an amplitude
wobble stepping every ~91 ms — about 11 Hz — added, ironically, in the name of realism. A
shouted vowel at full effort is remarkably **steady**. Cutting modulation depth to ~1%
removed the bleat entirely. This one was unambiguous and reproducible.

### 3. A plosive is a transient, and compressors eat transients

The /g/ burst was boosted 3× with *no measurable change*: the soft-limiter downstream was
flattening exactly the fast attack that makes a consonant audible. Routing the burst around
the compressor fixed it immediately. Any engineer who has over-compressed a snare knows this
one.

### 4. ⚠️ RETRACTED: "a sawtooth is too bright for a glottal source"

**What was claimed during development:** that a sawtooth rolls off at −6 dB/octave while real
glottal flow is nearer −12, so the source was about 10 dB too bright, and that this excess
was the "static."

**Why that is wrong:** it ignores lip radiation. The standard decomposition is glottal flow
at about −12 dB/oct, **lip radiation at +6 dB/oct**, giving a net effective source slope at
the listener of about **−6 dB/oct** — exactly what a sawtooth provides. This is precisely why
sawtooth sources are conventional in simple formant synths. The claim was backwards.

**What follow-up testing showed:** the measured defect could not be reproduced from any
candidate cause. A naive sawtooth, a band-limited sawtooth, and a soft-clipped sawtooth all
measured −6.0 dB/oct; adding flat broadband noise at the amplitudes the patch used moved that
by at most 0.3 dB. The most likely explanation is that the original −3.0 dB/oct reading was an
artifact of single-bin measurement on a jittering signal (method caveat 2 above).

**What remains true:** adding a lowpass ahead of the formants *did* audibly improve things.
Something in that stage — most plausibly the square-wave component and the waveshaper drive,
both reduced in the same revision — was contributing buzz. But the mechanism was not the one
stated, and the revision changed several variables at once, so it isn't cleanly attributable.
Worth noting that Klatt's synthesizer carries an explicit spectral-tilt parameter (TL), so
*manipulating* source tilt is entirely standard practice — for modeling voice quality along
the breathy/pressed axis. If anything, a loud shout is pressed voice, which implies *less*
tilt, not more.

### 5. What identifies a /g/ is the formant transition, not the burst

A noise burst alone is a click. Velar stops are cued by the **velar pinch** — F2 and F3
converging at release, then separating into the following vowel. Encoding that transition is
what finally produced a recognizable "g."

**Caveat on the numbers above:** the velar locus is context-dependent, sitting high (roughly
2500–3000 Hz) before front vowels and considerably lower before back vowels. "GOAL" has a back
vowel, so the 1950/2250 Hz pinch used here is likely too high for the phonetic context — a
legitimate target for correction if anyone picks this up.

### 6. Enunciation is steady states plus fast transitions

Continuously morphing between vowels for three seconds produces something smeared and
song-like. Real speech *holds* a configuration and then moves quickly. Restructuring into
hold / snap / hold / snap / hold was a larger perceptual win than any single filter change.
This is the practical face of **locus theory** (Delattre, Liberman & Cooper, 1955): the
transitions carry the consonant information, the steady states carry the vowel.

### 7. The final consonant carried two bugs at once

The amplitude envelope began its release *while* the formants were still traveling toward
/l/ — so the L was articulated during a fade and never sounded. That produced two apparently
separate complaints, "not enunciated" and "clipped at the end," from a single cause. Giving
/l/ its own sustained phase before the release fixed both.

### 8. The most useful bug report was a perceptual one

*"Almost has a Mexican accent"* was both correct and diagnostic. Spanish *gol* is a pure open
vowel with no final resolution; English *goal* lands on a clear lateral. The missing L **was**
the accent. Across the project, perceptual descriptions from a listener with no DSP
vocabulary consistently outperformed the developer's own instrumented hypotheses.

### Hypotheses that testing disproved

Recorded because the wrong theories were consistently the more intuitive ones:

- *"The bandpass filters are removing the fundamental."* Wrong — an ad hoc
  fundamental-to-formant energy ratio was 1.19 in the "ghost" version versus 0.96 in its
  replacement. The problem was spectral sparsity, not a missing fundamental.
- *"The static is crowd noise, or breath noise."* Wrong both times. The signal was strongly
  periodic — a harmonic-to-noise energy ratio of about 74, i.e. roughly 19 dB, comfortably in
  the normal range for modal voice.
- *"The amplitude shimmer is the sheep."* Partly wrong. Removing it barely moved the measured
  wobble; vibrato rate and coarse envelope stepping were the real contributors.
- *"The sawtooth is too bright."* Wrong, and it stood as a headline finding for several
  iterations. See §4.

---

## Why it was shelved

After nine iterations the verdict was *the best one yet — but still not production worthy.*
The honest read is that this is a limit of the approach as implemented, not of the tuning. A
sawtooth through a handful of filters can approximate a vowel, but it lacks the fine
structure — real glottal pulse shape, nasal coupling, the micro-timing of articulation — that
makes a voice read as a *person* rather than an *instrument*.

For the game, the browser's built-in text-to-speech is the pragmatic answer: it ships a real
trained voice model, and the earlier "gull" problem was a *spelling* artifact, not a stretching
one. Handing it the correctly spelled word at a low `rate` should yield a genuine drawn-out
human "goal."

The experiment still earned its keep. It produced a reusable measurement rig, a set of findings
about hearing, and a clear demonstration that confident diagnoses need to survive a second look.

---

## Where to go next — libraries and reference material

### Foundations

- **Klatt (1980), "Software for a cascade/parallel formant synthesizer," JASA** — the canonical
  formant synthesizer, still the reference implementation. Klatt & Klatt (1990) extends it to
  voice-quality variation; **KLSYN88** adds a proper glottis model including the spectral-tilt
  parameter mentioned in §4.
- **Fant, Liljencrants & Lin (1985) — the LF model** (STL-QPSR). A five-parameter model of the
  *derivative of glottal flow*. This is the principled replacement for a sawtooth and almost
  certainly the single largest available upgrade to the patch described here.
- **Fant (1960), _Acoustic Theory of Speech Production_** — the origin of source–filter, and
  the place to check claims like the one retracted in §4.
- **Delattre, Liberman & Cooper (1955)** — locus theory; the acoustic cues that identify stop
  consonants.
- **Peterson & Barney (1952)** and **Hillenbrand et al. (1995)** — the standard measured formant
  tables for English vowels. Better numbers than the ones guessed at here.

### Things you can actually play with

- **Pink Trombone** (Neil Thapen, 2017) — `dood.al/pink-trombone`. A real-time **articulatory**
  synthesizer in the browser: a Kelly–Lochbaum digital waveguide model of the vocal tract you
  manipulate directly — tongue position, constrictions, tenseness. A full step beyond formant
  synthesis (modeling the *tube* rather than its resonances), and startling how quickly it
  crosses into sounding human. Open source, Web Audio; component and AudioWorklet forks exist
  for programmatic control.
- **Praat** (Boersma & Weenink) — the standard free phonetics tool: spectrograms, formant
  tracking, pitch extraction, and a **KlattGrid** synthesizer. It would have replaced every line
  of the hand-rolled measurement code above, and would not have produced the unreliable slope
  measurement that led to §4.
- **eSpeak NG** — open-source formant synthesizer, compact enough to read.
- **Csound / SuperCollider / Faust** — for **FOF synthesis** (Rodet, IRCAM; the `fof` and `fof2`
  opcodes in Csound), a granular formant technique developed for *singing* voice and arguably a
  better fit for a sustained shouted vowel than a filtered sawtooth.
- **Mutable Instruments source** (Émilie Gillet, open source) — *Plaits* and the earlier *Braids*
  include speech and vowel models written for a microcontroller. Probably the most
  Eurorack-legible version of these ideas in code.

### The one-line summary

The formants tell you *which vowel*. The **transitions** tell you *which word*. And the
irregularity — jitter, shimmer, the shape of a single glottal pulse — tells you *whether it's a
person*. This experiment got the first right, eventually got the second right, and never really
got the third.
