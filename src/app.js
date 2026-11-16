/* ==========================================================================
   STRAND APP  —  screen, sound, storage. Rules live in the engine above.
   ========================================================================== */
(function () {
'use strict';
var E = window.StrandEngine, U = E.util, HX = window.StrandHelix;
function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
var DAYN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], MONN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function longDate(iso) { var d = U.parseISO(iso); return DAYN[d.getDay()] + ', ' + MONN[d.getMonth()] + ' ' + d.getDate(); }
function shortDate(iso) { var d = U.parseISO(iso); return DAYN[d.getDay()].slice(0, 3) + ' ' + MONN[d.getMonth()] + ' ' + d.getDate(); }
function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }

var LS_KEY = 'strand.data.v1', DATA_FILE = 'strand-data.json', MEDIA_DIR = 'media';
var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
var st = {
  data: null, D: null, today: U.toISO(new Date()), sel: null, L: null, habits: {}, routines: {},
  v: { slotW: 17, dayGap: 10, scrollX: 0, target: null, phase: 0.6, anims: {}, ripples: [], hoverLog: null, hoverDate: null, W: 0, H: 0, dpr: 1, vel: 0, motes: true, bloom: true },
  dir: null, dirState: 'none', dirName: '', lastWrite: null, writeError: null, mediaCache: {},
  undoArm: null, negOpen: false, negAmt: 1, repairPick: {}, genePick: null, drawer: null, t0: performance.now(), shownPts: 0, importReport: null
};
function clock() { return (performance.now() - st.t0) / 1000; }
function S() { return st.data.settings; }

/* ============================== storage ================================== */
var IDB = {
  db: null,
  open: function () {
    return new Promise(function (res) {
      if (IDB.db) return res(IDB.db);
      try {
        var rq = indexedDB.open('strand-db', 1);
        rq.onupgradeneeded = function () { rq.result.createObjectStore('kv'); };
        rq.onsuccess = function () { IDB.db = rq.result; res(IDB.db); };
        rq.onerror = function () { res(null); };
      } catch (e) { res(null); }
    });
  },
  get: function (k) { return IDB.open().then(function (db) { return new Promise(function (res) { if (!db) return res(null); try { var r = db.transaction('kv').objectStore('kv').get(k); r.onsuccess = function () { res(r.result || null); }; r.onerror = function () { res(null); }; } catch (e) { res(null); } }); }); },
  set: function (k, v) { return IDB.open().then(function (db) { return new Promise(function (res) { if (!db) return res(false); try { var tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = function () { res(true); }; tx.onerror = function () { res(false); }; } catch (e) { res(false); } }); }); },
  del: function (k) { return IDB.open().then(function (db) { return new Promise(function (res) { if (!db) return res(false); try { var tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').delete(k); tx.oncomplete = function () { res(true); }; } catch (e) { res(false); } }); }); }
};

var Store = {
  canLink: !!window.showDirectoryPicker, pending: null, writing: false,
  init: function () {
    var raw = null;
    try { raw = localStorage.getItem(LS_KEY); } catch (e) {}
    if (raw) { try { st.data = E.normalize(JSON.parse(raw)); } catch (e) { st.data = null; } }
    if (!st.data) st.data = E.buildSample(st.today);
    if (!Store.canLink) return Promise.resolve();
    return IDB.get('dir').then(function (h) {
      if (!h) return;
      st.dir = h; st.dirName = h.name;
      return h.queryPermission({ mode: 'readwrite' }).then(function (p) {
        if (p === 'granted') { st.dirState = 'linked'; return Store.readFile(); }
        st.dirState = 'paused';
      });
    }).catch(function () {});
  },
  readFile: function () {
    return st.dir.getFileHandle(DATA_FILE).then(function (fh) { return fh.getFile(); }).then(function (f) { return f.text(); }).then(function (txt) {
      if (!txt.trim()) return false;
      st.data = E.normalize(JSON.parse(txt)); return true;
    }).catch(function (e) { if (e && e.name !== 'NotFoundError') toast('Could not read ' + DATA_FILE + ': ' + esc(e.message), 'bad'); return false; });
  },
  text: function () { return JSON.stringify(st.data, null, 2); },
  save: function (quiet) {
    if (!quiet) st.data.meta.updatedAt = new Date().toISOString();
    st.data.derived = E.snapshot(st.D);
    var txt = Store.text();
    try { localStorage.setItem(LS_KEY, txt); } catch (e) {}
    if (st.dirState === 'linked') Store.queue(txt);
    if (!quiet) GH.schedule();
    syncStatus();
  },
  queue: function (txt) {
    Store.pending = txt; if (Store.writing) return; Store.writing = true;
    (function loop() {
      if (Store.pending == null) { Store.writing = false; syncStatus(); return; }
      var t = Store.pending; Store.pending = null;
      st.dir.getFileHandle(DATA_FILE, { create: true }).then(function (fh) { return fh.createWritable(); })
        .then(function (w) { return w.write(t).then(function () { return w.close(); }); })
        .then(function () { st.lastWrite = new Date(); st.writeError = null; loop(); })
        .catch(function (e) { st.writeError = e.message || String(e); Store.writing = false; syncStatus(); });
    })();
  },
  link: function () {
    return window.showDirectoryPicker({ id: 'strand', mode: 'readwrite' }).then(function (h) {
      st.dir = h; st.dirName = h.name; st.dirState = 'linked'; st.mediaCache = {};
      return IDB.set('dir', h).then(function () { return h.getDirectoryHandle(MEDIA_DIR, { create: true }).catch(function () {}); })
        .then(function () { return h.getFileHandle(DATA_FILE).then(function () { return true; }, function () { return false; }); })
        .then(function (exists) {
          if (!exists) { Store.save(); toast('<b>Linked.</b> Saving to ' + esc(h.name) + '/' + DATA_FILE + ' from now on.', 'gold'); refreshAll(); return; }
          modal('This folder already has a Strand data file', 'Load that file, or replace it with what is on screen now?', [
            { label: 'Load the file', cls: 'go', fn: function () { Store.readFile().then(function () { boot2(); toast('<b>Loaded</b> ' + esc(h.name) + '/' + DATA_FILE, 'gold'); }); } },
            { label: 'Replace it with what is on screen', fn: function () { Store.save(); refreshAll(); toast('<b>Linked.</b> The file now holds what is on screen.', 'gold'); } }
          ]);
        });
    }).catch(function (e) { if (e && e.name !== 'AbortError') toast('Could not link the folder: ' + esc(e.message), 'bad'); });
  },
  reconnect: function () {
    return st.dir.requestPermission({ mode: 'readwrite' }).then(function (p) {
      if (p !== 'granted') { toast('Permission was not granted. Data stays in this browser for now.', 'bad'); return; }
      st.dirState = 'linked'; st.mediaCache = {};
      return Store.readFile().then(function (ok) { if (!ok) Store.save(); boot2(); toast('<b>Reconnected</b> to ' + esc(st.dirName) + '/' + DATA_FILE, 'gold'); });
    }).catch(function (e) { toast('Could not reconnect: ' + esc(e.message), 'bad'); });
  },
  unlink: function () { st.dir = null; st.dirState = 'none'; st.mediaCache = {}; IDB.del('dir'); syncStatus(); if (st.drawer) renderDrawer(); }
};


/* ============================== GitHub sync ============================== */
/* Saves strand-data.json to a repo you own (keep it private) through the GitHub
   API. The token stays in this browser's storage only: never in the page,
   never in the data file. Every save is a commit, so the repo keeps history. */
var GH = {
  cfg: null, sha: null, base: null, timer: null, busy: false, again: false, state: 'off', err: '', last: null, edit: false, lastCheck: 0, pendingPush: false, pendingConflict: null,
  K: { cfg: 'strand.gh', sha: 'strand.gh.sha', dirty: 'strand.gh.dirty', base: 'strand.gh.base' },
  ls: function (k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } },
  load: function () { try { GH.cfg = JSON.parse(GH.ls(GH.K.cfg) || 'null'); } catch (e) { GH.cfg = null; } GH.sha = GH.ls(GH.K.sha) || null; var b = GH.ls(GH.K.base); GH.base = b ? +b : null; return GH.on(); },
  on: function () { return !!(GH.cfg && GH.cfg.token && GH.cfg.owner && GH.cfg.repo); },
  dirty: function (v) { if (v === undefined) return GH.ls(GH.K.dirty) === '1'; GH.ls(GH.K.dirty, v ? '1' : '0'); },
  setSha: function (sha) { GH.sha = sha; GH.ls(GH.K.sha, sha || null); },
  setBase: function (n) { GH.base = n; GH.ls(GH.K.base, n == null ? null : String(n)); },
  api: function (path, opt) {
    opt = opt || {};
    var h = { Authorization: 'Bearer ' + GH.cfg.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (opt.body) h['Content-Type'] = 'application/json';
    return fetch('https://api.github.com' + path, { method: opt.method || 'GET', cache: 'no-store', headers: h, body: opt.body ? JSON.stringify(opt.body) : undefined })
      .then(function (r) {
        if (r.status === 404) return null;
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) { var e = new Error(r.status === 401 ? 'GitHub rejected the token. It may have expired or been revoked.' : r.status === 403 ? 'The token is not allowed to do that. It needs Contents: Read and write on this repo.' : (j.message || 'GitHub answered ' + r.status)); e.status = r.status; throw e; }
          return j;
        });
      }, function () { var e = new Error('Could not reach GitHub. Check the connection; your changes are kept here and will be saved when it is back.'); e.status = 0; throw e; });
  },
  repoPath: function () { return '/repos/' + encodeURIComponent(GH.cfg.owner) + '/' + encodeURIComponent(GH.cfg.repo); },
  filePath: function () { return GH.repoPath() + '/contents/' + GH.cfg.path.split('/').map(encodeURIComponent).join('/'); },
  b64enc: function (txt) { var b = new TextEncoder().encode(txt), out = ''; for (var i = 0; i < b.length; i += 0x8000) out += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(out); },
  b64dec: function (b64) { var s = atob(b64.replace(/\s/g, '')), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return new TextDecoder().decode(a); },
  fetchRemote: function () {
    var ref = GH.cfg.branch ? '?ref=' + encodeURIComponent(GH.cfg.branch) : '';
    return GH.api(GH.filePath() + ref).then(function (j) {
      if (!j) return null;
      var c = j.content ? Promise.resolve(j.content) : GH.api(GH.repoPath() + '/git/blobs/' + j.sha).then(function (b) { return b.content; });   // files over 1 MB
      return c.then(function (content) { return { sha: j.sha, text: GH.b64dec(content) }; });
    });
  },
  message: function () {
    var base = GH.base, H = st.habits, parts = [];
    if (base != null) {
      st.data.log.forEach(function (e) {
        var n = H[e.habitId] ? H[e.habitId].short : e.habitId;
        if (e.seq > base) parts.push(n + (e.kind === 'negative' ? ' x' + e.amount : '') + ' ' + e.date.slice(5));
        if (e.repair && e.repair.seq > base) parts.push('repaired ' + n + ' ' + e.date.slice(5));
      });
      (st.data.traits || []).forEach(function (t) { if (t.seq > base) parts.push('gene: ' + t.name); });
    }
    var head = parts.length ? parts.slice(0, 8).join(', ') + (parts.length > 8 ? ', and ' + (parts.length - 8) + ' more' : '') : 'update';
    return 'Strand: ' + head + ' (' + fmt(st.D ? st.D.points : 0) + ' points)';
  },
  schedule: function () {
    if (!GH.on()) return;
    GH.dirty(true);
    if (GH.state === 'conflict') return;
    GH.state = 'pending'; clearTimeout(GH.timer); GH.timer = setTimeout(GH.push, 5000); syncStatus();
  },
  push: function () {
    if (!GH.on()) return;
    clearTimeout(GH.timer);
    if (GH.busy) { GH.again = true; return; }
    GH.busy = true; GH.state = 'saving'; syncStatus();
    var body = { message: GH.message(), content: GH.b64enc(Store.text()) }, seqAt = st.data.meta.seq;
    if (GH.sha) body.sha = GH.sha;
    if (GH.cfg.branch) body.branch = GH.cfg.branch;
    GH.api(GH.filePath(), { method: 'PUT', body: body }).then(function (j) {
      GH.busy = false;
      if (!j) { GH.setSha(null); GH.state = 'error'; GH.err = 'The repo or file was not found. Check the repo name in Data.'; syncStatus(); return; }
      GH.setSha(j.content.sha); GH.setBase(seqAt); GH.last = new Date(); GH.err = '';
      if (GH.again) { GH.again = false; GH.push(); return; }
      GH.dirty(false); GH.state = 'ok'; syncStatus();
    }).catch(function (e) {
      GH.busy = false; GH.again = false;
      if (e.status === 409 || (e.status === 422 && /sha/i.test(e.message))) return GH.conflict();
      GH.state = 'error'; GH.err = e.message; syncStatus();
    });
  },
  apply: function (rm) {
    var d = E.normalize(JSON.parse(rm.text));
    st.data = d; GH.setSha(rm.sha); GH.setBase(d.meta.seq); GH.dirty(false); GH.state = 'ok'; GH.err = ''; GH.last = new Date();
    try { localStorage.setItem(LS_KEY, rm.text); } catch (e) {}
  },
  conflict: function (known) {
    GH.state = 'conflict'; syncStatus();
    (known ? Promise.resolve(known) : GH.fetchRemote()).then(function (rm) {
      var when = '';
      try { var m = JSON.parse(rm.text).meta; when = ' at ' + new Date(m.updatedAt).toLocaleString(); } catch (e) {}
      modal('Your saved data changed on another device', 'GitHub has a newer save' + esc(when) + ' than the one this device started from, and this device has changes too. Choose which version to keep. The other one stays in the repo\'s commit history, so you can still get it back.', [
        { label: 'Load the saved version', cls: 'go', fn: function () { GH.apply(rm); st.mediaCache = {}; boot2(true); toast('<b>Loaded the latest save from GitHub.</b>', 'gold'); } },
        { label: 'Keep this device\'s version', fn: function () { GH.setSha(rm ? rm.sha : null); GH.state = 'pending'; GH.push(); } }
      ]);
    }).catch(function (e) { GH.state = 'error'; GH.err = e.message; syncStatus(); });
  },
  /* on open: decide whether this device or GitHub has the newer data */
  init: function () {
    if (!GH.load()) return Promise.resolve();
    GH.state = 'saving';
    return GH.fetchRemote().then(function (rm) {
      if (!rm) { GH.setSha(null); GH.pendingPush = true; return; }
      if (rm.sha === GH.sha) { if (GH.dirty()) GH.pendingPush = true; else GH.state = 'ok'; return; }
      if (!GH.dirty()) { GH.apply(rm); return; }
      GH.pendingConflict = rm;
    }).catch(function (e) { GH.state = 'error'; GH.err = e.message; });
  },
  afterBoot: function () {
    if (GH.pendingPush) { GH.pendingPush = false; GH.push(); }
    if (GH.pendingConflict) { var rm = GH.pendingConflict; GH.pendingConflict = null; GH.conflict(rm); }
    syncStatus();
  },
  /* coming back to the tab: pick up a save made on another device */
  check: function () {
    if (!GH.on() || GH.busy || GH.dirty() || GH.state === 'conflict' || Date.now() - GH.lastCheck < 15000) return;
    GH.lastCheck = Date.now();
    GH.fetchRemote().then(function (rm) {
      if (rm && rm.sha !== GH.sha && !GH.dirty()) { GH.apply(rm); st.mediaCache = {}; boot2(true); toast('<b>Loaded your latest save</b> from another device.', 'gold'); }
    }).catch(function () {});
  },
  connect: function (cfg) {
    GH.cfg = cfg; GH.state = 'saving'; GH.err = ''; syncStatus(); if (st.drawer === 'data') renderDrawer();
    var fail = function (msg) { GH.cfg = null; GH.state = 'off'; GH.err = msg; syncStatus(); if (st.drawer === 'data') renderDrawer(); toast(esc(msg), 'bad'); };
    return GH.api(GH.repoPath()).then(function (repo) {
      if (!repo) return fail('Repo ' + cfg.owner + '/' + cfg.repo + ' was not found, or the token cannot see it. Check the name and the token\'s repository access.');
      if (repo.permissions && repo.permissions.push === false) return fail('This token can read the repo but not write to it. Give it Contents: Read and write.');
      var go = function () {
        GH.ls(GH.K.cfg, JSON.stringify(cfg)); GH.setSha(null); GH.setBase(null); GH.edit = false;
        return GH.fetchRemote().then(function (rm) {
          if (!rm) { GH.push(); toast('<b>Connected.</b> Saving to ' + esc(cfg.owner + '/' + cfg.repo) + ' from now on.', 'gold'); if (st.drawer === 'data') renderDrawer(); return; }
          modal('This repo already has Strand data', 'Load the data saved in ' + esc(cfg.owner + '/' + cfg.repo) + ', or replace it with what is on screen now? Replacing still keeps the old version in the commit history.', [
            { label: 'Load the saved data', cls: 'go', fn: function () { GH.apply(rm); st.mediaCache = {}; boot2(true); toast('<b>Connected</b> and loaded your saved data.', 'gold'); } },
            { label: 'Replace it with what is on screen', fn: function () { GH.setSha(rm.sha); GH.push(); toast('<b>Connected.</b> GitHub now holds what is on screen.', 'gold'); } }
          ]);
        });
      };
      if (repo.private === false) {
        modal('This repo is public', 'Anyone could read your habit log there, alcohol entries included. Make the repo private on GitHub first (Settings, then Change visibility), or connect anyway.', [
          { label: 'Connect anyway', fn: go }, { label: 'I will make it private first', cls: 'go', fn: function () { fail('Not connected. Make the repo private, then connect again.'); } }
        ]);
        return;
      }
      return go();
    }).catch(function (e) { fail(e.message); });
  },
  disconnect: function () {
    [GH.K.cfg, GH.K.sha, GH.K.dirty, GH.K.base].forEach(function (k) { GH.ls(k, null); });
    GH.cfg = null; GH.sha = null; GH.state = 'off'; GH.err = ''; GH.edit = false; clearTimeout(GH.timer); syncStatus();
  }
};

/* ============================== media slots ============================== */
var Media = {
  exts: { video: ['mp4', 'webm'], image: ['png', 'jpg', 'jpeg', 'webp'] },
  probe: function (url, kind) {
    return new Promise(function (res) {
      var done = false, el = kind === 'video' ? document.createElement('video') : new Image();
      function fin(ok) { if (done) return; done = true; res(ok); }
      if (kind === 'video') { el.preload = 'metadata'; el.onloadedmetadata = function () { fin(true); }; } else el.onload = function () { fin(true); };
      el.onerror = function () { fin(false); }; setTimeout(function () { fin(false); }, 2500); el.src = url;
    });
  },
  resolve: function (slot) {
    if (st.mediaCache[slot.id] !== undefined) return Promise.resolve(st.mediaCache[slot.id]);
    var exts = Media.exts[slot.kind], found = null;
    function fromFolder() {
      if (st.dirState !== 'linked') return Promise.resolve();
      return st.dir.getDirectoryHandle(MEDIA_DIR).then(function (md) {
        return exts.reduce(function (p, ext) {
          return p.then(function () { if (found) return; return md.getFileHandle(slot.id + '.' + ext).then(function (fh) { return fh.getFile(); }).then(function (f) { found = { url: URL.createObjectURL(f), file: MEDIA_DIR + '/' + slot.id + '.' + ext }; }, function () {}); });
        }, Promise.resolve());
      }).catch(function () {});
    }
    function fromBrowser() { if (found) return; return IDB.get('media:' + slot.id).then(function (rec) { if (rec && rec.blob) found = { url: URL.createObjectURL(rec.blob), file: rec.name + ' (kept in this browser)' }; }); }
    function fromBeside() {
      if (found) return;
      return exts.reduce(function (p, ext) { return p.then(function () { if (found) return; var u = MEDIA_DIR + '/' + slot.id + '.' + ext; return Media.probe(u, slot.kind).then(function (ok) { if (ok) found = { url: u, file: u }; }); }); }, Promise.resolve());
    }
    return fromFolder().then(fromBrowser).then(fromBeside).then(function () { st.mediaCache[slot.id] = found; return found; });
  },
  scan: function () {
    var changed = false;
    return st.data.media.reduce(function (p, slot) {
      return p.then(function () { return Media.resolve(slot); }).then(function (f) {
        if (f && (slot.status !== 'imported' || slot.file !== f.file)) { slot.status = 'imported'; slot.file = f.file; slot.importedOn = slot.importedOn || st.today; changed = true; }
        if (!f && slot.status === 'imported') { slot.status = 'missing'; changed = true; }
      });
    }, Promise.resolve()).then(function () { if (changed) Store.save(); renderHUD(); if (st.drawer === 'vault') renderDrawer(); });
  },
  importFile: function (slot, file) {
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    if (Media.exts[slot.kind].indexOf(ext) < 0) { toast('This slot takes ' + Media.exts[slot.kind].join(', ') + ' files.', 'bad'); return Promise.resolve(); }
    var p;
    if (st.dirState === 'linked') {
      p = st.dir.getDirectoryHandle(MEDIA_DIR, { create: true }).then(function (md) { return md.getFileHandle(slot.id + '.' + ext, { create: true }); })
        .then(function (fh) { return fh.createWritable(); }).then(function (w) { return w.write(file).then(function () { return w.close(); }); });
    } else p = IDB.set('media:' + slot.id, { blob: file, name: slot.id + '.' + ext });
    return p.then(function () { delete st.mediaCache[slot.id]; return Media.scan(); }).then(function () { toast('<b>Imported.</b> ' + esc(slot.id) + ' is in its slot.', 'gold'); })
      .catch(function (e) { toast('Import failed: ' + esc(e.message), 'bad'); });
  }
};

/* ============================== sound ==================================== */
var Sfx = {
  ctx: null, on: true,
  init: function () {
    if (!Sfx.on) return;
    try { if (!Sfx.ctx) { var AC = window.AudioContext || window.webkitAudioContext; Sfx.ctx = new AC(); Sfx.out = Sfx.ctx.createGain(); Sfx.out.gain.value = 0.42; Sfx.out.connect(Sfx.ctx.destination); } if (Sfx.ctx.state === 'suspended') Sfx.ctx.resume(); } catch (e) { Sfx.ctx = null; }
  },
  tone: function (f, at, dur, type, vol, slide) {
    if (!Sfx.on || !Sfx.ctx) return;
    var c = Sfx.ctx, t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(Sfx.out); o.start(t); o.stop(t + dur + 0.05);
  },
  note: function (semi) { return 392 * Math.pow(2, semi / 12); },
  check: function (n) { var sc = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24], f = Sfx.note(sc[n % sc.length]); Sfx.tone(f, 0, 0.3, 'triangle', 0.4); Sfx.tone(f * 2, 0.015, 0.22, 'sine', 0.16); Sfx.tone(f * 3, 0.03, 0.12, 'sine', 0.05); },
  bonus: function (type) { var seq = type === 'rare' ? [12, 16, 19, 24, 28, 31, 36] : type === 'chest' ? [7, 12, 16, 19, 24] : [12, 19, 24]; if (type === 'chest') Sfx.tone(110, 0, 0.18, 'square', 0.16, 70); seq.forEach(function (s, i) { Sfx.tone(Sfx.note(s), 0.05 + i * 0.065, 0.32, 'triangle', 0.24); Sfx.tone(Sfx.note(s + 12), 0.05 + i * 0.065, 0.2, 'sine', 0.08); }); },
  bond: function () { Sfx.tone(Sfx.note(0), 0, 0.5, 'sine', 0.24); Sfx.tone(Sfx.note(7), 0.07, 0.5, 'sine', 0.24); },
  molecule: function () { [0, 4, 7, 12, 16].forEach(function (s, i) { Sfx.tone(Sfx.note(s), i * 0.05, 1.1, 'triangle', 0.2); }); },
  damage: function () { Sfx.tone(140, 0, 0.5, 'sawtooth', 0.26, 48); Sfx.tone(97, 0.02, 0.6, 'square', 0.12, 40); },
  repair: function () { Sfx.tone(220, 0, 0.34, 'sawtooth', 0.1, 880); [7, 12, 19].forEach(function (s, i) { Sfx.tone(Sfx.note(s), 0.3 + i * 0.07, 0.6, 'triangle', 0.22); }); },
  stage: function () { [-12, 0, 7, 12, 16, 19, 24].forEach(function (s, i) { Sfx.tone(Sfx.note(s), i * 0.09, 2.2, i < 2 ? 'sine' : 'triangle', 0.2); }); },
  undo: function () { Sfx.tone(330, 0, 0.16, 'sine', 0.16, 200); },
  gene: function () { [0, 7, 12, 19, 24, 31].forEach(function (s, i) { Sfx.tone(Sfx.note(s), i * 0.075, 1.3, i % 2 ? 'sine' : 'triangle', 0.2); }); Sfx.tone(98, 0, 0.9, 'sine', 0.2); },
  shield: function () { Sfx.tone(1318, 0, 0.5, 'sine', 0.14); Sfx.tone(1760, 0.08, 0.6, 'sine', 0.1); }
};

/* ============================== effects ================================== */
var FX = {
  parts: [], run: false,
  burst: function (x, y, color, n, power) {
    if (reduce) return;
    for (var i = 0; i < n; i++) { var a = Math.random() * 6.283, sp = (0.4 + Math.random()) * (power || 5); FX.parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, life: 1, dec: 0.014 + Math.random() * 0.02, r: 1.5 + Math.random() * 3, c: color }); }
    if (!FX.run) { FX.run = true; requestAnimationFrame(FX.loop); }
  },
  loop: function () {
    var c = $('#fx'), dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(innerWidth * dpr)) { c.width = Math.round(innerWidth * dpr); c.height = Math.round(innerHeight * dpr); }
    var g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, innerWidth, innerHeight); g.globalCompositeOperation = 'lighter';
    FX.parts = FX.parts.filter(function (p) { return p.life > 0; });
    FX.parts.forEach(function (p) { p.x += p.vx; p.y += p.vy; p.vy += 0.09; p.vx *= 0.985; p.life -= p.dec; g.globalAlpha = Math.max(0, p.life); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.r * (0.5 + p.life * 0.5), 0, 6.283); g.fill(); });
    g.globalAlpha = 1;
    if (FX.parts.length) requestAnimationFrame(FX.loop); else { FX.run = false; g.clearRect(0, 0, innerWidth, innerHeight); }
  }
};
function floater(text, x, y, color, big, delay) {
  setTimeout(function () {
    var el = document.createElement('div'); el.className = 'float' + (big ? ' big' : ''); el.textContent = text; el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.color = color;
    document.body.appendChild(el); setTimeout(function () { el.remove(); }, 1350);
  }, delay || 0);
}
function flash(kind) { var f = $('#flash'); f.className = ''; void f.offsetWidth; f.className = kind; }
function toast(html, cls, opt) {
  opt = opt || {};
  var el = document.createElement('div'); el.className = 'toast ' + (cls || ''); el.innerHTML = html;
  if (opt.action) { var b = document.createElement('button'); b.className = 'btn sm'; b.style.marginLeft = '10px'; b.textContent = opt.action.label; b.onclick = function () { opt.action.fn(); kill(); }; el.appendChild(b); }
  function kill() { el.classList.add('out'); setTimeout(function () { el.remove(); }, 320); }
  $('#toasts').appendChild(el); if (!opt.sticky) setTimeout(kill, opt.ms || 6200);
  el.addEventListener('click', function (e) { if (e.target === el) kill(); });
}
function modal(title, text, buttons) {
  var m = $('#modal'), box = $('#modalBox');
  box.innerHTML = '<h3>' + esc(title) + '</h3><p>' + text + '</p><div class="row"></div>';
  buttons.concat([{ label: 'Cancel' }]).forEach(function (b) { var el = document.createElement('button'); el.className = 'btn ' + (b.cls || ''); el.textContent = b.label; el.onclick = function () { m.classList.remove('on'); if (b.fn) b.fn(); }; $('.row', box).appendChild(el); });
  m.classList.add('on');
}
function download(name, text, type) { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
function pickFile(accept) { return new Promise(function (res) { var i = $('#filePick'); i.value = ''; i.accept = accept || ''; i.onchange = function () { res(i.files[0] || null); }; i.click(); }); }

/* ============================== derive + layout ========================== */
function recompute() {
  st.D = E.derive(st.data, st.today);
  st.habits = E.habitMap(st.data); st.routines = {}; st.data.routines.forEach(function (r) { st.routines[r.id] = r; });
  relayout();
}
function relayout() {
  var ghost = {}, td = st.D.byDate[st.today];
  if (td) { var n = 0; st.data.habits.forEach(function (h) { if (h.kind === 'positive' && h.cadence === 'daily' && !h.archived && !td.done[h.id]) n++; }); ghost[st.today] = n; }
  st.L = HX.layout(st.D.days, { slotW: st.v.slotW, dayGap: st.v.dayGap, ghost: ghost });
  clampScroll();
}
function bounds() { var W = st.v.W, w = st.L.width, pl = 80, pr = 170; if (w + pl + pr <= W) { var c = (w - W) / 2; return [c, c]; } return [-pl, w - W + pr]; }
function clampScroll() { var b = bounds(); st.v.scrollX = clamp(st.v.scrollX, b[0], b[1]); if (st.v.target != null) st.v.target = clamp(st.v.target, b[0], b[1]); }
function scrollToDate(date, instant) {
  var day = st.L.byDate[date]; if (!day) return;
  var W = st.v.W, b = bounds(), x = date === st.today ? day.x1 - W + 170 : day.mid - W / 2;
  if (!instant && day.x0 - st.v.scrollX > 90 && day.x1 - st.v.scrollX < W - 120) return;   // already comfortably in view
  x = clamp(x, b[0], b[1]);
  if (instant || reduce) { st.v.scrollX = x; st.v.target = null; } else st.v.target = x;
}
function editable() { return st.sel <= st.today && U.daysBetween(st.sel, st.today) <= S().backfillDays; }
function weekCount(habitId, date) { var ws = U.weekStart(date, S().weekStartsOn), we = U.addDays(ws, 6); return st.data.log.filter(function (e) { return e.habitId === habitId && e.date >= ws && e.date <= we; }).length; }

/* ============================== HUD ====================================== */
var EMBLEM = {
  Strand: '<svg viewBox="0 0 30 30" fill="none" stroke-linecap="round" stroke-width="2.2"><path d="M4 6c9 0 13 18 22 18" stroke="#58efc9"/><path d="M4 24c9 0 13-18 22-18" stroke="#ffbe55"/><path d="M10 10.5v9M15 12.5v5M20 10.5v9" stroke="#e6f3f1" stroke-opacity=".6" stroke-width="1.5"/></svg>',
  Cell: '<svg viewBox="0 0 30 30" fill="none" stroke-width="2"><path d="M15 3c7 0 12 5 12 12s-5 12-12 12S3 22 3 15 8 3 15 3z" stroke="#58efc9"/><circle cx="13" cy="14" r="5" fill="rgba(255,190,85,.35)" stroke="#ffbe55"/><circle cx="21" cy="19" r="1.6" fill="#e6f3f1"/><circle cx="19" cy="9" r="1.2" fill="#e6f3f1"/></svg>',
  Organism: '<svg viewBox="0 0 30 30" fill="none" stroke-width="1.8"><circle cx="15" cy="15" r="4" stroke="#ffbe55" fill="rgba(255,190,85,.3)"/><circle cx="15" cy="6.5" r="3.4" stroke="#58efc9"/><circle cx="22.4" cy="10.8" r="3.4" stroke="#58efc9"/><circle cx="22.4" cy="19.2" r="3.4" stroke="#58efc9"/><circle cx="15" cy="23.5" r="3.4" stroke="#58efc9"/><circle cx="7.6" cy="19.2" r="3.4" stroke="#58efc9"/><circle cx="7.6" cy="10.8" r="3.4" stroke="#58efc9"/></svg>'
};
var SHIELD = '<svg viewBox="0 0 19 21"><path d="M9.5 1.5l7 4v10l-7 4-7-4v-10z" stroke-width="1.5"/></svg>';
function renderHUD() {
  var D = st.D, sg = D.stage;
  $('#samplebar').hidden = !st.data.meta.sample;
  $('#emblem').innerHTML = EMBLEM[sg.cur.phase] || EMBLEM.Strand;
  $('#stageName').textContent = sg.cur.name; $('#stagePhase').textContent = sg.cur.phase + ' phase';
  $('#stageFill').style.width = Math.max(2, sg.progress * 100) + '%';
  $('#toNext').innerHTML = '<b>' + fmt(sg.toNext) + '</b> to ' + esc(sg.next.name) + (sg.next.phase !== sg.cur.phase ? ', the first ' + esc(sg.next.phase.toLowerCase()) + ' stage' : '');
  $('#chainN').textContent = D.chain;
  var sh = ''; for (var i = 0; i < D.shieldsMax; i++) sh += '<span class="' + (i < D.shields ? 'on' : 'off') + '">' + SHIELD + '</span>';
  $('#shields').innerHTML = sh + '<span style="margin-left:4px"><b>' + D.shields + '</b> of ' + D.shieldsMax + ' shields</span>';
  $('#bondedN').textContent = fmt(D.bonded); $('#looseN').textContent = fmt(D.loose);
  var tot = Math.max(1, D.bonded + D.loose); $('#split i').style.width = (D.bonded / tot * 100) + '%'; $('#split u').style.width = (D.loose / tot * 100) + '%';
  countTo(D.points);
  var gw = D.genes.waiting.length, chip = $('#geneChip'); chip.hidden = !gw; chip.textContent = gw === 1 ? '1 gene ready' : gw + ' genes ready';
  var waiting = st.data.media.filter(function (m) { return m.status !== 'imported'; }).length;
  $('#navVault').innerHTML = 'Vault' + (waiting ? '<span class="dot" title="' + waiting + ' waiting for art"></span>' : '');
  syncStatus();
}
var countRaf = null;
function countTo(target) {
  var el = $('#pts'), from = st.shownPts, t0 = performance.now();
  cancelAnimationFrame(countRaf);
  if (reduce || from === target) { st.shownPts = target; el.textContent = fmt(target); return; }
  (function step(now) { var k = clamp((now - t0) / 650, 0, 1), e = 1 - Math.pow(1 - k, 3); st.shownPts = from + (target - from) * e; el.textContent = fmt(st.shownPts); if (k < 1) countRaf = requestAnimationFrame(step); else st.shownPts = target; })(t0);
}
function syncStatus() {
  var b = $('#navData'); if (!b) return;
  var col = null, tip = '';
  if (GH.on()) {
    if (GH.state === 'error') { col = 'var(--lesion)'; tip = 'GitHub save failed'; }
    else if (GH.state === 'conflict') { col = 'var(--lesion)'; tip = 'Choose which version to keep'; }
    else if (GH.state === 'pending' || GH.state === 'saving') { col = 'var(--aqua)'; tip = 'Saving to GitHub'; }
  } else if (st.dirState !== 'linked' || st.writeError) { col = 'var(--amber)'; tip = 'Only saved in this browser'; }
  b.innerHTML = 'Data' + (col ? '<span class="dot" style="background:' + col + ';box-shadow:0 0 8px ' + col + '" title="' + tip + '"></span>' : '');
  if (st.drawer === 'data' && !(document.activeElement && document.activeElement.closest && document.activeElement.closest('#ghForm'))) { var box = $('#ghStatus'); if (box) box.outerHTML = ghStatusHtml(); }
}
function ghStatusHtml() {
  var c = GH.cfg, where = c ? esc(c.owner + '/' + c.repo + '/' + c.path) : '', cls = 'status', msg;
  if (GH.state === 'conflict') { cls += ' bad'; msg = '<b>Another device saved newer data.</b> Choose which version to keep.'; }
  else if (GH.state === 'error') { cls += ' bad'; msg = '<b>Not saved to GitHub:</b> ' + esc(GH.err) + (GH.dirty() ? ' Your changes are kept in this browser until it works.' : ''); }
  else if (GH.state === 'pending' || GH.state === 'saving') { msg = '<b>Saving to ' + where + '.</b> Changes are sent a few seconds after your last tap.'; }
  else { cls += ' ok'; msg = '<b>Saving to ' + where + '.</b> ' + (GH.last ? 'Last saved at ' + GH.last.toLocaleTimeString() + '.' : 'Up to date.'); }
  return '<div class="' + cls + '" id="ghStatus"><i></i><span>' + msg + '</span></div>';
}

/* ============================== deck ===================================== */
function tile(h, day) {
  var D = st.D, C = 213.6, ed = editable();
  if (h.kind === 'negative') {
    return '<button class="atom neg' + (st.negOpen ? ' open' : '') + '" data-habit="' + h.id + '" style="--hue:' + h.hue + '" ' + (ed ? '' : 'disabled') + ' title="' + esc(h.name) + '. Logged only when it happens.">' +
      '<span class="nuc"><b>' + esc(h.sym) + '</b></span><span class="nm">' + esc(h.short) + '</span><span class="sub">log if it happened</span></button>';
  }
  var entry = day ? day.entries.find(function (e) { return e.habitId === h.id; }) : null, done = !!entry;
  var sk = D.streaks[h.id] || { n: 0, days: 0, unit: 'day' }, pay = Math.max(1, Math.round(h.weight * E.thinTier(S(), sk.days).basePct));
  var cls = 'atom', frac = done ? 1 : 0, sub;
  if (h.cadence === 'weekly') {
    var cnt = weekCount(h.id, st.sel), tg = h.weeklyTarget || 1; frac = Math.min(1, cnt / tg);
    var locked = !done && cnt >= tg && !h.beyondTarget;
    if (locked) cls += ' locked done';
    sub = done ? '<i>+' + entry.points + '</i>' + cnt + ' of ' + tg + ' this week' : locked ? 'done this week' : '<i>+' + pay + '</i>' + cnt + ' of ' + tg + ' this week';
  } else {
    sub = done ? '<i>+' + entry.points + '</i>' : '<i>+' + pay + '</i>';
    if (sk.n >= 2) sub += '<span title="Current run">' + sk.n + 'd run</span>';
  }
  if (done) { cls += ' done'; if (entry.bonus) sub += '<span style="color:var(--gold)">+' + entry.bonus.points + ' ' + esc(entry.bonus.name.toLowerCase()) + '</span>'; }
  if (st.undoArm === h.id) { cls += ' arm'; }
  return '<button class="' + cls + '" data-habit="' + h.id + '" style="--hue:' + h.hue + '" aria-pressed="' + done + '" ' + (ed ? '' : 'disabled') + ' title="' + esc(h.name) + '">' +
    '<span class="nuc"><svg viewBox="0 0 76 76"><circle class="tr" cx="38" cy="38" r="34"/><circle class="fi" cx="38" cy="38" r="34" stroke-dasharray="' + C + '" stroke-dashoffset="' + (C * (1 - frac)) + '"/></svg><b>' + esc(h.sym) + '</b></span>' +
    '<span class="nm">' + (st.undoArm === h.id ? 'Tap again to undo' : esc(h.short)) + '</span><span class="sub">' + sub + '</span></button>';
}
function renderDeck() {
  var D = st.D, day = D.byDate[st.sel], ed = editable(), isToday = st.sel === st.today;
  var earned = 0; st.data.ledger.forEach(function (r) { if (r.date === st.sel) earned += r.amount; });
  var h = '<div class="daybar"><button class="step" data-act="prev" aria-label="Previous day">‹</button><h2>' + (isToday ? 'Today, ' + MONN[U.parseISO(st.sel).getMonth()] + ' ' + U.parseISO(st.sel).getDate() : longDate(st.sel)) + '</h2>' +
    '<button class="step" data-act="next" aria-label="Next day" ' + (isToday ? 'disabled' : '') + '>›</button>' +
    '<span class="earn">' + (earned >= 0 ? '+' : '−') + fmt(Math.abs(earned)) + ' this day</span>' +
    (isToday ? '' : '<button class="back" data-act="today">Back to today</button>') +
    (ed ? '' : '<span class="note">View only. Check-ins stay open for ' + S().backfillDays + ' days.</span>') + '</div>';
  ['health', 'spiritual'].forEach(function (cat) {
    var hs = st.data.habits.filter(function (x) { return x.category === cat && !x.archived; });
    if (!hs.length) return;
    var dl = hs.filter(function (x) { return x.kind === 'positive' && x.cadence === 'daily'; }), dn = dl.filter(function (x) { return day && day.done[x.id]; }).length;
    h += '<section class="cluster" data-cat="' + cat + '"><h3>' + (cat === 'health' ? 'Health' : 'Spiritual') + '<span>' + dn + ' of ' + dl.length + ' daily atoms in</span></h3><div class="atoms">';
    hs.filter(function (x) { return x.kind === 'positive' && x.cadence === 'daily'; }).forEach(function (x) { h += tile(x, day); });
    hs.filter(function (x) { return x.kind === 'positive' && x.cadence === 'weekly'; }).forEach(function (x) { h += tile(x, day); });
    hs.filter(function (x) { return x.kind === 'negative'; }).forEach(function (x) { h += tile(x, day); });
    h += '</div>';
    if (st.negOpen && ed) hs.filter(function (x) { return x.kind === 'negative'; }).forEach(function (x) {
      var cb = S().clawback;
      h += '<div class="negpop"><div class="stepper"><button data-act="negMinus" aria-label="Fewer">−</button><output>' + st.negAmt + '<small>' + esc(x.unit || 'unit') + (st.negAmt === 1 ? '' : 's') + '</small></output><button data-act="negPlus" aria-label="More">+</button></div>' +
        '<p><b>Logging it always pays +' + S().points.integrity + '.</b> The drinks cost up to ' + (x.weight * st.negAmt) + ' from loose points (never more than ' + cb.dayCap + ' in a day, ' + cb.weekCap + ' in a week). Bonded points are safe. A recovery action today earns most of it back.</p>' +
        '<button class="btn hot" data-act="negLog" data-h="' + x.id + '">Log it honestly</button><button class="btn" data-act="negCancel">Cancel</button></div>';
    });
    h += '</section>';
  });
  $('#left').innerHTML = h;
}

/* ============================== side panel =============================== */
function moleculeSvg(day) {
  var ids = [], seen = {};
  st.data.routines.forEach(function (r) { r.habits.forEach(function (id) { var hb = st.habits[id]; if (hb && !seen[id] && hb.cadence === 'daily' && hb.kind === 'positive' && !hb.archived) { seen[id] = 1; ids.push(id); } }); });
  st.data.habits.forEach(function (hb) { if (!seen[hb.id] && hb.cadence === 'daily' && hb.kind === 'positive' && !hb.archived) ids.push(hb.id); });
  var n = ids.length, R = 54, cx = 75, cy = 75, pos = ids.map(function (id, i) { var a = Math.PI * 2 * i / n - Math.PI / 2 + Math.PI / n; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; });
  var done = function (id) { return day && day.done[id]; }, s = '<svg viewBox="0 0 150 150" role="img" aria-label="Today\'s molecule">';
  for (var i = 0; i < n; i++) {
    var j = (i + 1) % n, a = ids[i], b = ids[j], on = done(a) && done(b);
    var dbl = on && st.data.routines.some(function (r) { return r.habits.indexOf(a) >= 0 && r.habits.indexOf(b) >= 0 && day.bonds.indexOf(r.id) >= 0; });
    var ln = 'x1="' + pos[i][0].toFixed(1) + '" y1="' + pos[i][1].toFixed(1) + '" x2="' + pos[j][0].toFixed(1) + '" y2="' + pos[j][1].toFixed(1) + '"';
    s += dbl ? '<line class="e dbl" ' + ln + '/><line class="e dbl2" ' + ln + '/>' : '<line class="e' + (on ? ' on' : '') + '" ' + ln + '/>';
  }
  ids.forEach(function (id, i) {
    var hb = st.habits[id], d = done(id), col = 'hsl(' + hb.hue + ' 88% 68%)';
    s += '<circle cx="' + pos[i][0].toFixed(1) + '" cy="' + pos[i][1].toFixed(1) + '" r="13" stroke="' + col + '" ' + (d ? 'style="fill:' + col + '"' : 'stroke-opacity=".45"') + '/><text x="' + pos[i][0].toFixed(1) + '" y="' + (pos[i][1] + 0.5).toFixed(1) + '" fill="' + (d ? '#04202a' : col) + '"' + (d ? '' : ' fill-opacity=".7"') + '>' + esc(hb.sym) + '</text>';
  });
  var dn = ids.filter(done).length, stable = day && day.stable;
  s += '<text class="ctr" x="75" y="' + (stable ? 75 : 71) + '"' + (stable ? ' style="fill:var(--gold);font-size:15px"' : '') + '>' + (stable ? 'Stable' : dn + ' / ' + n) + '</text>' + (stable ? '' : '<text class="ctr2" x="75" y="89">atoms in</text>') + '</svg>';
  return { svg: s, done: dn, n: n, stable: stable };
}
function renderSide() {
  var D = st.D, day = D.byDate[st.sel], h = '', isToday = st.sel === st.today;
  /* a stable week earned a gene: choose one of the three on offer */
  if (D.genes.waiting.length) {
    var gEnd = D.genes.waiting[0], gStart = U.addDays(gEnd, -6), more = D.genes.waiting.length - 1;
    if (!D.genes.offers.some(function (t) { return t.id === st.genePick; })) st.genePick = null;
    h += '<div class="card gene" id="geneCard"><h3>Express a gene<span>' + (more ? more + ' more after this' : 'one choice') + '</span></h3><p>The week of ' + shortDate(gStart).slice(4) + ' to ' + shortDate(gEnd).slice(4) + ' closed stable. Choose one. It is permanent and works from today on.</p><div class="gopts">' +
      D.genes.offers.map(function (t) { var lv = D.fx.levels[t.id] || 0; return '<button class="gopt" data-act="geneSel" data-t="' + esc(t.id) + '" aria-pressed="' + (st.genePick === t.id) + '"><b>' + esc(t.name) + '</b><span>' + esc(t.text) + '</span>' + pips(lv, t.max, true) + '</button>'; }).join('') +
      '</div><button class="btn gold sm" data-act="geneGo" ' + (st.genePick ? '' : 'disabled') + '>Express this gene</button></div>';
  }
  /* repair bay: any negative entry on the selected day */
  (day ? day.entries : []).filter(function (e) { return e.kind === 'negative'; }).forEach(function (e) {
    var hb = st.habits[e.habitId] || { short: e.habitId }, cb = e.clawback || { taken: 0 }, what = esc(hb.short) + ', ' + plural(e.amount, e.unit || 'unit');
    if (e.repair) {
      h += '<div class="card repair fixed"><h3>Repaired pair<span>' + what + '</span></h3><p>' + esc(e.repair.label) + '. <b>+' + e.repair.reearned + '</b> of the ' + cb.taken + ' clawed points came back, and the seam stays on your strand as a repair.</p></div>';
    } else if (e.loggedOn === st.today) {
      var pick = st.repairPick[e.id], re = Math.round(cb.taken * D.fx.repairRate);
      h += '<div class="card repair" id="repairBay"><h3>Repair bay<span>' + what + '</span></h3><p><b>−' + cb.taken + '</b> clawed from loose points. Repair it today and <b>+' + re + '</b> comes straight back.</p><ol>' +
        '<li class="ok"><div><b>Recognize</b>Done. You logged it, which is how a cell finds the lesion.</div></li>' +
        '<li class="' + (pick ? 'ok' : '') + '"><div><b>Excise and fill</b>Do one recovery action now.<div class="chips">' +
        S().repair.actions.map(function (a) { return '<button data-act="pickRepair" data-log="' + e.id + '" data-a="' + esc(a.id) + '" aria-pressed="' + (pick === a.id) + '">' + esc(a.label) + '</button>'; }).join('') + '</div></div></li>' +
        '<li><div><b>Ligate</b>Seal the backbone. The pair is marked repaired.<div class="chips"><button class="btn gold sm" data-act="seal" data-log="' + e.id + '" ' + (pick ? '' : 'disabled') + '>I did it. Seal the repair</button></div></div></li></ol></div>';
    } else {
      h += '<div class="card repair"><h3>Damaged pair<span>' + what + '</span></h3><p><b>−' + cb.taken + '</b> clawed. The repair window closed at the end of the day it was logged, so this pair stays damaged. Nothing else is lost.</p></div>';
    }
  });
  var m = moleculeSvg(day), left = m.n - m.done;
  h += '<div class="card"><h3>' + (isToday ? 'Today\'s molecule' : 'That day\'s molecule') + '<span>' + (m.stable ? '+' + D.fx.molecule + ' earned' : left + ' to stable, +' + D.fx.molecule) + '</span></h3><div class="mol' + (m.stable ? ' stable' : '') + '" id="molBox">' + m.svg + '<div class="rts">' +
    st.data.routines.map(function (r) { var c = r.habits.filter(function (id) { return day && day.done[id]; }).length, ok = c === r.habits.length; return '<div class="' + (ok ? 'ok' : '') + '"><b>' + esc(r.name) + '</b>' + (ok ? 'Bonded, +' + D.fx.bond : c + ' of ' + r.habits.length + ' in') + '</div>'; }).join('') + '</div></div></div>';

  /* week */
  var ws = U.weekStart(st.sel, S().weekStartsOn), wk = D.weeks.find(function (w) { return w.start === ws; }) || { solid: 0, closed: false, stable: false, end: U.addDays(ws, 6) };
  var need = S().stableWeek.minSolidDays, cells = '';
  for (var i = 0; i < 7; i++) {
    var dt = U.addDays(ws, i), dd = D.byDate[dt], c = '';
    if (dd) c = dd.stable ? 'stb' : dd.solid ? 'sol' : dd.state === 'active' ? 'act' : dd.state === 'shielded' ? 'shd' : dd.state === 'gap' ? 'gap' : '';
    cells += '<div class="' + c + (dt === st.sel ? ' now' : '') + '" title="' + shortDate(dt) + '"><i></i>' + DAYN[U.parseISO(dt).getDay()].slice(0, 2) + '</div>';
  }
  var looseWk = 0; st.data.ledger.forEach(function (r) { if (r.amount > 0 && !(D.bondedThrough && r.date <= D.bondedThrough)) looseWk += r.remaining; });
  var msg;
  if (wk.closed) msg = wk.stable ? 'This week closed stable. Its gains are <b>bonded for good</b>, and it earned a shield and a gene.' : 'This week closed with <b>' + wk.solid + ' of ' + need + '</b> solid days, so its gains stayed loose and carried forward.';
  else if (wk.solid >= need) msg = '<b>' + wk.solid + ' solid days.</b> When this week closes, <b>' + fmt(looseWk) + ' loose points</b> bond for good and you earn a shield and a gene.';
  else msg = '<b>' + wk.solid + ' of ' + need + '</b> solid days (' + S().stableWeek.solidDayMinCheckins + '+ check-ins each). ' + (need - wk.solid) + ' more and this week bonds <b>' + fmt(looseWk) + ' loose points</b> and earns a shield and a gene.';
  h += '<div class="card"><h3>This week<span>' + shortDate(ws).slice(4) + ' to ' + shortDate(wk.end).slice(4) + '</span></h3><div class="week">' + cells + '</div><p>' + msg + '</p></div>';
  /* genome: what has been expressed so far */
  var ex = S().traits.filter(function (t) { return D.fx.levels[t.id]; });
  h += '<div class="card"><h3>Genome<span>' + (D.genes.expressed ? plural(D.genes.expressed, 'gene') + ' expressed' : 'nothing expressed yet') + '</span></h3>' +
    (ex.length ? '<div class="genome">' + ex.map(function (t) { return '<div><b>' + esc(t.name) + '</b>' + pips(D.fx.levels[t.id], t.max) + '<span>' + esc(t.text) + (D.fx.levels[t.id] > 1 ? ', ' + D.fx.levels[t.id] + ' times over' : '') + '</span></div>'; }).join('') + '</div>'
      : '<p>Every week that closes stable lets you express one gene: a permanent change to how your strand pays, protects or repairs.</p>') + '</div>';
  $('#side').innerHTML = h;
}
function pips(n, max, next) { var o = '<i class="pips">'; for (var i = 0; i < max; i++) o += '<u class="' + (i < n ? 'on' : next && i === n ? 'nx' : '') + '"></u>'; return o + '</i>'; }

/* ============================== actions ================================== */
var armTimer = null;
function tapHabit(id, el) {
  Sfx.init();
  var h = st.habits[id]; if (!h || !editable()) return;
  if (h.kind === 'negative') { st.negOpen = !st.negOpen; st.negAmt = 1; renderDeck(); return; }
  var entry = st.data.log.find(function (e) { return e.habitId === id && e.date === st.sel; });
  if (entry) {
    if (st.undoArm === id) {
      clearTimeout(armTimer); st.undoArm = null;
      var r = E.removeEntry(st.data, entry.id, st.today);
      if (r.error) { toast(esc(r.error), 'bad'); renderDeck(); return; }
      Sfx.undo(); recompute(); renderAll(); Store.save();
    } else { st.undoArm = id; renderDeck(); clearTimeout(armTimer); armTimer = setTimeout(function () { st.undoArm = null; renderDeck(); }, 2600); }
    return;
  }
  if (el.classList.contains('locked')) return;
  var rect = $('.nuc', el).getBoundingClientRect();
  var res = E.checkIn(st.data, id, st.sel, { today: st.today });
  if (res.error) { toast(esc(res.error), 'bad'); return; }
  celebrate(res, rect);
}
function fly(x, y, entry, hue) {
  var cv = $('#helix').getBoundingClientRect(), sx = st.v.target != null ? st.v.target : st.v.scrollX;
  var p = HX.slotScreen(st.L, Object.assign({}, st.v, { scrollX: sx }), entry.id); if (!p) return;
  var tx = cv.left + p.x, ty = cv.top + p.y;
  st.v.ripples.push({ x: p.wx, t0: clock() + 0.3, power: 7 });
  if (reduce) return;
  var el = document.createElement('div'); el.className = 'fly'; el.style.setProperty('--c', 'hsl(' + hue + ' 88% 68%)'); el.style.left = '0'; el.style.top = '0';
  document.body.appendChild(el);
  var mx = (x + tx) / 2, my = Math.min(y, ty) - 70;
  el.animate([{ transform: 'translate(' + x + 'px,' + y + 'px) scale(1.5)' }, { transform: 'translate(' + mx + 'px,' + my + 'px) scale(1.1)', offset: 0.55 }, { transform: 'translate(' + tx + 'px,' + ty + 'px) scale(.5)' }], { duration: 330, easing: 'cubic-bezier(.4,0,.6,1)' }).onfinish = function () { el.remove(); FX.burst(tx, ty, 'hsl(' + hue + ' 88% 70%)', 9, 2.6); };
}
function celebrate(res, rect) {
  var entry = res.entry, now = clock(), cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  recompute();
  if (entry) st.v.anims[entry.id] = now + (entry.kind === 'positive' ? 0.28 : 0);
  scrollToDate(st.sel);
  renderAll(); Store.save();
  var day = st.D.byDate[st.sel], nDone = day ? day.pos : 1, molBox = $('#molBox'), mr = molBox ? molBox.getBoundingClientRect() : rect;
  var mxm = mr.left + 75, mym = mr.top + mr.height / 2;
  res.events.forEach(function (e) {
    if (e.type === 'checkin') {
      Sfx.check(nDone - 1); floater('+' + e.points, cx, cy - 34, 'hsl(' + e.habit.hue + ' 90% 74%)', true);
      fly(cx, cy, entry, e.habit.hue);
      var t = $('.atom[data-habit="' + e.habit.id + '"]'); if (t) t.classList.add('pop');
    } else if (e.type === 'bonus') {
      setTimeout(function () { Sfx.bonus(e.bonus.type); FX.burst(cx, cy, '#ffe9a6', e.bonus.type === 'rare' ? 70 : e.bonus.type === 'chest' ? 42 : 24, e.bonus.type === 'rare' ? 9 : 6); if (e.bonus.type !== 'crit') flash('gold'); }, 170);
      floater(e.bonus.name + ' +' + e.bonus.points, cx, cy - 72, '#ffe9a6', true, 170);
    } else if (e.type === 'bond') {
      setTimeout(function () { Sfx.bond(); }, 400); floater(e.routine.name + ' bonded +' + e.points, mr.left + mr.width / 2, mr.top - 26, '#e6f3f1', false, 400);
    } else if (e.type === 'molecule') {
      setTimeout(function () { Sfx.molecule(); flash('gold'); FX.burst(mxm, mym, '#ffe9a6', 60, 7); }, 580); floater('Stable molecule +' + e.points, mr.left + mr.width / 2, mr.top - 58, '#ffe9a6', true, 580);
    } else if (e.type === 'weeklyTarget') {
      floater('Weekly target met', cx, cy + 58, '#e6f3f1', false, 300);
    } else if (e.type === 'negative') {
      Sfx.damage(); flash('red');
      var sl = st.L.byLog[entry.id]; if (sl) st.v.ripples.push({ x: sl.x, t0: now, power: 12 });
    } else if (e.type === 'integrity') {
      floater('+' + e.points + ' honest log', cx, cy - 34, '#58efc9', true, 120);
    } else if (e.type === 'clawback') {
      floater(e.taken ? '−' + e.taken + ' clawed from loose points' : 'Nothing loose to claw back', cx, cy + 4, '#ff7d9c', false, 700);
      if (e.allowed < e.requested) setTimeout(function () { toast('The cap held: this entry asked for ' + e.requested + ', the limit let through ' + e.allowed + '.', ''); }, 900);
    } else if (e.type === 'repair') {
      Sfx.repair(); flash('gold'); FX.burst(cx, cy, '#ffe9a6', 40, 6);
      floater('+' + e.points + ' re-earned. Pair repaired', cx, cy - 40, '#ffe9a6', true);
      var s2 = st.L.byLog[entry.id]; if (s2) st.v.ripples.push({ x: s2.x, t0: now, power: 9 });
    } else if (e.type === 'stage') {
      setTimeout(function () { stageCinematic(e.milestone); }, 950);
    } else if (e.type === 'compound') {
      setTimeout(function () { Sfx.bonus('chest'); toast('<b>Compound completed: ' + esc(e.milestone.name) + '.</b> ' + esc(e.milestone.note || '') + '. A card slot opened in the vault.', 'gold', { action: { label: 'Open the vault', fn: function () { openDrawer('vault'); } } }); }, 1150);
    }
  });
}
function renderAll() { renderHUD(); renderDeck(); renderSide(); if (st.drawer) renderDrawer(); }
function refreshAll() { recompute(); renderAll(); }
function selectDate(d) { if (d > st.today) return; st.sel = d; st.negOpen = false; st.undoArm = null; scrollToDate(d); renderDeck(); renderSide(); }

function act(a, el) {
  Sfx.init();
  if (a === 'prev') selectDate(U.addDays(st.sel, -1));
  else if (a === 'next') selectDate(U.addDays(st.sel, 1));
  else if (a === 'today') selectDate(st.today);
  else if (a === 'negMinus') { st.negAmt = Math.max(1, st.negAmt - 1); renderDeck(); }
  else if (a === 'negPlus') { st.negAmt = Math.min(20, st.negAmt + 1); renderDeck(); }
  else if (a === 'negCancel') { st.negOpen = false; renderDeck(); }
  else if (a === 'negLog') {
    var t = $('.atom.neg .nuc'), rect = t ? t.getBoundingClientRect() : el.getBoundingClientRect();
    var res = E.checkIn(st.data, el.dataset.h, st.sel, { today: st.today, amount: st.negAmt });
    st.negOpen = false; if (res.error) { toast(esc(res.error), 'bad'); return; }
    celebrate(res, rect);
    setTimeout(function () { var b = $('#repairBay'); if (b) b.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }); }, 300);
  }
  else if (a === 'geneSel') { st.genePick = el.dataset.t; renderSide(); }
  else if (a === 'geneGo') {
    var gr = el.getBoundingClientRect(), g = E.pickTrait(st.data, st.D.genes.waiting[0], st.genePick, { today: st.today });
    if (g.error) { toast(esc(g.error), 'bad'); return; }
    st.genePick = null; Sfx.gene(); flash('gold'); FX.burst(gr.left + gr.width / 2, gr.top, '#ffe9a6', 70, 8); FX.burst(gr.left + gr.width / 2, gr.top, '#58efc9', 40, 6);
    recompute(); renderAll(); Store.save(); $('#side').scrollTop = 0;
    toast('<b>' + esc(g.trait.name) + ' expressed' + (g.level > 1 ? ', level ' + g.level : '') + '.</b> ' + esc(g.trait.text) + ', from today.', 'gold', { ms: 8000 });
  }
  else if (a === 'pickRepair') { st.repairPick[el.dataset.log] = el.dataset.a; renderSide(); }
  else if (a === 'seal') {
    var r2 = el.getBoundingClientRect(), rs = E.repair(st.data, el.dataset.log, st.repairPick[el.dataset.log], { today: st.today });
    if (rs.error) { toast(esc(rs.error), 'bad'); return; }
    celebrate(rs, r2); $('#side').scrollTop = 0;
  }
}

/* ============================== cinematic + player ======================= */
var cineTimer = null;
function closeCine() { var c = $('#cine'); clearTimeout(cineTimer); c.classList.remove('on', 'lite'); c.innerHTML = ''; }
/* Small stages celebrate without stopping the check-in flow; phase changes and film stages take the whole screen. */
function stageCinematic(m, full) {
  Sfx.init(); Sfx.stage();
  var c = $('#cine'), slot = st.data.media.find(function (x) { return x.id === m.id; }), lite = !full && !m.media && !m.phaseChange;
  closeCine();
  var body = m.media ? 'This stage earns a film: your strand exactly as it stood on ' + shortDate(m.reachedOn) + ', gaps and repairs included. Its slot is open in the vault.' : 'Your strand keeps growing. The next stage is already in sight.';
  c.innerHTML = '<canvas></canvas><div class="inner"><div class="ph">' + (m.phaseChange ? 'Phase change. The ' + esc(m.phase.toLowerCase()) + ' phase begins' : esc(m.phase) + ' phase, new stage') + '</div><h1>' + esc(m.name) + '</h1><p>' + body + '</p>' + (lite ? '' : '<div class="row"><button class="btn go" data-c="close">Keep going</button>' + (m.media ? '<button class="btn" data-c="vault">Open the vault</button>' : '') + '<span id="cineFilm"></span></div>') + '</div>';
  c.classList.add('on'); if (lite) { c.classList.add('lite'); cineTimer = setTimeout(closeCine, 2700); }
  var cv = $('canvas', c), g = cv.getContext('2d'), t0 = performance.now(), rays = [];
  for (var i = 0; i < 90; i++) rays.push({ a: Math.random() * 6.283, s: 0.3 + Math.random(), l: 40 + Math.random() * 220, h: Math.random() < 0.5 ? 165 : 42 });
  (function loop(now) {
    if (!c.classList.contains('on') || !cv.isConnected) return;
    var w = cv.width = innerWidth, hh = cv.height = innerHeight, t = (now - t0) / 1000; g.clearRect(0, 0, w, hh); g.globalCompositeOperation = 'lighter';
    rays.forEach(function (r) { var d = ((t * r.s * 260) % (Math.max(w, hh) * 0.75)), x = w / 2 + Math.cos(r.a) * d, y = hh * 0.45 + Math.sin(r.a) * d; g.strokeStyle = 'hsla(' + r.h + ',90%,70%,' + Math.max(0, 0.34 * Math.min(1, d / 160) * (1 - d / (Math.max(w, hh) * 0.75))) + ')'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(r.a) * r.l * 0.3, y + Math.sin(r.a) * r.l * 0.3); g.stroke(); });
    if (!reduce) requestAnimationFrame(loop);
  })(t0);
  c.onclick = function (ev) { var b = ev.target.closest('[data-c]'); if (!b) return; var k = b.dataset.c; closeCine(); if (k === 'vault') openDrawer('vault'); if (k === 'film') openPlayer(m.id); };
  if (slot) Media.resolve(slot).then(function (f) { var sp = $('#cineFilm'); if (f && sp) sp.innerHTML = '<button class="btn gold" data-c="film">Play the film</button>'; });
}
function openPlayer(id) {
  var slot = st.data.media.find(function (x) { return x.id === id; }); if (!slot) return;
  Media.resolve(slot).then(function (f) {
    if (!f) { toast('No file in that slot yet.', 'bad'); return; }
    var c = $('#cine');
    c.innerHTML = '<button class="btn close" data-c="close">Close</button>' + (slot.kind === 'video' ? '<video src="' + esc(f.url) + '" controls autoplay playsinline></video>' : '<img class="full" src="' + esc(f.url) + '" alt="">');
    c.classList.add('on'); c.onclick = function (ev) { if (ev.target === c || ev.target.closest('[data-c]')) closeCine(); };
  });
}

/* ============================== drawer =================================== */
function openDrawer(name) { st.drawer = name; renderDrawer(); $('#drawer').classList.add('on'); $('#scrim').classList.add('on'); $('#drawer').setAttribute('aria-hidden', 'false'); if (name === 'vault') Media.scan(); }
function closeDrawer() { st.drawer = null; $('#drawer').classList.remove('on'); $('#scrim').classList.remove('on'); $('#drawer').setAttribute('aria-hidden', 'true'); }
function renderDrawer() {
  var t = { vault: ['Vault', vaultHtml], ledger: ['Ledger', ledgerHtml], settings: ['Settings', settingsHtml], data: ['Data', dataHtml] }[st.drawer];
  if (!t) return; var body = $('#drawerBody'), sc = body.scrollTop;
  $('#drawerTitle').textContent = t[0]; body.innerHTML = t[1](); body.scrollTop = sc;
}
function slotHtml(id, o) {
  var slot = st.data.media.find(function (m) { return m.id === id; }), ms = st.data.milestones.find(function (m) { return m.id === id; });
  var kindCls = o.kind === 'image' ? ' card-kind' : '';
  if (!slot) return '<div class="slot locked' + kindCls + '"><div class="art">Locked</div><div class="meta"><b>' + esc(o.name) + '</b><span>' + esc(o.req) + '</span></div></div>';
  var f = st.mediaCache[id], ok = slot.status === 'imported' && f, art, acts;
  if (ok) {
    art = (o.kind === 'video' ? '<video src="' + esc(f.url) + '#t=15" muted preload="metadata"></video>' : '<img src="' + esc(f.url) + '" alt="">') + '<button class="play" data-act="mplay" data-id="' + id + '" aria-label="Open">' + (o.kind === 'video' ? '<span>▶</span>' : '') + '</button>';
    acts = '<button class="btn sm go" data-act="mplay" data-id="' + id + '">' + (o.kind === 'video' ? 'Play' : 'View') + '</button>' + (ms && ms.kind === 'stage' ? '<button class="btn sm" data-act="mreplay" data-id="' + id + '">Replay the stage change</button>' : '') + '<button class="btn sm" data-act="mimport" data-id="' + id + '">Replace file</button>';
  } else {
    art = slot.status === 'missing' ? 'File not found. It was at ' + esc(slot.file || '') : 'Unlocked. Waiting for its ' + (o.kind === 'video' ? 'film' : 'card');
    acts = '<button class="btn sm gold" data-act="mreq" data-id="' + id + '">Copy media request</button><button class="btn sm" data-act="mreqsave" data-id="' + id + '">Save request</button><button class="btn sm" data-act="mimport" data-id="' + id + '">Import file</button>';
  }
  return '<div class="slot ' + (ok ? 'has' : 'awaiting') + kindCls + '"><div class="art">' + art + '</div><div class="meta"><b>' + esc(o.name) + '</b><span>' + esc(o.sub) + (ms ? '. Earned ' + shortDate(ms.reachedOn) : '') + '</span><span><code>' + MEDIA_DIR + '/' + id + (o.kind === 'video' ? '.mp4' : '.png') + '</code></span><div class="acts">' + acts + '</div></div></div>';
}
function vaultHtml() {
  var D = st.D, h = '<p>Films and cards are the rarest reward in Strand. They only come from big stage changes and completed compounds, never from an ordinary day. Each one is made from your strand as it stood at that moment.</p>';
  h += '<h3>Stage films</h3><div class="slots">';
  D.stage.list.filter(function (s) { return s.media; }).forEach(function (s) { h += slotHtml('stage-' + s.id, { name: s.name, sub: s.phase + ' phase', kind: 'video', req: 'Reach ' + s.name + ' at ' + fmt(s.at) + ' points' }); });
  h += '</div><h3>Compound cards</h3><div class="slots">';
  S().compounds.forEach(function (c) { h += slotHtml('compound-' + c.id, { name: c.name, sub: c.formula, kind: 'image', req: c.note }); });
  h += '</div><h3>How art gets into a slot</h3><ul><li>When a slot unlocks, press <b>Copy media request</b> and give that text to Claude. It describes your strand at that moment: every day, gap, shield, damaged pair and repair.</li><li>Save the file Claude returns into the <code>' + MEDIA_DIR + '</code> folder beside this page, using the file name shown on the slot. Or press <b>Import file</b> and pick it.</li><li>The slot finds it on the next visit. A file for a milestone you have not earned is ignored.</li></ul>';
  return h;
}
var SRC = { checkin: 'Check-in', bonus: 'Bonus', bond: 'Routine bond', molecule: 'Stable molecule', integrity: 'Honest log', clawback: 'Clawback', repair: 'Repair re-earn' };
function ledgerHtml() {
  var D = st.D, bt = D.bondedThrough, rows = st.data.ledger.slice().reverse();
  var h = '<p><b>' + fmt(D.points) + '</b> points: <b>' + fmt(D.bonded) + '</b> bonded for good' + (bt ? ' (through ' + shortDate(bt) + ')' : '') + ' and <b>' + fmt(D.loose) + '</b> still loose. Clawed back so far: ' + fmt(D.clawedTotal) + ', of which ' + fmt(D.reearned) + ' re-earned by repair. Every movement is listed here and in the data file.</p>';
  h += '<table><thead><tr><th>Day</th><th>What</th><th>Habit</th><th class="n">Points</th><th>State</th></tr></thead><tbody>';
  rows.slice(0, 500).forEach(function (r) {
    var hb = st.habits[r.habitId], state;
    if (r.amount < 0) state = '<span class="tag c">taken from loose</span>';
    else if (bt && r.date <= bt) state = '<span class="tag b">bonded</span>' + (r.remaining < r.amount ? ' <span class="tag c">' + (r.amount - r.remaining) + ' clawed earlier</span>' : '');
    else if (r.protected) state = '<span class="tag">protected</span>';
    else state = '<span class="tag">loose</span>' + (r.remaining < r.amount ? ' <span class="tag c">' + (r.amount - r.remaining) + ' clawed</span>' : '');
    h += '<tr><td>' + shortDate(r.date) + '</td><td>' + (SRC[r.source] || esc(r.source)) + (r.note ? ' <span style="color:var(--faint)">' + esc(r.note) + '</span>' : '') + '</td><td>' + (hb ? esc(hb.short) : '') + '</td><td class="n ' + (r.amount < 0 ? 'negv' : 'pos') + '">' + (r.amount < 0 ? '−' : '+') + Math.abs(r.amount) + '</td><td>' + state + '</td></tr>';
  });
  h += '</tbody></table>' + (rows.length > 500 ? '<p>Showing the latest 500 of ' + rows.length + '. The data file has them all.</p>' : '');
  return h;
}
var NUMS = [
  ['points.integrity', 'Honest-log reward', 'Paid every time a negative is logged'],
  ['points.bond', 'Routine bond', 'All habits of a routine in one day'],
  ['points.stableMolecule', 'Stable molecule', 'Every daily habit in every category'],
  ['clawback.dayCap', 'Clawback cap, one day', ''], ['clawback.weekCap', 'Clawback cap, any 7 days', ''],
  ['repair.rate', 'Repair re-earn rate', '0.6 means 60% comes back'],
  ['shields.starting', 'Shields to start with', ''], ['shields.max', 'Most shields you can hold', ''],
  ['stableWeek.solidDayMinCheckins', 'Check-ins that make a solid day', ''], ['stableWeek.minSolidDays', 'Solid days that make a stable week', 'A stable week bonds gains and earns a shield'],
  ['activeDay.minCheckins', 'Check-ins that keep the chain', 'Fewer than this is a missed day'],
  ['stableDay.fractionPerCategory', 'Share of daily habits for a stable molecule', '1 means all of them'],
  ['traitOfferCount', 'Genes offered at each pick', ''], ['bonusChanceCap', 'Highest bonus odds any habit can reach', '0.6 means 60%'],
  ['backfillDays', 'Days you can go back to check in', ''], ['stageOverflowStep', 'Points per generation after the last stage', '']
];
function getPath(o, p) { return p.split('.').reduce(function (a, k) { return a[k]; }, o); }
function setPath(o, p, v) { var ks = p.split('.'), last = ks.pop(); ks.reduce(function (a, k) { return a[k]; }, o)[last] = v; }
function settingsHtml() {
  var s = S(), h = '<p>Every number in the game is here. Changes save at once. Point values apply from the next check-in; streak, shield and week rules re-read the whole log.</p>';
  h += '<h3>Habits and their weight</h3><p>Points paid at full value. For alcohol, the number is the cost per drink.</p><table class="hw"><thead><tr><th></th><th>Habit</th><th class="n">Points</th><th class="n">Per week</th><th>Archived</th></tr></thead><tbody>';
  st.data.habits.forEach(function (hb) {
    h += '<tr><td class="sym" style="color:hsl(' + hb.hue + ' 88% 68%)">' + esc(hb.sym) + '</td><td>' + esc(hb.name) + '</td><td class="n"><input type="number" min="0" max="500" data-hw="' + hb.id + '" value="' + hb.weight + '"></td><td class="n">' + (hb.cadence === 'weekly' ? '<input type="number" min="1" max="7" data-ht="' + hb.id + '" value="' + (hb.weeklyTarget || 1) + '">' : '') + '</td><td><input type="checkbox" data-ha="' + hb.id + '" ' + (hb.archived ? 'checked' : '') + ' aria-label="Archive ' + esc(hb.short) + '"></td></tr>';
  });
  h += '</tbody></table><p>Archiving hides a habit from the deck. Its history stays on the strand.</p><h3>Rules</h3><div class="grid2">';
  NUMS.forEach(function (n) { h += '<label>' + n[1] + (n[2] ? '<small>' + n[2] + '</small>' : '') + '</label><input type="number" step="any" data-num="' + n[0] + '" value="' + getPath(s, n[0]) + '">'; });
  h += '</div><h3>Schedules and lists</h3><p>Routines, the thinning schedule, bonus odds, genes, stages, compounds and recovery actions. Edit the JSON and apply.</p>';
  var adv = { routines: st.data.routines, thinning: s.thinning, bonuses: s.bonuses, traits: s.traits, repairActions: s.repair.actions, stages: s.stages, compounds: s.compounds };
  h += '<textarea id="advJson" spellcheck="false" style="min-height:260px">' + esc(JSON.stringify(adv, null, 1)) + '</textarea><div class="row"><button class="btn go" data-act="advApply">Apply</button><button class="btn" data-act="resetSettings">Reset every number to its starting value</button></div>';
  return h;
}
function ghHtml() {
  var h = '<h3>Sync to GitHub</h3>';
  if (GH.on() && !GH.edit) {
    var c = GH.cfg, hist = 'https://github.com/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(c.repo) + '/commits/' + (c.branch ? encodeURIComponent(c.branch) : 'HEAD') + '/' + c.path.split('/').map(encodeURIComponent).join('/');
    h += ghStatusHtml() + '<div class="row"><button class="btn go" data-act="ghSave">Save now</button>' + (GH.state === 'conflict' ? '<button class="btn" data-act="ghResolve">Choose a version</button>' : '') +
      '<a class="btn" href="' + hist + '" target="_blank" rel="noopener">See save history</a><button class="btn" data-act="ghEdit">Change repo or token</button><button class="btn" data-act="ghOff">Disconnect</button></div>' +
      '<p>Every save is a commit in that repo, so any earlier version can be restored from its history. The token is kept in this browser only. Each device you use Strand on needs it pasted once.</p>';
    return h;
  }
  var c0 = GH.cfg || {}, host = location.hostname.match(/^([^.]+)\.github\.io$/), owner = c0.owner || (host ? host[1] : '');
  h += '<p>Save your data to a private GitHub repo, so it follows you to every device and keeps a history of every save. One-time setup:</p><ol class="steps">' +
    '<li>On GitHub, create a new repository named <b>strand-data</b> and set it to <b>Private</b>.</li>' +
    '<li>Create a token: <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">new fine-grained token</a>. Under <b>Repository access</b>, choose <b>Only select repositories</b> and pick strand-data. Under <b>Permissions</b>, set <b>Contents</b> to <b>Read and write</b>. Pick an expiration and generate it.</li>' +
    '<li>Paste it below and connect. It stays in this browser only. It is never written into the page or the data file.</li></ol>' +
    '<form id="ghForm" class="grid2 ghf" autocomplete="off" onsubmit="return false">' +
    '<label for="ghOwner">GitHub username</label><input id="ghOwner" value="' + esc(owner) + '" spellcheck="false">' +
    '<label for="ghRepo">Repository</label><input id="ghRepo" value="' + esc(c0.repo || 'strand-data') + '" spellcheck="false">' +
    '<label for="ghPath">File name</label><input id="ghPath" value="' + esc(c0.path || DATA_FILE) + '" spellcheck="false">' +
    '<label for="ghBranch">Branch<small>Leave empty for the default</small></label><input id="ghBranch" value="' + esc(c0.branch || '') + '" spellcheck="false">' +
    '<label for="ghToken">Token</label><input id="ghToken" type="password" placeholder="github_pat_..." spellcheck="false"></form>' +
    '<div class="row"><button class="btn go" data-act="ghConnect">Connect</button>' + (GH.on() ? '<button class="btn" data-act="ghCancel">Cancel</button>' : '') + '</div>' + (GH.err && !GH.on() ? '<div class="status bad"><i></i><span>' + esc(GH.err) + '</span></div>' : '');
  return h;
}
function dataHtml() {
  var h = ghHtml(), cls = 'status', msg, btn = '';
  if (!Store.canLink) { if (GH.on()) cls += ' ok'; msg = GH.on() ? '<b>Not needed here.</b> This browser cannot link a folder, but GitHub sync above already saves everything.' : '<b>This browser cannot link a folder</b> (Safari and phones cannot). Use <b>Sync to GitHub</b> above instead. It works in every browser, iPhone included.'; }
  else if (st.dirState === 'none' && GH.on()) { cls += ' ok'; msg = '<b>Optional.</b> GitHub sync already saves everything. Link a folder too if you want a copy on this computer.'; btn = '<button class="btn" data-act="link">Link my Strand folder</button>'; }
  else if (st.dirState === 'none') { msg = '<b>Not linked to a data file yet.</b> Everything is saved in this browser only. Link the folder where Strand lives and it writes <code>' + DATA_FILE + '</code> there after every change.'; btn = '<button class="btn go" data-act="link">Link my Strand folder</button>'; }
  else if (st.dirState === 'paused') { msg = '<b>Linked to "' + esc(st.dirName) + '", waiting for permission.</b> The browser asks once per visit.'; btn = '<button class="btn go" data-act="reconnect">Reconnect</button><button class="btn" data-act="unlink">Unlink</button>'; }
  else if (st.writeError) { cls += ' bad'; msg = '<b>Could not write the data file:</b> ' + esc(st.writeError) + '. Your data is still safe in this browser.'; btn = '<button class="btn go" data-act="reconnect">Try again</button>'; }
  else { cls += ' ok'; msg = '<b>Saving to ' + esc(st.dirName) + '/' + DATA_FILE + '.</b> ' + (st.lastWrite ? 'Last written at ' + st.lastWrite.toLocaleTimeString() + '.' : 'Up to date.'); btn = '<button class="btn" data-act="unlink">Unlink</button>'; }
  h += '<h3>Data file on this computer</h3><div class="' + cls + '"><i></i><span>' + msg + '</span></div><div class="row">' + btn + '</div>';
  h += '<h3>Backup</h3><p>Export writes everything: habits, log, points ledger, shields, gene picks, milestones, media index and settings. Importing a backup replaces what is here.</p><div class="row"><button class="btn" data-act="export">Export a backup</button><button class="btn" data-act="importBackup">Import a backup</button><button class="btn" data-act="wipe">Wipe everything</button></div>';
  h += '<h3>Import a backup from a link</h3><p>Paste a link that returns a Strand data file as JSON, such as an npoint API link. It replaces what is here, the same as importing a backup.</p><div class="row"><input id="impUrl" style="flex:1;min-width:240px" placeholder="https://api.npoint.io/..." spellcheck="false"><button class="btn" data-act="importUrl">Import from link</button></div>';
  h += '<h3>Import entries</h3><p>Merge check-ins you dictated somewhere else. Paste the JSON or pick a file. An entry whose import ID was already merged is skipped, so importing the same file twice is safe.</p><textarea id="impText" spellcheck="false" placeholder=\'{ "strandImport": 1, "entries": [ { "importId": "2026-11-15-a", "date": "2026-11-15", "habit": "water" } ] }\'></textarea><div class="row"><button class="btn go" data-act="importEntries">Merge these entries</button><button class="btn" data-act="importEntriesFile">Pick a file</button></div>';
  if (st.importReport) h += '<pre>' + esc(st.importReport) + '</pre>';
  h += '<h3>Notes: the entry import format</h3><pre>{\n  "strandImport": 1,\n  "entries": [\n    { "importId": "2026-11-15-a", "date": "2026-11-15", "habit": "water" },\n    { "importId": "2026-11-15-b", "date": "2026-11-15", "habit": "gym", "note": "legs" },\n    { "importId": "2026-11-14-c", "date": "2026-11-14", "habit": "alcohol", "amount": 2 }\n  ]\n}</pre><ul><li><b>importId</b>: any text, unique per entry. Re-importing the same ID is skipped.</li><li><b>date</b>: YYYY-MM-DD, the day it happened. Not in the future.</li><li><b>habit</b>: one of ' + st.data.habits.map(function (x) { return '<code>' + esc(x.id) + '</code>'; }).join(', ') + '. The short name or symbol also works.</li><li><b>amount</b>: only for alcohol, the number of drinks. <b>note</b>: optional.</li><li>A bare list <code>[ {...}, {...} ]</code> or a single entry object is accepted too.</li><li>A habit already logged for that day is skipped, not doubled. Bonus rolls for imported entries happen at import time.</li></ul>';
  h += '<h3>Notes: the media format</h3><ul><li>Files live in a folder named <code>' + MEDIA_DIR + '</code> beside this page (inside your linked Strand folder).</li><li>File name = the milestone ID shown on the slot: <code>stage-protocell.mp4</code>, <code>compound-glycine.png</code>.</li><li>Films: .mp4 (H.264) or .webm. Cards: .png, .jpg or .webp.</li><li>The <b>media request</b> a slot copies is JSON with <code>milestone</code>, <code>deliver.saveAs</code>, <code>stats</code>, <code>habits</code> and <code>strand</code> (one object per day: date, state, and one slot per log entry marked pair, damaged or repaired).</li></ul>';
  h += '<h3>Notes: room for more modules</h3><p>Habits is one module. The data file keeps a <code>modules</code> block and every log entry and ledger row carries a <code>module</code> name, so a second module (calories and macros is reserved as <code>nutrition</code>) can write to the same file and the same points ledger without changing what is here.</p>';
  return h;
}
function drawerAct(a, el) {
  var id = el.dataset.id, slot = id && st.data.media.find(function (m) { return m.id === id; });
  if (a === 'mplay') openPlayer(id);
  else if (a === 'mreplay') { var ms = st.data.milestones.find(function (m) { return m.id === id; }); closeDrawer(); if (ms) stageCinematic(ms, true); }
  else if (a === 'mreq' || a === 'mreqsave') {
    var txt = JSON.stringify(E.mediaRequest(st.data, id), null, 1);
    if (a === 'mreqsave') { download('media-request-' + id + '.json', txt); return; }
    var okc = function () { toast('<b>Copied.</b> Paste it to Claude and ask for the ' + (slot.kind === 'video' ? 'film' : 'card') + ' for ' + esc(id) + '.', 'gold'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(okc, function () { download('media-request-' + id + '.json', txt); });
    else download('media-request-' + id + '.json', txt);
  }
  else if (a === 'mimport') pickFile(slot.kind === 'video' ? 'video/mp4,video/webm' : 'image/png,image/jpeg,image/webp').then(function (f) { if (f) Media.importFile(slot, f); });
  else if (a === 'ghConnect') {
    var v = function (id) { return ($('#' + id).value || '').trim(); }, tok = v('ghToken') || (GH.cfg && GH.cfg.token) || '';
    if (!v('ghOwner') || !v('ghRepo') || !tok) { toast('Fill in the username, the repository and the token.', 'bad'); return; }
    GH.connect({ owner: v('ghOwner'), repo: v('ghRepo'), path: (v('ghPath') || DATA_FILE).replace(/^\/+/, ''), branch: v('ghBranch'), token: tok });
  }
  else if (a === 'ghSave') { GH.dirty(true); GH.push(); }
  else if (a === 'ghResolve') GH.conflict();
  else if (a === 'ghEdit') { GH.edit = true; renderDrawer(); }
  else if (a === 'ghCancel') { GH.edit = false; renderDrawer(); }
  else if (a === 'ghOff') modal('Disconnect GitHub?', 'This device stops saving to GitHub and forgets the token. Your data stays here and in the repo.', [{ label: 'Disconnect', cls: 'hot', fn: function () { GH.disconnect(); renderDrawer(); } }]);
  else if (a === 'importUrl') {
    var u = ($('#impUrl').value || '').trim(); if (!/^https:\/\//.test(u)) { toast('Paste a link that starts with https://', 'bad'); return; }
    fetch(u, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('the link answered ' + r.status); return r.json(); }).then(function (j) {
      var d = E.normalize(j);
      modal('Replace what is here?', 'The link holds ' + d.log.length + ' log entries. Importing replaces the data on screen' + (GH.on() ? ' and saves it to GitHub' : '') + '.', [{ label: 'Import it', cls: 'go', fn: function () { st.data = d; st.mediaCache = {}; boot2(true); Store.save(); toast('<b>Imported</b> ' + d.log.length + ' entries from the link.', 'gold'); } }]);
    }).catch(function (e) { toast('Could not import from that link: ' + esc(e.message), 'bad'); });
  }
  else if (a === 'link') Store.link();
  else if (a === 'reconnect') Store.reconnect();
  else if (a === 'unlink') Store.unlink();
  else if (a === 'export') download('strand-backup-' + st.today + '.json', (st.data.derived = E.snapshot(st.D), Store.text()));
  else if (a === 'importBackup') pickFile('.json,application/json').then(function (f) {
    if (!f) return;
    f.text().then(function (t) { var d = E.normalize(JSON.parse(t)); st.data = d; st.mediaCache = {}; boot2(true); Store.save(); toast('<b>Backup restored.</b> ' + plural(d.log.length, 'entry').replace('entrys', 'entries') + ', ' + fmt(st.D.points) + ' points.', 'gold'); })
      .catch(function (e) { toast('That file could not be imported: ' + esc(e.message), 'bad'); });
  });
  else if (a === 'wipe') modal('Wipe everything?', 'This clears the log, the ledger, milestones and settings, here and in the linked data file. Export a backup first if you might want it back.', [
    { label: 'Export a backup first', fn: function () { drawerAct('export', el); } },
    { label: 'Wipe everything', cls: 'hot', fn: function () { st.data = E.newData(); st.mediaCache = {}; boot2(true); Store.save(); toast('<b>Wiped.</b> A fresh strand starts with your next check-in.', ''); } }
  ]);
  else if (a === 'importEntries' || a === 'importEntriesFile') {
    var go = function (t) {
      var payload; try { payload = JSON.parse(t); } catch (e) { toast('That is not valid JSON: ' + esc(e.message), 'bad'); return; }
      var r = E.importEntries(st.data, payload, { today: st.today });
      if (r.error) { toast(esc(r.error), 'bad'); return; }
      var now = clock(); r.added.forEach(function (e, i) { st.v.anims[e.id] = now + 0.1 + i * 0.06; });
      st.importReport = 'Merged ' + r.added.length + ', skipped ' + r.skipped.length + ', problems ' + r.errors.length + (r.skipped.length ? '\n\nSkipped\n  ' + r.skipped.join('\n  ') : '') + (r.errors.length ? '\n\nProblems\n  ' + r.errors.join('\n  ') : '');
      refreshAll(); Store.save();
      toast('<b>Merged ' + plural(r.added.length, 'entry').replace('entrys', 'entries') + '.</b> ' + r.skipped.length + ' skipped, ' + r.errors.length + ' with problems.', r.errors.length ? 'bad' : 'gold');
      if (r.added.length) { Sfx.init(); Sfx.bonus('crit'); }
      var sg = r.events.filter(function (e) { return e.type === 'stage'; }).pop(); if (sg) setTimeout(function () { closeDrawer(); stageCinematic(sg.milestone); }, 700);
    };
    if (a === 'importEntries') go($('#impText').value); else pickFile('.json,application/json').then(function (f) { if (f) f.text().then(go); });
  }
  else if (a === 'advApply') {
    try {
      var o = JSON.parse($('#advJson').value), s = S();
      if (!Array.isArray(o.routines) || !Array.isArray(o.stages) || !o.stages.length || !Array.isArray(o.thinning) || !o.thinning.length || !Array.isArray(o.bonuses) || !o.bonuses.length) throw new Error('routines, stages, thinning and bonuses must be non-empty lists');
      st.data.routines = o.routines; s.thinning = o.thinning; s.bonuses = o.bonuses; s.stages = o.stages; s.compounds = o.compounds || []; s.repair.actions = o.repairActions || []; if (Array.isArray(o.traits)) s.traits = o.traits;
      refreshAll(); Store.save(); toast('<b>Applied.</b>', 'gold');
    } catch (e) { toast('Not applied: ' + esc(e.message), 'bad'); }
  }
  else if (a === 'resetSettings') modal('Reset every number?', 'Weights, caps, odds, stages and routines go back to their starting values. Your log and points stay as they are.', [{ label: 'Reset', cls: 'go', fn: function () { st.data.settings = U.clone(E.DEFAULT_SETTINGS); st.data.routines = U.clone(E.DEFAULT_ROUTINES); st.data.habits.forEach(function (hb) { var d = E.DEFAULT_HABITS.find(function (x) { return x.id === hb.id; }); if (d) { hb.weight = d.weight; if (d.weeklyTarget) hb.weeklyTarget = d.weeklyTarget; } }); refreshAll(); Store.save(); } }]);
}
function drawerChange(el) {
  var v = Number(el.value);
  if (el.dataset.hw) { if (!(v >= 0)) return; st.habits[el.dataset.hw].weight = v; }
  else if (el.dataset.ht) { if (!(v >= 1)) return; st.habits[el.dataset.ht].weeklyTarget = Math.round(v); }
  else if (el.dataset.ha) { st.habits[el.dataset.ha].archived = el.checked; if (!el.checked) delete st.habits[el.dataset.ha].archived; }
  else if (el.dataset.num) { if (!isFinite(v) || el.value === '') return; setPath(S(), el.dataset.num, v); }
  else return;
  recompute(); renderHUD(); renderDeck(); renderSide(); Store.save();
}


/* ============================== guide: spoken walkthrough ================ */
/* Recorded narration: one MP3 per chapter in media/guide-01.mp3 .. guide-09.mp3.
   GUIDE_CHAPTERS holds the recorded text (captions) and each line's start time in
   seconds. The audio is fixed: when a rule or default changes, re-record the chapter
   and update its lines and times here. */
var GUIDE_CHAPTERS = [
  {"title": "Welcome", "target": "#field", "at": [0.0, 2.31, 7.84, 14.46, 22.78, 30.71], "lines": ["Welcome to Strand.", "Strand turns your habits into a growing strand of DNA.", "Every habit you complete adds a base pair, and every day adds a stretch of strand.", "Nothing on the strand is decoration. Its length, its gaps and its repairs all come straight from your log.", "Drag the strand to move through time, and scroll on it to zoom. Hover a base pair to see what it was.", "This walkthrough has nine short chapters. You can jump to any of them from the list."]},
  {"title": "Checking in", "target": "#left .atoms", "at": [0.0, 5.64, 9.79, 17.86, 25.93, 33.97, 42.67, 50.22], "lines": ["Your daily check-in lives below the strand. Each habit is an atom.", "Tap an atom once when the habit is done.", "It lights up, you hear a tone, the points float up, and a new base pair flies onto the strand.", "Health atoms sit on one side of the helix, and spiritual atoms on the other.", "Tapped the wrong one? Tap it again. The label changes to \"tap again to undo,\" and a second tap removes it.", "Forgot a day? Use the arrows beside the date to step back. You can check in up to 7 days back.", "Weekly habits show a ring that fills toward the week's target. The gym aims for 2 a week, and extra sessions still pay.", "A full day of check-ins takes well under a minute."]},
  {"title": "Points and bonuses", "target": ".tally", "at": [0.0, 10.34, 14.52, 23.75, 28.48, 36.9], "lines": ["Each habit pays points by weight. A gym session pays 20. Vitamins pay 3. You can change any weight in Settings.", "Now and then, a check-in pays a surprise bonus on top.", "A crit adds the habit's weight again. A vesicle adds twice its weight. A rare isotope adds 4 times its weight.", "You can't predict which tap will pay. That is on purpose.", "As a habit's streak grows, its base pay thins, down to 60 percent after 45 days in a row.", "At the same time its bonus odds rise, from 10 percent to 30 percent. A long streak trades steady pay for bigger surprises."]},
  {"title": "Bonds and stable molecules", "target": "#molBox", "at": [0.0, 5.18, 11.41, 17.66, 23.65, 26.36, 33.28], "lines": ["The molecule on the right shows today's daily atoms.", "Finish every habit in a routine on the same day, and those atoms bond.", "The morning stack is sleep, daily text, vitamins and push-ups.", "The evening stack is Bible reading, mindfulness, fasting and water.", "Each bond pays 5 points.", "Finish every daily habit in both categories, and the day becomes a stable molecule.", "A stable molecule pays 15 points, and that day gets a gold halo on the strand."]},
  {"title": "Stable weeks and shields", "target": "#side .week", "at": [0.0, 7.55, 15.73, 24.18, 30.04, 35.52, 47.6, 54.43], "lines": ["Points start out loose. Loose points can be lost to a clawback, which comes up in a moment.", "A solid day has at least 4 check-ins. A week with 5 solid days closes stable.", "When a stable week closes, all of its loose points bond for good. Bonded points can never be taken back.", "The line under the strand shows this. Solid purple is bonded. Dashed is still loose.", "A stable week also earns a shield. You can hold up to 3.", "If you miss a whole day, a shield is spent automatically, and your chain survives. That day shows as a pale blue hexagon.", "If you miss a day with no shield left, it becomes a gap, and the chain starts over.", "A gap never costs points. Nothing in Strand decays on its own while you're away."]},
  {"title": "Genes", "target": "#geneCard, #side .card:last-child", "at": [0.0, 4.0, 13.44, 18.41, 31.88], "lines": ["Every stable week also earns a gene.", "When one is waiting, a gold chip appears on the strand, and three genes are offered at the top of the side panel.", "Choose one. It is permanent, and it works from that day forward.", "Genes can add a shield slot, make repairs earn back more, raise bonus odds for health or spiritual habits, or make bonds and stable molecules pay more.", "Most genes can be taken more than once, up to a limit. Over the months, your genome becomes your own build."]},
  {"title": "Negatives and repair", "target": ".atom.neg", "at": [0.0, 8.82, 14.49, 26.08, 34.6, 40.8, 50.73, 59.65, 68.84], "lines": ["Alcohol is tracked as a negative. Tap it only when it happens, set the number of drinks, and log it.", "Logging honestly always pays 3 points. The honesty never costs you.", "The drinks do cost. Each one claws back up to 12 points, taken from your newest loose points first. Bonded points are never touched.", "There are caps. No single day can lose more than 40 points, and no seven days in a row more than 90.", "On the strand, that base pair shows as damaged, with a break in the backbone.", "Then the repair bay opens. It follows how a cell repairs its DNA: recognize the damage, cut it out and fill it, then seal it.", "Recognizing is already done, because you logged it. Pick one recovery action, do it, and seal the repair.", "That earns back 60 percent of what was clawed, and the pair is marked repaired for good, with a gold seam.", "The repair stays open until the end of the day you logged it."]},
  {"title": "Stages and the vault", "target": "#stagebox", "at": [0.0, 12.92, 20.75, 23.2, 29.15, 40.09], "lines": ["Your stage is at the top left. Points carry you through three phases: strand, then cell, then organism, with several stages inside each.", "The bar shows how close the next stage is. Stages are spaced so the next one is always in sight.", "Stages never go backward.", "Small stage changes flash a banner. The big ones take the whole screen.", "Five big stages each earn a film of your strand exactly as it stood that day. Eight milestone compounds each earn a collectible card.", "Films and cards live in the Vault. When a slot unlocks, copy its media request and give it to Claude, then drop the file you get back into the media folder."]},
  {"title": "Your data", "target": "#navData", "at": [0.0, 6.25, 13.32, 20.1, 28.75, 36.49, 46.61, 54.08], "lines": ["Your log is saved to your own private GitHub repository.", "Open Data, paste your access token, and connect. Do this once on each device you use.", "After that, every change is saved automatically, and each save is kept as its own version.", "If another device saved first, Strand asks which version to keep. It never overwrites one silently.", "Export a backup now and then. Importing it puts everything back, the points ledger included.", "You can also merge entries you dictated on your phone. The format is in the Data panel, and an entry is never imported twice.", "Every number in this walkthrough is a default. You can change any of them in Settings.", "That's Strand. Go tap your first atom."]}
];
var Guide = {
  on: false, ch: 0, line: 0, playing: false, token: 0, timer: null, chapters: GUIDE_CHAPTERS, rate: 1, listOpen: false, audio: null, failed: false,
  src: function (i) { return MEDIA_DIR + '/guide-' + (i < 9 ? '0' : '') + (i + 1) + '.mp3'; },
  el: function () {
    if (Guide.audio) return Guide.audio;
    var a = Guide.audio = new Audio(); a.preload = 'auto';
    a.addEventListener('timeupdate', function () {
      var c = Guide.chapters[Guide.ch], t = a.currentTime, k = 0;
      while (k + 1 < c.at.length && t >= c.at[k + 1]) k++;
      if (k !== Guide.line) { Guide.line = k; Guide.render(); }
    });
    a.addEventListener('ended', function () {
      if (!Guide.playing) return;
      if (Guide.ch >= Guide.chapters.length - 1) return Guide.finish();
      var tk = Guide.token; Guide.timer = setTimeout(function () { if (tk === Guide.token) { Guide.ch++; Guide.line = 0; Guide.say(); } }, 700);
    });
    a.addEventListener('error', function () { if (Guide.playing && a.getAttribute('src')) { Guide.failed = true; Guide.say(); } });
    return a;
  },
  open: function () {
    try { Guide.rate = +localStorage.getItem('strand.guide.rate') || 1; } catch (e) {}
    closeDrawer(); Guide.on = true; Guide.ch = 0; Guide.line = 0; Guide.failed = false; Guide.seek = true;
    $('#guide').classList.add('on'); Guide.render(); Guide.play();
  },
  close: function () { Guide.stop(); Guide.on = false; $('#guide').classList.remove('on'); $('#spot').classList.remove('on'); },
  stop: function () { Guide.token++; clearTimeout(Guide.timer); if (Guide.audio) Guide.audio.pause(); Guide.playing = false; },
  play: function () { Guide.stop(); Guide.playing = true; Guide.render(); Guide.say(); },
  say: function () {
    var c = Guide.chapters[Guide.ch]; if (!c) return Guide.finish();
    Guide.render();
    if (Guide.failed) return Guide.captions();   // file missing or offline: captions only
    var a = Guide.el(), want = Guide.src(Guide.ch);
    var seek = Guide.seek; Guide.seek = false;
    if (a.getAttribute('src') !== want) { a.setAttribute('src', want); seek = Guide.line > 0; }
    a.playbackRate = Guide.rate;
    var go = function () { if (seek) try { a.currentTime = c.at[Guide.line] || 0; } catch (e) {} var p = a.play(); if (p && p.catch) p.catch(function (e) { if (e && e.name === 'NotAllowedError') { Guide.playing = false; Guide.render(); } }); };
    if (a.readyState >= 1) go(); else a.addEventListener('loadedmetadata', go, { once: true });
  },
  captions: function () {
    var c = Guide.chapters[Guide.ch], tk = Guide.token, text = c.lines[Guide.line];
    Guide.timer = setTimeout(function () {
      if (tk !== Guide.token) return;
      if (Guide.line + 1 < c.lines.length) Guide.line++;
      else if (Guide.ch < Guide.chapters.length - 1) { Guide.ch++; Guide.line = 0; }
      else return Guide.finish();
      Guide.say();
    }, Math.max(2200, text.split(' ').length * 380 / Guide.rate));
  },
  pause: function () { Guide.stop(); Guide.render(); },
  finish: function () { Guide.stop(); Guide.ch = Guide.chapters.length - 1; Guide.line = Guide.chapters[Guide.ch].lines.length - 1; Guide.render(true); },
  go: function (i) { Guide.ch = clamp(i, 0, Guide.chapters.length - 1); Guide.line = 0; Guide.listOpen = false; Guide.seek = true; Guide.play(); },
  render: function (done) {
    var g = $('#guide'), c = Guide.chapters[Guide.ch], n = Guide.chapters.length; if (!c) return;
    $('#gChap').textContent = 'Chapter ' + (Guide.ch + 1) + ' of ' + n + ': ' + c.title;
    $('#gCap').textContent = done ? 'End of the walkthrough.' : c.lines[Math.min(Guide.line, c.lines.length - 1)];
    $('#gPlay').innerHTML = Guide.playing ? '<svg viewBox="0 0 20 20"><rect x="5" y="4" width="3.4" height="12" rx="1"/><rect x="11.6" y="4" width="3.4" height="12" rx="1"/></svg>' : '<svg viewBox="0 0 20 20"><path d="M6 4l10 6-10 6z"/></svg>';
    $('#gPlay').setAttribute('aria-label', Guide.playing ? 'Pause' : 'Play');
    $('#gBar').innerHTML = Guide.chapters.map(function (x, i) { var f = i < Guide.ch ? 1 : i > Guide.ch ? 0 : (Guide.line + (done ? 1 : 0)) / x.lines.length; return '<button data-g="go" data-i="' + i + '" title="' + esc(x.title) + '"><i style="width:' + (f * 100) + '%"></i></button>'; }).join('');
    $('#gList').hidden = !Guide.listOpen;
    $('#gList').innerHTML = Guide.chapters.map(function (x, i) { return '<button data-g="go" data-i="' + i + '" aria-current="' + (i === Guide.ch) + '"><span>' + (i + 1) + '</span>' + esc(x.title) + '</button>'; }).join('');
    $('#gRate').value = String(Guide.rate);
    g.classList.toggle('mute', Guide.failed);
    Guide.spot(c);
  },
  spot: function (c) {
    var sp = $('#spot'), el = null;
    c.target.split(',').some(function (sel) { el = $(sel.trim()); return el && el.offsetParent !== null; });
    if (el && el.closest('.card') && !el.matches('.card') && el.id !== 'left') el = el.closest('.card') || el;
    if (!el) { sp.classList.remove('on'); return; }
    if (Guide.lastEl !== el) { Guide.lastEl = el; el.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }); }
    sp.classList.add('on');
  },
  track: function () {
    if (Guide.on && Guide.lastEl && $('#spot').classList.contains('on')) {
      var r = Guide.lastEl.getBoundingClientRect(), sp = $('#spot'), p = 8;
      sp.style.transform = 'translate(' + (r.left - p) + 'px,' + (r.top - p) + 'px)'; sp.style.width = (r.width + p * 2) + 'px'; sp.style.height = (r.height + p * 2) + 'px';
      var gd = $('#guide'); gd.style.setProperty('--gh', gd.offsetHeight + 'px'); gd.classList.toggle('up', r.top + r.height / 2 > innerHeight * 0.5);
    }
    requestAnimationFrame(Guide.track);
  },
  bind: function () {
    var g = $('#guide');
    g.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-g]'); if (!b) return; var k = b.dataset.g;
      if (k === 'play') Guide.playing ? Guide.pause() : Guide.play();
      else if (k === 'prev') Guide.go(Guide.line > 0 ? Guide.ch : Guide.ch - 1);
      else if (k === 'next') Guide.go(Guide.ch + 1);
      else if (k === 'go') Guide.go(+b.dataset.i);
      else if (k === 'list') { Guide.listOpen = !Guide.listOpen; Guide.render(); }
      else if (k === 'close') Guide.close();
    });
    $('#gRate').addEventListener('change', function () { Guide.rate = +this.value; try { localStorage.setItem('strand.guide.rate', this.value); } catch (e) {} if (Guide.audio) Guide.audio.playbackRate = Guide.rate; });
    requestAnimationFrame(Guide.track);
  }
};

/* ============================== strand canvas ============================ */
var cv, ctx, mini, mctx, frames = 0, slow = 0, lastT = 0;
function resize() {
  var f = $('#field'), dpr = Math.min(2, window.devicePixelRatio || 1), W = f.clientWidth, H = f.clientHeight, v = st.v;
  v.W = W; v.H = H; v.dpr = dpr; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  var top = 46, bot = 112;
  v.amp = clamp((H - top - bot) / 2 - 12, 30, 122); v.cy = top + (H - top - bot) / 2 + 2;
  mini.width = Math.round(mini.clientWidth * dpr); mini.height = Math.round(mini.clientHeight * dpr);
  if (st.L) clampScroll();
}
function frame(now) {
  var v = st.v, t = (now - st.t0) / 1000, dt = now - lastT; lastT = now;
  if (!document.hidden && st.L) {
    if (!reduce) v.phase = 0.6 + t * 0.2;
    if (v.target != null) { v.scrollX += (v.target - v.scrollX) * 0.16; if (Math.abs(v.target - v.scrollX) < 0.5) { v.scrollX = v.target; v.target = null; } }
    else if (Math.abs(v.vel) > 0.15) { v.scrollX += v.vel; v.vel *= 0.92; clampScroll(); }
    v.ripples = v.ripples.filter(function (r) { return t - r.t0 < 1.4; });
    v.t = t; v.habits = st.habits; v.routines = st.routines; v.bondedThrough = st.D.bondedThrough; v.today = st.today; v.selected = st.sel;
    HX.draw(ctx, st.L, v);
    if (frames % 4 === 0) HX.mini(mctx, st.L, v, mini.clientWidth, mini.clientHeight, v.dpr);
    frames++; if (dt > 34) slow++; if (frames === 150) { if (slow > 60) v.bloom = false; }
  }
  requestAnimationFrame(frame);
}
function tipFor(p) {
  var D = st.D, tip = '';
  if (p.slot) {
    var s = p.slot.s, e = st.data.log.find(function (x) { return x.id === s.logId; }), hb = st.habits[s.habitId] || { name: s.habitId };
    tip = '<b>' + esc(hb.name) + '</b><br><span class="t2">' + shortDate(p.day.d.date) + '</span><br>';
    if (!e) return tip;
    if (s.t === 'pair') tip += '+' + e.points + ' base' + (e.bonus ? ', <span style="color:var(--gold)">+' + e.bonus.points + ' ' + esc(e.bonus.name.toLowerCase()) + '</span>' : '') + (e.streakAtLog >= 7 ? '<br><span class="t2">Run of ' + e.streakAtLog + ' days: thinner base, better bonus odds</span>' : '');
    else if (s.t === 'damaged') tip += '<span style="color:var(--lesion)">Damaged pair.</span> ' + plural(e.amount, e.unit) + ', −' + e.clawback.taken + ' clawed, +' + S().points.integrity + ' for logging it' + (e.loggedOn === st.today ? '<br><span class="t2">Repair is open today</span>' : '');
    else tip += '<span style="color:var(--gold)">Repaired pair.</span> ' + plural(e.amount, e.unit) + ', −' + e.clawback.taken + ' clawed, +' + e.repair.reearned + ' re-earned<br><span class="t2">' + esc(e.repair.label) + '</span>';
  } else if (p.day) {
    var d = p.day.d, bonded = D.bondedThrough && d.date <= D.bondedThrough;
    tip = '<b>' + longDate(d.date) + '</b><br>';
    if (d.state === 'shielded' && !d.slots.length) tip += '<span style="color:var(--frost)">A shield was spent here.</span> Nothing logged, chain kept.';
    else if (d.state === 'gap' && !d.slots.length) tip += 'Gap. Nothing logged and no shield left, so the chain restarted.';
    else if (!d.slots.length) tip += 'Nothing logged yet.';
    else tip += plural(d.slots.length, 'base pair') + (d.stable ? ', <span style="color:var(--gold)">stable molecule</span>' : '') + (d.bonds.length ? ', ' + plural(d.bonds.length, 'routine bond') : '');
    tip += '<br><span class="t2">' + (bonded ? 'Bonded for good' : 'Gains still loose') + '. Click to open the day.</span>';
  }
  return tip;
}
function bindCanvas() {
  var drag = null, moved = 0, tipEl = $('#tip');
  cv.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, sx: st.v.scrollX, last: e.clientX }; moved = 0; st.v.target = null; st.v.vel = 0; cv.setPointerCapture(e.pointerId); cv.classList.add('drag'); });
  cv.addEventListener('pointermove', function (e) {
    var r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    if (drag) { var dx = e.clientX - drag.x; moved = Math.max(moved, Math.abs(dx)); st.v.scrollX = drag.sx - dx; st.v.vel = drag.last - e.clientX; drag.last = e.clientX; clampScroll(); tipEl.classList.remove('on'); return; }
    var p = HX.pick(st.L, st.v, mx, my), inBand = my > st.v.cy - st.v.amp - 36 && my < st.v.cy + st.v.amp + 60;
    st.v.hoverLog = p.slot ? p.slot.s.logId : null; st.v.hoverDate = p.day && inBand ? p.day.d.date : null;
    if (p.day && inBand) { tipEl.innerHTML = tipFor(p); tipEl.classList.add('on'); var tw = tipEl.offsetWidth; tipEl.style.left = clamp(mx + 16, 8, r.width - tw - 8) + 'px'; tipEl.style.top = Math.max(8, my - tipEl.offsetHeight - 14) + 'px'; }
    else tipEl.classList.remove('on');
  });
  function up(e) {
    cv.classList.remove('drag'); if (!drag) return; drag = null;
    if (moved < 5) { st.v.vel = 0; var r = cv.getBoundingClientRect(), p = HX.pick(st.L, st.v, e.clientX - r.left, e.clientY - r.top); if (p.day) selectDate(p.day.d.date); }
  }
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', function () { drag = null; cv.classList.remove('drag'); });
  cv.addEventListener('pointerleave', function () { st.v.hoverLog = null; st.v.hoverDate = null; tipEl.classList.remove('on'); });
  cv.addEventListener('wheel', function (e) {
    e.preventDefault();
    if (e.ctrlKey || Math.abs(e.deltaY) > Math.abs(e.deltaX) && !e.shiftKey) { var r = cv.getBoundingClientRect(); zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left); }
    else { st.v.target = null; st.v.scrollX += e.deltaX || e.deltaY; clampScroll(); }
  }, { passive: false });
  var md = false;
  function jump(e) { var r = mini.getBoundingClientRect(), fx = clamp((e.clientX - r.left) / r.width, 0, 1); st.v.target = null; st.v.scrollX = fx * st.L.width - st.v.W / 2; clampScroll(); }
  mini.addEventListener('pointerdown', function (e) { md = true; mini.setPointerCapture(e.pointerId); jump(e); });
  mini.addEventListener('pointermove', function (e) { if (md) jump(e); });
  mini.addEventListener('pointerup', function () { md = false; });
}
function zoom(k, atX) {
  var v = st.v, old = v.slotW, nw = clamp(old * k, 6, 34); if (nw === old) return;
  if (atX == null) atX = v.W / 2;
  var frac = (v.scrollX + atX) / Math.max(1, st.L.width);
  v.slotW = nw; v.dayGap = Math.max(4, Math.round(nw * 0.6)); relayout();
  v.target = null; v.scrollX = frac * st.L.width - atX; clampScroll();
}

/* ============================== boot ===================================== */
function dayTurnNotices(prev) {
  if (!prev || !prev.asOf || prev.asOf === st.today) return;
  var D = st.D;
  D.shieldedDates.filter(function (d) { return (prev.shieldedDates || []).indexOf(d) < 0 && d > prev.asOf; }).forEach(function (d) {
    toast('<b>A shield covered ' + shortDate(d) + '.</b> Nothing was logged that day, and your chain survived. ' + plural(D.shields, 'shield') + ' left.', 'frost', { ms: 12000 });
  });
  D.gapDates.filter(function (d) { return d > prev.asOf; }).slice(-1).forEach(function (d) { toast('<b>' + shortDate(d) + ' is a gap.</b> No shield was left, so the chain restarts today. Nothing you earned was lost.', '', { ms: 12000 }); });
  if (D.bondedThrough && (!prev.bondedThrough || D.bondedThrough > prev.bondedThrough)) toast('<b>Last week closed stable.</b> Its gains are bonded for good, and you earned a shield and a gene to express.', 'gold', { ms: 12000 });
  else { var lw = D.weeks.filter(function (w) { return w.closed; }).pop(); if (lw && lw.end >= prev.asOf && !lw.stable) toast('<b>Last week closed with ' + lw.solid + ' of ' + S().stableWeek.minSolidDays + ' solid days.</b> Its gains stay loose and carry into this week.', '', { ms: 12000 }); }
}
function boot2(silent) {
  var prev = st.data.derived;
  st.today = U.toISO(new Date()); st.sel = st.today;
  recompute(); st.shownPts = silent ? st.shownPts : 0;
  scrollToDate(st.today, true); renderAll();
  if (!silent) dayTurnNotices(prev);
  Media.scan();
}
function boot() {
  cv = $('#helix'); ctx = cv.getContext('2d'); mini = $('#mini'); mctx = mini.getContext('2d');
  try { Sfx.on = localStorage.getItem('strand.sound') !== 'off'; } catch (e) {}
  $('#soundBtn').setAttribute('aria-pressed', Sfx.on); $('#soundBtn').title = Sfx.on ? 'Sound is on' : 'Sound is off';
  Store.init().then(GH.init).then(function () {
    resize(); boot2(); Store.save(true); bindCanvas(); requestAnimationFrame(frame); GH.afterBoot();
    if (st.dirState === 'paused') toast('<b>Your data file needs one click.</b> The browser asks for permission once per visit.', '', { sticky: true, action: { label: 'Reconnect', fn: Store.reconnect } });
  });
  window.addEventListener('resize', function () { resize(); });
  window.addEventListener('focus', GH.check);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') GH.check(); else if (GH.on() && GH.dirty() && GH.state === 'pending') GH.push(); });
  window.addEventListener('online', function () { if (GH.on() && GH.dirty() && GH.state !== 'conflict') GH.push(); });
  $('#left').addEventListener('click', function (ev) { var b = ev.target.closest('[data-habit]'); if (b) return tapHabit(b.dataset.habit, b); var a = ev.target.closest('[data-act]'); if (a) act(a.dataset.act, a); });
  $('#side').addEventListener('click', function (ev) { var a = ev.target.closest('[data-act]'); if (a) act(a.dataset.act, a); });
  $('#drawerBody').addEventListener('click', function (ev) { var a = ev.target.closest('[data-act]'); if (a) drawerAct(a.dataset.act, a); });
  $('#drawerBody').addEventListener('change', function (ev) { drawerChange(ev.target); });
  $$('.nav [data-open]').forEach(function (b) { b.addEventListener('click', function () { openDrawer(b.dataset.open); }); });
  $('#navGuide').addEventListener('click', function () { Sfx.init(); Guide.open(); }); Guide.bind();
  $('#gStart') && $('#gStart').addEventListener('click', function () { Guide.open(); });
  $('#stagebox').addEventListener('click', function () { openDrawer('vault'); });
  $('#geneChip').addEventListener('click', function () { var c = $('#geneCard'); if (!c) return; $('#side').scrollTop = 0; c.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }); c.classList.remove('pulse'); void c.offsetWidth; c.classList.add('pulse'); });
  $('#drawerClose').addEventListener('click', closeDrawer); $('#scrim').addEventListener('click', closeDrawer);
  $('#soundBtn').addEventListener('click', function () { Sfx.on = !Sfx.on; try { localStorage.setItem('strand.sound', Sfx.on ? 'on' : 'off'); } catch (e) {} this.setAttribute('aria-pressed', Sfx.on); this.title = Sfx.on ? 'Sound is on' : 'Sound is off'; if (Sfx.on) { Sfx.init(); Sfx.check(2); } });
  $('#zoomIn').addEventListener('click', function () { zoom(1.25); }); $('#zoomOut').addEventListener('click', function () { zoom(0.8); });
  $('#goToday').addEventListener('click', function () { selectDate(st.today); scrollToDate(st.today, false); st.v.target = clamp(st.L.byDate[st.today].x1 - st.v.W + 170, bounds()[0], bounds()[1]); });
  $('#clearSample').addEventListener('click', function () {
    modal('Clear the sample?', 'The fake entries go away and your own strand starts empty. Your settings stay.', [{ label: 'Clear the sample and start', cls: 'go', fn: function () {
      var keep = { settings: st.data.settings, habits: st.data.habits, routines: st.data.routines }; st.data = E.newData(); Object.assign(st.data, keep); st.mediaCache = {}; boot2(true); Store.save();
      toast('<b>Your strand starts here.</b> Tap your first atom.', 'gold');
    } }]);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (Guide.on) Guide.close(); else if ($('#cine').classList.contains('on')) closeCine(); else if ($('#modal').classList.contains('on')) $('#modal').classList.remove('on'); else if (st.drawer) closeDrawer(); }
  });
  setInterval(function () { var now = U.toISO(new Date()); if (now !== st.today) { var prev = st.data.derived; boot2(true); dayTurnNotices(prev); Store.save(); } }, 30000);
}
window.Strand = { gh: GH, guide: Guide, state: st, engine: E, modules: { habits: { id: 'habits', name: 'Habits' } }, registerModule: function (m) { window.Strand.modules[m.id] = m; } };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
