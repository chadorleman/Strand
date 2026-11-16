/* ==========================================================================
   STRAND HELIX  —  draws the double helix from derived strand days.
   Input is only what derive() produced from the log: one rung per log entry,
   an empty stretch per day without entries. Nothing here invents structure.
   The same code draws the strand in the tool and in the milestone films.
   ========================================================================== */
(function (root) {
'use strict';
var TAU = Math.PI * 2;
var C = { aqua: [88, 239, 201], amber: [255, 190, 85], lesion: [255, 77, 120], gold: [255, 233, 166], frost: [168, 220, 255], ink: [230, 243, 241], bond: [201, 184, 255] };
function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
function hsl(h, s, l, a) { return 'hsla(' + h + ',' + s + '%,' + l + '%,' + (a == null ? 1 : a) + ')'; }
function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
function ease(x) { x = clamp(x, 0, 1); return 1 - Math.pow(1 - x, 3); }

/* layout: world x for every day and every rung. ghost = open sites on the growing tip (today only). */
function layout(days, o) {
  var x = 0, L = { days: [], slots: [], width: 0, slotW: o.slotW, dayGap: o.dayGap, byDate: {}, byLog: {} };
  days.forEach(function (d, i) {
    var ghost = (o.ghost && o.ghost[d.date]) || 0;
    var n = Math.max(1, d.slots.length + ghost), w = n * o.slotW;
    var day = { i: i, d: d, x0: x, x1: x + w, mid: x + w / 2, slots: [], ghosts: [] };
    d.slots.forEach(function (s, si) { var sl = { x: x + (si + 0.5) * o.slotW, s: s, day: day }; day.slots.push(sl); L.slots.push(sl); L.byLog[s.logId] = sl; });
    for (var g = 0; g < ghost; g++) day.ghosts.push(x + (d.slots.length + g + 0.5) * o.slotW);
    day.realEnd = x + Math.max(d.slots.length, d.slots.length ? 0 : (ghost ? 0 : 1)) * o.slotW;
    L.days.push(day); L.byDate[d.date] = day;
    x += w + o.dayGap;
  });
  L.width = Math.max(0, x - o.dayGap);
  return L;
}

var scene = null;
function getScene(w, h) {
  if (!scene) { scene = document.createElement('canvas'); }
  if (scene.width !== w || scene.height !== h) { scene.width = w; scene.height = h; }
  return scene;
}

function hex(g, x, y, r) { g.beginPath(); for (var i = 0; i < 6; i++) { var a = TAU * i / 6 - Math.PI / 2; g[i ? 'lineTo' : 'moveTo'](x + r * Math.cos(a), y + r * Math.sin(a)); } g.closePath(); }
function star(g, x, y, r) { g.beginPath(); for (var i = 0; i < 8; i++) { var a = TAU * i / 8 - Math.PI / 2, rr = i % 2 ? r * 0.32 : r; g[i ? 'lineTo' : 'moveTo'](x + rr * Math.cos(a), y + rr * Math.sin(a)); } g.closePath(); }
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

/* draw — v: { W,H,dpr, scrollX, cy, amp, turn, phase, t, habits, bondedThrough, today, selected,
               hoverLog, hoverDate, anims, ripples, revealX, labels, dayNumbers, bloom, motes } */
function draw(ctx, L, v) {
  var dpr = v.dpr || 1, W = v.W, H = v.H, sx = v.scrollX, cy = v.cy, amp = v.amp;
  var k = TAU / ((v.turn || 10.5) * L.slotW), t = v.t || 0;
  var reveal = v.revealX == null ? Infinity : v.revealX;
  var sc = getScene(Math.round(W * dpr), Math.round(H * dpr)), g = sc.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H); g.lineCap = 'round'; g.lineJoin = 'round';

  function ampAt(x) {
    var a = amp;
    if (v.ripples) for (var i = 0; i < v.ripples.length; i++) {
      var r = v.ripples[i], age = t - r.t0; if (age < 0 || age > 1.3) continue;
      var dist = Math.abs(x - r.x);
      a += Math.sin(dist / 26 - age * 11) * Math.exp(-dist / 190) * (1 - age / 1.3) * (r.power || 7);
    }
    return a;
  }
  var wx0 = sx - 60, wx1 = Math.min(sx + W + 60, reveal);
  var vis = L.days.filter(function (d) { return d.x1 + L.dayGap >= wx0 && d.x0 <= wx1; });

  /* stable-day halos, selection */
  vis.forEach(function (day) {
    var X = day.x0 - sx, w = day.x1 - day.x0;
    if (day.d.stable && day.x1 <= reveal) {
      var gr = g.createLinearGradient(0, cy - amp - 20, 0, cy + amp + 20);
      gr.addColorStop(0, rgba(C.gold, 0.11)); gr.addColorStop(0.5, rgba(C.gold, 0.02)); gr.addColorStop(1, rgba(C.gold, 0.09));
      rr(g, X - 4, cy - amp - 20, w + 8, 2 * amp + 40, 12); g.fillStyle = gr; g.fill();
      g.strokeStyle = rgba(C.gold, 0.22); g.lineWidth = 1; g.stroke();
    }
    if (v.selected === day.d.date || v.hoverDate === day.d.date) {
      rr(g, X - 5, cy - amp - 24, w + 10, 2 * amp + 48, 13);
      g.strokeStyle = rgba(C.ink, v.selected === day.d.date ? 0.42 : 0.16); g.lineWidth = 1.2; g.setLineDash(v.selected === day.d.date ? [] : [3, 5]); g.stroke(); g.setLineDash([]);
    }
  });

  /* nick sites: backbone is cut where a pair is damaged */
  var nicks = [];
  vis.forEach(function (day) { day.slots.forEach(function (sl) { if (sl.s.t === 'damaged') nicks.push({ x: sl.x, strand: sl.s.cat === 'health' ? 0 : 1 }); }); });

  /* backbone samples */
  var step = 3, pts = [[], []], di = 0;
  var endX = Math.min(L.width, wx1), startX = Math.max(0, Math.floor(wx0 / step) * step);
  for (var x = startX; x <= endX + 0.01; x += step) {
    while (di < L.days.length - 1 && x > L.days[di].x1 + L.dayGap / 2) di++;
    var day = L.days[di], st = 'solid';
    if (x >= day.x0 - L.dayGap / 2) {
      if (day.d.state === 'gap') st = 'gap';
      else if (day.d.state === 'shielded' && !day.slots.length) st = 'frost';
      else if (!day.slots.length || x > day.x0 + day.slots.length * L.slotW) st = 'tip';
    }
    var th = x * k + v.phase, a = ampAt(x), sn = Math.sin(th), cs = Math.cos(th);
    pts[0].push({ X: x - sx, x: x, y: cy + a * sn, z: cs, st: st });
    pts[1].push({ X: x - sx, x: x, y: cy - a * sn, z: -cs, st: st });
  }
  function backbone(front) {
    for (var s = 0; s < 2; s++) {
      var P = pts[s], col = s === 0 ? C.aqua : C.amber;
      for (var i = 0; i < P.length - 1; i++) {
        var p = P[i], q = P[i + 1], z = (p.z + q.z) / 2;
        if ((z >= 0) !== front) continue;
        var cut = false; for (var n = 0; n < nicks.length; n++) if (nicks[n].strand === s && Math.abs(nicks[n].x - (p.x + q.x) / 2) < 4.2) { cut = true; break; }
        if (cut) continue;
        var zf = (z + 1) / 2, al = 0.26 + 0.74 * zf, w = 1.6 + 3.6 * zf, c = col;
        if (p.st === 'gap') { if (Math.floor(p.x / step) % 3 !== 0) continue; al *= 0.34; w *= 0.55; c = C.ink; }
        else if (p.st === 'frost') { c = C.frost; al *= 0.85; }
        else if (p.st === 'tip') { if (Math.floor(p.x / step) % 2 !== 0) continue; al *= 0.45; w *= 0.6; }
        g.strokeStyle = rgba(c, al); g.lineWidth = w;
        g.beginPath(); g.moveTo(p.X, p.y); g.lineTo(q.X, q.y); g.stroke();
      }
    }
  }
  backbone(false);

  /* routine bonds: an arc over the rungs that bonded that day */
  vis.forEach(function (day) {
    if (day.x1 > reveal) return;
    day.d.bonds.forEach(function (rid, j) {
      var rt = v.routines && v.routines[rid]; if (!rt) return;
      var xs = day.slots.filter(function (sl) { return rt.habits.indexOf(sl.s.habitId) >= 0 && sl.s.t === 'pair'; }).map(function (sl) { return sl.x - sx; });
      if (xs.length < 2) return;
      var up = j % 2 === 0, y0 = cy + (up ? -1 : 1) * (amp + 9), y1 = y0 + (up ? -1 : 1) * 13;
      var a = Math.min.apply(null, xs), b = Math.max.apply(null, xs);
      g.strokeStyle = rgba(C.ink, 0.5); g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(a, y0); g.bezierCurveTo(a, y1, b, y1, b, y0); g.stroke();
      g.fillStyle = rgba(C.ink, 0.75); xs.forEach(function (X) { g.beginPath(); g.arc(X, y0, 1.7, 0, TAU); g.fill(); });
    });
  });

  /* rungs: one per log entry */
  vis.forEach(function (day) {
    day.ghosts.forEach(function (gx) {
      var th = gx * k + v.phase, a = ampAt(gx), sn = Math.sin(th), X = gx - sx;
      g.strokeStyle = rgba(C.ink, 0.13); g.lineWidth = 1.2; g.setLineDash([2, 5]);
      g.beginPath(); g.moveTo(X, cy + a * sn); g.lineTo(X, cy - a * sn); g.stroke(); g.setLineDash([]);
    });
    day.slots.forEach(function (sl) {
      if (sl.x > reveal) return;
      var s = sl.s, X = sl.x - sx, th = sl.x * k + v.phase, a = ampAt(sl.x), sn = Math.sin(th), cs = Math.cos(th);
      var yA = cy + a * sn, yB = cy - a * sn, isA = s.cat === 'health';
      var yC = isA ? yA : yB, yO = isA ? yB : yA, zf = ((isA ? cs : -cs) + 1) / 2;
      var hab = v.habits[s.habitId] || { hue: 0 }, grow = 1, flash = 0;
      if (v.anims && v.anims[s.logId] != null) { var age = (t - v.anims[s.logId]) / 0.55; grow = ease(age); flash = clamp(1 - age / 1.6, 0, 1); }
      if (reveal !== Infinity) { grow = ease((reveal - sl.x) / (L.slotW * 2.2)); flash = clamp(1 - (reveal - sl.x) / (L.slotW * 7), 0, 1) * 0.8; }
      var hot = v.hoverLog === s.logId, depth = 0.55 + 0.45 * Math.abs(sn);
      var col = hsl(hab.hue, 88, 68 + flash * 18, 0.95 * depth + (hot ? 0.3 : 0)), r = (3 + 2.4 * zf) * (1 + flash * 0.9) * (0.4 + 0.6 * grow);
      var mC = cy + (yC - cy) * 0.07, mO = cy + (yO - cy) * 0.07;

      if (s.t === 'pair') {
        g.strokeStyle = col; g.lineWidth = hot ? 4 : 3;
        g.beginPath(); g.moveTo(X, yC); g.lineTo(X, yC + (mC - yC) * grow); g.stroke();
        g.strokeStyle = rgba(C.ink, (0.24 + (hot ? 0.3 : 0)) * depth); g.lineWidth = 2;
        g.beginPath(); g.moveTo(X, yO); g.lineTo(X, yO + (mO - yO) * grow); g.stroke();
        g.fillStyle = rgba(C.ink, 0.42); g.beginPath(); g.arc(X, yO, 1.9, 0, TAU); g.fill();
        g.fillStyle = col; g.beginPath(); g.arc(X, yC, r, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,' + (0.55 + flash * 0.45) + ')'; g.beginPath(); g.arc(X - r * 0.25, yC - r * 0.25, r * 0.34, 0, TAU); g.fill();
        if (s.bonus === 'rare') { g.fillStyle = rgba(C.gold, 0.95); star(g, X, yC, r + 6.5); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(X, yC, r * 0.55, 0, TAU); g.fill(); }
        else if (s.bonus === 'chest') { g.strokeStyle = rgba(C.gold, 0.95); g.lineWidth = 1.4; hex(g, X, yC, r + 4); g.stroke(); }
        else if (s.bonus === 'crit') { g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.2; g.beginPath(); g.arc(X, yC, r + 3.2, 0, TAU); g.stroke(); }
      } else if (s.t === 'damaged') {
        var pulse = 0.6 + 0.4 * Math.sin(t * 3.2 + sl.x);
        var gl = g.createRadialGradient(X, cy, 0, X, cy, amp * 0.9);
        gl.addColorStop(0, rgba(C.lesion, 0.30 * pulse * grow)); gl.addColorStop(1, rgba(C.lesion, 0));
        g.fillStyle = gl; g.fillRect(X - amp, cy - amp, amp * 2, amp * 2);
        g.strokeStyle = rgba(C.lesion, 0.95); g.lineWidth = 2.6;
        var eC = cy + (yC - cy) * 0.42, eO = cy + (yO - cy) * 0.36;
        g.beginPath(); g.moveTo(X, yC); g.lineTo(X + 1.5, yC + (eC - yC) * 0.6); g.lineTo(X - 3.5, eC); g.stroke();
        g.beginPath(); g.moveTo(X, yO); g.lineTo(X - 1.5, yO + (eO - yO) * 0.6); g.lineTo(X + 3.5, eO); g.stroke();
        g.lineWidth = 2; var q = 4 + zf * 1.5;
        g.beginPath(); g.moveTo(X - q, yC - q); g.lineTo(X + q, yC + q); g.moveTo(X + q, yC - q); g.lineTo(X - q, yC + q); g.stroke();
        if (hot) { g.strokeStyle = rgba(C.ink, 0.6); g.lineWidth = 1; g.beginPath(); g.arc(X, yC, q + 5, 0, TAU); g.stroke(); }
      } else { /* repaired: whole again, with the ligation seam left visible */
        g.strokeStyle = rgba(C.gold, 0.9 * depth + (hot ? 0.2 : 0)); g.lineWidth = hot ? 3.6 : 2.6;
        g.beginPath(); g.moveTo(X, yC); g.lineTo(X, yC + (yO - yC) * grow); g.stroke();
        g.fillStyle = rgba(C.gold, 1); g.save(); g.translate(X, cy); g.rotate(Math.PI / 4); g.fillRect(-3.4, -3.4, 6.8, 6.8); g.restore();
        g.fillStyle = hsl(hab.hue, 70, 72, 0.95); g.beginPath(); g.arc(X, yC, r, 0, TAU); g.fill();
        g.strokeStyle = rgba(C.gold, 1); g.lineWidth = 1.5; g.beginPath(); g.arc(X, yC, r + 3, 0, TAU); g.stroke();
        g.lineWidth = 1.6; g.beginPath(); g.moveTo(X - 5, yC - 6); g.lineTo(X - 5, yC + 6); g.moveTo(X + 5, yC - 6); g.lineTo(X + 5, yC + 6); g.stroke();
        if (flash > 0) { g.fillStyle = rgba(C.gold, flash * 0.5); g.beginPath(); g.arc(X, cy, 16 * flash + 6, 0, TAU); g.fill(); }
      }
      if (flash > 0 && s.t === 'pair') { g.fillStyle = hsl(hab.hue, 90, 75, flash * 0.35); g.beginPath(); g.arc(X, yC, r + 12 * flash, 0, TAU); g.fill(); }
    });
    /* markers for days without entries */
    if (!day.slots.length && day.x1 <= reveal) {
      var X = day.mid - sx;
      if (day.d.state === 'shielded') {
        g.fillStyle = rgba(C.frost, 0.16); hex(g, X, cy, 10); g.fill(); g.strokeStyle = rgba(C.frost, 0.95); g.lineWidth = 1.5; g.stroke();
        g.beginPath(); g.moveTo(X - 3.5, cy); g.lineTo(X - 0.8, cy + 3); g.lineTo(X + 4, cy - 3); g.stroke();
      } else if (day.d.state === 'gap') {
        g.strokeStyle = rgba(C.ink, 0.3); g.lineWidth = 1.1; g.setLineDash([2, 3]); g.beginPath(); g.arc(X, cy, 6, 0, TAU); g.stroke(); g.setLineDash([]);
      }
    }
    if (day.d.stable && day.x1 <= reveal) { var hx = day.mid - sx, hy = cy - amp - 30; g.strokeStyle = rgba(C.gold, 0.9); g.lineWidth = 1.3; hex(g, hx, hy, 5.5); g.stroke(); g.fillStyle = rgba(C.gold, 0.9); g.beginPath(); g.arc(hx, hy, 1.6, 0, TAU); g.fill(); }
  });

  backbone(true);

  /* growing tip */
  if (v.tip !== false && reveal === Infinity && L.days.length) {
    var last = L.days[L.days.length - 1], tx = last.x0 + last.slots.length * L.slotW, thT = tx * k + v.phase;
    var pu = 0.5 + 0.5 * Math.sin(t * 2.4);
    [1, -1].forEach(function (sg, i) { g.fillStyle = rgba(i ? C.amber : C.aqua, 0.5 + 0.4 * pu); g.beginPath(); g.arc(tx - sx, cy + sg * ampAt(tx) * Math.sin(thT), 2.6 + pu * 1.6, 0, TAU); g.fill(); });
  }

  /* composite: soft bloom under a crisp copy */
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, sc.width, sc.height);
  if (v.motes) drawMotes(ctx, v, sc.width, sc.height, dpr);
  if (v.bloom !== false) {
    ctx.globalCompositeOperation = 'lighter'; ctx.filter = 'blur(' + Math.round(9 * dpr) + 'px)'; ctx.globalAlpha = 0.85; ctx.drawImage(sc, 0, 0);
    ctx.filter = 'blur(' + Math.round(26 * dpr) + 'px)'; ctx.globalAlpha = 0.5; ctx.drawImage(sc, 0, 0);
    ctx.filter = 'none'; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  ctx.drawImage(sc, 0, 0); ctx.restore();

  if (v.labels !== false) labels(ctx, L, v, vis, reveal);
}

function drawMotes(ctx, v, w, h, dpr) {
  var t = v.t || 0, n = v.moteCount || 46;
  for (var i = 0; i < n; i++) {
    var s1 = Math.sin(i * 127.1) * 43758.5453, s2 = Math.sin(i * 311.7) * 24634.6345, s3 = Math.sin(i * 74.7) * 12414.3;
    var fx = s1 - Math.floor(s1), fy = s2 - Math.floor(s2), fz = s3 - Math.floor(s3);
    var par = 0.15 + fz * 0.5;
    var x = ((fx * w - (v.scrollX || 0) * par * dpr + t * (4 + fz * 9) * dpr) % w + w) % w;
    var y = (fy * h + Math.sin(t * 0.3 + i) * 10 * dpr + h) % h;
    ctx.fillStyle = 'rgba(190,235,235,' + (0.05 + fz * 0.16) + ')';
    ctx.beginPath(); ctx.arc(x, y, (0.6 + fz * 1.9) * dpr, 0, TAU); ctx.fill();
  }
}

var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
function labels(ctx, L, v, vis, reveal) {
  var sx = v.scrollX, cy = v.cy, amp = v.amp, font = v.font || 'Bahnschrift, "Segoe UI", system-ui, sans-serif';
  var yBar = cy + amp + 30, yTxt = yBar + 19;
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineCap = 'round';
  var lastMonthX = -999;
  vis.forEach(function (day) {
    if (day.x1 > reveal) return;
    var d = day.d, X0 = day.x0 - sx, X1 = day.x1 - sx, mid = day.mid - sx;
    var p = d.date.split('-'), dom = +p[2], wd = new Date(+p[0], +p[1] - 1, dom).getDay();
    var bonded = v.bondedThrough && d.date <= v.bondedThrough;
    var next = L.days[day.i + 1], join = next && next.d.weekStart === d.weekStart ? L.dayGap : 0;
    /* week bar: solid = bonded for good, dashed = still loose */
    ctx.beginPath(); ctx.moveTo(X0, yBar); ctx.lineTo(X1 + join, yBar);
    if (bonded) { ctx.strokeStyle = rgba(C.bond, 0.9); ctx.lineWidth = 3; ctx.setLineDash([]); }
    else { ctx.strokeStyle = rgba(C.ink, 0.28); ctx.lineWidth = 1.4; ctx.setLineDash([3, 5]); }
    ctx.stroke(); ctx.setLineDash([]);
    var isToday = d.date === v.today, sel = d.date === v.selected;
    ctx.font = (isToday || sel ? '600 ' : '400 ') + '12px ' + font;
    ctx.fillStyle = isToday ? rgba(C.aqua, 1) : d.state === 'shielded' ? rgba(C.frost, 0.95) : d.state === 'gap' ? rgba(C.ink, 0.38) : rgba(C.ink, sel ? 1 : 0.62);
    var wide = X1 - X0 >= 30;
    var txt = v.dayNumbers ? String(day.i + 1) : (isToday && wide ? 'Today' : (wide ? DOW[wd] + ' ' : '') + dom);
    ctx.fillText(txt, mid, yTxt);
    if (!v.dayNumbers && (dom === 1 || day === vis[0]) && mid - lastMonthX > 70) { ctx.font = '600 12px ' + font; ctx.fillStyle = rgba(C.ink, 0.5); ctx.textAlign = 'left'; ctx.fillText(MON[+p[1] - 1] + ' ' + p[0], Math.max(X0, 8), yTxt + 17); ctx.textAlign = 'center'; lastMonthX = mid; }
  });
  ctx.restore();
}

/* pick: what is under the pointer */
function pick(L, v, mx, my) {
  var wx = mx + v.scrollX, out = { slot: null, day: null };
  for (var i = 0; i < L.days.length; i++) { var d = L.days[i]; if (wx >= d.x0 - L.dayGap / 2 && wx < d.x1 + L.dayGap / 2) { out.day = d; break; } }
  if (out.day && Math.abs(my - v.cy) < v.amp + 14) {
    var best = null, bd = L.slotW * 0.6;
    out.day.slots.forEach(function (sl) { var dd = Math.abs(sl.x - wx); if (dd < bd) { bd = dd; best = sl; } });
    out.slot = best;
  }
  return out;
}
function slotScreen(L, v, logId) {
  var sl = L.byLog[logId]; if (!sl) return null;
  var k = TAU / ((v.turn || 10.5) * L.slotW), sn = Math.sin(sl.x * k + v.phase);
  return { x: sl.x - v.scrollX, y: v.cy + (sl.s.cat === 'health' ? 1 : -1) * v.amp * sn, wx: sl.x };
}

/* minimap: the whole strand at a glance, one column per day */
function mini(ctx, L, v, W, H, dpr) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  if (!L.days.length) return;
  var sxs = W / Math.max(L.width, 1), maxN = 1;
  L.days.forEach(function (d) { if (d.slots.length > maxN) maxN = d.slots.length; });
  L.days.forEach(function (day) {
    var d = day.d, x = day.x0 * sxs, w = Math.max(1.5, (day.x1 - day.x0) * sxs - 1), n = d.slots.length;
    if (!n) { ctx.fillStyle = d.state === 'shielded' ? rgba(C.frost, 0.9) : rgba(C.ink, 0.16); ctx.fillRect(x, H / 2 - 1, w, 2); return; }
    var h = Math.max(3, (H - 6) * n / maxN);
    ctx.fillStyle = d.stable ? rgba(C.gold, 0.85) : rgba(C.aqua, 0.5); ctx.fillRect(x, (H - h) / 2, w, h);
    if (d.slots.some(function (s) { return s.t === 'damaged'; })) { ctx.fillStyle = rgba(C.lesion, 1); ctx.fillRect(x, (H - h) / 2, w, 3); }
    else if (d.slots.some(function (s) { return s.t === 'repaired'; })) { ctx.fillStyle = rgba(C.gold, 1); ctx.fillRect(x, (H - h) / 2, w, 3); }
  });
  ctx.strokeStyle = rgba(C.ink, 0.75); ctx.lineWidth = 1.2;
  rr(ctx, v.scrollX * sxs + 0.6, 0.6, Math.min(W - 1.2, v.W * sxs), H - 1.2, 3); ctx.stroke();
}

root.StrandHelix = { layout: layout, draw: draw, pick: pick, slotScreen: slotScreen, mini: mini, C: C, rgba: rgba, hsl: hsl };
})(typeof window !== 'undefined' ? window : globalThis);
