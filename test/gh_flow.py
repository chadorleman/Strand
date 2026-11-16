import asyncio, pathlib, json, base64, re, hashlib
from playwright.async_api import async_playwright
store = {'sha': None, 'text': None, 'commits': [], 'private': True, 'token_ok': True}
def sha(t): return hashlib.sha1(t.encode()).hexdigest()
async def handle(route, req):
    url, m = req.url, req.method
    if not store['token_ok']: return await route.fulfill(status=401, json={'message': 'Bad credentials'})
    if re.search(r'/repos/[^/]+/[^/]+$', url.split('?')[0]):
        return await route.fulfill(json={'private': store['private'], 'permissions': {'push': True}})
    if '/contents/' in url:
        if m == 'GET':
            if store['text'] is None: return await route.fulfill(status=404, json={'message': 'Not Found'})
            return await route.fulfill(json={'sha': store['sha'], 'content': base64.b64encode(store['text'].encode()).decode()})
        if m == 'PUT':
            b = json.loads(req.post_data)
            if b.get('sha') != store['sha']: return await route.fulfill(status=409, json={'message': 'is at %s but expected %s' % (store['sha'], b.get('sha'))})
            t = base64.b64decode(b['content']).decode(); store['text'] = t; store['sha'] = sha(t); store['commits'].append(b['message'])
            return await route.fulfill(json={'content': {'sha': store['sha']}})
    await route.fulfill(status=500, json={})
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': 1440, 'height': 900})
        await ctx.route('https://api.github.com/**', handle)
        pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        url = 'file://' + str(pathlib.Path('index.html').resolve())
        await pg.goto(url); await pg.wait_for_timeout(900)
        await pg.click('.nav [data-open="data"]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='/tmp/gh0.png')
        await pg.fill('#ghOwner', 'example'); await pg.fill('#ghToken', 'github_pat_TEST')
        await pg.click('[data-act="ghConnect"]'); await pg.wait_for_timeout(1200)
        print('1 connect, empty repo -> created:', len(store['commits']), store['commits'][-1][:60] if store['commits'] else None)
        print('  token in data file?', 'github_pat_TEST' in (store['text'] or ''), '| token in localStorage:', 'github_pat_TEST' in await pg.evaluate("localStorage.getItem('strand.gh')"))
        await pg.screenshot(path='/tmp/gh1.png')
        await pg.click('#drawerClose'); await pg.wait_for_timeout(300)
        for h in ['sleep', 'water', 'bible']:
            await pg.click(f'.atom[data-habit="{h}"]'); await pg.wait_for_timeout(200)
        n = len(store['commits']); await pg.wait_for_timeout(6500)
        print('2 three taps -> commits added:', len(store['commits']) - n, '|', store['commits'][-1])
        n = len(store['commits']); await pg.reload(); await pg.wait_for_timeout(1500)
        print('3 reopen, nothing changed -> commits added:', len(store['commits']) - n, '| state', await pg.evaluate("Strand.gh.state"))
        # another device saves
        d = json.loads(store['text']); d['log'] = [e for e in d['log'] if e['habitId'] != 'bible']; d['ledger'] = [r for r in d['ledger'] if r.get('habitId') != 'bible']
        t = json.dumps(d, indent=2); store['text'] = t; store['sha'] = sha(t)
        await pg.evaluate("Strand.gh.lastCheck=0; window.dispatchEvent(new Event('focus'))"); await pg.wait_for_timeout(800)
        print('4 other device saved -> picked up on focus:', await pg.evaluate("!Strand.state.data.log.some(e=>e.habitId==='bible'&&e.date===Strand.state.today)"))
        # conflict
        await pg.click('.atom[data-habit="vitamins"]'); await pg.wait_for_timeout(200)
        d['meta']['updatedAt'] = '2026-11-15T23:00:00Z'; t = json.dumps(d, indent=2); store['text'] = t; store['sha'] = sha(t)
        await pg.wait_for_timeout(6500)
        print('5 both changed -> state', await pg.evaluate("Strand.gh.state"), '| modal:', await pg.evaluate("document.querySelector('#modal').classList.contains('on') && document.querySelector('#modal h3').textContent"))
        await pg.screenshot(path='/tmp/gh2.png')
        await pg.click("#modal button:has-text(\"Keep this device\")"); await pg.wait_for_timeout(900)
        print('  kept this device -> state', await pg.evaluate("Strand.gh.state"), '| remote has vitamins today:', '"vitamins"' in store['text'])
        # expired token
        store['token_ok'] = False
        await pg.click('.atom[data-habit="fasting"]'); await pg.wait_for_timeout(6500)
        print('6 expired token -> state', await pg.evaluate("Strand.gh.state"), '|', await pg.evaluate("Strand.gh.err"), '| still dirty:', await pg.evaluate("Strand.gh.dirty()"))
        await pg.click('.nav [data-open="data"]'); await pg.wait_for_timeout(300); await pg.screenshot(path='/tmp/gh3.png')
        store['token_ok'] = True
        await pg.click('[data-act="ghSave"]'); await pg.wait_for_timeout(800)
        print('  token works again -> state', await pg.evaluate("Strand.gh.state"), '| dirty', await pg.evaluate("Strand.gh.dirty()"))
        # public repo warning on a fresh device
        pg2 = await ctx.new_page(); await pg2.goto(url); await pg2.wait_for_timeout(500)
        await pg2.evaluate("Strand.gh.disconnect()"); store['private'] = False
        await pg2.click('.nav [data-open="data"]'); await pg2.fill('#ghOwner', 'example'); await pg2.fill('#ghToken', 'x'); await pg2.click('[data-act="ghConnect"]'); await pg2.wait_for_timeout(600)
        print('7 public repo -> warning:', await pg2.evaluate("document.querySelector('#modal h3').textContent"))
        print('commits:', len(store['commits'])); print('errors', errs[:5]); await b.close()
asyncio.run(main())
