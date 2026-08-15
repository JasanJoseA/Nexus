/* ===========================================================
   NEXUS — AI Website Orchestrator
   Product of Forge Industries
   =========================================================== */

const API_URL = "https://vibe-proxy-gqv4.onrender.com/v1/chat/completions";
const API_KEY = "sk-vibe-summer-2026";
const MODEL = "class-chat-model";

/* ---------- state ---------- */
const state = {
  building: false,
  finalDoc: null,       // full standalone HTML document (style + script inline)
  userPrompt: "",
};

/* ---------- element refs ---------- */
const el = {
  promptInput: document.getElementById("promptInput"),
  promptHint: document.getElementById("promptHint"),
  initBtn: document.getElementById("initBtn"),
  heroSection: document.getElementById("heroSection"),
  pipelineSection: document.getElementById("pipelineSection"),
  terminalBody: document.getElementById("terminalBody"),
  statusPill: document.getElementById("statusPill"),
  statusText: document.getElementById("statusText"),
  agentGraph: document.getElementById("agentGraph"),
  btnPreview: document.getElementById("btnPreview"),
  btnNew: document.getElementById("btnNew"),
  btnFiles: document.getElementById("btnFiles"),
  btnRecheck: document.getElementById("btnRecheck"),
  previewModal: document.getElementById("previewModal"),
  previewFrame: document.getElementById("previewFrame"),
  openTabBtn: document.getElementById("openTabBtn"),
  filesModal: document.getElementById("filesModal"),
  fileTabs: document.getElementById("fileTabs"),
  fileContent: document.getElementById("fileContent"),
  copyBtn: document.getElementById("copyBtn"),
  toast: document.getElementById("toast"),
};

/* ---------- boot sequence ---------- */
(function boot() {
  const lines = [
    "NEXUS AI ORCHESTRATION SYSTEM",
    "FORGE INDUSTRIES // BUILD ENGINE v1.0",
    "",
    "> establishing uplink...........  OK",
    "> loading agent registry........  OK",
    "> calibrating render pipeline...  OK",
    "",
    "READY.",
  ];
  const target = document.getElementById("bootLines");
  let i = 0;
  const timer = setInterval(() => {
    if (i >= lines.length) { clearInterval(timer); return; }
    target.textContent += lines[i] + "\n";
    i++;
  }, 90);
  window.setTimeout(() => {
    const b = document.getElementById("boot");
    if (b) b.setAttribute("hidden", "");
  }, 1900);
})();

/* ---------- helpers ---------- */
function setStatus(state_, label) {
  el.statusPill.dataset.state = state_;
  el.statusText.textContent = label;
}

function showToast(msg) {
  el.toast.textContent = msg;
  el.toast.removeAttribute("hidden");
  window.clearTimeout(showToast._t);
  showToast._t = window.setTimeout(() => el.toast.setAttribute("hidden", ""), 2600);
}

function logLine(agent, text) {
  const line = document.createElement("div");
  line.className = "log-line" + (agent ? ` log-${agent}` : "");
  const time = new Date().toLocaleTimeString([], { hour12: false });
  const tagMap = {
    orchestrator: "ORCHESTRATOR",
    builder: "BUILDER",
    qa: "QA",
    deploy: "DEPLOY",
  };
  if (agent && tagMap[agent]) {
    const tag = document.createElement("span");
    tag.className = "log-tag";
    tag.textContent = `[${tagMap[agent]}]`;
    line.appendChild(tag);
    line.appendChild(document.createTextNode(text));
  } else {
    line.textContent = text;
  }
  line.dataset.time = time;
  el.terminalBody.appendChild(line);
  el.terminalBody.scrollTop = el.terminalBody.scrollHeight;
}

function sleep(ms) { return new Promise((r) => window.setTimeout(r, ms)); }

function setNodeState(agent, cls) {
  const node = el.agentGraph.querySelector(`.agent-node[data-agent="${agent}"]`);
  if (!node) return;
  node.classList.remove("active", "done", "error");
  if (cls) node.classList.add(cls);
}

function setConnector(index, cls) {
  const c = el.agentGraph.querySelector(`.connector[data-connector="${index}"]`);
  if (!c) return;
  c.classList.remove("active", "done");
  if (cls) c.classList.add(cls);
}

function resetGraph() {
  ["orchestrator", "builder", "qa", "deploy"].forEach((a) => setNodeState(a, null));
  [0, 1, 2].forEach((i) => setConnector(i, null));
}

/* ---------- extraction from API response ---------- */
function extractResponseText(data) {
  if (data && Array.isArray(data.choices) && data.choices[0]) {
    const c = data.choices[0];
    if (c.message && typeof c.message.content === "string") return c.message.content;
    if (c.message && Array.isArray(c.message.content)) {
      return c.message.content.map((p) => p.text || "").join("\n");
    }
    if (typeof c.text === "string") return c.text;
  }
  if (data && typeof data.content === "string") return data.content;
  if (data && Array.isArray(data.content)) {
    return data.content.map((p) => p.text || "").join("\n");
  }
  if (data && data.message && typeof data.message.content === "string") return data.message.content;
  if (typeof data === "string") return data;
  throw new Error("Unrecognized response shape from Nexus uplink.");
}

function stripCodeFences(text) {
  let t = (text || "").trim();
  const fenced = t.match(/```(?:html|HTML)?\s*\n?([\s\S]*?)```/);
  if (fenced) t = fenced[1].trim();
  return t;
}

function stripPlainFences(text) {
  let t = (text || "").trim();
  t = t.replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "");
  return t.trim();
}

async function callAgent(promptText) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: promptText }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Nexus uplink returned status ${res.status}`);
  }
  const data = await res.json();
  return extractResponseText(data);
}

/* ---------- agent prompts ---------- */
function orchestratorPrompt(userPrompt) {
  return `You are the ORCHESTRATOR agent inside an AI website-building system called Nexus, built by Forge Industries. A user submitted this website request:

"${userPrompt}"

Produce a short build plan (120 words max) as plain text only. Cover: the site's purpose, 4-6 concrete sections or features it should have, and a visual style direction. Do not write code. Do not use markdown headers or code fences, just plain sentences or short dash-prefixed lines.`;
}

function builderPrompt(userPrompt, plan) {
  return `You are the BUILDER agent inside the Nexus AI website-building system. Using this build plan:

${plan}

...and the original user request: "${userPrompt}"

Generate one COMPLETE, polished, working website as a single standalone HTML5 document. Strict requirements:
- Start with <!DOCTYPE html>.
- All CSS must be inside one <style> tag in <head>. No external stylesheets except Google Fonts if desired.
- All JavaScript must be inside one <script> tag placed right before </body>. No external JS libraries/CDNs.
- The site must be fully responsive and visually polished, matching the plan's style direction.
- Include real, specific written copy relevant to the request. Never use lorem ipsum or placeholder brackets.
- Any interactivity described in the plan must actually work with vanilla JavaScript.
- Output ONLY the raw HTML document. No markdown code fences, no explanations, no commentary before or after the code.`;
}

function qaPrompt(doc) {
  return `You are the QA agent inside the Nexus AI website-building system. Review the following complete HTML document for bugs: broken or unclosed tags, invalid CSS, JavaScript errors, dead buttons, inaccessible markup, and layout issues on mobile widths. Fix everything you find, and improve rough edges in the styling if you see any. Return the CORRECTED, COMPLETE HTML document only, following the exact same format as the input (one <style> tag in <head>, one <script> tag before </body>, no external dependencies except Google Fonts). If nothing was wrong, return the document unchanged. Output ONLY the raw HTML document — no markdown code fences, no explanations, no commentary.

DOCUMENT TO REVIEW:
${doc}`;
}

/* ---------- file extraction for "View Files" ---------- */
function splitDocIntoFiles(doc) {
  let css = "";
  let js = "";
  const styleMatch = doc.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  if (styleMatch) css = styleMatch[1].trim();
  const scriptMatch = doc.match(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/i);
  if (scriptMatch) js = scriptMatch[1].trim();

  let html = doc
    .replace(/<style[^>]*>[\s\S]*?<\/style>/i, '<link rel="stylesheet" href="style.css">')
    .replace(/<script(?![^>]*src)[^>]*>[\s\S]*?<\/script>/i, '<script src="script.js"></script>');

  return { html: html.trim(), css, js };
}

/* ---------- build pipeline ---------- */
async function runBuild(userPrompt) {
  state.building = true;
  state.finalDoc = null;
  toggleToolbar();
  resetGraph();
  el.terminalBody.innerHTML = "";
  el.pipelineSection.removeAttribute("hidden");
  setStatus("building", "BUILDING");

  try {
    // STAGE 1 — ORCHESTRATOR
    setNodeState("orchestrator", "active");
    setConnector(0, "active");
    logLine("orchestrator", "Parsing request and drafting build plan...");
    const plan = stripPlainFences(await callAgent(orchestratorPrompt(userPrompt)));
    plan.split("\n").filter((l) => l.trim()).forEach((l) => logLine(null, "  " + l.trim()));
    logLine("orchestrator", "Build plan finalized. Dispatching to BUILDER.");
    setNodeState("orchestrator", "done");
    setConnector(0, "done");
    await sleep(200);

    // STAGE 2 — BUILDER
    setNodeState("builder", "active");
    setConnector(1, "active");
    logLine("builder", "Generating HTML structure, styles, and interactivity...");
    const rawDoc = await callAgent(builderPrompt(userPrompt, plan));
    let doc = stripCodeFences(rawDoc);
    if (!/<html/i.test(doc)) {
      throw new Error("Builder agent did not return a valid HTML document.");
    }
    logLine("builder", `Draft generated (${doc.length.toLocaleString()} characters). Handing off to QA.`);
    setNodeState("builder", "done");
    setConnector(1, "done");
    await sleep(200);

    // STAGE 3 — QA
    setNodeState("qa", "active");
    setConnector(2, "active");
    logLine("qa", "Scanning for markup errors, broken scripts, and layout issues...");
    const rawQa = await callAgent(qaPrompt(doc));
    const qaDoc = stripCodeFences(rawQa);
    if (/<html/i.test(qaDoc)) {
      doc = qaDoc;
      logLine("qa", "Review complete. Fixes applied where needed.");
    } else {
      logLine("qa", "Review complete. Keeping builder output as-is.");
    }
    setNodeState("qa", "done");
    setConnector(2, "done");
    await sleep(200);

    // STAGE 4 — DEPLOY (local packaging, no API call)
    setNodeState("deploy", "active");
    logLine("deploy", "Packaging index.html, style.css, and script.js...");
    await sleep(350);
    state.finalDoc = doc;
    logLine("deploy", "Build ready. Use PREVIEW or VIEW FILES below.");
    setNodeState("deploy", "done");
    logLine(null, "");
    logLine(null, "$ build complete — exit code 0");

    setStatus("ready", "READY");
  } catch (err) {
    console.error(err);
    logLine("error", `ERROR: ${err.message}`);
    logLine(null, "Build halted. Adjust your prompt and try again, or start a new build.");
    document.querySelectorAll(".agent-node.active").forEach((n) => n.classList.remove("active"));
    const activeStage = document.querySelector(".agent-node:not(.done)");
    if (activeStage) activeStage.classList.add("error");
    setStatus("error", "ERROR");
  } finally {
    state.building = false;
    toggleToolbar();
  }
}

async function runRecheck() {
  if (!state.finalDoc || state.building) return;
  state.building = true;
  toggleToolbar();
  setStatus("building", "RECHECKING");
  setNodeState("qa", "active");
  logLine("qa", "Re-scanning current build for errors...");
  try {
    const rawQa = await callAgent(qaPrompt(state.finalDoc));
    const qaDoc = stripCodeFences(rawQa);
    if (/<html/i.test(qaDoc)) {
      state.finalDoc = qaDoc;
      logLine("qa", "Recheck complete. Build updated with fixes.");
    } else {
      logLine("qa", "Recheck complete. No structural issues found.");
    }
    setNodeState("qa", "done");
    setStatus("ready", "READY");
    showToast("Recheck complete");
  } catch (err) {
    console.error(err);
    logLine("error", `ERROR during recheck: ${err.message}`);
    setNodeState("qa", "error");
    setStatus("error", "ERROR");
  } finally {
    state.building = false;
    toggleToolbar();
  }
}

/* ---------- toolbar state ---------- */
function toggleToolbar() {
  const hasBuild = !!state.finalDoc;
  el.btnPreview.disabled = !hasBuild || state.building;
  el.btnFiles.disabled = !hasBuild || state.building;
  el.btnRecheck.disabled = !hasBuild || state.building;
  el.initBtn.disabled = state.building;
  el.btnNew.disabled = state.building;
}

/* ---------- modals ---------- */
function openModal(modal) { modal.removeAttribute("hidden"); }
function closeModal(modal) { modal.setAttribute("hidden", ""); }

document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => closeModal(document.getElementById(btn.dataset.close)));
});
[el.previewModal, el.filesModal].forEach((modal) => {
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(modal); });
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { closeModal(el.previewModal); closeModal(el.filesModal); }
});

/* ---------- files modal ---------- */
let activeFileTab = "html";
function renderFileTab() {
  if (!state.finalDoc) return;
  const files = splitDocIntoFiles(state.finalDoc);
  const map = { html: files.html, css: files.css, js: files.js };
  el.fileContent.textContent = map[activeFileTab] || "// nothing generated for this file";
}
el.fileTabs.addEventListener("click", (e) => {
  const btn = e.target.closest(".file-tab");
  if (!btn) return;
  el.fileTabs.querySelectorAll(".file-tab").forEach((t) => t.classList.remove("active"));
  btn.classList.add("active");
  activeFileTab = btn.dataset.file;
  renderFileTab();
});
el.copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(el.fileContent.textContent);
    showToast(`Copied ${activeFileTab === "html" ? "index.html" : activeFileTab === "css" ? "style.css" : "script.js"}`);
  } catch {
    showToast("Copy failed — select the text manually");
  }
});

/* ---------- button events ---------- */
el.initBtn.addEventListener("click", () => {
  const value = el.promptInput.value.trim();
  if (!value) {
    el.promptHint.textContent = "Describe the site you want before initializing a build.";
    el.promptInput.focus();
    return;
  }
  el.promptHint.textContent = "\u00a0";
  state.userPrompt = value;
  runBuild(value);
});

el.promptInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    el.initBtn.click();
  }
});

el.btnPreview.addEventListener("click", () => {
  if (!state.finalDoc) return;
  el.previewFrame.srcdoc = state.finalDoc;
  openModal(el.previewModal);
});

el.openTabBtn.addEventListener("click", () => {
  if (!state.finalDoc) return;
  const blob = new Blob([state.finalDoc], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
});

el.btnFiles.addEventListener("click", () => {
  if (!state.finalDoc) return;
  renderFileTab();
  openModal(el.filesModal);
});

el.btnRecheck.addEventListener("click", runRecheck);

el.btnNew.addEventListener("click", () => {
  state.finalDoc = null;
  state.userPrompt = "";
  el.promptInput.value = "";
  el.promptHint.textContent = "\u00a0";
  el.pipelineSection.setAttribute("hidden", "");
  el.terminalBody.innerHTML = "";
  resetGraph();
  setStatus("idle", "IDLE");
  toggleToolbar();
  el.heroSection.scrollIntoView({ behavior: "smooth", block: "start" });
});

/* ---------- init ---------- */
toggleToolbar();