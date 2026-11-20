// Filtering and spoiler rules: pure functions over the trophy list, no DOM here.
export const GRADES = ['platinum', 'gold', 'silver', 'bronze'];

// A trophy is spoilered when spoiler mode is on, it is a story trophy, and it is not earned yet.
// Earned trophies always show, whatever the mode. The platinum is exempt: it is the goal
// of this guide, so its name is always shown (hero line, roadmap, checklist).
export function isSpoilered(trophy, spoilerOn, earned) {
  if (trophy.grade === 'platinum') return false;
  return spoilerOn && trophy.kinds.includes('story') && !earned.has(trophy.name);
}

// All filters combine: grade, kind, text search (name, description, guide) and hide-earned.
// Missing fields default to 'all' (only query was already tolerant).
export function applyFilters(trophies, filters, earned) {
  const query = (filters.query ?? '').trim().toLowerCase();
  const grade = filters.grade ?? 'all';
  const kind = filters.kind ?? 'all';
  return trophies.filter((t) => {
    if (grade !== 'all' && t.grade !== grade) return false;
    if (kind !== 'all' && !t.kinds.includes(kind)) return false;
    if (filters.hideEarned && earned.has(t.name)) return false;
    if (query) {
      const hay = `${t.name} ${t.description} ${t.guide}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });
}

export function countByGrade(trophies, earned) {
  const out = {};
  for (const g of GRADES) {
    const total = trophies.filter((t) => t.grade === g).length;
    const done = trophies.filter((t) => t.grade === g && earned.has(t.name)).length;
    out[g] = { done, total };
  }
  return out;
}
