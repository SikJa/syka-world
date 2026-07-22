# Syka World — Mechanic Integration Pass v1 — Informe final

Fecha: 2026-07-16  
Resultado: **PASS — 19/19 criterios de finalización cumplidos**  
Alcance: vertical slice local de la alpha; sin publicación, empaquetado ni ejecución de tareas Hermes.

## Nota sobre el tiempo de ejecución

El documento original proponía un objetivo de 60 minutos y un límite de 80. Durante la ejecución, el usuario anuló expresamente ese timebox y pidió completar el alcance sin usar el reloj como corte. Por eso el cierre se hizo contra criterios verificables, no por agotamiento de tiempo. Esta excepción no amplió las autorizaciones: se mantuvieron las prohibiciones de commit, push, deploy, mutación de Hermes y tráfico distinto de GET.

## Resultado ejecutivo

El pass convierte la maqueta visual en un circuito mecánico integrado y reproducible:

1. **Integración fundamental.** Nueva partida inicia con Syka, Elen, Astrelis y Zerny separados y en movimiento ambiental determinista. Los destinos se resuelven por función y estado del edificio, no por IDs mágicos. Completar un edificio entrega XP una sola vez; el primer Café Biblioteca lleva la ciudad a nivel 2.
2. **Construcción inteligente y carreteras.** Árboles, arbustos, setos, jardineras, bancos, farolas y flores forman parte del estado físico. Preview y confirmación comparten un único plan que informa huella, vegetación retirada, camino automático y coste total. Confirmar aplica el cambio de forma atómica; cancelar no altera mundo ni saldo.
3. **Construcción, aceleración y mejora.** Las obras pueden adelantarse una hora o terminarse pagando Lúmenes. La finalización paga usa la misma transición de estado, XP, furnishing y bindings que el paso normal del tiempo. La mejora `Altillo de lectura` (`cafe-reading-loft`) cambia la variante exterior del Café y agrega composición visible.
4. **Loop espacial e interior.** La orden local `Ir al Café` hace caminar al agente por la red, entrar sin teletransporte, ocupar un anchor, ejecutar `Sentarse`, `Leer` o `Servirse un café` y volver a la ciudad. Ubicación, anchor, acción y ocupación sobreviven a save/load.
5. **Exterior comprable.** Construir incluye una pestaña Exterior con nueve objetos, preview físico, reglas de colocación, compra, selección, retiro con confirmación y reembolso único del 50%.
6. **Iluminación y UI.** Ventanas, farolas y ambiente de edificio usan curvas separadas para día, atardecer y noche. La UI quedó contextual y compacta: barra superior, catálogo en bandeja, recibo de placement, inspector, aceleración, chips de agentes y acciones interiores.

Como extensión visual no bloqueante se agregó **microfauna procedural** —gorriones, mariposas y caracol— sin colisión, inventario, coste ni efecto sobre la simulación.

## Arquitectura y guardas

Se conserva la separación:

```text
Hermes GET-only → bridge → core determinista → controlador → Phaser/UI
```

- La verdad jugable vive en contratos y estado del core, no sólo en sprites Phaser o DOM.
- El estado Hermes y la ubicación espacial del agente permanecen separados.
- La orden `Ir al Café` es local, predefinida, sin API y no constituye una tarea Hermes.
- El modelo interior reserva anchors semánticos, incluido `bartender-station`, sin renderizar ni simular todavía un bartender.
- La auditoría de navegador registró **8 requests al bridge: 8 GET, sin body, sin endpoints de comandos o tareas**.
- No se creó ninguna tarea Hermes y no se modificaron perfiles ni bridge.

## Evidencia funcional principal

### Nueva partida, construcción y progresión

- En la ventana observada, las posiciones distintas por agente fueron: Syka 9, Elen 9, Astrelis 10 y Zerny 12.
- El candidato físico del Café en origen `(4,0)` mostró 20 tiles de huella, cuatro tiles nuevos de carretera y seis objetos a retirar, incluidos tres árboles.
- El recibo previo a confirmar desglosó: edificio 240 L, camino 12 L, limpieza 14 L, total 266 L.
- La confirmación física creó `building-2`, demostrando que el circuito no depende de `cafe-main`.
- La finalización dejó el Café completo, otorgó 100 XP una sola vez y desbloqueó nivel 2.
- El agente recorrió siete posiciones exteriores distintas antes de entrar; no hubo teletransporte.

### Interior

- Syka entró a `building-2`, ocupó `counter` y ejecutó `serve-coffee`.
- Mediante interacción física interior cambió a `library-chair` con acción `read`.
- `Volver a la ciudad` restauró una ubicación exterior coherente en `(6,4)`.
- Los hotspots usan feedback localizado y acciones contextuales; no quedan labels permanentes tipo `Zona de mesas` ni rectángulos gigantes de selección.

### Catálogo Exterior v1

| Objeto | ID | Precio alpha |
|---|---|---:|
| Flores silvestres | `wildflowers` | 4 L |
| Arbusto redondo | `shrub-round` | 8 L |
| Arbusto con flores | `shrub-flowering` | 10 L |
| Seto corto | `hedge-short` | 12 L |
| Jardinera | `planter` | 14 L |
| Banco | `bench` | 16 L |
| Farola | `streetlamp` | 24 L |
| Árbol redondo | `tree-round` | 20 L |
| Árbol alto | `tree-narrow` | 22 L |

El E2E compró físicamente flores, arbusto, árbol, banco y farola. Después seleccionó y retiró la farola: el reembolso fue **+12 L**, exactamente el 50% de 24 L, y la segunda evaluación conservó el saldo en 3844 L sin duplicarlo.

### Iluminación

Se fijaron y capturaron tres horas comparables:

| Hora | Estado | Alfa máximo de farola |
|---|---|---:|
| 12:00 | día | 0 |
| 18:30 | atardecer | 0,281112 |
| 22:00 | noche | 0,530400 |

El pool máximo medido fue de 32 píxeles: localizado en la fuente, sin el cono triangular gigante que cruzaba la carretera.

### Mejora y persistencia

- Antes del upgrade: variante `cafe-library`, 2 objetos de composición exterior.
- Después del upgrade: variante `cafe-reading-loft`, 6 objetos de composición exterior.
- Tras guardar y recargar se recuperaron el Café `building-2` completo en nivel 2, el upgrade, la red vial, los cuatro objetos comprados que seguían colocados, las retiradas de vegetación, el saldo, 128 XP, nivel de ciudad 2 y el agente dentro del Café con anchor y acción.

## Validación final

| Gate | Resultado | Evidencia |
|---|---:|---|
| TypeScript typecheck | **PASS** | `npm run typecheck` |
| Build de producción | **PASS** | `npm run build` |
| Suite frontend | **138/138 PASS** | 21 archivos Vitest |
| Suite Python histórica | **39/39 PASS** | `python -m unittest discover -s tests -v` |
| Separación raster edificio/carretera | **9/9 PASS** | `reports/e2e/visual-road-clearance/VISUAL_ROAD_CLEARANCE.md` |
| E2E Mechanic Integration | **11/11 PASS** | `reports/e2e/mechanic-integration-v1/MECHANIC_INTEGRATION_E2E.md` |
| Colocaciones físicas registradas | **7 PASS** | 1 preview/cancel, 1 Café y 5 objetos Exterior |
| Bridge durante E2E | **8/8 GET** | sin body, comandos ni tareas |
| Navegador | **0 errores** | 0 console accionables, 0 page errors, 0 HTTP fallidas |
| Responsive | **PASS** | 1008×548, recorrido 1440×900 y smoke 2560×1080 |

El gate raster mide el alfa real cargado por Phaser, no sólo huellas lógicas. Las nueve instancias conservan al menos un píxel completo de pasto entre sprite y carretera.

El build conserva una advertencia no bloqueante de Vite por tamaño del chunk principal: **1567.15 kB / 414.95 kB gzip**. No se ocultó ni se interpreta como fallo del pass.

## Matriz de los 19 criterios de finalización

| # | Criterio | Estado | Evidencia concreta |
|---:|---|:---:|---|
| 1 | El build pasa | **PASS** | `npm run build` terminó correctamente; sólo queda el warning de tamaño documentado. |
| 2 | Pruebas nuevas y anteriores relevantes pasan | **PASS** | Frontend 138/138, Python 39/39 y gate raster 9/9. |
| 3 | Nueva partida muestra vida ambiental | **PASS** | Flujo E2E 01: los cuatro agentes registraron entre 9 y 12 posiciones distintas. |
| 4 | Un Café con ID generado es destino real | **PASS** | Los flujos 03–06 construyeron y usaron `building-2` para ruta, entrada y acción. |
| 5 | Un árbol nunca queda silenciosamente debajo de una construcción | **PASS** | Flujo 02 identificó seis retiradas, tres de ellas árboles, antes de confirmar; preview/cancel fue atómico. |
| 6 | Existe conector vial automático visible antes de confirmar | **PASS** | Preview físico mostró cuatro tiles nuevos, ruta completa y coste de 12 L. |
| 7 | Acelerar consume Lúmenes y completa mediante la misma lógica | **PASS** | Flujo 04 completó por acción de juego, disparó 100 XP y bindings funcionales; tests cubren cobro, saldo y equivalencia de finalización. |
| 8 | Un agente entra realmente al interior y ocupa un anchor | **PASS** | Syka pasó por ruta exterior, `counter`, `library-chair/read` y retorno a `(6,4)`. |
| 9 | Desaparecieron labels interiores debug-like | **PASS** | Captura 05 y recorrido físico muestran acciones localizadas sin `Zona de mesas` ni overlays rectangulares permanentes. |
| 10 | Los objetos Exterior son comprables y persistentes | **PASS** | Flujo 07 colocó cinco tipos mediante UI/canvas; flujo 11 los recuperó tras reload. |
| 11 | La farola respeta día/noche | **PASS** | 12:00 alfa 0; 18:30 alfa 0,281112; 22:00 alfa 0,530400. |
| 12 | El cono gigante está ausente | **PASS** | Pool máximo medido en 32 px y capturas 08–10 sin triángulo cruzando la carretera. |
| 13 | La mejora del Café cambia el arte visible | **PASS** | `cafe-library` → `cafe-reading-loft` y composición 2 → 6 objetos; capturas 11/12. |
| 14 | Save/load recupera el circuito | **PASS** | Flujo 11 comparó firma de Café, roads, world objects, saldo, XP, nivel y ubicación interior. |
| 15 | El bridge sigue GET-only | **PASS** | Ocho requests auditadas, todas GET sin body; cero comandos/tareas. |
| 16 | No se inició ninguna tarea Hermes | **PASS** | La ejecución sólo observó endpoints de estado/eventos; no se llamó ninguna acción Hermes. |
| 17 | No quedaron puertos temporales abiertos | **PASS** | El servidor E2E fue gestionado por `with_server.py`; al cierre 4173, 5173 y 5187 no tenían listener. |
| 18 | Estado, tareas, decisiones y Obsidian están actualizados | **PASS** | `CURRENT_PROJECT_STATE.md`, `TASKS.md`, `docs/DECISIONS.md` y el espejo `C:\Coding\Syka Memory\Syka Memory\03 Proyectos\Syka World` registran el pass. |
| 19 | Existe informe con evidencia y límites | **PASS** | Este documento, el MD E2E, su JSON estructurado y las capturas listadas abajo. |

## Paquete conceptual de NPCs — aislado del runtime

Se preparó `Asset/NPCs/Cafe-Cohort-v0.1` como exploración visual separada:

- Alma Ríos — bartender/barista;
- Beni Menta — pastelería;
- Iara Luz — ilustradora habitual;
- Milo Niebla — archivista/lector nocturno;
- Noa Junco — reparto en bicicleta y plantas.

El paquete contiene una hoja de elenco, una matriz de poses, una escena de microvida, roster, notas, prompts/procedencia y manifest con hashes. Su estado explícito es **`concept-only-not-runtime`**:

- no está importado por `app/game`;
- no está vinculado a perfiles o sesiones Hermes;
- no es un atlas ni un set de sprites listo para producción;
- requiere aprobación visual, reducción manual, limpieza de píxel, pivotes y animaciones antes de integrarse.

La presencia de este paquete no contradice la restricción de no crear NPCs runtime. El bartender futuro puede usar el contrato de anchors ya preparado sin rehacer navegación o persistencia.

## Archivos principales

### Core y aplicación

- `app/game/src/core/contracts.ts`
- `app/game/src/core/catalog.ts`
- `app/game/src/core/state.ts`
- `app/game/src/core/construction.ts`
- `app/game/src/core/roadConnector.ts`
- `app/game/src/core/worldObjects.ts`
- `app/game/src/core/progression.ts`
- `app/game/src/core/agents.ts`
- `app/game/src/core/navigation.ts`
- `app/game/src/core/simulation.ts`
- `app/game/src/core/save.ts`
- `app/game/src/application/GameController.ts`
- `app/game/src/application/AlphaRuntime.ts`

### Presentación y UI

- `app/game/src/main.ts`
- `app/game/src/presentation/scenes/CityScene.ts`
- `app/game/src/presentation/scenes/CafeInteriorScene.ts`
- `app/game/src/presentation/city/placement.ts`
- `app/game/src/presentation/city/lighting.ts`
- `app/game/src/presentation/city/decor.ts`
- `app/game/src/ui/createAlphaUi.ts`
- `app/game/src/ui/model.ts`
- `app/game/src/ui/types.ts`
- `app/game/src/alpha-styles.css`

### Pruebas e informes

- `app/game/src/core/mechanics-integration.test.ts`
- `app/game/src/core/navigation-simulation.test.ts`
- `app/game/src/core/save.test.ts`
- `app/game/src/presentation/city/lighting.test.ts`
- `app/game/src/presentation/city/placement.test.ts`
- `app/game/src/ui/createAlphaUi.dom.test.ts`
- `app/game/e2e/mechanic_integration_v1_e2e.py`
- `app/game/e2e/visual_road_clearance_e2e.py`
- `reports/e2e/mechanic-integration-v1/mechanic-integration-e2e.json`
- `reports/e2e/mechanic-integration-v1/MECHANIC_INTEGRATION_E2E.md`
- `reports/e2e/visual-road-clearance/VISUAL_ROAD_CLEARANCE.md`

### Conceptos NPC

- `Asset/NPCs/Cafe-Cohort-v0.1/cafe-npc-cast-concept-v1.png`
- `Asset/NPCs/Cafe-Cohort-v0.1/cafe-npc-pose-matrix-v1.png`
- `Asset/NPCs/Cafe-Cohort-v0.1/cafe-npc-microlife-scene-v1.png`
- `Asset/NPCs/Cafe-Cohort-v0.1/NPC_ROSTER.md`
- `Asset/NPCs/Cafe-Cohort-v0.1/MICRO_LIFE_NOTES.md`
- `Asset/NPCs/Cafe-Cohort-v0.1/PROMPTS_AND_PROVENANCE.md`
- `Asset/NPCs/Cafe-Cohort-v0.1/manifest.json`

## Capturas E2E

| Evidencia | Archivo |
|---|---|
| Nueva partida con agentes vivos | `reports/e2e/mechanic-integration-v1/screenshots/01-nueva-partida-agentes-1440x900.png` |
| Preview con árbol, limpieza y camino | `reports/e2e/mechanic-integration-v1/screenshots/02-preview-arbol-y-conector-1440x900.png` |
| Café en obra y conector confirmado | `reports/e2e/mechanic-integration-v1/screenshots/03-cafe-en-obra-con-camino-1440x900.png` |
| Café nivel 1 completo | `reports/e2e/mechanic-integration-v1/screenshots/04-cafe-completo-nivel-1-1440x900.png` |
| Agente leyendo dentro del Café | `reports/e2e/mechanic-integration-v1/screenshots/05-agente-leyendo-interior-1440x900.png` |
| Cinco objetos Exterior colocados | `reports/e2e/mechanic-integration-v1/screenshots/07-catalogo-exterior-colocado-1440x900.png` |
| Catálogo Exterior y precios | `reports/e2e/mechanic-integration-v1/screenshots/07b-catalogo-exterior-abierto-precios-1440x900.png` |
| Farola a las 12:00 | `reports/e2e/mechanic-integration-v1/screenshots/08-farola-dia-1200-1440x900.png` |
| Farola a las 18:30 | `reports/e2e/mechanic-integration-v1/screenshots/09-farola-atardecer-1830-1440x900.png` |
| Farola a las 22:00 | `reports/e2e/mechanic-integration-v1/screenshots/10-farola-noche-2200-1440x900.png` |
| Café antes del upgrade | `reports/e2e/mechanic-integration-v1/screenshots/11-cafe-nivel-1-antes-upgrade-1440x900.png` |
| Café después del upgrade | `reports/e2e/mechanic-integration-v1/screenshots/12-cafe-nivel-2-despues-upgrade-1440x900.png` |
| Save/reload restaurado | `reports/e2e/mechanic-integration-v1/screenshots/13-save-reload-restaurado-1440x900.png` |
| Responsive 1008×548 | `reports/e2e/mechanic-integration-v1/screenshots/14-muestra-responsive-1008x548.png` |
| Responsive 2560×1080 | `reports/e2e/mechanic-integration-v1/screenshots/14-muestra-responsive-2560x1080.png` |

## Limitaciones y trabajo diferido

- Los cinco NPC son conceptos aislados; **no existen en runtime**.
- Syka, Elen, Astrelis y Zerny todavía usan avatares placeholder; no son identidades finales.
- Sólo el Café Biblioteca tiene interior jugable. Los otros cinco interiores siguen diferidos.
- Necesidades, misiones, relaciones, conversación, autonomía y tareas Hermes bidireccionales no forman parte de este pass.
- Lúmenes, costes, XP y reembolsos son balance alpha, no economía final.
- El kit visual actual es coherente y funcional para la alpha, pero sigue siendo provisional.
- El warning del bundle de 1567.15 kB / 414.95 kB gzip queda como deuda de optimización.
- No hubo commit, push, publicación, deploy, empaquetado, inicio automático ni tarea Hermes.
- La validación demuestra coherencia interna y funcionamiento del kit actual. **No se afirma equivalencia visual con MiniTown, Whisper of the House ni ninguna imagen de referencia.**

## Conclusión

El Mechanic Integration Pass v1 queda **completo y verificable** como vertical slice local. La ciudad ya conecta construcción, economía alpha, caminos, rutinas, interior, Exterior, iluminación y persistencia en un mismo circuito. Lo siguiente puede concentrarse en personajes definitivos, NPCs runtime e interiores adicionales sin reabrir los contratos mecánicos validados aquí.
