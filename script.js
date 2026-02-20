/* notes-data.js provides:
   window.NOTES_DATA = {
     pages: [{ page: 1, text: "..." }, ...],
     workflow: [{ id, title, emoji, tags, items: [...] }, ...]
   }
*/

const DEFAULT_GLOSSARY = [
  { term: "HAWB", def: "House Air Waybill — shipment-level document for a customer house file." },
  { term: "MAWB", def: "Master Air Waybill — master movement document (airline/master shipment)." },
  { term: "E.TMS", def: "Transport Management System used for shipment records, events, billing." },
  { term: "HIST", def: "History log of milestones/events/updates on a shipment file." },
  { term: "e.doc", def: "Document scanning/indexing system (shipment documents live here)." },
  { term: "SMP", def: "Shipment prepped milestone/event." },
  { term: "BKD", def: "Booked (carrier booking event)." },
  { term: "TSF", def: "Transferred to carrier (handoff event)." },
  { term: "COB", def: "Confirmed on board (uplift confirmed)." },
  { term: "EMD", def: "Estimated Master Destination." },
  { term: "EDD", def: "Estimated House Bill Arrival." },
  { term: "EDU", def: "Estimated Arrival at Port of Unlading." },
  { term: "OSD", def: "Over, Short & Damaged procedure/event family." },
  { term: "DG", def: "Dangerous Goods — regulated commodities requiring compliant handling." },
  { term: "TC", def: "Temperature Controlled handling/program category." },
  { term: "FCA", def: "Free Carrier — seller clears export and hands to carrier/agent at named place." },
  { term: "CPT", def: "Carriage Paid To — seller pays carriage to named destination, risk transfers on handover to carrier." },
  { term: "CIP", def: "Carriage and Insurance Paid To — CPT + seller provides insurance." },
  { term: "DAP", def: "Delivered At Place — seller delivers ready for unloading at named place." },
  { term: "DPU", def: "Delivered at Place Unloaded — seller delivers and unloads at named place." },
  { term: "DDP", def: "Delivered Duty Paid — seller delivers including duties/taxes cleared (buyer minimal tasks)." },
];

function esc(s){
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/* NEW: makes PDF dot points look good */
function formatTextToHtml(raw){
  // Converts plain text (from PDF extraction) into readable HTML:
  // - bullet lines -> <ul><li>
  // - numbered lines -> <ol><li>
  // - everything else -> <p>
  const lines = String(raw || "").replace(/\r\n/g, "\n").split("\n");

  const out = [];
  let bufP = [];
  let bufList = [];
  let listType = null; // "ul" | "ol"

  function flushP(){
    const txt = bufP.join(" ").trim();
    if (txt) out.push(`<p>${esc(txt)}</p>`);
    bufP = [];
  }
  function flushList(){
    if (!bufList.length) return;
    const tag = listType === "ol" ? "ol" : "ul";
    const items = bufList.map(li => `<li>${li}</li>`).join("");
    out.push(`<${tag}>${items}</${tag}>`);
    bufList = [];
    listType = null;
  }

  for (const lineRaw of lines){
    const line = lineRaw.trimEnd();

    if (!line.trim()){
      flushP();
      flushList();
      continue;
    }

    const mBullet = line.match(/^\s*([-*•·])\s+(.+)$/);
    if (mBullet){
      flushP();
      const li = esc(mBullet[2].trim());
      if (listType && listType !== "ul") flushList();
      listType = "ul";
      bufList.push(li);
      continue;
    }

    const mNum = line.match(/^\s*(\d+)[\.\)]\s+(.+)$/);
    if (mNum){
      flushP();
      const li = esc(mNum[2].trim());
      if (listType && listType !== "ol") flushList();
      listType = "ol";
      bufList.push(li);
      continue;
    }

    const mKV = line.match(/^\s*([A-Za-z0-9][A-Za-z0-9 \/\-]{1,40})\s*:\s*(.+)$/);
    if (mKV){
      flushList();
      flushP();
      out.push(`<p><strong>${esc(mKV[1].trim())}:</strong> ${esc(mKV[2].trim())}</p>`);
      continue;
    }

    flushList();
    bufP.push(esc(line.trim()));
  }

  flushP();
  flushList();

  return out.join("\n");
}

function norm(s){
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function shuffle(arr){
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildGlossaryFromData(){
  const extra = [];
  const seen = new Set(DEFAULT_GLOSSARY.map(x => norm(x.term)));

  // harvest patterns like "TERM - definition" or "TERM — definition" from pages/workflow
  const grab = (txt) => {
    const lines = String(txt || "").split(/\r?\n/);
    for (const line of lines){
      const m = line.match(/^\s*([A-Z][A-Z0-9\.\-\/]{1,12})\s*(?:-+|—|–)\s*(.{8,})$/);
      if (m){
        const term = m[1].trim();
        const def = m[2].trim();
        const key = norm(term);
        if (!seen.has(key)){
          seen.add(key);
          extra.push({ term, def });
        }
      }
    }
  };

  if (window.NOTES_DATA?.pages){
    for (const p of window.NOTES_DATA.pages) grab(p.text);
  }
  if (window.NOTES_DATA?.workflow){
    for (const w of window.NOTES_DATA.workflow){
      for (const it of (w.items || [])) grab(it.body || it.summary || "");
    }
  }

  return [...DEFAULT_GLOSSARY, ...extra].sort((a,b)=>norm(a.term).localeCompare(norm(b.term)));
}

function getAllTags(){
  const set = new Set();
  for (const sec of WORKFLOW){
    for (const t of (sec.tags || [])) set.add(t);
    for (const it of (sec.items || [])){
      for (const t of (it.tags || [])) set.add(t);
    }
  }
  return Array.from(set).sort((a,b)=>a.localeCompare(b));
}

function countWorkflowItems(){
  let n = 0;
  for (const sec of WORKFLOW) n += (sec.items || []).length;
  return n;
}

const data = window.NOTES_DATA || { pages: [], workflow: [] };
const PAGES = data.pages || [];
const WORKFLOW = data.workflow || [];
const GLOSSARY = buildGlossaryFromData();

const els = {};
function $id(id){ return document.getElementById(id); }

const state = {
  view: "workflow",
  query: "",
  activeTag: "All",
  activeSectionId: (WORKFLOW[0]?.id) || null,
  studyMode: false,
  flash: {
    idx: 0,
    reveal: false,
    sources: { glossary: true, gl: true, incoterms: true, workflow: true },
    deck: []
  },
  quiz: {
    idx: 0,
    reveal: false,
    mode: "mc",
    sources: { glossary: true, gl: true, incoterms: true, workflow: true },
    deck: [],
    lastChoice: null,
    lastCorrect: null
  }
};

function setView(view){
  state.view = view;
  for (const btn of els.viewTabs.querySelectorAll(".tab")){
    btn.classList.toggle("active", btn.dataset.view === view);
  }
  els.panelResults.classList.toggle("hidden", view !== "workflow" && view !== "pages");
  els.panelFlashcards.classList.toggle("hidden", view !== "flashcards");
  els.panelQuiz.classList.toggle("hidden", view !== "quiz");
  els.navHeading.textContent = view === "pages" ? "Page Ranges" : "Workflow Sections";
  render();
}

function buildNav(){
  els.nav.innerHTML = "";
  const items = [];

  if (state.view === "pages"){
    const chunk = 10;
    const maxPage = PAGES.length || 0;
    for (let start = 1; start <= maxPage; start += chunk){
      const end = Math.min(maxPage, start + chunk - 1);
      items.push({
        id: `pages-${start}-${end}`,
        title: `Pages ${start}–${end}`,
        count: end - start + 1
      });
    }
  } else {
    for (const sec of WORKFLOW){
      items.push({
        id: sec.id,
        title: `${sec.emoji ? sec.emoji + " " : ""}${sec.title}`,
        count: (sec.items || []).length
      });
    }
  }

  for (const it of items){
    const btn = document.createElement("button");
    btn.className = "nav-link";
    btn.type = "button";
    btn.dataset.id = it.id;
    btn.innerHTML = `
      <span class="nav-left">
        <span class="nav-dot"></span>
        <span class="nav-title">${esc(it.title)}</span>
      </span>
      <span class="nav-count">${it.count}</span>
    `;
    btn.addEventListener("click", ()=>{
      state.activeSectionId = it.id;
      render();
      if (window.innerWidth <= 980){
        els.sidebar.classList.remove("open");
      }
    });
    els.nav.appendChild(btn);
  }
}

function buildTagChips(){
  els.tagChips.innerHTML = "";
  const tags = ["All", ...getAllTags()];
  for (const tag of tags){
    const b = document.createElement("button");
    b.className = "chip" + (state.activeTag === tag ? " active" : "");
    b.type = "button";
    b.textContent = tag;
    b.addEventListener("click", ()=>{
      state.activeTag = tag;
      render();
    });
    els.tagChips.appendChild(b);
  }
}

function matchesFilters(text, tags){
  const q = norm(state.query);
  if (q){
    const hay = norm(text);
    if (!hay.includes(q)) return false;
  }
  if (state.activeTag && state.activeTag !== "All"){
    const has = (tags || []).includes(state.activeTag);
    if (!has) return false;
  }
  return true;
}

function renderWorkflowView(){
  const section = WORKFLOW.find(s => s.id === state.activeSectionId) || WORKFLOW[0];
  if (!section){
    els.results.innerHTML = `<div class="card">No workflow sections found.</div>`;
    return;
  }

  // highlight active nav item
  for (const btn of els.nav.querySelectorAll(".nav-link")){
    btn.style.borderColor = (btn.dataset.id === section.id) ? "rgba(122,162,255,.55)" : "transparent";
    btn.style.background = (btn.dataset.id === section.id) ? "rgba(122,162,255,.10)" : "transparent";
  }

  const cards = [];
  let matches = 0;

  for (const item of (section.items || [])){
    const combined = `${item.title || ""}\n${item.summary || ""}\n${item.body || ""}`;
    const tags = [...(section.tags || []), ...(item.tags || [])];

    if (!matchesFilters(combined, tags)) continue;
    matches++;

    const badgeTags = tags.slice(0, 4).map(t=>`<span class="badge">${esc(t)}</span>`).join("");

    const note = item.note ? `
      <div class="note good">
        <div class="note-title">Note</div>
        <div>${esc(item.note)}</div>
      </div>` : "";

    const checklist = (item.checklist && item.checklist.length) ? `
      <div class="note warn">
        <div class="note-title">Checklist</div>
        <ul>${item.checklist.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
      </div>` : "";

    const pitfalls = (item.pitfalls && item.pitfalls.length) ? `
      <div class="note danger">
        <div class="note-title">Pitfalls</div>
        <ul>${item.pitfalls.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
      </div>` : "";

    const body = item.body || item.summary || "";

    const card = `
      <article class="card">
        <div class="card-title">
          <span>${esc(item.title || "Untitled")}</span>
          ${badgeTags}
        </div>
        <div class="card-meta">${esc(item.summary || "")}</div>

        <details class="accordion" open>
          <summary><span>Notes</span><span class="muted small">toggle</span></summary>
          <div class="accordion-body">
            ${formatTextToHtml(body)}
            ${note}
            ${checklist}
            ${pitfalls}
          </div>
        </details>
      </article>
    `;
    cards.push(card);
  }

  els.panelTitle.textContent = section.title || "Workflow";
  els.results.innerHTML = cards.join("") || `<div class="card">No results. Try a different search or clear filters.</div>`;
  els.resultsMeta.textContent = `${matches} match${matches===1?"":"es"}${state.query ? ` • Search: “${state.query}”` : ""}${state.activeTag!=="All" ? ` • Tag: ${state.activeTag}` : ""}`;
}

function renderPagesView(){
  // determine active page range
  let start = 1, end = Math.min(10, PAGES.length);
  if (state.activeSectionId && state.activeSectionId.startsWith("pages-")){
    const parts = state.activeSectionId.split("-");
    start = Number(parts[1] || 1);
    end = Number(parts[2] || end);
  }

  // highlight active nav item
  for (const btn of els.nav.querySelectorAll(".nav-link")){
    const active = (btn.dataset.id === `pages-${start}-${end}`);
    btn.style.borderColor = active ? "rgba(122,162,255,.55)" : "transparent";
    btn.style.background = active ? "rgba(122,162,255,.10)" : "transparent";
  }

  const pageCards = [];
  let matches = 0;

  for (let p = start; p <= end; p++){
    const page = PAGES[p-1];
    if (!page) continue;

    const text = page.text || "";
    if (!matchesFilters(text, [])) continue;
    matches++;

    const el = `
      <article class="card">
        <div class="card-title">
          <span>Page ${p}</span>
          <span class="badge">PDF</span>
        </div>
        <div class="card-meta muted">Search matches filter across raw extracted text.</div>

        <details class="accordion">
          <summary><span>Show page text</span><span class="muted small">toggle</span></summary>
          <div class="accordion-body">
            ${formatTextToHtml(text)}
          </div>
        </details>
      </article>
    `;
    pageCards.push(el);
  }

  els.panelTitle.textContent = `All Pages`;
  els.results.innerHTML = pageCards.join("") || `<div class="card">No results in this page range.</div>`;
  els.resultsMeta.textContent = `${matches} match${matches===1?"":"es"} • Showing pages ${start}–${end}${state.query ? ` • Search: “${state.query}”` : ""}`;
}

/* Flashcards + Quiz rendering logic continues unchanged (your original file)
   ---------------------------------------------------------------
   KEEP the rest of your original script.js below here if you had it.
   If you want, paste your current script.js and I’ll merge perfectly.
*/

function render(){
  buildNav();
  buildTagChips();

  if (state.view === "workflow") renderWorkflowView();
  else if (state.view === "pages") renderPagesView();
  else if (state.view === "flashcards") renderFlashcards();
  else if (state.view === "quiz") renderQuiz();
}

function init(){
  els.btnSidebar = $id("btnSidebar");
  els.sidebar = $id("sidebar");
  els.searchInput = $id("searchInput");
  els.btnClearSearch = $id("btnClearSearch");
  els.btnExpandAll = $id("btnExpandAll");
  els.btnCollapseAll = $id("btnCollapseAll");
  els.btnStudyMode = $id("btnStudyMode");
  els.btnGlossary = $id("btnGlossary");
  els.viewTabs = $id("viewTabs");
  els.nav = $id("nav");
  els.navHeading = $id("navHeading");
  els.navSection = $id("navSection");
  els.tagChips = $id("tagChips");

  els.content = $id("content");
  els.panelResults = $id("panelResults");
  els.panelFlashcards = $id("panelFlashcards");
  els.panelQuiz = $id("panelQuiz");
  els.panelTitle = $id("panelTitle");
  els.results = $id("results");
  els.resultsMeta = $id("resultsMeta");

  els.statPages = $id("statPages");
  els.statWorkflow = $id("statWorkflow");
  els.statCards = $id("statCards");

  els.glossaryModal = $id("glossaryModal");
  els.btnCloseGlossary = $id("btnCloseGlossary");
  els.glossarySearch = $id("glossarySearch");
  els.glossaryList = $id("glossaryList");

  els.statPages.textContent = String(PAGES.length || 0);
  els.statWorkflow.textContent = String(countWorkflowItems());
  els.statCards.textContent = "0";

  els.btnSidebar.addEventListener("click", ()=> els.sidebar.classList.toggle("open"));

  els.searchInput.addEventListener("input", ()=>{
    state.query = els.searchInput.value || "";
    render();
  });

  els.btnClearSearch.addEventListener("click", ()=>{
    els.searchInput.value = "";
    state.query = "";
    render();
    els.searchInput.focus();
  });

  els.btnExpandAll.addEventListener("click", ()=>{
    document.querySelectorAll("details.accordion").forEach(d=> d.open = true);
  });

  els.btnCollapseAll.addEventListener("click", ()=>{
    document.querySelectorAll("details.accordion").forEach(d=> d.open = false);
  });

  els.btnStudyMode.addEventListener("click", ()=>{
    state.studyMode = !state.studyMode;
    document.body.classList.toggle("study", state.studyMode);
  });

  els.btnGlossary?.addEventListener("click", ()=>{
    openGlossary();
  });
  els.btnCloseGlossary?.addEventListener("click", ()=>{
    els.glossaryModal.close();
  });

  els.viewTabs.addEventListener("click", (e)=>{
    const btn = e.target.closest(".tab");
    if (!btn) return;
    setView(btn.dataset.view);
  });

  window.addEventListener("keydown", (e)=>{
    if (e.key === "/" && document.activeElement !== els.searchInput){
      e.preventDefault();
      els.searchInput.focus();
    }
    if (e.key.toLowerCase() === "g"){
      openGlossary();
    }
  });

  render();
}

function openGlossary(){
  if (!els.glossaryModal) return;
  els.glossarySearch.value = "";
  renderGlossary("");
  els.glossaryModal.showModal();
  setTimeout(()=> els.glossarySearch.focus(), 30);
  els.glossarySearch.oninput = ()=> renderGlossary(els.glossarySearch.value || "");
}

function renderGlossary(q){
  const nq = norm(q);
  const rows = [];
  for (const it of GLOSSARY){
    const hay = norm(`${it.term} ${it.def}`);
    if (nq && !hay.includes(nq)) continue;
    rows.push(`
      <div class="gloss-item">
        <div class="gloss-term">
          <span>${esc(it.term)}</span>
          <span class="badge">TERM</span>
        </div>
        <div class="gloss-def">${esc(it.def)}</div>
      </div>
    `);
  }
  els.glossaryList.innerHTML = rows.join("") || `<div class="muted">No glossary results.</div>`;
}

/* IMPORTANT:
   If your original script.js has renderFlashcards() / renderQuiz() below,
   keep them. The only REQUIRED change is formatTextToHtml + the two replacements above.
*/
document.addEventListener("DOMContentLoaded", init);