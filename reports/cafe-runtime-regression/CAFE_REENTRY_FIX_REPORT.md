# Café reentry integrity fix

Fecha: 2026-07-17  
Estado: **PASS**

## Incidente

La corrupción reportada por el usuario era real. Después de entrar al Café, volver a la ciudad y abrirlo otra vez dentro de la misma partida, una porción del raster —por ejemplo la barra— podía ocupar todo el cuarto y las capas restantes quedaban como fragmentos flotantes. En paralelo, actores podían conservar vistas destruidas, aparecer desde una posición semántica obsoleta o interpolar en línea recta a través del mobiliario.

La evidencia histórica de primera entrada no cubría este ciclo de vida y, por lo tanto, no era suficiente para declarar íntegra la reentrada.

## Causas

1. `CafeInteriorScene.createRoom()` creaba el fondo sin identificar el frame. Tras registrar recortes de primer plano sobre `alpha-cafe-interior`, Phaser podía cambiar su `firstFrame`; la siguiente escena estiraba ese recorte a `roomBounds`.
2. El shutdown no vaciaba de forma explícita todos los mapas de vistas y referencias de presentación. Una nueva escena podía intentar reconciliar objetos Phaser destruidos.
3. El modelo espacial contenía cuatro casillas marcadas transitables pero desconectadas del componente de la puerta: `{30,2}`, `{30,3}`, `{30,4}` y `{22,13}`.
4. La entrada `{15,17}` no tenía salida inmediata hacia arriba y hacía que `W` pareciera roto al comenzar.
5. El renderer podía usar tile/anchor de rutina en lugar de la celda autoritativa del controlador y animaba cambios grandes mediante un tween recto, sin recorrer la ruta física.

## Correcciones

- El fondo solicita explícitamente `alpha-cafe-interior/__BASE`.
- `cleanup()` cancela tweens, destruye y vacía agentes/NPC/capas y restablece referencias de escena.
- El walk grid interior conserva un único componente conectado; se retiraron las cuatro casillas inválidas y la entrada pasó a `{16,17}`.
- Agentes y NPC almacenan su celda renderizada y avanzan por `findSpatialPath`, un vecino cardinal por tramo.
- El renderer de agentes prioriza la celda del actor controlado. Una posición antigua imposible se corrige sin dibujar un cruce por mesas o paredes.
- Se agregaron pruebas unitarias de conectividad completa y ruta cardinal, además de una regresión E2E de reentrada en el mismo runtime.

## Verificación

- Frontend: **225/225 PASS**.
- Python/bridge/simulación: **39/39 PASS**.
- Typecheck: **PASS**.
- Build: **PASS**; persiste sólo el warning conocido de chunk Vite >500 kB.
- `cafe_reentry_regression_e2e.py`: **PASS**, 1008×548, misma página/contexto/instancia Phaser.
- Primera y segunda entrada: room frame `__BASE`, fuente 1774×887, display 674×337 coincidente con `roomBounds`.
- Reconstrucción: Syka, Alma y Milo activos y visibles; room/vistas anteriores inactivas y vistas nuevas creadas.
- Movimiento: `W` mueve `{10,9}` → `{10,8}`; `A` hacia `{9,8}` se rechaza por colisión.
- E2E físico general repetido: **14/14 PASS** a 1440×900.
- Red: bridge GET-only, cero writes/tareas.
- Procesos: el puerto temporal 5188 quedó cerrado; el Vite preexistente en 5173 quedó intacto.

Informe de máquina: `cafe-reentry-regression-report.json`.  
Capturas: `01-first-entry-1008x548.png`, `02-second-entry-1008x548.png`, `03-second-entry-movement-1008x548.png`.

## Deudas menores no bloqueantes

- Mientras **Poseer** está activo, el clic de suelo se rechaza deliberadamente: el control es WASD. La UI debería explicarlo mejor.
- Un toast de rechazo puede permanecer visible después de un movimiento válido.
- A zoom 4×, un actor puede interceptar ocasionalmente el clic dirigido al edificio.

Estas deudas no reproducen corrupción visual, reutilización de vistas ni cruce físico por mobiliario.
