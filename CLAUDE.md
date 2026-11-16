# Strand

A personal habit tracker played as a growing DNA strand, for one user (Chad).
Live at https://chadorleman.github.io/Strand/ (GitHub Pages serves `index.html` from `main`).

## Read these too

- `WORKFLOW.md`: how a coding session runs (scope approval first, model choice, build, test, commit, handoff).
- `HANDOFF.md`: what the last session did and what is next. Read its top entry before starting.
- `DESIGN.md`: colours, type, what every mark on the strand means, motion and phone rules.

## Layout

| Path | What it is |
|---|---|
| `index.html` | The shipped app. **Generated** by `build.py`. Never edit it by hand. |
| `src/engine.js` | Rules only, no DOM: settings block, data model, check-ins, bonuses, thinning, shields, clawback, repair, genes, stages, imports, media requests, sample data. |
| `src/helix.js` | Canvas renderer for the strand. Shared by the app and the film renderer. |
| `src/app.js` | Screen, sound, storage (browser, linked folder, GitHub sync), drawer panels, walkthrough. |
| `src/style.css`, `src/body.html` | Styles and markup. |
| `build.py` | Inlines `src/` into `index.html` with the header comment. Python 3 standard library only. |
| `test/engine.test.js` | Rule checks (`node test/engine.test.js`). Must stay at 0 failed. |
| `test/gh_flow.py` | GitHub sync against a mocked GitHub API (Playwright + Chrome). |
| `video/` | Film pipeline: `film.html` + `make_film.py` render a milestone film from a media request; `make_audio.py` builds its soundtrack. |
| `media/` | Milestone art served beside the page (`stage-<id>.mp4`, `compound-<id>.png`). |
| `examples/` | Example entry-import file. |

## Working on it

1. Edit files in `src/`.
2. `python3 build.py` to regenerate `index.html`.
3. `node test/engine.test.js` (and `python3 test/gh_flow.py` when storage or sync code changes).
4. Look at the page: screenshot it at desktop (1440×900, 1366×768) and phone (390×844) sizes. He uses it on an iPhone home-screen app and a Windows PC.
5. Commit `src/` changes and the rebuilt `index.html` together, **directly to `main`** (no branches or pull requests; the owner chose this). Pages publishes within a minute or two.

Keep it one self-contained file: no CDN, no framework, no build tooling beyond `build.py`.

## Settled design (from the original spec; do not change without asking)

- **The strand is the log.** One rung per log entry; days without entries are gaps or shielded days. Never draw structure the data does not contain. Films render the strand exactly as it stood at the milestone (`mediaRequest`).
- **Instant feedback** on every check-in, within a second: sound, animation, points, strand reacts. No reward delayed to a summary.
- **Variable bonuses** (crit, vesicle, rare isotope) the user cannot predict. A roll is stored per habit and day in `data.rolls`, so undo and redo cannot re-roll.
- **Thinning:** base pay drops and bonus odds rise as a streak matures.
- **Shields:** earned by stable weeks, spent automatically on a missed day.
- **The behavior costs; the honesty never does.** Logging a negative always pays the integrity reward, which can never be clawed back.
- **Clawback** takes loose gains, newest first, within a day cap and a rolling-week cap. Bonded gains (from weeks that closed stable) are never touched.
- **Repair** is open until the end of the day the negative was logged, re-earns a share of what was clawed, and leaves a visible repaired pair.
- **No passive decay.** Nothing changes because time passes.
- **Media is a rare, top-tier reward:** stage films at the five big stages only (Protocell, Eukaryote, Colony, Embryo, Organism), compound cards for eight milestone compounds.
- **Every tunable number lives in `DEFAULT_SETTINGS`** in `src/engine.js` and is editable in the Settings panel.

## Decisions made since the spec

- Stages never demote. Small stage changes show a non-blocking banner; phase changes and film stages take the full screen.
- **Genes:** each week that closes stable earns one permanent pick from three offered traits. Offers are seeded by the week's date. A gene works only from the day it is picked, so it never rewrites the past. No gene may soften the alcohol clawback (it would pay around the behavior, not through it).
- **Walkthrough:** spoken with the browser's own voices (Web Speech API). The script is generated from live settings, so its numbers stay true. Update the script in `Guide.script()` when rules change.
- **Storage:** primary is GitHub sync to a separate **private** repo (default `strand-data/strand-data.json`) via the Contents API with a fine-grained token. The token lives only in that browser's localStorage; never put it in the page, the data file, or this repo. Each save is a commit. A sha mismatch means another device saved: ask which version to keep, never overwrite silently. Folder linking (File System Access API) is an optional extra on desktop Chrome/Edge.
- npoint was rejected: public read, and API writes need a premium account.

## Data file rules

- `data.schema` is `SCHEMA` in `engine.js`. `normalize()` fills anything missing from older files (`mergeMissing`), so new fields must have safe defaults. Bump `SCHEMA` only with a migration.
- Every log entry and ledger row carries `module`. A `nutrition` module (calories and macros, sharing the same file and points ledger) is reserved and not built.
- Export, wipe, import must round-trip byte for byte (tested).
- `derived` is a read-only snapshot rebuilt on every save.

## Privacy

This repo and the site are public. No real personal data goes in it: sample data is fake and labeled (`buildSample`), and the real log lives only in the private data repo.

## Media requests

When a Vault slot unlocks, the user copies its media request JSON and gives it to Claude. Render films with `video/make_film.py` (H.264, 1280×720, 30 fps) and save as `media/<milestone id>.mp4`; cards as `media/<milestone id>.png`. Draw only what the request contains.
