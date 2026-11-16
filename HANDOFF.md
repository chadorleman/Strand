# Handoff log

Newest entry first. Each session adds one entry: what changed, why, what is untested, what is next.

## Next

- **Owner setup (not code):** create the private `strand-data` repo and token, connect from the iPhone home-screen app, import the real data from the npoint link (Data → Import a backup from a link), then delete the npoint bin (it is publicly readable).
- Listen through the walkthrough once on the phone; if a caption changes early or late, adjust that line's `at` time in `GUIDE_CHAPTERS`.
- Phone strand view: the field is mostly empty space at 390 px; consider a lower default zoom on phones.
- Ideas raised but not started: opt-in weekly challenges; placeable bonus drops; the `nutrition` module (calories and macros, same data file and points ledger).
- A leftover `add-source` branch exists on GitHub; it can be deleted from pull request #1.

## 2026-11-15: walkthrough plays recorded MP3s

**Changed:** the walkthrough now plays nine recorded chapters (`media/guide-01.mp3` to `guide-09.mp3`, voiced by Muse) in place of the browser voices. The voice picker is gone. Play, pause (resumes where it stopped), previous and next, the chapter list and speed (0.85× to 1.3×) all still work. Captions and the spotlight follow the audio using line start times in `GUIDE_CHAPTERS` (`src/app.js`). The narration text is kept in `video/guide-script.md` for re-recording.

**Script fixes made for the recording:** "Your data" chapter rewritten for GitHub sync (it described folder linking); the garbled undo line fixed; the closing line no longer claims the walkthrough reads live settings.

**Decision:** always play the MP3s, even if Settings differ from the defaults they state (owner's choice). `CLAUDE.md` updated.

**Untested:** line start times were estimated from the text length and snapped to pauses in the audio, not checked by ear. Real iPhone Safari playback, and seeking within a chapter, were not tested (the local test server has no range requests; GitHub Pages does).

## 2026-11-15: first build through to GitHub

**Built** the whole app from the spec (`habit-game-fable-prompt-2026-11-15.md`): rules engine, strand renderer, check-in deck, repair bay, vault, ledger, settings, data panel, sample data, first stage film (`media/stage-protocell.mp4`).

**Added after the first build**
- Genes: one permanent pick from three per stable week.
- Spoken walkthrough using the browser's voices, numbers read from live settings.
- GitHub sync to a private data repo (token in browser storage only, each save a commit, conflicts ask which version to keep). npoint rejected: public read, writes need premium.
- Import a backup from a link; phone layout fixes; Safari message fixed.
- Source, tests and film pipeline moved into this repo; `CLAUDE.md`, `WORKFLOW.md`, `DESIGN.md`, this file.

**Decisions:** films only at the five big stages; stages never demote; no gene may soften the alcohol clawback; commit straight to `main`; in coding sessions the scope approval is the checkpoint (no separate clarifying question).

**Untested:** real Safari on iPhone; GitHub sync against the real account (tested only against a mocked API); folder linking on Windows; sound and real speech voices.
