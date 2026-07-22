# Syka World — procedencia del kit raster Alpha v1

Fecha: 2026-07-16  
Estado global: **assets provisionales de integración; no son avatares definitivos ni equivalencia pixel por pixel con las referencias**.

## Herramienta y autoría

- Todos los nuevos raster de esta carpeta fueron generados específicamente para Syka World con la herramienta integrada `image_gen`.
- No se usó CLI, API externa, pack comercial, modelo descargado ni asset de un juego publicado.
- Cada generación se hizo sobre fondo uniforme `#FF00FF`; la fuente chroma se conserva junto al PNG RGBA.
- La extracción se realizó localmente con `remove_chroma_key.py --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`.
- Los atlas finales se normalizaron con nearest-neighbor, crops medidos y pivote declarado. No se usó filtrado suave.

## Referencias y límites

Las imágenes de `research/visual-concepts/approved-direction-v1/` se usaron sólo como referencias de cámara, densidad, paleta, iluminación y narrativa de objetos. La casa y cafetería de `generated/gate-v2/` se usaron como anclas originales de la familia Syka. No se recortó ni copió arquitectura, mobiliario o layout de Whisper of the House, MiniTown u otro juego.

Para identidad provisional se consultaron únicamente como referencias:

- Elen: contact sheet local de su pet Hermes, reinterpretada como humana delgada a escala de mundo;
- Astrelis: pet local `black-cat-1`, sin copiar frames ni conservar sus ojos/cabeza sobredimensionados;
- Zerny: pet local `shrimpy-keys`, preservando camarón rojo y lentes, sin copiar frames ni teclado;
- Syka: forma neutral azul/crema sin especie permanente.

Estos cuatro sets son placeholders reemplazables. No fijan la identidad visual definitiva.

## Licencia

Clasificación actual: **Syka World project-generated asset**, publicado bajo CC BY 4.0 según `ASSET_LICENSE.md`. Este registro de procedencia no sustituye asesoramiento jurídico para usos comerciales específicos.

## Prompt común de producción

Todos los prompts usaron esta base, más el pedido específico de cada familia:

```text
Use case: stylized-concept.
Asset type: original modular isometric pixel-art game asset for Syka World runtime.
Match only the established Syka World fixed 2:1 camera, crisp pixel density, contour weight, cozy cream/wood/coral/green palette, dark slate roofs and upper-left twilight lighting. Do not copy any referenced building, prop, frame, room or layout.
Scene/backdrop: perfectly flat uniform solid #FF00FF chroma-key edge-to-edge; no ground plane, grid, texture, gradient, halo, vignette, shadow or lighting variation.
Style: crisp handcrafted isometric pixel art, deliberate rectangular clusters, hard readable edges; not 3D rendered, low-poly, vector, painterly, chibi or Funko.
Constraints: original design; no readable text, logos, watermark, UI, blur, soft bloom, depth of field, copied commercial-game asset or #FF00FF inside the subject.
```

## Prompts específicos usados

### Edificios

```text
Marketing: one finished 4x4 creative studio with asymmetrical slate atelier roof, cream/timber/coral façade, broad amber windows, abstract color-swatch boards, sample table, rolls, plants and roof trellis; all details attached to the footprint.

Commercial: one finished 4x4 elegant client-facing office with formal balanced façade, shallow slate hip roof and cupola, cream/coral masonry, symmetric meeting-room windows, double entrance, brass lamps, clipped planters and small conversation nook.

CRM workshop: one finished 5x4 broad workshop with clerestory roof, roll-up door, separate amber personnel door, visible archive room, loading bay, blank boxes, tool silhouettes, workbench, ladder and hand truck; clearly non-residential.

Community hall: one finished 5x4 welcoming L-shaped community house with gathering windows, accessible double entrance, covered veranda, benches, book exchange, blank noticeboard, climbing plants, planters, tiny basin and reading table.
```

La generación comunitaria añadió texto al cartel pese a la prohibición. En la normalización se reemplazó todo el cartel por un panel original de madera/crema con tres muestras abstractas coral, verde y azul; el PNG final no conserva texto.

### Construcción

```text
Exactly three isolated stages in a horizontal sheet: 4x4 foundation with footing/materials/toolbox; same-footprint timber framing with scaffold, ladder and covered materials; near-complete finishing stage with partial slate roof, installed amber window, remaining scaffold, paint bucket and planter. No labels.
```

### Agentes provisionales

```text
Syka: four consistent small poses — idle, walkA, walkB, working with notebook — species-neutral slim blue-gray hood/cowl, narrow cream panel, dark legs and coral clasp; no face species cues.

Elen: four consistent small human poses — idle, walkA, walkB, working with clipboard/phone — long brown hair, slim coral jacket, cream top and dark narrow clothes; adult proportions, no giant head.

Astrelis: four consistent proportional black-cat poses — seated idle, walkA, walkB, working beside a tiny ledger — natural quadruped anatomy, long tail, discreet amber eyes and pale-green inner ears; no giant oval eyes.

Zerny: four consistent small shrimp poses — idle, scuttleA, scuttleB, working with tiny tablet — red-orange segmented shell, black square glasses, antennae and curled tail; no keyboard or oversized head.
```

El atlas runtime 8x4 conserva esas cuatro poses fuente y las mapea a `idle`, `thinking`, `using-tool`, `waiting`, `done`, `interrupted`, `error` y `offline`. El mapping y las transformaciones de color están declarados en `agents-sheet-v1.manifest.json`; no se deformó geometría para inventar estados.

### Cafetería interior y decoración

```text
Interior: one isolated fully furnished café cutaway, no characters, with service counter, espresso/back kitchen, pastry case, four table groups, floor-to-ceiling library and ladder, fireplace lounge, plants, art without text, tableware, rugs and warm lamps. Two windows show a simplified twilight Syka neighborhood; never a black void.

Optional decor: exactly six isolated sprites in a 3x2 sheet — side table with warm lamp, tall plant, books with mug, woven rug, abstract framed print, tea service — coherent scale and no complete room.
```

### Correcciones ambientales solicitadas por Sikora

```text
Exactly eight isolated sprites in a 4x2 sheet: two slim compact lamps for opposite sidewalk edges/corners; two small narrow benches aligned to opposite isometric axes; four sparse grass overlays (motes, leaves, three flowers, tonal patch). Lamps/benches intentionally smaller than Gate v2; grass subtle and seam-safe; no complete tile, road, fountain or water feature.
```

## Inventario y estado

| Entregable | Dimensiones | Contrato | Estado |
|---|---:|---|---|
| `buildings-sheet-v1.png` | 3072×512 | 6×1, frame 512×512 | candidato integrado; casa/café reutilizan assets originales Gate v2, cuatro edificios nuevos |
| `construction-sheet-v1.png` | 1536×512 | 3×1, frame 512×512 | candidato integrado; tres etapas visibles |
| `agents-sheet-v1.png` | 512×512 | 8×4, frame 64×128 | placeholders provisionales; no avatares aprobados |
| `cafe-interior-v1.png` | 1774×887 | escena aislada | candidato integrado; completamente amueblado y sin fondo negro |
| `cafe-optional-decor-sheet-v1.png` | 1536×1024 | 3×2 | seis decoraciones opcionales y aliases de catálogo |
| `environment-corrections-sheet-v1.png` | 1611×976 | 4×2 con crops variables | candidatos para corregir escala/ubicación de farolas, bancos y microdetalle de césped |

Los PNG individuales y filas base se conservan para reempaque y auditoría. Los `*-chroma.png` no deben cargarse en runtime.

## Normalización y QA

- `buildings-sheet-v1.png`: orden exacto `home`, `cafe`, `marketing-office`, `commercial-office`, `crm-workshop`, `community-hall`; cada sprite está centrado abajo y precompensado para los `setDisplaySize` actuales. Los draw sizes de runtime reservan un borde de césped visible dentro de la parcela antes de cualquier carretera.
- `construction-sheet-v1.png`: se conserva `construction-sheet-v1-source.png` y su chroma fuente antes del atlas normalizado.
- `agents-sheet-v1.png`: orden de filas `syka`, `elen`, `astrelis`, `zerny`; orden de columnas igual a `AGENT_ACTIVITY_ORDER`.
- Los seis manifests declaran crops, draw sizes, footprints, alias semántico y pivotes según corresponda.
- Las correcciones ambientales prohíben expresamente farolas en asfalto/centro de calle, bancos fuera de zona peatonal y cualquier fuente.
- Todos los candidatos se inspeccionaron a resolución original. La aprobación artística final depende de capturas reales del juego y del veredicto independiente de `visual_director_qa`.
