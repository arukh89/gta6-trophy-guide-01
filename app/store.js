// Progress store: earned trophies, counters, notes and the spoiler setting, saved in
// localStorage only. Nothing leaves the browser except the export file the reader downloads.
const EARNED_KEY = 'leonida-trophy-earned-v1';
const SPOILER_KEY = 'leonida-trophy-spoiler-v1';
const COUNTERS_KEY = 'leonida-trophy-counters-v1';
const NOTES_KEY = 'leonida-trophy-notes-v1';

export function loadEarned() {
  try {
    const raw = JSON.parse(localStorage.getItem(EARNED_KEY) ?? '[]');
    return new Set(Array.isArray(raw) ? raw.filter((n) => typeof n === 'string') : []);
  } catch {
    return new Set();
  }
}

export function saveEarned(earned) {
  try {
    localStorage.setItem(EARNED_KEY, JSON.stringify([...earned]));
    return true;
  } catch {
    return false;
  }
}

// Clamp a counter to its trophy's range: a whole number from 0 to target.
// Non-numbers, negatives and values above target are normalised, never thrown.
// Trophies without a target have no counter, so any value clamps to 0.
export function clampCount(value, target) {
  if (target == null || !(target > 0)) return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(Math.floor(n), target));
}

export function loadCounters() {
  try {
    const raw = JSON.parse(localStorage.getItem(COUNTERS_KEY) ?? '{}');
    const out = new Map();
    if (raw && typeof raw === 'object') {
      for (const [name, value] of Object.entries(raw)) {
        const n = Number(value);
        if (typeof name === 'string' && Number.isFinite(n) && n > 0) out.set(name, Math.floor(n));
      }
    }
    return out;
  } catch {
    return new Map();
  }
}

export function saveCounters(counters) {
  const obj = {};
  for (const [name, value] of counters) {
    if (value > 0) obj[name] = value;
  }
  try {
    localStorage.setItem(COUNTERS_KEY, JSON.stringify(obj));
    return true;
  } catch {
    return false;
  }
}

export function loadNotes() {
  try {
    const raw = JSON.parse(localStorage.getItem(NOTES_KEY) ?? '{}');
    const out = new Map();
    if (raw && typeof raw === 'object') {
      for (const [name, text] of Object.entries(raw)) {
        if (typeof name === 'string' && typeof text === 'string' && text.trim()) out.set(name, text);
      }
    }
    return out;
  } catch {
    return new Map();
  }
}

export function saveNotes(notes) {
  const obj = {};
  for (const [name, text] of notes) {
    if (text.trim()) obj[name] = text;
  }
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(obj));
    return true;
  } catch {
    return false;
  }
}

// Every localStorage access is guarded: a blocked or full storage must never throw
// into the app. Loads fall back to empty/default; saves return false so the caller
// can keep going in memory and warn once instead of leaving the UI stale.
export function loadSpoiler() {
  try {
    return localStorage.getItem(SPOILER_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function saveSpoiler(on) {
  try {
    localStorage.setItem(SPOILER_KEY, on ? 'on' : 'off');
    return true;
  } catch {
    return false;
  }
}

export function downloadExport({ earned, counters, notes }) {
  const payload = {
    game: 'Grand Theft Auto VI',
    guide: 'Leonida Trophy Guide',
    exported_at: new Date().toISOString(),
    earned: [...earned].sort(),
    counters: Object.fromEntries([...counters].filter(([, v]) => v > 0)),
    notes: Object.fromEntries([...notes]),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'leonida-trophy-progress.json';
  a.click();
  // Revoke after a short delay, not synchronously: some browsers need the URL
  // to outlive the click dispatch for the download to start.
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Reads an import file's text and folds it into earned, counters and notes.
// Accepts an array of trophy names, or an object with "earned", "counters" and
// "notes" (our export format). Unknown names are ignored and counted, counters are
// clamped to their trophy's target, so a file from another guide cannot corrupt progress.
// byName maps trophy name -> trophy (for target clamping). Returns
// { added, unknown, total, countersAdded, notesAdded, saved, earned, counters, notes }:
// saved is false when a write to storage failed (state still applies in memory).
export function importProgressText(text, knownNames, byName) {
  const parsed = JSON.parse(text);
  const names = Array.isArray(parsed) ? parsed : parsed.earned;
  if (!Array.isArray(names)) throw new Error('not a progress file');
  let added = 0;
  let unknown = 0;
  const earned = loadEarned();
  for (const name of names) {
    if (typeof name !== 'string') { unknown += 1; continue; }
    if (!knownNames.has(name)) { unknown += 1; continue; }
    if (!earned.has(name)) { earned.add(name); added += 1; }
  }
  const savedEarned = saveEarned(earned);
  let countersAdded = 0;
  let notesAdded = 0;
  const counters = loadCounters();
  const notes = loadNotes();
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    if (parsed.counters && typeof parsed.counters === 'object') {
      for (const [name, value] of Object.entries(parsed.counters)) {
        const t = byName ? byName.get(name) : undefined;
        // Only a name no trophy carries counts as unknown. A known trophy
        // without a PSN target simply has no counter to import — skip it.
        if (!t) { unknown += 1; continue; }
        if (t.target == null) continue;
        const n = clampCount(value, t.target);
        if (n > 0 && counters.get(name) !== n) { counters.set(name, n); countersAdded += 1; }
      }
    }
    if (parsed.notes && typeof parsed.notes === 'object') {
      for (const [name, value] of Object.entries(parsed.notes)) {
        if (!knownNames.has(name) || typeof value !== 'string' || !value.trim()) { unknown += 1; continue; }
        if (notes.get(name) !== value) { notes.set(name, value); notesAdded += 1; }
      }
    }
  }
  const saved = savedEarned && saveCounters(counters) && saveNotes(notes);
  return { added, unknown, total: names.length, countersAdded, notesAdded, saved, earned, counters, notes };
}
