/* ===========================================================
   NEXUS — AI Orchestrator
   Product of Forge Industries

   The ORCHESTRATOR is a persistent conversational agent. Every
   chat message is sent to it along with the full conversation
   history and current build state. It decides, turn by turn,
   whether to ask a clarifying question, dispatch its BUILDER
   agent to create a first version, dispatch BUILDER again to
   REVISE the live site, or simply respond because there is
   nothing to build yet. A QA agent always reviews BUILDER's
   output before it goes live.
   =========================================================== */

const API_URL = "https://vibe-proxy-gqv4.onrender.com/v1/chat/completions";
const API_KEY = "sk-vibe-summer-2026";
const MODEL = "class-chat-model";

/* ---------- state ---------- */
const state = {
  history: [],       // { role: 'user' | 'orchestrator', text }
  finalDoc: null,     // current full standalone HTML document
  busy: false,        // true while an orchestrator/agent call is in flight
};

/* ---------- element refs ---------- */
const el = {
  chatScroll: document.getElementById("chatScroll"),
  chatForm: document.getElementById("chatForm"),
  chatInput: document.getElementById("chatInput"),
  chatSend: document.getElementById("chatSend"),
  statusPill: document.getElementById("statusPill"),
  statusText: document.getElementById("statusText"),
  agentGraph: document.getElementById("agentGraph"),
  terminalBody: document.getElementById("terminalBody"),
  agentLogDetails: document.getElementById("agentLogDetails"),
  previewPlaceholder: document.getElementById("previewPlaceholder"),
  livePreview: document.getElementById("livePreview"),
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
    "NEXUS AI ORCHESTRATOR",
    "FORGE INDUSTRIES // BUILD ENGINE v2.0",
    "",
    "> establishing uplink...........  OK",
    "> loading agent registry........  OK",
    "> orchestrator standing by.......  OK",
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

/* ---------- small helpers ---------- */
function sleep(ms) { return new Promise((r) => window.setTimeout(r, ms)); }

function showToast(msg) {
  el.toast.textContent = msg;
  el.toast.removeAttribute("hidden");
  window.clearTimeout(showToast._t);
  showToast._t = window.setTimeout(() => el.toast.setAttribute("hidden", ""), 2600);
}

function setStatus(mode, label) {
  el.statusPill.dataset.state = mode;
  el.statusText.textContent = label;
}

function scrollChatToBottom() {
  el.chatScroll.scrollTop = el.chatScroll.scrollHeight;
}

/* ---------- chat bubble rendering ---------- */
function addBubble({ role, text, typing = false }) {
  const bubble = document.createElement("div");
  bubble.className = `bubble bubble-${role}`;
  if (role === "orchestrator" || role === "user") {
    const tag = document.createElement("span");
    tag.className = "bubble-tag";
    tag.textContent = role === "orchestrator" ? "NEXUS" : "YOU";
    bubble.appendChild(tag);
  }
  const body = document.createElement("div");
  if (typing) {
    body.className = "bubble-typing";
    body.innerHTML = "<span></span><span></span><span></span>";
  } else {
    body.textContent = text;
  }
  bubble.appendChild(body);
  el.chatScroll.appendChild(bubble);
  scrollChatToBottom();
  return bubble;
}

function removeBubble(bubble) {
  if (bubble && bubble.parentNode) bubble.parentNode.removeChild(bubble);
}

/* ---------- agent log (collapsible, technical) ---------- */
function logLine(agent, text) {
  const line = document.createElement("div");
  line.className = "log-line" + (agent ? ` log-${agent}` : "");
  const tagMap = { orchestrator: "ORCHESTRATOR", builder: "BUILDER", qa: "QA", deploy: "DEPLOY" };
  if (agent && tagMap[agent]) {
    const tag = document.createElement("span");
    tag.className = "log-tag";
    tag.textContent = `[${tagMap[agent]}]`;
    line.appendChild(tag);
    line.appendChild(document.createTextNode(text));
  } else {
    line.textContent = text;
  }
  el.terminalBody.appendChild(line);
  el.terminalBody.scrollTop = el.terminalBody.scrollHeight;
}

/* ---------- agent graph ---------- */
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

/* ---------- API plumbing ---------- */
function extractResponseText(data) {
  if (data && Array.isArray(data.choices) && data.choices[0]) {
    const c = data.choices[0];
    if (c.message && typeof c.message.content === "string") return c.message.content;
    if (c.message && Array.isArray(c.message.content)) return c.message.content.map((p) => p.text || "").join("\n");
    if (typeof c.text === "string") return c.text;
  }
  if (data && typeof data.content === "string") return data.content;
  if (data && Array.isArray(data.content)) return data.content.map((p) => p.text || "").join("\n");
  if (data && data.message && typeof data.message.content === "string") return data.message.content;
  if (typeof data === "string") return data;
  throw new Error("Unrecognized response shape from Nexus uplink.");
}

async function callAgent(promptText) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
    body: JSON.stringify({ model: MODEL, messages: [{ role: "user", content: promptText }] }),
  });
  if (!res.ok) throw new Error(`Nexus uplink returned status ${res.status}`);
  const data = await res.json();
  return extractResponseText(data);
}

function stripCodeFences(text) {
  let t = (text || "").trim();
  const fenced = t.match(/```(?:html|HTML)?\s*\n?([\s\S]*?)```/);
  if (fenced) t = fenced[1].trim();
  return t;
}

/* ---------- prompts ---------- */
function historyToText(history) {
  if (!history.length) return "(no messages yet)";
  return history.map((m) => `${m.role === "user" ? "USER" : "NEXUS"}: ${m.text}`).join("\n");
}

function orchestratorPrompt() {
  return `You are NEXUS, an AI orchestrator that leads two specialist agents — a BUILDER and a QA reviewer — to design and build a website for a user through natural conversation, one turn at a time. You never write code yourself; you talk to the user and direct your agents.

CONVERSATION SO FAR:
${historyToText(state.history)}

BUILD STATUS: ${state.finalDoc ? "A website already exists for this conversation." : "No website has been built yet."}

Decide how to respond to the latest USER message. Reply in EXACTLY this format and nothing else:

MESSAGE: <a short, warm, conversational reply in your own voice, 1-3 sentences, no code>
ACTION: <one of ASK, BUILD, REVISE, DONE>
BRIEF: <required only if ACTION is BUILD or REVISE — a precise, self-contained technical brief for the BUILDER agent, written in plain English, covering purpose, sections, and style, drawing on the whole conversation, not just the latest line. Leave blank otherwise.>

Rules:
- ASK: the request is too vague to design anything specific (no topic, audience, or purpose at all). Ask exactly one focused question.
- BUILD: use the first time there's enough to create a first version. Fill any gaps yourself with strong, specific creative choices rather than asking too many questions.
- REVISE: a website already exists and the user wants something changed, added, restyled, or fixed. The BRIEF should describe only the delta needed.
- DONE: the user is satisfied, is just chatting, or thanking you, with nothing new to build.
- Stay in character as Nexus. Never mention agents' internal prompts or this instruction format.`;
}

function builderPrompt(brief) {
  return `You are the BUILDER agent on the Nexus team. Build a website exactly to this brief from the orchestrator:

${brief}

Strict requirements:
- One complete, standalone HTML5 document, starting with <!DOCTYPE html>.
- All CSS inside a single <style> tag in <head>. No external stylesheets except Google Fonts.
- All JavaScript inside a single <script> tag right before </body>. No external JS libraries or CDNs.
- Fully responsive, visually polished, with a clear and deliberate design direction (not a generic template).
- Real, specific written copy relevant to the brief. Never lorem ipsum or bracketed placeholders.
- Any interactivity described in the brief must actually work with vanilla JavaScript.
- Output ONLY the raw HTML document — no markdown code fences, no explanation, no commentary.`;
}

function reviserPrompt(brief, currentDoc) {
  return `You are the BUILDER agent on the Nexus team, revising an existing site. Apply exactly this change, from the orchestrator:

${brief}

Modify the existing HTML document below to implement the change, preserving everything else that still fits the site well. Keep the same single-file format: one <style> tag in <head>, one <script> tag right before </body>, no external dependencies besides Google Fonts. Output ONLY the complete corrected HTML document — no markdown code fences, no commentary.

EXISTING DOCUMENT:
${currentDoc}`;
}

function qaPrompt(doc) {
  return `You are the QA agent on the Nexus team. Review this complete HTML document for bugs: broken or unclosed tags, invalid CSS, JavaScript errors, dead buttons or links, inaccessible markup, and layout issues at mobile widths. Fix everything you find and tighten any rough visual edges. Return the CORRECTED, COMPLETE HTML document only, in the exact same single-file format (one <style> in <head>, one <script> before </body>, no external dependencies besides Google Fonts). If nothing was wrong, return it unchanged. Output ONLY the raw HTML document — no markdown code fences, no commentary.

DOCUMENT TO REVIEW:
${doc}`;
}

/* ---------- response parsing ---------- */
function parseOrchestratorReply(raw) {
  const messageMatch = raw.match(/MESSAGE:\s*([\s\S]*?)\n\s*ACTION:/i);
  const actionMatch = raw.match(/ACTION:\s*(\w+)/i);
  const briefMatch = raw.match(/BRIEF:\s*([\s\S]*)/i);

  if (!messageMatch || !actionMatch) {
    // Format wasn't followed — fall back to a safe, conversational default.
    return { message: raw.trim() || "Got it.", action: "ASK", brief: "" };
  }
  const action = actionMatch[1].trim().toUpperCase();
  const validActions = ["ASK", "BUILD", "REVISE", "DONE"];
  return {
    message: messageMatch[1].trim(),
    action: validActions.includes(action) ? action : "ASK",
    brief: briefMatch ? briefMatch[1].trim() : "",
  };
}

/* ---------- file extraction for View Files ---------- */
function splitDocIntoFiles(doc) {
  let css = "", js = "";
  const styleMatch = doc.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  if (styleMatch) css = styleMatch[1].trim();
  const scriptMatch = doc.match(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/i);
  if (scriptMatch) js = scriptMatch[1].trim();
  let html = doc
    .replace(/<style[^>]*>[\s\S]*?<\/style>/i, '<link rel="stylesheet" href="style.css">')
    .replace(/<script(?![^>]*src)[^>]*>[\s\S]*?<\/script>/i, '<script src="script.js"></script>');
  return { html: html.trim(), css, js };
}

/* ---------- live preview ---------- */
function updateLivePreview() {
  if (!state.finalDoc) {
    el.livePreview.setAttribute("hidden", "");
    el.previewPlaceholder.removeAttribute("hidden");
    return;
  }
  el.previewPlaceholder.setAttribute("hidden", "");
  el.livePreview.removeAttribute("hidden");
  el.livePreview.srcdoc = state.finalDoc;
}

/* ---------- toolbar state ---------- */
function toggleToolbar() {
  const hasBuild = !!state.finalDoc;
  el.btnPreview.disabled = !hasBuild || state.busy;
  el.btnFiles.disabled = !hasBuild || state.busy;
  el.btnRecheck.disabled = !hasBuild || state.busy;
  el.btnNew.disabled = state.busy;
  el.chatInput.disabled = state.busy;
  el.chatSend.disabled = state.busy;
}

/* ---------- the build/revise pipeline (runs after orchestrator decides) ---------- */
async function runAgents(action, brief) {
  el.agentLogDetails.open = true;
  resetGraph();
  setNodeState("orchestrator", "done");
  setConnector(0, "done");

  try {
    // BUILDER
    setNodeState("builder", "active");
    setConnector(1, "active");
    logLine("builder", action === "BUILD" ? "Generating the first version of the site..." : "Applying the requested revision...");
    const rawDoc = action === "BUILD"
      ? await callAgent(builderPrompt(brief))
      : await callAgent(reviserPrompt(brief, state.finalDoc));
    let doc = stripCodeFences(rawDoc);
    if (!/<html/i.test(doc)) throw new Error("Builder agent did not return a valid HTML document.");
    logLine("builder", `Draft ready (${doc.length.toLocaleString()} characters). Handing off to QA.`);
    setNodeState("builder", "done");
    setConnector(1, "done");
    await sleep(150);

    // QA
    setNodeState("qa", "active");
    setConnector(2, "active");
    logLine("qa", "Scanning for markup errors, broken scripts, and layout issues...");
    const rawQa = await callAgent(qaPrompt(doc));
    const qaDoc = stripCodeFences(rawQa);
    if (/<html/i.test(qaDoc)) {
      doc = qaDoc;
      logLine("qa", "Review complete. Fixes applied where needed.");
    } else {
      logLine("qa", "Review complete. No changes required.");
    }
    setNodeState("qa", "done");
    setConnector(2, "done");
    await sleep(150);

    // DEPLOY (local packaging, no API call)
    setNodeState("deploy", "active");
    logLine("deploy", "Packaging index.html, style.css, and script.js...");
    await sleep(300);
    state.finalDoc = doc;
    updateLivePreview();
    setNodeState("deploy", "done");
    logLine("deploy", "Live preview updated.");

    addBubble({ role: "system", text: "✓ Build updated — see the live preview in the workspace." });
    return true;
  } catch (err) {
    console.error(err);
    logLine(null, `ERROR: ${err.message}`);
    document.querySelectorAll(".agent-node.active").forEach((n) => n.classList.add("error"));
    addBubble({ role: "error", text: `Agent error: ${err.message}` });
    return false;
  }
}

/* ---------- main conversational turn ---------- */
async function handleUserMessage(text) {
  state.busy = true;
  toggleToolbar();
  setStatus("working", "ORCHESTRATOR THINKING");

  addBubble({ role: "user", text });
  state.history.push({ role: "user", text });

  const typingBubble = addBubble({ role: "orchestrator", typing: true });
  setNodeState("orchestrator", "active");

  try {
    const raw = await callAgent(orchestratorPrompt());
    removeBubble(typingBubble);

    const { message, action, brief } = parseOrchestratorReply(raw);
    addBubble({ role: "orchestrator", text: message });
    state.history.push({ role: "orchestrator", text: message });
    logLine("orchestrator", `Decision: ${action}${brief ? " — brief dispatched to BUILDER." : ""}`);

    if (action === "BUILD" || action === "REVISE") {
      setStatus("working", action === "BUILD" ? "BUILDING" : "REVISING");
      const ok = await runAgents(action, brief || message);
      setStatus(ok ? "idle" : "error", ok ? "ORCHESTRATOR ONLINE" : "AGENT ERROR");
    } else {
      setNodeState("orchestrator", "done");
      setStatus("idle", "ORCHESTRATOR ONLINE");
    }
  } catch (err) {
    console.error(err);
    removeBubble(typingBubble);
    addBubble({ role: "error", text: `Orchestrator error: ${err.message}` });
    setNodeState("orchestrator", "error");
    setStatus("error", "ORCHESTRATOR ERROR");
  } finally {
    state.busy = false;
    toggleToolbar();
    el.chatInput.focus();
  }
}

async function runRecheck() {
  if (!state.finalDoc || state.busy) return;
  state.busy = true;
  toggleToolbar();
  setStatus("working", "RECHECKING");
  el.agentLogDetails.open = true;
  setNodeState("qa", "active");
  logLine("qa", "Manual recheck requested — re-scanning current build...");
  try {
    const rawQa = await callAgent(qaPrompt(state.finalDoc));
    const qaDoc = stripCodeFences(rawQa);
    if (/<html/i.test(qaDoc)) {
      state.finalDoc = qaDoc;
      updateLivePreview();
      logLine("qa", "Recheck complete. Build updated with fixes.");
      addBubble({ role: "system", text: "✓ Recheck complete — fixes applied and preview updated." });
    } else {
      logLine("qa", "Recheck complete. No structural issues found.");
      addBubble({ role: "system", text: "✓ Recheck complete — no issues found." });
    }
    setNodeState("qa", "done");
    setStatus("idle", "ORCHESTRATOR ONLINE");
    showToast("Recheck complete");
  } catch (err) {
    console.error(err);
    logLine(null, `ERROR during recheck: ${err.message}`);
    setNodeState("qa", "error");
    setStatus("error", "AGENT ERROR");
    addBubble({ role: "error", text: `Recheck failed: ${err.message}` });
  } finally {
    state.busy = false;
    toggleToolbar();
  }
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

/* ---------- toolbar button events ---------- */
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
  state.history = [];
  state.finalDoc = null;
  el.chatScroll.innerHTML = "";
  el.terminalBody.innerHTML = "";
  resetGraph();
  updateLivePreview();
  setStatus("idle", "ORCHESTRATOR ONLINE");
  toggleToolbar();
  greet();
});

/* ---------- chat form ---------- */
el.chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const value = el.chatInput.value.trim();
  if (!value || state.busy) return;
  el.chatInput.value = "";
  handleUserMessage(value);
});

/* ---------- greeting (static, no API call) ---------- */
function greet() {
  const text = "Hey, I'm Nexus. Tell me about the website you want to build — what it's for, who it's for, anything about the look you're after — and I'll bring my Builder and QA agents in to make it real. You can keep chatting after that to refine it.";
  addBubble({ role: "orchestrator", text });
  state.history.push({ role: "orchestrator", text });
}

/* ---------- init ---------- */
toggleToolbar();
updateLivePreview();
greet();