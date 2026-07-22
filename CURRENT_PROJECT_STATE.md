# Current Project State

Última actualización: 2026-07-20 — Safe Floor v2 integrado en el Café Biblioteca real.

## Resumen

Syka World evoluciona la alpha jugable hacia un runtime espacial con perfiles dinámicos y UI en inglés. La QA manual invalidó el intento de cubrir el raster aprobado con footprints rectangulares por mueble: los colliders y los recortes visuales no coincidían con sofá, mesas y biblioteca. El Café principal ahora usa un contrato conservador distinto: la imagen aprobada permanece intacta, los muebles horneados son landmarks semánticos y sólo una superficie de pies explícitamente segura admite movimiento. La primera integración real ofrece un pasillo de visitantes entre las mesas y una isla de servicio aislada detrás de la barra; no pretende todavía hacer transitable todo el cuarto.

## Verificado

### Café Biblioteca Safe Floor v2 — 2026-07-20

- integrado directamente en `CafeInteriorScene`, no en otro laboratorio;
- raster aprobado `cafe-interior-v1.png` preservado como arte canónico;
- eliminadas las ocho cajas estáticas que pretendían aproximar individualmente mesas, sofá, cocina y biblioteca;
- muebles horneados conservados como landmarks de interacción; la transitabilidad la define una superficie positiva de pies;
- un pasillo de visitantes de 2 × 6 celdas mantiene a agentes/NPC entre las dos mesas delanteras;
- una isla de servicio separada de 6 × 3 mantiene a Alma/Beni detrás de la barra y fuera del circuito de visitantes;
- sólo la barra conserva un recorte frontal, porque es el único objeto detrás del cual puede colocarse un actor en esta versión;
- eliminado el nudge visual cuando existe una celda física: los pies se dibujan exactamente sobre la posición validada;
- saves con tiles heredados fuera de la nueva superficie se saneán al anchor seguro en vez de revivir dentro de un mueble;
- decoración de piso opcional reubicada en bolsillos visuales fuera del pasillo para no aparecer sobre mesas o plantas;
- QA real en navegador: Syka entra sobre madera visible, avanza con WASD por el pasillo, se detiene en su límite, el NPC de servicio queda oculto correctamente por el frente de barra y salida → reentrada reconstruye la escena en el mismo runtime;
- frontend completo: **281/281 tests PASS**; `npx vite build` PASS con el warning histórico de chunk grande;
- `npm run typecheck` continúa bloqueado únicamente por tres errores preexistentes en `habbo-lab/main.ts` y `qa/alphaQaApi.ts`, fuera de esta integración;
- contrato y límites: `docs/CAFE_SAFE_FLOOR_INTEGRATION_V2_2026-07-20.md`.

### Geometry First Asset Pipeline v3 — 2026-07-20

- sofá verde y mesa redonda generados en llamadas independientes de ImageGen usando la referencia interior aprobada y la cámara del laboratorio;
- ambos assets procesados a transparencia, recortados e integrados mediante el manifiesto compartido;
- primera huella del sofá invalidada por QA manual: reutilizaba el proxy procedural y el pivote alfa desplazaba media silueta fuera de colisión;
- corrección final: pivote centrado y huella completa `2.86 × 1.42`; mesa ampliada a `1.56 × 1.56`;
- clic lateral bloqueado, recorrido sofá → mesa → estantería completado y asiento visible PASS;
- 3 archivos Vitest, 13/13 tests PASS; navegador sin errores ni warnings de aplicación;
- evidencia en `reports/geometry-first-lab-v3/` y detalle en `docs/GEOMETRY_FIRST_ASSET_PIPELINE_V3_2026-07-20.md`;
- conclusión: viable para un conjunto limitado de interactuables; imágenes generadas libremente no permiten eliminar la calibración individual de física.

### Geometry First Asset Pipeline v2 — 2026-07-20

- la estantería procedural fue reemplazada en el laboratorio por una piel pixel-art detallada generada con las dos referencias visuales aprobadas;
- `BOOKSHELF_ASSET` centraliza posición, dimensiones físicas, fuente, escala y altura visual;
- el collider, el modo técnico y el punto seguro de aproximación se derivan del mismo asset, eliminando el doble ajuste manual;
- el personaje mantiene su relieve 2D por píxel y se detiene fuera de la base con margen visual positivo;
- botón **Prueba estantería** y modo **Ver física** validados en navegador;
- 3 archivos de Vitest, 11/11 tests PASS; navegador sin errores o warnings de aplicación;
- evidencia en `reports/geometry-first-lab-v2/` y contrato en `docs/GEOMETRY_FIRST_ASSET_PIPELINE_V2_2026-07-20.md`;
- límite deliberado: solamente la estantería usa el pipeline artístico v2; el resto del cuarto sigue procedural y el Café principal no fue modificado.

### Geometry First Lab v1 — 2026-07-20

- entrada aislada en `http://127.0.0.1:5173/geometry-first-lab.html`;
- Three.js `0.185.1`, WebGL y cámara ortográfica fija sin rotación;
- piso, paredes, sofá, mesa, dos sillas, biblioteca y personaje como entidades espaciales reales;
- personaje con raíz/collider 3D y piel 2D pixel-art con depth testing;
- colisión continua círculo-rectángulo con substeps y sliding;
- clic mediante grafo de visibilidad geométrico, sin A* por tiles ni grilla de navegación;
- delante/detrás y asiento resueltos por z-buffer y anchor físico;
- 5/5 tests y TypeScript aislado PASS;
- WASD físico: 18 posiciones distintas en 18 muestras;
- choque con sofá detenido en `x = 3.1416`, sin penetración;
- clic libre, clic bloqueado, clic sobre sofá, tour de profundidad y asiento PASS;
- Chrome sin errores y documento sin overflow a `1008 × 720` y `390 × 844`;
- evidencia en `reports/geometry-first-lab-v1-*.png`;
- contrato completo en `docs/GEOMETRY_FIRST_LAB_V1_2026-07-20.md`.

El laboratorio demuestra el principio 3D real → presentación pixel-art 2.5D. La aprobación de su identidad visual sigue siendo manual. El Café principal permaneció intacto.

### Visual Contract Lab v1 — invalidado por QA manual

- la QA manual del 2026-07-20 confirmó que la grilla seguía sin coincidir con el arte del sofá, mesa y sillas;
- el depth sort por sprite y los rangos rectangulares seguían produciendo penetración visual;
- se conserva como antecedente técnico, no como base aprobada para el Café;

- entrada aislada en `http://127.0.0.1:5173/visual-contract-lab.html`;
- habitación vacía, sofá, mesa y actor reutilizados como assets separados de alta fidelidad;
- navegación autoritativa sobre microtiles invisibles de medio módulo;
- posición, velocidad, aceleración y frenado continuos con WASD;
- clic con A* sobre grilla y simplificación de waypoints por línea de visión;
- sofá como base completa más frente recortado; asiento con elevación y orden `sofa-base → actor → sofa-front`;
- concepto visual generado guardado en `app/game/public/assets/generated/visual-contract-v1/reference-concept-v1.png`, usado solo como referencia;
- 5/5 tests, TypeScript aislado PASS, 18/18 muestras WASD distintas y paso máximo `0.04956`;
- clic libre, clic bloqueado, detrás/delante, asiento y diálogo de referencia PASS;
- cero errores en Chrome y cero overflow a 1008 px y 390 px;
- evidencia en `reports/visual-contract-lab-v1-*.png` y detalle en `docs/VISUAL_CONTRACT_LAB_V1_2026-07-20.md`.

Sus checks automatizados pasaron, pero no sustituyen la QA visual que lo invalidó. El Café principal permaneció intacto.

### Habbo Contract Lab v1 — 2026-07-20

- entrada aislada en `http://127.0.0.1:5173/habbo-lab.html`;
- habitación procedural de 8 × 7 tiles, un sofá de dos tiles, una mesa y un actor;
- el sofá es una entidad lógica pero posee tres capas de render: `back`, `seat` y `front`;
- clic y WASD solicitan destinos lógicos; A* evita tiles ocupados y el movimiento visible usa tween;
- un anchor de asiento inserta al actor entre `sofa-seat` y `sofa-front`;
- el mismo actor puede renderizarse completamente detrás, entre capas o completamente delante;
- 4/4 tests, TypeScript aislado PASS, clic/WASD físico PASS y navegador sin errores;
- sin overflow horizontal a 1008 px ni 390 px;
- evidencia en `reports/habbo-contract-lab-v1-*.png` y contrato completo en `docs/HABBO_CONTRACT_LAB_V1_2026-07-20.md`.

El laboratorio valida la arquitectura mínima, no el arte definitivo ni la migración del Café. El juego principal no fue modificado.

### Spatial Entity Lab v1 — invalidado por QA manual

- entrada aislada en `http://127.0.0.1:5173/spatial-lab.html`;
- sus tests lógicos pasaron, pero la QA manual mostró penetración visual en barra, mesa, sillas y sofá;
- sus footprints continuos no representaban con suficiente fidelidad el arte generado;
- se conserva únicamente como antecedente y no autoriza a declarar reparado el Café actual.

### Habbo-style spatial runtime (en progreso)

- `core/spatial.ts` extendido con `SpatialRenderPartV1` (back/body/front/overlay/shadow), `SpatialHeightMapV1`, `computeSpatialDepth()` (compositor determinista), `spatialRenderPartDepth()`, `validateSpatialPlacement()` (editor slice con ground/on-entity, stacking, height), pathfinding con `maxElevationStep`, `reservationCapacity` en anchors, `walkableOffsets` en footprints (arches/bridges), `pose` en anchors e interactions;
- 17 tests puros nuevos en `spatial.depth.test.ts`: depth ordering, elevation cliffs, placement validation, capacity, render parts;
- `CafeInteriorScene.ts` integrado con `computeSpatialDepth` y `SPATIAL_DEPTH_SUB_LAYER`: `cafeForegroundDepth` y `actorDepth` usan el compositor determinista;
- `cafeSpatialModel.ts` actualizado: las entidades con `normalizedOcclusionRect` declaran `partsV2` (body/front) explícitamente;
- baseline preservado: 225/225 tests originales siguen pasando.

### Dynamic profiles (en progreso)

- `ProfileId` cambiado de union `"default"|"elen"|"astrelis"|"zerny"` a `string` en `contracts.ts`;
- `CharacterId = string` añadido como identidad interna estable;
- `AgentId` mantenido como union (solo renderer/atlas visual);
- `integrations/profiles.ts` reescrito: `createProfileRegistry()`, `WorldCharacterV1`, `DiscoveredProfileV1`, `SIKORA_PRESET`, `loadPresetIntoRegistry()`, `legacyAgentIdForProfile()`;
- `integrations/mapping.ts` reescrito: acepta `registry?` opcional, perfiles desconocidos del bridge se preservan como discovered-but-unassigned;
- `integrations/types.ts` actualizado: `BridgeVisualAgent.characterId` y `displayName` ahora son `string`;
- 13 tests nuevos en `profiles.test.ts`: discovery, offline preservation, unknown profiles, rename, preset load, no hardcoded paths;
- `config/presets/sikora-world.json` creado (preset portable);
- `core/agents.ts`: `ALPHA_PROFILE_IDS` y `createAlphaAgents` defensivo;
- `CityScene.focusAgent` acepta `string` (profileId o agentId);
- `main.ts` corregido para no asumir que profileId es AgentId;
- tests de mapping actualizados para reflejar comportamiento dinámico.

### UI English (en progreso)

- `ui/model.ts` traducido completamente al inglés: activity labels, mode labels, day/time, destination/location, palette disabled reasons, exterior hints, local order labels, interior action labels, world object labels, locked sector, slot labels, error messages, building status, bridge mode labels/hints, presence labels;
- `ui/model.test.ts` actualizado al inglés;
- `README.md` reescrito en inglés con product explanation, dynamic profiles section, controls, validation y limits.

### Cierre técnico vigente

- frontend: **281/281 tests PASS**;
- bundle Vite: **PASS**;
- typecheck global: bloqueado por tres errores preexistentes de laboratorios/QA, no por Café Safe Floor v2;
- Python/bridge/simulación: **39/39 tests**;
- warning conocido de chunk >500 kB conservado;
- dev server verificado: arranca en `http://127.0.0.1:5173/`, sirve HTML en inglés (`lang="en"`), HTTP 200;
- UI completamente en inglés: model, DOM, HTML, errores, sectores, labels espaciales;
- reporte final en `reports/habbo-spatial-v1/FINAL_REPORT.md`.

## Provisional, no contrato final

- Avatares, pets, especies y siluetas de Syka, Elen, Astrelis y Zerny;
- Kit visual `alpha-v1`;
- Nombre y balance de `Lumens`;
- Optimización del bundle: el chunk principal conserva el warning de Vite por superar 500 kB;
- `createAlphaUi.ts` y `CafeInteriorScene.ts` pueden contener strings en español pendientes de traducción.

## No realizado en este pass

- Café vertical slice modular detrás de flag (gate scene con counter/table multi-part separada);
- Placement editor slice conectado a la UI (el contrato `validateSpatialPlacement` existe pero no está conectado al renderer);
- Compositor depth aplicado a entidades exteriores (tree/bench/lamp);
- E2E físico en navegador, capturas, video, medición de FPS y auditoría de red;
- Traducción completa de `createAlphaUi.ts` y strings del Café;
- Interiores modulares de casas, oficinas o taller;
- Editor de habitaciones tipo Habbo, multiplayer, chat, relaciones, necesidades o misiones;
- Despliegue público conectado a Hermes o empaquetado desktop.

## Public Build Week snapshot — 2026-07-21

- El árbol fue auditado antes del primer commit: secretos, identificadores personales, rutas absolutas, archivos pesados, ignores y procedencia visual.
- Los diagnósticos locales y metadatos internos quedaron excluidos mediante `.gitignore`.
- Software: MIT. Assets visuales originales del proyecto: CC BY 4.0, con provenance preservado.
- Verificación fresca: frontend 281/281 PASS, Python 39/39 PASS, typecheck PASS y build Vite PASS con el warning conocido de chunk principal mayor a 500 kB.
- El snapshot se publica como alpha incompleta; no implica despliegue conectado a Hermes ni producto final.

## Siguiente etapa recomendada

### Presentation media — 2026-07-21

- Nueva portada `docs/media/syka-world-future-vision-hero-v1.png`, generada a partir de las cuatro referencias visuales aprobadas y rotulada explícitamente como concept art, no gameplay.
- Recorrido fresco del alpha grabado desde el build local: ciudad al atardecer, entrada al Café Biblioteca y regreso. El master verificable queda en `reports/e2e/alpha-v1/syka-world-alpha-tour.webm`; la presentación usa MP4 y GIF derivados bajo `docs/media/`.
- Dos frames del mismo recorrido documentan ciudad e interior actuales; el README separa evidencia jugable de visión futura.
- Las cuatro maquetas aprobadas de `research/visual-concepts/approved-direction-v1/` ahora aparecen en el README con una explicación concreta del futuro buscado.
- El runner `record_alpha_tour.py` acepta `SYKA_E2E_BASE_URL`, necesario para no interferir con otro proyecto que ocupaba `5173`; Syka World fue validado en `5188` y ese puerto quedó cerrado al finalizar.
- MP4 verificado: H.264, 1440×900, 15,92 s después de recortar la carga inicial. No se realizó commit ni push de estos cambios de presentación.

- ampliar la superficie segura solamente con corredores visualmente calibrados y evidencia por corredor;
- decidir si el Café final conserva esta solución raster + safe floor o migra por módulos al pipeline geometry-first;
- Completar la traducción de `createAlphaUi.ts` al inglés;
- Lanzar dev server y ejecutar E2E físico: click, WASD, E, F, placement, perfiles dinámicos, save/reload;
- Capturar screenshots en 640×720, 1008×548, 1440×900 y 2560×1080;
- Medir FPS en ciudad y café;
- Auditar tráfico de red del bridge (GET-only, sin body);
- Crear el directorio `reports/habbo-spatial-v1/` con evidence package completo;
- Implementar el placement editor slice en el renderer;
- Aplicar el compositor depth a entidades exteriores representativas.
