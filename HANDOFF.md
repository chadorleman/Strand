# Handoff log

Newest entry first. Each session adds one entry: what changed, why, what is untested, what is next.

## Next

- **Owner setup (not code):** create the private `strand-data` repo and token, connect from the iPhone home-screen app, import the real data from the npoint link (Data → Import a backup from a link), then delete the npoint bin (it is publicly readable).
- Listen through the walkthrough once on the phone; if a caption changes early or late, adjust that line's `at` time in `GUIDE_CHAPTERS`.
- Phone strand view: the field is mostly empty space at 390 px; consider a lower default zoom on phones.
- **Build weekly challenges and bonus drops** from the design in the 2026-11-15 entry below (engine work: Opus or Fable). Suggested split: session 1 drops, session 2 challenges and stakes.
- Listen through walkthrough chapters 02, 03, 04, 05 and 07 once on the phone; if a caption changes early or late, adjust that line's `at` time in `GUIDE_CHAPTERS`.
- **Career and Financial on the strand:** the helix draws health on one strand and everything else on the other (`s.cat === 'health'` in `src/helix.js`), so Career and Financial base pairs would sit with Spiritual. Decide how they should look before adding the first habit in those domains.
- The "Early prep" challenge in the 2026-11-15 spec now means both midweek steps.
- No UI yet to add a habit; adding one means a code change with `addedOn`. Worth building once the domains fill up.
- Idea raised but not started: the `nutrition` module (calories and macros, same data file and points ledger).
- A leftover `add-source` branch exists on GitHub; it can be deleted from pull request #1.

## 2026-11-16: re-recorded walkthrough chapters 02, 03, 04, 05, 07 (v1.4)

**Changed:** new Muse recordings for the five chapters rewritten in v1.2 and v1.3 (`media/guide-0N.mp3`), and their `lines` and `at` times in `GUIDE_CHAPTERS`. Line starts were found by matching every sentence break to a pause in the audio (ffmpeg silencedetect, -38 dB, 0.25 s) with a pace-based estimate, and taking the end of the pause before each line. Note: the owner's first upload was the old files byte for byte; check new recordings differ from `media/` before using them.

**Tested:** all five load in Chrome with the new lengths (62.4, 58.0, 55.6, 65.1, 76.9 s). **Untested:** caption timing by ear.

## 2026-11-16: whole-day fast, walk, two-step prep (v1.3)

**Changed (engine):** new `occasional` cadence for the **whole-day fast** (Health, weight 25): never in a daily total or the molecule, never a miss; pay is 25 × 1.2^(days in a row before it), so 25, 30, 36, 43, 52…, with no thinning (bonus odds at the base 10%). A break resets to 25. Each entry records `runDay`. It counts toward a solid day (25 of 62 weight is one on its own). **Walk** (Health daily, 5) carries `repairAction: 'walk'`: on a given day it pays as the habit or seals an alcohol repair with the walk action, never both (`checkIn` and `repair` each refuse the second). **Prep steps:** `midweek1` 7, `midweek2` 8, `watchtower1` 7, `watchtower2` 8, weekly, once each; `stepOf` lets the old single habit's entries count toward each step's streak, so thinning tiers carry on. `checkIn` now refuses a habit on a day it was not active.

**Migration (`meta.habitSet` 2):** an old file gains the six habits with `addedOn` 2026-11-16 and the single-step prep habits are archived with `archivedOn` 2026-11-16 (one already archived by the owner stays archived for all time). Every past day reads exactly as before (tested). New files track all habits from day one; Health daily weight is now 49 (70% = 34.3) and the day total 62.

**Screens:** fast tile shows the next day's pay and "day N" in a run; walk tile says "sealed a repair today" when used; the walk repair chip is disabled once the walk habit is in for the day. Settings: the fast growth rate. Walkthrough chapters 02, 03 and 07 rewritten (with 04 and 05 from the last entry).

**Tested:** 97 engine tests, 0 failed. Screenshots at 1440×900 and 390×844. **Untested:** the real file's migration through GitHub sync; iPhone. On the phone, Health now wraps to a second row of atoms.

## 2026-11-16: domains, weight-based molecules, dated rules (v1.2)

**Changed (engine):** a stable molecule is now Health and Spiritual each reaching 70% of the set weight of their daily habits active that day (not all of them, and not paid points, so thinning and bonuses don't move it). Financial and Career never gate it. A solid day is all positive check-ins (weekly and every domain included) reaching 40% of the day's total daily weight. Habits carry `addedOn` / `archivedOn` and each day is judged only by habits active then; archiving in Settings now stamps `archivedOn`. Undo keeps a day's molecule if the day is still stable without that entry (the row moves to another entry that day).

**Migration:** a file without `settings.rulesSince` gets `2026-11-16` and its old numbers in `legacyRules`; days before that keep the all-dailies molecule and the 4-check-in solid day, so no past halo, bonded week or milestone changes. Compound thresholds raised 3/10/25 → 5/15/40 (Glycine, Adenine, Serotonin) only where they matched the old defaults; compounds already reached stay. Settings reset keeps `rulesSince` and `legacyRules`. New files and sample data use the new rules everywhere.

**Screens:** domain headers show weight toward the molecule ("24 of 31 weight") or "extra points" for Financial/Career; the molecule ring shows only gating habits; the card says which domain is short; the week card describes the 40% rule (or the old count for weeks before the ship date). Settings: Health and Spiritual shares and the solid-day share replace the two old rows. Walkthrough script chapters 04 and 05 rewritten; audio not re-recorded yet.

**Tested:** 77 engine tests, 0 failed (new: weight not pay, Financial never gates, weekly counts for solid not molecule, added and archived habits leave the past alone, migration keeps old days on old rules and is idempotent, undo keeps or drops the molecule correctly). Screenshots at 1440×900 and 390×844 with the sample. **Untested:** the real data file through GitHub sync (the migration runs on first open; whichever device opens first saves it); the iPhone app itself.

## 2026-11-16: design for domains, percentage molecules and split prep steps (no code)

Brainstorm with the owner; nothing built. This is the spec for the build sessions. Every number below is a proposed default and belongs in `DEFAULT_SETTINGS`.

**Why:** Strand is meant to help keep commitments that are at risk of being dropped, and a stable molecule should mean "the core done well", not "a perfect day". The owner wants to keep adding habits, so no rule may drift easier or harder just because the habit list grew.

**Owner decisions**
- **Four fixed domains** (the existing `category` field): `spiritual`, `health`, `career`, `financial`. Habits can be added freely as long as each belongs to one of these. Financial will tie to the planned budgeting and spend-tracker tool.
- **Molecule by weight percentage per domain**, not all-of and not by count. No anchor (must-do) habits for now.
- **Only Health and Spiritual decide the molecule.** Financial and Career habits pay points but are optional for the molecule.
- **No weekly molecule** (considered and dropped).
- **Stable week, option C:** a solid day is a share of the day's weight, not a flat check-in count.
- **Walk:** a walk counts as the habit or as the alcohol repair action, never both.
- **Midweek prep and Watchtower prep split into two steps each** (7 + 8 = 15). Old single entries count as both steps done.
- **New Health habits:** a fast separate from intermittent fasting, and a walk.

### 1. Habit dating (build first)
- Today `isStable` runs the *current* habit list over *every past day*, so adding a daily habit would turn old stable days unstable (halos vanish, compound progress drops). That breaks "the strand is the log".
- Each habit gets `addedOn` (date) and `archivedOn` (date or null). A day is judged only by habits active that day (`addedOn <= date`, not archived before it). Migration through `mergeMissing`: existing habits get `addedOn` = the earliest date in the data file (or today on an empty file).
- **Rule dating:** the molecule and solid-day rules below apply from the date they ship (stored setting, e.g. `rulesSince`); earlier days keep the old rules (all dailies per category; 4 check-ins per solid day), so no compound or bonded week appears or disappears in the past. Same principle as genes: a change never rewrites the past.

### 2. Daily molecule
- Setting: `molecule: { health: 0.70, spiritual: 0.70 }` (replaces `stableDay.fractionPerCategory`). A domain left out of the block does not gate the molecule.
- A day is stable when, for each listed domain, the **set weight** of positive daily habits done ≥ the percentage × the total set weight of positive daily habits active that day in that domain.
- Use each habit's set `weight`, never the points actually paid (thinning lowers pay as streaks mature, and bonuses are random; a paid-points threshold would get harder with success and depend on luck).
- Weekly habits do not count toward the molecule.
- Example (current Health dailies, total 44 at 70% = 30.8): missing fasting still passes (34); skipping sleep and fasting while doing the four light habits fails (24).
- Small domains are brittle: Spiritual has two dailies (5 + 8), so 70% means both. Adding a third daily (for example prayer) gives it room to flex.

### 3. Solid day and stable week (option C)
- Setting: `stableWeek: { solidDayWeightPct: 0.40, minSolidDays: 5 }` (replaces `solidDayMinCheckins` for days after `rulesSince`).
- A day is solid when the set weight of **all positive check-ins** that day (daily and weekly, every domain, Financial and Career included) ≥ 40% of the total set weight of daily positive habits active that day (every domain).
- Keeps two levels of difficulty (solid day = showed up; molecule = core done well) and stops the drift where each new habit made a flat 4 check-ins easier. Gives weekly, Financial and Career check-ins a structural role.
- Bonding and shields are unchanged: a week with 5 solid days closes stable.

### 4. Split prep steps
- `midweek` (15) → two weekly habits, step 1 (7) and step 2 (8); `watchtower` (15) the same. Deck shows 0 of 2, 1 of 2, 2 of 2 for the week. Each step keeps its own streak.
- Old `midweek` / `watchtower` entries count as both steps done for weekly progress and streaks; already-paid ledger rows are not touched. The old habits are archived with `archivedOn` = ship date.
- The "Early prep" challenge in the 2026-11-15 spec should read both midweek steps.

### 5. New habits and walk-or-repair
- Walk: Health, daily, proposed weight 5.
- Separate fast: Health; cadence and weight still to settle with the owner (daily or a weekly longer fast).
- Walk-or-repair: one walk per day. Whichever is logged first claims it; the other option shows as used that day. Undo frees it. No double pay.

### Knock-on effects to check
- 70% makes molecules easier than all-of, so the stable-day compounds (Glycine 3, Adenine 10, Serotonin 25) and the Stable core gene come faster. Consider raising those thresholds when this ships.
- Points per day rise as habits are added, so stages come faster. Watch it; stage thresholds live in `DEFAULT_SETTINGS`.
- Ideas raised but not decided: daily prayer and JW.org videos (Spiritual), budgeting habits (Financial), career lead actions as weekly habits (Career). A concern was raised that scoring prayer (bonuses, thinning) may pull against its purpose; one option is low or zero weight with no bonus rolls.

### Data and tests
- New fields with safe defaults through `mergeMissing`; a `SCHEMA` bump only if the prep-step migration needs one.
- Tests to add: adding a daily habit leaves past stable days stable; archiving keeps past days unchanged; days before `rulesSince` use the old rules; molecule uses set weight not paid points; Financial/Career never gate the molecule; weekly habits don't count toward the molecule but do count toward a solid day; old prep entries count as both steps; walk cannot pay as habit and repair the same day; export/import still round-trips.
- Walkthrough: molecule and stable-week chapters need a script change and re-recording (see `CLAUDE.md`).

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
