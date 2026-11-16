# Handoff log

Newest entry first. Each session adds one entry: what changed, why, what is untested, what is next.

## Next

- **Owner setup (not code):** create the private `strand-data` repo and token, connect from the iPhone home-screen app, import the real data from the npoint link (Data → Import a backup from a link), then delete the npoint bin (it is publicly readable).
- Check the walkthrough with a real voice (Edge "Natural" voices); fix any mispronounced words in `Guide.script()`.
- Phone strand view: the field is mostly empty space at 390 px; consider a lower default zoom on phones.
- Ideas raised but not started: an MP3 version of the walkthrough; opt-in weekly challenges; placeable bonus drops; the `nutrition` module (calories and macros, same data file and points ledger).
- A leftover `add-source` branch exists on GitHub; it can be deleted from pull request #1.

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
