# Tareas de Syka World

Última actualización: 2026-07-20 — Café Biblioteca Safe Floor v2 integrado.

## Café Biblioteca Safe Floor v2 — terminado

- [x] Integrar la solución en el Café principal sin reemplazar el raster aprobado.
- [x] Sustituir footprints rectangulares por una superficie positiva de pies.
- [x] Separar pasillo de visitantes e isla de servicio detrás de barra.
- [x] Mantener únicamente el recorte frontal de la barra.
- [x] Eliminar nudges visuales para actores con celda física.
- [x] Sanear tiles persistidos heredados fuera de la superficie segura.
- [x] Reubicar decoración de piso fuera del pasillo y de las mesas.
- [x] Validar entrada, WASD, límite de movimiento, bartender y salida → reentrada en navegador real.
- [x] Ejecutar 281/281 tests y bundle Vite PASS.

Límite aceptado: esta v2 habilita un pasillo central seguro, no toda la habitación. La expansión futura debe agregar corredores pequeños con QA visual; no vuelve el modelo de una caja por mueble.

## Habbo Spatial Public Foundation v1 — en progreso

Plan completo: `docs/GOAL_HABBO_SPATIAL_PUBLIC_FOUNDATION_V1.md`.

### Contratos espaciales extendidos — hecho

- [x] Extender `core/spatial.ts` con `SpatialRenderPartV1` (back/body/front/overlay/shadow con depthOffset).
- [x] Añadir `SpatialHeightMapV1` (per-cell elevation) y pathfinding con `maxElevationStep`.
- [x] Implementar `computeSpatialDepth()` — compositor determinista con elevation + subLayer + tieBreaker.
- [x] Implementar `spatialRenderPartDepth()` para multi-part furniture.
- [x] Implementar `validateSpatialPlacement()` — editor slice (ground/on-entity, stacking, height).
- [x] Añadir `reservationCapacity` en anchors, `walkableOffsets` en footprints, `pose` en anchors e interactions.
- [x] Crear `spatial.depth.test.ts` con 17 tests puros: depth ordering, elevation cliffs, placement validation, capacity, render parts.
- [x] Integrar `computeSpatialDepth` y `SPATIAL_DEPTH_SUB_LAYER` en `CafeInteriorScene.ts`.
- [x] Actualizar `cafeSpatialModel.ts` para declarar `partsV2` en entidades con occlusion rect.
- [x] Preservar baseline: 225/225 tests originales siguen pasando.

### Perfiles dinámicos — hecho

- [x] Cambiar `ProfileId` de union a `string` en `contracts.ts`.
- [x] Añadir `CharacterId = string` como identidad interna estable.
- [x] Reescribir `integrations/profiles.ts`: `createProfileRegistry()`, `WorldCharacterV1`, `DiscoveredProfileV1`, `SIKORA_PRESET`.
- [x] Implementar `loadPresetIntoRegistry()`, `legacyAgentIdForProfile()`.
- [x] Reescribir `integrations/mapping.ts`: acepta `registry?` opcional, unknowns preservados.
- [x] Actualizar `integrations/types.ts`: `characterId`/`displayName` como `string`.
- [x] Crear `profiles.test.ts` con 13 tests: discovery, offline, unknown, rename, preset, no hardcoded paths.
- [x] Crear `config/presets/sikora-world.json` (preset portable).
- [x] Corregir `core/agents.ts`, `CityScene.focusAgent`, `main.ts` para acceptar strings.
- [x] Actualizar tests de mapping al comportamiento dinámico.

### UI English — hecho

- [x] Traducir `ui/model.ts` completamente al inglés.
- [x] Actualizar `ui/model.test.ts` al inglés.
- [x] Reescribir `README.md` en inglés con dynamic profiles section.
- [x] Traducir `ui/createAlphaUi.ts` al inglés (buttons, labels, toasts, errors).
- [x] Actualizar `ui/createAlphaUi.dom.test.ts` al inglés.
- [x] Traducir `index.html` al inglés (`lang="en"`, aria-labels, loading text).
- [x] Traducir sector names en `core/map.ts` y `core/state.ts` al inglés.
- [x] Traducir spatial error labels en `main.ts` y `CityScene.ts` al inglés.

### Cierre técnico vigente

- frontend: **281/281 tests**;
- typecheck y build: **PASS**;
- Python/bridge/simulación: **39/39 tests**;
- warning conocido de chunk >500 kB conservado.

## No realizado en este pass

- [ ] Café vertical slice modular detrás de flag (gate scene con counter/table multi-part separada).
- [ ] Placement editor slice conectado a la UI (`validateSpatialPlacement` existe pero no está wired).
- [ ] Compositor depth aplicado a entidades exteriores (tree/bench/lamp).
- [ ] E2E físico en navegador, capturas, video, medición de FPS y auditoría de red.
- [ ] Evidence package en `reports/habbo-spatial-v1/`.
- [ ] Interiores modulares de casas, oficinas o taller.
- [ ] Editor de habitaciones tipo Habbo, multiplayer, chat, relaciones, necesidades o misiones.
- [x] Preparar y validar el primer snapshot público de Build Week por autorización posterior del usuario.

## Límites vigentes

- No desplegar una instancia conectada a Hermes sin una revisión de seguridad separada.
- No iniciar tareas reales desde Syka World.
- Mantener el bridge GET-only.
- No fijar pets o avatares por conveniencia del prototipo.
- No copiar código o assets sin licencia compatible.
- No ocultar el warning de bundle ni presentar assets provisionales como arte final.

---

## Pasadas anteriores (completadas)

### Foundations v1 — terminado

- [x] Auditar Hermes 0.18.2 y sus bases por perfil en sólo lectura.
- [x] Implementar bridge v0.3 con plugin primario y fallback SQLite.
- [x] Persistir checkpoints, presencia, concurrencia y diagnósticos seguros.
- [x] Cubrir las 13 pruebas de caos requeridas.
- [x] Separar bridge, contratos, simulación y renderer.
- [x] Definir Game Design v0.1, economía, progresión, necesidades y misiones.
- [x] Ejecutar escenarios deterministas de 1, 7 y 30 días.
- [x] Auditar referencias, licencias y piezas rescatables.
- [x] Preservar el laboratorio 3D como experimento separado.

### Isometric Playable Alpha v1 — terminado

- [x] Crear `app/game` sin promover `lab/visual`.
- [x] Integrar Phaser 4.2.1, proyección fija, depth sorting, pan y tres zooms sin rotación.
- [x] Crear art bible, gate visual y kit raster modular con manifests/provenance.
- [x] Implementar modo Muestra y Nueva partida.
- [x] Implementar catálogo, compra, placement, acceso y construcción por etapas.
- [x] Implementar Lúmenes, saldo insuficiente, mejora de cafetería y expansión de sector.
- [x] Implementar día, atardecer y noche.
- [x] Crear Café Biblioteca con interior aislado, amueblado y decoración opcional.
- [x] Conservar cámara, hora y estado al entrar/salir.
- [x] Integrar cuatro agentes placeholder y rutinas locales.
- [x] Implementar ocho estados visuales y recompensa moderada.
- [x] Permitir ocultar habitantes sin pausar la simulación.
- [x] Conectar bridge GET-only con reconexión y fallback local.
- [x] Implementar save/load versionado y migración segura.
- [x] Separar QA local; sus atajos nunca alcanzan Hermes.
- [x] Corregir farolas, bancos, microdetalle del pasto y retirar la fuente pública deficiente.
- [x] Calibrar las seis huellas visuales, corregir Casa acogedora a 4×3 y ajustar offsets/contacto con terreno.
- [x] Fijar `north` como única orientación visual real y eliminar la falsa rotación.
- [x] Implementar viewport lógico adaptativo de alto 450 y ancho 720–1080, sin deformar el pixel art.
- [x] Convertir la UI en un shell editorial/contextual y validarlo en 1008×548, 1440×900 y 2560×1080.
- [x] Fijar bias vertical de cámara en 12, sincronizar el clic de parcela y separar porches/escalones de las carreteras.
- [x] Hacer responsive el interior y reemplazar áreas rectangulares visibles por hotspots localizados.
- [x] Implementar el loop espacial inicial a 3 min/tile y equivalencia minuto a minuto.
- [x] Separar caminar de trabajar y exponer ruta, destino, ubicación y ocupantes de forma legible.
- [x] Explicar el bloqueo espacial y no atribuir ocupación cuando el workplace todavía no está construido.
- [x] Reconciliar snapshot en bootstrap/reconexión y conservar completion hasta la llegada al workplace.
- [x] Reubicar las cuatro casas de Muestra entre carreteras y validar que ningún occupied tile use terreno road.
- [x] Rechazar guardados viejos con huellas sobre terreno no construible en vez de cargar geometría inválida.
- [x] Cerrar la separación visual casas/edificios–carreteras corrigiendo el dibujo runtime, sin modificar huellas ni roads.
- [x] Fijar calibraciones runtime canónicas.
- [x] Reemplazar el falso positivo del gate lógico por `app/game/e2e/visual_road_clearance_e2e.py`.
- [x] Exigir al menos un píxel real de pasto y obtener PASS 9/9.
- [x] Validar 103/103 unit/frontend, typecheck y build en la pasada final.
- [x] Completar E2E final PASS en 1008×548 y 1440×900.
- [x] Mantener como evidencia histórica 39/39 Python y 14/14 E2E del cierre alpha anterior.
- [x] Medir rendimiento, carga, heap, objetos y draw calls.
- [x] Obtener QA visual independiente: 86,2/100, aprobado para alpha.
- [x] Confirmar 0 errores de navegador/assets y cerrar puertos 5173/4173.
- [x] Documentar arranque, evidencia, límites y provisionales.

### Mechanic Integration Pass v1 — terminado

Plan completo: docs/GOAL_MECHANIC_INTEGRATION_PASS_V1.md.

- [x] Resolver bindings dinámicos para edificios construidos con IDs generados.
- [x] Dar movimiento ambiental a los agentes cuando faltan destinos.
- [x] Conectar XP de ciudad y desbloqueos a completions reales de forma idempotente.
- [x] Convertir vegetación y mobiliario grande en objetos persistentes y bloqueantes.
- [x] Mostrar limpieza de vegetación y coste antes de confirmar construcción.
- [x] Previsualizar y crear un conector vial automático hasta el acceso, a 3 Lúmenes por tile.
- [x] Permitir acelerar una hora o terminar ahora pagando Lúmenes.
- [x] Hacer visible la mejora del Café Biblioteca en el arte exterior.
- [x] Implementar orden local Ir al Café, trayecto, entrada por anchors, acción y salida.
- [x] Reemplazar labels de hotspots por acciones contextuales.
- [x] Agregar categoría Exterior con nueve objetos comprables y retiro con reembolso del 50%.
- [x] Separar iluminación de día, atardecer y noche y eliminar pools gigantes.
- [x] Rediseñar de forma acotada los flujos de construcción, agentes e interior.
- [x] Agregar microfauna ambiental sin colisión: gorriones, mariposas y caracol.
- [x] Validar Nueva partida mediante interacción física de navegador, save/load y capturas.
- [x] Obtener 138/138 frontend, 39/39 Python, typecheck/build y gate raster 9/9 en PASS.
- [x] Obtener E2E físico 11/11 PASS, siete colocaciones, responsive 1008×548/2560×1080, bridge 8 GET-only y cero errores de navegador/HTTP.
- [x] Registrar que el usuario anuló el timebox original; el cierre se realizó por criterios de aceptación y evidencia.

### Café Actor Runtime follow-up — terminado

- [x] Generar el elenco aprobado de Alma, Beni, Iara, Milo y Noa y normalizarlo a un atlas runtime 5×4 con celdas 128×160.
- [x] Preservar fuente chroma, transparencia, manifest, hashes, prompt y provenance en `app/game/public/assets/generated/npc-v1/`.
- [x] Implementar cinco rutinas NPC locales, deterministas y completamente separadas de perfiles, sesiones, recompensas y tareas Hermes.
- [x] Limitar la ocupación del Café a un máximo de tres NPC simultáneos y dejarlos fuera de escena si el Café no está terminado.
- [x] Corregir la escala responsive de protagonistas y NPC dentro del Café.
- [x] Reubicar los dos helechos opcionales sobre piso seguro, separados de mesas y otras plantas.
- [x] Hacer visible la entrada de agentes al Café y registrar entrada lógica a hogares sin inventar todavía interiores residenciales.
- [x] Acelerar el loop espacial a 2 min/tile en rutina y 1 min/tile para Ir al Café.
- [x] Suavizar la interpolación exterior, eliminar el avance por saltos y respetar 1×/2×/4×.
- [x] Mejorar las mariposas con tres poses y deriva orgánica determinista.
- [x] Mantener Construir como CTA persistente y convertirlo en Volver a la ciudad dentro del Café.
- [x] Agregar una galería accesible de cuatro maquetas mediante Referencias.
- [x] Normalizar por silueta la escala de los cuatro perfiles y los cinco NPC, con pies anclados y sombras de contacto.
- [x] Agregar oclusión física de barra, mesas y sofá mediante cinco recortes de primer plano del raster.
- [x] Permitir que varios agentes reales y NPC compartan el Café sin ocupar el mismo anchor.
- [x] Habilitar salida del Café mediante B, Esc y botón visible.
- [x] Agregar tránsito exterior persistido para NPC: borde conectado → ruta → Café → ruta de salida.
- [x] Renderizar NPC caminando por la ciudad con escala, sombra, profundidad y transición coherentes.
- [x] Mejorar la base isométrica con espesor de tierra, sombra, pasto sutil y vallas perimetrales seguras.
- [x] Validar 167/167 unit/frontend, typecheck, build y navegador físico responsive.
- [x] Obtener E2E Café Actor Runtime v2 PASS con dos agentes, dos NPC, oclusión, helechos, salida B y bridge GET-only.
- [x] Obtener City Base E2E PASS en 1440×900, 1008×548 y 640×720 con NPC en tránsito.

### Interior Entity & Possession Pass v1 — terminado

Plan completo: `docs/GOAL_INTERIOR_ENTITY_AND_POSSESSION_PASS_V1.md`.

- [x] Definir runtime espacial tipado compartido: escenas, entidades, footprints, walk grid, anchors, interacciones, portales, ocupación, reservas y depth/occlusion.
- [x] Integrar ciudad y Café Biblioteca sin reconstruir la ciudad ni degradar el raster aprobado del interior.
- [x] Convertir barra, cocina, mesas, sillas, sillones, biblioteca, chimenea, plantas y decoración bloqueante del Café en objetos espaciales consultables.
- [x] Implementar selección y movimiento por clic en ciudad e interior, con destino discreto, pathfinding y rechazo de casillas bloqueadas.
- [x] Mantener la orden por clic durante tres segundos al llegar y reanudar después la rutina autónoma.
- [x] Implementar Poseer mediante botón o P, movimiento cardinal WASD y cola acotada frente a key repeat.
- [x] Implementar E con ruta al anchor exacto, sin teletransporte a otro asiento o interacción.
- [x] Implementar F para portales válidos y Esc para liberar primero; libre dentro del Café, la salida enruta hasta la puerta.
- [x] Reconciliar ocupación de agentes/NPC de forma determinista sin compartir casilla o anchor ni perder rutas manuales por un refresh de escena.
- [x] Derivar profundidad/oclusión desde entidades y posición de suelo, preservando las capas de arte aprobadas.
- [x] Persistir escena/casilla real y no persistir la posesión activa tras save/reload.
- [x] Ignorar controles de juego con inputs editables enfocados y conservar pan, zoom, Construir y flujos existentes.
- [x] Validar frontend 225/225, typecheck/build y Python 39/39 en PASS; conservar el warning documentado de chunk >500 kB.
- [x] Obtener E2E físico 14/14 pasos PASS.
- [x] Auditar ocho requests del bridge: todas GET, sin body, cero writes y cero tareas Hermes.
- [x] Generar capturas y video final exacto de 20.000 s a 1440×900.
- [x] Actualizar documentación operativa y espejo Obsidian con el estado real.
- [x] Incorporar auditoría independiente histórica PASS 15/15 para su alcance.
- [x] Registrar ciudad a 53,99 FPS como riesgo menor no bloqueante y Café a 56,89 FPS.
- [x] Confirmar 5188 cerrado y preservar intacto el servidor preexistente 5173.

### Regresión de integridad y reentrada del Café — terminada

- [x] Reproducir la corrupción después de entrada → salida → reentrada dentro del mismo Phaser.Game.
- [x] Fijar el fondo interior al frame explícito alpha-cafe-interior/__BASE.
- [x] Destruir y vaciar vistas de agentes/NPC, tweens, capas de primer plano y referencias de escena durante shutdown.
- [x] Eliminar las cuatro casillas transitables aisladas y mover la entrada a {16,17} con W libre.
- [x] Renderizar agentes desde la celda autoritativa del controlador espacial.
- [x] Añadir prueba unitaria de conectividad total y ruta visual cardinal.
- [x] Añadir app/game/e2e/cafe_reentry_regression_e2e.py.
- [x] Repetir frontend 225/225, Python 39/39, typecheck/build, regresión same-runtime y E2E físico 14/14 en PASS.
- [x] Registrar evidencia en reports/cafe-runtime-regression/ y sincronizar documentación.
