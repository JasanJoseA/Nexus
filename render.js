/* ===========================================================
   NEXUS — render layer
   Pure(ish) view functions: read `state`/DOM inputs, write DOM.
   No fetch calls, no business rules beyond simple formatting.
   =========================================================== */

/* ---------------- feature grid ---------------- */
function buildFeatureGrid(){
  const fg = document.getElementById('feature-grid');
  fg.innerHTML = FEATURES.map(f => `
    <label class="feature-chip" data-feat="${f.id}">
      <span class="box"></span>
      <input type="checkbox" id="feat-${f.id}" data-id="${f.id}">
      <span>${f.label}</span>
    </label>
  `).join('');

  fg.querySelectorAll('.feature-chip').forEach(chip=>{
    chip.addEventListener('click', ()=>{
      setTimeout(()=>{
        const cb = chip.querySelector('input');
        chip.classList.toggle('checked', cb.checked);
      }, 0);
    });
  });

  ['payments','seo'].forEach(id=>{
    const cb = document.getElementById('feat-'+id);
    if(!cb) return;
    cb.checked = true;
    cb.closest('.feature-chip').classList.add('checked');
  });
}

function selectedFeatures(){
  return FEATURES.filter(f => document.getElementById('feat-'+f.id)?.checked).map(f => f.label);
}
function selectedFeatureIds(){
  return FEATURES.filter(f => document.getElementById('feat-'+f.id)?.checked).map(f => f.id);
}

/* ---------------- form validation UI ---------------- */
function showFieldError(fieldId, message){
  const input = document.getElementById(fieldId);
  const wrap = input?.closest('.field');
  if(!wrap) return;
  wrap.classList.add('invalid');
  let err = wrap.querySelector('.field-error');
  if(!err){
    err = document.createElement('div');
    err.className = 'field-error';
    wrap.appendChild(err);
  }
  err.textContent = message;
}
function clearFieldErrors(){
  document.querySelectorAll('.field.invalid').forEach(el => el.classList.remove('invalid'));
}

/* ---------------- network diagram ---------------- */
function buildNetwork(){
  const svg = document.getElementById('net-svg');
  // Single left-to-right row: NEXUS sits far left, agents fan out in
  // AGENTS order so the last two (content, qa) land on the right edge.
  const cx = 70, cy = 78;
  const startX = 300, stepX = 148, nodeY = 78;
  let html = '';
  AGENTS.forEach((a,i)=>{
    const x = startX + i*stepX;
    html += `<line class="link" id="link-${a.id}" x1="${cx}" y1="${cy}" x2="${x}" y2="${nodeY}" stroke="${a.color}"/>`;
  });
  html += `<circle cx="${cx}" cy="${cy}" r="26" fill="#070a14" stroke="var(--cyan)" stroke-width="1.5" filter="drop-shadow(0 0 6px rgba(0,255,242,.6))"/>`;
  html += `<text x="${cx}" y="${cy+4}" text-anchor="middle" class="core-label">NEXUS</text>`;
  AGENTS.forEach((a,i)=>{
    const x = startX + i*stepX;
    html += `<circle class="node-ring" id="node-${a.id}" cx="${x}" cy="${nodeY}" r="17" fill="#070a14" stroke="${a.color}" stroke-width="1.2" opacity="0.55"/>`;
    html += `<text x="${x}" y="${nodeY+4}" text-anchor="middle" font-family="Orbitron" font-size="10" fill="${a.color}">${a.symbol}</text>`;
    html += `<text x="${x}" y="${nodeY+32}" text-anchor="middle" class="node-label">${a.name}</text>`;
  });
  svg.innerHTML = html;
}
function setNetworkActive(agentId, on){
  const link = document.getElementById('link-'+agentId);
  const node = document.getElementById('node-'+agentId);
  if(link) link.classList.toggle('active', on);
  if(node) node.style.opacity = on ? '1' : '0.55';
}

/* ---------------- agent roster ---------------- */
function buildRoster(){
  const rosterEl = document.getElementById('roster-cards');
  rosterEl.innerHTML = AGENTS.map(a=>`
    <div class="agent-card" id="agent-${a.id}" style="--ac:${a.color}">
      <div class="agent-top">
        <div class="agent-icon">${a.symbol}</div>
        <div>
          <div class="agent-name">${a.name}</div>
          <div class="agent-role">${a.role}</div>
        </div>
        <div class="agent-state" id="state-${a.id}">IDLE</div>
      </div>
      <div class="agent-tagline">"${a.tagline}"</div>
      <div class="agent-bar"><i id="bar-${a.id}"></i></div>
      <div class="agent-task" id="task-${a.id}"></div>
      <button class="view-output" id="btn-${a.id}">View Output ▾</button>
      <button class="retry-btn" id="retry-${a.id}" data-agent="${a.id}">↺ Retry</button>
      <div class="output-box" id="out-${a.id}"></div>
    </div>
  `).join('');

  AGENTS.forEach(a=>{
    document.getElementById('btn-'+a.id).addEventListener('click', ()=>{
      const box = document.getElementById('out-'+a.id);
      box.classList.toggle('show');
      document.getElementById('btn-'+a.id).textContent = box.classList.contains('show') ? 'Hide Output ▴' : 'View Output ▾';
    });
  });
}

function setAgentWorking(agent, taskLabels){
  const card = document.getElementById('agent-'+agent.id);
  const stateEl = document.getElementById('state-'+agent.id);
  const taskEl = document.getElementById('task-'+agent.id);
  card.classList.remove('error'); card.classList.add('active');
  stateEl.textContent = 'WORKING';
  stateEl.className = 'agent-state working';
  taskEl.textContent = taskLabels.map(l=>'· '+l).join('\n');
  setNetworkActive(agent.id, true);
}

function setAgentDone(agent, output){
  const card = document.getElementById('agent-'+agent.id);
  const stateEl = document.getElementById('state-'+agent.id);
  document.getElementById('bar-'+agent.id).style.width = '100%';
  document.getElementById('out-'+agent.id).innerHTML = mdToHtml(output);
  stateEl.textContent = 'DONE';
  stateEl.className = 'agent-state done';
  card.classList.remove('active','error'); card.classList.add('done');
  setNetworkActive(agent.id, false);
}

function setAgentError(agent, message){
  const card = document.getElementById('agent-'+agent.id);
  const stateEl = document.getElementById('state-'+agent.id);
  stateEl.textContent = 'ERROR';
  stateEl.className = 'agent-state error';
  document.getElementById('out-'+agent.id).innerHTML = `<p style="color:var(--red)">This agent could not complete its task:<br><code>${escapeHtml(message)}</code></p>`;
  document.getElementById('btn-'+agent.id).style.display = 'inline-block';
  card.classList.remove('active'); card.classList.add('done','error');
  setNetworkActive(agent.id, false);
}

function escapeHtml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ---------------- terminal log ---------------- */
function log(text, cls){
  const termBody = document.getElementById('term-body');
  const d = document.createElement('div');
  const t = new Date().toLocaleTimeString('en-US',{hour12:false});
  d.className = cls || 't-sys';
  d.innerHTML = `<span style="color:#3d4664">[${t}]</span> ${text}`;
  termBody.appendChild(d);
  termBody.scrollTop = termBody.scrollHeight;
}
function clearLog(){
  document.getElementById('term-body').innerHTML = '';
}

/* ---------------- kanban ---------------- */
function taskCardHtml(t){
  return `<div class="task-card" id="tc-${t.id}" style="--ac:${t.color}"><div>${t.label}</div><div class="t-agent">${t.agentName}</div></div>`;
}
function renderBacklog(tasks){
  ['backlog','active','review','done'].forEach(c=>{
    document.querySelector(`.kcol[data-col="${c}"] .kbody`).innerHTML = '';
  });
  document.querySelector('.kcol[data-col="backlog"] .kbody').innerHTML = tasks.map(taskCardHtml).join('');
  updateCounts();
}
function moveTask(taskId, col){
  const card = document.getElementById('tc-'+taskId);
  const target = document.querySelector(`.kcol[data-col="${col}"] .kbody`);
  if(card && target) target.appendChild(card);
  updateCounts();
}
function updateCounts(){
  ['backlog','active','review','done'].forEach(c=>{
    const n = document.querySelectorAll(`.kcol[data-col="${c}"] .task-card`).length;
    document.getElementById('c-'+c).textContent = n;
  });
}

/* ---------------- tiny markdown renderer ---------------- */
function mdToHtml(md){
  let html = md.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (m,lang,code)=>`<pre><code>${code}</code></pre>`);
  html = html.replace(/^### (.*)$/gm,'<h3>$1</h3>').replace(/^## (.*)$/gm,'<h2>$1</h2>').replace(/^# (.*)$/gm,'<h1>$1</h1>');
  html = html.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>');
  html = html.replace(/^(?:- |\* )(.*)$/gm,'<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, m => '<ul>'+m+'</ul>').replace(/<\/ul>\s*<ul>/g,'');
  html = html.split(/\n{2,}/).map(block=>{
    if(/^\s*<(h1|h2|h3|ul|pre)/.test(block.trim())) return block;
    if(block.trim()==='') return '';
    return '<p>'+block.trim().replace(/\n/g,'<br>')+'</p>';
  }).join('\n');
  return html;
}

/* ---------------- summary ---------------- */
function showSummary(name, type, tasks, features){
  document.getElementById('summary').style.display = 'block';
  document.getElementById('summary-sub').textContent = `${name} — ${type}. ${tasks.length} tasks completed across ${AGENTS.length} agents.`;
  document.getElementById('stat-row').innerHTML = `
    <div class="stat"><b>${tasks.length}</b><span>Tasks Shipped</span></div>
    <div class="stat"><b>${AGENTS.length}</b><span>Agents Deployed</span></div>
    <div class="stat"><b>${features.length}</b><span>Capabilities</span></div>
    <div class="stat"><b>100%</b><span>Pipeline Cleared</span></div>
  `;
  const slug = slugify(name);
  document.getElementById('filetree').innerHTML =
`<span class="d">${slug}/</span>
├── <span class="f">README.md</span>
├── <span class="d">src/</span>
│   ├── <span class="d">components/</span>
│   ├── <span class="d">pages/</span>
│   ├── <span class="d">styles/</span>
│   └── <span class="f">App.jsx</span>
├── <span class="d">api/</span>
│   ├── <span class="d">routes/</span>
│   └── <span class="d">models/</span>
├── <span class="d">content/</span>
│   └── <span class="f">homepage-copy.md</span>
├── <span class="d">qa/</span>
│   └── <span class="f">launch-checklist.md</span>
└── <span class="f">package.json</span>`;
}
function slugify(name){
  return (name||'project').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || 'project';
}

/* ---------------- files panel ---------------- */
let activeFileIdx = 0;

function extractCodeBlock(raw, lang){
  if(!raw) return null;
  if(lang){
    const specific = raw.match(new RegExp('```'+lang+'\\n([\\s\\S]*?)```', 'i'));
    if(specific) return specific[1].trim();
  }
  const m = raw.match(/```[a-zA-Z]*\n([\s\S]*?)```/);
  return m ? m[1].trim() : null;
}

/* buildManifest() reads the live build; buildManifest(entry) builds the
   same file set from a saved history entry — same shape as `state` but
   plain data, so both the live "View Files" and history "View Files"
   share one code path. */
function buildManifest(source){
  const src = source || {
    name: state.name, type: state.type,
    brief: document.getElementById('proj-brief').value,
    features: selectedFeatures(),
    outputs: state.outputs, previewHtml: state.previewHtml,
  };
  const feat = src.features || [];
  const readme = `# ${src.name || 'Untitled Project'}

${src.type || ''}

## Brief
${src.brief || ''}

## Capabilities
${feat.length ? feat.map(f=>'- '+f).join('\n') : '- none specified'}

## Generated by
NEXUS Orchestrator — Architect, Designer, Frontend, Backend, Content, and QA agents.
See architecture.md, styles/tokens.css, design-system.md, homepage-copy.md, api-design.md, qa-checklist.md and index.html in this file set.`;

  const outputs = src.outputs || {};
  const cssTokens = extractCodeBlock(outputs.designer, 'css');

  const files = [
    { name:'README.md', content: readme },
    { name:'index.html', content: src.previewHtml || '// Not generated yet — click "Run Project" first, then reopen this panel.' },
    { name:'architecture.md', content: outputs.architect || '// Run a build first.' },
    { name:'styles/tokens.css', content: cssTokens || '/* Run a build first — the Designer agent generates real CSS custom properties here. */' },
    { name:'design-system.md', content: outputs.designer || '// Run a build first.' },
  ];
  const snippet = extractCodeBlock(outputs.frontend);
  files.push({ name:'component.jsx', content: snippet || outputs.frontend || '// Run a build first.' });
  files.push({ name:'api-design.md', content: outputs.backend || '// Run a build first.' });
  files.push({ name:'homepage-copy.md', content: outputs.content || '// Run a build first.' });
  files.push({ name:'qa-checklist.md', content: outputs.qa || '// Run a build first.' });
  return files;
}

let currentFiles = [];

function openFilesModal(title, files){
  currentFiles = files;
  activeFileIdx = 0;
  document.getElementById('files-modal-title').textContent = title;
  document.getElementById('files-modal').classList.add('show');
  renderFilesTabs();
}
function closeFilesModal(){
  document.getElementById('files-modal').classList.remove('show');
}
function renderFilesTabs(){
  const tabs = document.getElementById('files-tabs');
  tabs.innerHTML = currentFiles.map((f,i)=>`<button class="file-tab${i===activeFileIdx?' active':''}" data-i="${i}">${f.name}</button>`).join('');
  tabs.querySelectorAll('.file-tab').forEach(btn=>{
    btn.addEventListener('click', ()=>{ activeFileIdx = parseInt(btn.dataset.i,10); renderFileTab(); });
  });
  renderFileTab();
}
function renderFileTab(){
  const f = currentFiles[activeFileIdx] || currentFiles[0];
  if(!f) return;
  document.querySelectorAll('#files-tabs .file-tab').forEach((t,i)=> t.classList.toggle('active', i===activeFileIdx));
  document.getElementById('files-filename').textContent = f.name;
  document.getElementById('files-content').textContent = f.content;
}

/* ---------------- project history ---------------- */
function formatSavedAt(iso){
  try{
    const d = new Date(iso);
    return d.toLocaleDateString(undefined,{month:'short',day:'numeric'}) + ' · ' + d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
  }catch(e){ return ''; }
}

function renderHistory(){
  const block = document.getElementById('history-block');
  const list = loadRecentBuilds();
  if(!list.length){ block.style.display = 'none'; return; }
  block.style.display = 'block';
  const listEl = document.getElementById('history-list');
  listEl.innerHTML = list.map((b,i)=>`
    <div class="history-item">
      <div class="history-item-meta">
        <span class="history-item-name">${escapeHtml(b.name)}</span>
        <span class="history-item-sub">${escapeHtml(b.type)} · ${formatSavedAt(b.savedAt)}</span>
      </div>
      <div class="history-item-actions">
        <button type="button" class="btn btn--ghost btn--sm" data-action="load" data-i="${i}">Load Brief</button>
        <button type="button" class="btn btn--ghost btn--sm" data-action="view" data-i="${i}">View Files</button>
      </div>
    </div>
  `).join('');
}