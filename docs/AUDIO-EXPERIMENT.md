# Synthesizing a "GOOOOAAALLL" Cry in the Browser

*An experiment in formant speech synthesis with the Web Audio API. Nine iterations,
measured rather than heard, ultimately shelved. Notes for anyone who likes this stuff —
especially Greg.*

**Status:** abandoned for production. Preserved on branch `audio-experiment`.
**Goal:** a stadium goal-cry generated entirely in code — no samples, no network, infinite variation.

---

## Why synthesize at all

Two alternatives were rejected up front:

- **A recorded sample** — a binary asset to ship, and the *same* shout every single goal.
- **Text-to-speech** — the browser's TTS reads stretched spellings like "GOOOAL" as
  "gull," a bug we'd hit months earlier and worked around by normalizing the text and
  moving emphasis into `rate` and `pitch`.

Synthesis promised per-goal variation for free (duration, pitch, and grit all randomize)
and zero assets. So: build a voice.

## The approach — source–filter, i.e. a Eurorack voice patch

Speech synthesis of this kind rests on **Fant's source–filter theory**: a voice is a
buzzy *source* (vocal folds) shaped by a *filter* (the vocal tract). The patch maps
one-to-one onto modular signal flow:

| Speech term | Module |
|---|---|
| glottal source | VCO (sawtooth) |
| vocal folds' irregularity | slow random CV → VCO FM |
| vocal strain | waveshaper / soft-clip |
| vocal tract resonances (formants) | three peaking EQs in series |
| jaw/tongue movement | envelope-controlled filter frequency |
| loudness contour | VCA + envelope |

The word itself is **automation**. Vowel identity is essentially the position of the
first two formants — raising F1 *is* opening the jaw — so "GOAL" is nothing more than
a scheduled path through formant space:

```
/g/      F1 260   F2 1950   F3 2250     (velar pinch — F2 and F3 converged)
 "oh"    F1 520   F2  880   F3 2600
 "aah"   F1 790   F2 1240   F3 2700
 /l/     F1 360   F2 1020   F3 3000     (lateral — low F2, high F3)
```

Pitch climbs 208 → 254 Hz and falls away at the end; a small amount of random jitter
rides on top. Nothing is sampled. The word is a curve.

## The method: measuring a sound you cannot hear

The development environment had no audio output. So rather than guess, the in-page
Web Audio version was mirrored by a **second implementation in Node** — hand-rolled RBJ
biquads, a phase-accumulator sawtooth — rendering identical parameters to a `.wav`.
That twin could then be *analyzed*:

- **Autocorrelation** → pitch contour verification
- **Band-energy DFT at moving formant targets** → is the vowel actually changing?
- **Octave-band slope** → spectral tilt, the "brightness" that reads as buzz
- **Envelope modulation spectrum** → tremolo depth and rate
- **Sample-jump and full-scale-sample counts** → clicks and clipping

Every claimed fix was confirmed numerically before shipping. Human feedback arrived as
similes — *ghost, sasquatch, sheep, moo, Mexican accent* — and each one turned out to
map onto a specific measurable defect.

---

## Key findings

**1. Parallel bandpass filters make a ghost; series peaking filters make a voice.**
The first version put the source through three narrow parallel bandpass filters (Q 8–12).
That leaves only three narrow bands of energy in the output — a vocoder spectrum — which
is hollow and disembodied. Replacing them with **peaking EQs in series** preserves the
whole harmonic spectrum and merely emphasizes the formant regions, which is what a
resonator physically does. Signal body (RMS) more than doubled: 0.233 → 0.535.

**2. A sawtooth is twice as bright as a glottal pulse, and the excess reads as static.**
A sawtooth rolls off at −6 dB/octave; real glottal flow is nearer −12. Measured tilt in
the top octave was **−3.0 dB/oct** — roughly 10 dB of surplus high-frequency energy sitting
there as a buzzy shelf. The fix is textbook source–filter: **darken the source** (a lowpass
ahead of the formants) and let the formants supply all the brightness. Tilt went to
−10.9 dB/oct and the "static" largely vanished.

**3. Vibrato is what makes a sheep.** Bleating is, acoustically, vibrato — and the patch
had 5.2 Hz FM plus ~11 Hz amplitude wobble (added, ironically, *for realism*). A shouted
vowel at full volume is remarkably **steady**. Cutting modulation depth to ~1% removed
the bleat entirely. Amplitude modulation in the 4–9 Hz band is the danger zone.

**4. A plosive is a transient, and compressors eat transients.** The /g/ burst was boosted
3× with *no measurable change* — the soft-limiter downstream was flattening exactly the
fast attack that makes a consonant audible. Routing the burst **around** the compressor
fixed it instantly. (Any drummer who has over-compressed a snare knows this one.)

**5. What identifies a /g/ is the formant transition, not the burst.** A noise burst alone
is just a click. Velar stops are recognized by the **"velar pinch"** — F2 and F3 converged
near 2000–2300 Hz at the moment of release, then separating rapidly into the following
vowel. Encoding that transition is what finally produced a recognizable "g."

**6. Enunciation is steady states plus fast transitions.** Continuously morphing from one
vowel to the next for three seconds produces something smeared and songlike. Real speech
*holds* a configuration, then moves quickly. Restructuring the schedule into hold / snap /
hold / snap / hold was a bigger perceptual win than any single filter change.

**7. The final consonant carried two bugs at once.** The amplitude envelope began its
release *while* the formants were still traveling toward /l/ — so the L was articulated
during a fade and never sounded. That produced two apparently separate complaints —
"not enunciated" and "clipped at the end" — from one cause. Giving /l/ its own sustained
phase before the release fixed both.

**8. An accent complaint was the most useful bug report of the project.** The note
*"almost has a Mexican accent"* was precisely correct and precisely diagnostic: Spanish
*gol* is a pure open vowel with no final resolution, while English *goal* lands on a clear
lateral. The missing L **was** the accent. Perceptual descriptions from a listener with no
DSP vocabulary consistently out-performed the developer's own hypotheses.

### Hypotheses that measurement disproved

Worth recording, since the wrong theories were the more intuitive ones:

- **"The bandpass filters are removing the fundamental."** Plausible, and wrong —
  fundamental-to-formant energy was 1.19 in the "ghost" version versus 0.96 in its
  replacement. The problem was spectral *sparsity*, not a missing fundamental.
- **"The static is the crowd noise / the breath noise."** Wrong twice. Harmonic-to-noise
  ratio measured 73.9 — the signal was highly tonal. The "static" was *rasp* from a square
  wave and heavy soft-clip drive, plus the spectral tilt in finding #2.
- **"The amplitude shimmer is the sheep."** Partly wrong. Removing it barely moved the
  measured wobble; the real culprits were the vibrato rate and the coarse steps of the
  amplitude automation itself.

---

## Why it was shelved

After nine iterations it was, in the final assessment, *the best one yet — but still not
production worthy.* The honest read is that this is a limitation of the **approach**, not
the tuning. A sawtooth through five filters can approximate a vowel, but it lacks the fine
structure — real glottal pulse shape, nasal coupling, the interaction of tract resonances,
the micro-timing of articulation — that makes a voice read as a *person* rather than an
*instrument*.

For the game, the browser's built-in text-to-speech is the pragmatic answer: it ships a
real trained voice model, and the earlier "gull" problem was a *spelling* artifact, not a
stretching one. Handing it the correctly spelled word at a low `rate` yields a genuine
drawn-out human "goal."

The experiment was still worth it. It produced a reusable measurement rig, and a set of
findings that are really findings about *hearing*.

---

## Where to go next — libraries and reference material

### If you want to go deeper on synthesis

- **Klatt (1980), "Software for a cascade/parallel formant synthesizer," JASA** — the
  canonical formant synthesizer, and still the reference implementation. Klatt & Klatt
  (1990) extends it to voice-quality variation. The later **KLSYN88** adds a proper
  glottis model.
- **Fant, Liljencrants & Lin (1985) — the LF model.** A five-parameter model of the
  *derivative of glottal flow*. This is the principled replacement for a sawtooth, and
  almost certainly the single biggest available upgrade to what's described above.
- **Fant (1960), *Acoustic Theory of Speech Production*** — the source of source–filter.
- **FOF synthesis / CHANT (Rodet, IRCAM)** — "Fonctions d'Onde Formantique," granular
  formant synthesis developed for *singing* voice. Available as opcodes in **Csound**
  (`fof`, `fof2`). For a sustained shouted vowel this is arguably a better fit than
  filtered sawtooth, and it's the classic route for choir/voice patches.
- **Peterson & Barney (1952)** and **Hillenbrand et al. (1995)** — the standard measured
  formant tables for English vowels. Better numbers than the ones guessed at here.

### Things you can actually play with

- **Pink Trombone** (Neil Thapen, 2017) — `dood.al/pink-trombone`. A real-time
  **articulatory** synthesizer in the browser: a Kelly–Lochbaum digital waveguide model of
  the vocal tract you manipulate directly with a cursor — tongue position, constrictions,
  tenseness. It is a full step beyond formant synthesis (modeling the *tube*, not its
  resonances) and it is remarkable how quickly it crosses into sounding human. Open source,
  Web Audio, and there are component/AudioWorklet forks for programmatic control.
- **Praat** (Boersma & Weenink) — the standard free phonetics tool. Spectrograms, formant
  tracking, pitch extraction, and a **KlattGrid** synthesizer. This is the right instrument
  for *analyzing* any of this properly, and would have replaced most of the hand-rolled
  measurement code above.
- **eSpeak NG** — open-source formant synthesizer, Klatt-lineage, source available and
  compact enough to read.
- **Csound / SuperCollider / Faust** — for FOF, and for treating any of this as a patch
  rather than a program.
- **Mutable Instruments source code** (Émilie Gillet, open source) — *Plaits* and the
  earlier *Braids* include speech/vowel models, LPC-flavored and formant-based, written for
  a microcontroller. Probably the most Eurorack-legible version of these ideas in code.

### The one-line summary

The formants tell you *which vowel*. The **transitions** tell you *which word*. And the
irregularity — jitter, shimmer, the shape of a single glottal pulse — tells you *whether
it's a person*. This experiment got the first right, eventually got the second right, and
never really got the third.
