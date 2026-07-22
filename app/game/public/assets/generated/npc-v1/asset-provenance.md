# Café NPC runtime atlas v1

Generated with the built-in image generation tool on 2026-07-16, then copied into the project. The generated chroma source remains intact. Transparency was extracted locally with the installed `remove_chroma_key.py` helper and the result was normalized into a strict runtime atlas with `scripts/normalize_cafe_npc_atlas.py`.

## References

- `Asset/NPCs/Cafe-Cohort-v0.1/cafe-npc-cast-concept-v1.png`
- `Asset/NPCs/Cafe-Cohort-v0.1/cafe-npc-pose-matrix-v1.png`
- `app/game/public/assets/generated/alpha-v1/cafe-interior-v1.png`

The first two images are original Syka World identity and pose anchors. The third is the original runtime Café Biblioteca style anchor.

## Generation prompt

Create a production-ready pixel-art runtime sprite atlas for the five ORIGINAL Syka World Cafe Biblioteca NPCs shown in the reference sheets. Preserve their exact established identities, silhouettes, body diversity, clothing, props, and color cues.

OUTPUT LAYOUT IS A STRICT TECHNICAL CONTRACT:

- Landscape sprite sheet, exactly 5 equal columns by 4 equal rows.
- Columns left to right: Alma Rios, Beni Menta, Iara Luz, Milo Niebla, Noa Junco.
- Rows top to bottom: idle standing, walking right, signature work action, social/rest action.
- One character only in every cell, centered on the same bottom pivot, same apparent scale, generous equal padding, no character or prop crossing a cell boundary.
- No titles, names, labels, lettering, grid lines, UI, scenery, furniture, floor, shadows, glow, borders, or decorative frame.
- Background must be one perfectly uniform solid chroma magenta #FF00FF over the entire image; #FF00FF must never appear in any character.
- Crisp nearest-neighbor pixel art: hard pixel clusters, no blur, no antialiasing, no soft transparency, no semi-transparent edge halo.
- Fixed three-quarter isometric/front-right game view consistent with the Cafe interior.
- Each full character including props must fit comfortably in its cell and remain readable when rendered around 28x50 pixels.

IDENTITY CONTRACT:

- Alma: warm bartender/barista, tied dark curls, rolled sleeves, short dark apron, copper neckerchief; work action pours coffee; social action holds a cup.
- Beni: stocky rounded pastry baker, soft cap, sage overshirt, oatmeal/berry accents; work action presents pastry tray; social action wipes a small surface with a cloth but no furniture.
- Iara: expressive student illustrator, high braided ponytail, oversized mustard cardigan, denim satchel; work action sketches in notebook; social action chats seated on an implied invisible seat while still fully self-contained.
- Milo: tall slender night archivist, long ink-navy coat, round glasses, plum/silver/amber accents; work action reads or shelves a book; social action sips tea.
- Noa: energetic bicycle courier/plant supplier, cropped moss jacket, bicycle cap, rust cross-body strap; work action carries small herb crate; social action waves. Do not include a bicycle because it would break the cell.

Match the established cozy restrained Syka World palette, dark espresso outlines, warm upper-left twilight material shading, and handcrafted detailed pixel density. This is not concept art: prioritize exact cell discipline, readable silhouettes, transparent-ready chroma separation, and consistent pivots.

## Technical correction

The generated sheet preserved the identities well but did not obey exact mathematical row boundaries. The normalizer crops the transparent row gaps, trims every pose, resizes only with nearest-neighbour sampling, and places all poses on a shared bottom-centred pivot. The app loads only `cafe-npcs-atlas-v1.png`.
