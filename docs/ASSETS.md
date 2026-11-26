# Character assets

`public/assets/maple-ryan.png` is Ryan’s supplied Maple Ryan pet atlas, preserved in its original 1536×2288 layout (8 columns, 11 rows, 192×208 cells).

`public/assets/manager-ryan-sheet.png` is the matching Manager Ryan costume atlas, created with the built-in OpenAI image generation edit tool on 26 November 2026. The original atlas was the sole edit reference. The generated alpha PNG was normalized with nearest-neighbor sampling to the same 1536×2288 runtime grid. Both characters share one sprite renderer, identical frame dimensions, scale, timing and state-to-row mappings. No separate bobbing or stretched manager image is used.

## Animation layout

| Row | Animation | Frames |
| --- | --- | --- |
| 0 | Idle / blink | 6 |
| 1 | Walk right | 8 |
| 2 | Walk left | 8 |
| 3 | Wave | 4 |
| 4 | Jump / celebrate | 5 |
| 5 | Error | 8 |
| 6 | Waiting / attention | 6 |
| 7 | Working | 6 |
| 8 | Review | 6 |
| 9 | Look up | 8 |
| 10 | Look down | 8 |

## Final generation prompt

Use case: precise-object-edit. Edit target: supplied transparent Maple Ryan animation sprite atlas. Create Manager Ryan's COMPLETE animation sprite sheet by changing ONLY the clothing in EVERY EXISTING FRAME: black suit jacket and black trousers, WHITE POLO with a small open polo collar underneath, black shoes. Preserve the original character's EXACT head/body/limb proportions, face identity, hair, skin, expressions, pose sequence, pixel style, outline, positioning and size in EVERY frame. Do not make him taller or thinner. Do not make a new standalone character. This is a registered costume-swap atlas for a game: exact same canvas 1536 x 2288 pixels, exact same 8 columns by 11 rows, 192 x 208 pixel cell grid with no gaps. Preserve every original blank transparent cell and unused column. Preserve original transparent padding in each cell and all motion/effects. Rows in order: 0 idle/blink 6 frames; 1 walk right 8; 2 walk left 8; 3 wave 4; 4 jump/celebrate 5; 5 error 8; 6 waiting 6; 7 active working 6; 8 review 6; 9 look upward 8; 10 look downward 8. The source is the layout master: do not reorder, add, drop or shift frames. True alpha transparent background. No text, no grid lines, no extra props, no shadows outside sprites. Modify clothing colors and polo only; everything else must remain registered to source.

The office is original SVG art. The look references side-view platformers and a warm Singapore office, without importing commercial game assets.
