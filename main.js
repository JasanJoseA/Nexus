/* ===========================================================
   NEXUS — entry point
   Initializes the UI and wires every event listener. Depends on
   data.js, state.js, api.js, render.js, orchestrator.js having
   already loaded (see index.html script order).
   =========================================================== */

function initApp(){
  buildFeatureGrid();
  buildNetwork();
  buildRoster();
  renderRecentBuilds();

  document.getElementById('deploy-btn').addEventListener('click', ()=>{
    document.getElementById('deploy-btn').disabled = true;
    runBuild().finally(()=>{ document.getElementById('deploy-btn').disabled = false; });
  });

  document.getElementById('run-preview-btn').addEventListener('click', runPreview);

  document.getElementById('view-files-btn').addEventListener('click', ()=>{
    const panel = document.getElementById('files-panel');
    panel.classList.toggle('show');
    if(panel.classList.contains('show')){ activeFileIdx = 0; buildFilesPanel(); }
  });

  document.getElementById('download-zip-btn').addEventListener('click', downloadProjectZip);

  document.getElementById('copy-file-btn').addEventListener('click', ()=>{
    const text = document.getElementById('files-content').textContent;
    const btn = document.getElementById('copy-file-btn');
    const done = ()=>{ btn.textContent = 'Copied ✓'; setTimeout(()=> btn.textContent = 'Copy File', 1400); };
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(done).catch(()=> fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  });

  // event delegation for per-agent retry buttons (roster is rebuilt on reset)
  document.getElementById('roster-cards').addEventListener('click', (e)=>{
    const btn = e.target.closest('.retry-btn');
    if(!btn) return;
    retryAgent(btn.dataset.agent);
  });

  document.getElementById('reset-btn').addEventListener('click', handleReset);
}

function fallbackCopy(text, cb){
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.focus(); ta.select();
  try{ document.execCommand('copy'); }catch(e){}
  document.body.removeChild(ta);
  cb();
}

function handleReset(){
  document.getElementById('summary').style.display = 'none';
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('setup').style.display = 'block';
  document.getElementById('status-dot').classList.remove('live');
  document.getElementById('status-text').textContent = 'SYSTEM IDLE';
  clearLog();
  clearFieldErrors();
  buildRoster();
  renderRecentBuilds();

  resetState();

  const host = document.getElementById('preview-frame');
  if(host.shadowRoot) host.shadowRoot.innerHTML = '';
  document.getElementById('browser-frame').classList.remove('show');
  host.style.display = 'none';
  document.getElementById('preview-loading').style.display = 'flex';
  document.getElementById('preview-loading-text').textContent = 'Compiling build...';
  document.getElementById('browser-url').textContent = 'localhost:3000';
  document.getElementById('run-preview-btn').textContent = '▶ Run Project';
  document.getElementById('run-preview-btn').disabled = false;

  document.getElementById('files-panel').classList.remove('show');
  document.getElementById('files-tabs').innerHTML = '';
  document.getElementById('files-content').textContent = '';
  document.getElementById('files-filename').textContent = '—';
  activeFileIdx = 0;
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}