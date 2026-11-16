require('../src/engine.js');
const E = globalThis.StrandEngine, U = E.util;
let pass = 0, fail = 0;
function ok(c, msg) { if (c) { pass++; console.log('  ok  ' + msg); } else { fail++; console.log('  FAIL ' + msg); } }
function sumRows(d) { return d.ledger.reduce((a, r) => a + r.amount, 0); }
function sumRemaining(d) { return d.ledger.filter(r => r.amount > 0).reduce((a, r) => a + r.remaining, 0); }
const never = () => 0.999, always = () => 0.0;

console.log('SAMPLE');
const TODAY = process.argv[2] || '2026-11-15';
const s = E.buildSample(TODAY), ds = E.derive(s, TODAY);
console.log('   days', ds.counts, 'points', ds.points, 'loose', ds.loose, 'bonded', ds.bonded, 'stage', ds.stage.cur.name, 'shields', ds.shields, 'chain', ds.chain, 'best', ds.bestChain);
console.log('   milestones', s.milestones.map(m => m.id + '@' + m.reachedOn).join(', '));
console.log('   media', s.media.map(m => m.id + ':' + m.kind).join(', '));
console.log('   weeks', ds.weeks.map(w => w.start + ' solid ' + w.solid + (w.stable ? ' STABLE' : '') + (w.closed ? '' : ' open')).join(' | '));
console.log('   shielded', ds.shieldedDates, 'gaps', ds.gapDates);
console.log('   bonuses', s.log.filter(e => e.bonus).length, 'of', s.log.filter(e => e.kind === 'positive').length);
ok(s.meta.sample === true && /SAMPLE/.test(s.meta.label), 'seed data is labelled sample');
ok(sumRows(s) === ds.points && sumRemaining(s) === ds.points, 'ledger invariant: points = sum(amounts) = sum(remaining)');
ok(ds.loose + ds.bonded === ds.points, 'loose + bonded = points');
ok(ds.shieldedDates.length >= 1 && ds.gapDates.length >= 1, 'sample has a shielded day and a true gap');
ok(ds.counts.repaired === 1 && ds.counts.damaged === 1, 'sample has one repaired and one damaged pair');
const s2 = E.buildSample(TODAY);
ok(JSON.stringify(s2.log.map(e => [e.date, e.habitId, e.bonus])) === JSON.stringify(s.log.map(e => [e.date, e.habitId, e.bonus])), 'sample is deterministic');

console.log('STRAND MATCHES LOG');
{
  const flat = []; ds.days.forEach(d => d.slots.forEach(x => flat.push(d.date + x.habitId)));
  const fromLog = s.log.slice().sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.seq - b.seq).map(e => e.date + e.habitId);
  ok(JSON.stringify(flat) === JSON.stringify(fromLog), 'every log entry is exactly one base pair, same order');
  const emptyDays = ds.days.filter(d => d.slots.length === 0 && d.date !== TODAY).map(d => d.date);
  ok(JSON.stringify(emptyDays) === JSON.stringify(ds.shieldedDates.concat(ds.gapDates).sort()), 'gaps on the strand = days with no entries');
}

console.log('SHIELD');
{
  const d = E.newData(); const t0 = '2026-03-02';
  ['sleep', 'water', 'bible'].forEach(h => E.checkIn(d, h, t0, { today: t0, rng: never }));
  E.checkIn(d, 'sleep', '2026-03-04', { today: '2026-03-04', rng: never });
  const r = E.derive(d, '2026-03-04');
  ok(r.byDate['2026-03-03'].state === 'shielded', 'missed day consumed a shield');
  ok(r.shields === 0 && r.chain === 2, 'shield count dropped to 0 and the chain survived (2)');
  ok(r.streaks.sleep.n === 2, 'habit streak survived the shielded day');
  E.checkIn(d, 'sleep', '2026-03-06', { today: '2026-03-06', rng: never });
  const r2 = E.derive(d, '2026-03-06');
  ok(r2.byDate['2026-03-05'].state === 'gap' && r2.chain === 1, 'no shield left: next missed day is a gap and the chain restarts');
}

console.log('NEGATIVE / CLAWBACK / REPAIR');
{
  const d = E.newData(); const mon = '2026-03-02';
  // week 1: five solid days -> closes stable, bonds
  for (let i = 0; i < 5; i++) ['sleep', 'water', 'fasting', 'pushups'].forEach(h => E.checkIn(d, h, U.addDays(mon, i), { today: U.addDays(mon, i), rng: never }));
  ['2026-03-07', '2026-03-08'].forEach(dt => E.checkIn(d, 'sleep', dt, { today: dt, rng: never }));
  const t = '2026-03-10'; // Tuesday of week 2
  ['sleep', 'water'].forEach(h => E.checkIn(d, h, '2026-03-09', { today: '2026-03-09', rng: never }));
  ['sleep', 'water', 'fasting'].forEach(h => E.checkIn(d, h, t, { today: t, rng: never }));
  const b = E.derive(d, t);
  ok(b.bondedThrough === '2026-03-08' && b.bonded === 185, 'stable week closed and bonded its gains (' + b.bonded + ')');
  ok(b.shields === 2, 'stable week earned a shield');
  const looseBefore = b.loose;
  const r = E.checkIn(d, 'alcohol', t, { today: t, amount: 2 });
  const a = E.derive(d, t);
  ok(r.entry.clawback.requested === 24 && r.entry.clawback.taken === 24, 'clawback 2 drinks x 12 = 24');
  ok(a.bonded === 185, 'bonded structure untouched');
  ok(a.loose === looseBefore - 24 + 3, 'loose dropped by clawback, integrity +3 still paid');
  const claw = d.ledger.find(x => x.source === 'clawback');
  const firstTaken = d.ledger.find(x => x.id === claw.from[0].id);
  ok(firstTaken.date === t, 'took the newest loose gains first (' + claw.from.map(f => f.id + ':' + f.amount).join(',') + ')');
  ok(d.ledger.find(x => x.source === 'integrity').remaining === 3, 'integrity reward is never clawed');
  // caps
  const r2 = E.checkIn(d, 'alcohol', t, { today: t, amount: 5 });
  ok(r2.entry.clawback.allowedByCaps === 16 , 'day cap 40: second entry limited to 16 (got ' + r2.entry.clawback.allowedByCaps + ')');
  const dayTotal = d.ledger.filter(x => x.source === 'clawback' && x.date === t).reduce((s, x) => s - x.amount, 0);
  ok(dayTotal <= 40, 'day total clawed ' + dayTotal + ' <= 40');
  ok(E.derive(d, t).bonded === 185, 'bonded still untouched after hitting caps');
  // repair
  const before = E.derive(d, t).points;
  const rp = E.repair(d, r.entry.id, 'hydrate', { today: t });
  ok(rp.events[0].points === 14, 'repair re-earns 60% of 24 = 14 in one action');
  ok(E.derive(d, t).points === before + 14, 'points rose by the repair');
  ok(E.derive(d, t).byDate[t].slots.find(x => x.logId === r.entry.id).t === 'repaired', 'pair is marked repaired and stays on the strand');
  ok(E.repair(d, r.entry.id, 'hydrate', { today: t }).error, 'cannot repair twice');
  ok(E.repair(d, r2.entry.id, 'walk', { today: U.addDays(t, 1) }).error, 'repair window is same day only');
  // rolling week cap
  for (let i = 1; i <= 3; i++) { const dt = U.addDays(t, i); ['sleep', 'water', 'fasting', 'pushups', 'bible', 'mindfulness'].forEach(h => E.checkIn(d, h, dt, { today: dt, rng: never })); E.checkIn(d, 'alcohol', dt, { today: dt, amount: 6 }); }
  const wk = d.ledger.filter(x => x.source === 'clawback').reduce((s, x) => s - x.amount, 0);
  ok(wk <= 90, 'rolling week total clawed ' + wk + ' <= 90');
  const z = E.derive(d, U.addDays(t, 3));
  ok(sumRows(d) === z.points && sumRemaining(d) === z.points, 'ledger invariant holds after clawbacks and repair');
  // weak vs strong: with no loose gains, nothing bonded is taken
  const w = E.newData(); const rw = E.checkIn(w, 'alcohol', t, { today: t, amount: 3 });
  ok(rw.entry.clawback.taken === 0 && E.derive(w, t).points === 3, 'nothing loose to take: clawback 0, integrity still +3');
}

console.log('NO PASSIVE DECAY');
{
  const d = E.buildSample(TODAY); const p = E.derive(d, TODAY).points;
  ok(E.derive(d, U.addDays(TODAY, 40)).points === p, 'points unchanged after 40 idle days');
}

console.log('BONUS / THINNING / UNDO');
{
  const d = E.newData(); const t = '2026-03-02';
  const r = E.checkIn(d, 'sleep', t, { today: t, rng: always });
  ok(r.entry.bonus && r.entry.bonus.type === 'crit', 'a low roll pays a bonus');
  const id = r.entry.id; const un = E.removeEntry(d, id, t);
  ok(!un.error && d.log.length === 0 && d.ledger.length === 0, 'undo removes entry and its points');
  const r3 = E.checkIn(d, 'sleep', t, { today: t, rng: never });
  ok(r3.entry.bonus && r3.entry.bonus.type === 'crit', 'redo reuses the same roll (no re-rolling)');
  const m = E.newData(); let last;
  for (let i = 0; i < 50; i++) { const dt = U.addDays(t, i); last = E.checkIn(m, 'sleep', dt, { today: dt, rng: never }); }
  ok(last.entry.points === 6, 'mature streak: base pay thinned to 60% (6 of 10)');
  ok(m.log[0].points === 10 && m.log[10].points === 9 && m.log[25].points === 7, 'thinning steps 10 -> 9 -> 7 -> 6');
}

console.log('BONDS / MOLECULE');
{
  const d = E.newData(); const t = '2026-03-02'; let ev = [];
  ['sleep', 'dailyText', 'vitamins', 'pushups', 'bible', 'mindfulness', 'fasting', 'water', 'walk'].forEach(h => { ev = ev.concat(E.checkIn(d, h, t, { today: t, rng: never }).events); });
  ok(ev.filter(e => e.type === 'bond').length === 2, 'two routines bonded');
  ok(ev.filter(e => e.type === 'molecule').length === 1 && E.derive(d, t).byDate[t].stable, 'full day formed a stable molecule');
  ok(E.derive(d, t).points === 62 + 10 + 15, 'points: 62 base + 2 bonds + molecule = 87');
  const sleepId = d.log.find(e => e.habitId === 'sleep').id; E.removeEntry(d, sleepId, t);
  ok(E.derive(d, t).points === 87 - 10 - 5 && E.derive(d, t).byDate[t].stable, 'undoing sleep removes its bond; Health still at 39 of 49 (70% = 34.3), so the molecule stays');
  ok(d.ledger.filter(r => r.source === 'molecule').every(r => d.log.some(e => e.id === r.logId)), 'a kept molecule row points at an entry still in the log');
  const fastId = d.log.find(e => e.habitId === 'fasting').id; E.removeEntry(d, fastId, t);
  ok(E.derive(d, t).points === 87 - 10 - 5 - 10 - 5 - 15 && !E.derive(d, t).byDate[t].stable, 'undoing fasting too drops Health to 29 of 49: bond and molecule go');
}

console.log('IMPORT ENTRIES');
{
  const d = E.newData(); const t = '2026-03-05';
  const payload = { strandImport: 1, entries: [
    { importId: 'a1', date: '2026-03-04', habit: 'water' }, { importId: 'a2', date: '2026-03-04', habit: 'Gym' },
    { importId: 'a3', date: '2026-03-05', habit: 'alcohol', amount: 1, note: 'x' }, { importId: 'a4', date: '2026-03-05', habit: 'nope' } ] };
  const r = E.importEntries(d, payload, { today: t });
  ok(r.added.length === 3 && r.errors.length === 1, 'imports 3, reports 1 unknown habit');
  const r2 = E.importEntries(d, payload, { today: t });
  ok(r2.added.length === 0 && r2.skipped.length === 3 && d.log.length === 3, 're-import skips the same IDs');
}

console.log('ROUND TRIP');
{
  const d = E.buildSample(TODAY); d.derived = E.snapshot(E.derive(d, TODAY));
  const text = JSON.stringify(d, null, 2);
  const back = E.normalize(JSON.parse(text)); back.derived = E.snapshot(E.derive(back, TODAY));
  ok(JSON.stringify(back, null, 2) === text, 'export -> wipe -> import is byte-identical, ledger included');
}

console.log('MEDIA REQUEST');
{
  const m = s.milestones.find(x => x.id === 'stage-protocell');
  ok(!!m, 'sample reached Protocell (Strand -> Cell)');
  if (m) {
    const rq = E.mediaRequest(s, m.id);
    console.log('   request stats', JSON.stringify(rq.stats));
    ok(rq.strand.length === U.daysBetween(ds.first, m.reachedOn) + 1, 'request strand ends on the day the stage was reached');
    ok(rq.stats.points >= 1200 && rq.stats.points < 1300, 'points at that moment just past 1200 (' + rq.stats.points + ')');
    const other = E.mediaRequest(E.buildSample(U.addDays(TODAY, 3)), m.id);
    ok(JSON.stringify(other.strand.map(d => [d.state, d.slots])) === JSON.stringify(rq.strand.map(d => [d.state, d.slots])), 'same strand structure whichever day the sample is first opened');
  }
}
console.log('GENES');
{
  const d = E.buildSample(TODAY), a = E.derive(d, TODAY);
  ok(a.genes.waiting.length === 2 && a.genes.offers.length === 3, 'sample: two stable weeks, two genes waiting, three on offer');
  ok(JSON.stringify(E.derive(d, TODAY).genes.offers.map(x => x.id)) === JSON.stringify(a.genes.offers.map(x => x.id)), 'the offer does not change on reload');
  ok(E.pickTrait(d, a.genes.waiting[1], a.genes.offers[0].id, { today: TODAY }).error, 'earlier week must be chosen first');
  ok(E.pickTrait(d, a.genes.waiting[0], 'nope', { today: TODAY }).error, 'only offered genes can be picked');
  const before = JSON.stringify(a.days.map(x => [x.date, x.state, x.slots.length]));
  const r = E.pickTrait(d, a.genes.waiting[0], a.genes.offers[0].id, { today: TODAY });
  ok(!r.error && r.level === 1 && r.derived.genes.waiting.length === 1, 'pick recorded; one gene still waiting');
  ok(JSON.stringify(r.derived.days.map(x => [x.date, x.state, x.slots.length])) === before && r.derived.points === a.points, 'a pick never changes the strand or the points behind it');
  ok(E.pickTrait(d, a.genes.waiting[0], a.genes.offers[0].id, { today: TODAY }).error, 'a week cannot be picked twice');
  // effects
  const mk = (traitId) => { const x = E.newData(); x.traits.push({ id: 'G1', seq: 0, week: '2026-03-01', traitId, pickedOn: '2026-03-02' }); return x; };
  let x = mk('bondStrength'), ev = [];
  ['sleep', 'dailyText', 'vitamins', 'pushups'].forEach(h => { ev = ev.concat(E.checkIn(x, h, '2026-03-02', { today: '2026-03-02', rng: never }).events); });
  ok(ev.find(e => e.type === 'bond').points === 7, 'Tighter bonds: routine bond pays 5 + 2');
  x = mk('ligase'); ['sleep', 'water', 'fasting'].forEach(h => E.checkIn(x, h, '2026-03-02', { today: '2026-03-02', rng: never }));
  const ng = E.checkIn(x, 'alcohol', '2026-03-02', { today: '2026-03-02', amount: 1 });
  ok(E.repair(x, ng.entry.id, 'walk', { today: '2026-03-02' }).events[0].points === Math.round(12 * 0.7), 'Faster ligase: repair re-earns 70%');
  x = mk('healthExpr'); const roll = () => 0.12;
  ok(E.checkIn(x, 'sleep', '2026-03-02', { today: '2026-03-02', rng: roll }).entry.bonus && !E.checkIn(x, 'bible', '2026-03-02', { today: '2026-03-02', rng: roll }).entry.bonus, 'Health promoter: a 0.12 roll now pays on health (15%) but not spiritual (10%)');
  x = mk('membrane'); ok(E.derive(x, '2026-03-02').shieldsMax === 4, 'Thicker membrane: shield capacity 4');
  x = mk('stableCore'); x.traits[0].pickedOn = '2026-03-09'; ok(E.derive(x, '2026-03-05').fx.molecule === 15 && E.derive(x, '2026-03-09').fx.molecule === 20, 'a gene works only from the day it was picked');
  const txt = JSON.stringify(d); ok(JSON.stringify(E.normalize(JSON.parse(txt))) === txt, 'gene picks survive export and import');
}

console.log('DOMAINS / DATED RULES');
{
  const t = '2026-03-02', all = ['sleep', 'dailyText', 'vitamins', 'pushups', 'bible', 'mindfulness', 'fasting', 'water', 'walk'];
  // molecule uses set weight, not paid points: skip sleep + fasting (the heavy two) -> Health 29 of 49 fails
  const a = E.newData();
  ['dailyText', 'bible', 'vitamins', 'pushups', 'mindfulness', 'water', 'walk'].forEach(h => E.checkIn(a, h, t, { today: t, rng: never }));
  ok(!E.derive(a, t).byDate[t].stable, 'five light Health habits (29 of 49) do not make a molecule');
  E.checkIn(a, 'sleep', t, { today: t, rng: never });
  ok(E.derive(a, t).byDate[t].stable && a.ledger.some(r => r.source === 'molecule'), 'adding sleep (39 of 49) does, and pays the molecule');
  // thinning lowers pay but not the molecule test
  const b = E.newData();
  for (let i = 0; i < 30; i++) { const dt = U.addDays(t, i); all.forEach(h => E.checkIn(b, h, dt, { today: dt, rng: never })); }
  const last = U.addDays(t, 29);
  ok(b.log.filter(e => e.date === last && e.habitId === 'sleep')[0].points < 10 && E.derive(b, last).byDate[last].stable, 'thinned pay still counts full weight for the molecule');
  // Financial and Career never gate the molecule
  const c = E.newData();
  c.habits.push({ id: 'budgetLog', name: 'Log spending', short: 'Spending', sym: 'Bu', category: 'financial', kind: 'positive', cadence: 'daily', weight: 5, hue: 120 });
  all.forEach(h => E.checkIn(c, h, t, { today: t, rng: never }));
  ok(E.derive(c, t).byDate[t].stable, 'an undone Financial daily does not block the molecule');
  // weekly habits: count toward a solid day, not toward the molecule
  const w = E.newData();
  ['gym', 'study'].forEach(h => E.checkIn(w, h, t, { today: t, rng: never }));
  const wd = E.derive(w, t).byDate[t];
  ok(wd.solid && !wd.stable, 'gym + personal study (40 weight vs 40% of 62) make a solid day but no molecule');
  const v = E.newData(); ['water', 'vitamins', 'dailyText', 'pushups'].forEach(h => E.checkIn(v, h, t, { today: t, rng: never }));
  ok(!E.derive(v, t).byDate[t].solid, 'four light check-ins (21 of 62) are not a solid day under the weight rule');
  // adding a daily habit later leaves past days as they were
  const p = E.newData();
  all.forEach(h => E.checkIn(p, h, t, { today: t, rng: never }));
  p.habits.push({ id: 'walk2', name: 'Walk', short: 'Walk', sym: 'Wk', category: 'health', kind: 'positive', cadence: 'daily', weight: 30, hue: 100, addedOn: U.addDays(t, 5) });
  ok(E.derive(p, U.addDays(t, 6)).byDate[t].stable, 'a heavy habit added later does not unmake a past molecule');
  ok(!E.derive(p, U.addDays(t, 6)).streaks.walk2.n, 'its streak starts at zero');
  // archiving keeps the past
  const q = E.newData();
  ['dailyText', 'bible', 'sleep', 'water', 'fasting', 'pushups', 'mindfulness'].forEach(h => E.checkIn(q, h, t, { today: t, rng: never }));
  const before = E.derive(q, t).byDate[t].stable;
  E.setArchived(q.habits.find(h => h.id === 'sleep'), true, U.addDays(t, 3));
  ok(E.derive(q, U.addDays(t, 4)).byDate[t].stable === before && before, 'archiving a habit later leaves past days unchanged');
  // a file from before the new rules: old days keep old rules, compounds raised, rules after the ship date
  const old = E.newData();
  delete old.settings.rulesSince; delete old.settings.legacyRules; delete old.settings.molecule;
  old.settings.stableDay = { fractionPerCategory: 1 }; old.settings.stableWeek = { solidDayMinCheckins: 4, minSolidDays: 5 };
  old.settings.compounds.forEach(cp => { if (cp.id === 'glycine') { cp.rule.stableDays = 3; } if (cp.id === 'serotonin') cp.rule.stableDays = 33; });
  const pre = '2026-11-10', post = '2026-11-17', light = ['dailyText', 'bible', 'sleep', 'water', 'fasting', 'pushups', 'mindfulness'];
  light.forEach(h => E.checkIn(old, h, pre, { today: pre, rng: never }));
  const mig = E.normalize(JSON.parse(JSON.stringify(old)));
  ok(mig.settings.rulesSince === E.RULES_V2_SINCE && mig.settings.legacyRules.solidDayMinCheckins === 4 && mig.settings.stableDay === undefined, 'migration dates the rules and keeps the old numbers');
  ok(mig.settings.compounds.find(x => x.id === 'glycine').rule.stableDays === 5 && mig.settings.compounds.find(x => x.id === 'serotonin').rule.stableDays === 33, 'compound thresholds raised only where they matched the old defaults');
  light.forEach(h => E.checkIn(mig, h, post, { today: post, rng: never }));
  const md = E.derive(mig, post);
  ok(!md.byDate[pre].stable && md.byDate[pre].molecule.rule === 'all', 'a day before the ship date keeps the all-daily molecule rule');
  ok(md.byDate[post].stable && md.byDate[post].molecule.rule === 'weight', 'the same check-ins after it make a molecule by weight');
  const vit = E.newData(); delete vit.settings.rulesSince; const vn = E.normalize(vit);
  ['water', 'vitamins', 'dailyText', 'pushups'].forEach(h => E.checkIn(vn, h, pre, { today: pre, rng: never }));
  ok(E.derive(vn, pre).byDate[pre].solid, 'before the ship date, 4 check-ins still make a solid day');
  ok(JSON.stringify(E.normalize(JSON.parse(JSON.stringify(mig)))) === JSON.stringify(mig), 'normalizing a migrated file again changes nothing');
}


console.log('NEW HABITS: FAST / WALK / PREP STEPS');
{
  const t = '2026-03-02';
  // whole-day fast: 120% of the day before, no thinning, never in the daily total
  const f = E.newData(); const pays = [];
  for (let i = 0; i < 4; i++) { const dt = U.addDays(t, i); pays.push(E.checkIn(f, 'wholeFast', dt, { today: dt, rng: never }).entry.points); }
  ok(JSON.stringify(pays) === JSON.stringify([25, 30, 36, 43]), 'fast pays 25, 30, 36, 43 on consecutive days (' + pays.join(', ') + ')');
  ok(f.log[3].runDay === 4, 'entry records which day of the run it was');
  E.checkIn(f, 'wholeFast', U.addDays(t, 6), { today: U.addDays(t, 6), rng: never });
  ok(f.log[4].points === 25, 'a break resets the run to the base');
  const fd = E.derive(f, U.addDays(t, 6));
  ok(!fd.days.some(d => d.molecule.domains.health && d.molecule.domains.health.total !== 49), 'the fast never adds to Health daily weight');
  const g = E.newData();
  ['sleep', 'fasting', 'pushups', 'mindfulness', 'dailyText', 'bible'].forEach(h => E.checkIn(g, h, t, { today: t, rng: never }));
  const without = E.derive(g, t).byDate[t].stable;
  E.checkIn(g, 'wholeFast', t, { today: t, rng: never });
  ok(without && E.derive(g, t).byDate[t].stable, 'the fast never blocks a molecule');
  const sd = E.newData(); E.checkIn(sd, 'wholeFast', t, { today: t, rng: never });
  ok(E.derive(sd, t).byDate[t].solid, 'a fast day (25 of 62 weight) is a solid day on its own');
  // walk: habit or repair, never both
  const w = E.newData();
  E.checkIn(w, 'walk', t, { today: t, rng: never });
  const neg = E.checkIn(w, 'alcohol', t, { today: t, amount: 1, rng: never });
  ok(E.repair(w, neg.entry.id, 'walk', { today: t }).code === 'habitUsed', 'a walk already checked in cannot seal a repair');
  ok(!E.repair(w, neg.entry.id, 'hydrate', { today: t }).error, 'another action still can');
  const w2 = E.newData(); E.checkIn(w2, 'sleep', t, { today: t, rng: never });
  const n2 = E.checkIn(w2, 'alcohol', t, { today: t, amount: 1, rng: never }); E.repair(w2, n2.entry.id, 'walk', { today: t });
  ok(E.checkIn(w2, 'walk', t, { today: t, rng: never }).code === 'repairUsed', 'a walk that sealed a repair cannot also pay as the habit');
  ok(!E.checkIn(w2, 'walk', U.addDays(t, 1), { today: U.addDays(t, 1), rng: never }).error, 'the next day\'s walk is free');
  // prep steps
  const p = E.newData(); const ws = t;
  ok(E.checkIn(p, 'midweek1', ws, { today: ws, rng: never }).entry.points === 7 && E.checkIn(p, 'midweek2', ws, { today: ws, rng: never }).entry.points === 8, 'prep steps pay 7 and 8');
  ok(E.checkIn(p, 'midweek1', U.addDays(ws, 2), { today: U.addDays(ws, 2), rng: never }).code === 'duplicate', 'each step once a week');
}

console.log('MIGRATION TO HABIT SET 2');
{
  // an old file: single-step prep habits, no walk or fast, logged before the ship date
  const old = E.newData();
  old.habits = old.habits.filter(h => !['walk', 'wholeFast', 'midweek1', 'midweek2', 'watchtower1', 'watchtower2'].includes(h.id));
  E.RETIRED_HABITS.forEach(h => { const c = JSON.parse(JSON.stringify(h)); delete c.archived; delete c.archivedOn; old.habits.push(c); });
  delete old.meta.habitSet; delete old.settings.rulesSince;
  const w1 = '2026-10-26', w2 = '2026-11-02', w3 = '2026-11-09';     // Mondays
  [w1, w2, w3].forEach(d => { E.checkIn(old, 'midweek', U.addDays(d, 1), { today: U.addDays(d, 1), rng: never }); E.checkIn(old, 'watchtower', U.addDays(d, 5), { today: U.addDays(d, 5), rng: never }); });
  ['sleep', 'water', 'fasting', 'pushups', 'mindfulness', 'vitamins', 'dailyText', 'bible'].forEach(h => E.checkIn(old, h, '2026-11-10', { today: '2026-11-10', rng: never }));
  const before = E.derive(E.normalize(JSON.parse(JSON.stringify(old))), '2026-11-15');
  const m = E.normalize(JSON.parse(JSON.stringify(old)));
  const ids = m.habits.map(h => h.id);
  ok(['walk', 'wholeFast', 'midweek1', 'midweek2', 'watchtower1', 'watchtower2'].every(id => ids.includes(id)), 'new habits added to an old file');
  ok(m.habits.find(h => h.id === 'walk').addedOn === '2026-11-16' && m.habits.find(h => h.id === 'midweek').archivedOn === '2026-11-16', 'added and retired on the ship date');
  const after = E.derive(m, '2026-11-15');
  ok(JSON.stringify(after.days.map(d => [d.date, d.stable, d.solid])) === JSON.stringify(before.days.map(d => [d.date, d.stable, d.solid])) && after.byDate['2026-11-10'].stable, 'every past day reads exactly as before');
  const today = '2026-11-18';
  ok(E.derive(m, today).streaks.midweek1.n === 3 && E.derive(m, today).streaks.watchtower2.n === 3, 'old single-step weeks count for both new steps (3-week streaks carry on)');
  ok(E.checkIn(m, 'midweek', today, { today: today, rng: never }).error && !E.checkIn(m, 'midweek1', today, { today: today, rng: never }).error, 'the retired habit is closed, the step is open');
  ok(E.checkIn(m, 'walk', '2026-11-12', { today: today, rng: never }).error, 'the walk cannot be backfilled before it was added');
  ok(JSON.stringify(E.normalize(JSON.parse(JSON.stringify(m)))) === JSON.stringify(m), 'normalizing again changes nothing');
  const arch = E.newData(); arch.habits.push(Object.assign({}, E.RETIRED_HABITS[0], { archived: true })); delete arch.habits[arch.habits.length - 1].archivedOn; delete arch.meta.habitSet;
  ok(!E.normalize(arch).habits.find(h => h.id === 'midweek').archivedOn, 'a habit the owner had already archived stays archived for all time');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
