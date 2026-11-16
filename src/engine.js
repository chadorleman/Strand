/* ==========================================================================
   STRAND ENGINE  —  rules only, no screen code.
   Shared by every module (habits now; nutrition later) so there is one
   points ledger and one set of rules. Nothing in here touches the page.
   ========================================================================== */
(function (root) {
'use strict';

var SCHEMA = 1;

/* ==========================================================================
   SETTINGS BLOCK  —  every tunable number lives here.
   Edit them in the tool under Settings, or directly in the data file under
   "settings". These are starting values, not laws.
   ========================================================================== */
var DEFAULT_SETTINGS = {
  weekStartsOn: 1,                    // 1 = Monday (so Sunday's Watchtower prep closes the week)
  backfillDays: 7,                    // how many past days the deck lets you check in for

  points: {
    integrity: 3,                     // fixed reward for logging a negative honestly
    bond: 5,                          // a routine completed in one day
    stableMolecule: 15                // every daily habit done, in every category
  },

  activeDay: { minCheckins: 1 },      // fewer positives than this = a missed day (a gap)

  // Occasional habits (the whole-day fast): never in a daily total, never "missed".
  // Each consecutive day pays this many times the day before. No thinning.
  streakGrowth: 1.20,

  // Stable molecule: each listed domain must reach this share of the set weight of its
  // daily habits active that day. Domains not listed (career, financial) never gate it.
  molecule: { health: 0.70, spiritual: 0.70 },

  stableWeek: {
    solidDayWeightPct: 0.40,          // a "solid day": all positive check-ins reach this share of the day's daily weight
    minSolidDays: 5                   // a week with this many solid days closes stable: gains bond, a shield is earned
  },

  // Rules never rewrite the past. Days before this date are judged by the rules that
  // were in force when they were logged (all daily habits for a molecule, a check-in
  // count for a solid day). Empty = the current rules everywhere (new files).
  rulesSince: '',
  legacyRules: { fractionPerCategory: 1, solidDayMinCheckins: 4 },

  shields: { starting: 1, max: 3, perStableWeek: 1 },

  // Reward thinning: as a habit's streak matures, base pay drops and bonus odds rise.
  // Streak is counted in days (weekly habits: weeks x 7).
  thinning: [
    { minStreak: 0,  basePct: 1.00, bonusChance: 0.10 },
    { minStreak: 7,  basePct: 0.85, bonusChance: 0.16 },
    { minStreak: 21, basePct: 0.70, bonusChance: 0.22 },
    { minStreak: 45, basePct: 0.60, bonusChance: 0.30 }
  ],

  // Variable bonuses. "share" = how often this kind comes up among bonuses,
  // "mult" = extra points as a multiple of the habit's full weight.
  bonuses: [
    { id: 'crit',  name: 'Crit',         share: 0.60, mult: 1 },
    { id: 'chest', name: 'Vesicle',      share: 0.30, mult: 2 },
    { id: 'rare',  name: 'Rare isotope', share: 0.10, mult: 4 }
  ],

  clawback: {
    dayCap: 40,                       // most that one day can cost
    weekCap: 90,                      // most that any 7 days in a row can cost
    rollingDays: 7
  },

  repair: {
    rate: 0.60,                       // share of the clawed-back points one recovery action re-earns
    // The pool of recovery actions. Each negative habit offers its own list (habit.repairActions).
    // An action can seal one repair a day.
    actions: [
      { id: 'hydrate',    label: 'Drink 16 oz of water' },
      { id: 'walk',       label: 'Walk for 10 minutes' },
      { id: 'reflect',    label: 'Write down what led to it' },
      { id: 'still',      label: 'Five extra minutes of mindfulness' },
      { id: 'pushups',    label: 'An extra set of push-ups' },
      { id: 'coldShower', label: 'Take a cold shower' },
      { id: 'journal',    label: 'Journal about it' },
      { id: 'pray',       label: 'Pray about it' },
      { id: 'scripture',  label: 'Read an extra Bible passage' },
      { id: 'phoneOut',   label: 'Put the phone outside the bedroom tonight' }
    ]
  },

  // Growth stages. "at" = total points. "media: true" opens a film slot.
  stages: [
    { id: 'nucleotide',   phase: 'Strand',   name: 'Nucleotide',     at: 0 },
    { id: 'codon',        phase: 'Strand',   name: 'Codon',          at: 50 },
    { id: 'primer',       phase: 'Strand',   name: 'Primer',         at: 130 },
    { id: 'gene',         phase: 'Strand',   name: 'Gene',           at: 250 },
    { id: 'operon',       phase: 'Strand',   name: 'Operon',         at: 420 },
    { id: 'chromatin',    phase: 'Strand',   name: 'Chromatin',      at: 650 },
    { id: 'chromosome',   phase: 'Strand',   name: 'Chromosome',     at: 900 },
    { id: 'protocell',    phase: 'Cell',     name: 'Protocell',      at: 1200, media: true },
    { id: 'membrane',     phase: 'Cell',     name: 'Membrane',       at: 1550 },
    { id: 'nucleus',      phase: 'Cell',     name: 'Nucleus',        at: 1950 },
    { id: 'mitochondria', phase: 'Cell',     name: 'Mitochondria',   at: 2400 },
    { id: 'eukaryote',    phase: 'Cell',     name: 'Eukaryote',      at: 2900, media: true },
    { id: 'mitosis',      phase: 'Cell',     name: 'Mitosis',        at: 3450 },
    { id: 'colony',       phase: 'Organism', name: 'Colony',         at: 4050, media: true },
    { id: 'tissue',       phase: 'Organism', name: 'Tissue',         at: 4700 },
    { id: 'organ',        phase: 'Organism', name: 'Organ',          at: 5400 },
    { id: 'nerve',        phase: 'Organism', name: 'Nervous system', at: 6150 },
    { id: 'embryo',       phase: 'Organism', name: 'Embryo',         at: 6950, media: true },
    { id: 'organism',     phase: 'Organism', name: 'Organism',       at: 7800, media: true }
  ],
  stageOverflowStep: 900,             // after the last stage: a new "Generation" every this many points
  stageOverflowMediaEvery: 4,         // every Nth generation opens a film slot

  // Genes. Every week that closes stable earns one pick from "traitOfferCount" of these.
  // A pick is permanent and works from the day it is made. "per" = what one level adds.
  // effect types: shieldMax, repairRate, bonusChance (needs category), bondPoints, moleculePoints
  traitOfferCount: 3,
  traits: [
    { id: 'membrane',   name: 'Thicker membrane',   text: 'Hold one more shield',                    max: 2, effect: { type: 'shieldMax', per: 1 } },
    { id: 'ligase',     name: 'Faster ligase',      text: 'A repair re-earns 10% more',              max: 3, effect: { type: 'repairRate', per: 0.10 } },
    { id: 'healthExpr', name: 'Health promoter',    text: '+5% bonus odds on every health habit',    max: 3, effect: { type: 'bonusChance', category: 'health', per: 0.05 } },
    { id: 'spiritExpr', name: 'Spiritual promoter', text: '+5% bonus odds on every spiritual habit', max: 3, effect: { type: 'bonusChance', category: 'spiritual', per: 0.05 } },
    { id: 'bondStrength', name: 'Tighter bonds',    text: '+2 for every routine bond',               max: 3, effect: { type: 'bondPoints', per: 2 } },
    { id: 'stableCore', name: 'Stable core',        text: '+5 for every stable molecule',            max: 3, effect: { type: 'moleculePoints', per: 5 } }
  ],
  bonusChanceCap: 0.6,

  // Milestone compounds. Each one completed opens a collectible card slot.
  compounds: [
    { id: 'glycine',    name: 'Glycine',    formula: 'C2H5NO2',        rule: { stableDays: 5 },   note: 'Five stable molecules' },
    { id: 'ribose',     name: 'Ribose',     formula: 'C5H10O5',        rule: { bondedWeeks: 1 },  note: 'First week bonded' },
    { id: 'adenine',    name: 'Adenine',    formula: 'C5H5N5',         rule: { stableDays: 15 },  note: 'Fifteen stable molecules' },
    { id: 'atp',        name: 'ATP',        formula: 'C10H16N5O13P3',  rule: { chain: 14 },       note: 'A 14-day chain' },
    { id: 'ligase',     name: 'Ligase',     formula: 'repair enzyme',  rule: { repairs: 3 },      note: 'Three pairs repaired' },
    { id: 'serotonin',  name: 'Serotonin',  formula: 'C10H12N2O',      rule: { stableDays: 40 },  note: 'Forty stable molecules' },
    { id: 'histone',    name: 'Histone',    formula: 'packing protein', rule: { bondedWeeks: 4 }, note: 'Four weeks bonded' },
    { id: 'telomerase', name: 'Telomerase', formula: 'end keeper',     rule: { chain: 60 },       note: 'A 60-day chain' }
  ]
};
/* ======================= end of settings block ============================ */

/* The habits. Content is settled; weights are yours to change. */
var DEFAULT_HABITS = [
  { id: 'sleep',       name: 'Sleep, 7 or more hours',            short: 'Sleep',       sym: 'Sl', category: 'health',    kind: 'positive', cadence: 'daily',  weight: 10, hue: 222 },
  { id: 'water',       name: 'Water, 32 oz',                      short: 'Water',       sym: 'Aq', category: 'health',    kind: 'positive', cadence: 'daily',  weight: 5,  hue: 192 },
  { id: 'fasting',     name: 'Intermittent fasting window kept',  short: 'Fasting',     sym: 'Fa', category: 'health',    kind: 'positive', cadence: 'daily',  weight: 10, hue: 172 },
  { id: 'pushups',     name: 'Push-ups',                          short: 'Push-ups',    sym: 'Pu', category: 'health',    kind: 'positive', cadence: 'daily',  weight: 8,  hue: 152 },
  { id: 'gym',         name: 'Gym session',                       short: 'Gym',         sym: 'Gy', category: 'health',    kind: 'positive', cadence: 'weekly', weeklyTarget: 2, beyondTarget: true, weight: 20, hue: 136 },
  { id: 'mindfulness', name: 'Daily mindfulness session',         short: 'Mindfulness', sym: 'Mi', category: 'health',    kind: 'positive', cadence: 'daily',  weight: 8,  hue: 204 },
  { id: 'vitamins',    name: 'Vitamins and supplements',          short: 'Vitamins',    sym: 'Vi', category: 'health',    kind: 'positive', cadence: 'daily',  weight: 3,  hue: 162 },
  { id: 'walk',        name: 'Walk',                              short: 'Walk',        sym: 'Wk', category: 'health',    kind: 'positive', cadence: 'daily',  weight: 5,  hue: 112, repairAction: 'walk', addedOn: '2026-11-16' },
  { id: 'wholeFast',   name: 'Whole-day fast',                    short: 'Full fast',   sym: 'Fx', category: 'health',    kind: 'positive', cadence: 'occasional', weight: 25, hue: 186, addedOn: '2026-11-16' },
  { id: 'alcohol',     name: 'Alcohol intake',                    short: 'Alcohol',     sym: 'Et', category: 'health',    kind: 'negative', cadence: 'event',  weight: 12, unit: 'drink', hue: 344, repairActions: ['hydrate', 'walk', 'reflect', 'still'] },
  { id: 'soloTime',    name: 'Solo time',                         short: 'Solo time',   sym: 'So', category: 'health',    kind: 'negative', cadence: 'event',  weight: 10, unit: 'time', single: true, hue: 318, addedOn: '2026-11-16', repairActions: ['walk', 'pushups', 'coldShower', 'still', 'reflect', 'journal', 'pray', 'scripture'] },
  { id: 'dailyText',   name: 'Daily text read',                   short: 'Daily text',  sym: 'Dt', category: 'spiritual', kind: 'positive', cadence: 'daily',  weight: 5,  hue: 46 },
  { id: 'bible',       name: 'Daily Bible reading',               short: 'Bible reading', sym: 'Br', category: 'spiritual', kind: 'positive', cadence: 'daily', weight: 8, hue: 36 },
  { id: 'lateBrowsing', name: 'Late browsing',                   short: 'Late browsing', sym: 'Lb', category: 'spiritual', kind: 'negative', cadence: 'event', weight: 20, unit: 'time', single: true, hue: 356, addedOn: '2026-11-16', repairActions: ['pray', 'scripture', 'journal', 'reflect', 'phoneOut', 'walk', 'still', 'pushups', 'coldShower'] },
  { id: 'study',       name: 'Weekly personal study project',     short: 'Personal study', sym: 'Ps', category: 'spiritual', kind: 'positive', cadence: 'weekly', weeklyTarget: 1, weight: 20, hue: 24 },
  { id: 'midweek1',    name: 'Midweek meeting prep, step 1',      short: 'Midweek 1',   sym: 'M1', category: 'spiritual', kind: 'positive', cadence: 'weekly', weeklyTarget: 1, weight: 7,  hue: 54, stepOf: 'midweek', addedOn: '2026-11-16' },
  { id: 'midweek2',    name: 'Midweek meeting prep, step 2',      short: 'Midweek 2',   sym: 'M2', category: 'spiritual', kind: 'positive', cadence: 'weekly', weeklyTarget: 1, weight: 8,  hue: 60, stepOf: 'midweek', addedOn: '2026-11-16' },
  { id: 'watchtower1', name: 'Watchtower study prep, step 1',     short: 'Watchtower 1', sym: 'W1', category: 'spiritual', kind: 'positive', cadence: 'weekly', weeklyTarget: 1, weight: 7, hue: 14, stepOf: 'watchtower', addedOn: '2026-11-16' },
  { id: 'watchtower2', name: 'Watchtower study prep, step 2',     short: 'Watchtower 2', sym: 'W2', category: 'spiritual', kind: 'positive', cadence: 'weekly', weeklyTarget: 1, weight: 8, hue: 8, stepOf: 'watchtower', addedOn: '2026-11-16' }
];
/* Habits from before the 2026-11-16 set, kept so older files and their entries still read. */
var RETIRED_HABITS = [
  { id: 'midweek',     name: 'Midweek meeting prep',              short: 'Midweek prep', sym: 'Mw', category: 'spiritual', kind: 'positive', cadence: 'weekly', weeklyTarget: 1, weight: 15, hue: 54, archived: true, archivedOn: '2026-11-16' },
  { id: 'watchtower',  name: 'Watchtower study prep for Sunday',  short: 'Watchtower prep', sym: 'Wt', category: 'spiritual', kind: 'positive', cadence: 'weekly', weeklyTarget: 1, weight: 15, hue: 14, archived: true, archivedOn: '2026-11-16' }
];
var HABIT_SET = 3, HABITS_V2_SINCE = '2026-11-16';
var ALCOHOL_ACTIONS = ['hydrate', 'walk', 'reflect', 'still'];

/* The four domains. Habits can be added freely, each in one of these. */
var DOMAINS = [
  { id: 'spiritual', name: 'Spiritual' },
  { id: 'health',    name: 'Health' },
  { id: 'career',    name: 'Career' },
  { id: 'financial', name: 'Financial' }
];

/* The day these scoring rules shipped. Files made before it judge earlier days by the old rules. */
var RULES_V2_SINCE = '2026-11-16';
var COMPOUND_RAISE = { glycine: [3, 5, 'Five stable molecules'], adenine: [10, 15, 'Fifteen stable molecules'], serotonin: [25, 40, 'Forty stable molecules'] };

/* Routines: habits that bond when all are done the same day. */
var DEFAULT_ROUTINES = [
  { id: 'morning', name: 'Morning stack', habits: ['sleep', 'dailyText', 'vitamins', 'pushups'] },
  { id: 'evening', name: 'Evening stack', habits: ['bible', 'mindfulness', 'fasting', 'water'] }
];

/* ------------------------------ helpers ---------------------------------- */
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function pad(n) { return (n < 10 ? '0' : '') + n; }
function toISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function parseISO(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
function addDays(s, n) { var d = parseISO(s); d.setDate(d.getDate() + n); return toISO(d); }
function dow(s) { return parseISO(s).getDay(); }
function weekStart(s, ws) { return addDays(s, -((dow(s) - ws + 7) % 7)); }
function daysBetween(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 86400000); }
function validDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && toISO(parseISO(s)) === s; }
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function roman(n) { var r = '', m = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; m.forEach(function (p) { while (n >= p[0]) { r += p[1]; n -= p[0]; } }); return r; }
function mergeMissing(target, defaults) {
  Object.keys(defaults).forEach(function (k) {
    if (target[k] === undefined) target[k] = clone(defaults[k]);
    else if (defaults[k] && typeof defaults[k] === 'object' && !Array.isArray(defaults[k]) && target[k] && typeof target[k] === 'object') mergeMissing(target[k], defaults[k]);
  });
  return target;
}

/* ------------------------------ data file -------------------------------- */
function newData() {
  var now = new Date().toISOString();
  return {
    app: 'strand', schema: SCHEMA,
    meta: { createdAt: now, updatedAt: now, sample: false, label: '', seq: 0, rowSeq: 0, habitSet: HABIT_SET },
    settings: clone(DEFAULT_SETTINGS),
    habits: clone(DEFAULT_HABITS).map(function (h) { delete h.addedOn; return h; }),   // a new file tracks every habit from day one
    routines: clone(DEFAULT_ROUTINES),
    log: [],          // every check-in, positive and negative
    ledger: [],       // every point movement, shared by all modules
    rolls: {},        // the dice already thrown for a habit on a day (so undo/redo cannot re-roll)
    milestones: [],   // stages reached and compounds completed
    traits: [],       // genes expressed: one permanent pick per stable week
    media: [],        // media index: one slot per milestone that earned art
    importedIds: [],  // import IDs already merged
    derived: {},      // snapshot recomputed from the log on every save (read-only convenience)
    modules: { habits: { version: 1 }, nutrition: null }   // nutrition is reserved, not built
  };
}

function normalize(d) {
  if (!d || d.app !== 'strand') throw new Error('This is not a Strand data file.');
  if (d.schema > SCHEMA) throw new Error('This data file was made by a newer version of Strand.');
  var blank = newData();
  // Migration to dated rules: a file from before them keeps its past exactly as it was.
  if (d.settings && typeof d.settings === 'object' && d.settings.rulesSince === undefined) {
    d.settings.rulesSince = RULES_V2_SINCE;
    d.settings.legacyRules = {
      fractionPerCategory: d.settings.stableDay && d.settings.stableDay.fractionPerCategory != null ? d.settings.stableDay.fractionPerCategory : 1,
      solidDayMinCheckins: d.settings.stableWeek && d.settings.stableWeek.solidDayMinCheckins != null ? d.settings.stableWeek.solidDayMinCheckins : 4
    };
    delete d.settings.stableDay;
    if (d.settings.stableWeek) delete d.settings.stableWeek.solidDayMinCheckins;
    (d.settings.compounds || []).forEach(function (c) {
      var r = COMPOUND_RAISE[c.id];
      if (r && c.rule && c.rule.stableDays === r[0]) { c.rule.stableDays = r[1]; c.note = r[2]; }
    });
  }
  // Migrations by habit set. Set 2: add the new habits (dated, so the past is untouched) and
  // retire the single-step prep habits; their old entries count for both new steps.
  if (d.meta && typeof d.meta === 'object' && !(d.meta.habitSet >= HABIT_SET) && Array.isArray(d.habits)) {
    var have = {}; d.habits.forEach(function (h) { have[h.id] = h; });
    DEFAULT_HABITS.forEach(function (h) { if (!have[h.id]) d.habits.push(clone(h)); });
    if (!(d.meta.habitSet >= 2)) ['midweek', 'watchtower'].forEach(function (id) { var h = have[id]; if (h && !h.archived) setArchived(h, true, HABITS_V2_SINCE); });
    // habit set 3: per-habit repair lists, and the new recovery actions in the pool
    if (have.alcohol && !have.alcohol.repairActions) have.alcohol.repairActions = ALCOHOL_ACTIONS.slice();
    if (d.settings && d.settings.repair && Array.isArray(d.settings.repair.actions)) {
      var pool = {}; d.settings.repair.actions.forEach(function (a) { pool[a.id] = true; });
      DEFAULT_SETTINGS.repair.actions.forEach(function (a) { if (!pool[a.id]) d.settings.repair.actions.push(clone(a)); });
    }
    d.meta.habitSet = HABIT_SET;
  }
  ['meta', 'settings', 'habits', 'routines', 'log', 'ledger', 'rolls', 'milestones', 'traits', 'media', 'importedIds', 'derived', 'modules'].forEach(function (k) {
    if (d[k] === undefined) d[k] = blank[k];
  });
  mergeMissing(d.settings, DEFAULT_SETTINGS);
  mergeMissing(d.meta, blank.meta);
  return d;
}

/* Is a habit part of the game on a given day? (Added on or before it, not yet archived.) */
function activeOn(h, date) {
  if (h.addedOn && date < h.addedOn) return false;
  if (h.archivedOn) return date < h.archivedOn;
  return !h.archived;
}
function setArchived(h, on, today) {
  if (on) { h.archived = true; h.archivedOn = today; }
  else { delete h.archived; delete h.archivedOn; }
}
/* The recovery actions offered for a negative habit (its own list, or the whole pool). */
function repairActionsFor(data, h) {
  var pool = data.settings.repair.actions, ids = h && h.repairActions;
  if (!ids) return pool.slice();
  return ids.map(function (id) { return pool.find(function (a) { return a.id === id; }); }).filter(Boolean);
}
/* Has a repair on this day already used this action? */
function repairUsed(data, actionId, date) {
  return data.log.some(function (e) { return e.kind === 'negative' && e.repair && e.repair.action === actionId && e.loggedOn === date; });
}
/* Occasional habits: how many consecutive days were logged right before this date. */
function runBefore(data, habitId, date) {
  var n = 0, d = addDays(date, -1);
  while (data.log.some(function (e) { return e.habitId === habitId && e.date === d; })) { n++; d = addDays(d, -1); }
  return n;
}
function escalatedPay(S, h, run) { return Math.max(1, Math.round(h.weight * Math.pow(S.streakGrowth || 1, run))); }
function habitMap(data) { var m = {}; data.habits.forEach(function (h) { m[h.id] = h; }); return m; }
function addRow(data, row) {
  row.id = 'P' + (++data.meta.rowSeq);
  row.module = row.module || 'habits';
  if (row.amount > 0) row.remaining = row.amount;
  data.ledger.push(row);
  return row;
}

/* ------------------------------ stages ----------------------------------- */
function stageList(S, points) {
  var list = S.stages.slice().sort(function (a, b) { return a.at - b.at; });
  var last = list[list.length - 1], n = 1;
  while (list[list.length - 1].at <= points + S.stageOverflowStep) {
    list.push({ id: 'generation-' + (n + 1), phase: last.phase, name: 'Generation ' + roman(n + 1), at: last.at + S.stageOverflowStep * n, media: n % S.stageOverflowMediaEvery === 0, overflow: true });
    n++;
  }
  return list;
}
function thinTier(S, streakDays) { var t = S.thinning[0]; S.thinning.forEach(function (x) { if (streakDays >= x.minStreak) t = x; }); return t; }
function pickBonus(S, r) {
  var tot = S.bonuses.reduce(function (a, b) { return a + b.share; }, 0), acc = 0;
  for (var i = 0; i < S.bonuses.length; i++) { acc += S.bonuses[i].share / tot; if (r < acc) return S.bonuses[i]; }
  return S.bonuses[S.bonuses.length - 1];
}

/* ------------------------------ genes (traits) --------------------------- */
/* fxAt: what the expressed genes add, counting only picks made on or before "date". */
function fxAt(data, date, asOf) {
  var fx = { levels: {}, shieldMaxAdd: 0, repairAdd: 0, bonus: {}, bondAdd: 0, moleculeAdd: 0 };
  (data.traits || []).forEach(function (p) {
    if (p.pickedOn > date || (asOf != null && p.seq > asOf)) return;
    var t = data.settings.traits.find(function (x) { return x.id === p.traitId; });
    fx.levels[p.traitId] = (fx.levels[p.traitId] || 0) + 1;
    if (!t || !t.effect) return;
    var e = t.effect;
    if (e.type === 'shieldMax') fx.shieldMaxAdd += e.per;
    else if (e.type === 'repairRate') fx.repairAdd += e.per;
    else if (e.type === 'bonusChance') fx.bonus[e.category] = (fx.bonus[e.category] || 0) + e.per;
    else if (e.type === 'bondPoints') fx.bondAdd += e.per;
    else if (e.type === 'moleculePoints') fx.moleculeAdd += e.per;
  });
  return fx;
}
/* The offer for a week is fixed by that week's date, so reloading cannot re-deal it. */
function traitOffers(data, weekEnd, levels) {
  var open = data.settings.traits.filter(function (t) { return (levels[t.id] || 0) < t.max; });
  var seed = 0; for (var i = 0; i < weekEnd.length; i++) seed = (seed * 31 + weekEnd.charCodeAt(i)) | 0;
  var rng = mulberry32(seed ^ 0x9E3779B9), pool = open.slice(), out = [];
  while (pool.length && out.length < data.settings.traitOfferCount) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return out;
}

/* ==========================================================================
   derive — rebuilds everything that can be rebuilt from the log and ledger:
   the strand, gaps, shields, chain, streaks, bonding, stage. The strand on
   screen is drawn from this and nothing else.
   opt.asOfSeq: rebuild the strand as it stood at an earlier moment.
   ========================================================================== */
function derive(data, today, opt) {
  opt = opt || {};
  var S = data.settings, asOf = opt.asOfSeq == null ? Infinity : opt.asOfSeq;
  var H = habitMap(data);
  var log = data.log.filter(function (e) { return e.seq <= asOf && e.date <= today; })
    .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.seq - b.seq; });
  var rows = data.ledger.filter(function (r) { return r.seq <= asOf; });

  var first = log.length ? log[0].date : today;
  var days = [], byDate = {};
  for (var d = first; d <= today; d = addDays(d, 1)) {
    var day = { date: d, entries: [], pos: 0, neg: 0, done: {}, state: 'open', solid: false, stable: false, bonds: [], slots: [] };
    days.push(day); byDate[d] = day;
  }
  log.forEach(function (e) {
    var dy = byDate[e.date]; dy.entries.push(e);
    var h = H[e.habitId] || { id: e.habitId, sym: '?', category: 'health', hue: 0 };
    var repaired = e.kind === 'negative' && e.repair && e.repair.seq <= asOf;
    if (e.kind === 'negative') dy.neg++; else { dy.pos++; dy.done[e.habitId] = true; }
    dy.slots.push({
      t: e.kind === 'negative' ? (repaired ? 'repaired' : 'damaged') : 'pair',
      habitId: e.habitId, cat: h.category, logId: e.id, seq: e.seq,
      bonus: e.bonus ? e.bonus.type : null, amount: e.amount || null
    });
  });

  // Daily habits active on a date, by domain. Each day is judged only by the habits that existed then.
  function dailyOn(date) {
    var by = {};
    data.habits.forEach(function (h) { if (h.kind === 'positive' && h.cadence === 'daily' && activeOn(h, date)) (by[h.category] = by[h.category] || []).push(h); });
    return by;
  }
  var dailyByCat = {};
  Object.keys(dailyOn(today)).forEach(function (c) { dailyByCat[c] = dailyOn(today)[c].map(function (h) { return h.id; }); });
  var since = S.rulesSince || '', LG = S.legacyRules || { fractionPerCategory: 1, solidDayMinCheckins: 4 };
  var EPS = 1e-9;
  // Molecule and solid-day progress for one day. Uses each habit's set weight, never the points paid.
  function judge(dy) {
    var by = dailyOn(dy.date), legacy = since && dy.date < since, cats = Object.keys(by);
    var mol = { rule: legacy ? 'all' : 'weight', domains: {}, stable: false };
    if (legacy) {
      mol.stable = cats.length > 0 && cats.every(function (c) {
        var need = Math.ceil(by[c].length * LG.fractionPerCategory), have = by[c].filter(function (h) { return dy.done[h.id]; }).length;
        mol.domains[c] = { have: have, need: need, total: by[c].length };
        return have >= need;
      });
    } else {
      var gated = Object.keys(S.molecule || {}).filter(function (c) { return by[c] && by[c].length; });
      gated.forEach(function (c) {
        var total = 0, have = 0;
        by[c].forEach(function (h) { total += h.weight; if (dy.done[h.id]) have += h.weight; });
        mol.domains[c] = { have: have, need: Math.round(total * S.molecule[c] * 10) / 10, total: total };
      });
      mol.stable = gated.length > 0 && gated.every(function (c) { var m = mol.domains[c]; return m.have + EPS >= m.total * S.molecule[c]; });
    }
    var solid;
    if (legacy) solid = { rule: 'count', have: dy.pos, need: LG.solidDayMinCheckins };
    else {
      var dayTotal = 0, got = 0;
      cats.forEach(function (c) { by[c].forEach(function (h) { dayTotal += h.weight; }); });
      dy.entries.forEach(function (e) { if (e.kind === 'positive') { var h = H[e.habitId]; if (h) got += h.weight; } });
      solid = { rule: 'weight', have: got, need: Math.round(dayTotal * S.stableWeek.solidDayWeightPct * 10) / 10, total: dayTotal };
      solid.met = dayTotal > 0 && got + EPS >= dayTotal * S.stableWeek.solidDayWeightPct;
    }
    if (solid.rule === 'count') solid.met = dy.pos >= solid.need;
    return { mol: mol, solid: solid };
  }

  var shields = S.shields.starting, chain = 0, bestChain = 0, bondedThrough = null, bondedWeeks = 0;
  var weeks = [], wk = null, shielded = [], gaps = [], stableDays = 0;
  days.forEach(function (dy) {
    var ws = weekStart(dy.date, S.weekStartsOn);
    if (!wk || wk.start !== ws) { wk = { start: ws, end: addDays(ws, 6), solid: 0, active: 0, stable: false, closed: false }; weeks.push(wk); }
    dy.weekStart = ws;
    var isToday = dy.date === today;
    if (dy.pos >= S.activeDay.minCheckins) { chain++; dy.state = 'active'; wk.active++; if (chain > bestChain) bestChain = chain; }
    else if (isToday) { dy.state = 'open'; }
    else if (chain > 0 && shields > 0) { shields--; dy.state = 'shielded'; shielded.push(dy.date); }
    else { chain = 0; dy.state = 'gap'; gaps.push(dy.date); }
    var jd = judge(dy); dy.molecule = jd.mol; dy.solidInfo = jd.solid;
    dy.solid = jd.solid.met; if (dy.solid) wk.solid++;
    dy.stable = jd.mol.stable; if (dy.stable) stableDays++;
    data.routines.forEach(function (r) { if (r.habits.length && r.habits.every(function (id) { return dy.done[id]; })) dy.bonds.push(r.id); });
    if (dy.date === wk.end && wk.end < today) {
      wk.closed = true; wk.stable = wk.solid >= S.stableWeek.minSolidDays;
      if (wk.stable) {
        var cap = S.shields.max + fxAt(data, wk.end, opt.asOfSeq).shieldMaxAdd;
        shields = Math.min(Math.max(cap, shields), shields + S.shields.perStableWeek); bondedThrough = wk.end; bondedWeeks++;
      }
    }
  });

  // per-habit streaks (used for reward thinning)
  var streaks = {};
  data.habits.forEach(function (h) {
    if (h.kind !== 'positive') return;
    var n = 0, i, from = h.addedOn || '';
    if (h.cadence === 'occasional') {
      // a run of consecutive days, ending today or yesterday; never broken by a day it was not meant to be done
      for (i = days.length - 1; i >= 0; i--) {
        if (days[i].done[h.id]) n++; else if (days[i].date === today && n === 0) continue; else break;
      }
      streaks[h.id] = { n: n, unit: 'day', days: n };
      return;
    }
    if (h.cadence === 'weekly') {
      var count = {};
      // a step that replaced an older single habit: that habit's entries count for the step (so its streak carries on)
      log.forEach(function (e) { if (e.habitId === h.id || (h.stepOf && e.habitId === h.stepOf)) { var w = weekStart(e.date, S.weekStartsOn); count[w] = (count[w] || 0) + 1; } });
      for (i = weeks.length - 1; i >= 0; i--) {
        var met = (count[weeks[i].start] || 0) >= (h.weeklyTarget || 1);
        if (met) n++; else if (!weeks[i].closed) continue; else break;
      }
      streaks[h.id] = { n: n, unit: 'week', days: n * 7 };
    } else {
      for (i = days.length - 1; i >= 0; i--) {
        var dd = days[i];
        if (dd.date < from) break;
        if (dd.done[h.id]) n++; else if (dd.date === today || dd.state === 'shielded') continue; else break;
      }
      streaks[h.id] = { n: n, unit: 'day', days: n };
    }
  });

  // points
  var points = 0, loose = 0, bonded = 0, clawedTotal = 0, reearned = 0;
  rows.forEach(function (r) {
    points += r.amount;
    if (r.amount > 0) { if (bondedThrough && r.date <= bondedThrough) bonded += r.remaining; else loose += r.remaining; if (r.source === 'repair') reearned += r.amount; }
    else clawedTotal += -r.amount;
  });

  // stage (never demotes: reached stages are recorded as milestones)
  var list = stageList(S, points), idx = 0, hw = 0;
  list.forEach(function (s, i) { if (points >= s.at) idx = i; });
  data.milestones.forEach(function (m) { if (m.kind === 'stage' && m.atSeq <= asOf) { var i = list.findIndex(function (s) { return s.id === m.ref; }); if (i > hw) hw = i; } });
  idx = Math.max(idx, hw);
  var cur = list[idx], next = list[idx + 1];
  var progress = Math.max(0, Math.min(1, (points - cur.at) / (next.at - cur.at)));

  // genes: effects in force today, and any stable week still waiting for its pick
  var fx = fxAt(data, today, opt.asOfSeq);
  var picked = {}; (data.traits || []).forEach(function (p) { picked[p.week] = true; });
  var waiting = weeks.filter(function (w) { return w.closed && w.stable && !picked[w.end]; }).map(function (w) { return w.end; });
  var offers = waiting.length ? traitOffers(data, waiting[0], fx.levels) : [];
  if (waiting.length && !offers.length) waiting = [];        // every gene is fully expressed

  var basePairs = 0, damaged = 0, repaired = 0;
  days.forEach(function (dy) { dy.slots.forEach(function (s) { basePairs++; if (s.t === 'damaged') damaged++; if (s.t === 'repaired') repaired++; }); });

  return {
    today: today, first: first, days: days, byDate: byDate, weeks: weeks,
    shields: shields, shieldsMax: S.shields.max + fx.shieldMaxAdd, chain: chain, bestChain: bestChain,
    fx: { levels: fx.levels, bond: S.points.bond + fx.bondAdd, molecule: S.points.stableMolecule + fx.moleculeAdd, repairRate: Math.min(1, S.repair.rate + fx.repairAdd), bonus: fx.bonus },
    genes: { waiting: waiting, offers: offers, expressed: (data.traits || []).length },
    bondedThrough: bondedThrough, bondedWeeks: bondedWeeks, shieldedDates: shielded, gapDates: gaps,
    streaks: streaks, points: points, loose: loose, bonded: bonded, clawedTotal: clawedTotal, reearned: reearned,
    stage: { index: idx, list: list, cur: cur, next: next, progress: progress, toNext: Math.max(0, next.at - points) },
    counts: { days: days.length, basePairs: basePairs, gaps: gaps.length, shielded: shielded.length, damaged: damaged, repaired: repaired, stableDays: stableDays, bondedWeeks: bondedWeeks },
    dailyByCat: dailyByCat
  };
}

function snapshot(der) {
  var st = {}; Object.keys(der.streaks).forEach(function (k) { st[k] = der.streaks[k].n + ' ' + der.streaks[k].unit + (der.streaks[k].n === 1 ? '' : 's'); });
  return {
    note: 'Rebuilt from the log and ledger on every save. Editing this block changes nothing.',
    asOf: der.today, points: der.points, loose: der.loose, bonded: der.bonded, bondedThrough: der.bondedThrough,
    stage: der.stage.cur.id, shields: der.shields, chain: der.chain, bestChain: der.bestChain,
    shieldedDates: der.shieldedDates.slice(), streaks: st, genes: clone(der.fx.levels), genesWaiting: der.genes.waiting.length, strand: clone(der.counts)
  };
}

/* ------------------------------ milestones ------------------------------- */
function compoundMet(rule, der) {
  return Object.keys(rule).every(function (k) {
    var v = k === 'stableDays' ? der.counts.stableDays : k === 'bondedWeeks' ? der.bondedWeeks : k === 'chain' ? der.bestChain : k === 'repairs' ? der.counts.repaired : 0;
    return v >= rule[k];
  });
}
function syncMilestones(data, der, seq, date) {
  var added = [];
  function has(id) { return data.milestones.some(function (m) { return m.id === id; }); }
  function add(m, mediaKind) {
    data.milestones.push(m); added.push(m);
    if (mediaKind && !data.media.some(function (x) { return x.id === m.id; }))
      data.media.push({ id: m.id, kind: mediaKind, status: 'awaiting', file: null, unlockedOn: date });
  }
  for (var i = 1; i <= der.stage.index; i++) {
    var s = der.stage.list[i], id = 'stage-' + s.id;
    if (!has(id)) add({ id: id, kind: 'stage', ref: s.id, name: s.name, phase: s.phase, phaseChange: der.stage.list[i - 1].phase !== s.phase, reachedOn: date, atSeq: seq, media: !!s.media }, s.media ? 'video' : null);
  }
  data.settings.compounds.forEach(function (c) {
    var id = 'compound-' + c.id;
    if (!has(id) && compoundMet(c.rule, der)) add({ id: id, kind: 'compound', ref: c.id, name: c.name, formula: c.formula, note: c.note, reachedOn: date, atSeq: seq, media: true }, 'image');
  });
  return added;
}
function finish(data, today, seq, date, events) {
  var der = derive(data, today);
  syncMilestones(data, der, seq, date).forEach(function (m) { events.push({ type: m.kind === 'stage' ? 'stage' : 'compound', milestone: m }); });
  return der;
}

/* ==========================================================================
   checkIn — one tap. Positive habits earn; negative habits go to logNegative.
   ========================================================================== */
function checkIn(data, habitId, date, opt) {
  opt = opt || {};
  var S = data.settings, today = opt.today || date, rng = opt.rng || Math.random;
  var now = opt.now || new Date().toISOString();
  var h = data.habits.find(function (x) { return x.id === habitId; });
  if (!h) return { error: 'Unknown habit: ' + habitId };
  if (!validDate(date)) return { error: 'Bad date: ' + date };
  if (date > today) return { error: 'That day has not happened yet.' };
  if (!activeOn(h, date)) return { error: h.short + ' was not tracked on that day.' };
  if (h.kind === 'negative') return logNegative(data, h, date, opt, today, now);
  if (h.repairAction && repairUsed(data, h.repairAction, date)) return { error: 'That day\'s ' + h.short.toLowerCase() + ' already sealed a repair. One walk counts once.', code: 'repairUsed' };

  if (data.log.some(function (e) { return e.habitId === habitId && e.date === date; })) return { error: h.short + ' is already logged for that day.', code: 'duplicate' };
  if (h.cadence === 'weekly' && !h.beyondTarget) {
    var ws = weekStart(date, S.weekStartsOn), we = addDays(ws, 6);
    var n = data.log.filter(function (e) { return e.habitId === habitId && e.date >= ws && e.date <= we; }).length;
    if (n >= (h.weeklyTarget || 1)) return { error: h.short + ' is already done for that week.', code: 'duplicate' };
  }

  var before = derive(data, today);
  var streak = before.streaks[habitId] ? before.streaks[habitId].days : 0;
  var tier = h.cadence === 'occasional' ? S.thinning[0] : thinTier(S, streak), fx = before.fx;
  var chance = Math.min(S.bonusChanceCap, tier.bonusChance + (fx.bonus[h.category] || 0));
  var run = h.cadence === 'occasional' ? runBefore(data, habitId, date) : 0;
  var base = h.cadence === 'occasional' ? escalatedPay(S, h, run) : Math.max(1, Math.round(h.weight * tier.basePct));

  var key = date + '|' + habitId, roll = data.rolls[key];
  if (!roll) { roll = [Math.round(rng() * 1e6) / 1e6, Math.round(rng() * 1e6) / 1e6]; data.rolls[key] = roll; }
  var bonus = null;
  if (roll[0] < chance) { var b = pickBonus(S, roll[1]); bonus = { type: b.id, name: b.name, points: Math.max(1, Math.round(h.weight * b.mult)) }; }

  var seq = ++data.meta.seq;
  var entry = { id: 'L' + seq, seq: seq, module: 'habits', date: date, habitId: habitId, kind: 'positive', points: base, streakAtLog: streak, loggedAt: now, loggedOn: today };
  if (h.cadence === 'occasional') entry.runDay = run + 1;
  if (bonus) entry.bonus = bonus;
  if (opt.importId) entry.importId = opt.importId;
  if (opt.note) entry.note = String(opt.note);
  data.log.push(entry);

  var events = [{ type: 'checkin', habit: h, points: base, basePct: tier.basePct, entry: entry }];
  addRow(data, { seq: seq, date: date, source: 'checkin', logId: entry.id, habitId: habitId, amount: base });
  if (bonus) { addRow(data, { seq: seq, date: date, source: 'bonus', logId: entry.id, habitId: habitId, amount: bonus.points, note: bonus.name }); events.push({ type: 'bonus', bonus: bonus, habit: h }); }

  var done = {}; data.log.forEach(function (e) { if (e.date === date && e.kind === 'positive') done[e.habitId] = true; });
  data.routines.forEach(function (r) {
    if (r.habits.indexOf(habitId) < 0 || !r.habits.every(function (id) { return done[id]; })) return;
    if (data.ledger.some(function (x) { return x.source === 'bond' && x.ref === r.id && x.date === date; })) return;
    addRow(data, { seq: seq, date: date, source: 'bond', ref: r.id, logId: entry.id, amount: fx.bond, note: r.name });
    events.push({ type: 'bond', routine: r, points: fx.bond });
  });
  var mid = derive(data, today);
  if (mid.byDate[date] && mid.byDate[date].stable && !data.ledger.some(function (x) { return x.source === 'molecule' && x.date === date; })) {
    addRow(data, { seq: seq, date: date, source: 'molecule', logId: entry.id, amount: fx.molecule, note: 'Stable molecule' });
    events.push({ type: 'molecule', points: fx.molecule });
  }
  if (h.cadence === 'weekly') {
    var ws2 = weekStart(date, S.weekStartsOn), we2 = addDays(ws2, 6);
    var cnt = data.log.filter(function (e) { return e.habitId === habitId && e.date >= ws2 && e.date <= we2; }).length;
    if (cnt === (h.weeklyTarget || 1)) events.push({ type: 'weeklyTarget', habit: h });
  }
  var der = finish(data, today, seq, date, events);
  return { entry: entry, events: events, derived: der };
}

/* ==========================================================================
   logNegative — the behavior costs; the honesty never does.
   1. integrity reward, always, and it can never be clawed back
   2. clawback: capped per day and per rolling week, loose gains first
      (newest first), bonded structure never touched
   ========================================================================== */
function logNegative(data, h, date, opt, today, now) {
  var S = data.settings, units = h.single ? 1 : Math.max(1, Math.round(Number(opt.amount) || 1));
  var before = derive(data, today);
  var seq = ++data.meta.seq;
  var entry = { id: 'L' + seq, seq: seq, module: 'habits', date: date, habitId: h.id, kind: 'negative', amount: units, unit: h.unit || 'unit', loggedAt: now, loggedOn: today };
  if (opt.importId) entry.importId = opt.importId;
  if (opt.note) entry.note = String(opt.note);
  data.log.push(entry);
  var events = [{ type: 'negative', habit: h, entry: entry }];

  addRow(data, { seq: seq, date: date, source: 'integrity', logId: entry.id, habitId: h.id, amount: S.points.integrity, protected: true, note: 'Honest log' });
  events.push({ type: 'integrity', points: S.points.integrity });

  var requested = Math.round(h.weight * units);
  var claws = data.ledger.filter(function (r) { return r.source === 'clawback'; });
  var dayTaken = 0; claws.forEach(function (r) { if (r.date === date) dayTaken += -r.amount; });
  var worstWindow = 0, span = S.clawback.rollingDays;
  for (var s = -(span - 1); s <= 0; s++) {
    var a = addDays(date, s), b = addDays(a, span - 1), sum = 0;
    claws.forEach(function (r) { if (r.date >= a && r.date <= b) sum += -r.amount; });
    if (sum > worstWindow) worstWindow = sum;
  }
  var allowed = Math.max(0, Math.min(requested, S.clawback.dayCap - dayTaken, S.clawback.weekCap - worstWindow));

  var bt = before.bondedThrough;
  var loose = data.ledger.filter(function (r) { return r.amount > 0 && !r.protected && r.remaining > 0 && !(bt && r.date <= bt); })
    .sort(function (x, y) { return x.date > y.date ? -1 : x.date < y.date ? 1 : y.seq - x.seq || (x.id < y.id ? 1 : -1); });
  var left = allowed, from = [];
  for (var i = 0; i < loose.length && left > 0; i++) {
    var take = Math.min(left, loose[i].remaining);
    loose[i].remaining -= take; left -= take; from.push({ id: loose[i].id, amount: take });
  }
  var taken = allowed - left;
  if (taken > 0) addRow(data, { seq: seq, date: date, source: 'clawback', logId: entry.id, habitId: h.id, amount: -taken, from: from, note: units + ' ' + entry.unit + (units === 1 ? '' : 's') });
  entry.clawback = { requested: requested, allowedByCaps: allowed, taken: taken };
  events.push({ type: 'clawback', requested: requested, allowed: allowed, taken: taken });
  var der = finish(data, today, seq, date, events);
  return { entry: entry, events: events, derived: der };
}

/* repair — same day as the log. Re-earns a share of what was clawed and
   marks the pair repaired for good. */
function repair(data, logId, actionId, opt) {
  opt = opt || {};
  var S = data.settings, e = data.log.find(function (x) { return x.id === logId; });
  var today = opt.today || (e && e.loggedOn);
  if (!e || e.kind !== 'negative') return { error: 'Nothing to repair there.' };
  if (e.repair) return { error: 'That pair is already repaired.' };
  if (e.loggedOn !== today) return { error: 'The repair window closed at the end of the day it was logged.' };
  var offered = repairActionsFor(data, data.habits.find(function (h) { return h.id === e.habitId; }));
  var action = offered.find(function (a) { return a.id === actionId; });
  if (!action) return { error: 'That recovery action is not offered for this habit.' };
  if (repairUsed(data, action.id, today)) return { error: '"' + action.label + '" already sealed a repair today. Pick another action.', code: 'actionUsed' };
  var twin = data.habits.find(function (h) { return h.repairAction === action.id && data.log.some(function (x) { return x.habitId === h.id && x.date === today; }); });
  if (twin) return { error: 'Today\'s ' + twin.short.toLowerCase() + ' is already checked in as a habit. One walk counts once, so pick another action.', code: 'habitUsed' };
  var seq = ++data.meta.seq;
  var re = Math.round(((e.clawback && e.clawback.taken) || 0) * derive(data, today).fx.repairRate);
  if (re > 0) addRow(data, { seq: seq, date: today, source: 'repair', logId: e.id, habitId: e.habitId, amount: re, note: action.label });
  e.repair = { action: action.id, label: action.label, at: opt.now || new Date().toISOString(), seq: seq, reearned: re };
  var events = [{ type: 'repair', entry: e, points: re, action: action }];
  var der = finish(data, today, seq, today, events);
  return { entry: e, events: events, derived: der };
}

/* pickTrait — express one gene for a stable week. Permanent, and it only works
   from the day it is picked, so it never rewrites the strand behind it. */
function pickTrait(data, weekEnd, traitId, opt) {
  opt = opt || {};
  var today = opt.today, der = derive(data, today);
  if (der.genes.waiting.indexOf(weekEnd) < 0) return { error: 'That week has no gene waiting.' };
  if (der.genes.waiting[0] !== weekEnd) return { error: 'Choose for the earlier week first.' };
  var t = der.genes.offers.find(function (x) { return x.id === traitId; });
  if (!t) return { error: 'That gene is not on offer for this week.' };
  var seq = ++data.meta.seq;
  var pick = { id: 'G' + seq, seq: seq, week: weekEnd, traitId: traitId, name: t.name, pickedOn: today, at: opt.now || new Date().toISOString() };
  data.traits.push(pick);
  var after = derive(data, today);
  return { pick: pick, trait: t, level: after.fx.levels[traitId], derived: after };
}

/* removeEntry — undo a mistaken tap. Only while its gains are untouched. */
function removeEntry(data, logId, today) {
  var e = data.log.find(function (x) { return x.id === logId; });
  if (!e) return { error: 'Entry not found.' };
  var der = derive(data, today), bt = der.bondedThrough, keep = null, heir = null;
  var mine = data.ledger.filter(function (r) { return r.logId === logId; });
  if (e.kind === 'negative') {
    if (e.repair) return { error: 'This entry was repaired, so it stays on the strand.' };
    if (e.loggedOn !== today) return { error: 'Only entries logged today can be removed.' };
    var claw = mine.find(function (r) { return r.source === 'clawback'; });
    if (claw) claw.from.forEach(function (f) { var r = data.ledger.find(function (x) { return x.id === f.id; }); if (r) r.remaining += f.amount; });
  } else {
    // a bond or stable-molecule reward that depended on this habit goes with it
    data.ledger.forEach(function (r) {
      if (r.date !== e.date || mine.indexOf(r) >= 0) return;
      if (r.source === 'molecule') mine.push(r);
      if (r.source === 'bond') { var rt = data.routines.find(function (x) { return x.id === r.ref; }); if (rt && rt.habits.indexOf(e.habitId) >= 0) mine.push(r); }
    });
    var h = data.habits.find(function (x) { return x.id === e.habitId; });
    if (!(h && h.cadence === 'daily')) mine = mine.filter(function (r) { return r.source !== 'molecule' || r.logId === logId; });
    // under the weight rule a day can stay stable without this check-in: then its molecule stays
    var molRow = mine.find(function (r) { return r.source === 'molecule'; });
    keep = null; heir = null;
    if (molRow) {
      var rest = data.log.filter(function (x) { return x.id !== logId; });
      var still = derive({ settings: data.settings, habits: data.habits, routines: data.routines, log: rest, ledger: [], milestones: [], traits: data.traits }, today).byDate[e.date];
      heir = rest.find(function (x) { return x.date === e.date && x.kind === 'positive'; });
      if (still && still.stable && heir) { mine = mine.filter(function (r) { return r !== molRow; }); keep = molRow; }
    }
    var touched = mine.some(function (r) { return r.amount > 0 && (r.remaining !== r.amount || (bt && r.date <= bt)); });
    if (touched) return { error: 'These points have already bonded or been clawed back, so the entry stays.' };
  }
  data.ledger = data.ledger.filter(function (r) { return mine.indexOf(r) < 0; });
  if (keep && keep.logId === logId) keep.logId = heir.id;
  data.log = data.log.filter(function (x) { return x.id !== logId; });
  var dead = data.milestones.filter(function (m) { return m.atSeq === e.seq; }).map(function (m) { return m.id; });
  data.milestones = data.milestones.filter(function (m) { return dead.indexOf(m.id) < 0; });
  data.media = data.media.filter(function (m) { return dead.indexOf(m.id) < 0 || m.status === 'imported'; });
  return { removed: e, derived: derive(data, today) };
}

/* ==========================================================================
   importEntries — merge entries dictated elsewhere. See NOTES in the tool.
   ========================================================================== */
function importEntries(data, payload, opt) {
  opt = opt || {};
  var today = opt.today, list = Array.isArray(payload) ? payload : (payload && Array.isArray(payload.entries)) ? payload.entries : (payload && payload.importId) ? [payload] : null;
  if (!list) return { error: 'No entries found. Expected { "strandImport": 1, "entries": [ ... ] }.' };
  var out = { added: [], skipped: [], errors: [], events: [] };
  function find(v) {
    var k = String(v || '').trim().toLowerCase();
    return data.habits.find(function (h) { return h.id.toLowerCase() === k || h.short.toLowerCase() === k || h.name.toLowerCase() === k || h.sym.toLowerCase() === k; });
  }
  list.slice().sort(function (a, b) { return String(a.date) < String(b.date) ? -1 : 1; }).forEach(function (it, i) {
    var label = it && it.importId ? it.importId : 'entry ' + (i + 1);
    if (!it || !it.importId) { out.errors.push(label + ': missing importId'); return; }
    if (data.importedIds.indexOf(it.importId) >= 0) { out.skipped.push(it.importId + ': already imported'); return; }
    var h = find(it.habit || it.habitId);
    if (!h) { out.errors.push(label + ': unknown habit "' + (it.habit || it.habitId) + '"'); return; }
    if (!validDate(it.date)) { out.errors.push(label + ': bad date "' + it.date + '" (use YYYY-MM-DD)'); return; }
    if (it.date > today) { out.errors.push(label + ': date is in the future'); return; }
    var r = checkIn(data, h.id, it.date, { today: today, amount: it.amount, note: it.note, importId: it.importId, rng: opt.rng });
    if (r.error) {
      if (r.code === 'duplicate') { data.importedIds.push(it.importId); out.skipped.push(it.importId + ': ' + r.error); }
      else out.errors.push(label + ': ' + r.error);
      return;
    }
    data.importedIds.push(it.importId); out.added.push(r.entry); out.events = out.events.concat(r.events);
  });
  out.derived = derive(data, today);
  return out;
}

/* ==========================================================================
   mediaRequest — what Claude needs to render art for a milestone: the strand
   exactly as it stood at that moment.
   ========================================================================== */
function mediaRequest(data, milestoneId) {
  var m = data.milestones.find(function (x) { return x.id === milestoneId; });
  if (!m) return null;
  var der = derive(data, m.reachedOn, { asOfSeq: m.atSeq });
  var slot = data.media.find(function (x) { return x.id === m.id; });
  var kind = slot ? slot.kind : (m.kind === 'stage' ? 'video' : 'image');
  var legend = {}; data.habits.forEach(function (h) { legend[h.id] = { sym: h.sym, name: h.short, category: h.category, hue: h.hue, negative: h.kind === 'negative' }; });
  return {
    strandMediaRequest: 1,
    milestone: { id: m.id, kind: m.kind, name: m.name, phase: m.phase || null, phaseChange: !!m.phaseChange, formula: m.formula || null, note: m.note || null, reachedOn: m.reachedOn },
    deliver: { kind: kind, saveAs: 'media/' + m.id + (kind === 'video' ? '.mp4' : '.png') },
    sample: !!data.meta.sample,
    stats: Object.assign({ points: der.points, bonded: der.bonded, chain: der.chain, bestChain: der.bestChain, shieldsLeft: der.shields, bondedThrough: der.bondedThrough }, der.counts),
    habits: legend,
    routines: data.routines.map(function (r) { return { id: r.id, name: r.name, habits: r.habits }; }),
    strand: der.days.map(function (dy) {
      return { date: dy.date, state: dy.state, stable: dy.stable, bonds: dy.bonds, weekStart: dy.weekStart,
        slots: dy.slots.map(function (s) { var o = { t: s.t, habitId: s.habitId, cat: s.cat }; if (s.bonus) o.bonus = s.bonus; return o; }) };
    })
  };
}

/* ==========================================================================
   buildSample — FAKE seed data, clearly labelled. Deterministic, so the same
   sample strand is produced every time (the first stage-change film was
   rendered from it). Four weeks, Monday to Saturday, ending on the most
   recent Saturday; any days after that are filled with ordinary sample days.
   ========================================================================== */
function buildSample(today) {
  var data = newData();
  data.meta.sample = true;
  data.meta.label = 'SAMPLE DATA: fake entries made up to demonstrate the tool. Not a real log.';
  var rng = mulberry32(0x57A2D);
  var lastSat = addDays(today, -1); while (dow(lastSat) !== 6) lastSat = addDays(lastSat, -1);
  var start = addDays(lastSat, -26);                      // a Monday
  var daily = ['sleep', 'dailyText', 'vitamins', 'pushups', 'water', 'fasting', 'bible', 'mindfulness'];
  // day index -> plan.  F = full day, number = habits skipped at random, M = missed entirely
  var plan = [3, 2, 1, 3, 3, 2, 3,         // week 1: closes stable
              2, 'M', 3, 2, 'F', 3, 3,     // week 2: Tuesday missed, the starting shield covers it
              2, 3, 'M', 'M', 'M', 3, 2,   // week 3: three days away. Two shields, then a true gap
              1, 2, 2, 3, 'F', 1];         // week 4, Monday to Saturday
  var weekly = { 1: ['gym'], 2: ['midweek1', 'midweek2'], 4: ['gym'], 5: ['study', 'watchtower1', 'watchtower2'] }; // by weekday offset from Monday
  var n = daysBetween(start, addDays(today, -1)) + 1;
  for (var i = 0; i < n; i++) {
    var date = addDays(start, i), p = i < plan.length ? plan[i] : (i % 2 ? 1 : 2), wd = i % 7;
    if (p === 'M') continue;
    var skip = {};
    if (typeof p === 'number') { var pool = daily.slice(); for (var k = 0; k < p; k++) skip[pool.splice(Math.floor(rng() * pool.length), 1)[0]] = true; }
    var stamp = date + 'T12:00:00.000Z';
    daily.forEach(function (id) { if (!skip[id]) checkIn(data, id, date, { today: date, rng: rng, now: stamp }); });
    (weekly[wd] || []).forEach(function (id) { if (!(i === 18 && id === 'gym')) checkIn(data, id, date, { today: date, rng: rng, now: stamp }); });
    if (i === 10) { var r1 = checkIn(data, 'alcohol', date, { today: date, amount: 2, rng: rng, now: stamp, note: 'Sample entry' }); repair(data, r1.entry.id, 'hydrate', { today: date, now: stamp }); }
    if (i === 21) checkIn(data, 'alcohol', date, { today: date, amount: 1, rng: rng, now: stamp, note: 'Sample entry' });
  }
  data.derived = snapshot(derive(data, today));
  return data;
}

root.StrandEngine = {
  SCHEMA: SCHEMA, DOMAINS: DOMAINS, RETIRED_HABITS: RETIRED_HABITS, runBefore: runBefore, escalatedPay: escalatedPay, repairUsed: repairUsed, repairActionsFor: repairActionsFor, RULES_V2_SINCE: RULES_V2_SINCE, activeOn: activeOn, setArchived: setArchived, DEFAULT_SETTINGS: DEFAULT_SETTINGS, DEFAULT_HABITS: DEFAULT_HABITS, DEFAULT_ROUTINES: DEFAULT_ROUTINES,
  newData: newData, normalize: normalize, derive: derive, snapshot: snapshot, checkIn: checkIn, repair: repair,
  removeEntry: removeEntry, pickTrait: pickTrait, fxAt: fxAt, importEntries: importEntries, mediaRequest: mediaRequest, buildSample: buildSample,
  stageList: stageList, thinTier: thinTier, habitMap: habitMap,
  util: { toISO: toISO, parseISO: parseISO, addDays: addDays, dow: dow, weekStart: weekStart, daysBetween: daysBetween, clone: clone, mulberry32: mulberry32, validDate: validDate }
};
})(typeof window !== 'undefined' ? window : globalThis);
