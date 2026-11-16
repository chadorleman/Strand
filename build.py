import pathlib, datetime, hashlib, json
root = pathlib.Path(__file__).parent
src = root / 'src'
r = lambda n: (src / n).read_text()
# Version: "major.build". The owner raises `major` in VERSION by hand for big releases.
# `build` rises by one whenever the contents of src/ change; rebuilding unchanged source keeps it.
h = hashlib.sha256()
for p in sorted(src.iterdir()):
    if p.is_file():
        h.update(p.name.encode()); h.update(p.read_bytes())
fp = h.hexdigest()[:12]
vf = root / 'VERSION'
try:
    ver = json.loads(vf.read_text())
except Exception:
    ver = {'major': 1, 'build': 0, 'hash': '', 'date': ''}
if ver.get('hash') != fp:
    ver['build'] = int(ver.get('build', 0)) + 1
    ver['hash'] = fp
    ver['date'] = datetime.date.today().isoformat()
    vf.write_text(json.dumps(ver, indent=2) + '\n')
version = f"{ver['major']}.{ver['build']}"
vjs = json.dumps({'version': version, 'major': ver['major'], 'build': ver['build'], 'date': ver['date']})
(root / 'version.json').write_text(vjs + '\n')

header = '''<!--
  STRAND  ·  a personal habit tracker played as a growing DNA strand
  One standalone file. No server, no build step. Open it in Chrome or Edge.

  WHERE THE DATA LIVES
    Data > "Sync to GitHub" saves strand-data.json to a private repo through the
    GitHub API, with a fine-grained token kept in this browser only. Every save is
    a commit. This is the way to use Strand on more than one device.
    Data > "Link my Strand folder" picks a folder. Strand then reads and writes
    strand-data.json in that folder after every change. Until a folder is linked,
    data is kept in this browser's storage. Data > Export / Import is the backup.

  ENTRY IMPORT FORMAT  (Data > Import entries)
    { "strandImport": 1,
      "entries": [
        { "importId": "2026-11-15-a", "date": "2026-11-15", "habit": "water" },
        { "importId": "2026-11-14-c", "date": "2026-11-14", "habit": "alcohol", "amount": 2, "note": "optional" }
      ] }
    importId  unique text per entry; an ID already merged is skipped
    date      YYYY-MM-DD, the day it happened
    habit     sleep, water, fasting, pushups, gym, mindfulness, vitamins, alcohol,
              dailyText, bible, study, midweek, watchtower
    amount    alcohol only: number of drinks

  MEDIA IMPORT FORMAT  (Vault)
    Put files in a folder named "media" beside this page (inside the linked folder).
    File name = milestone ID:   media/stage-protocell.mp4    media/compound-glycine.png
    Films: .mp4 (H.264) or .webm     Cards: .png .jpg .webp
    A slot's "Copy media request" gives the JSON Claude needs to render the art.

  EVERY TUNABLE NUMBER is in one block: search this file for "SETTINGS BLOCK",
  or use the Settings panel in the tool.

  GENES: every week that closes stable earns one permanent pick from three offered
  traits. Picks are stored under "traits" in the data file; the catalogue is in the
  settings block.

  WALKTHROUGH: the Walkthrough button plays a spoken guide using the browser's own
  voices (Edge's "Natural" voices sound best). Its script reads the live settings.

  FUTURE MODULES: the data file has a "modules" block, and every log entry and
  ledger row carries a "module" name. "nutrition" is reserved and not built.
-->
'''
html = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Strand</title>
{header}<style>
{r('style.css')}</style>
</head>
<body>
{r('body.html')}
<script>
window.STRAND_VERSION = {vjs};
</script>
<script>
{r('engine.js')}
</script>
<script>
{r('helix.js')}
</script>
<script>
{r('app.js')}
</script>
</body>
</html>
'''
out = pathlib.Path(__file__).parent / 'index.html'
out.write_text(html)
print('built', out, len(html)//1024, 'KB', 'version', version)
