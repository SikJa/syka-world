# Auditoría física de regresión del Café

Fecha: 2026-07-17  
Servidor auditado: `http://127.0.0.1:5173/?mode=showcase`

## Alcance

- Navegador Chromium headless con Playwright.
- URL normal, sin `?qa=1`, para la reproducción principal.
- Viewports `1008x548` y `1440x900`.
- Velocidades de simulación `1x`, `2x` y `4x`.
- Actor real dentro del Café y NPC locales activos.
- Entrada, salida, reentrada, posesión, WASD, guardado y recarga.
- Segunda pasada con una referencia pasiva al objeto `Phaser.Game` exclusivamente para registrar cámara, escala, escenas, frames, actores y celdas. No se instaló la API QA del producto.

## Resultado actual después de los fixes de ciclo de vida

La corrupción visual mostrada por el usuario ya no se reproduce.

- Entrada -> salida -> reentrada: PASS en ambos viewports.
- Fondo del Café: siempre usa `alpha-cafe-interior / __BASE`, frame `1774x887`.
- Cámara interior: zoom `1`, scroll `0,0` en ambas entradas.
- En `1008x548`: buffer lógico `828x450`, CSS `1008x547.81`, room `674x337`.
- En `1440x900`: buffer lógico `720x450`, CSS `1440x900`, room `588x294`.
- Las seis capas de oclusión permanecen y no se convierten en mosaicos gigantes.
- Al salir, `agentViews=0`, `npcViews=0` y las referencias visuales quedan vacías.
- En la reentrada se reconstruyen `agentViews=1` y `npcViews=2`; los personajes siguen visibles.
- Guardar y recargar mantiene el interior y la celda, pero no mantiene la posesión, como estaba especificado.

## Causa observable de la corrupción original

Había dos fallos de ciclo de vida complementarios:

1. La imagen principal del Café se creaba sin indicar el frame base. Después de registrar los crops de oclusión en la misma textura, una reentrada podía resolver uno de esos crops como imagen principal y escalarlo al tamaño completo de la habitación. Eso explica exactamente el mostrador/sofás gigantes y los parches de la captura del usuario. El frame explícito `__BASE` elimina esa ambigüedad.
2. `cleanup()` destruía objetos de Phaser, pero conservaba entradas viejas en `agentViews` y `npcViews`. En la siguiente entrada, el renderer reutilizaba contenedores ya destruidos y los personajes podían desaparecer o quedar inconsistentes. Vaciar los mapas y las referencias al cerrar evita esa reutilización.

## Movimiento: qué funciona y qué todavía confunde

La captura pasiva demuestra que WASD sí mueve al actor:

| Paso | Celda de Syka | Resultado |
|---|---:|---|
| Poseer | `10,9` | W, S y D libres; A bloqueada por el mobiliario |
| W | `10,8` | movimiento válido |
| A | `10,8` | rechazo correcto: `9,8` no es caminable |
| S | `10,9` | movimiento válido |
| D | `11,9` | movimiento válido |

En `4x`, un NPC llegó a `10,8/10,9` durante la prueba. La ocupación dinámica convirtió una celda libre en reservada, por lo que apareció `Spatial destination is reserved`. No hubo solapamiento ni cruce del mobiliario: el sistema rechazó el paso.

Sí quedan dos problemas de experiencia:

- El toast de un paso bloqueado permanece visible después de un movimiento válido posterior. Visualmente parece que todos los movimientos fallaron aunque la celda sí cambió.
- Mientras un agente está poseído, un clic en el suelo se rechaza deliberadamente con `Use WASD while an actor is possessed`. El clic para caminar sólo funciona sin posesión. Esto es coherente con la implementación, pero no con la expectativa expresada por el usuario.

## Hallazgo secundario

En `4x`, un actor que pasa por delante del Café puede interceptar el clic físico del edificio y seleccionar al actor. Haciendo clic en una parte del techo libre se accede correctamente. Es un conflicto de prioridad de hit areas, no un problema de escena o escala.

## Ruido externo observado

El navegador registró respuestas `502` para `/bridge/api/world/state` y un `404` auxiliar del servidor actual. El juego cayó en modo local y siguió funcionando. No explican la corrupción del Café.

## Evidencia reproducible

- `current-reentry.json`: prueba normal de entrada, salida, reentrada, posesión, WASD y persistencia.
- `diagnostic-lifecycle.json`: cámaras, escalas, frames, escenas, vistas, actores y celdas.
- `current-1008x548-03-second-entry.png`
- `current-1008x548-06-wasd.png`
- `current-1008x548-07-persisted-reload.png`
- `current-1440x900-03-second-entry.png`
- `current-1440x900-06-wasd.png`

