const FIELDS = [
  "firstName","lastName","fullName","email","phone",
  "address","city","state","zip","country",
  "linkedin","website","github",
  "gender","race","veteranStatus","disabilityStatus",
  "desiredSalary","relocation","sponsorship",
  "startDate","graduationDate","university","degree","major","gpa",
  "workAuthorization","remotePreference","likertPreference","starRating"
];
function el(tag, attrs={}, children=[]) { const e=document.createElement(tag); Object.entries(attrs).forEach(([k,v])=> e.setAttribute(k,v)); children.forEach(c=> e.appendChild(typeof c==="string"?document.createTextNode(c):c)); return e; }
function render(){ const grid=document.getElementById("grid"); grid.innerHTML=""; for(const f of FIELDS){ const wrap=el("div",{},[ el("label",{},[f]), el("input",{id:f,placeholder:f}) ]); grid.appendChild(wrap);} }
async function load(){ render(); const data=await chrome.storage.local.get(null); for(const f of FIELDS){ const elInput=document.getElementById(f); if(elInput && data[f]!=null) elInput.value=data[f]; } if(data.coverLetter!=null) document.getElementById("coverLetter").value=data.coverLetter; }
async function save(){ const payload={}; for(const f of FIELDS) payload[f]=document.getElementById(f).value||""; payload.coverLetter=document.getElementById("coverLetter").value||""; await chrome.storage.local.set(payload); const s=document.getElementById("status"); s.textContent="Saved ✓"; setTimeout(()=> s.textContent="",1200); }
document.getElementById("save").addEventListener("click", save);
load();
