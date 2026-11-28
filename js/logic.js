/* Pure logic — no DOM, no network. Used by the app and by tests/test.js. */
function fmtTime(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(sec / 60), s = sec % 60;
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

function countMapNodes(node) {
  if (!node) return 0;
  return 1 + (node.children || []).reduce((n, c) => n + countMapNodes(c), 0);
}

function mapDepth(node) {
  if (!node || !node.children || node.children.length === 0) return 0;
  return 1 + Math.max(...node.children.map(mapDepth));
}

function mapHasCycle(node, seen) {
  seen = seen || new Set();
  if (!node || typeof node !== "object") return false;
  if (seen.has(node)) return true;
  seen.add(node);
  return (node.children || []).some(c => mapHasCycle(c, seen));
}

function validateLecture(lec) {
  const errors = [];
  if (!lec || typeof lec !== "object") return ["lecture is not an object"];
  if (!lec.title) errors.push("missing title");
  if (!Array.isArray(lec.transcript) || lec.transcript.length === 0) errors.push("transcript is empty");
  const dur = lec.durationSec || 0;
  (lec.transcript || []).forEach((s, i) => {
    if (typeof s.startSec !== "number" || s.startSec < 0) errors.push(`transcript[${i}] has a bad startSec`);
    if (!s.text) errors.push(`transcript[${i}] has no text`);
  });
  if (!lec.notes || !Array.isArray(lec.notes.sections) || lec.notes.sections.length === 0) errors.push("notes have no sections");
  (lec.notes?.sections || []).forEach((s, i) => {
    if (s.startSec < 0 || s.startSec > dur) errors.push(`notes section ${s.id || i} startSec is outside the lecture`);
    if (!Array.isArray(s.points) || s.points.length === 0) errors.push(`notes section ${s.id || i} has no points`);
  });  if (!Array.isArray(lec.flashcards) || lec.flashcards.length !== 20) errors.push(`flashcards: expected 20, got ${(lec.flashcards || []).length}`);
  (lec.flashcards || []).forEach((c, i) => {
    if (!c.front || !c.back) errors.push(`flashcard ${i + 1} is missing a front or back`);
  });
  if (!Array.isArray(lec.quiz) || lec.quiz.length !== 10) errors.push(`quiz: expected 10 questions, got ${(lec.quiz || []).length}`);
  (lec.quiz || []).forEach((q, i) => {
    if (!Array.isArray(q.options) || q.options.length !== 4) errors.push(`quiz q${i + 1}: expected 4 options`);
    if (typeof q.correctIndex !== "number" || q.correctIndex < 0 || q.correctIndex > 3) errors.push(`quiz q${i + 1}: correctIndex out of range`);
    if (!q.explanation) errors.push(`quiz q${i + 1}: missing explanation`);
  });
  const nodes = countMapNodes(lec.mindmap);
  if (nodes === 0) errors.push("mind map is empty");
  if (nodes > 25) errors.push(`mind map has ${nodes} nodes, over the 25-node cap`);
  if (mapDepth(lec.mindmap) > 3) errors.push("mind map is deeper than 3 levels");
  if (mapHasCycle(lec.mindmap)) errors.push("mind map contains a cycle");
  return errors;
}

function scoreQuiz(quiz, answers) {
  let correct = 0;
  quiz.forEach((q, i) => { if (answers[i] === q.correctIndex) correct++; });
  return { correct, total: quiz.length, pct: quiz.length ? Math.round((correct / quiz.length) * 100) : 0 };
}

function searchTranscript(transcript, query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return [];
  const hits = [];
  transcript.forEach((seg, i) => {
    let idx = seg.text.toLowerCase().indexOf(q);
    while (idx !== -1) { hits.push({ segIndex: i, startSec: seg.startSec, pos: idx }); idx = seg.text.toLowerCase().indexOf(q, idx + q.length); }
  });
  return hits;
}

function highlightText(text, query) {
  const q = (query || "").trim();
  if (!q) return escapeHtml(text);
  const lower = text.toLowerCase(), ql = q.toLowerCase();
  let out = "", i = 0, idx = lower.indexOf(ql);
  while (idx !== -1) {
    out += escapeHtml(text.slice(i, idx)) + "<mark>" + escapeHtml(text.slice(idx, idx + q.length)) + "</mark>";
    i = idx + q.length; idx = lower.indexOf(ql, i);
  }
  return out + escapeHtml(text.slice(i));
}

function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function exportNotesMarkdown(lec) {
  const lines = [];
  lines.push("# " + lec.title, "");
  lines.push("_Generated from the lecture — check against the transcript before you trust it._", "");
  if (lec.notes?.summary) { lines.push(lec.notes.summary, ""); }
  (lec.notes?.sections || []).forEach(s => {
    // A section with no endSec ends where it starts; never print 00:00 for it.
    lines.push(`## ${s.heading}  [${fmtTime(s.startSec)}–${fmtTime(s.endSec ?? s.startSec)}]`, "");
    (s.points || []).forEach(p => lines.push("- " + p));
    if (s.definitions && s.definitions.length) {
      lines.push("", "| Term | Meaning |", "| --- | --- |");
      s.definitions.forEach(d => lines.push(`| ${d.term} | ${d.meaning} |`));
    }
    lines.push("");
  });
  return lines.join("\n");
}

function exportFlashcardsCsv(lec) {
  const q = v => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  const rows = [["Front", "Back"]];
  (lec.flashcards || []).forEach(c => rows.push([q(c.front), q(c.back)]));
  return rows.map(r => r.join(",")).join("\n");
}

/* Split a mind-map label into at most two lines for the SVG node. */
function wrapLabel(label, maxChars) {
  maxChars = maxChars || 22;
  const words = String(label || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? cur + " " + w : w;
    if (next.length > maxChars && cur) { lines.push(cur); cur = w; if (lines.length === 2) break; }
    else cur = next;
  }
  if (lines.length < 2 && cur) lines.push(cur);
  if (lines.length === 2) {
    const used = lines.join(" ").length;
    const total = String(label || "").length;
    if (total > used + 1) lines[1] = lines[1].replace(/\.?$/, "…");
    if (lines[1].length > maxChars) lines[1] = lines[1].slice(0, maxChars - 1) + "…";
  }
  return lines;
}
/* Lay out the mind-map tree for SVG: x by depth, y by leaf order. */
function layoutMap(root) {
  const NODE_W = 168, NODE_H = 58, X_GAP = 42, Y_GAP = 18;
  let leafY = 0;
  const positions = new Map();
  function walk(node, depth) {
    const kids = node.children || [];
    // Key by the node object itself: two nodes may share a label (or lack an
    // id), and keying by label used to make one overwrite the other.
    if (kids.length === 0) { positions.set(node, { x: depth * (NODE_W + X_GAP), y: leafY * (NODE_H + Y_GAP), node }); leafY++; return leafY - 1; }
    const childRows = kids.map(k => walk(k, depth + 1));
    const mid = (childRows[0] + childRows[childRows.length - 1]) / 2;
    positions.set(node, { x: depth * (NODE_W + X_GAP), y: mid * (NODE_H + Y_GAP), node });
    return mid;
  }
  walk(root, 0);
  const width = (mapDepth(root) + 1) * NODE_W + mapDepth(root) * X_GAP + 16;
  const height = Math.max(leafY, 1) * (NODE_H + Y_GAP) + 16;
  return { positions, width, height, NODE_W, NODE_H };
}

function normaliseArtefacts(raw, transcript, durationSec) {
  /* Turn raw Gemini artefact JSON into a stored Lecture's artefact fields,
     clamping timestamps into range and assigning ids. */
  const clamp = s => Math.max(0, Math.min(durationSec, Math.round(Number(s) || 0)));
  const notes = {
    summary: String(raw.notes?.summary || "").trim(),
    sections: (raw.notes?.sections || []).map((s, i) => ({
      id: "s" + (i + 1),
      heading: String(s.heading || "Section " + (i + 1)),
      startSec: clamp(s.startSec), endSec: Math.max(clamp(s.startSec), clamp(s.endSec)),
      points: (s.points || []).map(String),
      definitions: (s.definitions || []).map(d => ({ term: String(d.term || ""), meaning: String(d.meaning || "") }))
    }))
  };
  const flashcards = (raw.cards || []).slice(0, 20).map((c, i) => ({ id: "f" + (i + 1), front: String(c.front || ""), back: String(c.back || ""), known: false }));
  const quiz = (raw.quiz || []).slice(0, 10).map((q, i) => ({
    id: "q" + (i + 1), question: String(q.question || ""),
    options: (q.options || []).slice(0, 4).map(String),
    correctIndex: Math.max(0, Math.min(3, Number(q.correctIndex) || 0)),
    explanation: String(q.explanation || ""), sourceSec: clamp(q.sourceSec)
  }));
  let n = 0;
  const cleanTree = (t, depth) => {
    if (!t) return null;
    const kids = depth >= 3 ? [] : (t.children || []).map(c => cleanTree(c, depth + 1)).filter(Boolean);
    return { id: "m" + (n++), label: String(t.label || "Topic"), startSec: clamp(t.startSec), children: kids };
  };
  const mindmap = cleanTree(raw.tree, 0) || { id: "m0", label: "Lecture", startSec: 0, children: [] };
  return { notes, flashcards, quiz, mindmap };
}

if (typeof module !== "undefined") {
  module.exports = { fmtTime, countMapNodes, mapDepth, mapHasCycle, validateLecture, scoreQuiz, searchTranscript, highlightText, escapeHtml, exportNotesMarkdown, exportFlashcardsCsv, layoutMap, normaliseArtefacts, wrapLabel };
}
