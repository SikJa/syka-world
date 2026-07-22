# Interior Entity & Possession Pass v1 — auditoría baseline

Fecha: 2026-07-17  
Rol: QA independiente, sólo lectura sobre código de producto  
Goal auditada: `docs/GOAL_INTERIOR_ENTITY_AND_POSSESSION_PASS_V1.md`

## Resultado ejecutivo

El baseline actual está sano y es reutilizable, pero todavía **no implementa el circuito espacial P0 de la goal**. La ciudad tiene agentes, rutas cardinales deterministas, selección, rutinas y movimiento visual continuo; el Café tiene actores, cinco NPCs locales, anclas semánticas, hotspots, profundidad por `y` y cinco recortes de oclusión. Sin embargo, no existe todavía una grilla interior física, registro común de entidades/footprints, click-to-move, posesión, WASD, interacción por `E`, portales por `F` ni ocupación compartida por celda.

Esto no es un diagnóstico de regresión: la suite vigente está verde. Es una brecha entre lo que comprueban los tests actuales y el nuevo contrato de producto.

No se modificó código de producto, UI, bridge ni Hermes. No se inició ninguna tarea real. El único archivo creado por esta auditoría es este informe.

## Estado de verificación

| Comprobación | Resultado fresco |
|---|---|
| `npm run typecheck` en `app/game` | PASS |
| `npm test` en `app/game` | PASS — 25 archivos, 167/167 tests |
| `npm run build` en `app/game` | PASS — Vite 8.1.5; aviso no bloqueante por chunk de 1,597.76 kB |
| `.venv\Scripts\python.exe -m unittest discover -s tests -v` | PASS — 39/39 tests |
| Navegador físico Chromium, 1440×900, `?qa=1` | Ejecutado; sin page errors ni respuestas HTTP fallidas |
| Bridge observado durante el flujo | 4 requests; todos `GET`, sin body |
| Estado Git | rama `main` sin `HEAD`; checkout inicial completamente untracked |

La sesión física se ejecutó sobre el servidor Vite ya activo en `127.0.0.1:5173`; no se reinició ni se cerró ese proceso. Se interceptó el bridge con el stub controlado que ya usa el proyecto. El tiempo quedó pausado antes de comparar estados para evitar falsos cambios por rutina.

## Baseline físico reproducido

### Ciudad

1. Se abrió `?qa=1`, se pausó el reloj desde el botón visible y se seleccionó físicamente la tarjeta de Syka.
2. La UI mostró su inspector y el botón `Ir al Café`; no apareció ningún botón o texto `Poseer`.
3. Se hizo clic físico sobre el canvas, con Syka seleccionado.
4. Posición, destino, path, location y orden local quedaron exactamente iguales antes y después.

Evidencia del estado congelado:

- Syka estaba en `{x:4,y:7}`.
- Su destino de rutina seguía siendo `{x:14,y:20}`.
- El path de 24 nodos no cambió.
- `localOrder` siguió ausente.

Conclusión: seleccionar un agente funciona; hacer clic en el suelo no crea una orden de movimiento.

También se comprobó el conflicto de teclado vigente: `B` abrió el catálogo de construcción y `E` lo cerró. Hoy `E` significa Explore/cancelar herramienta, no interacción contextual.

### Orden actual al Café

Se usó físicamente `[data-agent-action="go-to-cafe"]`. La acción creó correctamente una orden local:

```text
kind: go-to-cafe
targetBuildingId: cafe-main
action: serve-coffee
phase: traveling
```

Para preparar el escenario interior sin esperar tiempo real se adelantaron 13 minutos mediante QA. Ese número es sólo preparación de fixture; no es una medición de velocidad percibida. Syka llegó al Café con location `interior`, `buildingId: cafe-main`, `anchorId: entry`.

### Café

Se seleccionó `cafe-main` mediante la superficie QA y se pulsó físicamente `Entrar al Café Biblioteca`. En 1440×900 se observó:

| Elemento | Evidencia runtime |
|---|---|
| Escena activa | `cafe-interior` |
| Raster de sala | 588×294 px en `{x:66,y:92}` |
| Syka | 20×40 px, frame `agent-syka-idle`, depth 945 |
| Alma Ríos | 29×36 px, frame de trabajo |
| Milo Niebla | 28×35 px, frame social |
| Hotspots | 4 regiones grandes |
| Recortes de oclusión | 5 |
| Botones `Poseer` | 0 |

El tamaño actual reproduce la impresión reportada por Sikora: Syka mide 40 px de alto dentro de una sala de 294 px y sólo 20 px de ancho. El test vigente considera válido un rango aproximado de 38–48 px, por lo que la suite pasa aunque la escala percibida siga siendo demasiado pequeña. Esto es un desajuste entre el gate automatizado y la dirección visual, no un fallo de carga del sprite.

Con Syka dentro del Café se hizo clic físico sobre el suelo y luego se pulsaron `P`, `D` y `F`. Location, destino y orden local quedaron idénticos; la escena siguió abierta. Después se pulsó `B` y el Café se cerró inmediatamente. Hoy no existe una primera capa de `Esc/B = liberar posesión`: al no haber posesión, `B`/`Esc` llaman directamente a salir.

Las muestras de rendimiento instantáneas fueron 52.63 FPS en ciudad y 52.79 FPS en Café, con instrumentación E2E activa. Están por debajo del objetivo 55–60, pero una muestra headless corta no es suficiente para declarar un fallo de rendimiento. Debe repetirse como medición sostenida en el gate final.

No hubo errores de página ni respuestas fallidas. Chromium emitió únicamente sus advertencias conocidas de driver `ReadPixels` durante captura/instrumentación.

## Qué existe y conviene conservar

### Core y simulación

- `app/game/src/core/pathfinding.ts`: A* cardinal determinista y limitado. Es una base buena para extraer una consulta genérica de transitabilidad.
- `app/game/src/core/agents.ts`: cuatro agentes canónicos, horarios, rutas exteriores, órdenes al Café y reserva básica de anclas.
- `app/game/src/core/npcs.ts`: cinco NPCs locales con horarios, tránsito exterior e ingreso/egreso del Café.
- `app/game/src/core/save.ts`: persistencia validada de agentes, NPCs, rutas, interiores y órdenes locales.
- `app/game/src/application/AlphaRuntime.ts` y `GameController.ts`: frontera pública adecuada para agregar acciones locales sin tocar Hermes.

Riesgo a corregir al generalizar pathfinding: `pathfinding.ts` permite actualmente aceptar el vecino que es goal sin aplicar `isWalkable` a ese último tile. Las llamadas actuales usan accesos controlados; click-to-move genérico debe validar el destino o endurecer esa condición.

### Presentación de ciudad

- `CityScene.focusAgent()` selecciona y encuadra sin destruir la composición.
- El renderer interpola el movimiento exterior en vez de saltar visualmente tile a tile.
- El input de ciudad ya distingue click de drag, pero en `pointerup` sólo confirma placement o pan; no despacha una orden de agente.
- La ruta seleccionada ya tiene visualización, reutilizable para el nuevo destino manual.

### Presentación del Café

- El arte actual conserva densidad, madera, biblioteca, chimenea e iluminación cálida.
- Agentes y NPCs usan sprites separados, contacto con el suelo y depth derivado de `y`.
- Los cinco recortes raster de foreground producen una ilusión útil de oclusión y deben preservarse como fallback durante la migración.
- Las posiciones semánticas de barra, mesas, biblioteca, chimenea y entrada son material de autoría aprovechable para sembrar una futura grilla.

El Café actual no es modular: `CafeInteriorScene` dibuja una gran imagen, interpola actores de un anchor a otro en línea recta y superpone cinco crops. Los cuatro hotspots son rectángulos de inspección/acción, no celdas transitables ni entidades físicas.

### Decoración reportada

El código vigente ya mueve los dos helechos opcionales a posiciones de suelo:

- `decor-window/fern`: normalizada `{x:0.49,y:0.81}`, superficie `floor`.
- `decor-books/fern`: normalizada `{x:0.78,y:0.78}`, superficie `floor`.

El E2E existente `reports/e2e/cafe-actors/cafe-actor-runtime-report.json` también registra ambas posiciones y PASS. Por tanto, el solapamiento original de helechos sobre mesa/planta no se reprodujo en el baseline vigente. Aun así, la corrección es manual: las decoraciones no tienen footprint ni validación común de colisión, de modo que el nuevo contrato de entidades sigue siendo necesario.

## Contratos actuales que limitan el objetivo

`AgentLocationV1` sólo permite:

- exterior con `tile`;
- tránsito con `tile + destinationBuildingId`;
- interior con `buildingId + anchorId + action`.

No existe tile interior, facing, control local, destino manual ni reserva de celda. `GameStateV1` tampoco contiene estado de posesión, lo cual es correcto para el requisito de no persistir una posesión activa, pero hace falta un estado runtime separado.

La reserva actual evita que un agente elija un anchor ya usado por otro agente/NPC. Los NPCs, sin embargo, asignan sus poses desde su propia rutina y no consultan un registro único de ocupación de agentes. Tampoco existe footprint de mobiliario. No se debe extender el sistema de anchors como sustituto de la grilla física.

## Selectores útiles para QA físico

| Propósito | Selector actual |
|---|---|
| UI raíz | `.syka-alpha-ui` |
| Catálogo | `.alpha-panel.alpha-palette` |
| CTA construir/volver | `[data-action="build-or-return"]` |
| Tarjeta de agente | `button.alpha-agent-card[data-profile-id]` |
| Agente seleccionado | `.alpha-agent-card.is-selected` |
| Orden al Café | `[data-agent-action="go-to-cafe"]` |
| Salir a ciudad | `[data-agent-action="return-to-city"]` |
| Acción interior | `[data-interior-action]` |
| Edificio del catálogo | `.alpha-build-card[data-kind]` |
| Objeto exterior | `[data-exterior-id]` |
| Retirar objeto | `[data-world-object-action="remove"]` |
| Acelerar obra | `[data-construction-action]` |
| Referencias | `.alpha-reference-trigger` |
| Inspector | `.alpha-inspector__content` |

No existen todavía selectores para Poseer/liberar, indicador de control, destino manual, interacción alcanzable, portal, celda, entidad o ocupación.

## Hooks QA actuales

`window.__SYKA_ALPHA_QA__` expone:

```text
getSnapshot, metrics, setPeriod, advanceMinutes, finishConstruction,
addLumenes, placeBuilding, selectBuilding, focusGrid, setZoom,
enterCafe, exitCafe, unlockSector, installFurniture, save, load, reset
```

`window.__SYKA_INTERIOR__` expone:

```text
exit, inspect, installDecor, getBuildingId
```

Faltan hooks verificables para seleccionar actor, asignar destino, poseer/liberar, solicitar un paso, interactuar, usar portal, leer grilla/entidades/footprints y consultar ocupación. `window.__SYKA_E2E_GAME__` no es una API de producción: los scripts de navegador la inyectan interceptando el arranque de Phaser.

## Defectos y brechas reproducibles

| ID | Severidad para P0 | Reproducción | Resultado actual | Resultado exigido |
|---|---|---|---|---|
| B-01 | Bloqueante | Seleccionar Syka y hacer click en suelo de ciudad | No cambia ruta ni destino | Crear ruta válida y caminar |
| B-02 | Bloqueante | Buscar botón Poseer o pulsar `P` | No existe/no hace nada | Alternar control local visible |
| B-03 | Bloqueante | Pulsar WASD con agente seleccionado | No despacha pasos | Mover por vecinos válidos de grilla |
| B-04 | Bloqueante | Pulsar `E` | Cierra/cancela construcción (Explore) | Interacción contextual alcanzable |
| B-05 | Bloqueante | Pulsar `F` ante Café/interior | No hace nada | Atravesar portal válido |
| B-06 | Bloqueante | Click en suelo del Café | Sólo puede seleccionar agente/hotspot; no mueve | Path interior con colisiones |
| B-07 | Bloqueante | Observar cambio de anchor en Café | Tween recto entre puntos semánticos | Ruta por walk grid común |
| B-08 | Alta | Pulsar `B`/`Esc` en Café | Sale inmediatamente | Si está poseído, primero liberar |
| B-09 | Alta | Comparar actor con sala/muebles | Syka 20×40 en sala 588×294; percibido muy pequeño | Escala aprobada por QA visual |
| B-10 | Alta | Revisar muebles/decor/actores | Sin footprints ni ocupación compartida | Una fuente única para click/WASD/rutinas/NPCs |
| B-11 | Media | Revisar oclusión | `depth=600+y` + 5 crops manuales | Relación por entidades, crops sólo fallback |
| B-12 | Media | Revisar QA pública | No hay introspección espacial | Hooks estables para E2E |

## Matriz requisito → evidencia baseline

| Requisito de la goal | Estado baseline | Evidencia actual | Prueba final necesaria |
|---|---|---|---|
| Contratos escena/entidad/footprint/portal | NO IMPLEMENTADO | Interior conoce raster, muebles y anchors | Tests puros de contratos y validación |
| Walk grid Café | NO IMPLEMENTADO | 4 hotspots rectangulares; 0 grilla | Visualización QA + path alrededor de obstáculos |
| Click-to-move ciudad | NO IMPLEMENTADO | Click físico no cambió estado | Click físico a tile válido/inválido |
| Click-to-move Café | NO IMPLEMENTADO | Click físico no cambió location | Ruta interior observable |
| Poseer por botón/`P` | NO IMPLEMENTADO | 0 botones; `P` sin efecto | UI, foco de texto, alternancia |
| WASD cardinal | NO IMPLEMENTADO | `D` sin efecto | 4 direcciones, repetición acotada, bloqueo |
| `E` contextual | CONFLICTO | `E` es Explore | Alcance, prioridad y foco de texto |
| `F` portal | NO IMPLEMENTADO | `F` sin efecto | Frente a puerta, ocupado y fuera de alcance |
| `Esc` libera antes de salir | NO IMPLEMENTADO | Café escucha `Esc`/`B` y sale | Dos pasos de escape físicos |
| Colisiones con barra/mesas/sillas/paredes/plantas | NO IMPLEMENTADO | Sin footprints | Unit + circuito físico de choque |
| Ocupación común agentes/NPCs | PARCIAL | Reserva de anchors desde agentes; no resolver común | Dos actores compiten por celda/anchor |
| Profundidad coherente | PARCIAL | `600+y` y 5 foreground crops | Pasar delante/detrás en varias resoluciones |
| Escala por especie/rol | PARCIAL/RECHAZADA VISUALMENTE | Test técnico pasa 38–48 px; usuario la ve pequeña | Gate humano + umbrales revisados |
| Rutina autónoma | EXISTE PARCIAL | Rutas exteriores y anchors interiores | Migrar al mismo walk grid |
| NPCs Café | EXISTE PARCIAL | 5 identidades, horarios, tránsito/anclas | Migrar a ocupación y grilla compartidas |
| Guardado | EXISTE PARCIAL | Save v1 conserva estado actual | Persistir última posición, nunca posesión activa |
| Hermes libera posesión | NO IMPLEMENTADO | No hay posesión | Evento GET-only controlado; cero tarea |
| Bridge GET-only | PASS BASELINE | 4/4 requests GET sin body | Repetir en E2E final completo |
| Café no degradado | PROTEGIDO, NO DEMOSTRADO | Arte actual sigue vigente | Comparativa old/lab/new a 1008 y 1440 |
| 55–60 FPS | NO CONCLUYENTE | 52.6–52.8 instantáneo headless | Medición sostenida máquina actual |
| Video 45–90 s | PENDIENTE | No corresponde al baseline | Recorrido final reproducible |

## Assets y referencias canónicas

### Dirección aprobada

- `research/visual-concepts/approved-direction-v1/cafe-interior-library.png`
- copia pública exacta: `app/game/public/assets/reference/cafe-interior-library.png`
- SHA-256 de ambas: `A79D2DA78A88C1AE066AAB4E17289F4CCBB8689107574F7C695E26A8C5927410`
- jerarquía: `research/visual-concepts/approved-direction-v1/README.md`

### Runtime vigente

| Asset | Estado/manifiesto | SHA-256 |
|---|---|---|
| `alpha-v1/cafe-interior-v1.png` | candidato provisional; draw 588×294 | `FC690DABB0047560BCBAAB0F0B4B58ABDEDB27041B53D1A76864ADE12CF2D082` |
| `alpha-v1/cafe-optional-decor-sheet-v1.png` | candidato provisional | `110385D5FD82AC7F986780B525D6043B06DA6D1AC070EFEFAC2DA78B8B1848E0` |
| `alpha-v1/agents-sheet-v1.png` | placeholders, avatares no aprobados | `66700F8769A991E9B5D8125DCD7D7C9224E5CF9B016737988DB36EB9D87E328E` |
| `npc-v1/cafe-npcs-atlas-v1.png` | atlas integrado de 5×4 | `201069CB5C59FB8B02657FC4CF8957BC2164D255BC32038C2BF10730664F1975` |

Evidencia visual histórica útil, no sustituto de captura final fresca:

- `reports/e2e/cafe-actors/cafe-agent-npcs-1440x900.png`
- `reports/e2e/cafe-actors/cafe-actor-runtime-report.json`
- `reports/e2e/city-characters/city-character-pass-1440x900.png`

## Guardrails para la implementación

1. Mantener el Café raster actual hasta que el laboratorio modular pase gate funcional y visual.
2. No convertir anchors en una pseudo-grilla; definir tiles, footprints, portales y ocupación como contratos separados.
3. Centralizar teclado. Prioridad mínima: modal/input → posesión → destino/escena → construcción/cámara.
4. Reasignar `E` sin dejar listeners paralelos y evitar que WASD mueva a la vez agente y cámara.
5. Usar una única consulta de transitabilidad para click, WASD, rutinas y NPCs.
6. Resolver ocupación de agentes y NPCs en la misma capa, con replan y sin deadlock permanente.
7. Mantener posesión fuera del save; guardar sólo la última posición válida cuando corresponda.
8. Liberar control local ante actividad Hermes real sin modificar ni falsificar el estado de Hermes.
9. Extender QA con hooks estables antes del E2E final; no depender de propiedades privadas de Phaser como contrato.
10. Repetir GET-only y cero tareas durante el recorrido completo, no sólo en una prueba aislada.

## Checklist para mi QA independiente final

Cuando la implementación esté lista, este baseline se usará para intentar romper, en navegador físico:

- click-to-move válido, inválido, ocupado y durante movimiento;
- P/botón Poseer, WASD, key repeat, cambio de foco y liberación;
- `E` fuera/dentro de alcance y con varias interacciones cercanas;
- `F` frente/lejos de portal y con celda de salida ocupada;
- colisión contra cada familia P0 de objeto;
- competencia agente/agente, agente/NPC y NPC/NPC;
- replan desde tile real y takeover de Hermes;
- save/reload sin posesión activa;
- profundidad delante/detrás de barra, mesas, sillas, plantas y paredes;
- escala/nitidez a 1008×548, 1440×900, 2560×1080 y ancho angosto;
- bridge únicamente GET sin body, cero tareas;
- rendimiento sostenido y video final.

La implementación no debe marcarse completa mientras cualquiera de B-01 a B-10 continúe reproducible o mientras el Café modular sea visualmente peor que el runtime protegido.
