# LectureLens — one lecture in, four study tools out

Upload a lecture video or audio file and get structured notes, flashcards, a
quiz, and a clickable mind map — all from that one recording, all traceable
to a timestamp in the lecture.

## Try it with no key

Open `index.html` in a browser (or serve the folder with any static host).
The bundled sample lecture — **"Gradient Descent, Explained"**, a 12-minute
lecture written for this demo — is already there. No API key, no upload, no
waiting. Open it and use all four tabs: Notes, Flashcards, Quiz, Mind map,
plus searchable Transcript.

Deep links: `index.html#sample`, `#sample/cards`, `#sample/quiz`,
`#sample/map`, `#sample/transcript`.

## Use your own lecture (needs a free Gemini key)

1. Get a free key at [Google AI Studio](https://aistudio.google.com/apikey).
2. Paste it in Settings on the home screen and press **Test key**.
3. Upload a video/audio file (mp4, webm, mp3, wav, m4a — up to 200 MB,
   about 15 minutes for a live run) or paste a transcript (plain text, SRT,
   or VTT).

The app uploads the file to the Gemini Files API, transcribes it, then makes
one structured call per artefact (notes, flashcards, quiz, mind map). Each
artefact is validated before it is saved: 20 flashcards, 10 quiz questions
with exactly one correct answer, a mind map of at most 25 nodes and 3 levels,
and every timestamp inside the lecture. If a stage fails, the error is shown
in plain words and nothing is faked.

Your key is stored only in your browser's `localStorage` and sent only to
`generativelanguage.googleapis.com`. There is no server and no key bundled
in this repo.

**Model:** default `gemini-2.5-flash` (verified 23 Nov 2026 on
ai.google.dev — GA stable Flash). Google's 2 Nov 2026 deprecation note says
requests to `gemini-2.5-flash` route to `gemini-3.5-flash-lite` from
1 Dec 2026; Settings also offers `gemini-3.5-flash-lite` and
`gemini-3.8-flash` (both listed stable) so you can switch without a code
change.

## Features

- **Notes** — summary, sections with key points and a definitions table,
  each section carrying its source timestamp range in a margin column.
  Export as Markdown.
- **Flashcards** — 20 cards, click/Space to flip, shuffle, "known / still
  learning" marking with progress. Export as CSV.
- **Quiz** — 10 multiple-choice questions, instant feedback with a
  one-sentence explanation and the source timestamp, final score with
  per-question review, best score saved per lecture.
- **Mind map** — collapsible SVG tree (max 25 nodes, depth 3). Click a node
  to jump to that section of the notes.
- **Transcript** — full text with timestamps, search with highlighted
  matches.
- **Lecture library** — lectures persist in `localStorage`; open, rename
  (via title), delete.

## Honest limits

- Transcription and generation run on Google's servers, not on your device.
  They need a key and internet. Without a key, only the sample lecture works.
- A 45-minute lecture will not finish in demo time. Live uploads are capped
  at ~15 minutes / 200 MB.
- Pasted transcripts without timestamps get estimated times (150 words per
  minute) — the app says so on the lecture.
- Quiz and flashcard answers can be wrong. Every artefact tab carries the
  line "Generated from the lecture — check against the transcript before you
  trust it." The mind map is an outline generated from the lecture, not a
  verified knowledge graph.
- There is no backend in v1 (the original plan called for Next.js + FastAPI
  + ffmpeg). The pipeline stages are the same; the calls run from the
  browser against Google's API instead of through a server, and the Files
  API replaces ffmpeg chunking. A server backend (shared keys, rate
  limiting, long-lecture chunking) is a v2 item. See `PLAN.md`.

## Stack

Zero-build static app — plain HTML/CSS/JS, no bundler, no dependencies to
install. Fonts: Newsreader (display), Inter (UI), JetBrains Mono
(timestamps) via Google Fonts with system fallbacks. Design: ink navy
`#1E2A4A` on paper `#F7F5F0`, references Notion (document layout), Linear
(restrained chrome), Quizlet (plain flashcard/quiz flow).

## Tests

```bash
node tests/test.js     # 18 tests, 0 failures (zero dependencies)
node tests/domtest.js  # end-to-end DOM flows in jsdom: quiz, flashcards,
                       # mind-map navigation, transcript search (needs jsdom,
                       # present in silent-speech-notes/node_modules)
```

Tests cover sample-data integrity (20 cards, 10 questions, 21 mind-map
nodes, timestamps in range), quiz scoring, transcript search/highlighting,
Markdown/CSV export, mind-map layout bounds, and artefact normalisation
(timestamp clamping, count caps).

## Demo script (2 minutes)

- **0:00–0:15** — "One lecture in, four study tools out." Show the upload
  screen; point at the sample lecture.
- **0:15–0:45** — Open the sample: Notes tab, scroll two sections, point at
  the timestamp margin. Flip two flashcards.
- **0:45–1:15** — Take the quiz live: answer two questions, show instant
  scoring and the explanation line.
- **1:15–1:45** — Open the mind map, click a node, land on that notes
  section. Search the transcript for one term.
- **1:45–2:00** — Upload a 2-minute clip live (key already in Settings) to
  prove the pipeline is real; close on the Markdown export.

## Project layout

```
index.html            app shell
css/style.css         design system
js/app.js             state, tabs, flashcards, quiz, mind map, upload flow
js/logic.js           pure logic (also used by the tests)
js/gemini.js          live Gemini API path (Files API + generateContent)
js/sample.js          bundled sample lecture (original content)
data/sample-lecture.json   same sample data as JSON, for inspection
tests/test.js         17 tests, zero dependencies
PLAN.md               deepened SaaS-level plan
```

## License

MIT — Sivasai Boggu, 2026.
