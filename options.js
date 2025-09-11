
// options.js — renders a profile form, saves to chrome.storage.local
const FIELDS = [
  "firstName","lastName","fullName","email","phone",
  "address","city","state","zip","country",
  "linkedin","website","github",
  "gender","race","veteranStatus","disabilityStatus",
  "desiredSalary","relocation","sponsorship",
  "startDate","graduationDate","university","degree","major","gpa",
  "workAuthorization","remotePreference","likertPreference","starRating",
  "apiKey","model"
];

function el(tag, attrs={}, children=[]) {
  const e = document.createElement(tag);
  Object.entries(attrs||{}).forEach(([k,v]) => {
    if (k === "text") e.textContent = v;
    else e.setAttribute(k, v);
  });
  for (const c of (children||[])) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  return e;
}

function render() {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  for (const f of FIELDS) {
    const nice = f.replace(/([A-Z])/g, " $1").replace(/^./, c=>c.toUpperCase());
    const input = el("input", { id: f, placeholder: nice });
    if (f === "apiKey") input.placeholder = "OpenAI API Key (sk-...)";
    if (f === "model") input.placeholder = "Model (e.g., gpt-4o-mini)";
    const wrap = el("div", {}, [
      el("label", { for: f, text: nice }),
      input
    ]);
    grid.appendChild(wrap);
  }
}

async function load() {
  render();
  const keys = [...FIELDS, "coverLetter"];
  const data = await new Promise(res => chrome.storage.local.get(keys, res));
  for (const f of FIELDS) {
    const el = document.getElementById(f);
    if (el && data[f] != null) el.value = data[f];
  }
  const cl = document.getElementById("coverLetter");
  if (cl && data.coverLetter != null) cl.value = data.coverLetter;
}

async function save() {
  const payload = {};
  for (const f of FIELDS) {
    const el = document.getElementById(f);
    if (el) payload[f] = el.value;
  }
  const cl = document.getElementById("coverLetter");
  if (cl) payload.coverLetter = cl.value;
  await chrome.storage.local.set(payload);
  const s = document.getElementById("status");
  if (s) { s.textContent = "Saved ✓"; setTimeout(()=> s.textContent = "", 1200); }
}

document.getElementById("save").addEventListener("click", save);
load();
