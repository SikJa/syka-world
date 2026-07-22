# Interior Entity & Possession Pass v1 — cierre final

Fecha: 2026-07-17  
Resultado: **COMPLETADO — PASS funcional, visual y de seguridad; cero bloqueantes.**

## Verificado

- El juego conserva su inicio local documentado mediante `npm --prefix app/game run dev`.
- Ciudad y Café Biblioteca comparten contratos tipados de escena, entidad, footprint, anchor, portal, ocupación, reserva, interacción y pathfinding cardinal.
- Un agente seleccionado recibe órdenes físicas por clic sobre suelo transitable; los clics sobre edificios, obstáculos o destinos ocupados no atraviesan el mundo.
- **Poseer** y `P` activan control directo; WASD solicita un único vecino cardinal y key repeat no cruza colisiones.
- `E` ejecuta interacciones contextuales reales. El E2E físico comprobó `sit` y `serve-coffee` sobre el anchor exacto `counter`; la auditoría independiente añadió `read`.
- `F` cruza el portal ciudad↔Café en ambos sentidos. El primer `Esc` libera al agente sin salir y el segundo puede abandonar el interior.
- Barra, cocina, mesas, sillas, sofá, biblioteca/chimenea, paredes, decoración y actores participan del mismo contrato de transitabilidad/ocupación.
- Profundidad y oclusión se validaron físicamente delante y detrás de la barra. Escala, pivotes y pixelado pasaron inspección a 1440×900, 1008×548, 2560×1080 y 640×720.
- Guardar/recargar conserva la celda interior válida y nunca revive una posesión activa.
- La autonomía retoma desde la posición física real. La actividad observada de Hermes puede liberar control local, pero Syka World no expone ninguna acción de escritura ni inició tareas reales.
- E2E propio: **14/14 PASS**, 8 requests, todas `GET` sin body, cero page errors.
- QA independiente: **15/15 PASS**, responsive **3/3 PASS**, 20 requests, todas `GET` sin body, cero bloqueantes.
- Frontend: **29 archivos, 223/223 tests PASS**; typecheck y build PASS.
- Bridge/simulación Python: **39/39 tests PASS**.
- El Café productivo conserva el mismo raster y hash previo; no fue reemplazado por una versión visualmente inferior.
- El servidor temporal `127.0.0.1:5188` quedó cerrado. El servidor preexistente `5173` no fue alterado.

## Evidencia

- `physical-e2e.json`: recorrido físico propio a 1440×900.
- `independent/independent-physical-qa.json`: recorrido físico y responsive independiente.
- `independent-final-audit.md`: veredicto independiente, inspección visual original y matriz de criterios.
- `screenshots/`: ciudad poseída y Café interactivo a 1440×900.
- `independent/screenshots/`: profundidad, ocupación y responsive.
- `syka-world-possession-pass-v1-20s.mp4`: H.264, 1440×900, 25 fps, 500 frames, **20.000000 s**; SHA-256 `E777CBAFD7210ECCC1C4E9A34635A04E846A18E36327C8F110B6757163762769`.

Comandos de cierre ejecutados:

```powershell
npm --prefix app/game run test -- --reporter=verbose
npm --prefix app/game run typecheck
npm --prefix app/game run build
.venv\Scripts\python.exe -m unittest discover -s tests -v
.venv\Scripts\python.exe app\game\e2e\interior_entity_possession_v1_e2e.py
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,avg_frame_rate,nb_frames -of json reports\interior-entity-possession-v1\syka-world-possession-pass-v1-20s.mp4
```

Estado de Git durante el cierre: rama `main` sin `HEAD` inicial; worktree completamente sin seguimiento. No se creó commit, push, PR ni publicación.

## Provisional

- Los avatares siguen siendo placeholders artísticos; sus colisiones, escala y profundidad sí están validadas.
- La presentación estrecha 640×720 es funcional y no desborda horizontalmente, aunque el inspector ocupa demasiado escenario.
- El runtime modular se aplicó a ciudad y Café Biblioteca, que eran el alcance P0. No implica que cada futura casa u oficina ya tenga un interior modular propio.

## Pendiente fuera de esta goal

- Diseñar e integrar los interiores específicos de casas y oficinas reutilizando este contrato espacial.
- Reemplazar los placeholders por los personajes/mascotas definitivos cuando su dirección artística quede aprobada.
- Profundizar contenido, objetos e interacciones sin reabrir la base espacial ya verificada.
- Hacer una pasada futura de UI responsive y optimización de bundle/rendimiento.

No queda trabajo pendiente que bloquee esta goal.

## Riesgos no bloqueantes

- Ciudad promedió **53.99 FPS** en Chromium headless instrumentado, frente al objetivo blando aproximado de 55–60; mejora el baseline previo y no es una regresión. Café promedió **56.89 FPS**.
- Vite conserva el warning conocido por un bundle minificado superior a 500 kB.
- Chromium headless emite avisos del driver WebGL `ReadPixels` durante capturas.
- Cerrar o recargar el navegador puede abortar el long-poll `events?wait=15`; es una cancelación de un `GET`, no una escritura ni un error HTTP del producto.

## Dictamen

La implementación cumple los 18 criterios de finalización del documento de goal. Las observaciones restantes son mejoras futuras de arte, contenido, UI u optimización y no justifican reabrir la lógica espacial, de control o de seguridad ya validada.
