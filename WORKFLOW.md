# How a Strand coding session runs

Adapted from the Crushr Ops workflow. The aim is one clean, finished change per session, with as little reading and as few tokens as possible.

## Steps

1. **One outcome per session.** If the request holds several, pick the first and list the rest in `HANDOFF.md` under Next.
2. **Read `HANDOFF.md` first** (top entry and Next), then only the parts of `src/` the change touches. Locate by search (`grep -n`), read windows, not whole files.
3. **Report the scope and wait for approval.** Say which files and functions change, what the user will see, any rule in `CLAUDE.md` it touches, and the model recommendation below. This approval is the checkpoint: no separate clarifying question is needed before it. Quick questions and lookups get a direct answer.
4. **Make the smallest safe change.** Edit `src/`, never `index.html` directly.
5. **Build and check:** `python3 build.py`, `node test/engine.test.js` (must be 0 failed), `python3 test/gh_flow.py` if storage or sync changed. Add a test when a rule changes.
6. **Look at it.** Screenshot at 1440×900 and 390×844 (iPhone). Fix what looks wrong before committing.
7. **Commit straight to `main`** with the rebuilt `index.html`. Pages publishes in a minute or two.
8. **Write the handoff:** a new entry at the top of `HANDOFF.md` (what changed, why, what is untested, what is next).

## Model choice

Recommend a model at the scope step. Choose the least capable one that will do the job with no real loss in accuracy.

| Use | For |
|---|---|
| **Haiku** | Wording and copy, changing a number in the settings block, a single style fix, updating `HANDOFF.md`. |
| **Sonnet** | Most feature work in the screens and panels: new panel sections, layout, new UI states, walkthrough script edits. |
| **Opus or Fable** | Anything in the rules engine (`src/engine.js`), the strand renderer (`src/helix.js`), GitHub sync or data migration, and rendering milestone films or cards. A quiet mistake there corrupts data or draws a strand that does not match the log. |

If a session started on a smaller model reaches one of those areas, stop and say so before editing.

## Never

- Commit real personal data, a token, or a `strand-data.json` to this public repo.
- Change a rule listed under "Settled design" in `CLAUDE.md` without the user asking.
- Draw anything on the strand, or in a film or card, that the log does not contain.
