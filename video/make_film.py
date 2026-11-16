import sys, asyncio, pathlib, base64, subprocess, json, os
from playwright.async_api import async_playwright
here = pathlib.Path(__file__).parent
req = (here / (sys.argv[2] if len(sys.argv) > 2 else 'media-request-stage-protocell.json')).read_text()
html = (here / 'film.html').read_text().replace('/*HELIX*/', (here.parent / 'src' / 'helix.js').read_text()).replace('/*REQ*/', req)
page_path = here / '_film_built.html'; page_path.write_text(html)
mode = sys.argv[1] if len(sys.argv) > 1 else 'stills'
FPS = 30
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1280, 'height': 720})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + str(page_path.resolve())); await pg.wait_for_timeout(400)
        await pg.evaluate("document.fonts.load('600 40px \"Inter Display\"')")
        info = await pg.evaluate('filmEvents()')
        (here / 'events.json').write_text(json.dumps(info))
        async def grab(t):
            d = await pg.evaluate("(t)=>{renderFrame(t);return document.getElementById('c').toDataURL('image/jpeg',0.92)}", t)
            return base64.b64decode(d.split(',')[1])
        if mode == 'stills':
            for t in [float(x) for x in sys.argv[3:]] or [1.2, 5.0, 8.9, 10.4, 12.2, 15.5]:
                (here / f'still_{t:05.2f}.jpg').write_bytes(await grab(t)); print('still', t)
        else:
            TA, TB, TC, TD = info['TA'], info['TB'], info['TC'], info['TD']
            scenes = [('a', 0, TA), ('b', TA, TA + TB), ('c', TA + TB, TA + TB + TC), ('d', TA + TB + TC, info['total'])]
            for name, t0, t1 in scenes:
                tmp = here / f'scene_{name}.tmp.mp4'; out = here / f'scene_{name}.mp4'
                ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', str(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-r', str(FPS), '-video_track_timescale', '15360', str(tmp)], stdin=subprocess.PIPE)
                n0, n1 = round(t0 * FPS), round(t1 * FPS)
                for n in range(n0, n1): ff.stdin.write(await grab(n / FPS))
                ff.stdin.close(); rc = ff.wait()
                if rc != 0: raise SystemExit('ffmpeg failed on scene ' + name)
                os.replace(tmp, out); print('scene', name, n1 - n0, 'frames')
        print('errors', errs[:5]); await b.close()
asyncio.run(main())
