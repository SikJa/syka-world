# Syka World — Geometry First Asset Pipeline v2

Fecha: 2026-07-20  
Estado: prueba aislada implementada y validada; no integrada al Café principal  
Entrada local: `http://127.0.0.1:5173/geometry-first-lab.html`

## Pregunta de esta prueba

¿Podemos conservar el detalle cálido y pixel-art de las referencias de Syka
World sin volver a separar el dibujo del objeto que ocupa espacio?

La respuesta de este mockup es **sí para un asset piloto**. La estantería dejó
de ser un modelo procedural genérico y pasó a ser un asset híbrido con:

- una piel pixel-art transparente de alta densidad;
- una posición mundial única;
- una huella física explícita;
- profundidad WebGL y cámara ortográfica fija;
- un margen visible del actor derivado del mismo collider.

## Decisión de arquitectura

El arte no vuelve a ser el mapa físico. Tampoco existe una huella suelta que se
ajusta a ojo en otro archivo. `BOOKSHELF_ASSET` es la fuente compartida para:

1. colocar la piel visible;
2. derivar el collider;
3. calcular el punto seguro de aproximación;
4. dibujar el modo técnico de QA.

El personaje conserva su atlas 2D con relieve por píxel. El piso y el resto de
la habitación continúan siendo geometría real. Esto permite reemplazar una
pieza procedural por arte final sin perder el contrato espacial.

## Arte generado y procedencia

Se usó ImageGen integrado en modo de generación nueva, tomando como referencias:

- `public/assets/reference/cafe-interior-library.png`;
- `public/assets/generated/visual-contract-v1/reference-concept-v1.png`.

Dirección del prompt: una única estantería isométrica pixel-art, madera nogal
cálida, libros, planta y pequeños detalles, densidad equivalente a la referencia,
cámara ortográfica fija y fondo croma magenta uniforme.

Archivos conservados:

- fuente croma: `public/assets/generated/geometry-first-v2/bookshelf-source-chroma-v1.png`;
- transparencia procesada: `public/assets/generated/geometry-first-v2/bookshelf-skin-v1.png`;
- piel recortada consumida por el juego: `public/assets/generated/geometry-first-v2/bookshelf-skin-trimmed-v1.png`.

## Implementación

- contrato: `src/geometry-first-lab/spatialAssets.ts`;
- collider derivado: `src/geometry-first-lab/engine.ts`;
- render de la piel: `src/geometry-first-lab/scene.ts`;
- aproximación segura y prueba guiada: `src/geometry-first-lab/main.ts`;
- prueba automatizada del contrato: `src/geometry-first-lab/spatialAssets.test.ts`.

El botón **Prueba estantería** lleva al actor al límite seguro del objeto. **Ver
física** superpone la base y el volumen del personaje sin introducir una grilla
de navegación.

## Validación

- Vitest: 3 archivos, 11/11 tests PASS;
- la base física conserva exactamente ancho, profundidad y centro del asset;
- el punto de aproximación deja un margen positivo luego de descontar el radio
  completo del personaje;
- recorrido físico observado: actor detenido en `x -0.74 · z -1.55` frente a
  la estantería;
- navegador: cero errores o warnings; solo mensajes de conexión HMR de Vite;
- evidencia limpia: `reports/geometry-first-lab-v2/bookshelf-visual-proof.png`;
- evidencia técnica: `reports/geometry-first-lab-v2/bookshelf-footprint.png`.

## Límite honesto

Esto no es el arte final de la habitación ni una migración del Café. Solo la
estantería atraviesa hoy el pipeline híbrido; sofá, mesa, sillas, paredes y
decoración siguen siendo props procedurales de laboratorio. La diferencia de
calidad entre la estantería y el resto es deliberada: permite evaluar una sola
variable sin reconstruir el interior completo.

La prueba valida el método. El siguiente gate, si se aprueba visualmente, es
convertir un conjunto mínimo coherente — sofá, mesa, silla y pared — usando el
mismo contrato antes de tocar el juego principal.
