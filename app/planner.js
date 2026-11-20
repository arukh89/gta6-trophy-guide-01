// Next-up planner: pure functions over the trophy list, no DOM here.
// Picks the next 5 trophies to chase, in this order:
//   (a) unearned missables first, in trophy order — they can be lost for good;
//   (b) then unearned counted trophies closest to done (highest count/target);
//   (c) then unearned trophies from the current roadmap stage, in stage order.
// Earned trophies never appear. Deterministic: ties break by trophy id.
// Counts are clamped through store.js's clampCount, the one canonical clamp.
import { clampCount } from './store.js';

export function ratioFor(trophy, counts) {
  if (!trophy || trophy.target == null || trophy.target <= 0) return 0;
  const raw = counts instanceof Map ? counts.get(trophy.name) : counts?.[trophy.name];
  return clampCount(raw, trophy.target) / trophy.target;
}

// How many unearned missables did the 5-pick cap cut off? The app shows this as
// "+N more missable below" under Next-up, so the 6th missable is never silently hidden.
export function countCutMissables(trophies, earned, picks) {
  const done = earned instanceof Set ? earned : new Set(earned ?? []);
  const total = trophies.filter((t) => t.missable && !done.has(t.name)).length;
  const shown = (picks ?? []).filter((p) => p.kind === 'missable').length;
  return Math.max(0, total - shown);
}

export function planNextUp(trophies, roadmap, earned, counts) {
  const done = earned instanceof Set ? earned : new Set(earned ?? []);
  const countOf = (t) => {
    const raw = counts instanceof Map ? counts.get(t.name) : counts?.[t.name];
    return clampCount(raw, t.target ?? null);
  };
  const out = [];
  const push = (t, kind, reason) => {
    if (out.length >= 5) return;
    if (done.has(t.name)) return;
    if (out.some((x) => x.trophy.name === t.name)) return;
    out.push({ trophy: t, kind, reason });
  };

  // (a) Missables first.
  for (const t of [...trophies].sort((a, b) => a.id - b.id)) {
    if (t.missable) push(t, 'missable', 'Missable — do it before it is gone.');
  }
  // (b) Counted trophies closest to done.
  const counted = trophies
    .filter((t) => t.target != null && t.target > 0)
    .map((t) => ({ t, ratio: ratioFor(t, counts) }))
    .sort((a, b) => b.ratio - a.ratio || a.t.id - b.t.id);
  for (const { t, ratio } of counted) {
    if (ratio <= 0) continue;
    const label = t.target_label ? ` ${t.target_label}` : '';
    push(t, 'progress', `${countOf(t)}/${t.target}${label} — closest to done.`);
  }
  // (c) Current roadmap stage: the first stage with anything unearned.
  const byId = new Map(trophies.map((t) => [t.id, t]));
  for (const stage of [...(roadmap ?? [])].sort((a, b) => a.stage - b.stage)) {
    const rest = stage.ids.map((id) => byId.get(id)).filter((t) => t && !done.has(t.name));
    if (rest.length === 0) continue;
    for (const t of rest) push(t, 'stage', `Stage ${stage.stage} — next in your roadmap.`);
    break;
  }
  return out.slice(0, 5);
}
