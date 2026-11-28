# Ryan HQ 2.5D office

Original Blender geometry and procedural materials. Sprites, agent identities,
wardrobe colors, walking lanes and chat hit targets are outside this artwork.

## Direction

A shallow orthographic office cutaway: warm oak, sage mineral plaster, brushed
charcoal metal, ceramic planters and soft practical light. The side-scroller
reference informs layered scenery, cozy prop proportions and clear platforms;
materials and shadows add depth without turning the actors into 3D characters.

Palette: oak `#ae8b5e`, dark timber `#62503b`, sage plaster `#787d72`, charcoal
`#333c40`, jade `#527f62`, ivory `#e1d5b7`. Keep room detail quieter than the six
Ryans and their live status. The existing application fonts and UI are retained.

## Locked projection

- Logical canvas: 1100 × 800; matching day/night output: 2200 × 1600.
- Orthographic camera, 18° downward pitch; projected horizontal platforms.
- Actor feet: y300 upstairs, y600 downstairs.
- Desk origins: Manager (319,297), Designer (759,297); workers (209,598),
  (429,598), (649,598), (869,598).
- Live clock center (513,170), live HQ sign (513,118).
- Blackboard remains HTML in the same position and above the background.
- No characters, names, task text, times or working status baked into renders.
- Both lighting states use the same camera, geometry and seeded prop placements.

## Reproduce

Tested with the official Blender 4.5.17 LTS Apple Silicon runtime. The isolated
runtime lives under ignored `.local/tools/`; no existing Blender installation
was replaced. A vendor-checksum receipt is stored there.

```sh
/path/to/Blender --background --factory-startup --disable-autoexec -t 4 \
  --python-exit-code 1 --python art/blender/render_office.py
```

`-- --preview --day-only` renders the low-sample preview; `--night-only` renders
only night. `--output /absolute/directory` changes the output location. Default
output is ignored `.local/office-renders/`, with PNGs and compressed `.blend`
source scenes. The Python source is canonical and contains all models/materials.
Run `node art/blender/publish_plates.mjs` after both renders finish. It rejects preview-sized images, compresses the final pair into `public/office/`, copies the editable `.blend` scenes here, and records their image checksums in `render-manifest.json`.

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

Final rendering uses CPU Cycles with four threads, 24 maximum adaptive samples,
8 minimum samples, noise threshold 0.06, and denoising. Keeping this work offline
avoids any per-visit 3D rendering cost or ongoing backend job.

## Verification

The three sprite atlas files, Ryan rendering function and Actor behavior were
compared with the deployed baseline and remain unchanged. The office/time
regressions and full 235-test suite pass. Image review corrected overly dark
plank seams before release; the final floor uses narrow, staggered joints.
The integrated night scene was checked at 1440×900, 1920×1080, 390×844,
320×740 and 844×390. Six occupied desks, registered sprite feet, no vertical
overflow, working monitor displays and bubbles, outside-click chat dismissal,
character profiles and blackboard access passed. The test office used Demo
activity, not fabricated live agent work. Day/night source images were separately
visually reviewed. The production build, including TypeScript, passes. Final
WebP sizes are 140,828 bytes (day) and 148,760 bytes (night); checksums are in
the manifest. Production asset/deployment checks follow publication.
