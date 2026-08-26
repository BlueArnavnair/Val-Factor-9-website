/* ===================== CONFIG ===================== */
const DOMAINS = [
  { key:'Signal Peptide',      label:'Signal Peptide',                     range:[1,28],   color:'#5C6B8A' },
  { key:'Propeptide',          label:'Propeptide',                         range:[29,46],  color:'#8791AC' },
  { key:'Gla',                 label:'Gla Domain',                         range:[47,92],  color:'#1F6F6B' },
  { key:'EGF1',                label:'EGF1 Domain',                        range:[93,129], color:'#4F7D5B' },
  { key:'EGF2',                label:'EGF2 Domain',                        range:[130,172],color:'#C1811A' },
  { key:'Linker',              label:'Linker Region',                      range:[173,191],color:'#9AA37F' },
  { key:'Activation Peptide',  label:'Activation Peptide',                 range:[192,226],color:'#7DA9C4' },
  { key:'Serine Protease',     label:'Catalytic Serine Protease Domain',   range:[227,461],color:'#A3211F' },
];
const DOMAIN_COLOR = Object.fromEntries(DOMAINS.map(d=>[d.key,d.color]));
const DOMAIN_LABEL = Object.fromEntries(DOMAINS.map(d=>[d.key,d.label]));
const PROTEIN_LEN = 461;
const TRIAD = [267,315,411]; // His267/Asp315/Ser411 — verified against wt_aa in this dataset's numbering
const CYSTEINES = [18,28,64,69,97,102,108,117,119,128,134,141,145,155,157,170,178,252,268,335,382,396,407,435]; // every wt=Cys position actually recorded in the data (12 disulfide bonds implied, pairing not independently verified)
const SEV_COLOR = { Severe:'#A3211F', Moderate:'#C1811A', Mild:'#4F7D5B', Unclassified:'#5C6B8A' };
const SEV_ORDER = ['Severe','Moderate','Mild','Unclassified'];

const DATA = FIX_VARIANTS; // from data.js

/* ===================== HELPERS ===================== */
function fmtInt(n){ return n.toLocaleString('en-US'); }

function labelFor(v){
  let core;
  if (v.hg && v.hg.indexOf('>') > -1) core = v.hg;
  else if (v.wa && v.ma) core = `${v.wa} > ${v.ma}`;
  else if (v.cd) core = v.cd;
  else core = `Variant ${v.id}`;
  return v.rs != null ? `${core} (Residue ${v.rs})` : core;
}

function severityBadge(sv){
  const s = sv || 'Unclassified';
  const cls = 'badge-' + s.toLowerCase();
  return `<span class="badge ${cls}">${s}</span>`;
}

/* ===================== STATS / HERO ===================== */
function renderStats(){
  const domainsUsed = new Set(DATA.filter(v=>v.dm).map(v=>v.dm)).size;
  document.getElementById('hero-count').textContent = fmtInt(DATA.length);
  const stats = [
    { num: fmtInt(DATA.length), label:'Variant reports logged' },
    { num: domainsUsed, label:'Structural domains mapped' },
    { num: CYSTEINES.length, label:'Disulfide-bonded cysteines tracked' },
    { num: TRIAD.length, label:'Confirmed catalytic triad residues' },
  ];
  document.getElementById('stat-row').innerHTML = stats.map(s=>
    `<div class="stat"><span class="stat-num">${s.num}</span><span class="stat-label">${s.label}</span></div>`
  ).join('');
}

/* ===================== RULER (signature element) ===================== */
function drawRuler(svgId, {height=118, showLabels=true, showTicks=true, markerResidue=null} = {}){
  const svg = document.getElementById(svgId);
  const W = 1116, H = height;
  const trackY = showLabels ? 40 : H/2 - 10;
  const trackH = 20;
  const toX = (res) => 8 + (res/PROTEIN_LEN) * (W-16);

  let parts = [];
  DOMAINS.forEach(d=>{
    const x1 = toX(d.range[0]), x2 = toX(d.range[1]);
    parts.push(`<rect class="ruler-seg" data-key="${d.key}" x="${x1}" y="${trackY}" width="${Math.max(x2-x1,1)}" height="${trackH}" fill="${d.color}" opacity="0.92"/>`);
    if (showLabels && (x2-x1) > 30){
      parts.push(`<text x="${(x1+x2)/2}" y="${trackY+trackH+16}" text-anchor="middle" font-family="IBM Plex Mono" font-size="9.5" fill="#8791AC">${d.range[0]}\u2013${d.range[1]}</text>`);
    }
  });

  if (showTicks){
    CYSTEINES.forEach(r=>{
      const x = toX(r);
      parts.push(`<line x1="${x}" y1="${trackY-10}" x2="${x}" y2="${trackY}" stroke="#7DA9C4" stroke-width="1.5"/>`);
    });
    TRIAD.forEach(r=>{
      const x = toX(r);
      parts.push(`<polygon points="${x-4},${trackY-9} ${x+4},${trackY-9} ${x},${trackY-1}" fill="#E8C547"/>`);
    });
  }

  if (markerResidue != null){
    const x = toX(markerResidue);
    parts.push(`<line x1="${x}" y1="${trackY-16}" x2="${x}" y2="${trackY+trackH+4}" stroke="#A3211F" stroke-width="2"/>`);
    parts.push(`<circle cx="${x}" cy="${trackY-16}" r="4" fill="#A3211F"/>`);
  }

  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = parts.join('');

  // hover tooltip + click-to-filter
  const tip = document.getElementById('ruler-tip');
  if (tip){
    svg.querySelectorAll('.ruler-seg').forEach(el=>{
      const key = el.getAttribute('data-key');
      const d = DOMAINS.find(x=>x.key===key);
      el.style.cursor='pointer';
      el.addEventListener('mousemove', (e)=>{
        tip.textContent = `${d.label} \u00b7 residues ${d.range[0]}\u2013${d.range[1]}`;
        tip.style.left = e.pageX - svg.closest('.ruler-shell').getBoundingClientRect().left - window.scrollX + 'px';
        tip.style.top = (e.clientY - svg.getBoundingClientRect().top - 40) + 'px';
        tip.style.opacity = 1;
      });
      el.addEventListener('mouseleave', ()=> tip.style.opacity = 0);
      el.addEventListener('click', ()=>{
        document.getElementById('f-domain').value = key;
        applyFilters();
        document.getElementById('explorer').scrollIntoView({behavior:'smooth'});
      });
    });
  }
}

function drawMiniRuler(residue){
  const svg = document.getElementById('mini-ruler');
  const W = 100, H = 22;
  const toX = (res) => 2 + (res/PROTEIN_LEN) * (W-4);
  let parts = DOMAINS.map(d=>{
    const x1 = toX(d.range[0]), x2 = toX(d.range[1]);
    return `<rect x="${x1}" y="8" width="${Math.max(x2-x1,0.5)}" height="6" fill="${d.color}" opacity="0.9"/>`;
  });
  if (residue != null){
    const x = toX(residue);
    parts.push(`<circle cx="${x}" cy="11" r="3.4" fill="#EDEAE0" stroke="#A3211F" stroke-width="2"/>`);
  }
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = parts.join('');
}

/* ===================== FIGURES ===================== */
function renderFigures(){
  // FIG 1 — donut of domain distribution
  const counts = {};
  DATA.forEach(v=>{ const k = v.dm || 'Unresolved'; counts[k] = (counts[k]||0)+1; });
  const order = [...DOMAINS.map(d=>d.key), 'Unresolved'].filter(k=>counts[k]);
  const total = DATA.length;
  const cx=150, cy=150, rOuter=110, rInner=64;
  let angle = -Math.PI/2;
  let donutParts = [];
  order.forEach(k=>{
    const val = counts[k];
    const frac = val/total;
    const a0 = angle, a1 = angle + frac*2*Math.PI;
    const large = (a1-a0) > Math.PI ? 1 : 0;
    const x0 = cx + rOuter*Math.cos(a0), y0 = cy + rOuter*Math.sin(a0);
    const x1 = cx + rOuter*Math.cos(a1), y1 = cy + rOuter*Math.sin(a1);
    const xi0 = cx + rInner*Math.cos(a1), yi0 = cy + rInner*Math.sin(a1);
    const xi1 = cx + rInner*Math.cos(a0), yi1 = cy + rInner*Math.sin(a0);
    const color = DOMAIN_COLOR[k] || '#8791AC';
    donutParts.push(`<path d="M${x0},${y0} A${rOuter},${rOuter} 0 ${large} 1 ${x1},${y1} L${xi0},${yi0} A${rInner},${rInner} 0 ${large} 0 ${xi1},${yi1} Z" fill="${color}" opacity="0.94" stroke="#EEF0EA" stroke-width="1.5"/>`);
    angle = a1;
  });
  donutParts.push(`<text x="${cx}" y="${cy-4}" text-anchor="middle" font-family="IBM Plex Mono" font-size="26" font-weight="600" fill="#0E1526">${fmtInt(total)}</text>`);
  donutParts.push(`<text x="${cx}" y="${cy+16}" text-anchor="middle" font-family="IBM Plex Mono" font-size="10" letter-spacing="1" fill="#5B6156">VARIANTS</text>`);
  document.getElementById('fig-donut').innerHTML = donutParts.join('');
  document.getElementById('donut-legend').innerHTML = order.map(k=>{
    const label = DOMAIN_LABEL[k] || k;
    const pct = ((counts[k]/total)*100).toFixed(1);
    return `<div class="legend-item"><i style="background:${DOMAIN_COLOR[k]||'#8791AC'}"></i>${label} &middot; ${pct}%</div>`;
  }).join('');

  // FIG 2 — stacked bar of severity by domain
  const domKeys = DOMAINS.map(d=>d.key).filter(k => DATA.some(v=>v.dm===k));
  const matrix = domKeys.map(k=>{
    const rows = DATA.filter(v=>v.dm===k);
    const m = {key:k, total:rows.length};
    SEV_ORDER.forEach(s=> m[s] = rows.filter(r=>(r.sv||'Unclassified')===s).length);
    return m;
  });
  const maxTotal = Math.max(...matrix.map(m=>m.total));
  const barW = 42, gap = 14, chartH = 220, baseY = 250, leftPad = 10;
  let barParts = [];
  // gridlines
  [0,0.25,0.5,0.75,1].forEach(f=>{
    const y = baseY - f*chartH;
    barParts.push(`<line x1="${leftPad}" y1="${y}" x2="450" y2="${y}" stroke="#CBCFC0" stroke-width="1"/>`);
    barParts.push(`<text x="${leftPad}" y="${y-4}" font-family="IBM Plex Mono" font-size="8.5" fill="#5B6156">${Math.round(f*maxTotal)}</text>`);
  });
  matrix.forEach((m,i)=>{
    let y = baseY;
    const x = leftPad + 14 + i*(barW+gap);
    SEV_ORDER.forEach(s=>{
      const val = m[s];
      const h = (val/maxTotal)*chartH;
      y -= h;
      barParts.push(`<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${SEV_COLOR[s]}" opacity="0.92"><title>${s}: ${val}</title></rect>`);
    });
    barParts.push(`<text x="${x+barW/2}" y="${baseY+14}" text-anchor="middle" font-family="Inter" font-size="8.5" fill="#5B6156">${(DOMAIN_LABEL[m.key]||m.key).replace(' Domain','').replace('Catalytic Serine Protease','Catalytic')}</text>`);
  });
  document.getElementById('fig-bar').innerHTML = barParts.join('');
  document.getElementById('bar-legend').innerHTML = SEV_ORDER.map(s=>
    `<div class="legend-item"><i style="background:${SEV_COLOR[s]}"></i>${s}</div>`
  ).join('');
}

/* ===================== EXPLORER ===================== */
let filtered = DATA;
let page = 0;
const PAGE_SIZE = 14;
let selectedId = null;

function populateDomainFilter(){
  const sel = document.getElementById('f-domain');
  DOMAINS.forEach(d=>{
    if (!DATA.some(v=>v.dm===d.key)) return;
    const opt = document.createElement('option');
    opt.value = d.key; opt.textContent = d.label;
    sel.appendChild(opt);
  });
}

function applyFilters(){
  const q = document.getElementById('f-search').value.trim().toLowerCase();
  const domain = document.getElementById('f-domain').value;
  const severity = document.getElementById('f-severity').value;
  const missenseOnly = document.getElementById('f-missense').checked;

  filtered = DATA.filter(v=>{
    if (missenseOnly && v.vt !== 'Missense') return false;
    if (domain && v.dm !== domain) return false;
    if (severity && (v.sv||'Unclassified') !== severity) return false;
    if (q){
      const hay = [
        v.hg, v.cd, v.wa, v.ma, v.wf, v.mf, v.dm, v.rs, v.id
      ].filter(Boolean).join(' ').toLowerCase();
      const arrowNorm = q.replace(/\s*(>|to)\s*/,' > ');
      if (!hay.includes(q) && !hay.includes(arrowNorm)) {
        // try residue-number-only match
        const numMatch = q.match(/\d+/);
        if (!(numMatch && String(v.rs) === numMatch[0])) return false;
      }
    }
    return true;
  });
  page = 0;
  renderResults();
}

function renderResults(){
  const list = document.getElementById('results-list');
  const count = document.getElementById('result-count');
  count.textContent = `${fmtInt(filtered.length)} match${filtered.length===1?'':'es'}`;

  if (filtered.length === 0){
    list.innerHTML = `<div class="empty-state"><b>No variants match these filters</b>Try clearing the search or widening the domain / severity filters.</div>`;
    document.getElementById('page-info').textContent = '';
    document.getElementById('prev-page').disabled = true;
    document.getElementById('next-page').disabled = true;
    return;
  }

  const maxPage = Math.ceil(filtered.length / PAGE_SIZE) - 1;
  page = Math.min(page, maxPage);
  const start = page*PAGE_SIZE;
  const pageItems = filtered.slice(start, start+PAGE_SIZE);

  list.innerHTML = pageItems.map(v=>{
    const active = v.id === selectedId ? 'active' : '';
    return `<div class="result-row ${active}" data-id="${v.id}">
      <span class="rr-hgvs">${labelFor(v).split(' (Residue')[0]}</span>
      <span class="rr-domain">${DOMAIN_LABEL[v.dm] || v.dm || 'Unresolved region'}</span>
      <span class="rr-res">${v.rs!=null ? 'Res '+v.rs : '—'}</span>
      ${severityBadge(v.sv)}
    </div>`;
  }).join('');

  list.querySelectorAll('.result-row').forEach(row=>{
    row.addEventListener('click', ()=>{
      const id = Number(row.getAttribute('data-id'));
      const v = filtered.find(x=>x.id===id);
      selectVariant(v);
    });
  });

  document.getElementById('page-info').textContent = `Page ${page+1} of ${maxPage+1}`;
  document.getElementById('prev-page').disabled = page===0;
  document.getElementById('next-page').disabled = page>=maxPage;
}

document.getElementById('prev-page').addEventListener('click', ()=>{ page--; renderResults(); });
document.getElementById('next-page').addEventListener('click', ()=>{ page++; renderResults(); });
document.getElementById('f-search').addEventListener('input', debounce(applyFilters, 180));
document.getElementById('f-domain').addEventListener('change', applyFilters);
document.getElementById('f-severity').addEventListener('change', applyFilters);
document.getElementById('f-missense').addEventListener('change', applyFilters);

function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }

/* ===================== 3D STRUCTURE LOADING (robust, dual-structure) ===================== */
// 6MV4 = real human FIXa EGF2+protease crystal structure (X-ray, 1.37A).
// IMPORTANT: 6MV4's own ATOM records use classic CHYMOTRYPSIN numbering for chain H,
// NOT this dataset's residue numbering. Verified anchors: chymotrypsin His57/Asp102/Ser195
// = this dataset's His267/Asp315/Ser411 (catalytic triad). Only these three fixed,
// individually-verified positions are used below -- per-variant highlighting on 6MV4 is
// intentionally NOT attempted yet, since a full residue-level map between this dataset's
// numbering and 6MV4's chymotrypsin numbering (which includes insertion-coded residues
// like 60A/129A/184A/221A) hasn't been built and verified. See chat for details.
const CATALYTIC_PDB = '6MV4';
const CATALYTIC_TRIAD_AUTH = [
  {chain:'H', resi:57,  label:'His57 (=His267)'},
  {chain:'H', resi:102, label:'Asp102 (=Asp315)'},
  {chain:'H', resi:195, label:'Ser195 (=Ser411)'},
];
const GLA_PDB = '1CFH'; // Gla-domain-only NMR fragment; used ONLY for Gla-domain variants

let _pdbCache = {};
async function loadPDBText(id){
  if (_pdbCache[id]) return _pdbCache[id];
  const resp = await fetch(`https://files.rcsb.org/download/${id}.pdb`);
  if (!resp.ok) throw new Error(`RCSB fetch failed for ${id}: HTTP ` + resp.status);
  const text = await resp.text();
  if (!text || text.indexOf('ATOM') === -1) throw new Error(`Empty or invalid PDB response for ${id}`);
  _pdbCache[id] = text;
  return text;
}

function viewerMessage(el, text, isError){
  el.innerHTML = `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
    text-align:center;padding:24px;font-family:'IBM Plex Mono',monospace;
    font-size:12px;color:${isError ? '#E08A8A' : '#8791AC'};line-height:1.6;">${text}</div>`;
}

/* ===================== DETAIL PANEL + MINI 3D ===================== */
let miniViewer = null;

function selectVariant(v){
  selectedId = v.id;
  renderResults();

  const panel = document.getElementById('detail');
  panel.classList.add('show');

  document.getElementById('d-title').textContent = labelFor(v);
  document.getElementById('d-residue').textContent = v.rs != null ? v.rs : 'N/A';
  document.getElementById('d-severity').textContent = v.sv || 'Unclassified';
  document.getElementById('d-domain').textContent = DOMAIN_LABEL[v.dm] || v.dm || 'Unresolved';
  document.getElementById('d-exon').textContent = v.ex || 'N/A';
  document.getElementById('d-cdna').textContent = v.cd || 'N/A';
  document.getElementById('d-freq').textContent = v.af || 'N/A';

  const distWrap = document.getElementById('d-dist-wrap');
  const sasaWrap = document.getElementById('d-sasa-wrap');
  if (v.ddist != null){
    distWrap.style.display = '';
    document.getElementById('d-dist').textContent = v.ddist.toFixed(2) + ' \u00c5';
  } else { distWrap.style.display = 'none'; }
  if (v.sasaR != null){
    sasaWrap.style.display = '';
    document.getElementById('d-sasa').textContent = v.sasaR.toFixed(1) + '% relative (' + v.sasaA.toFixed(1) + ' \u00c5\u00b2 absolute)';
  } else { sasaWrap.style.display = 'none'; }

  const ddgWrap = document.getElementById('d-ddg-wrap');
  const hbondWrap = document.getElementById('d-hbond-wrap');
  if (v.ddg != null){
    ddgWrap.style.display = '';
    const sign = v.ddg > 0 ? '+' : '';
    document.getElementById('d-ddg').textContent = sign + v.ddg.toFixed(2) + ' kcal/mol';
  } else { ddgWrap.style.display = 'none'; }
  if (v.whb != null){
    hbondWrap.style.display = '';
    let txt = v.whb + ' measured contact' + (v.whb===1?'':'s') + ' (wild type)';
    if (v.mhb != null) txt += ' \u2192 ' + v.mhb + ' theoretical capacity (mutant, by chemistry)';
    document.getElementById('d-hbond').textContent = txt;
  } else { hbondWrap.style.display = 'none'; }
  document.getElementById('d-observation').textContent = v.ob || 'No observation generated.';
  document.getElementById('d-impact').textContent = v.si || 'No structural impact generated.';

  const flags = v.fl || [];
  document.getElementById('d-flags').innerHTML = flags.length
    ? flags.map(f=>`<span class="dflag"><i></i>${f}</span>`).join('')
    : `<span class="dflag" style="opacity:.6"><i style="background:#5C6B8A;"></i>No catalytic/disulfide flag on this residue</span>`;

  drawMiniRuler(v.rs);
  renderMiniViewer(v);

  panel.scrollIntoView({behavior:'smooth', block:'nearest'});
}

async function renderMiniViewer(v){
  const el = document.getElementById('mini-viewer');
  const dm = v.dm;

  // Gla-domain variants: show the real Gla NMR fragment (1CFH), no per-residue highlight
  // (no verified numbering map exists for this domain yet).
  if (dm === 'Gla'){
    viewerMessage(el, 'Loading Gla domain fragment (1CFH)\u2026', false);
    try{
      const pdb = await loadPDBText(GLA_PDB);
      el.innerHTML = '';
      miniViewer = $3Dmol.createViewer(el, {backgroundColor:'#0A0F1D'});
      miniViewer.addModel(pdb, 'pdb');
      miniViewer.setStyle({}, {cartoon:{color:'spectrum'}});
      miniViewer.zoomTo();
      miniViewer.render();
    } catch(err){
      viewerMessage(el, 'Structure failed to load.<br>' + (err.message||'Unknown error'), true);
    }
    return;
  }

  // EGF2 / Serine Protease variants: real per-residue highlighting on 6MV4, using the
  // verified sequence-alignment numbering map (see Methodology). v.cn is this variant's
  // exact position in 6MV4's own chain+chymotrypsin numbering.
  if ((dm === 'EGF2' || dm === 'Serine Protease')){
    viewerMessage(el, 'Loading EGF2/protease domain (6MV4)\u2026', false);
    try{
      const pdb = await loadPDBText(CATALYTIC_PDB);
      el.innerHTML = '';
      miniViewer = $3Dmol.createViewer(el, {backgroundColor:'#0A0F1D'});
      miniViewer.addModel(pdb, 'pdb');
      miniViewer.setStyle({}, {cartoon:{color:'spectrum'}});
      CATALYTIC_TRIAD_AUTH.forEach(r=>{
        miniViewer.addStyle({chain:r.chain, resi:r.resi}, {stick:{color:'yellow', radius:0.35}});
      });
      if (v.cn){
        const chain = (dm === 'EGF2') ? 'L' : 'H';
        miniViewer.addStyle({chain:chain, resi:v.cn}, {stick:{color:'red', radius:0.45}});
        miniViewer.zoomTo({chain:chain, resi:v.cn});
      } else {
        miniViewer.zoomTo({chain:'H', resi:195});
      }
      miniViewer.render();
    } catch(err){
      viewerMessage(el, 'Structure failed to load.<br>' + (err.message||'Unknown error'), true);
    }
    return;
  }

  // Everything else (Signal Peptide, Propeptide, EGF1, Linker, Activation Peptide):
  // no experimental structure currently in this atlas covers this region. Say so plainly
  // rather than showing an unrelated structure.
  viewerMessage(el, `No experimental structure in this atlas currently covers the ${DOMAIN_LABEL[dm]||dm||'unresolved'} region.<br><br>1CFH covers only the Gla domain; 6MV4 covers only EGF2 + the catalytic protease domain.`, false);
}

/* ===================== MAIN 3D VIEWER ===================== */
async function renderMainViewer(){
  const el = document.getElementById('main-viewer');
  viewerMessage(el, 'Loading PDB 6MV4 (EGF2 + protease domain) from RCSB\u2026', false);
  try{
    const pdb = await loadPDBText(CATALYTIC_PDB);
    el.innerHTML = '';
    const viewer = $3Dmol.createViewer(el, {backgroundColor:'#0A0F1D'});
    viewer.addModel(pdb, 'pdb');
    viewer.setStyle({}, {cartoon:{color:'spectrum'}});
    CATALYTIC_TRIAD_AUTH.forEach(r=>{
      viewer.addStyle({chain:r.chain, resi:r.resi}, {stick:{color:'yellow', radius:0.35}});
    });
    viewer.zoomTo();
    viewer.render();
    viewer.spin('y', 0.4);
  } catch(err){
    console.error('Main structure viewer failed:', err);
    viewerMessage(el, 'Structure failed to load.<br>' + (err.message||'Unknown error') + '<br><br>This loads live from files.rcsb.org \u2014 check your connection or try refreshing.', true);
  }
}

/* ===================== INIT ===================== */
renderStats();
drawRuler('ruler-svg', {showLabels:true, showTicks:true});
document.getElementById('ruler-legend').innerHTML =
  `<span><i style="background:#E8C547;"></i>Catalytic residue (confirmed)</span><span><i style="background:#7DA9C4;"></i>Disulfide cysteine</span>`;
renderFigures();
populateDomainFilter();
applyFilters();
renderMainViewer();
