/* LectureLens tests — zero dependencies. Run: node tests/test.js */
const assert = require("node:assert");
const {
  fmtTime, countMapNodes, mapDepth, validateLecture, scoreQuiz,
  searchTranscript, highlightText, exportNotesMarkdown, exportFlashcardsCsv,
  layoutMap, normaliseArtefacts, wrapLabel
} = require("../js/logic.js");
const SAMPLE = require("../js/sample.js");

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log(`ok ${passed} - ${name}`);
}

/* fmtTime */
check("fmtTime formats 0, 65 and 720", () => {
  assert.strictEqual(fmtTime(0), "00:00");
  assert.strictEqual(fmtTime(65), "01:05");
  assert.strictEqual(fmtTime(720), "12:00");
  assert.strictEqual(fmtTime(-5), "00:00");
});

/* Sample lecture integrity */
check("sample lecture validates with zero errors", () => {
  assert.deepStrictEqual(validateLecture(SAMPLE), []);
});
check("sample has 20 flashcards, 10 quiz questions, 5 note sections", () => {
  assert.strictEqual(SAMPLE.flashcards.length, 20);
  assert.strictEqual(SAMPLE.quiz.length, 10);
  assert.strictEqual(SAMPLE.notes.sections.length, 5);
});
check("every quiz question has 4 options and exactly one correct index", () => {
  SAMPLE.quiz.forEach((q, i) => {
    assert.strictEqual(q.options.length, 4, `q${i + 1}`);
    assert.ok(q.correctIndex >= 0 && q.correctIndex <= 3, `q${i + 1}`);
    assert.ok(q.explanation.length > 10, `q${i + 1} explanation`);
  });
});
check("quiz correct answers are spread across positions, not all the same", () => {
  const positions = new Set(SAMPLE.quiz.map(q => q.correctIndex));
  assert.ok(positions.size >= 3, `only ${positions.size} distinct positions`);
});
check("every flashcard and quiz explanation mentions only lecture content (no empty strings)", () => {
  SAMPLE.flashcards.forEach(c => { assert.ok(c.front.trim().length > 5); assert.ok(c.back.trim().length > 5); });
});
check("mind map has 21 nodes, depth 2, no cycles", () => {
  assert.strictEqual(countMapNodes(SAMPLE.mindmap), 21);
  assert.strictEqual(mapDepth(SAMPLE.mindmap), 2);
});
check("all notes sections and mind-map nodes sit inside the transcript range", () => {
  SAMPLE.notes.sections.forEach(s => {
    assert.ok(s.startSec >= 0 && s.startSec <= SAMPLE.durationSec, s.id);
    assert.ok(s.endSec > s.startSec && s.endSec <= SAMPLE.durationSec, s.id);
  });
  const walk = n => { assert.ok(n.startSec >= 0 && n.startSec <= SAMPLE.durationSec, n.label); (n.children || []).forEach(walk); };
  walk(SAMPLE.mindmap);
});
check("transcript segments are in time order and cover the lecture", () => {
  const segs = SAMPLE.transcript;
  for (let i = 1; i < segs.length; i++) assert.ok(segs[i].startSec > segs[i - 1].startSec, `segment ${i} out of order`);
  assert.strictEqual(segs[0].startSec, 0);
  assert.ok(segs[segs.length - 1].startSec < SAMPLE.durationSec);
});
check("validateLecture catches a broken lecture", () => {
  const bad = JSON.parse(JSON.stringify(SAMPLE));
  bad.quiz = bad.quiz.slice(0, 9);
  bad.flashcards = bad.flashcards.slice(0, 19);
  bad.quiz[0].correctIndex = 7;
  const errs = validateLecture(bad);
  assert.ok(errs.some(e => e.includes("quiz: expected 10")), errs.join("; "));
  assert.ok(errs.some(e => e.includes("flashcards: expected 20")), errs.join("; "));
  assert.ok(errs.some(e => e.includes("correctIndex out of range")), errs.join("; "));
});

/* Quiz scoring */
check("scoreQuiz counts correct answers and percent", () => {
  const quiz = SAMPLE.quiz;
  const allRight = quiz.map(q => q.correctIndex);
  assert.deepStrictEqual(scoreQuiz(quiz, allRight), { correct: 10, total: 10, pct: 100 });
  const allWrong = quiz.map(q => (q.correctIndex + 1) % 4);
  assert.deepStrictEqual(scoreQuiz(quiz, allWrong), { correct: 0, total: 10, pct: 0 });
  const half = quiz.map((q, i) => (i < 5 ? q.correctIndex : (q.correctIndex + 1) % 4));
  assert.deepStrictEqual(scoreQuiz(quiz, half), { correct: 5, total: 10, pct: 50 });
});

/* Transcript search */
check("searchTranscript finds 'overfitting' in the right segment and 'gradient' many times", () => {
  const hits = searchTranscript(SAMPLE.transcript, "overfitting");
  assert.ok(hits.length >= 1, `expected >=1 hit, got ${hits.length}`);
  assert.ok(hits.every(h => h.startSec >= 640), "hits should come from the overfitting part");
  assert.ok(searchTranscript(SAMPLE.transcript, "gradient").length >= 5);
  assert.deepStrictEqual(searchTranscript(SAMPLE.transcript, "zzzz-not-a-word"), []);
  assert.deepStrictEqual(searchTranscript(SAMPLE.transcript, "  "), []);
});
check("highlightText wraps matches in <mark> and escapes HTML", () => {
  const out = highlightText("Overfitting <b>is</b> bad. overfitting again.", "overfitting");
  assert.ok(out.includes("<mark>Overfitting</mark>"), out);
  assert.ok(out.includes("&lt;b&gt;"), out);
  assert.ok(!out.includes("<b>is</b>"), out);
});

/* Exports */
check("exportNotesMarkdown contains title, sections, timestamps and definitions", () => {
  const md = exportNotesMarkdown(SAMPLE);
  assert.ok(md.startsWith("# Gradient Descent, Explained"));
  assert.ok(md.includes("## The learning rate"));
  assert.ok(md.includes("[05:20–08:10]") || md.includes("[05:20"), md);
  assert.ok(md.includes("| Term | Meaning |"));
  assert.ok(md.includes("check against the transcript"));
});
check("exportFlashcardsCsv has a header plus 20 rows with quoted fields", () => {
  const csv = exportFlashcardsCsv(SAMPLE);
  const lines = csv.split("\n");
  assert.strictEqual(lines.length, 21);
  assert.strictEqual(lines[0], 'Front,Back');
  assert.ok(lines[1].startsWith('"What is training'));
});

/* Mind-map layout */
check("layoutMap places every node inside the SVG bounds with no overlaps on a row", () => {
  const { positions, width, height, NODE_W, NODE_H } = layoutMap(SAMPLE.mindmap);
  assert.strictEqual(positions.size, 21);
  const seenXY = new Map();
  positions.forEach(p => {
    assert.ok(p.x >= 0 && p.x + NODE_W <= width, `node ${p.node.label} x out of bounds`);
    assert.ok(p.y >= 0 && p.y + NODE_H <= height, `node ${p.node.label} y out of bounds`);
    const key = p.x + "," + p.y;
    assert.ok(!seenXY.has(key), `two nodes share position ${key}`);
    seenXY.set(key, p.node.label);
  });
  const root = positions.get(SAMPLE.mindmap);
  assert.strictEqual(root.x, 0);
});

/* wrapLabel: two lines max, no mid-word cuts, ellipsis only when truncated */
check("wrapLabel wraps long labels onto two lines without cutting words", () => {
  assert.deepStrictEqual(wrapLabel("Loss function", 22), ["Loss function"]);
  assert.deepStrictEqual(wrapLabel("Change numbers to be less wrong", 22), ["Change numbers to be", "less wrong"]);
  assert.deepStrictEqual(wrapLabel("Cross-entropy for classification", 22), ["Cross-entropy for", "classification"]);
  assert.deepStrictEqual(wrapLabel("θ_new = θ_old − α · ∇Loss", 22), ["θ_new = θ_old − α ·", "∇Loss"]);
  // Every sample mind-map label fits in two lines.
  const walk = n => { assert.ok(wrapLabel(n.label, 22).length <= 2, n.label); (n.children || []).forEach(walk); };
  walk(SAMPLE.mindmap);
});

/* normaliseArtefacts: clamps timestamps, caps counts, ids nodes */
check("normaliseArtefacts clamps out-of-range timestamps and caps artefact counts", () => {
  const raw = {
    notes: { summary: "s", sections: [{ id: "x", heading: "H", startSec: -10, endSec: 99999, points: ["p"], definitions: [] }] },
    cards: Array.from({ length: 25 }, (_, i) => ({ front: "Q" + i, back: "A" + i })),
    quiz: Array.from({ length: 12 }, (_, i) => ({ question: "Q" + i, options: ["a", "b", "c", "d"], correctIndex: 9, explanation: "e", sourceSec: -3 })),
    tree: { label: "Root", startSec: 0, children: [{ label: "A", startSec: 5000, children: [] }] }
  };
  const out = normaliseArtefacts(raw, SAMPLE.transcript, 720);
  assert.strictEqual(out.notes.sections[0].startSec, 0);
  assert.strictEqual(out.notes.sections[0].endSec, 720);
  assert.strictEqual(out.flashcards.length, 20);
  assert.strictEqual(out.quiz.length, 10);
  assert.strictEqual(out.quiz[0].correctIndex, 3);
  assert.strictEqual(out.quiz[0].sourceSec, 0);
  assert.strictEqual(out.mindmap.children[0].startSec, 720);
  assert.deepStrictEqual(validateLecture({
    title: "t", durationSec: 720, transcript: SAMPLE.transcript,
    notes: out.notes, flashcards: out.flashcards, quiz: out.quiz, mindmap: out.mindmap
  }), []);
});


/* layoutMap: duplicate labels must not overwrite each other */
check("layoutMap keeps two nodes with the same label at different positions", () => {
  const root = { id: "r", label: "Topic", startSec: 0, children: [
    { id: "a", label: "Same", startSec: 10, children: [] },
    { id: "b", label: "Same", startSec: 20, children: [] }
  ]};
  const { positions } = layoutMap(root);
  assert.strictEqual(positions.size, 3);
  assert.notStrictEqual(positions.get(root.children[0]).y, positions.get(root.children[1]).y);
});

/* exportNotesMarkdown: a section with no endSec ends where it starts */
check("exportNotesMarkdown never prints 00:00 for a missing endSec", () => {
  const md = exportNotesMarkdown({
    title: "T", notes: { summary: "", sections: [{ heading: "H", startSec: 65, points: ["p"] }] }
  });
  assert.ok(md.includes("[01:05\u201301:05]"), md);
  assert.ok(!md.includes("00:00"), md);
});
console.log(`\n${passed} tests passed, 0 failed.`);
