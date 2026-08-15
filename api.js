/* ===========================================================
   NEXUS — API layer
   The only file that talks to the network. Throws Errors with
   diagnostic detail (status code / raw body snippet) instead of
   generic messages, so failures are actually debuggable.
   =========================================================== */

const API_URL = "https://vibe-proxy-gqv4.onrender.com/v1/chat/completions";
const API_HEADERS = { "Content-Type": "application/json", "Authorization": "Bearer sk-vibe-summer-2026" };
const API_MODEL = "class-chat-model";

async function callChatAPI(systemPrompt, userContent){
  // The proxy's documented request shape only shows a single "user"
  // message — no confirmed "system" role support — so agent
  // instructions are folded into the one user message instead of a
  // separate system message.
  const combined = systemPrompt
    ? `${systemPrompt}\n\n---\n\n${userContent}`
    : userContent;

  let response;
  try{
    response = await fetch(API_URL, {
      method: "POST",
      headers: API_HEADERS,
      body: JSON.stringify({
        model: API_MODEL,
        messages: [{ role:"user", content: combined }]
      })
    });
  }catch(networkErr){
    // fetch() throws TypeError before any response exists — this is a
    // network-level failure (CSP block, DNS, offline, CORS), not an
    // API error. Surface that distinction to the caller.
    throw new Error(`Network request failed — the endpoint could not be reached (${networkErr.message}).`);
  }

  let raw = '';
  try{ raw = await response.text(); }catch(e){}

  if(!response.ok){
    throw new Error(`HTTP ${response.status}${raw ? ' — '+raw.slice(0,220) : ''}`);
  }

  let data;
  try{ data = JSON.parse(raw); }
  catch(e){ throw new Error(`Non-JSON response: ${raw.slice(0,220)}`); }

  if(data && data.error){
    throw new Error(typeof data.error === 'string' ? data.error : (data.error.message || JSON.stringify(data.error)));
  }

  const text =
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.text ??
    data?.choices?.[0]?.delta?.content ??
    (Array.isArray(data?.content) ? data.content.map(b=>b.text||'').join('\n') : null) ??
    (typeof data?.content === 'string' ? data.content : null) ??
    data?.message?.content ??
    data?.response ??
    data?.result ??
    data?.output ??
    null;

  if(!text || !String(text).trim()){
    throw new Error(`No content in response. Raw: ${raw.slice(0,220)}`);
  }
  return String(text);
}

async function callAgent(agent, brief){
  return callChatAPI(agent.system, brief);
}