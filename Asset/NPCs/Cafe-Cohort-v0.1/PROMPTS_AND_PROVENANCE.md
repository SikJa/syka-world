# Prompts y procedencia

Fecha: 2026-07-16  
Modo: ImageGen integrado de Codex, ruta built-in.  
Taxonomía usada: `stylized-concept` para la primera generación; `identity-preserve` para continuaciones consistentes.  
Postproceso: copia sin edición; no se usó CLI, transparencia, recorte, reescalado ni retoque local.

## Referencias de proyecto

1. `research/visual-concepts/approved-direction-v1/city-layout-a-twilight.png` — paleta exterior, densidad y atardecer.
2. `research/visual-concepts/approved-direction-v1/cafe-interior-library.png` — cámara, materiales, detalle y calidez del Café.
3. `app/game/public/assets/generated/alpha-v1/agents-sheet-v1.png` — escala y legibilidad mínima; no se usó como identidad.
4. `cafe-npc-cast-concept-v1.png` — ancla de identidad para las generaciones 2 y 3.

No se solicitaron marcas, personajes protegidos ni semejanzas de personas reales.

## Generación 1 — elenco

Archivo final: `cafe-npc-cast-concept-v1.png`

```text
Use case: stylized-concept
Asset type: future game NPC character concept sheet, isolated from production
Input images: Image 1 is the approved exterior palette and pixel-density reference; Image 2 is the approved cozy cafe interior mood and material reference; Image 3 is only a scale/readability reference for the current tiny agent sprites, not an identity reference.
Primary request: create a polished landscape pixel-art character lineup for five original human cafe NPCs, ordered left to right exactly as follows: Alma Ríos the bartender/barista, Beni Menta the pastry baker, Iara Luz the student illustrator, Milo Niebla the night archivist and reader, Noa Junco the bicycle courier and plant supplier.
Subject details: Alma has rolled sleeves, a short dark apron, a copper neckerchief, tied-back dark curls and a small serving tray; Beni has a stockier rounded silhouette, soft baker cap, sage overshirt and paper pastry bag; Iara has an oversized mustard cardigan, square blue satchel, high braided ponytail and sketchbook; Milo is tall and slender with a long ink-navy coat, round glasses and a stack of books; Noa has a cropped moss jacket, rust cross-body strap, rolled trousers, bicycle cap and a small crate containing herbs.
Style/medium: detailed handcrafted isometric pixel art, crisp pixel clusters, warm cozy fantasy realism, same visual language as the cafe and town references, not photorealistic, not smooth vector art, not 3D.
Composition/framing: five equal vertical columns; for each character show three full-body views: neutral southeast-facing isometric pose, opposite northwest-facing pose, and one role action pose. Keep every figure fully visible with generous separation. Plain muted blue-gray studio backdrop with a subtle pixel grid only.
Lighting/mood: neutral warm studio light so local colors remain readable; no dramatic shadows.
Color palette: Alma espresso/copper/cream/teal; Beni sage/oatmeal/berry/charcoal; Iara mustard/denim/coral/paper ivory; Milo ink navy/plum/silver/amber; Noa moss/rust/sky blue/tan.
Constraints: preserve five distinct silhouettes at tiny scale; practical clothing; believable adult proportions; no likeness to the four Hermes protagonists; no pets; no extra characters; no text, labels, logos, UI, scenery, watermarks or borders.
```

## Generación 2 — matriz de poses

Archivo final: `cafe-npc-pose-matrix-v1.png`

```text
Use case: identity-preserve
Asset type: future game NPC motion and readability concept sheet, not production sprites
Input images: Image 1 is the exact identity anchor for all five NPCs and must be preserved; Image 2 anchors the cafe's detailed isometric pixel-art language; Image 3 anchors tiny runtime readability and grid discipline only.
Primary request: create a clean landscape pixel-art pose matrix for the same five NPCs from Image 1, ordered left to right Alma, Beni, Iara, Milo, Noa. Preserve their faces, body types, clothing, props, palettes and silhouette cues exactly.
Composition/framing: five equal columns on a plain muted blue-gray grid. Each column contains four isolated full-body southeast-facing isometric poses stacked vertically: neutral idle, one clear walking stride, role-specific work action, and relaxed cafe social action.
Role actions: Alma pours coffee behind a compact counter edge; Beni presents a pastry tray; Iara sketches in a notebook; Milo shelves or reads a book; Noa lifts a small herb crate from a bicycle rack. Social poses: Alma listens with cup in hand, Beni wipes a small table, Iara chats while seated, Milo sips tea, Noa waves from the doorway.
Style/medium: handcrafted detailed pixel art with crisp clusters and controlled outlines; warm cozy realism; simplify enough that each pose could later be reduced to a 12x24 runtime silhouette. No smooth vector edges, no 3D render.
Lighting/mood: neutral even warm studio lighting; no cast shadows across neighboring cells.
Constraints: exactly five identities and exactly four poses per identity; no redesign; no extra characters; keep practical adult proportions; no scenery beyond tiny action props; no text, letters, labels, logos, UI, watermark or decorative border.
```

## Generación 3 — escena de microvida

Archivo final: `cafe-npc-microlife-scene-v1.png`

```text
Use case: identity-preserve
Asset type: future cafe NPC micro-life environment concept, isolated from production
Input images: Image 1 is the exact identity anchor for Alma, Beni, Iara, Milo and Noa; Image 2 is the approved cafe interior style, geometry, furniture density and mood reference; Image 3 anchors the exterior twilight visible through windows.
Primary request: create one detailed isometric pixel-art cutaway of the cozy Cafe Biblioteca during a calm late-afternoon micro-life moment, populated by exactly the same five NPCs from Image 1.
Scene/backdrop: warm wood cafe-library with compact bar, espresso machine, pastry display, bookshelves, fireplace, reading tables, plants and a doorway; through the windows show a softly blurred twilight fragment of the existing town, never a black void.
Character blocking: Alma works behind the counter pouring one coffee; Beni restocks the pastry display; Iara sketches at a small table; Milo reads near the fireplace with tea; Noa has just arrived at the doorway with a small herb crate and bicycle partly visible outside. Every character must be identifiable by their established silhouette and palette.
Style/medium: handcrafted high-detail isometric pixel art, crisp clusters, warm cozy fantasy realism, same camera angle and rendering language as Image 2. Not photorealistic, not smooth vector art, not 3D.
Composition/framing: single isolated room cutaway, all five characters visible without crowding, believable circulation paths, readable counter and seating zones.
Lighting/mood: golden late afternoon transitioning to twilight; warm practical lamps and fireplace; soft cool city light outside; no harsh bloom.
Constraints: preserve all five identities and clothing exactly; exactly five people; no Hermes protagonists, pets or extra patrons; no text, signs, labels, logos, UI, watermark or black background.
```

## Revisión visual

- Elenco: 5 columnas correctas; tres lecturas por identidad; siluetas y props separados.
- Poses: 5 columnas por 4 filas; identidades y paletas estables; acciones legibles.
- Escena: exactamente 5 NPCs; Alma, Beni, Iara, Milo y Noa ocupan roles distintos; ciudad visible al fondo; sin fondo negro.
- Limitaciones: las hojas son conceptuales y no garantizan pivotes, proporciones por frame, transparencia ni limpieza de atlas. La bicicleta y muebles son props de referencia, no parte obligatoria de cada sprite.

