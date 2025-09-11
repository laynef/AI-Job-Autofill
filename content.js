// content.js — v2.0 (must answer EVERYTHING)
(function(){
  const DBG = false;
  const N_A = "N/A";
  const normalize = s => (s||"").toString().replace(/\s+/g," ").trim().toLowerCase();
  function scoreMatch(needle, hay){
    needle = normalize(needle); hay = normalize(hay);
    if(!needle || !hay) return 0;
    if(needle === hay) return 1;
    if(hay.includes(needle)) return Math.max(0.6, Math.min(0.95, needle.length/(hay.length+0.0001)));
    const ns = new Set(needle.split(" ")); const hs = new Set(hay.split(" "));
    let inter = 0; for(const t of ns) if(hs.has(t)) inter++; return inter / Math.max(1, ns.size);
  }
  function setNativeValue(el, value){
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(el, value); else el.value = value;
  }
  const fire = (el, type)=>{ try{ el.dispatchEvent(new Event(type,{bubbles:true})); }catch{} };
  function synthClick(el){ try{ const r=el.getBoundingClientRect(); ["pointerdown","mousedown","mouseup","pointerup","click"].forEach(evt=>el.dispatchEvent(new MouseEvent(evt,{bubbles:true,cancelable:true,clientX:r.left+3,clientY:r.top+3}))); }catch{ try{ el.click(); }catch{} } }
  function parseDateLike(v){ if(!v) return null; const d=new Date(v); if(!isNaN(d.getTime())){ const yyyy=d.getFullYear(), mm=String(d.getMonth()+1).padStart(2,"0"), dd=String(d.getDate()).padStart(2,"0"); return `${yyyy}-${mm}-${dd}`; } return null; }
  function getHints(el){
    const hints=[]; const add=(s,tag)=>{ if(s && normalize(s)) hints.push({text:s,tag}); };
    if(el.id){ const lbl=document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if(lbl) add(lbl.innerText||lbl.textContent,"label-for"); }
    let p=el.parentElement, hops=0; while(p && hops<3){ if((p.tagName||"").toLowerCase()==="label"){ add(p.innerText||p.textContent,"label-parent"); break; } p=p.parentElement; hops++; }
    add(el.getAttribute("aria-label"),"aria-label");
    add(el.getAttribute("aria-labelledby"),"aria-labelledby");
    add(el.getAttribute("placeholder"),"placeholder");
    if(el.previousElementSibling){ const s=el.previousElementSibling.innerText||el.previousElementSibling.textContent; add(s,"prev-sibling"); }
    let cur=el; for(let i=0;i<4 && cur;i++){ const txt=(cur.innerText||cur.textContent||"").trim(); const first=txt.split("\n").map(x=>x.trim()).filter(Boolean)[0]; if(first && first.length>3 && first.length<200) add(first,"ancestor"); cur=cur.parentElement; }
    add(el.name,"name"); add(el.id,"id");
    for(const a of el.getAttributeNames?.()||[]){ if(a.startsWith("data-")) add(el.getAttribute(a),a); }
    return hints;
  }
  const keyMap = {
    firstName:["first name","given name","forename"], lastName:["last name","surname","family name"], fullName:["full name","name (first and last)","contact name","your name"],
    email:["email","e-mail","email address"], phone:["phone","mobile","tel","telephone","cell"], city:["city","town"], state:["state","province","region"], country:["country"], zip:["zip","zipcode","postal code","postcode"],
    address:["address","street address","address line"], linkedin:["linkedin","linkedin url","linkedin profile"], website:["website","portfolio","personal site","url"], github:["github","github url","github profile"],
    gender:["gender","sex"], race:["race","ethnicity"], veteranStatus:["veteran","veteran status"], disabilityStatus:["disability","disability status"],
    desiredSalary:["salary","pay","compensation"], relocation:["relocation","willing to relocate"], sponsorship:["sponsorship","visa","work authorization"],
    startDate:["start date","availability","available start"], graduationDate:["graduation","grad date"], university:["university","college","school"], degree:["degree","education level"], major:["major","field of study"], gpa:["gpa","grade point average"],
    coverLetter:["cover letter","motivation","why us","statement"], workAuthorization:["work authorization","authorized to work","work permit"], remotePreference:["remote","on-site","hybrid","work location"],
    likertPreference:["agree","disagree","likert","scale"], starRating:["rate","rating","stars"]
  };
  function pickProfileValue(hints, profile){
    const cands=[]; for(const [key,syns] of Object.entries(keyMap)){ const val=profile[key]; if(!val) continue; for(const h of hints){ for(const s of [key,...syns]){ const sc=scoreMatch(s,h.text); if(sc>=0.45) cands.push({key,val,score:sc+(h.tag?.includes("label")?0.05:0)}); } } }
    for(const h of hints){ const k=normalize(h.text).replace(/[^a-z]/g,""); if(profile[k]) cands.push({key:k,val:profile[k],score:0.95}); }
    if(!cands.length) return null; cands.sort((a,b)=>b.score-a.score); return cands[0];
  }
  function bestTextMatch(els, value){ const v=normalize(value); let best=null,bestScore=0; for(const el of els){ const t=normalize(el.innerText||el.textContent||el.getAttribute?.("aria-label")||el.getAttribute?.("data-label")||""); const s=scoreMatch(v,t); if(s>bestScore){best=el;bestScore=s;if(s>=0.99)break;} } return bestScore>=0.45?best:null; }
  function setChoice(input, value){
    const type=(input.type||"").toLowerCase(); if(!["radio","checkbox"].includes(type)) return false;
    const name=input.name||input.id; if(!name) return false;
    const group=Array.from(document.querySelectorAll(`input[type="${type}"][name="${CSS.escape(name)}"]`)); if(!group.length) return false;
    const labeled=group.map(inp=>{ let text=""; if(inp.id){ const lbl=document.querySelector(`label[for="${CSS.escape(inp.id)}"]`); if(lbl) text=lbl.innerText||lbl.textContent||""; }
      if(!text){ let p=inp.parentElement,h=0; while(p && h<3 && !text){ if((p.tagName||"").toLowerCase()==="label"){ text=p.innerText||p.textContent||""; break;} p=p.parentElement; h++; } }
      return {input:inp,text,val:inp.value};
    });
    let target = value ? (labeled.find(x=>normalize(x.text)===normalize(value)||normalize(x.val)===normalize(value)) || null) : null;
    if(!target){ let best={score:0,c:null}; for(const x of labeled){ const s=Math.max(scoreMatch(value||"",x.text),scoreMatch(value||"",x.val)); if(s>best.score) best={score:s,c:x}; } target = best.c || labeled[0]; }
    if(target){ target.input.focus?.(); target.input.scrollIntoView?.({block:"center"}); target.input.click?.(); fire(target.input,"input"); fire(target.input,"change"); return true; }
    return false;
  }
  function setSelect(select, value){
    const opts=Array.from(select.options||[]).filter(o=>!o.disabled); if(!opts.length) return false;
    let chosen = value ? (opts.find(o=>normalize(o.value)===normalize(value)) || opts.find(o=>normalize(o.text)===normalize(value))) : null;
    if(!chosen){ const texts=opts.map(o=>normalize(o.text)); const pnts=["prefer not to say","decline","prefer not"]; const foundPNTS=opts.find((o,i)=>pnts.some(p=>texts[i].includes(p))); chosen = foundPNTS || opts.find(o=>normalize(o.text) && !["select","choose"].includes(normalize(o.text))) || opts[0]; }
    if(chosen){ select.value=chosen.value; fire(select,"input"); fire(select,"change"); return true; } return false;
  }
  function setCustomDropdown(anchor, value){
    const container = anchor.closest('[role="combobox"],[role="listbox"],.dropdown,.Select,.select,.ui-dropdown,.css-1s2u09g-container') || anchor.parentElement;
    if(!container) return false;
    const opener = container.querySelector('button, [aria-haspopup="listbox"], [aria-expanded], .dropdown-toggle') || anchor;
    if(opener && opener.getAttribute && opener.getAttribute("aria-expanded")!=="true"){ opener.focus?.(); opener.click?.(); }
    let options = Array.from(document.querySelectorAll('button, .dropdown-item, li')).filter(x=>x.offsetParent!==null);
    options = options.filter(x=>{ const t=normalize(x.innerText||x.textContent||x.getAttribute?.("aria-label")||x.getAttribute?.("data-label")||""); return !(t.includes("submit")||t.includes("next")||t.includes("continue")||t.includes("back")||t.includes("previous")); });
    if(!options.length){ options = Array.from(container.querySelectorAll('button, .dropdown-item, li')).filter(x=>x.offsetParent!==null); }
    let choice = value ? bestTextMatch(options,value) : null;
    if(!choice){ const pnts=["prefer not to say","decline","prefer not"]; choice = options.find(o=>pnts.some(p=>normalize(o.innerText||o.textContent||"").includes(p))) || options[0]; }
    if(choice){ choice.click?.(); fire(anchor,"input"); fire(anchor,"change"); return true; } return false;
  }
  function generateFallbackValue(el, profile){
    const type=(el.type||"").toLowerCase(); const name=(el.name||"").toLowerCase(); const placeholder=(el.getAttribute("placeholder")||"").toLowerCase();
    const labelText=(getHints(el).map(h=>h.text).join(" ")||"").toLowerCase();
    if(type==="email"||placeholder.includes("email")||labelText.includes("email")) return profile.email||"applicant@example.com";
    if(type==="tel"||placeholder.includes("phone")||labelText.includes("phone")) return profile.phone||"+1 (555) 555-1234";
    if(type==="url"||placeholder.includes("url")||labelText.includes("link")) return profile.website||profile.linkedin||"https://example.com";
    if(type==="date"||placeholder.includes("date")||labelText.includes("date")){ const t=new Date(); const yyyy=t.getFullYear(),mm=String(t.getMonth()+1).padStart(2,"0"),dd=String(t.getDate()).padStart(2,"0"); return `${yyyy}-${mm}-${dd}`; }
    if(type==="number"){ if(labelText.includes("salary")||name.includes("salary")) return String(profile.desiredSalary||0); return "0"; }
    if(name.includes("zip")||labelText.includes("postal")) return profile.zip||"00000";
    if(el.tagName.toLowerCase()==="textarea") return profile.coverLetter || "N/A";
    return profile.fullName || N_A;
  }
  function fillElement(el, profile, opts){
    if(!el || el.disabled || el.readOnly || el.offsetParent===null) return false;
    const tag=(el.tagName||"").toLowerCase(); const type=(el.type||"").toLowerCase();
    const hints=getHints(el); const picked=pickProfileValue(hints,profile);
    let value=picked?.val; if(!value && opts.allowFallbacks){ value=generateFallbackValue(el,profile); }
    if(value==null) return false;
    if(opts.aggressive){ try{ el.scrollIntoView({block:"center"}); }catch{} try{ el.focus(); }catch{} }
    if(tag==="select"){ if(setSelect(el,value)) { if(opts.aggressive) el.blur?.(); return true; } if(setCustomDropdown(el,value)){ if(opts.aggressive) el.blur?.(); return true; } const ok=setSelect(el,null); if(opts.aggressive) el.blur?.(); return ok; }
    if(tag==="textarea"){ setNativeValue(el,value); fire(el,"input"); fire(el,"change"); if(opts.aggressive) el.blur?.(); return true; }
    if(tag==="input"){
      if(type==="file") return false;
      if(type==="radio"||type==="checkbox"){ const ok=setChoice(el,picked?.val ?? null); if(opts.aggressive) el.blur?.(); return ok; }
      let v=value; if(type==="date") v=parseDateLike(value)||value;
      setNativeValue(el,v); fire(el,"input"); fire(el,"change");
      if(el.getAttribute("aria-haspopup")==="listbox" || el.readOnly){ if(setCustomDropdown(el,value)) return true; }
      if(opts.aggressive) el.blur?.(); return true;
    }
    return false;
  }
  function answerButtonQuestions(profile, opts){
    let clicks=0;
    const kv={ relocation:profile.relocation, sponsorship:profile.sponsorship, gender:profile.gender, race:profile.race, veteranStatus:profile.veteranStatus, disabilityStatus:profile.disabilityStatus, workAuthorization:profile.workAuthorization, remotePreference:profile.remotePreference, likertPreference:profile.likertPreference };
    const keys=Object.entries(kv);
    const containers=Array.from(document.querySelectorAll("section, fieldset, form, div, article")).slice(0,500);
    const pickFallback=(btns)=>{ const pnts=["prefer not to say","decline","prefer not"]; let t=btns.find(b=>pnts.some(p=>normalize(b.innerText||b.textContent||"").includes(p))); return t||btns[0]; };
    for(const c of containers){
      const text=normalize(c.innerText||""); if(!text) continue;
      for(const [key,val] of keys){
        if(val==null && !text.includes(normalize(key))) continue;
        let candidates = Array.from(c.querySelectorAll('button')).concat(Array.from(c.querySelectorAll('.btn, .button, .chip, .choice, .option, [data-testid*="button"], [data-button], [class*="btn"], [class*="Button"]'))).filter(x=>x.offsetParent!==null);
        if(!candidates.length) continue;
        candidates=candidates.filter(el=>{ const t=normalize(el.innerText||el.textContent||el.getAttribute?.("aria-label")||el.getAttribute?.("data-label")||""); return !(t.includes("submit")||t.includes("next")||t.includes("continue")||t.includes("back")||t.includes("previous")); });
        let target=null;
        if(val){ target=candidates.find(el=>normalize(el.innerText||el.textContent||el.getAttribute?.("aria-label")||el.getAttribute?.("data-label")||"")===normalize(val));
          if(!target){ let best=null,bestScore=0; for(const el of candidates){ const t=normalize(el.innerText||el.textContent||el.getAttribute?.("aria-label")||el.getAttribute?.("data-label")||""); const s=scoreMatch(val,t); if(s>bestScore){best=el;bestScore=s;} } if(bestScore>=0.45) target=best; }
        }
        if(!target && opts.allowFallbacks){ target=pickFallback(candidates); }
        if(target){ target.scrollIntoView?.({block:"center"}); synthClick(target); clicks++; }
      }
    }
    return clicks;
  }
  function* iterFields(root=document){ const it=document.createNodeIterator(root,NodeFilter.SHOW_ELEMENT); let n; while((n=it.nextNode())){ const tag=n.tagName ? n.tagName.toLowerCase():""; if(tag==="input"||tag==="textarea"||tag==="select") yield n; if(n.shadowRoot){ for(const sn of iterFields(n.shadowRoot)) yield sn; } } }
  function loadProfile(){ return new Promise(res=>{ let done=false; try{ chrome.storage.local.get(null,data=>{ done=true; const fullName=[data.firstName,data.lastName].filter(Boolean).join(" ").trim(); res({ fullName, ...data }); }); setTimeout(()=>{ if(!done) res({}); },250); }catch{ res({}); } }); }
  function validateAndSweep(){ let fixed=0; const invalids=Array.from(document.querySelectorAll(":invalid, [required]")).filter(el=> el.offsetParent!==null); for(const el of invalids){ if(el.checkValidity && el.checkValidity()) continue; const tag=(el.tagName||"").toLowerCase(); if(tag==="select"){ const o=Array.from(el.options||[]).find(o=>!o.disabled && normalize(o.text)); if(o){ el.value=o.value; fire(el,"input"); fire(el,"change"); fixed++; } continue; } if(tag==="input"||tag==="textarea"){ const t=(el.type||"").toLowerCase(); if(t==="checkbox"){ el.checked=true; fire(el,"input"); fire(el,"change"); fixed++; continue; } if(t==="radio"){ const name=el.name; const peer=document.querySelector(`input[type="radio"][name="${CSS.escape(name)}"]`); if(peer){ peer.checked=true; fire(peer,"input"); fire(peer,"change"); fixed++; } continue; } setNativeValue(el,"N/A"); fire(el,"input"); fire(el,"change"); fixed++; } } return fixed; }
  async function autofillAll(opts={}){ const profile=await loadProfile(); let filled=0;
    for(const el of Array.from(iterFields(document))){ try{ if(fillElement(el,profile,{aggressive:!!opts.aggressive, allowFallbacks:true})) filled++; }catch{} }
    filled += answerButtonQuestions(profile,{allowFallbacks:true});
    filled += validateAndSweep();
    return { filled };
  }
  
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "PING_AUTOFILL") { try { sendResponse({ ok: true }); } catch(e) {} return true; }
});
chrome.runtime.onMessage.addListener((msg, sender, sendResponse)=>{ if(!msg) return; if(msg.type==="AUTOFILL_NOW"){ const opts=msg.opts||{}; autofillAll(opts).then(res=>sendResponse({ok:true,...res})); return true; } });
  try{ chrome.storage.local.get(["autoFillOnLoad","aggressiveMode"], v=>{ if(v && v.autoFillOnLoad) autofillAll({aggressive:!!v.aggressiveMode}); }); }catch{}
  const obs=new MutationObserver(muts=>{ for(const m of muts){ for(const n of Array.from(m.addedNodes||[])){ if(!(n instanceof Element)) continue; for(const el of n.querySelectorAll?.("input,textarea,select")||[]){ chrome.storage.local.get(["autoFillOnLoad","aggressiveMode"], v=>{ if(v && v.autoFillOnLoad) loadProfile().then(p=> fillElement(el,p,{aggressive:!!v.aggressiveMode, allowFallbacks:true})); }); } } } }); obs.observe(document.documentElement,{childList:true,subtree:true});
})();
