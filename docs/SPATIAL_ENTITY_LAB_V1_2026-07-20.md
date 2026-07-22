# Syka World — Spatial Entity Lab v1

Fecha: 2026-07-20  
Estado: **invalidado por QA manual; conservar solo como antecedente**  
Entrada local: `http://127.0.0.1:5173/spatial-lab.html`

> **Corrección del 2026-07-20:** las capturas manuales demostraron que los
> footprints continuos no coincidían con el contorno visual: el actor podía
> atravesar la barra, quedar debajo de mesas y sillas y cruzar el sofá. Los
> checks automáticos de este documento verificaban las formas lógicas, pero no
> la composición visual completa. Por lo tanto, el resultado que sigue abajo
> es histórico y **no debe usarse como prueba de que el interior está resuelto**.
> La prueba vigente es `docs/HABBO_CONTRACT_LAB_V1_2026-07-20.md`.

## Resultado histórico (posteriormente refutado)

El laboratorio confirma que el interior puede conservar el detalle isométrico aprobado sin convertirse en 3D real y, al mismo tiempo, comportarse como un espacio de juego.

La diferencia decisiva respecto del Café actual es que la barra, la mesa y el sofá ya no forman parte de una única ilustración plana. Son tres entidades independientes. Cada una tiene:

- textura transparente propia;
- posición de mundo continua;
- footprint/collider propio;
- profundidad calculada;
- punto de interacción;
- orden de dibujo en relación con los pies de los actores.

La habitación vacía conserva suelo, paredes, ventana y estanterías como backplate. Elen y Alma usan sprites separados y una escala compartida.

## Qué demuestra

1. **Movimiento continuo:** WASD actualiza coordenadas por delta de tiempo, sin saltos visibles entre casillas.
2. **Click-to-move:** un planificador interno encuentra una ruta y el actor la recorre de forma suave.
3. **Colisión:** Elen se detiene o se desliza por el borde de un mueble y nunca entra en su área sólida.
4. **Profundidad:** el render ordena cada frame por la posición de los pies; Elen puede quedar detrás de la mesa y reaparecer delante.
5. **Interacción:** `E` cerca de la barra ejecuta una acción observable vinculada a esa entidad.
6. **Diagnóstico:** `Ver geometría` muestra footprints, anchors y coordenadas de pies para poder ajustar arte y física juntos.

## Validación realizada

- motor espacial: 3/3 tests Vitest;
- TypeScript aislado del laboratorio: PASS;
- navegador Chrome headless: cero errores de consola o página;
- WASD: siete muestras consecutivas y continuas, paso máximo de mundo `0.17085`;
- colisión física contra la mesa: 29 intentos bloqueados, actor fuera del collider;
- ruta automática alrededor de la mesa: un desvío registrado, destino alcanzado y actor fuera de colliders;
- profundidad: se observaron estados detrás y delante de la mesa;
- `E` en barra: respuesta `Elen pidió un café. La barra respondió como entidad.`

Evidencia:

- `reports/spatial-lab-v1-initial.png`;
- `reports/spatial-lab-v1-route-complete.png`;
- `reports/spatial-lab-v1-debug.png`;
- `reports/spatial-lab-v1-collision.png`.

## Assets modulares

Los assets están en `app/game/public/assets/generated/spatial-lab-v1/`:

- `room-base.png`;
- `counter.png`;
- `table-chairs.png`;
- `sofa.png`.

También se conservan sus fuentes con chroma para permitir una futura regeneración o mejora del matte.

## Por qué el pass anterior no produjo este resultado

El pass anterior construyó contratos espaciales, depth y máscaras de oclusión alrededor del raster completo del Café. Eso permitía que tests lógicos pasaran, pero el arte seguía siendo una sola escena amueblada. Por eso una huella desalineada, un crop incorrecto o una segunda entrada podían romper toda la ilusión.

Este laboratorio cambia la unidad de composición: ya no es “una habitación con actores encima”, sino “una habitación vacía que contiene entidades”. Esa es la base reutilizable que faltaba.

## Límite honesto

El laboratorio **no reemplaza todavía el Café del juego principal**. Tampoco demuestra aún rutinas simultáneas, portales, guardado o bridge dentro de la escena modular. El arte y los colliders del gate necesitan una pasada manual de alineación antes de escalar el sistema.

El siguiente gate correcto es integrar este mismo runtime detrás de una entrada experimental del Café y validar, en este orden:

1. Elen + Alma simultáneas;
2. barra + una mesa + sofá;
3. entrada, salida y reentrada;
4. `E` y `F`;
5. save/load;
6. recién entonces ampliar al resto del Café y a exteriores.

## Uso manual

1. Desde `app/game`, ejecutar `npm run dev` si el servidor no está activo.
2. Abrir `http://127.0.0.1:5173/spatial-lab.html`.
3. Usar WASD o clic en el piso.
4. Mantener movimiento contra la mesa para comprobar el bloqueo.
5. Pulsar `Ejecutar ruta de prueba` para ver el desvío y el cambio de profundidad.
6. Pulsar `Ver geometría` para inspeccionar colliders y anchors.
7. Acercarse a una marca turquesa y pulsar `E`.
