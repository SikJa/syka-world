# Syka World — procedencia del kit raster Gate v2

Fecha de generación: 2026-07-16  
Estado: **candidatos de integración; no son arte final y todavía no prueban el gate visual de runtime**  
Autoría: generación original solicitada para Syka World mediante la herramienta integrada `image_gen`; no se usó CLI, API externa ni un pack comercial.

## Alcance y licencia interna

- Estas salidas fueron creadas específicamente para Syka World y se guardan como assets internos del proyecto.
- No se incorporaron deliberadamente recortes, fondos, sprites ni texturas de juegos comerciales.
- Las cuatro imágenes de `research/visual-concepts/approved-direction-v1/` se usaron únicamente como referencias de lenguaje visual, cámara, densidad, paleta e iluminación. No son assets de runtime y no se redistribuyen desde esta carpeta.
- Clasificación de licencia del proyecto: **Syka World project-generated asset**, publicado bajo CC BY 4.0 según `ASSET_LICENSE.md`.
- La procedencia anterior describe el flujo técnico y creativo; no pretende sustituir asesoramiento jurídico sobre una futura publicación.

## Flujo de generación

1. Generación raster con la herramienta integrada `image_gen`.
2. Fondo de producción uniforme `#FF00FF`, elegido porque no pertenece a la paleta aprobada.
3. Copia de la fuente chroma al workspace; los originales bajo `.codex/generated_images` no son la única copia.
4. Conversión a RGBA con:

   ```text
   remove_chroma_key.py --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
   ```

5. Inspección visual a resolución original y validación programática de canal alpha, esquinas, cobertura, bordes parciales y residuos magenta.

## Inventario y veredicto técnico

| Asset alpha | Fuente chroma | Canvas | Alpha bbox `(x,y,w,h)` | Estado |
|---|---|---:|---:|---|
| `house-exterior-v1.png` | `house-exterior-v1-chroma.png` | 1484×1060 | 341,80,849,901 | **Apto como candidato de edificio.** Silueta residencial, acceso, chimenea, jardín, buzón y luz cálida legibles. Falta validar su reducción nearest-neighbor dentro del runtime. |
| `cafe-exterior-v1.png` | `cafe-exterior-v1-chroma.png` | 1536×1024 | 332,89,890,874 | **Apto como candidato de edificio.** Se distingue de la casa por fachada pública, toldo, terraza, libros, madera y plantas. Falta validar la escala de puerta/footprint en runtime. |
| `environment-props-sheet-v1.png` | `environment-props-sheet-v1-chroma.png` | 1619×972 | 110,33,1355,856 | **Apto como hoja fuente.** Incluye doce props separados; requiere crops declarados y escalas por familia. |
| `ground-decals-sheet-v1.png` | `ground-decals-sheet-v1-chroma.png` | 1536×1024 | 152,171,1222,688 | **Apto como candidato de microdetalle.** Doce decals aislados para superponer con moderación sobre césped; contrato en `ground-decals-manifest.json`. |
| `terrain-tiles-sheet-v4.png` | `terrain-tiles-sheet-v4-chroma.png` | 1774×887 | 69,195,1636,501 | **Candidato preferido.** Ocho diamantes planos, ratio medido 2.000–2.034:1. La teselación sin seams debe probarse en runtime antes de aprobarlo. |
| `terrain-tiles-atlas-v1.png` | normalizado desde `terrain-tiles-sheet-v4.png` | 1280×320 | 8 frames de 320×160 | **Atlas preferido para integración.** Cada frame usa el mismo diamante 2:1, alpha binario y escala lógica 0.1. |
| `terrain-tiles-atlas-v2.png` | normalizado desde `terrain-tiles-seamless-source-v2.png` | 1280×320 | 8 frames de 320×160 | **Reemplazo P0 preferido.** Sin outline oscuro de perímetro; tres céspedes sutiles sin tierra; borde saneado y parche 6×6 verificado. Contrato en `terrain-tiles-manifest-v2.json`. |
| `terrain-tiles-sheet-v1.png` | `terrain-tiles-sheet-v1-chroma.png` | 1774×887 | — | **Rechazado para teselación:** tenía espesor lateral tipo losa/diorama. Se conserva sólo como historial. |
| `terrain-tiles-sheet-v2.png` | `terrain-tiles-sheet-v2-chroma.png` | 1774×887 | — | **Superado:** plano, pero ratio aproximado 1.79:1. |
| `terrain-tiles-sheet-v3.png` | `terrain-tiles-sheet-v3-chroma.png` | 1774×887 | — | **Superado:** plano, pero ratio aproximado 2.25:1. |

No consumir `*-chroma.png` en runtime. Usar siempre las variantes RGBA sin el sufijo `-chroma`.

`atlas-manifest.json` es el contrato legible por código para crops, pivotes, tamaños sugeridos y frames. Fue validado como JSON después de escribirse.

## Validación alpha

| Asset | Transparentes | Parciales | Opacos | Esquinas alpha | Píxeles magenta no transparentes |
|---|---:|---:|---:|---|---:|
| `house-exterior-v1.png` | 1,020,470 | 5,765 | 546,805 | 0 / 0 / 0 / 0 | 0 |
| `cafe-exterior-v1.png` | 1,067,391 | 6,335 | 499,138 | 0 / 0 / 0 / 0 | 0 |
| `environment-props-sheet-v1.png` | 1,328,730 | 16,582 | 228,356 | 0 / 0 / 0 / 0 | 0 |
| `ground-decals-sheet-v1.png` | 1,498,481 | 7,957 | 66,426 | 0 / 0 / 0 / 0 | 0 |
| `terrain-tiles-sheet-v4.png` | 1,301,908 | 9,937 | 261,693 | 0 / 0 / 0 / 0 | 0 |

Los píxeles parcialmente transparentes son el matte de borde producido por `--soft-matte`; no se detectó franja chroma residual. El gate debe verificar si conviene conservar ese matte o usar un borde más duro después de verlo contra césped, asfalto y noche reales.

## Crops y escalas sugeridas

Las coordenadas usan el canvas fuente y están expresadas como `(x,y,w,h)`. El crop sugerido agrega dos píxeles transparentes alrededor del alpha bbox para no cortar el matte.

### Edificios

| Asset | Crop sugerido | Pivote | Tamaño físico inicial a 1440×900 | Equivalente lógico en canvas 720×450 |
|---|---:|---|---:|---:|
| casa | 339,78,853,905 | centro inferior del alpha bbox | 224×238 px | 112×119 px |
| cafetería | 330,87,894,878 | centro inferior del alpha bbox | 288×283 px | 144×142 px |

Estas escalas vinculan la casa a un footprint 4×3 y la cafetería a 5×4 usando tile físico 64×32 (tile lógico 32×16). Son puntos de partida, no aprobación: puertas, acceso y orden de profundidad deben medirse en la captura del runtime.

### Hoja de props

Grid de fuente: 4 columnas × 3 filas. Límites de celda X: `0,405,810,1214,1619`; Y: `0,324,648,972`.

| # | Prop | Celda `(x,y,w,h)` | Alpha bbox | Crop +2 | Tamaño físico sugerido |
|---:|---|---:|---:|---:|---:|
| 1 | árbol redondo | 0,0,405,324 | 110,33,243,271 | 108,31,247,275 | 90×100 |
| 2 | árbol estrecho | 405,0,405,324 | 541,33,134,271 | 539,31,138,275 | 49×100 |
| 3 | arbusto redondo | 810,0,404,324 | 882,136,183,165 | 880,134,187,169 | 44×40 |
| 4 | arbusto con flores | 1214,0,405,324 | 1266,162,199,139 | 1264,160,203,143 | 57×40 |
| 5 | seto doble | 0,324,405,324 | 117,451,244,114 | 115,449,248,118 | 86×40 |
| 6 | jardinera de madera | 405,324,405,324 | 521,393,193,186 | 519,391,197,190 | 52×50 |
| 7 | macizo floral | 810,324,404,324 | 882,457,184,112 | 880,455,188,116 | 52×32 |
| 8 | farol | 1214,324,405,324 | 1325,324,78,251 | 1323,322,82,255 | 25×80 |
| 9 | banco | 0,648,405,324 | 113,693,254,196 | 111,691,258,200 | 78×60 |
| 10 | maceta | 405,648,405,324 | 539,717,130,150 | 537,715,134,154 | 35×40 |
| 11 | buzón | 810,648,404,324 | 917,697,107,183 | 915,695,111,187 | 23×40 |
| 12 | enrejado | 1214,648,405,324 | 1271,682,191,207 | 1269,680,195,211 | 55×60 |

Los tamaños físicos corresponden a la captura QA 1440×900; dividir por dos para el canvas lógico. No aplicar una escala única a toda la hoja: el generador mantuvo tratamiento y cámara coherentes, pero no una relación física fiable entre el farol y los árboles.

### Microdetalles de suelo

`ground-decals-sheet-v1.png` contiene 12 decals en grid 4×3. Sus crops exactos, pivotes y tamaños lógicos de 6–17 px están en `ground-decals-manifest.json`. Son overlays sutiles: no reemplazan el tile de césped, no deben aparecer en todos los tiles y no cuentan por sí solos como densidad narrativa. La distribución recomendada es determinista/seeded, con mayor concentración junto a jardines, fachadas y bordes de camino.

### Hoja de terreno preferida v4

Grid de fuente: 4 columnas × 2 filas. Límites de celda X: `0,444,887,1330,1774`; Y: `0,444,887`.

| # | Tile | Celda `(x,y,w,h)` | Alpha bbox | Crop +2 | Ratio medido | Destino |
|---:|---|---:|---:|---:|---:|---:|
| 1 | césped base | 0,0,444,444 | 69,195,362,179 | 67,193,366,183 | 2.022 | 64×32 físico / 32×16 lógico |
| 2 | césped variado | 444,0,443,444 | 489,195,364,179 | 487,193,368,183 | 2.034 | 64×32 / 32×16 |
| 3 | acera crema | 887,0,443,444 | 920,195,363,179 | 918,193,367,183 | 2.028 | 64×32 / 32×16 |
| 4 | asfalto | 1330,0,444,444 | 1343,195,362,179 | 1341,193,366,183 | 2.022 | 64×32 / 32×16 |
| 5 | césped + tierra | 0,444,444,443 | 69,515,362,180 | 67,513,366,184 | 2.011 | 64×32 / 32×16 |
| 6 | asfalto + línea | 444,444,443,443 | 490,515,363,181 | 488,513,367,185 | 2.006 | 64×32 / 32×16 |
| 7 | asfalto + borde crema | 887,444,443,443 | 920,515,363,181 | 918,513,367,185 | 2.006 | 64×32 / 32×16 |
| 8 | paso peatonal | 1330,444,444,443 | 1343,515,362,181 | 1341,513,366,185 | 2.000 | 64×32 / 32×16 |

Para evitar seams, el renderer debe recortar por `alpha bbox` o normalizar todos los tiles a un frame común transparente; no debe estirar cada bbox a 64×32 de forma independiente. La prueba decisiva es un parche 6×6 alternando césped/asfalto a 100%, 150% y 200% con nearest-neighbor y pixel snapping.

La normalización pedida ya está materializada en `terrain-tiles-atlas-v1.png`: atlas 4×2 sin gutters, 1280×320, ocho frames exactos de 320×160, alpha duro 0/255 y un diamante canónico compartido. Se usó resize nearest-neighbor desde cada alpha bbox de v4; los pocos píxeles faltantes en las puntas se completaron propagando únicamente el color opaco más cercano antes de aplicar la máscara 2:1. Cada frame contiene exactamente 25,920 píxeles opacos, 25,280 transparentes y cero parciales.

### Reemplazo de terreno P0 v2

`terrain-tiles-atlas-v2.png` sustituye a v1 para el ciclo 3. Mantiene los ocho slots funcionales, pero el slot 5 ahora es una tercera variación sutil de césped sin tierra. Durante la normalización se reemplazó la banda exterior radial con color del mismo material tomado del interior cercano, eliminando cualquier outline oscuro generado sin borrar el curb intencional. Los ocho frames tienen alpha canónico 320×160, sin píxeles parciales. La luminancia mediana borde/interior quedó entre 0.962 y 1.032; por tanto no existe una banda perimetral sistemáticamente más oscura.

La prueba `terrain-v2-seam-test-6x6-logical.png` compone 36 tiles de césped a 32×16 lógico. `terrain-v2-seam-test-6x6-8x.png` es únicamente una ampliación nearest para inspección. No se observó cuadrícula oscura ni hueco transparente. Esta prueba valida el asset normalizado, pero la aprobación final sigue dependiendo del runtime.

## Prompts finales

### Casa exterior

```text
Use case: stylized-concept
Asset type: original modular game building sprite for Syka World runtime
Input images: Images 1–3 are visual-language references only for pixel density, isometric camera, cozy palette, material detail, and twilight lighting. Do not reproduce any specific building, prop arrangement, lot, or layout from them.
Primary request: create one original, fully finished isometric residential house exterior, intended as a standalone game sprite.
Scene/backdrop: perfectly flat solid #FF00FF chroma-key background for local removal. The background must be exactly uniform edge-to-edge, with no ground plane, grid, texture, gradient, halo, vignette, reflection, or lighting variation.
Subject: compact warm residential house with a 3x3 or 4x3 logical footprint, steep asymmetrical dark slate-blue roof, small brick chimney, cream stucco and warm wood walls, coral accents, readable front door, several amber-lit windows, modest covered entry, tiny attached planter boxes, one mailbox and a short fence section integrated tightly against the building. The building alone is the sprite; keep all details attached or immediately adjacent so it remains modular.
Style/medium: crisp handcrafted isometric pixel art, fixed 2:1 projection, deliberate rectangular pixel clusters, consistent 1-pixel logical outer contour, rich but readable microdetail; not 3D rendered, not low-poly, not vector art, not painterly.
Composition/framing: one building only, centered, generous empty chroma padding on every side, full silhouette visible, same single isometric viewing direction as the references, front corner facing the viewer.
Lighting/mood: cool twilight ambient light from upper-left with localized warm amber windows; subtle hard-edged pixel shading only. No cast shadow or contact shadow on the background.
Color palette: cream #F0DBA9, coral #D56A4C, wood #795A42, slate blue #45616A, deep outline/shadow #303B3D, amber light #FFE39A. Do not use #FF00FF anywhere in the subject.
Materials/textures: roof shingles aligned to isometric axes, visible wood grain clusters, stucco variation, crisp window frames, small brick pattern.
Constraints: original design; modular runtime asset; one coherent pixel density; crisp hard edges; no people, animals, text, letters, signs, logos, watermark, UI, road, terrain tile, detached scenery, sky, smoke, blur, antialiasing, soft bloom, depth of field, cast shadow, contact shadow, reflection, or copied commercial-game asset.
```

### Cafetería exterior

```text
Use case: stylized-concept
Asset type: original modular game building sprite for Syka World runtime
Input images: Images 1–2 are visual-language references only for exterior pixel density, isometric camera, cozy palette, streetside detail, and twilight lighting. Image 3 is a reference only for the café's warmth, wood-and-books identity, and narrative density. Do not reproduce any specific building, room, prop arrangement, lot, or layout from any input.
Primary request: create one original, fully finished and immediately recognizable isometric neighborhood café exterior as a standalone game sprite, visually coherent in scale and pixel density with the residential house asset family.
Scene/backdrop: perfectly flat solid #FF00FF chroma-key background for local removal. The background must be exactly uniform edge-to-edge, with no ground plane, grid, texture, gradient, halo, vignette, reflection, or lighting variation.
Subject: compact two-story corner café with a 4x3 or 5x4 logical footprint; cream plaster, dark warm timber, coral brick details, deep teal/slate roof; broad amber-lit storefront windows; striped green-and-cream awning; sheltered front entrance; clearly visible bookshelves through one window; tiny attached terrace with two round tables and paired chairs; built-in planter boxes, hanging plants, menu-board silhouette with no readable marks, and one wall lantern. Make the public façade and café identity unmistakable without text.
Style/medium: crisp handcrafted isometric pixel art, fixed 2:1 projection, deliberate rectangular pixel clusters, consistent 1-pixel logical outer contour, rich but readable microdetail; not 3D rendered, not low-poly, not vector art, not painterly.
Composition/framing: one café only, centered, generous empty chroma padding on every side, full silhouette visible, same single isometric viewing direction as the references, front corner facing the viewer. All terrace pieces must be tightly grouped with the building so the sprite remains modular.
Lighting/mood: cool twilight ambient light from upper-left with localized warm amber windows and lantern; subtle hard-edged pixel shading only. No cast shadow or contact shadow on the background.
Color palette: cream #F0DBA9, coral #D56A4C, wood #795A42, slate blue #45616A, deep outline/shadow #303B3D, amber light #FFE39A, muted green accents. Do not use #FF00FF anywhere in the subject.
Materials/textures: roof shingles aligned to isometric axes, timber beams, stucco texture clusters, crisp window mullions, books suggested by small grouped colored spines, cloth awning stripes, terracotta planters.
Constraints: original design; modular runtime asset; one coherent pixel density; crisp hard edges; no people, animals, readable text, letters, logos, watermark, UI, road, terrain tile, detached scenery, sky, smoke, blur, antialiasing, soft bloom, depth of field, cast shadow, contact shadow, reflection, or copied commercial-game asset.
```

### Props y vegetación

```text
Use case: stylized-concept
Asset type: original modular isometric game-prop sprite sheet for Syka World runtime
Input images: Images 1–2 are the newly established original Syka World building style anchors; match their isometric camera, crisp pixel density, contour weight, palette, scale, and upper-left twilight lighting. Image 3 is a visual-language reference only for vegetation variety and cozy street detail. Do not reproduce any specific prop or arrangement from it.
Primary request: create one clean sprite sheet containing twelve separate original isometric environmental props for the same world: broad round-canopy deciduous tree; taller narrow-canopy deciduous tree; dense rounded shrub; low flowering shrub; short two-segment hedge; rectangular wooden planter with layered foliage; tiny mixed flower patch; warm amber streetlamp; wooden park bench with dark metal frame; terracotta pot with leafy plant; small wooden mailbox; low garden trellis with climbing greenery.
Scene/backdrop: perfectly flat solid #FF00FF chroma-key background for local removal. The background must be exactly uniform edge-to-edge, with no ground plane, grid, texture, gradient, halo, vignette, reflection, or lighting variation.
Style/medium: crisp handcrafted isometric pixel art, fixed 2:1 projection, deliberate rectangular pixel clusters, consistent 1-pixel logical outer contour, readable material clusters; not 3D rendered, not low-poly, not vector art, not painterly.
Composition/framing: arrange the twelve props as a clean 4-column by 3-row sprite sheet with generous, equal chroma gaps. Every prop is isolated and fully visible; no prop touches or overlaps another; no dividers, labels, frames, tile backgrounds, or shadows. Keep scale coherent with the house and café. All props share exactly the same isometric viewing direction.
Lighting/mood: cool twilight ambient light from upper-left; the streetlamp emits a contained hard-edged amber pixel glow inside its lantern only. No cast shadow or contact shadow on the background.
Color palette: vegetation #A8C98D, #89A968, #527A52 with controlled deep shadow; wood #795A42; metal/asphalt shadow #303B3D; stone/cream #E8D9AD; coral flower accents #D56A4C; amber lamp #FFE39A. Do not use #FF00FF anywhere in any prop.
Constraints: original designs; modular runtime sprites; one coherent pixel density; crisp hard edges; no people, animals, text, numbers, letters, logos, watermark, UI, buildings, road, terrain tiles, detached decorative particles, sky, smoke, blur, antialiasing, soft bloom, depth of field, cast shadow, contact shadow, reflection, or copied commercial-game asset.
```

### Terreno v4

```text
Use case: precise-object-edit
Asset type: final geometry correction for an original isometric terrain-tile sheet
Input images: Image 1 is too tall (tile silhouette approximately 1.79:1 width-to-height). Image 2 is too flat (approximately 2.25:1). Create the corrected sheet exactly between them while preserving Image 2's flat zero-thickness treatment and all material identities.
Primary request: eight flat tile diamonds, each exact 2.00:1 width-to-height. Target every visible alpha silhouette at approximately 360 pixels wide by exactly 180 pixels tall. Use strict isometric edge stair steps: two horizontal pixels for each one vertical pixel.
Scene/backdrop: perfectly flat uniform solid #FF00FF chroma-key background edge-to-edge; no grid, floor, texture, gradient, halo, or variation.
Composition/framing: exact 4 columns by 2 rows, unchanged order: plain grass, varied grass, cream sidewalk, dark asphalt, grass/earth surface edge, asphalt lane dash, asphalt/cream curb surface edge, asphalt crosswalk. Each tile centered in its equal cell, identical outer dimensions, generous gaps, no overlap.
Style/medium: retain crisp handcrafted pixel art, restrained material texture, original Syka palette, one coherent contour and upper-left twilight material shading.
Constraints: exact 2.00:1 alpha silhouette and identical dimensions are mandatory; zero thickness; no vertical faces, extrusion, bevel, platform, cast/contact shadows, 3D, blur, antialiasing, text, watermark, UI, extra tiles, or #FF00FF within tiles.
```

### Microdetalles de suelo v1

```text
Use case: stylized-concept
Asset type: original isometric pixel-art ground-decal sprite sheet for Syka World Gate v2 runtime
Input images: Images 1–4 are the current original Syka World asset-family anchors. Match their crisp pixel clusters, restrained cozy palette, fixed isometric camera, upper-left twilight lighting, and material treatment. Do not reproduce any exact plant, flower, rock, or arrangement from them.
Primary request: create exactly twelve separate, subtle ground-detail decals in this exact 4-column by 3-row order: three tiny grass tufts; two clover/ground plants; two miniature flower groups; two tiny stone groups; fallen leaves; irregular bare-earth patch; tiny mushroom pair with grass accent.
Scene/backdrop: perfectly flat solid #FF00FF chroma-key background for local removal; no ground plane, tile, grid, texture, gradient, halo, vignette, reflection, or lighting variation.
Style/medium: crisp handcrafted isometric pixel art, fixed 2:1 world direction, deliberate rectangular pixel clusters, restrained detail, coherent with the current house/café/props kit; not 3D rendered, low-poly, vector or painterly.
Composition/framing: exact 4-column by 3-row sprite sheet with generous equal chroma gaps; one isolated decal per equal cell; no labels, dividers, frames, tile bases, badges or complete grass diamonds.
Scale intent: microdetails intended to render only 6–18 logical pixels wide; compact, sparse, simple and readable after nearest-neighbor reduction.
Lighting/mood: subtle cool upper-left twilight shading inside each decal only; no cast/contact shadow, ambient oval or glow.
Constraints: exactly twelve original decals; no people, characters, buildings, furniture, road, complete terrain tile, text, logo, watermark, UI, blur, antialiasing, soft bloom, reflection or copied commercial asset.
```

### Terreno seamless v2

```text
Use case: precise-object-edit
Asset type: original seamless isometric terrain source sheet v2 for Syka World Gate v2 runtime
Input images: Image 1 is the current terrain atlas and defines the eight functional slots and fixed world direction, but its dark/punctuated perimeter must NOT be inherited. Images 2–4 are the established original Syka World Gate v2 style anchors for pixel density, restrained cozy palette, and material detail.
Primary request: create exactly eight flat zero-thickness terrain diamonds: grass plain A; grass subtle B; sidewalk cream; asphalt dark; grass subtle C with no earth edge; asphalt lane dash; asphalt curb edge; crosswalk.
Scene/backdrop: perfectly flat uniform solid #FF00FF chroma-key background edge-to-edge.
Critical seamless-edge rule: material color and texture must continue cleanly to every diamond edge. No dark/black/dotted outline, punctuated border, rim, bevel, stroke, lip, side face, slab thickness or external shadow. Outermost pixels must be ordinary material pixels.
Grass direction: cooler and less yellow; organic muted greens centered on #89A968 and #527A52 with restrained #A8C98D highlights; no neon lime, repeated tufts, flowers, dirt borders, mowing stripes or noisy speckle.
Sidewalk/asphalt direction: restrained internal texture and marks only; no perimeter line.
Constraints: exactly eight original tiles; no complete grid, dark diamond border, people, props, buildings, text, watermark, UI, blur, antialiasing, reflection or copied commercial asset.
```

## Limitaciones conocidas y próximo gate

1. Los assets fueron generados a una resolución fuente alta. El downscale nearest-neighbor puede perder microdetalle; la captura real decidirá si se usa la escala propuesta o un renderer físico 2×.
2. Casa y cafetería son coherentes entre sí, pero no se ha demostrado todavía que sus bases coincidan sin deslizamiento con footprints 4×3 y 5×4.
3. La hoja de props necesita escalas individuales; no debe renderizarse como atlas con una escala global.
4. Los tiles v4 son casi 2:1 por medición alpha, con variación máxima aproximada de 1.7%. El renderer debe normalizar el frame, no deformar el contenido de cada bbox.
5. Ninguno de estos puntos puede aprobarse sólo viendo el PNG aislado. La aprobación depende de capturas auténticas de runtime y de la rúbrica de `visual_director_qa`.
