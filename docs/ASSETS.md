# Character assets

`public/assets/maple-ryan.png` is Ryan’s supplied Maple Ryan pet atlas, preserved in its original 1536×2288 layout (8 columns, 11 rows, 192×208 cells).

`public/assets/manager-ryan-sheet.png` is the matching Manager Ryan costume atlas, created with the built-in OpenAI image generation edit tool on 26 November 2026. The original atlas was the sole edit reference. The generated alpha PNG was normalized with nearest-neighbor sampling to the same 1536×2288 runtime grid. Both characters share one sprite renderer, identical frame dimensions, scale, timing and state-to-row mappings. No separate bobbing or stretched manager image is used.

`public/assets/designer-ryan.png` is Designer Ryan’s costume atlas, created with the built-in OpenAI image generation edit tool on 26 November 2026. The clean original Maple Ryan atlas was the sole reference for the final edit: dark round glasses, a brown open overshirt, an ivory tee, charcoal trousers, and dark shoes. The selected generated source is `exec-37649921-5f40-424a-a5ac-26dfc48f7c67.png`. Earlier cleanup variants were discarded because the final edit matched the original poses and proportions more closely when composited against the office background.

The 73 generated frames were registered independently with Sharp to the original atlas: nearest-neighbor scaling to each original frame’s visible height, matching its top edge and horizontal center within half a pixel. Visible height differs by at most one pixel after resampling. The resulting PNG is 1536×2288 RGBA, with 192×208 cells and 15 fully transparent unused cells. No frame overflow, missing frames, or opaque red/green edge artifacts were found. The generated RGBA is retained within the registered frame crops; near-transparent RGB edge pixels were not repainted or recolored. Composite previews on the office background showed no visible colored fringe. Designer Ryan uses the same renderer, animation timing, frame counts, and state mapping as the other Ryans.

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

## Manager generation prompt

Use case: precise-object-edit. Edit target: supplied transparent Maple Ryan animation sprite atlas. Create Manager Ryan's COMPLETE animation sprite sheet by changing ONLY the clothing in EVERY EXISTING FRAME: black suit jacket and black trousers, WHITE POLO with a small open polo collar underneath, black shoes. Preserve the original character's EXACT head/body/limb proportions, face identity, hair, skin, expressions, pose sequence, pixel style, outline, positioning and size in EVERY frame. Do not make him taller or thinner. Do not make a new standalone character. This is a registered costume-swap atlas for a game: exact same canvas 1536 x 2288 pixels, exact same 8 columns by 11 rows, 192 x 208 pixel cell grid with no gaps. Preserve every original blank transparent cell and unused column. Preserve original transparent padding in each cell and all motion/effects. Rows in order: 0 idle/blink 6 frames; 1 walk right 8; 2 walk left 8; 3 wave 4; 4 jump/celebrate 5; 5 error 8; 6 waiting 6; 7 active working 6; 8 review 6; 9 look upward 8; 10 look downward 8. The source is the layout master: do not reorder, add, drop or shift frames. True alpha transparent background. No text, no grid lines, no extra props, no shadows outside sprites. Modify clothing colors and polo only; everything else must remain registered to source.

## Designer generation prompt

Use case: precise-object-edit. This reference is the CLEAN ORIGINAL Maple Ryan transparent animation atlas, the exact registration and appearance master. Make Designer Ryan by modifying ONLY two things in ALL 73 EXISTING frames: (1) add simple thin dark round spectacles following the eyes in each expression, (2) recolor the gray jacket into a warm medium-brown open overshirt, dark shirt into ivory tee, keep charcoal trousers and dark shoes. Everything else MUST be copied precisely: identical original head/body proportions, body height and width, jaw shape, smile, hair silhouette, warm skin, pixel-art rendering, poses, frame locations, and animation effects. Do not enlarge the head, shrink the body, round the character, smooth the artwork, or invent a different chibi character. This is a costume-and-eyewear edit of an existing game asset. EXACTLY 8 columns and 11 rows; rows have 6,8,8,4,5,8,6,6,6,8,8 active frames respectively. Preserve all remaining cells completely empty. Maintain 1536×2288 canvas and 192×208 cell boundaries. No labels, no visible grids, no margins changes. True transparent alpha outside each sprite, clean dark contour edges. Keep the original white/violet/gold ring effects only in the working row. No red/green pixels, no colorful speckles, no shoulder patches or shoulder triangles. No glow except the existing working ring. Each sprite must have a pristine clean alpha silhouette without stray pixels. Faithfully reproduce the original atlas and change only glasses, overshirt brown, and tee ivory.

The office is original SVG art. The look references side-view platformers and a warm Singapore office, without importing commercial game assets.
