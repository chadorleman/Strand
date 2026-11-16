# Handoff log

Newest entry first. Each session adds one entry: what changed, why, what is untested, what is next.

## Next

- **Owner setup (not code):** create the private `strand-data` repo and token, connect from the iPhone home-screen app, import the real data from the npoint link (Data → Import a backup from a link), then delete the npoint bin (it is publicly readable).
- Listen through the walkthrough once on the phone; if a caption changes early or late, adjust that line's `at` time in `GUIDE_CHAPTERS`.
- Phone strand view: the field is mostly empty space at 390 px; consider a lower default zoom on phones.
- **Build weekly challenges and bonus drops** from the design in the 2026-11-15 entry below (engine work: Opus or Fable). Suggested split: session 1 drops, session 2 challenges and stakes.
- Idea raised but not started: the `nutrition` module (calories and macros, same data file and points ledger).
- A leftover `add-source` branch exists on GitHub; it can be deleted from pull request #1.

## 2026-11-15: version numbering

**Changed:** builds are numbered `major.build` (first build `1.1`). `build.py` fingerprints `src/` and raises `build` only when the source changed, so rebuilding for a test does not use a number. It writes `VERSION` and `version.json` and puts the version in the page. The version shows under the Strand name (top bar) and at the foot of the Data panel with the build date. On open and on returning to the app, the page fetches `version.json` uncached; if the live build is newer, a sticky gold "Version X is live. Reload." toast appears and Reload reloads with a cache-busting address.

**Use:** if the number on the phone matches the one in the last commit message or `VERSION`, the phone has the latest build. Raise `major` by hand in `VERSION` (and set `build` to 0) for big releases, such as challenges and drops.

**Also:** weekly challenges and drops spec updated: stake cap is 50% of loose points.

**Tested:** engine tests (60 passed); in Chrome at 390 px, the tag shows, the Data panel line shows, a newer `version.json` produces the toast and Reload navigates with `?v=`. **Untested:** the iPhone home-screen app itself (whether iOS reuses its saved page after Reload), and `window.location.replace` inside standalone mode.

## 2026-11-15: design for weekly challenges and bonus drops (no code)

Brainstorm with the owner; nothing built. This is the spec for the build sessions. Every number below is a proposed default and belongs in `DEFAULT_SETTINGS`.

**Owner decisions**
- Drops are placed **on a habit**.
- Challenges are opt-in, with a **stake option**.
- **Shielded days do not count** toward a challenge. A shield protects the chain, not the challenge.
- **Alcohol clawback can reach staked points** in escrow (owner's choice, revised the same evening; first answer was "protected"). The behavior costs, including what is staked.
- **Flat drop value** (owner's choice): a drop pays the same points whatever the habit's weight.

**Hard rule:** no challenge may read negative entries. A challenge counts positive check-ins only, so logging a negative honestly can never cost a challenge (same reasoning as "no gene may soften the alcohol clawback").

### Bonus drops
- Held drops: at most 2. Placed on a positive habit's card in the check-in deck, one per habit, never on a negative habit. No expiry (no passive decay).
- The bonus type (crit, vesicle, rare isotope) is **rolled and sealed when the drop is placed**, stored with the drop like `data.rolls`. You choose the target, not the prize.
- The next check-in of that habit pays the sealed bonus. The habit's normal bonus roll still happens, so a double bonus is possible.
- Undo of that check-in returns the drop to the card with the same sealed roll.
- Shown as a gold capsule on the habit card, never on the strand (the strand is the log). On check-in it becomes that rung's bonus mark.
- Drop pay goes to loose points. **Flat value per bonus type** (one setting each for crit, vesicle, rare isotope), not a multiple of the habit's weight, so drops are placed to steer behavior rather than always on the 20-weight weekly habits.

### Weekly challenges
- Offered when a week opens (Monday; the week closes after Sunday). Offer of 3, seeded by the week's date like genes. Skipping is free. Opt-in only on the first day of the week.
- Candidate challenges: Weak link (lowest-rate daily habit over the last 4 weeks, 6 of 7 days); Double helix (both stacks bonded the same day, 4 times); Molecule run (3 stable molecules); Over target (gym 3 times); Early prep (midweek prep and personal study before the midweek meeting); Unbroken (no gaps, no shield spent).
- **Win instantly** when the target is hit (full feedback, drop lands then). **Lose** at week close or when the target becomes unreachable. Backfill can only help (positives only), never turn a win into a loss. Undo of a check-in that completed a challenge reverts the win.
- **Free:** small point reward and a standard drop.
- **Staked:** stake taken from loose points only (never bonded), held in escrow. Cap: 50% of loose points (owner's choice; the cap only limits risk now that clawback can reach escrow). Win: what is left of the escrow back plus a premium (around 1.5x what is left) and a drop with better odds of rarer types. Lose: the escrow is lost at week close.
- **Clawback and escrow:** escrow counts as loose points dated at opt-in, so the existing newest-first order takes the week's newer loose gains before it. The day cap and rolling-week cap still bound the total; escrow adds no extra loss beyond them. Clawback into escrow never fails the challenge (challenges ignore negatives); it only shrinks the payout. A repair re-earns into loose points, not back into escrow.

### Data
- New `challenges: []` and `drops: []` with safe defaults through `mergeMissing`; no `SCHEMA` bump needed. Ledger rows for stake, escrow release, payouts and drop bonuses carry `module`.
- Tests to add: sealed drop roll survives undo/redo; challenges ignore negatives; shielded days do not count; clawback reaches escrow only after newer loose gains and within the caps; payout uses what is left of the escrow; a clawed escrow does not fail the challenge; stake cap enforced; flat drop value ignores habit weight; backfill cannot flip a win to a loss; export/import still round-trips.
- Walkthrough: new rules need a script change and re-recording (see `CLAUDE.md`).

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
