# Syka World — Geometry First Lab v1

Fecha: 2026-07-20  
Estado: laboratorio aislado implementado y validado técnicamente; aprobación visual manual pendiente  
Entrada local: `http://127.0.0.1:5173/geometry-first-lab.html`

## Pregunta que responde

¿Puede Syka World usar un espacio tridimensional real para colisiones,
profundidad e interacciones, pero conservar una lectura visual 2.5D pixel-art?

El Café principal no fue modificado.

## Resultado

La prueba construye una habitación sin usar una ilustración como mundo:

- piso y cimientos tridimensionales;
- dos paredes físicas;
- ventana con escena nocturna;
- biblioteca con libros independientes;
- sofá, mesa y dos sillas como objetos 3D separados;
- planta, lámpara, alfombras, tazas y luz local;
- personaje con raíz espacial 3D y piel 2D pixel-art con depth testing.

El personaje visible reutiliza la columna 3 del atlas
`public/assets/generated/npc-v1/cafe-npcs-atlas-v1.png`. La geometría del
cuarto utiliza materiales y texturas procedurales originales.

## Contrato espacial

- Three.js `0.185.1` y WebGL;
- cámara ortográfica fija, sin órbita ni rotación;
- render interno de baja resolución, antialias desactivado y escalado
  `image-rendering: pixelated`;
- círculo continuo para el actor;
- rectángulos físicos continuos para sofá, mesa, sillas y biblioteca;
- colisión con substeps y sliding por ejes;
- rutas mediante grafo de visibilidad alrededor de volúmenes expandidos;
- ninguna grilla de navegación o depth sort manual;
- z-buffer real para delante/detrás;
- sofá con anchor de aproximación y anchor sentado;
- la piel 2D participa del depth buffer dentro de la escena 3D.

El modo **Ver física** muestra volúmenes y la cápsula del actor. No muestra
tiles ni una grilla.

## Controles

- WASD: movimiento continuo relativo a la cámara;
- clic sobre suelo libre: ruta geométrica;
- clic sobre el sofá: aproximación y asiento;
- `E` o **Sentarse**: interacción con el sofá;
- **Tour de profundidad**: detrás → delante → sentado;
- **Ver física**: volúmenes físicos y cápsula;
- **Contrato**: explicación dentro del laboratorio;
- **Reiniciar**: posición inicial.

## Validación ejecutada

### Lógica y tipos

- TypeScript aislado de `engine.ts`, `scene.ts` y `main.ts`: PASS;
- Vitest: 5/5 PASS;
- destino dentro de sofá/mesa: rechazado;
- sliding contra collider: PASS;
- grafo de visibilidad rodea muebles: PASS;
- interpolación continua sin snap: PASS.

### Chrome físico

- 18 muestras WASD: 18 posiciones diferentes;
- choque deliberado contra sofá: actor detenido en `x = 3.1416`;
- límite físico esperado: `2.92 + radio 0.22 = 3.14`;
- 43 frames de contacto sin penetrar el volumen;
- clic real sobre suelo: recorrido terminado en `(-2.4960, 2.3547)`;
- clic real sobre mesa: cero desplazamiento;
- clic real sobre sofá: ruta creada y estado sentado alcanzado;
- tour observado detrás en `(2.2836, -2.4211)`;
- tour observado delante en `(3.2734, -0.3813)`;
- asiento final en `(1.72, -0.99)`;
- cero errores de consola o página.

### Responsive

- `1008 × 720`: documento `1008 × 720`, sin overflow;
- `390 × 844`: documento `390 × 844`, sin overflow;
- canvas interno mantiene la relación del viewport (`195 × 422` en móvil),
  sin estiramiento del render.

## Evidencia

- `reports/geometry-first-lab-v1-initial.png`;
- `reports/geometry-first-lab-v1-behind.png`;
- `reports/geometry-first-lab-v1-front.png`;
- `reports/geometry-first-lab-v1-seated.png`;
- `reports/geometry-first-lab-v1-physics.png`;
- `reports/geometry-first-lab-v1-mobile.png`.

## Estado del build general

El laboratorio compila de forma aislada. `npm run build` del juego completo
sigue bloqueado por tres errores preexistentes fuera de este laboratorio:

- dos accesos `Tile | undefined` en `src/habbo-lab/main.ts`;
- `previewFurniturePlacement` ausente en `src/qa/alphaQaApi.ts`.

No se modificaron esos módulos porque no forman parte de esta prueba.

## Límites honestos

Este laboratorio demuestra la compatibilidad técnica entre:

1. mundo 3D real;
2. colisión continua;
3. oclusión automática;
4. personaje visual 2D;
5. render pixelado con cámara fija.

No demuestra todavía el arte final. El mobiliario es procedural, hay un solo
actor, el atlas tiene pocas poses y no existen editor, múltiples habitaciones,
varios agentes, navegación dinámica ni bridge.

El siguiente gate es exclusivamente manual: decidir si esta combinación
conserva mejor la identidad visual que los laboratorios raster/grid. Si se
aprueba el principio, corresponde mejorar un solo sofá, una silla, una mesa y
un personaje mediante el pipeline de assets definitivo antes de migrar el Café.
