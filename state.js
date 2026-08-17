/* ===========================================================
   NEXUS — state layer
   Central app state + persistence. No DOM rendering here —
   render.js reads from `state`, orchestrator.js mutates it.
   =========================================================== */

const RECENT_BUILDS_KEY = 'nexus_recent_builds_v1';
const MAX_RECENT_BUILDS = 8;

const state = {
  tasks: [],
  outputs: {},      // { agentId: rawTextFromAgent }
  brief: '',
  name: '',
  type: '',
  previewHtml: '',
  running: false,
};

function resetState(){
  state.tasks = [];
  state.outputs = {};
  state.brief = '';
  state.name = '';
  state.type = '';
  state.previewHtml = '';
  state.running = false;
}

/* ---- persistence ----
   Wrapped in try/catch: localStorage can throw (privacy mode,
   sandboxed iframes, storage disabled) — persistence degrades
   gracefully to "no history" rather than crashing the app. */
function loadRecentBuilds(){
  try{
    const raw = localStorage.getItem(RECENT_BUILDS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  }catch(e){
    return [];
  }
}

function saveRecentBuild(entry){
  try{
    const list = loadRecentBuilds();
    list.unshift(entry);
    const trimmed = list.slice(0, MAX_RECENT_BUILDS);
    localStorage.setItem(RECENT_BUILDS_KEY, JSON.stringify(trimmed));
    return trimmed;
  }catch(e){
    return null; // storage unavailable — caller should treat as a no-op
  }
}

function clearRecentBuilds(){
  try{
    localStorage.removeItem(RECENT_BUILDS_KEY);
    return true;
  }catch(e){
    return false;
  }
}

/* The live preview is generated after the build is already saved to
   history (it's a separate manual step), so backfill it into the
   matching entry once it exists rather than re-saving a duplicate. */
function updateLatestHistoryPreview(name, type, html){
  try{
    const list = loadRecentBuilds();
    if(list.length && list[0].name === name && list[0].type === type){
      list[0].previewHtml = html;
      localStorage.setItem(RECENT_BUILDS_KEY, JSON.stringify(list));
      return true;
    }
  }catch(e){}
  return false;
}

/* ---- validation ----
   Returns { valid: bool, errors: { fieldId: message } } */
function validateProjectForm(nameValue, briefValue){
  const errors = {};
  if(!nameValue || !nameValue.trim()){
    errors['proj-name'] = 'Project name is required.';
  }
  if(!briefValue || !briefValue.trim()){
    errors['proj-brief'] = 'Describe what the site needs to do.';
  } else if(briefValue.trim().length < 20){
    errors['proj-brief'] = 'Brief is too short — give the agents more to work with (20+ characters).';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}