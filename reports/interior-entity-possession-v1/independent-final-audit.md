# Syka World — auditoría final independiente

Fecha: 2026-07-17  
Goal: `docs/GOAL_INTERIOR_ENTITY_AND_POSSESSION_PASS_V1.md`  
Rol: evaluador físico/visual independiente; no se modificó código de producto.

## Veredicto

**PASS — cero bloqueantes funcionales o visuales para cerrar Interior Entity & Possession Pass v1.**

El recorrido P0 es jugable y reproducible: selección, movimiento físico por clic, pausa determinista de 3 segundos, Poseer por botón y `P`, WASD, colisiones ante repetición agresiva, `E` contextual, `F` en ambos sentidos, `Esc` en dos etapas, protección de foco editable, ocupación compartida, persistencia sin revivir posesión y retorno a autonomía desde la celda real. La ciudad, el bridge, la economía, el save y el arte vigente permanecen preservados.

## Evidencia ejecutada

| Evidencia | Resultado |
|---|---|
| TypeScript | PASS |
| Vitest | PASS — 29 archivos, 223/223 tests |
| Build Vite | PASS — sólo conserva el warning conocido de chunk grande |
| Python | PASS — 39/39 tests |
| E2E físico principal | PASS — 14/14 pasos |
| QA físico independiente | PASS — 15/15 criterios funcionales |
| Responsive independiente | PASS — 1008×548, 2560×1080 y 640×720 |
| Bridge observado | PASS — exclusivamente `GET`, sin body |
| Consola, page errors y assets | PASS — sin errores inesperados ni respuestas HTTP fallidas |
| Video final | PASS — H.264, 1440×900, 25 fps, 500 frames, 20.000 s |

Datos reproducibles:

- `reports/interior-entity-possession-v1/physical-e2e.json`
- `reports/interior-entity-possession-v1/independent/independent-physical-qa.json`
- `reports/interior-entity-possession-v1/independent/screenshots/`
- `reports/interior-entity-possession-v1/independent/video-inspection/`

## PASS/FAIL por criterio

| Criterio | Estado | Evidencia independiente |
|---|---|---|
| Seleccionar Syka/Elen/Astrelis/Zerny | PASS | Selección física por tarjeta; estado seleccionado confirmado. |
| Clic válido en ciudad | PASS | Ruta física cardinal, marcador visible y llegada real. |
| Clic inválido/objeto/ocupado | PASS | Edificio y barra no despachan movimiento; una celda ocupada rechaza al segundo actor. |
| Reemplazo y pausa de orden | PASS | Tests puros cubren reemplazo; llegada física conserva control aproximadamente 3 s y luego retoma rutina. |
| Poseer por botón y `P` | PASS | Ambos caminos alternan el control; HUD `POSEYENDO` visible. |
| WASD y key repeat | PASS | Paso cardinal real; 14 intentos contra borde/mesa no cruzan el obstáculo. |
| `E` contextual | PASS | `sit`, `serve-coffee` y `read` se ejecutaron desde anchors válidos; distancia inválida está cubierta por contratos puros. |
| `F` portal | PASS | Ciudad→Café y Café→ciudad mediante teclado físico, conservando el actor y el estado. |
| `Esc` en dos etapas | PASS | Primer `Esc` libera sin salir; segundo abandona el interior. |
| Foco editable | PASS | `P/W/E/F/Esc` no alteran escena, celda ni posesión con un input enfocado. |
| Colisiones de ciudad | PASS | Edificios, terreno no caminable y repetición WASD bloquean correctamente. |
| Colisiones de Café | PASS | Barra, cocina, mesas, sillas, sofá, biblioteca/chimenea, paredes y decoración espacial comparten la misma transitabilidad. |
| Ocupación agentes/NPCs | PASS | Tres actores coexistieron en celdas únicas; destino ocupado fue rechazado sin solapamiento. |
| Profundidad/oclusión | PASS | Detrás de barra se oculta la parte inferior; delante se muestra el cuerpo completo; pies y sombra quedan en la celda real. |
| Escala por rol/especie | PASS | Humanos/NPCs conservan proporción consistente; la mascota no se estira a altura humana. |
| Save/reload | PASS | La celda interior persiste y la posesión activa no sobrevive a recarga. |
| Autonomía/Hermes | PASS | Liberación replantea desde la celda real; takeover Hermes está cubierto; no existe método de escritura a Hermes. |
| Bridge GET-only | PASS | 20 requests independientes y 8 del E2E principal: todos `GET`, sin body. |
| Video de 20 s | PASS | Recorrido visible continuo; los detalles de profundidad que no caben con claridad quedan demostrados por E2E y capturas. |

## Inspección visual a resolución original

### 1440×900 — PASS

- Ciudad nítida, sin estiramiento ni edificios invadiendo carreteras.
- HUD de posesión compacto, legible y fuera del foco principal.
- Café cálido, denso y pixelado; sin rectángulos gigantes de hotspot.
- Syka, NPCs y mobiliario mantienen pivotes y profundidad coherentes.
- La pareja `04-cafe-behind-bar-depth-1440x900.png` / `05-cafe-in-front-of-bar-depth-1440x900.png` demuestra oclusión correcta. La captura `05` vigente fue recapturada limpia; SHA-256 `FB6A5481439B16259CE14457FCF6BE5540167F9485C080D72E442359CF3CCA54`.

### 1008×548 — PASS

- Canvas sin deformación ni scroll horizontal.
- Café y actores siguen nítidos; inspector, dock y acciones permanecen accesibles.
- La UI ocupa más superficie, pero no impide el control ni oculta el actor seleccionado.

### 2560×1080 — PASS

- Escala uniforme y `image-rendering: pixelated` preservado.
- Café centrado, detallado y sin blur; ciudad sin estiramiento.
- Los márgenes amplios respetan la cámara fija y no alteran la proporción del mundo.

### 640×720 estrecha — PASS con deuda visual menor

- Sin overflow horizontal; acciones, dock y botón de retorno continúan utilizables.
- El inspector se superpone más al escenario y el encabezado queda muy cerca de la barra QA. Es una deuda de pulido responsive, no un bloqueo P0 ni una pérdida funcional.

## Arte y fidelidad

La cafetería productiva no fue sustituida por un laboratorio inferior. El runtime añade grilla, entidades, footprints, interacción y capas de profundidad sobre el raster vigente; el microdetalle continúa correctamente horneado.

Hashes verificados:

- Referencia aprobada y copia pública: `A79D2DA78A88C1AE066AAB4E17289F4CCBB8689107574F7C695E26A8C5927410`.
- Café productivo: `FC690DABB0047560BCBAAB0F0B4B58ABDEDB27041B53D1A76864ADE12CF2D082`.
- Agentes: `66700F8769A991E9B5D8125DCD7D7C9224E5CF9B016737988DB36EB9D87E328E`.
- NPCs: `201069CB5C59FB8B02657FC4CF8957BC2164D255BC32038C2BF10730664F1975`.

La dirección visual conserva madera oscura, cocina/barra rica, biblioteca, chimenea, sillones verdes, alfombras, plantas, luz cálida y pixel art nítido. La diferencia de acabado respecto del concepto de alta fidelidad ya existía antes de este pass; no hubo degradación material.

## Rendimiento

- Ciudad: **53.99 FPS promedio**.
- Café: **56.89 FPS promedio**.

El Café queda dentro del objetivo aproximado de 55–60 FPS. La ciudad queda alrededor de 1 FPS por debajo, pero mejora el baseline anterior de aproximadamente 52.6 FPS y no constituye una regresión. Se registra como riesgo no bloqueante para una futura pasada de optimización.

## Video

`reports/interior-entity-possession-v1/syka-world-possession-pass-v1-20s.mp4`

- Duración: `20.000000 s`.
- Resolución: `1440×900`.
- Codec: H.264.
- Frame rate: 25 fps.
- Frames: 500.
- Decodificación completa: PASS.
- SHA-256: `E777CBAFD7210ECCC1C4E9A34635A04E846A18E36327C8F110B6757163762769`.

El video contiene selección, recorrido exterior, posesión/WASD, entrada al Café, movimiento interior, interacción `E`, liberación y regreso a ciudad. La breve transición azul entre escenas es el cambio normal de escena, no un error.

## Ruido esperado y riesgos no bloqueantes

- Chromium headless emitió avisos `GL Driver Message / GPU stall due to ReadPixels` al capturar WebGL. Son ruido del driver de captura; no hubo page errors.
- Una recarga/cierre puede abortar el long-poll GET `events?wait=15` con `ERR_ABORTED`; no es una escritura ni una respuesta fallida del producto.
- Vite conserva el warning conocido por bundle mayor de 500 kB.
- Los avatares siguen siendo placeholders artísticos por decisión de alcance; su escala y colisión sí pasan esta goal.
- La UI estrecha merece un futuro pulido, sin afectar el gate 1008×548/1440×900.

## Cleanup

- El servidor temporal de QA en `127.0.0.1:5188` fue cerrado y el puerto quedó libre.
- El servidor preexistente en `127.0.0.1:5173` no fue alterado.
- No se iniciaron tareas reales, no se reinició Hermes y no se hizo commit, push, PR ni publicación.

## Cierre

**Bloqueantes: ninguno.** La implementación satisface el gate funcional y visual de esta goal. Las observaciones restantes son de optimización/pulido y deben quedar como trabajo futuro, no como motivo para reabrir la lógica espacial ya verificada.
