/* Live AI path — direct browser calls to the Gemini API.
   No key is bundled. The key comes from Settings (localStorage only) and is
   sent only to generativelanguage.googleapis.com.
   Default model verified 23 Nov 2026 (ai.google.dev models page + Google
   deprecation note 2 Nov 2026): gemini-2.5-flash (GA); Google routes it to
   gemini-3.5-flash-lite from 1 Dec 2026. Settings also offers
   gemini-3.5-flash-lite and gemini-3.8-flash (both listed stable). */
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-3.5-flash-lite", "gemini-3.8-flash"];
const DEFAULT_MODEL = "gemini-2.5-flash";

function geminiKey() { return (localStorage.getItem("ll_api_key") || "").trim(); }
function geminiModel() { return localStorage.getItem("ll_model") || DEFAULT_MODEL; }

async function geminiGenerate(prompt, schema) {
  const key = geminiKey();
  if (!key) throw new Error("NO_KEY");
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.2 }
  };
  const res = await fetch(`${GEMINI_BASE}/models/${encodeURIComponent(geminiModel())}:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  if (!res.ok) {
    let msg = `Gemini returned ${res.status}.`;
    if (res.status === 429) msg = "Gemini returned 429 — free-tier quota reached. Wait a minute and try again.";
    if (res.status === 400) msg = "Gemini returned 400 — the request was rejected. Check the model chosen in Settings.";
    if (res.status === 403) msg = "Gemini returned 403 — the API key is not accepted. Check it in Settings.";
    throw new Error(msg);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
  if (!text) throw new Error("Gemini returned an empty reply. Try again.");
  return text;
}

async function geminiGenerateJson(prompt, schema) {
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await geminiGenerate(attempt === 0 ? prompt : prompt + "\n\nReturn ONLY valid JSON, no markdown fences, no extra text.", schema);
      return JSON.parse(text);
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

async function geminiTestKey() {
  const key = geminiKey();
  if (!key) return { ok: false, message: "No key saved yet." };
  try {
    const res = await fetch(`${GEMINI_BASE}/models/${encodeURIComponent(geminiModel())}:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: "Reply with the single word: ok" }] }] })
    });
    if (!res.ok) return { ok: false, message: `Key test failed: Gemini returned ${res.status}. Check the key and model in Settings.` };
    return { ok: true, message: `Key works with ${geminiModel()}.` };
  } catch (e) {
    return { ok: false, message: "Key test failed: could not reach Google. Check your connection and try again." };
  }
}

/* Upload an audio/video file to the Gemini Files API and wait until ACTIVE. */
async function geminiUploadFile(file, onStage) {
  const key = geminiKey();
  if (!key) throw new Error("NO_KEY");
  onStage && onStage("Uploading file to Gemini…");
  const res = await fetch(`${GEMINI_BASE}/files?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "X-Goog-Upload-Protocol": "raw", "Content-Type": file.type || "application/octet-stream" },
    body: file
  });
  if (!res.ok) throw new Error(`Upload failed — Gemini returned ${res.status}.`);
  const meta = await res.json();
  const fileObj = meta.file || meta;
  for (let i = 0; i < 30; i++) {
    const st = await fetch(`${GEMINI_BASE}/${fileObj.name}?key=${encodeURIComponent(key)}`);
    const cur = await st.json();
    const f = cur.file || cur;
    if (f.state === "ACTIVE") return f;
    if (f.state === "FAILED") throw new Error("Gemini could not process this file. Try a shorter clip or a different format.");
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error("Gemini is still processing the file after a minute. Try again.");
}

async function geminiTranscribeFile(fileObj, onStage) {
  onStage && onStage("Transcribing…");
  const prompt = "Transcribe this lecture word for word. Return JSON only: " +
    "{\"segments\": [{\"startSec\": <seconds from start, integer>, \"text\": \"...\"}]}. " +
    "Split into segments of roughly 60–90 seconds each, keeping the speaker's words. " +
    "startSec must be the approximate time the segment starts. Do not summarise, do not add anything not said.";
  const schema = { type: "OBJECT", properties: { segments: { type: "ARRAY", items: { type: "OBJECT", properties: { startSec: { type: "INTEGER" }, text: { type: "STRING" } }, required: ["startSec", "text"] } } }, required: ["segments"] };
  const key = geminiKey();
  const res = await fetch(`${GEMINI_BASE}/models/${encodeURIComponent(geminiModel())}:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ fileData: { mimeType: fileObj.mimeType, fileUri: fileObj.uri } }, { text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.1 }
    })
  });
  if (!res.ok) throw new Error(`Transcription failed — Gemini returned ${res.status}.`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
  const parsed = JSON.parse(text);
  return (parsed.segments || []).filter(s => s.text && s.text.trim()).map((s, i) => ({ startSec: Math.max(0, Math.round(s.startSec || 0)), text: s.text.trim() }));
}

function transcriptPlain(transcript) {
  return transcript.map(s => `[${fmtTime(s.startSec)}] ${s.text}`).join("\n");
}

/* One structured call per artefact, each validated by the caller. */
async function geminiMakeArtefacts(transcript, durationSec, onStage) {
  const plain = transcriptPlain(transcript);
  const base = `You are turning a lecture transcript into study material. Use ONLY facts stated in the transcript. Do not invent examples, numbers, or definitions that are not in it. If the transcript is short, say so in fewer items rather than padding. Every section and node must carry a startSec that falls inside the transcript (0 to ${durationSec}).\n\nTRANSCRIPT:\n${plain}`;

  onStage && onStage("Writing notes…");
  const notes = await geminiGenerateJson(base + `\n\nReturn JSON only: {"summary": "one or two sentences", "sections": [{"id": "s1", "heading": "...", "startSec": 0, "endSec": 120, "points": ["..."], "definitions": [{"term": "...", "meaning": "..."}]}]}. Use 4 to 6 sections. Each section: 3 to 5 short points and 0 to 3 definitions.`,
    { type: "OBJECT", properties: { summary: { type: "STRING" }, sections: { type: "ARRAY", items: { type: "OBJECT", properties: { id: { type: "STRING" }, heading: { type: "STRING" }, startSec: { type: "INTEGER" }, endSec: { type: "INTEGER" }, points: { type: "ARRAY", items: { type: "STRING" } }, definitions: { type: "ARRAY", items: { type: "OBJECT", properties: { term: { type: "STRING" }, meaning: { type: "STRING" } }, required: ["term", "meaning"] } } }, required: ["id", "heading", "startSec", "endSec", "points"] } } }, required: ["summary", "sections"] });

  onStage && onStage("Making flashcards…");
  const cards = await geminiGenerateJson(base + `\n\nReturn JSON only: {"cards": [{"front": "question", "back": "answer"}]}. Make 20 flashcards. Fronts are short questions, backs are answers of one to three sentences, both drawn only from the transcript.`,
    { type: "OBJECT", properties: { cards: { type: "ARRAY", items: { type: "OBJECT", properties: { front: { type: "STRING" }, back: { type: "STRING" } }, required: ["front", "back"] } } }, required: ["cards"] });

  onStage && onStage("Building quiz…");
  const quiz = await geminiGenerateJson(base + `\n\nReturn JSON only: {"questions": [{"question": "...", "options": ["...", "...", "...", "..."], "correctIndex": 0, "explanation": "one sentence", "sourceSec": 0}]}. Make 10 multiple-choice questions with exactly 4 options each and exactly one correct answer. Vary which position is correct. Each explanation is one sentence. sourceSec is the timestamp the question comes from.`,
    { type: "OBJECT", properties: { questions: { type: "ARRAY", items: { type: "OBJECT", properties: { question: { type: "STRING" }, options: { type: "ARRAY", items: { type: "STRING" } }, correctIndex: { type: "INTEGER" }, explanation: { type: "STRING" }, sourceSec: { type: "INTEGER" } }, required: ["question", "options", "correctIndex", "explanation", "sourceSec"] } } }, required: ["questions"] });

  onStage && onStage("Drawing mind map…");
  const map = await geminiGenerateJson(base + `\n\nReturn JSON only: {"tree": {"label": "lecture title", "startSec": 0, "children": [{"label": "...", "startSec": 0, "children": [{"label": "...", "startSec": 0, "children": []}]}]}}. The tree has at most 25 nodes total and at most 3 levels below the root. Labels are short (2 to 6 words). Each node carries the startSec of the part of the lecture it comes from.`,
    { type: "OBJECT", properties: { tree: { type: "OBJECT", properties: { label: { type: "STRING" }, startSec: { type: "INTEGER" }, children: { type: "ARRAY", items: { type: "OBJECT", properties: { label: { type: "STRING" }, startSec: { type: "INTEGER" }, children: { type: "ARRAY", items: { type: "OBJECT", properties: { label: { type: "STRING" }, startSec: { type: "INTEGER" }, children: { type: "ARRAY", items: {} } }, required: ["label", "startSec", "children"] } } }, required: ["label", "startSec", "children"] } } }, required: ["label", "startSec", "children"] } }, required: ["tree"] });

  return { notes, cards: cards.cards || [], quiz: quiz.questions || [], tree: map.tree };
}
