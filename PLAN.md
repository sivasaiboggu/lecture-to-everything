# Lecture-to-everything — Deepened Plan (SaaS level, demoable in 24–48h)

## 1. Project brief

- **Name:** LectureLens
- **Type:** Study SaaS / AI tool (web app)
- **What it does (1 sentence):** Upload one lecture video or audio file and get structured notes, flashcards, a quiz, and a clickable mind map from that one lecture.
- **Target user and biggest pain:** Students and self-learners who sit through long lectures and then re-watch them to revise. Re-watching a 45-minute lecture to find one idea wastes the evening; notes taken live are incomplete and never become flashcards or a quiz.
- **Core promise:** One lecture in, four study tools out — and every answer can be traced back to a timestamp in the lecture.
- **Tone:** Calm, studious, plain. A good set of lecture notes, not a sales page.
- **Design identity:** Ink navy `#1E2A4A` + Newsreader (serif display) + Inter (UI text) + JetBrains Mono (timestamps/labels). Paper-white background `#F7F5F0`, hairline rules, one accent (ink navy) used sparingly. Signature idea: the lecture as a printed document — a ruled "margin" column carrying timestamps, like margin notes in a textbook.
- **Reference sites (from the playbook):** Notion (document-first notes layout, quiet sidebar, real hierarchy), Linear (restrained app chrome, honest loading states, keyboard-first), Quizlet (flashcard flip and quiz flow done plainly). Borrowed: Notion's doc typography and sidebar, Linear's tab bar and status labels, Quizlet's card flip and instant quiz feedback — nothing else.
- **Platforms:** Web only for v1 (desktop + mobile browser). No install.
- **Budget/timeline/team:** Hackathon build, 24–48h, one builder, free tier only (Gemini free tier, static hosting).

## 2. Feature set (v1, all working)

### Core pipeline
1. **Ingest — three honest routes:**
   - Load the bundled sample lecture (pre-processed, works with no key, no internet beyond the page).
   - Upload a video/audio file (mp4, webm, mp3, wav, m4a; cap 200 MB / ~15 min for live processing) — sent to the Gemini Files API, transcribed by Gemini, then artefacts generated. Requires a free Gemini API key pasted in Settings.
   - Paste a transcript (plain text, `.txt` / `.md` / `.srt` / `.vtt` file, or pasted text) — artefacts generated from it with a key; without a key the app says plainly that a key is needed and offers the sample instead.
2. **Transcript:** merged transcript with `[mm:ss]` markers, full-text search with highlighted matches, click a line to see which notes section it feeds.
3. **Notes:** structured notes — title, one-line summary, 4–6 sections with headings, key points, and a definitions table. Every section carries its source timestamp range. Export as Markdown (`.md` download).
4. **Flashcards:** 20 cards (front = question, back = answer), flip on click/space, prev/next, shuffle, "Know / Still learning" marking with a per-deck progress count. Export as CSV.
5. **Quiz:** 10 multiple-choice questions, 4 options each, exactly one correct answer, one-line explanation per question. Instant feedback on select, running score, final summary with per-question review, retry button. Results saved per lecture.
6. **Mind map:** LLM-generated tree (max 25 nodes, max depth 3), rendered as a collapsible SVG tree in the browser. Click a node → jumps to the matching notes section. Nodes show their source timestamp.
7. **Lecture library:** lectures saved in `localStorage` (sample + user-processed). List, open, rename, delete. Quiz best score and flashcard progress persist per lecture.
8. **Settings:** Gemini API key field (stored in `localStorage` only, never sent anywhere except Google's API), model picker (default `gemini-2.5-flash`; alternatives `gemini-3.5-flash-lite`, `gemini-3.8-flash`), "Test key" button that makes one tiny real call and reports success/failure honestly, clear-key button, link to Google AI Studio.
9. **Processing UI:** honest stage labels — "Uploading…", "Transcribing…", "Writing notes…", "Making flashcards…", "Building quiz…", "Drawing mind map…" — with a progress bar. If a stage fails, the error is shown in plain words (e.g. "Gemini returned 429 — free-tier quota. Wait a minute and try again.") and already-finished artefacts stay visible. One retry per failed stage.

### Deliberately NOT in v1 (v2 list)
Accounts / sync, teams / shared decks, spaced-repetition scheduling, PDF upload, YouTube-URL import (needs a downloader and raises copyright questions), speaker diarisation, exact word-level timestamps, multi-language transcription, mobile app, payments.

## 3. Data model

```json
Lecture {
  "id": "string (lecture-<timestamp>)",
  "title": "string",
  "source": "sample | upload | paste",
  "durationSec": 720,
  "createdAt": "ISO date",
  "transcript": [{ "startSec": 0, "text": "..." }],
  "notes": {
    "summary": "string",
    "sections": [{ "id": "s1", "heading": "...", "startSec": 0, "endSec": 120,
                    "points": ["..."], "definitions": [{ "term": "...", "meaning": "..." }] }]
  },
  "flashcards": [{ "id": "f1", "front": "...", "back": "...", "known": false }],
  "quiz": [{ "id": "q1", "question": "...", "options": ["...","...","...","..."],
             "correctIndex": 0, "explanation": "...", "sourceSec": 120 }],
  "mindmap": { "id": "root", "label": "...", "startSec": 0, "children": [ ... ] },
  "quizBest": 0
}
```

Validation rules enforced in code and tests: quiz has exactly 10 questions, 4 options each, exactly one correct index in range; flashcards exactly 20; mind-map tree ≤ 25 nodes, depth ≤ 3, no cycles; every notes section and mind-map node carries a `startSec` inside the transcript range; no artefact may invent a timestamp outside the transcript.

## 4. Architecture (what actually ships in this repo)

The original plan called for Next.js + FastAPI + ffmpeg on Render. That stack needs a server, a deploy, and a key to demo at all. For a hackathon build that must demo with no key and no backend, the shipped v1 is a **zero-build static app** (plain HTML/CSS/JS, no bundler, no dependencies to install):

- `index.html` — app shell (sidebar, tabs, upload, settings).
- `css/style.css` — the design system (OKLCH-tinted neutrals, ink navy, Newsreader/Inter/JetBrains Mono via Google Fonts with system fallbacks).
- `js/app.js` — state, tabs, flashcards, quiz, mind map (hand-rolled SVG tree — no `@xyflow/react`, which needs a build step), search, export, library persistence.
- `js/gemini.js` — live AI path: Gemini Files API upload for audio/video, `generateContent` with `responseMimeType: application/json` + `responseSchema` for each artefact, one retry on bad JSON, honest error surfacing. Key sent only to `generativelanguage.googleapis.com`.
- `js/sample.js` — the bundled sample lecture (original 12-minute lecture, written for this project, not a recording of anyone else's lecture): full transcript + all four artefacts, hand-written to be mutually consistent.
- `data/` — the sample lecture as JSON (same data, for inspection/export).
- `tests/test.js` — Node, zero dependencies, `node --test` style assertions run with plain `node`.

**Why this is the honest version of the plan:** the pipeline stages are the same (ingest → transcribe → one structured call per artefact → validate → render); the difference is the calls run from the browser against Google's API instead of through a FastAPI server, and `ffmpeg` chunking is replaced by the Files API (Gemini accepts long audio/video directly). A server backend is a v2 item (needed for shared keys, rate limiting, and long-lecture chunking), and the README says so.

**Live model (verified 23 Nov 2026 via ai.google.dev models page and Google's release notes):** default `gemini-2.5-flash` (GA). Google's 2 Nov 2026 deprecation note says requests to `gemini-2.5-flash` route to `gemini-3.5-flash-lite` from 1 Dec 2026; `gemini-3.8-flash` is listed as the new stable Flash and `gemini-3.5-flash-lite` as stable. Settings offers all three so the user can switch without a code change.

## 5. Complete user flow, end to end

1. Land on the app. Sidebar shows "Sample lecture" already there; main view shows the upload card and three honest routes.
2. Click "Open sample lecture" → the lecture loads instantly: Notes tab shows the summary, 5 sections, definitions; the margin column shows timestamps.
3. Switch to Flashcards → card 1 of 20, click to flip, mark "Know", next. Progress "7 / 20 known" updates.
4. Switch to Quiz → answer Q1, instant correct/incorrect + explanation; finish all 10 → score screen ("8 / 10"), review each answer, "Retry quiz".
5. Switch to Mind map → tree of the lecture; click "Learning rate" node → Notes tab opens scrolled to that section.
6. Switch to Transcript → search "overfitting" → 3 matches highlighted; click a match.
7. Export → "Download notes (.md)" saves a real Markdown file; "Download flashcards (.csv)" saves a real CSV.
8. With a key: Settings → paste free Gemini key → "Test key" → "Key works". Upload a 2-minute clip → stages run with honest labels → all four tabs fill from the real lecture → library saves it. Without a key: upload shows "Add your free Gemini API key in Settings to process your own lecture — or open the sample lecture, which needs no key."
9. Delete a lecture from the sidebar; it is gone from `localStorage`.

## 6. Demo script (2 minutes)

- **0:00–0:15** — "One lecture in, four study tools out." Show the upload screen; point at the sample lecture.
- **0:15–0:45** — Open the sample: Notes tab, scroll two sections, point at the timestamp margin. Flip two flashcards.
- **0:45–1:15** — Take the quiz live: answer two questions, show instant scoring and the explanation line.
- **1:15–1:45** — Open the mind map, click a node, land on that notes section. Search the transcript for one term.
- **1:45–2:00** — Upload a 2-minute clip live (key already in Settings) to prove the pipeline is real; close on the Markdown export.

## 7. Risks + fallbacks

- **Live 45-minute upload stalls or 429s on stage.** Fallback: cap live uploads at ~15 min / 200 MB; demo the full pipeline on the pre-processed sample; run only a 2-minute clip live. Say so out loud.
- **Gemini returns bad JSON for an artefact.** Fallback: one automatic retry with "return only JSON"; if it still fails, that tab shows the error and the other three tabs still work.
- **Quiz/flashcard answers can be wrong.** Every artefact tab carries the line "Generated from the lecture — check against the transcript before you trust it." The mind map is labelled "an outline generated from the lecture, not a verified knowledge graph."
- **No key in the room.** The sample lecture carries the whole demo; nothing is faked as a live call.

## 8. Quality bar

- Tests: `node tests/test.js`, 0 failures, exact count reported.
- Screenshots: headless Chrome, `file://`, 1280px + 390px, zero horizontal overflow, read and fixed.
- No gradients, glows, sparkle emoji, or cliché copy. No fake data presented as real. No dead controls.
- README + MIT LICENSE (Sivasai Boggu, 2026). Git: human-style commits, never pushed (Siva creates the repo `lecture-to-everything` himself).
