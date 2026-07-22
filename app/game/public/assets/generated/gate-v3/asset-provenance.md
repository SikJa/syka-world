# Light FX Sheet v1 — Asset provenance

- **Status:** provisional; pending renderer integration and independent visual-gate approval.
- **Use:** modular pixel-art light decals for Syka World cycle 3.
- **Generation mode:** OpenAI built-in `image_gen` tool, one generation only. No CLI/API fallback was used.
- **Generated source:** `light-fx-sheet-v1-chroma.png` (1536×1024).
- **Runtime asset:** `light-fx-sheet-v1.png` (RGBA atlas, 192×64).
- **Manifest:** `light-fx-sheet-v1.manifest.json`.
- **Requested chroma:** `#FF00FF`; the generated border sampled as `#F704EE` and was removed locally with the installed imagegen chroma-key helper.
- **Post-processing:** connected-component crop, nearest-neighbor normalization to the six requested logical sizes, compact 3×2 atlas placement, and luminance-shaped partial alpha. No effect was redrawn and no additional image generation was performed.
- **Validation:** transparent corners; 3,693 non-transparent pixels; all 3,693 effect pixels carry partial alpha; zero magenta-colored non-transparent pixels.

## Final generation prompt

```text
Use case: stylized-concept
Asset type: modular 2D pixel-art lighting decals for an isometric cozy town game
Primary request: Create ONE clean sprite sheet arranged as an exact 3 columns by 2 rows grid, containing exactly six isolated luminous pixel-art masks and nothing else.
Scene/backdrop: perfectly flat, absolutely uniform solid #FF00FF chroma-key background covering the full canvas; no grid lines, no panels, no labels, no shadows, no gradient in the background, no floor, no texture.
Subjects, in reading order left-to-right then top-to-bottom:
1) a wide isometric amber streetlamp light pool, logical target proportion 48x20, horizontally centered diamond/ellipse;
2) a smaller isometric amber streetlamp light pool, logical target proportion 32x14;
3) a narrow warm doorway light spill, logical target proportion 40x24, a short isometric trapezoid/diamond extending outward;
4) a broad café doorway/window light spill, logical target proportion 64x28, wider isometric trapezoid/diamond;
5) a contained square-ish pixelated warm window halo, logical target proportion 32x24;
6) a tiny compact pixelated bulb halo, logical target proportion 16x16.
Style/medium: crisp hand-placed retro pixel art, clear integer pixel clusters, deliberately stepped and dithered edges; technically usable as additive light decals in a fixed isometric game camera.
Color palette: brightest core #FFE39A, warm amber midtones, extremely restrained coral-orange outer pixels. Keep every effect visually compact and contained.
Composition/framing: each effect centered alone within its own equal cell with generous empty chroma padding; no overlaps; consistent orientation; no separator lines.
Constraints: exactly six effects and no other content; no lamps, bulbs, windows, doors, buildings, people, terrain, props, icons, text, labels, numbers, watermark, borders, frames or UI. Never use #FF00FF or magenta inside the light effects. The effects themselves must use hard-edged pixel clusters with sparse dither steps, never blurry gradients, soft bloom, Gaussian blur, smooth airbrush, fog, smoke, lens flare or realistic light rays. Preserve the relative proportions specified above.
```

## Review note

The sheet intentionally contains no lamp posts, windows, doors, terrain, or props. Those assets remain independently placeable so the renderer can align each light effect to its emitter and keep street furniture out of roads.
