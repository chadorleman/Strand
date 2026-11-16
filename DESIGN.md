# Strand visual language

Keep additions consistent with this. Values live in `:root` in `src/style.css` and in `C` in `src/helix.js`.

## Colour, and what each colour means

| Name | Hex | Means |
|---|---|---|
| abyss | `#04121a` | Background: deep water, lit by soft teal and violet glows. |
| aqua | `#58efc9` | The health strand and health habits; primary buttons; "today". |
| amber | `#ffbe55` | The spiritual strand and spiritual habits. |
| gold | `#ffe9a6` | Rewards: bonuses, stable molecules, repairs, genes, stage changes. |
| lesion | `#ff4d78` | Damage: negative entries, clawback, errors. Only for these. |
| frost | `#a8dcff` | Shields. |
| bond | `#c9b8ff` | Bonded (permanent) points and the bonded week line. |
| ink | `#e6f3f1` | Text. Dimmer text is `#8fb2b7`, faintest `#5e8188`. |

Each habit also has its own hue (`hue` in `DEFAULT_HABITS`) for its atom and its rung.

## Type

- Display and numbers: Bahnschrift (falls back to Segoe UI, then the system font on iPhone), with tabular figures.
- Body: Segoe UI / system UI.
- Sentence case everywhere. No all-caps labels, no tracked-out eyebrow text.

## The strand: every mark is data

| Mark | Meaning |
|---|---|
| A rung with a coloured atom | One positive log entry. Health atoms on the aqua strand, spiritual on the amber. |
| Ring, hexagon or star around an atom | Crit, vesicle, rare isotope bonus. |
| Red broken rung, cut backbone, X | Damaged pair (unrepaired negative). |
| Gold rung, diamond, seam lines | Repaired pair. It stays visible as a repair. |
| Pale blue hexagon on an empty stretch | A day covered by a shield. |
| Dotted, faded stretch with a dashed circle | A gap: missed day, no shield. |
| Gold halo and hexagon above a day | Stable molecule. |
| Arc over rungs | A routine bond. |
| Solid violet line under days / dashed line | Bonded weeks / still loose. |
| Dotted rungs at the tip | Today's open sites. |

Never add decoration to the strand that could be read as data.

## Motion

- Every check-in answers within a second: tone, atom flies to its rung, points float up, the helix ripples.
- One big moment per milestone. Small stage changes get a brief non-blocking banner; phase changes and film stages take the full screen.
- No idle animation beyond the slow helix rotation and drifting motes. Respect `prefers-reduced-motion`.

## Layout

- Desktop: header, strand field, then the check-in deck with a side panel (repair bay, genes, molecule, week, genome).
- iPhone (390 px): everything stacks; the page must never be wider than the screen; drawers take the full width. Test at 390×844.
- Panels open as a drawer from the right; the walkthrough is a dock that moves away from what it highlights.

## Words

Plain verbs, active voice, sentence case. A button says what happens ("Log it honestly", "Express this gene", "Seal the repair"), and the confirmation uses the same verb. Errors say what happened and how to fix it, without apologising. Negatives are described without judgement.
