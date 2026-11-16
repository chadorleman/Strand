"""Spending page: GitHub sync, archive and the 1 MB read path, against a mocked GitHub API.
Run from the repo root: python3 test/spending_flow.py  (Playwright + Chrome)."""
import asyncio, pathlib, json, base64, re, hashlib, tempfile, os
from playwright.async_api import async_playwright
files, commits = {}, []
def sha(t): return hashlib.sha1(t.encode()).hexdigest()
def name_of(url): return re.search(r'/contents/(.+?)(\?|$)', url).group(1)
async def handle(route, req):
    url, m = req.url, req.method
    if '/git/blobs/' in url:
        s = url.rsplit('/', 1)[1]
        for f in files.values():
            if f['sha'] == s: return await route.fulfill(json={'sha': s, 'content': base64.b64encode(f['text'].encode()).decode(), 'encoding': 'base64'})
        return await route.fulfill(status=404, json={'message': 'Not Found'})
    if '/contents/' in url:
        n = name_of(url)
        if m == 'GET':
            f = files.get(n)
            if not f: return await route.fulfill(status=404, json={'message': 'Not Found'})
            big = len(f['text'].encode()) > 1_000_000          # GitHub leaves content empty for files over 1 MB
            return await route.fulfill(json={'sha': f['sha'], 'content': '' if big else base64.b64encode(f['text'].encode()).decode(), 'encoding': 'none' if big else 'base64'})
        if m == 'PUT':
            b = json.loads(req.post_data); cur = files.get(n)
            if (cur['sha'] if cur else None) != b.get('sha'): return await route.fulfill(status=409, json={'message': 'does not match'})
            t = base64.b64decode(b['content']).decode(); files[n] = {'sha': sha(t), 'text': t}; commits.append((n, b['message']))
            return await route.fulfill(json={'content': {'sha': files[n]['sha']}})
    await route.fulfill(status=500, json={})
CFG = json.dumps({'owner': 'example', 'repo': 'strand-data', 'path': 'strand-data.json', 'branch': '', 'token': 'github_pat_TEST'})
async def main():
    ok = lambda c, msg: print(('  ok  ' if c else '  FAIL ') + msg) or c
    res = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': 1440, 'height': 900})
        await ctx.route('https://api.github.com/**', handle)
        pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        url = 'file://' + str(pathlib.Path('spending.html').resolve())
        await pg.goto(url); await pg.wait_for_timeout(700)
        res.append(ok(await pg.evaluate("Ledger.state.settings.sample") and not commits, 'opens with sample data, nothing sent'))
        await pg.evaluate("localStorage.setItem('strand.gh', %s)" % json.dumps(CFG)); await pg.reload(); await pg.wait_for_timeout(1200)
        res.append(ok(not commits, 'connected with sample data: sample is never saved to GitHub'))
        # a backup with 26 months of (invented) data, restored through the Setup flow
        bk = await pg.evaluate("""(() => { const C = Ledger.Core, s = C.loadSample(C.freshState()), extra = [];
          s.txns.forEach(t => { const o = JSON.parse(JSON.stringify(t)); o.id = 'o' + t.id; o.d = C.addMonths(t.d, -14); o.key = 'old|' + t.key; extra.push(o); });
          s.txns = extra.concat(s.txns); s.txns.forEach(t => delete t.smp); s.accounts.forEach(a => delete a.smp); s.settings.sample = false; return JSON.stringify(s); })()""")
        fn = os.path.join(tempfile.mkdtemp(), 'backup.json'); open(fn, 'w').write(bk)
        n0 = len(json.loads(bk)['txns'])
        await pg.click('[data-a="go"][data-v="setup"]'); await pg.click('[data-a="stab"][data-t="data"]')
        await pg.set_input_files('#restore', fn); await pg.wait_for_timeout(300); await pg.click('#okb'); await pg.wait_for_timeout(11000)
        names = [c[0] for c in commits]
        res.append(ok('spending-data.json' in names, 'restored backup is saved to spending-data.json beside strand-data.json'))
        arch = sorted(n for n in files if n.startswith('spending-archive-'))
        res.append(ok(arch == ['spending-archive-2024.json', 'spending-archive-2025.json'], 'older months archived by year: ' + ', '.join(arch)))
        w = json.loads(files['spending-data.json']['text']); kept = len(w['txns']); archived = sum(len(json.loads(files[a]['text'])['txns']) for a in arch)
        res.append(ok(kept + archived == n0 and min(t['d'] for t in w['txns']) >= w['archive']['before'] == '2025-10-01', 'nothing lost: %d kept + %d archived = %d; working file starts %s' % (kept, archived, n0, w['archive']['before'])))
        res.append(ok(all('github_pat_TEST' not in f['text'] for f in files.values()), 'token is in no data file'))
        # importing an old export again does not bring archived rows back
        r = await pg.evaluate("""(() => { let out; Ledger.act('t', () => { out = Ledger.Core.commitImport(Ledger.state, { name: 'old.csv', formatName: 'test', accts: { 'sample:mc': { key: 'sample:mc', name: 'Sample Mastercard', last4: '0001', type: 'credit', bal: null } }, rows: [{ ak: 'sample:mc', d: '2025-01-10', raw: 'OLD SHOP', amt: -500, hint: '' }, { ak: 'sample:mc', d: '2026-10-30', raw: 'NEW SHOP', amt: -700, hint: '' }] }); }, { noToast: 1 }); return out; })()""")
        res.append(ok(r['added'] == 1 and r['dupes'] == 1, 'a re-imported row from an archived month is skipped; a new one is added'))
        await pg.wait_for_timeout(5500)
        # another device: big file (over 1 MB) is read through the blob API
        d = json.loads(files['spending-data.json']['text']); d['txns'][0]['note'] = 'x' * 1_100_000; d['meta']['updatedAt'] = '2026-11-16T15:00:00Z'
        t = json.dumps(d); files['spending-data.json'] = {'sha': sha(t), 'text': t}
        ctx2 = await b.new_context(viewport={'width': 390, 'height': 844}); await ctx2.route('https://api.github.com/**', handle)
        pg2 = await ctx2.new_page(); await pg2.goto(url); await pg2.evaluate("localStorage.setItem('strand.gh', %s)" % json.dumps(CFG))
        await pg2.reload(); await pg2.wait_for_timeout(1500)
        res.append(ok(await pg2.evaluate("Ledger.state.txns[0].note.length") == 1_100_000, 'a file over 1 MB loads on another device (blob API)'))
        # conflict: both sides changed
        await pg.evaluate("Ledger.act('Renamed', () => { Ledger.state.txns[1].note = 'from device one'; }, { noToast: 1 })"); await pg.wait_for_timeout(5500)
        res.append(ok(await pg.evaluate("Ledger.sg.state") == 'conflict' and await pg.evaluate("!!document.querySelector('#cfLoad')"), 'both devices changed: it asks which version to keep'))
        await pg.click('#cfKeep'); await pg.wait_for_timeout(800)
        res.append(ok('from device one' in files['spending-data.json']['text'] and await pg.evaluate("Ledger.sg.state") == 'ok', 'keep this device: saved over, old version stays in history'))
        res.append(ok(not errs, 'no page errors ' + str(errs[:3])))
        await b.close()
    print('\n%d passed, %d failed' % (sum(1 for x in res if x), sum(1 for x in res if not x)))
asyncio.run(main())
