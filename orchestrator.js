/* ===========================================================
   NEXUS — orchestrator layer
   Business logic: turns a validated brief into tasks, runs each
   agent against the real API, drives the pipeline UI, generates
   a live preview, and exports a real downloadable project.
   =========================================================== */

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
function pickLine(lines){ return lines[Math.floor(Math.random()*lines.length)]; }

/* ---------------- task generation ---------------- */
function buildTasks(selectedIds){
  const byAgent = {};
  AGENTS.forEach(a => byAgent[a.id] = [a.baseTask]);
  selectedIds.forEach(fid=>{
    (FEATURE_TASKS[fid]||[]).forEach(t => byAgent[t.agent].push(t.label));
  });
  byAgent.qa.push('Accessibility & performance pass');
  byAgent.frontend.push('Responsive layout polish');

  const tasks = [];
  let id = 0;
  AGENTS.forEach(a=>{
    byAgent[a.id].forEach(label=>{
      id++;
      tasks.push({ id:'t'+id, agent:a.id, agentName:a.name, color:a.color, label });
    });
  });
  return tasks;
}

/* ---------------- single-agent execution (shared by initial run + retry) ---------------- */
async function runSingleAgent(agent, myTasks){
  setAgentWorking(agent, myTasks.map(t=>t.label));
  myTasks.forEach(t => moveTask(t.id, 'active'));
  log(`<span class="t-tag">[${agent.name}]</span> ${pickLine(agent.startLines)} <span style="color:#3d4664">(${myTasks.length} task${myTasks.length===1?'':'s'})</span>`, 't-warn');

  const bar = document.getElementById('bar-'+agent.id);
  let p = 0;
  const tick = setInterval(()=>{ p = Math.min(92, p + Math.random()*14); bar.style.width = p+'%'; }, 260);

  try{
    const output = await callAgent(agent, state.brief);
    clearInterval(tick);
    state.outputs[agent.id] = output;
    setAgentDone(agent, output);
    myTasks.forEach(t => moveTask(t.id, 'review'));
    log(`<span class="t-tag">[${agent.name}]</span> <span class="t-ok">${pickLine(agent.doneLines)}</span>`, 't-sys');
    await sleep(350);
    myTasks.forEach(t => moveTask(t.id, 'done'));
    return true;
  }catch(err){
    clearInterval(tick);
    const message = err.message || 'request failed';
    setAgentError(agent, message);
    log(`<span class="t-tag">[${agent.name}]</span> <span class="t-err">error: ${escapeHtml(message)}</span>`, 't-err');
    myTasks.forEach(t => moveTask(t.id, 'done'));
    return false;
  }
}

/* ---------------- full orchestration run ---------------- */
async function runBuild(){
  if(state.running) return;

  const nameInput = document.getElementById('proj-name');
  const briefInput = document.getElementById('proj-brief');
  const { valid, errors } = validateProjectForm(nameInput.value, briefInput.value);
  clearFieldErrors();
  if(!valid){
    Object.entries(errors).forEach(([fieldId, message]) => showFieldError(fieldId, message));
    document.getElementById(Object.keys(errors)[0]).focus();
    return;
  }

  state.running = true;

  const name = nameInput.value.trim();
  const type = document.getElementById('proj-type').value;
  const briefText = briefInput.value.trim();
  const features = selectedFeatures();
  const featureIds = selectedFeatureIds();

  resetState();
  state.running = true;
  state.brief = `Project: ${name}\nSite type: ${type}\nBrief: ${briefText}\nRequested capabilities: ${features.length ? features.join(', ') : 'none specified beyond the brief'}.`;
  state.name = name;
  state.type = type;

  document.getElementById('setup').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  document.getElementById('status-dot').classList.add('live');
  document.getElementById('status-text').textContent = 'ORCHESTRATION ACTIVE';

  const tasks = buildTasks(featureIds);
  state.tasks = tasks;
  renderBacklog(tasks);

  log(`Build initialized for <span class="t-tag">${escapeHtml(name)}</span> (${escapeHtml(type)})`, 't-sys');
  log(`${tasks.length} tasks generated across ${AGENTS.length} agents`, 't-sys');
  log(`Dispatching agents sequentially...`, 't-sys');

  let failures = 0;
  for(const agent of AGENTS){
    const myTasks = tasks.filter(t => t.agent === agent.id);
    const ok = await runSingleAgent(agent, myTasks);
    if(!ok) failures++;
  }

  log(`All agents reporting. Compiling manifest...`, 't-sys');
  await sleep(400);
  showSummary(name, type, tasks, features);
  document.getElementById('status-text').textContent = failures ? `BUILD COMPLETE — ${failures} agent(s) need retry` : 'BUILD COMPLETE';
  document.getElementById('status-dot').classList.remove('live');
  state.running = false;

  const saved = saveRecentBuild({
    name, type, brief: briefText,
    features, savedAt: new Date().toISOString()
  });
  if(saved === null){
    log(`<span class="t-warn">Recent-build history unavailable (local storage blocked in this environment) — this run won't be saved for next time.</span>`, 't-warn');
  }
}

/* ---------------- per-agent retry ---------------- */
async function retryAgent(agentId){
  if(state.running) return;
  const agent = AGENTS.find(a => a.id === agentId);
  if(!agent) return;
  const myTasks = state.tasks.filter(t => t.agent === agentId);
  const btn = document.getElementById('retry-'+agentId);
  if(btn) btn.disabled = true;
  await runSingleAgent(agent, myTasks);
  if(btn) btn.disabled = false;
}

/* ---------------- live preview ---------------- */
function extractHtml(raw){
  let s = raw.trim();
  const fence = s.match(/```(?:html)?\n([\s\S]*?)```/i);
  if(fence) s = fence[1].trim();
  const startMatch = s.match(/<!DOCTYPE[\s\S]*?>|<html[\s>]/i);
  if(startMatch){
    const start = s.indexOf(startMatch[0]);
    if(start > 0) s = s.slice(start);
  }
  const endIdx = s.toLowerCase().lastIndexOf('</html>');
  if(endIdx !== -1) s = s.slice(0, endIdx + 7);
  return s.trim();
}

/* Convert a full HTML document string into markup safe to drop into a
   shadow root (strip the outer doctype/html/head/body wrapper tags but
   keep everything inside them — style/link/content — in place). */
function toShadowMarkup(html){
  return html
    .replace(/<!DOCTYPE[^>]*>/i, '')
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<\/?head[^>]*>/gi, '')
    .replace(/<\/?body[^>]*>/gi, '')
    .replace(/<meta[^>]*>/gi, '')
    .trim();
}

async function runPreview(){
  const btn = document.getElementById('run-preview-btn');
  const frameWrap = document.getElementById('browser-frame');
  const loading = document.getElementById('preview-loading');
  const loadingText = document.getElementById('preview-loading-text');
  const host = document.getElementById('preview-frame');
  const urlBar = document.getElementById('browser-url');

  btn.disabled = true;
  btn.textContent = '● Compiling...';
  frameWrap.classList.add('show');
  loading.style.display = 'flex';
  host.style.display = 'none';

  const msgs = ['Compiling build...','Bundling components...','Applying design tokens...','Rendering homepage...'];
  let mi = 0;
  const cycle = setInterval(()=>{ mi = (mi+1)%msgs.length; loadingText.textContent = msgs[mi]; }, 900);

  const context = `${state.brief}

--- ARCHITECT OUTPUT ---
${state.outputs.architect || 'n/a'}

--- DESIGNER OUTPUT ---
${state.outputs.designer || 'n/a'}

--- CONTENT OUTPUT ---
${state.outputs.content || 'n/a'}`;

  try{
    const raw = await callChatAPI(PREVIEW_SYSTEM, context);
    if(!raw.trim()) throw new Error('empty response from preview agent');
    const html = extractHtml(raw);
    state.previewHtml = html;

    clearInterval(cycle);
    if(!host.shadowRoot) host.attachShadow({mode:'open'});
    host.shadowRoot.innerHTML = toShadowMarkup(html);
    loading.style.display = 'none';
    host.style.display = 'block';
    urlBar.textContent = `localhost:3000/${slugify(state.name)}`;
    log(`<span class="t-tag">[PREVIEW]</span> <span class="t-ok">live build rendered ✓</span>`, 't-sys');
    btn.textContent = '↺ Rebuild Preview';
    if(document.getElementById('files-panel').classList.contains('show')) buildFilesPanel();
  }catch(err){
    clearInterval(cycle);
    loadingText.textContent = 'Preview failed — click Run Project to retry.';
    log(`<span class="t-tag">[PREVIEW]</span> <span class="t-err">error: ${escapeHtml(err.message||'request failed')}</span>`, 't-err');
    btn.textContent = '▶ Run Project';
  }
  btn.disabled = false;
}

/* ---------------- real project export (.zip) ----------------
   Requires JSZip (loaded via CDN in index.html). If it failed to
   load — offline, blocked script — this degrades to a clear error
   instead of silently doing nothing. */
async function downloadProjectZip(){
  const btn = document.getElementById('download-zip-btn');
  if(typeof JSZip === 'undefined'){
    log(`<span class="t-err">Download failed — JSZip did not load (check your network connection).</span>`, 't-err');
    return;
  }
  const files = buildManifest();
  const zip = new JSZip();
  files.forEach(f => zip.file(f.name, f.content));

  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = '● Zipping...';
  try{
    const blob = await zip.generateAsync({ type:'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slugify(state.name)}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(()=> URL.revokeObjectURL(url), 4000);
    log(`<span class="t-tag">[EXPORT]</span> <span class="t-ok">project.zip downloaded (${files.length} files)</span>`, 't-sys');
  }catch(err){
    log(`<span class="t-err">Zip export failed: ${escapeHtml(err.message||'unknown error')}</span>`, 't-err');
  }
  btn.disabled = false;
  btn.textContent = original;
}