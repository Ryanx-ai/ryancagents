# Ryan HQ 2.5D office

Original Blender geometry and procedural materials. Sprites, agent identities,
wardrobe colors, walking lanes and chat hit targets are outside this artwork.

## Direction

The perspective variant uses a deeper two-level room: warm oak, sage mineral
plaster, brushed charcoal metal, ceramic planters and soft practical light.
Receding floorboards, wall returns and ceiling battens establish depth while
the Ryans retain their original 2D sprites and horizontal walking lanes.

One shared, layered procedural 3D city sits beyond the six real window openings.
Exterior lights pass through the openings and mullions into a bounded scattering
volume, producing directional daylight and softer night illumination. Light
shafts and floor patches are rendered from geometry and light, not painted beam
overlays. Day and night retain the same scene geometry and city placements.

Palette: oak `#ae8b5e`, dark timber `#62503b`, sage plaster `#787d72`, charcoal
`#333c40`, jade `#527f62`, ivory `#e1d5b7`. Keep room detail quieter than the six
Ryans and their live status. The existing application fonts and UI are retained.

## Locked projection

- Logical canvas: 1100 × 800; matching day/night output: 2200 × 1600.
- Perspective camera: 45mm lens, 36mm horizontal sensor, camera distance 13.75,
  horizon at (550,100). The camera faces along the room's depth axis.
- Real horizontal floors at z=-2 upstairs and z=-5 downstairs; rear wall y=4.
  The registered sprite plane is y=0.
- Actor feet: y300 upstairs, y600 downstairs.
- Desk origins: Manager (319,297), Designer (759,297); workers (209,598),
  (429,598), (649,598), (869,598).
- Live clock center (513,170), live HQ sign (513,118).
- Blackboard remains HTML in the same position and above the background.
- No characters, names, task text, times or working status baked into renders.
- Both lighting states use the same camera, geometry and seeded prop placements.
- Screen fronts and fixture mounts are registered to the existing live overlays.
  The renderer checks representative camera projections before rendering.

`render_perspective.py` is the current variant's source. `render_office.py` is
retained as the original shallow, 18° orthographic reference; it is a separate
reproducible option, not a new in-app control.

## Reproduce

The project uses the official Blender 4.5.17 LTS Apple Silicon runtime. The
isolated runtime lives under ignored `.local/tools/`; no existing Blender
installation was replaced. A vendor-checksum receipt is stored there.

```sh
/path/to/Blender --background --factory-startup --disable-autoexec -t 4 \
  --python-exit-code 1 --python art/blender/render_perspective.py
```

`-- --preview --day-only` renders the low-sample preview; `--night-only` renders
only night. `--output /absolute/directory` changes the output location. Default
output is ignored `.local/perspective-renders/`, with PNGs and compressed `.blend`
source scenes. The Python source is canonical and contains all models/materials.

After both final renders finish and pass visual review, publish the pair:

```sh
node art/blender/publish_plates.mjs --source .local/perspective-renders --perspective
```

The publisher rejects preview-sized images, PNGs older than their saved scene,
failed projection checks and mismatched day/night geometry receipts.
It compresses the pair into `public/office/`, copies the editable `.blend`
scenes here, and records projection metadata and image checksums in
`render-manifest.json`. Publishing replaces the displayed pair; the previous
release remains available in git. To reproduce the orthographic reference, use
`render_office.py` and its default output `.local/office-renders/` instead.

The site displays a pre-rendered image; users do not run Blender or a WebGL
renderer. There are no additional API calls or Blob writes for this art.

## Reference study

Official Nexon references were inspected for transferable composition, not copied
into the scene:

- [Henesys Adventure](https://maplestory.nexon.com/Media/MapleDecoration/8): warm
  amber atmosphere, pale distant landscape, stronger foreground silhouettes.
- [Spring 2023](https://maplestory.nexon.com/Media/MapleDecoration/7): legible
  horizontal scenery bands and separation between distant landmarks and props.
- [Henesys motifs](https://maplestory.nexon.com/Media/MapleDecoration/11): rounded
  overscale props and strong platform/ladder silhouettes. This is a motif sheet,
  not a lighting or exact room-layout reference.

Design review used frontend-design and the relevant Designly composition,
photography, manipulation, taste and visual QA guidance; the remaining Designly
and UIUXDESIGNER skill catalog was reviewed for applicable constraints. No new
marketing flow, design tool dependency, agent identity or UI typography was added.

The UI statically imports each WebP, so Next emits a content-hashed immutable
asset URL. Only the current lighting plate is displayed/requested. The 7am/7pm
Asia/Singapore boundary, clock alignment and every character animation remain
owned by the existing office code.

The perspective renderer is configured for CPU Cycles with four threads,
24 maximum adaptive samples, 6 minimum samples, noise threshold 0.07, and
denoising. Final output is 2200 × 1600; preview output is 1100 × 800 with
12 maximum samples. Volume bounces are zero for single scattering, preserving
direct window shafts without expensive multiple scattering in the thin room
air; see the [Blender volume documentation](https://docs.blender.org/manual/en/4.5/render/materials/components/volume.html).
Keeping this work offline avoids any per-visit 3D rendering
cost or ongoing backend job. This variant changes the scenery assets; the
existing UI, sprite sheets, wardrobe renderer and Actor logic stay unchanged.

## Verification

The full 235-test suite passes. The preview pair was visually reviewed; lower
window tops were moved clear of the upper platform and atmospheric haze was
reduced. The integrated preview passed at 1440×900, 390×844 and 844×390:
six occupied desks, correct feet on both floors, readable progress bubbles,
phone chat placement, outside-click dismissal, character cards and blackboard
access. Testing used isolated local Demo activity, without live prompts or
production data access. Temporary preview imports were restored afterward.

Both final 2200×1600 renders completed and passed independent image review.
Their shared geometry hashes match; the maximum checked projection error is
0.0000954 logical pixels. The production build and TypeScript pass. The final
night WebP was also checked in the app at 1440×900 and 320×740, with six desks,
aligned monitor overlays, readable bubbles, correct sprite feet and no vertical
overflow. The day/night WebPs are 172,068 and 187,438 bytes respectively.
Production asset checks follow publication; checksums and geometry verification
are recorded in `render-manifest.json`.

### Previous orthographic release

The following evidence applies to the earlier orthographic pair only. The three
sprite atlas files, Ryan rendering function and Actor behavior were compared
with that release's deployed baseline and remained unchanged. The office/time
regressions and full 235-test suite passed. Image review corrected overly dark
plank seams; the final floor used narrow, staggered joints.
The integrated night scene was checked at 1440×900, 1920×1080, 390×844,
320×740 and 844×390. Six occupied desks, registered sprite feet, no vertical
overflow, working monitor displays and bubbles, outside-click chat dismissal,
character profiles and blackboard access passed. The test office used Demo
activity, not fabricated live agent work. Day/night source images were separately
visually reviewed. The production build, including TypeScript, passed. That
pair's WebP sizes were 140,828 bytes (day) and 148,760 bytes (night); its checksums
are retained in the previous release's manifest in git. These checks do not
establish verification of the perspective variant.
