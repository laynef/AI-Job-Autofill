// content.js — v1.7
(function(){
  const DBG = false;
  const log = (...a)=>{ if(DBG) console.log("[AF]",...a); };

  const normalize = s => (s||"").toString().replace(/\s+/g," ").trim().toLowerCase();

  function scoreMatch(needle, hay){
    needle = normalize(needle); hay = normalize(hay);
    if(!needle || !hay) return 0;
    if(needle === hay) return 1;
    if(hay.includes(needle)) return Math.max(0.6, Math.min(0.95, needle.length/(hay.length+0.0001)));
    const ns = new Set(needle.split(" ")); const hs = new Set(hay.split(" "));
    let inter = 0; for(const t of ns) if(hs.has(t)) inter++;
    return inter / Math.max(1, ns.size);
  }

  function setNativeValue(el, value){
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
  }

  function fire(el, type){ try{ el.dispatchEvent(new Event(type, { bubbles:true })); }catch{} }

  function key(el, key, code){
    const opts = { key, code: code||key, bubbles:true, cancelable:true };
    el.dispatchEvent(new KeyboardEvent("keydown", opts));
    el.dispatchEvent(new KeyboardEvent("keyup", opts));
    el.dispatchEvent(new KeyboardEvent("keypress", opts));
  }

  function synthClick(el){
    try{
      const r = el.getBoundingClientRect();
      ["pointerdown","mousedown","mouseup","pointerup","click"].forEach(evt=>{
        const e = new MouseEvent(evt, {bubbles:true, cancelable:true, clientX:r.left+3, clientY:r.top+3});
        el.dispatchEvent(e);
      });
    }catch{ try{ el.click(); }catch{} }
  }

  function parseDateLike(v){
    if(!v) return null;
    const d = new Date(v);
    if(!isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth()+1).padStart(2,"0");
      const dd = String(d.getDate()).padStart(2,"0");
      return `${yyyy}-${mm}-${dd}`;
    }
    return null;
  }

  function getHints(el){
    const hints = [];
    const add=(s,tag)=>{ if(s && normalize(s)) hints.push({text:s, tag}); };

    if(el.id){
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if(lbl) add(lbl.innerText||lbl.textContent,"label-for");
    }
    let p=el.parentElement, hops=0;
    while(p && hops<3){
      if(p.tagName && p.tagName.toLowerCase()==="label"){
        add(p.innerText||p.textContent,"label-parent"); break;
      }
      p=p.parentElement; hops++;
    }
    add(el.getAttribute("aria-label"),"aria-label");
    add(el.getAttribute("aria-labelledby"),"aria-labelledby");
    add(el.getAttribute("placeholder"),"placeholder");
    if(el.previousElementSibling){
      const s = el.previousElementSibling.innerText||el.previousElementSibling.textContent;
      add(s,"prev-sibling");
    }
    let cur=el;
    for(let i=0;i<4 && cur;i++){
      const txt=(cur.innerText||cur.textContent||"").trim();
      const first=txt.split("\n").map(x=>x.trim()).filter(Boolean)[0];
      if(first && first.length>3 && first.length<160) add(first,"ancestor");
      cur=cur.parentElement;
    }
    add(el.name,"name"); add(el.id,"id");
    for(const a of el.getAttributeNames?.()||[]){ if(a.startsWith("data-")) add(el.getAttribute(a), a); }
    return hints;
  }

  const keyMap = {
    firstName: ["first name","given name","forename"],
    lastName: ["last name","surname","family name"],
    fullName: ["full name","name (first and last)","contact name","your name"],
    email: ["email","e-mail","email address"],
    phone: ["phone","mobile","tel","telephone","cell"],
    city: ["city","town"],
    state: ["state","province","region"],
    country: ["country"],
    zip: ["zip","zipcode","postal code","postcode"],
    address: ["address","street address","address line"],
    linkedin: ["linkedin","linkedin url","linkedin profile"],
    website: ["website","portfolio","personal site","url"],
    github: ["github","github url","github profile"],
    gender: ["gender","sex"],
    race: ["race","ethnicity"],
    veteranStatus: ["veteran","veteran status"],
    disabilityStatus: ["disability","disability status"],
    desiredSalary: ["salary","pay","compensation"],
    relocation: ["relocation","willing to relocate"],
    sponsorship: ["sponsorship","visa","work authorization"],
    startDate: ["start date","availability","available start"],
    graduationDate: ["graduation","grad date"],
    university: ["university","college","school"],
    degree: ["degree","education level"],
    major: ["major","field of study"],
    gpa: ["gpa","grade point average"],
    coverLetter: ["cover letter","motivation","why us","statement"],
  };

  function pickProfileValue(hints, profile){
    const cands = [];
    for(const [key, syns] of Object.entries(keyMap)){
      const val = profile[key]; if(!val) continue;
      for(const h of hints){
        const arr = [key, ...syns];
        for(const s of arr){
          const sc = scoreMatch(s, h.text);
          if(sc >= 0.45) cands.push({ key, val, score: sc + (h.tag?.includes("label")?0.05:0) });
        }
      }
    }
    for(const h of hints){
      const k = normalize(h.text).replace(/[^a-z]/g,"");
      if (profile[k]) cands.push({ key:k, val:profile[k], score:0.95 });
    }
    if(!cands.length) return null;
    cands.sort((a,b)=>b.score-a.score);
    return cands[0];
  }

  function bestTextMatch(els, value){
    const v = normalize(value);
    let best=null, bestScore=0;
    for(const el of els){
      const t = normalize(el.innerText||el.textContent||el.getAttribute?.("aria-label")||"");
      const s = scoreMatch(v, t);
      if(s>bestScore){ best=el; bestScore=s; if(s>=0.99) break; }
    }
    return bestScore>=0.45 ? best : null;
  }

  function setChoice(input, value){
    const type = (input.type||"").toLowerCase();
    if(!["radio","checkbox"].includes(type)) return false;
    const name = input.name||input.id; if(!name) return false;
    const sel = `input[type="${type}"][name="${CSS.escape(name)}"]`;
    const group = Array.from(document.querySelectorAll(sel));
    if(!group.length) return false;
    const labeled = group.map(inp=>{
      let text="";
      if(inp.id){
        const lbl=document.querySelector(`label[for="${CSS.escape(inp.id)}"]`);
        if(lbl) text = lbl.innerText||lbl.textContent||"";
      }
      if(!text){
        let p=inp.parentElement, hops=0;
        while(p && hops<3 && !text){
          if(p.tagName && p.tagName.toLowerCase()==="label"){
            text = p.innerText||p.textContent||""; break;
          }
          p=p.parentElement; hops++;
        }
      }
      return {input:inp, text, val:inp.value};
    });
    let target = labeled.find(x=>normalize(x.text)===normalize(value) || normalize(x.val)===normalize(value));
    if(!target){
      let best={score:0,c:null};
      for(const x of labeled){
        const s = Math.max(scoreMatch(value,x.text), scoreMatch(value,x.val));
        if(s>best.score) best={score:s,c:x};
      }
      target = best.score>=0.45 ? best.c : null;
    }
    if(target){
      try { inp = target.input; } catch(e) {}
      (target.input.focus?.()); 
      (target.input.scrollIntoView?.({block:"center"}));
      (target.input.click?.());
      (target.input.dispatchEvent?.(new Event("input",{bubbles:true})));
      (target.input.dispatchEvent?.(new Event("change",{bubbles:true})));
      return true;
    }
    return false;
  }

  function setSelect(select, value){
    const opts = Array.from(select.options||[]);
    if(!opts.length) return false;
    let chosen = opts.find(o=>normalize(o.value)===normalize(value))
              ||  opts.find(o=>normalize(o.text)===normalize(value));
    if(!chosen){
      let best={score:0,opt:null};
      for(const o of opts){
        const s=Math.max(scoreMatch(value,o.text), scoreMatch(value,o.value));
        if(s>best.score) best={score:s,opt:o};
      }
      if(best.opt && best.score>=0.45) chosen=best.opt;
    }
    if(chosen){
      select.value = chosen.value;
      select.dispatchEvent(new Event("input",{bubbles:true}));
      select.dispatchEvent(new Event("change",{bubbles:true}));
      return true;
    }
    return false;
  }

  function setCustomDropdown(anchor, value){
    const container = anchor.closest('[role="combobox"],[role="listbox"],.dropdown,.Select,.select,.ui-dropdown,.css-1s2u09g-container') || anchor.parentElement;
    if(!container) return false;
    const opener = container.querySelector('[aria-haspopup="listbox"],[role="button"],button') || anchor;
    if(opener){
      if(opener.getAttribute("aria-expanded")!=="true"){ opener.focus?.(); opener.click?.(); }
    }
    let options = Array.from(document.querySelectorAll('[role="option"],.dropdown-item,li[role="option"]')).filter(x=>x.offsetParent!==null);
    if(!options.length){
      options = Array.from(container.querySelectorAll('[role="option"],.dropdown-item,li')).filter(x=>x.offsetParent!==null);
    }
    const v = normalize(value);
    let best=null, bestScore=0;
    for(const o of options){
      const t = normalize(o.innerText||o.textContent||o.getAttribute?.("aria-label")||"");
      const s = scoreMatch(v,t);
      if(s>bestScore){ best=o; bestScore=s; }
      if(t===v){ best=o; break; }
    }
    if(best && bestScore>=0.45){
      best.click?.();
      anchor.dispatchEvent?.(new Event("input",{bubbles:true}));
      anchor.dispatchEvent?.(new Event("change",{bubbles:true}));
      return true;
    }
    return false;
  }

  function fillElement(el, profile, opts){
    if(!el || el.disabled || el.readOnly) return false;
    if(el.offsetParent===null) return false;
    const tag = (el.tagName||"").toLowerCase();
    const type = (el.type||"").toLowerCase();
    const hints = getHints(el);
    const picked = pickProfileValue(hints, profile);
    if(!picked) return false;
    const value = picked.val;

    if(opts.aggressive){ try{ el.scrollIntoView({block:"center"}); }catch{} try{ el.focus(); }catch{} }

    if(tag==="select"){
      if(setSelect(el, value)) { if(opts.aggressive) { el.blur?.(); } return true; }
      if(setCustomDropdown(el, value)){ if(opts.aggressive) { el.blur?.(); } return true; }
      return false;
    }

    if(tag==="textarea"){
      setNativeValue(el, value);
      el.dispatchEvent(new Event("input",{bubbles:true}));
      el.dispatchEvent(new Event("change",{bubbles:true}));
      if(opts.aggressive) el.blur?.();
      return true;
    }

    if(tag==="input"){
      if(type==="file"){ return false; }
      if(type==="radio"||type==="checkbox"){ 
        if(setChoice(el, value)){ if(opts.aggressive) el.blur?.(); return true; }
        return false;
      }
      let v = value;
      if(type==="date"){ v = parseDateLike(value) || value; }
      setNativeValue(el, v);
      el.dispatchEvent(new Event("input",{bubbles:true}));
      el.dispatchEvent(new Event("change",{bubbles:true}));
      if(el.getAttribute("aria-haspopup")==="listbox" || el.readOnly){
        if(setCustomDropdown(el, value)) return true;
      }
      if(opts.aggressive) el.blur?.();
      return true;
    }
    return false;
  }

  function* iterFields(root=document){
    const it = document.createNodeIterator(root, NodeFilter.SHOW_ELEMENT);
    let n;
    while((n=it.nextNode())){
      const tag = n.tagName ? n.tagName.toLowerCase() : "";
      if(tag==="input"||tag==="textarea"||tag==="select") yield n;
      if(n.shadowRoot){ for(const sn of iterFields(n.shadowRoot)) yield sn; }
    }
  }

  function loadProfile(){
    return new Promise(res=>{
      let done=false;
      try {
        chrome.storage.local.get(null, data=>{
          done=true;
          const fullName = [data.firstName, data.lastName].filter(Boolean).join(" ").trim();
          res({ fullName, ...data });
        });
        setTimeout(()=>{ if(!done) res({}); }, 200);
      } catch { res({}); }
    });
  }

  async function autofillAll(opts={}){
    const profile = await loadProfile();
    let filled = 0;
    for(const el of Array.from(iterFields(document))){
      try { if(fillElement(el, profile, opts)) filled++; } catch(e){}
    }

    const pairs = [
      ["relocation", profile.relocation],
      ["sponsorship", profile.sponsorship],
      ["gender", profile.gender],
      ["race", profile.race],
      ["veteranStatus", profile.veteranStatus],
      ["disabilityStatus", profile.disabilityStatus],
    ].filter(([k,v])=>v);
    for(const [key,val] of pairs){
      const blocks = Array.from(document.querySelectorAll("section,div,fieldset,form"));
      for(const b of blocks){
        const txt = normalize(b.innerText||"");
        if(!txt || !txt.includes(normalize(key))) continue;
        const btns = Array.from(b.querySelectorAll('button,[role="button"],.btn,.button')).filter(x=>x.offsetParent!==null);
        const target = btns.length ? (function(){
          const v = normalize(val); let best=null, bestScore=0;
          for(const btn of btns){ const t=normalize(btn.innerText||btn.textContent||btn.getAttribute?.("aria-label")||""); const s=scoreMatch(v,t); if(s>bestScore){best=btn;bestScore=s;} }
          return bestScore>=0.45?best:null;
        })() : null;
        if(target){ target.click?.(); filled++; }
      }
    }

    return { filled };
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse)=>{
    if(!msg) return;
    if(msg.type==="AUTOFILL_NOW"){
      const opts = msg.opts || {};
      autofillAll(opts).then(res=> sendResponse({ok:true, ...res}));
      return true;
    }
  });

  try {
    chrome.storage.local.get(["autoFillOnLoad","aggressiveMode"], v=>{
      if(v && v.autoFillOnLoad) autofillAll({aggressive: !!v.aggressiveMode});
    });
  } catch {}

  const obs = new MutationObserver(muts=>{
    for(const m of muts){
      for(const n of Array.from(m.addedNodes||[])){
        if(!(n instanceof Element)) continue;
        for(const el of n.querySelectorAll?.("input,textarea,select")||[]){
          chrome.storage.local.get(["autoFillOnLoad","aggressiveMode"], v=>{
            if(v && v.autoFillOnLoad) loadProfile().then(p=> fillElement(el,p,{aggressive:!!v.aggressiveMode}));
          });
        }
      }
    }
  });
  obs.observe(document.documentElement, { childList:true, subtree:true });
})();
