# Syka World — Habbo Contract Lab v1

Fecha: 2026-07-20  
Estado: prueba aislada implementada y validada  
Entrada local: `http://127.0.0.1:5173/habbo-lab.html`

## Objetivo

Probar la opción A antes de volver a tocar el Café: un contrato espacial estilo
Habbo donde la física se resuelve por tiles y el aspecto delante/detrás se
resuelve con capas de sprite creadas para cada mueble. El laboratorio no usa el
raster amueblado del Café ni footprints dibujados sobre su silueta.

## Implementación mínima

- habitación isométrica procedural de 8 × 7 tiles;
- un sofá que ocupa dos tiles lógicos;
- el mismo sofá se compone de tres partes renderizables: `sofa-back`,
  `sofa-seat` y `sofa-front`;
- una mesa independiente que ocupa un tile;
- un personaje procedural separado y con escala coherente;
- A* en ocho direcciones, sin atravesar muebles ni cortar esquinas bloqueadas;
- posición lógica por tile y posición visual interpolada entre centros;
- clic para caminar y WASD para solicitar un tile vecino;
- anchor de asiento especial: `E` o **Probar asiento** coloca al actor entre las
  capas trasera y delantera del sofá.

## Qué demuestra

1. Un tile ocupado por el sofá no puede ser un destino ni formar parte de la ruta.
2. El movimiento puede seguir siendo visualmente suave aunque la autoridad sea
   una grilla discreta.
3. Detrás del sofá, el actor se dibuja antes de `sofa-back`.
4. Delante del sofá, el actor se dibuja después de `sofa-front`.
5. Al sentarse, el orden real es
   `sofa-back → sofa-seat → actor → sofa-front`; el frente tapa las piernas sin
   que el personaje atraviese una imagen compuesta.

## Validación realizada

- TypeScript aislado: PASS;
- Vitest: 4/4 tests PASS;
- intento programático de caminar a `(4, 2)`: rechazado;
- clic real sobre un tile libre: destino alcanzado;
- clic real sobre el sofá: bloqueado y actor inmóvil;
- WASD real: un tile recorrido con interpolación;
- recorrido automático: estados `front`, `between` y `behind` observados;
- asiento: actor en profundidad `7.72`, entre `sofa-seat` (`7.28`) y
  `sofa-front` (`8.15`);
- navegador Chrome: cero errores de consola o página;
- responsive: sin overflow horizontal a 1008 px ni a 390 px.

Evidencia:

- `reports/habbo-contract-lab-v1-initial.png`;
- `reports/habbo-contract-lab-v1-behind.png`;
- `reports/habbo-contract-lab-v1-seated.png`;
- `reports/habbo-contract-lab-v1-debug.png`.

## Cómo probarlo

1. Desde `app/game`, ejecutar `npm run dev` si Vite no está activo.
2. Abrir `http://127.0.0.1:5173/habbo-lab.html`.
3. Pulsar **Recorrido delante/detrás** para observar el cambio de orden.
4. Pulsar **Probar asiento** para comprobar la inserción entre capas.
5. Pulsar **Mostrar contrato** para ver tiles sólidos, anchor y profundidades.
6. Intentar hacer clic sobre el sofá: el destino debe rechazarse.
7. Usar clic o WASD para mover al personaje por tiles libres.

## Límite honesto

El laboratorio valida el **contrato técnico**, no el arte definitivo ni la
migración del Café. El personaje, la habitación y los muebles son arte
procedural de prueba. Todavía no demuestra varios actores, apilado de muebles,
rotaciones, editor, portales, guardado, rutinas o bridge. Tampoco convierte cada
píxel del mueble en física: evita necesitarlo al usar tiles sólidos y capas
visuales explícitas, que es precisamente la decisión arquitectónica evaluada.

La siguiente decisión debe ser visual y manual: si el delante/detrás y el
asiento se sienten correctos, recién entonces conviene crear un mini kit de arte
final compatible con este contrato y migrar un fragmento del Café detrás de una
entrada experimental.
