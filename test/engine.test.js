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
  ['sleep', 'dailyText', 'vitamins', 'pushups', 'bible', 'mindfulness', 'fasting', 'water'].forEach(h => { ev = ev.concat(E.checkIn(d, h, t, { today: t, rng: never }).events); });
  ok(ev.filter(e => e.type === 'bond').length === 2, 'two routines bonded');
  ok(ev.filter(e => e.type === 'molecule').length === 1 && E.derive(d, t).byDate[t].stable, 'full day formed a stable molecule');
  ok(E.derive(d, t).points === 57 + 10 + 15, 'points: 57 base + 2 bonds + molecule = 82');
  const sleepId = d.log.find(e => e.habitId === 'sleep').id; E.removeEntry(d, sleepId, t);
  ok(E.derive(d, t).points === 82 - 10 - 5 - 15, 'undoing one habit also removes its bond and the molecule reward');
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
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
