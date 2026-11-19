// Demo seed for ?demo=1: a fixed, deterministic example state so the screenshots
// (and any first-time reader) see the guide alive — progress, counters, notes.
// Pure data, no DOM, no browser storage: the app holds this in memory only and never
// writes it over the reader's real progress.
export function demoState() {
  return {
    // 13 earned: the first five story chapters, plus a spread of activities,
    // stranger strands and partner missions.
    earned: [
      'Just Like Paradise',
      'Paradise Lost',
      'T**s Ass Drug Money',
      'Vice City, Baby!',
      'Top Of The World, Ma',
      'Baited My Tackle',
      'Stick Fiddler',
      'Road to Rehabilitation',
      'This Was No Boat Accident',
      'Hot Together',
      'Challenging Tank',
      'A Classic Blitz Play',
      'Let’s Go Bowling',
    ],
    // Counters about halfway to their PSN targets.
    counts: {
      'Cunning Stunts': 125,
      'The Shootist': 21,
      'You WAiNKer!': 50,
      'Whip It Good': 50,
      'Dime on the Dollar': 125000,
    },
    // Two example notes, in the reader's voice.
    notes: {
      'Retail Therapy': 'Do this on a fresh save — three shops back to back, no wasted trips.',
      'The Shootist': 'Range sessions first: pistol, cheapest ammo, then work up.',
    },
  };
}
