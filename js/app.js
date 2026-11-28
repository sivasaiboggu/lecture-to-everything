/* LectureLens app — state, rendering, upload + live-AI flow. */
(function () {
  "use strict";
  const $ = sel => document.querySelector(sel);
  const LS_LECTURES = "ll_lectures";
  const LS_CURRENT = "ll_current";

  let lectures = loadLectures();
  let currentId = localStorage.getItem(LS_CURRENT) || null;
  let view = currentId ? "lecture" : "home";
  let tab = "notes";
  let fcIndex = 0, fcFlipped = false;
  let quizAnswers = [], quizDone = false, quizIndex = 0;
  let searchQuery = "";
  let processing = false;

  /* Deep links: #sample, #sample/cards, #sample/quiz, #sample/map, #sample/transcript */
  (function () {
    const h = (location.hash || "").replace(/^#/, "");
    if (!h) return;
    const parts = h.split("/");
    if (parts[0] === "sample") {
      currentId = "sample-gradient-descent";
      view = "lecture";
      if (["notes", "cards", "quiz", "map", "transcript"].includes(parts[1])) tab = parts[1];
      localStorage.setItem(LS_CURRENT, currentId);
    }
  })();

  function loadLectures() {
    try {
      const raw = localStorage.getItem(LS_LECTURES);
      if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr) && arr.length) return arr; }
    } catch (e) {}
    return [JSON.parse(JSON.stringify(SAMPLE_LECTURE))];
  }
  function saveLectures() { localStorage.setItem(LS_LECTURES, JSON.stringify(lectures)); }
  function current() { return lectures.find(l => l.id === currentId) || null; }
  function setCurrent(id) { currentId = id; localStorage.setItem(LS_CURRENT, id || ""); view = id ? "lecture" : "home"; tab = "notes"; fcIndex = 0; fcFlipped = false; quizAnswers = []; quizDone = false; quizIndex = 0; searchQuery = ""; render(); }

  /* ---------- parsing pasted transcripts ---------- */
  function parseSrtTime(t) {
    const m = t.trim().match(/(?:(\d+):)?(\d+):(\d+)[,.](\d+)/);
    if (!m) return null;
    return (parseInt(m[1] || "0", 10) * 3600) + (parseInt(m[2], 10) * 60) + parseInt(m[3], 10);
  }
  function parseTranscriptText(text) {
    const lines = text.split(/\r?\n/);
    const segs = [];
    let pendingStart = null, buf = [];
    const flush = () => { if (buf.length && pendingStart !== null) segs.push({ startSec: pendingStart, text: buf.join(" ").trim() }); buf = []; };
    for (const line of lines) {
      const m = line.match(/(\d{1,2}:\d{2}(?::\d{2})?(?:[,.]\d+)?)\s*(?:-->|--)\s*(\d{1,2}:\d{2}(?::\d{2})?(?:[,.]\d+)?)/)
        || line.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(.*)$/);
      if (m) {
        flush();
        const s = parseSrtTime(m[1]);
        if (s !== null) { pendingStart = s; if (m[2] && !m[2].includes("--")) buf.push(m[2]); }
        continue;
      }
      if (/^\d+$/.test(line.trim())) continue;
      if (line.trim()) buf.push(line.trim());
    }
    flush();
    if (segs.length) return { segments: segs, timed: true };
    // Plain text: split into ~120-word chunks, estimate time at 150 wpm.
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length < 30) return { segments: [], timed: false, error: "That text is too short to work from — paste at least a few paragraphs of transcript." };
    const out = [];
    const CHUNK = 120, WPM = 150;
    for (let i = 0; i < words.length; i += CHUNK) {
      out.push({ startSec: Math.round((i / WPM) * 60), text: words.slice(i, i + CHUNK).join(" ") });
    }
    return { segments: out, timed: false };
  }

  /* ---------- rendering ---------- */
  function render() { renderSidebar(); renderMain(); }

  function renderSidebar() {
    const list = $("#lecture-list");
    list.innerHTML = lectures.map(l => {
      const known = (l.flashcards || []).filter(c => c.known).length;
      return `<li><button data-id="${l.id}" class="${l.id === currentId ? "active" : ""}">${escapeHtml(l.title)}<span class="lec-del" data-del="${l.id}" title="Delete lecture">×</span><span class="lec-meta">${fmtTime(l.durationSec)} · ${l.flashcards ? l.flashcards.length : 0} cards · quiz best ${l.quizBest || 0}/10</span></button></li>`;
    }).join("");
    list.querySelectorAll("button[data-id]").forEach(b => b.addEventListener("click", e => {
      const del = e.target.closest("[data-del]");
      if (del) { e.stopPropagation(); deleteLecture(del.getAttribute("data-del")); return; }
      setCurrent(b.getAttribute("data-id"));
    }));
  }

  function deleteLecture(id) {
    lectures = lectures.filter(l => l.id !== id);
    if (!lectures.length) lectures = [JSON.parse(JSON.stringify(SAMPLE_LECTURE))];
    saveLectures();
    if (currentId === id) setCurrent(null); else render();
  }

  function renderMain() {
    const main = $("#main");
    if (view === "home" || !current()) { main.innerHTML = homeHtml(); bindHome(); return; }
    const lec = current();
    const errors = validateLecture(lec);
    main.innerHTML = `
      <div class="topbar"><span class="crumb">LectureLens / ${escapeHtml(lec.title)}</span>
        <button class="btn btn-ghost btn-small" id="btn-new">+ New lecture</button></div>
      <div class="hero"><h1>${escapeHtml(lec.title)}</h1>
        <p class="lede">${escapeHtml(lec.notes?.summary || "")}</p>
        <p class="mono">${fmtTime(lec.durationSec)} · ${lec.transcript.length} transcript segments · source: ${lec.source === "sample" ? "sample lecture (no key needed)" : lec.source} · ${escapeHtml(lec.lecturer || "")}</p></div>
      ${errors.length ? `<div class="notice warn"><strong>This lecture has a problem:</strong> ${errors.map(escapeHtml).join("; ")}. Some tabs may be incomplete.</div>` : ""}
      <div class="notice">Generated from the lecture — check against the transcript before you trust it. The mind map is an outline generated from the lecture, not a verified knowledge graph.</div>
      <div class="tabs" role="tablist">
        <button data-tab="notes" class="${tab === "notes" ? "active" : ""}">Notes</button>
        <button data-tab="cards" class="${tab === "cards" ? "active" : ""}">Flashcards <span class="count">${lec.flashcards.length}</span></button>
        <button data-tab="quiz" class="${tab === "quiz" ? "active" : ""}">Quiz <span class="count">${lec.quiz.length}</span></button>
        <button data-tab="map" class="${tab === "map" ? "active" : ""}">Mind map</button>
        <button data-tab="transcript" class="${tab === "transcript" ? "active" : ""}">Transcript</button>
      </div>
      <div id="tab-body"></div>
      <div class="toolbar">
        <button class="btn btn-ghost btn-small" id="btn-export-md">Download notes (.md)</button>
        <button class="btn btn-ghost btn-small" id="btn-export-csv">Download flashcards (.csv)</button>
      </div>`;
    main.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => { tab = b.getAttribute("data-tab"); renderMain(); }));
    $("#btn-new").addEventListener("click", () => { view = "home"; currentId = null; localStorage.removeItem(LS_CURRENT); render(); });
    $("#btn-export-md").addEventListener("click", () => download(lec.title.replace(/\W+/g, "-").toLowerCase() + "-notes.md", exportNotesMarkdown(lec), "text/markdown"));
    $("#btn-export-csv").addEventListener("click", () => download(lec.title.replace(/\W+/g, "-").toLowerCase() + "-flashcards.csv", exportFlashcardsCsv(lec), "text/csv"));
    renderTab(lec);
  }

  function renderTab(lec) {
    const body = $("#tab-body");
    if (tab === "notes") body.innerHTML = notesHtml(lec);
    else if (tab === "cards") { body.innerHTML = cardsHtml(lec); bindCards(lec); }
    else if (tab === "quiz") { body.innerHTML = quizHtml(lec); bindQuiz(lec); }
    else if (tab === "map") { body.innerHTML = mapHtml(lec); bindMap(lec); }
    else if (tab === "transcript") { body.innerHTML = transcriptHtml(lec); bindTranscript(lec); }
  }

  function notesHtml(lec) {
    return (lec.notes.sections || []).map(s => `
      <div class="doc" id="sec-${s.id}">
        <div class="margin-col"><span class="m-label">${fmtTime(s.startSec)}</span><span class="m-label">– ${fmtTime(s.endSec)}</span></div>
        <div class="doc-body">
          <h3>${escapeHtml(s.heading)}</h3>
          <ul>${(s.points || []).map(p => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
          ${(s.definitions && s.definitions.length) ? `<table class="def-table"><tr><th>Term</th><th>Meaning</th></tr>${s.definitions.map(d => `<tr><td>${escapeHtml(d.term)}</td><td>${escapeHtml(d.meaning)}</td></tr>`).join("")}</table>` : ""}
        </div>
      </div>`).join("");
  }

  function cardsHtml(lec) {
    const cards = lec.flashcards;
    const card = cards[fcIndex];
    const known = cards.filter(c => c.known).length;
    return `
      <div class="fc-wrap">
        <div class="fc-card" id="fc-card" tabindex="0" role="button" aria-label="Flashcard, click to flip">
          <span class="fc-side">${fcFlipped ? "Answer" : "Question"}</span>
          <span class="fc-text">${escapeHtml(fcFlipped ? card.back : card.front)}</span>
          <span class="fc-hint">Click or press Space to flip</span>
        </div>
        <div class="fc-controls">
          <button class="btn btn-ghost btn-small" id="fc-prev">← Previous</button>
          <button class="btn btn-ghost btn-small" id="fc-know">${card.known ? "✓ Known — mark as still learning" : "Mark as known"}</button>
          <button class="btn btn-ghost btn-small" id="fc-shuffle">Shuffle</button>
          <button class="btn btn-small" id="fc-next">Next →</button>
        </div>
        <p class="fc-progress">Card ${fcIndex + 1} of ${cards.length} · <span class="fc-known">${known} known</span> · ${cards.length - known} still learning</p>
      </div>`;
  }
  function bindCards(lec) {
    const flip = () => { fcFlipped = !fcFlipped; renderTab(lec); };
    $("#fc-card").addEventListener("click", flip);
    $("#fc-card").addEventListener("keydown", e => { if (e.code === "Space" || e.key === "Enter") { e.preventDefault(); flip(); } });
    $("#fc-prev").addEventListener("click", () => { fcIndex = (fcIndex - 1 + lec.flashcards.length) % lec.flashcards.length; fcFlipped = false; renderTab(lec); });
    $("#fc-next").addEventListener("click", () => { fcIndex = (fcIndex + 1) % lec.flashcards.length; fcFlipped = false; renderTab(lec); });
    $("#fc-shuffle").addEventListener("click", () => {
      for (let i = lec.flashcards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[lec.flashcards[i], lec.flashcards[j]] = [lec.flashcards[j], lec.flashcards[i]]; }
      fcIndex = 0; fcFlipped = false; saveLectures(); renderTab(lec);
    });
    $("#fc-know").addEventListener("click", () => { lec.flashcards[fcIndex].known = !lec.flashcards[fcIndex].known; saveLectures(); renderTab(lec); });
  }

  function quizHtml(lec) {
    if (quizDone) {
      const score = scoreQuiz(lec.quiz, quizAnswers);
      return `
        <div class="card"><p class="small muted">Quiz finished</p>
        <p class="score-big">${score.correct} / ${score.total}</p>
        <p>${score.pct >= 80 ? "Solid. You have the core ideas." : score.pct >= 50 ? "Halfway there — review the ones below." : "Worth another pass through the notes first."} ${lec.quizBest < score.correct ? "New best score — saved." : `Best score for this lecture: ${lec.quizBest || 0} / ${lec.quiz.length}.`}</p>
        <button class="btn" id="quiz-retry">Retry quiz</button></div>
        ${lec.quiz.map((q, i) => {
          const a = quizAnswers[i];
          return `<div class="quiz-review"><p class="qr-q">${i + 1}. ${escapeHtml(q.question)}</p>
          <p class="qr-a"><span class="${a === q.correctIndex ? "mark-good" : "mark-bad"}">${a === q.correctIndex ? "Correct" : "Not correct"}</span> — correct answer: ${escapeHtml(q.options[q.correctIndex])}${a !== undefined && a !== q.correctIndex ? ` · you chose: ${escapeHtml(q.options[a])}` : ""}<br><span class="muted">${escapeHtml(q.explanation)}</span> <span class="mono">[${fmtTime(q.sourceSec)}]</span></p></div>`;
        }).join("")}`;
    }
    const idx = quizIndex;
    if (idx >= lec.quiz.length) { quizDone = true; return quizHtml(lec); }
    const q = lec.quiz[idx];
    const answered = quizAnswers[idx] !== undefined;
    return `
      <div class="card"><p class="small muted">Question ${idx + 1} of ${lec.quiz.length} · ${quizAnswers.filter((a, i) => a === lec.quiz[i].correctIndex).length} correct so far</p>
      <p class="quiz-q">${escapeHtml(q.question)}</p>
      ${q.options.map((o, i) => {
        let cls = "";
        if (answered) { if (i === q.correctIndex) cls = "correct"; else if (i === quizAnswers[idx]) cls = "wrong"; }
        return `<button class="opt ${cls}" data-opt="${i}" ${answered ? "disabled" : ""}><span class="opt-letter">${"ABCD"[i]}</span>${escapeHtml(o)}</button>`;
      }).join("")}
      ${answered ? `<div class="explain"><strong>${quizAnswers[idx] === q.correctIndex ? "Correct." : "Not quite."}</strong> ${escapeHtml(q.explanation)} <span class="mono">From the lecture at ${fmtTime(q.sourceSec)}.</span></div>
      <button class="btn" id="quiz-next">${idx + 1 === lec.quiz.length ? "See your score" : "Next question →"}</button>` : ""}
      </div>`;
  }
  function bindQuiz(lec) {
    const retry = $("#quiz-retry");
    if (retry) retry.addEventListener("click", () => { quizAnswers = []; quizDone = false; quizIndex = 0; renderTab(lec); });
    const next = $("#quiz-next");
    if (next) next.addEventListener("click", () => {
      if (quizIndex + 1 >= lec.quiz.length) {
        quizDone = true;
        const score = scoreQuiz(lec.quiz, quizAnswers);
        if (score.correct > (lec.quizBest || 0)) { lec.quizBest = score.correct; saveLectures(); renderSidebar(); }
      } else { quizIndex++; }
      renderTab(lec);
    });
    document.querySelectorAll(".opt[data-opt]").forEach(b => b.addEventListener("click", () => {
      quizAnswers[quizIndex] = parseInt(b.getAttribute("data-opt"), 10);
      renderTab(lec);
    }));
  }

  function mapHtml(lec) {
    const { positions, width, height, NODE_W, NODE_H } = layoutMap(lec.mindmap);
    let edges = "", nodes = "";
    const walk = node => {
      const p = positions.get(node);
      (node.children || []).forEach(k => {
        const c = positions.get(k);
        const x1 = p.x + NODE_W, y1 = p.y + NODE_H / 2, x2 = c.x, y2 = c.y + NODE_H / 2, mx = (x1 + x2) / 2;
        edges += `<path class="map-edge" d="M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}"/>`;
        walk(k);
      });
    };
    walk(lec.mindmap);
    positions.forEach((p, key) => {
      const isRoot = p.node === lec.mindmap;
      const lines = wrapLabel(p.node.label, 22);
      const labelText = lines.length === 1
        ? `<text x="${p.x + 10}" y="${p.y + 22}">${escapeHtml(lines[0])}</text><text class="map-time" x="${p.x + 10}" y="${p.y + 40}">${fmtTime(p.node.startSec)}</text>`
        : `<text x="${p.x + 10}" y="${p.y + 18}">${escapeHtml(lines[0])}</text><text x="${p.x + 10}" y="${p.y + 33}">${escapeHtml(lines[1])}</text><text class="map-time" x="${p.x + 10}" y="${p.y + 49}">${fmtTime(p.node.startSec)}</text>`;
      nodes += `<g class="map-node ${isRoot ? "root" : ""}" data-sec="${p.node.startSec}" data-label="${escapeHtml(p.node.label)}">
        <rect x="${p.x}" y="${p.y}" width="${NODE_W}" height="${NODE_H}"></rect>
        ${labelText}</g>`;
    });
    return `<p class="map-hint">Click any node to jump to that part of the notes. ${countMapNodes(lec.mindmap)} nodes, generated from the lecture.</p>
      <div class="map-wrap"><svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Mind map of ${escapeHtml(lec.title)}">${edges}${nodes}</svg></div>`;
  }
  function bindMap(lec) {
    document.querySelectorAll(".map-node").forEach(g => g.addEventListener("click", () => {
      const sec = parseInt(g.getAttribute("data-sec"), 10);
      const section = (lec.notes.sections || []).find(s => sec >= s.startSec && sec < s.endSec)
        || [...(lec.notes.sections || [])].sort((a, b) => Math.abs(a.startSec - sec) - Math.abs(b.startSec - sec))[0];
      tab = "notes"; renderMain();
      if (section) { const el = document.getElementById("sec-" + section.id); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "start" }); }
    }));
  }

  function transcriptHtml(lec) {
    const hits = searchTranscript(lec.transcript, searchQuery);
    return `
      <div class="search-row"><input type="text" id="t-search" placeholder="Search the transcript — e.g. overfitting" value="${escapeHtml(searchQuery)}" aria-label="Search transcript">
      <span class="mono" style="align-self:center">${searchQuery ? hits.length + " match" + (hits.length === 1 ? "" : "es") : lec.transcript.length + " segments"}</span></div>
      ${lec.transcript.map((s, i) => `<div class="tseg" data-seg="${i}"><span class="t-time">${fmtTime(s.startSec)}</span><span>${searchQuery ? highlightText(s.text, searchQuery) : escapeHtml(s.text)}</span></div>`).join("")}`;
  }
  function bindTranscript(lec) {
    const input = $("#t-search");
    input.addEventListener("input", () => { searchQuery = input.value; const pos = input.selectionStart; renderTab(lec); const again = $("#t-search"); again.focus(); again.setSelectionRange(pos, pos); });
  }

  /* ---------- home / upload / settings ---------- */
  function homeHtml() {
    const hasKey = !!geminiKey();
    return `
      <div class="hero"><h1>One lecture in, four study tools out.</h1>
      <p class="lede">Upload a lecture and get structured notes, flashcards, a quiz, and a mind map — all from that one recording, all traceable to a timestamp.</p></div>
      <hr class="rule">
      <div class="upload-grid">
        <div class="dropzone" id="dropzone">
          <h3>Upload a lecture</h3>
          <p class="muted">Video or audio — mp4, webm, mp3, wav, m4a. Up to 200&nbsp;MB, about 15 minutes for a live run.</p>
          <p><input type="file" id="file-input" accept="video/*,audio/*" class="hidden">
          <button class="btn" id="btn-choose">Choose a file</button></p>
          <p class="small muted" id="file-name"></p>
          ${hasKey ? `<p class="small">Key saved — uploads will be processed live.</p>` : `<p class="small">No API key saved yet. Add your free Gemini key in Settings below, or open the sample lecture — it needs no key.</p>`}
        </div>
        <div class="card" style="margin-bottom:0">
          <h3>Paste a transcript</h3>
          <p class="muted small">Plain text, or SRT / VTT with timestamps. Without timestamps, times are estimated from word count and marked approximate.</p>
          <input type="text" id="paste-title" placeholder="Lecture title — e.g. Photosynthesis, week 3" style="width:100%;border:1px solid var(--line-strong);border-radius:8px;padding:10px 12px;margin-bottom:10px">
          <textarea class="paste" id="paste-text" placeholder="Paste the transcript here…"></textarea>
          <p style="margin-top:10px"><button class="btn" id="btn-paste">Make study tools from this transcript</button></p>
        </div>
      </div>
      <div id="process-box"></div>
      <div class="card">
        <h3>Or start with the sample lecture</h3>
        <p class="muted">“Gradient Descent, Explained” — a 12-minute lecture written for this demo, already processed into notes, 20 flashcards, a 10-question quiz, and a mind map. No key, no upload, no waiting.</p>
        <button class="btn" id="btn-sample">Open the sample lecture</button>
      </div>
      <div class="card" id="settings">
        <h3>Settings — your Gemini API key</h3>
        <p class="muted">Live processing uses your own free Gemini key. It is stored only in this browser's localStorage and sent only to Google's API. Nothing here has a key of its own.</p>
        <div class="settings-grid">
          <div><label for="api-key">Gemini API key</label>
          <input type="password" id="api-key" placeholder="Paste your key from Google AI Studio" value="${escapeHtml(geminiKey())}" autocomplete="off">
          <p class="field-help">Get one free at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a>. No card needed for the free tier.</p></div>
          <div><label for="model">Model</label>
          <select id="model">${GEMINI_MODELS.map(m => `<option value="${m}" ${m === geminiModel() ? "selected" : ""}>${m}${m === DEFAULT_MODEL ? " (default)" : ""}</option>`).join("")}</select>
          <p class="field-help">Default ${DEFAULT_MODEL} is the stable Flash model. Google routes it to gemini-3.5-flash-lite from 1 Dec 2026 — switch here if it stops working.</p></div>
        </div>
        <div class="toolbar">
          <button class="btn btn-small" id="btn-save-key">Save key</button>
          <button class="btn btn-ghost btn-small" id="btn-test-key">Test key</button>
          <button class="btn btn-ghost btn-small" id="btn-clear-key">Remove key</button>
          <span id="key-status" class="small"></span>
        </div>
      </div>
      <div class="notice warn"><strong>Honest limits.</strong> Transcription and generation run on Google's servers, not on your device — they need a key and internet. A 45-minute lecture will not finish in demo time; live uploads are capped at about 15 minutes. Quiz and flashcard answers can be wrong — check them against the transcript.</div>`;
  }

  function bindHome() {
    $("#btn-sample").addEventListener("click", () => setCurrent("sample-gradient-descent"));
    const dz = $("#dropzone"), fi = $("#file-input");
    $("#btn-choose").addEventListener("click", () => fi.click());
    fi.addEventListener("change", () => { if (fi.files[0]) handleFile(fi.files[0]); });
    ["dragover", "dragenter"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add("drag"); }));
    ["dragleave", "drop"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove("drag"); }));
    dz.addEventListener("drop", e => { const f = e.dataTransfer.files[0]; if (f) handleFile(f); });
    $("#btn-paste").addEventListener("click", handlePaste);
    $("#btn-save-key").addEventListener("click", () => {
      const v = $("#api-key").value.trim();
      if (v) localStorage.setItem("ll_api_key", v); else localStorage.removeItem("ll_api_key");
      localStorage.setItem("ll_model", $("#model").value);
      $("#key-status").textContent = v ? "Key saved in this browser only." : "Key removed.";
      render();
    });
    $("#btn-clear-key").addEventListener("click", () => { localStorage.removeItem("ll_api_key"); render(); });
    $("#model").addEventListener("change", e => localStorage.setItem("ll_model", e.target.value));
    $("#btn-test-key").addEventListener("click", async () => {
      $("#key-status").textContent = "Testing…";
      const r = await geminiTestKey();
      $("#key-status").textContent = r.message;
      $("#key-status").style.color = r.ok ? "var(--good)" : "var(--bad)";
    });
  }

  function showProgress(stage, pct) {
    const box = $("#process-box");
    if (!box) return;
    box.innerHTML = `<div class="card"><div class="progress"><div style="width:${pct}%"></div></div><p class="stage-label">${escapeHtml(stage)}</p></div>`;
  }
  function showError(msg) {
    const box = $("#process-box");
    if (box) box.innerHTML = `<div class="notice error">${escapeHtml(msg)}</div>`;
  }

  async function handleFile(file) {
    if (processing) return;
    $("#file-name").textContent = `${file.name} — ${(file.size / 1048576).toFixed(1)} MB`;
    if (!geminiKey()) { showError("Add your free Gemini API key in Settings first — or open the sample lecture, which needs no key."); return; }
    if (file.size > 200 * 1048576) { showError("That file is over the 200 MB live cap. Use a shorter clip (about 15 minutes) for a live run."); return; }
    processing = true;
    try {
      const onStage = (s, pct) => showProgress(s, pct || 30);
      const fileObj = await geminiUploadFile(file, s => showProgress(s, 15));
      const segments = await geminiTranscribeFile(fileObj, s => showProgress(s, 40));
      if (!segments.length) throw new Error("The transcription came back empty. Try a clip with clearer speech.");
      const durationSec = Math.max(...segments.map(s => s.startSec)) + 60;
      const raw = await geminiMakeArtefacts(segments, durationSec, s => showProgress(s, 70));
      finishLecture({ title: file.name.replace(/\.[^.]+$/, ""), source: "upload", transcript: segments, durationSec }, raw);
    } catch (e) {
      showError(e.message === "NO_KEY" ? "Add your free Gemini API key in Settings first." : (e.message || "Something went wrong. Try again."));
    } finally { processing = false; }
  }

  async function handlePaste() {
    if (processing) return;
    const title = $("#paste-title").value.trim() || "Pasted lecture";
    const text = $("#paste-text").value.trim();
    if (!text) { showError("Paste a transcript first."); return; }
    const parsed = parseTranscriptText(text);
    if (parsed.error) { showError(parsed.error); return; }
    if (!geminiKey()) { showError("Add your free Gemini API key in Settings first — or open the sample lecture, which needs no key."); return; }
    processing = true;
    try {
      const durationSec = Math.max(...parsed.segments.map(s => s.startSec)) + 90;
      const raw = await geminiMakeArtefacts(parsed.segments, durationSec, s => showProgress(s, 50));
      if (!parsed.timed) raw.notes = raw.notes || {};
      finishLecture({ title, source: "paste", transcript: parsed.segments, durationSec, timed: parsed.timed }, raw, parsed.timed);
    } catch (e) {
      showError(e.message === "NO_KEY" ? "Add your free Gemini API key in Settings first." : (e.message || "Something went wrong. Try again."));
    } finally { processing = false; }
  }

  function finishLecture(meta, raw, timed) {
    const parts = normaliseArtefacts(raw, meta.transcript, meta.durationSec);
    const lec = {
      id: "lecture-" + Date.now(),
      title: meta.title, source: meta.source, durationSec: meta.durationSec,
      createdAt: new Date().toISOString(),
      lecturer: timed === false ? "Pasted transcript — timestamps estimated from word count, approximate only" : "",
      transcript: meta.transcript,
      notes: parts.notes, flashcards: parts.flashcards, quiz: parts.quiz, mindmap: parts.mindmap,
      quizBest: 0
    };
    const errors = validateLecture(lec);
    if (errors.length) {
      showError("The AI returned incomplete study material (" + errors.join("; ") + "). Nothing was saved — try again, or use a shorter, clearer lecture.");
      return;
    }
    lectures.unshift(lec);
    saveLectures();
    setCurrent(lec.id);
  }

  function download(name, text, type) {
    const blob = new Blob([text], { type: type + ";charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  render();
})();
