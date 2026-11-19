// Leonida Trophy Guide — boot, render and wiring. Data lives in data/trophies.json;
// progress, counters, notes and the spoiler setting live in store.js; filtering rules
// live in filters.js; the next-up picks live in planner.js; the demo seed in demo.js.
// Demo mode (?demo=1) holds its state in memory only and never writes localStorage.
import { loadEarned, saveEarned, loadSpoiler, saveSpoiler, loadCounters, saveCounters, loadNotes, saveNotes, clampCount, downloadExport, importProgressText } from './store.js';
import { applyFilters, countByGrade, isSpoilered } from './filters.js';
import { planNextUp } from './planner.js';
import { demoState } from './demo.js';

const doc = await (await fetch('data/trophies.json')).json();
const trophies = doc.trophies;
const knownNames = new Set(trophies.map((t) => t.name));
const byName = new Map(trophies.map((t) => [t.name, t]));
const byId = new Map(trophies.map((t) => [t.id, t]));

const demo = new URLSearchParams(location.search).get('demo') === '1';
const seed = demo ? demoState() : null;
let earned = demo ? new Set(seed.earned) : loadEarned();
let counters = demo ? new Map(Object.entries(seed.counts)) : loadCounters();
let notes = demo ? new Map(Object.entries(seed.notes)) : loadNotes();
let spoilerOn = demo ? true : loadSpoiler();
let selected = null;
const filters = { query: '', grade: 'all', kind: 'all', hideEarned: false };

// In demo mode every persist is a no-op: the demo state lives in memory only and
// must never overwrite the reader's real progress in localStorage.
function persistEarned() { if (!demo) saveEarned(earned); }
function persistCounters() { if (!demo) saveCounters(counters); }
function persistNotes() { if (!demo) saveNotes(notes); }
function persistSpoiler() { if (!demo) saveSpoiler(spoilerOn); }

const $ = (id) => document.getElementById(id);
const gradeLabel = (g) => g.charAt(0).toUpperCase() + g.slice(1);
const countOf = (t) => counters.get(t.name) ?? 0;

function renderProgress() {
  $('progressCount').textContent = `${earned.size} of ${trophies.length} earned`;
  const pct = Math.round((earned.size / trophies.length) * 100);
  $('progressPct').textContent = `${pct}%`;
  $('progressBar').style.width = `${pct}%`;
  const counts = countByGrade(trophies, earned);
  $('gradeChips').replaceChildren();
  for (const g of ['platinum', 'gold', 'silver', 'bronze']) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = `${gradeLabel(g)} ${counts[g].done}/${counts[g].total}`;
    $('gradeChips').append(chip);
  }
  const plat = byName.get('Vice Got a Price!');
  $('platinumLine').textContent = earned.has(plat.name)
    ? 'Platinum “Vice Got a Price!” earned — you are a Leonida Legend.'
    : 'Platinum “Vice Got a Price!” unlocks when the other 54 are earned.';
}

function renderNextUp() {
  const list = $('nextUp');
  list.replaceChildren();
  const picks = planNextUp(trophies, doc.roadmap, earned, counters);
  if (picks.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'Everything is earned — the platinum is yours.';
    list.append(li);
    return;
  }
  for (const { trophy: t, kind, reason } of picks) {
    const li = document.createElement('li');
    li.className = `nextup-item ${kind}`;
    const name = document.createElement('strong');
    name.textContent = isSpoilered(t, spoilerOn, earned) ? 'Hidden story trophy' : t.name;
    const why = document.createElement('span');
    why.className = 'nextup-reason';
    why.textContent = reason;
    li.append(name, why);
    li.addEventListener('click', () => { selected = t.name; renderList(); renderDetail(); });
    list.append(li);
  }
}

function renderRoadmap() {
  const list = $('roadmap');
  list.replaceChildren();
  for (const stage of doc.roadmap) {
    const done = stage.ids.filter((id) => {
      const t = byId.get(id);
      return t && earned.has(t.name);
    }).length;
    const li = document.createElement('li');
    const h = document.createElement('h3');
    const num = document.createElement('span');
    num.className = 'stage-num';
    num.textContent = `Stage ${stage.stage}`;
    h.append(num, document.createTextNode(stage.title));
    const p = document.createElement('p');
    p.textContent = stage.blurb;
    const count = document.createElement('p');
    count.className = 'stage-count';
    count.textContent = `${done} of ${stage.ids.length} earned`;
    const bar = document.createElement('div');
    bar.className = 'stage-bar';
    const fill = document.createElement('div');
    fill.style.width = `${Math.round((done / stage.ids.length) * 100)}%`;
    bar.append(fill);
    li.append(h, p, count, bar);
    list.append(li);
  }
}

function renderMissables() {
  $('missableRule').textContent = doc.missable_rule;
  const list = $('missableList');
  list.replaceChildren();
  for (const t of trophies.filter((x) => x.missable)) {
    const li = document.createElement('li');
    const strong = document.createElement('strong');
    strong.textContent = t.name;
    const flag = document.createElement('span');
    flag.className = 'flag';
    flag.textContent = 'Missable';
    const p = document.createElement('p');
    p.textContent = t.missable_note;
    li.append(strong, flag, p);
    li.addEventListener('click', () => { selected = t.name; renderList(); renderDetail(); });
    list.append(li);
  }
}

function counterBar(t) {
  const wrap = document.createElement('span');
  wrap.className = 'counter-mini';
  const n = countOf(t);
  const pct = Math.round((n / t.target) * 100);
  const bar = document.createElement('span');
  bar.className = 'counter-bar';
  const fill = document.createElement('span');
  fill.style.width = `${pct}%`;
  bar.append(fill);
  const label = document.createElement('span');
  label.className = 'counter-label';
  label.textContent = `${n}/${t.target}`;
  wrap.append(bar, label);
  return wrap;
}

function trophyRow(t) {
  const li = document.createElement('li');
  const isEarned = earned.has(t.name);
  const hidden = isSpoilered(t, spoilerOn, earned);
  if (isEarned) li.classList.add('earned');
  if (hidden) li.classList.add('spoilered');
  if (selected === t.name) li.classList.add('selected');

  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = isEarned;
  box.setAttribute('aria-label', `Mark ${hidden ? 'hidden story trophy' : t.name} earned`);
  box.addEventListener('click', (e) => e.stopPropagation());
  box.addEventListener('change', () => {
    if (box.checked) earned.add(t.name);
    else earned.delete(t.name);
    persistEarned();
    renderAll();
  });

  const name = document.createElement('span');
  name.className = 't-name';
  name.textContent = hidden ? 'Hidden story trophy' : t.name;

  const badge = document.createElement('span');
  badge.className = `badge ${t.grade}`;
  badge.textContent = t.grade;

  const desc = document.createElement('span');
  desc.className = 't-desc';
  desc.textContent = hidden ? 'Hidden story trophy — earn it to reveal.' : t.description;

  const meta = document.createElement('span');
  meta.className = 't-meta';
  meta.append(badge);
  if (!hidden && t.target !== null) {
    const tag = document.createElement('span');
    tag.className = 'target-tag';
    tag.textContent = `PSN ${countOf(t)}/${t.target} ${t.target_label}`;
    meta.append(tag);
    meta.append(counterBar(t));
  }
  for (const kind of t.kinds) {
    const tag = document.createElement('span');
    tag.className = 'kind-tag';
    tag.textContent = kind;
    meta.append(tag);
  }
  if (t.hidden && !hidden) {
    const tag = document.createElement('span');
    tag.className = 'hidden-tag';
    tag.textContent = 'Hidden on PSN';
    meta.append(tag);
  }
  if (t.missable && !hidden) {
    const tag = document.createElement('span');
    tag.className = 'flag';
    tag.textContent = 'Missable';
    meta.append(tag);
  }
  if (!hidden && notes.has(t.name)) {
    const tag = document.createElement('span');
    tag.className = 'note-tag';
    tag.textContent = 'note';
    meta.append(tag);
  }

  li.append(box, name, desc, meta);
  li.addEventListener('click', () => { selected = t.name; renderList(); renderDetail(); });
  return li;
}

function renderList() {
  const shown = applyFilters(trophies, filters, earned);
  const list = $('trophyList');
  list.replaceChildren();
  for (const t of shown) list.append(trophyRow(t));
  $('resultCount').textContent = `Showing ${shown.length} of ${trophies.length} trophies` +
    (filters.grade !== 'all' || filters.kind !== 'all' || filters.query || filters.hideEarned ? ' — filters active' : '');
}

function setCounter(t, value) {
  const n = clampCount(value, t.target);
  if (n === 0) counters.delete(t.name);
  else counters.set(t.name, n);
  persistCounters();
  renderAll();
}

function renderDetail() {
  const panel = $('detail');
  if (!selected) return;
  const t = byName.get(selected);
  const hidden = isSpoilered(t, spoilerOn, earned);
  panel.replaceChildren();
  const h = document.createElement('h2');
  h.textContent = hidden ? 'Hidden story trophy' : t.name;
  panel.append(h);
  const badge = document.createElement('span');
  badge.className = `badge ${t.grade}`;
  badge.textContent = t.grade;
  panel.append(badge);
  if (hidden) {
    const p = document.createElement('p');
    p.className = 't-desc';
    p.textContent = 'Spoiler mode is on and this story trophy is not earned yet, so its name, description and guide stay hidden. Earn it in the game, tick it off, and it reveals itself here.';
    panel.append(p);
    return;
  }
  const desc = document.createElement('p');
  desc.className = 't-desc';
  desc.textContent = t.description;
  panel.append(desc);
  if (t.target !== null) {
    const target = document.createElement('p');
    target.textContent = `PSN target: ${countOf(t)}/${t.target} ${t.target_label}.`;
    panel.append(target);
    const row = document.createElement('div');
    row.className = 'counter-row';
    const minus = document.createElement('button');
    minus.type = 'button';
    minus.className = 'count-btn';
    minus.textContent = '−';
    minus.setAttribute('aria-label', 'Decrease count by 1');
    minus.addEventListener('click', () => setCounter(t, countOf(t) - 1));
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.max = String(t.target);
    input.value = String(countOf(t));
    input.setAttribute('aria-label', `Your count towards ${t.target} ${t.target_label}`);
    input.addEventListener('change', () => setCounter(t, input.value));
    const plus = document.createElement('button');
    plus.type = 'button';
    plus.className = 'count-btn';
    plus.textContent = '+';
    plus.setAttribute('aria-label', 'Increase count by 1');
    plus.addEventListener('click', () => setCounter(t, countOf(t) + 1));
    const bar = document.createElement('div');
    bar.className = 'counter-bar big';
    const fill = document.createElement('div');
    fill.style.width = `${Math.round((countOf(t) / t.target) * 100)}%`;
    bar.append(fill);
    row.append(minus, input, plus, bar);
    panel.append(row);
  }
  const guideHead = document.createElement('h3');
  guideHead.textContent = 'Guide';
  const guide = document.createElement('p');
  guide.textContent = t.guide;
  panel.append(guideHead, guide);
  if (t.missable) {
    const note = document.createElement('p');
    note.className = 'missable-note';
    note.textContent = t.missable_note;
    panel.append(note);
  }
  const noteHead = document.createElement('h3');
  noteHead.textContent = 'Your notes';
  const area = document.createElement('textarea');
  area.id = 'noteArea';
  area.rows = 3;
  area.placeholder = 'Your own reminder for this trophy — saved in this browser only.';
  area.value = notes.get(t.name) ?? '';
  area.addEventListener('input', () => {
    const text = area.value;
    if (text.trim()) notes.set(t.name, text);
    else notes.delete(t.name);
    persistNotes();
    renderList();
  });
  panel.append(noteHead, area);
  const srcHead = document.createElement('h3');
  srcHead.textContent = 'Sources';
  const ul = document.createElement('ul');
  ul.className = 'sources';
  for (const s of t.sources) {
    const li = document.createElement('li');
    li.textContent = s;
    ul.append(li);
  }
  panel.append(srcHead, ul);
  const note = document.createElement('p');
  note.className = 'sources';
  note.textContent = doc.sources_note;
  panel.append(note);
}

function renderAll() {
  renderProgress();
  renderNextUp();
  renderRoadmap();
  renderList();
  renderDetail();
}

$('search').addEventListener('input', (e) => { filters.query = e.target.value; renderList(); });
$('gradeFilter').addEventListener('change', (e) => { filters.grade = e.target.value; renderList(); });
$('kindFilter').addEventListener('change', (e) => { filters.kind = e.target.value; renderList(); });
$('hideEarned').addEventListener('change', (e) => { filters.hideEarned = e.target.checked; renderList(); });
$('spoilerToggle').checked = spoilerOn;
$('spoilerToggle').addEventListener('change', (e) => {
  spoilerOn = e.target.checked;
  persistSpoiler();
  renderAll();
});
$('exportBtn').addEventListener('click', () => downloadExport({ earned, counters, notes }));
$('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (demo) {
    $('importMsg').textContent = 'Demo mode: import is off here — exit demo to import your own progress.';
    e.target.value = '';
    return;
  }
  try {
    const result = await importProgressText(await file.text(), knownNames, byName);
    earned = result.earned;
    counters = result.counters;
    notes = result.notes;
    const bits = [`Imported ${result.added} new trophies from ${result.total} names`];
    if (result.countersAdded) bits.push(`${result.countersAdded} counters`);
    if (result.notesAdded) bits.push(`${result.notesAdded} notes`);
    $('importMsg').textContent = bits.join(', ') +
      (result.unknown ? ` (${result.unknown} names not recognised, ignored).` : '.');
    renderAll();
  } catch {
    $('importMsg').textContent = 'That file is not valid progress JSON — nothing was changed.';
  }
  e.target.value = '';
});

// Keyboard shortcuts: never hijack typing inside an input, textarea or select.
document.addEventListener('keydown', (e) => {
  const el = e.target;
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === '/') {
    e.preventDefault();
    $('search').focus();
  } else if (e.key === 's') {
    spoilerOn = !spoilerOn;
    $('spoilerToggle').checked = spoilerOn;
    persistSpoiler();
    renderAll();
  } else if (e.key === 'h') {
    filters.hideEarned = !filters.hideEarned;
    $('hideEarned').checked = filters.hideEarned;
    renderList();
  } else if (e.key === '?') {
    const box = $('shortcuts');
    box.open = !box.open;
    if (box.open) box.scrollIntoView({ block: 'nearest' });
  }
});

if (demo) {
  const banner = $('demoBanner');
  banner.hidden = false;
  $('exitDemo').addEventListener('click', () => {
    const url = new URL(location.href);
    url.searchParams.delete('demo');
    location.href = url.toString();
  });
}

$('sourcesNote').textContent = doc.sources_note;
renderMissables();
renderAll();
