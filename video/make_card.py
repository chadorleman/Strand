"""Render a compound card (PNG, 1000x1400) from a media request.

    python3 video/make_card.py path/to/media-request.json [out.png]

Default output is the request's deliver.saveAs, relative to the repo root.
"""
import sys, asyncio, pathlib, base64, json
from playwright.async_api import async_playwright

here = pathlib.Path(__file__).parent
req_path = pathlib.Path(sys.argv[1])
req = req_path.read_text()
r = json.loads(req)
if r.get('milestone', {}).get('kind') != 'compound':
    raise SystemExit('not a compound request')
out = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else here.parent / r['deliver']['saveAs']
html = (here / 'card.html').read_text().replace('/*HELIX*/', (here.parent / 'src' / 'helix.js').read_text()).replace('/*REQ*/', req)
page_path = here / '_card_built.html'
page_path.write_text(html)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1000, 'height': 1400})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + str(page_path.resolve()))
        await pg.evaluate("Promise.all([document.fonts.load('700 100px \"Inter Display\"'), document.fonts.load('500 30px \"Inter Display\"')])")
        d = await pg.evaluate("()=>{render();return document.getElementById('c').toDataURL('image/png')}")
        await b.close()
    if errs:
        raise SystemExit('page errors: ' + '; '.join(errs[:5]))
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(base64.b64decode(d.split(',')[1]))
    print('wrote', out)
    page_path.unlink()

asyncio.run(main())
