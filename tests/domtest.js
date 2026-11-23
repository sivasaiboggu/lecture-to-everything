/* DOM flow checks in jsdom (no browser needed).
   Loads the real index.html + js files, clicks through the quiz, flashcards,
   mind map and transcript search. Run: node tests/domtest.js
   Requires jsdom (present in silent-speech-notes/node_modules). */
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("/home/hatch/workspace/projects/silent-speech-notes/node_modules/jsdom");

const DIR = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(DIR, "index.html"), "utf8");
const BUNDLE = ["js/logic.js", "js/sample.js", "js/gemini.js", "js/app.js"]
  .map(f => fs.readFileSync(path.join(DIR, f), "utf8")).join("\n;\n");

function load(hash) {
  const dom = new JSDOM(html, {
    url: "http://localhost/index.html" + hash,
    runScripts: "outside-only",
    pretendToBeVisual: true
  });
  dom.window.eval(BUNDLE);
  return dom.window.document;
}

async function run() {
  const doc = load("#sample/quiz");
  const q = s => doc.querySelector(s);
  const qa = s => [...doc.querySelectorAll(s)];

  console.log("options:", qa(".opt").length);
  if (qa(".opt").length !== 4) throw new Error("expected 4 options");

  qa(".opt")[1].click();
  console.log("feedback shown:", !!q(".explain"), "| next button:", !!q("#quiz-next"));
  if (!q(".explain") || !q("#quiz-next")) throw new Error("no feedback after answering");
  console.log("feedback text:", q(".explain").textContent.slice(0, 60));

  const C = [1, 1, 1, 1, 1, 1, 2, 2, 3, 1];
  for (let qi = 1; qi < 10; qi++) {
    q("#quiz-next").click();
    const opts = qa(".opt");
    if (opts.length !== 4) throw new Error("expected 4 options at q" + (qi + 1));
    opts[C[qi]].click();
    if (!q(".explain")) throw new Error("no feedback at q" + (qi + 1));
  }
  q("#quiz-next").click();
  console.log("score screen:", q(".score-big") ? q(".score-big").textContent : null, "| retry:", !!q("#quiz-retry"));
  if (!q(".score-big") || q(".score-big").textContent.trim() !== "10 / 10") throw new Error("expected 10 / 10 score screen");

  q("#quiz-retry").click();
  console.log("after retry, options:", qa(".opt").length);
  if (qa(".opt").length !== 4) throw new Error("retry did not reset");

  const d2 = load("#sample/cards");
  const before = d2.querySelector(".fc-text").textContent;
  d2.querySelector("#fc-card").click();
  const after = d2.querySelector(".fc-text").textContent;
  console.log("flashcard flip:", JSON.stringify(before.slice(0, 30)), "->", JSON.stringify(after.slice(0, 30)), "| side:", d2.querySelector(".fc-side").textContent);
  if (before === after || d2.querySelector(".fc-side").textContent !== "Answer") throw new Error("flashcard did not flip");

  const d3 = load("#sample/map");
  console.log("mind map nodes:", d3.querySelectorAll(".map-node").length);
  if (d3.querySelectorAll(".map-node").length !== 21) throw new Error("expected 21 map nodes");
  d3.querySelectorAll(".map-node")[10].dispatchEvent(new d3.defaultView.Event("click", { bubbles: true }));
  console.log("after node click, notes tab active:", !!d3.querySelector(".tabs button[data-tab='notes'].active"));

  const d4 = load("#sample/transcript");
  const input = d4.querySelector("#t-search");
  input.value = "overfitting";
  input.dispatchEvent(new d4.defaultView.Event("input", { bubbles: true }));
  console.log("search marks:", d4.querySelectorAll("mark").length);
  if (d4.querySelectorAll("mark").length < 1) throw new Error("search did not highlight");

  console.log("\nALL DOM FLOW CHECKS PASSED");
}
run().catch(e => { console.error("FAIL:", e.message); process.exit(1); });
