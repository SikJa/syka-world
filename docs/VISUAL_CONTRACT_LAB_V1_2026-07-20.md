# Syka World — Visual Contract Lab v1

Fecha: 2026-07-20  
Estado: prueba visual y espacial aislada implementada y validada  
Entrada local: `http://127.0.0.1:5173/visual-contract-lab.html`

## Objetivo

Comprobar que el contrato estilo Habbo validado en `habbo-lab.html` puede
convivir con el nivel de detalle visual aprobado para Syka World, sin mostrar
una grilla ni hacer que el movimiento salte entre casillas.

El Café principal no fue modificado.

## Resultado

La escena combina cuatro assets reales e independientes:

- habitación vacía detallada: `spatial-lab-v1/room-base.png`;
- sofá verde: `spatial-lab-v1/sofa.png`;
- mesa y dos sillas: `spatial-lab-v1/table-chairs.png`;
- personaje Iara: columna 3 del atlas `npc-v1/cafe-npcs-atlas-v1.png`.

La habitación conserva paredes, ventana, iluminación y estanterías en el
backplate. El sofá, la mesa y el actor siguen siendo entidades separadas.

## Contrato híbrido

- navegación autoritativa sobre 14 × 14 microtiles de medio módulo;
- los tiles son invisibles salvo en modo diagnóstico;
- posición y velocidad del actor usan números flotantes;
- WASD aplica aceleración, velocidad continua y frenado;
- el clic ejecuta A* sobre la grilla, simplifica los waypoints por línea de
  visión y los recorre continuamente;
- un radio de actor evita entrar en celdas ocupadas y permite sliding;
- el sofá se renderiza primero como pieza completa y luego vuelve a dibujar
  únicamente su frente recortado;
- el asiento usa un anchor con elevación visual y fuerza este orden:
  `sofa-base → actor-seated → sofa-front`;
- la interfaz HTML es responsive e independiente de la física.

## Concepto visual generado

Archivo: `app/game/public/assets/generated/visual-contract-v1/reference-concept-v1.png`  
Modo: herramienta integrada ImageGen  
Rol: referencia de composición únicamente; no se usa como escena, collider ni
textura del runtime.

Prompt final:

> Use case: stylized-concept. Asset type: visual target for a small playable
> isometric game laboratory. Image 1 is the primary quality, palette, lighting
> and detail reference; Image 2 fixes the empty-room geometry and camera; Image
> 3 fixes the green upholstered sofa design; Image 4 fixes the round café table
> and chairs; Image 5 fixes the scale and mature pixel-art character style.
> Compose a small, technically achievable café-library corner showing how these
> modular assets should look together in Syka World. Preserve a fixed isometric
> camera and crisp, detailed 2D pixel-art appearance. Use warm wood paneling at
> twilight, a large window with a softly blurred cozy town, bookshelves, wood
> floor, subtle rugs and a few plants. Keep a generous walkable aisle. Include
> one green sofa, one round table with two chairs and one correctly scaled adult
> character walking beside the furniture. Use warm amber practical lights
> against cool blue twilight. Keep every runtime-relevant object visually
> separable. No visible grid, UI, labels, text or watermark. Avoid photorealism,
> smooth 3D, toy proportions, tiny characters, floating feet, distorted or
> duplicated furniture and people intersecting objects.

## Validación

- TypeScript aislado: PASS;
- Vitest: 5/5 tests PASS;
- WASD físico: 18/18 frames con posiciones distintas;
- paso máximo medido por frame: `0.04956` unidades de mundo;
- clic real sobre piso libre: destino exacto alcanzado;
- clic real sobre el sofá: rechazado, sin mover al actor;
- ruta automática: actor observado completamente detrás y luego delante;
- asiento: actor inmóvil en depth `9.22`, entre sofá base y frente;
- el actor nunca terminó dentro de una celda ocupada;
- diálogo de referencia: imagen `1456 × 1080` cargada;
- Chrome: cero errores de consola o página;
- responsive: cero overflow horizontal a 1008 px y 390 px.

Evidencia:

- `reports/visual-contract-lab-v1-initial.png`;
- `reports/visual-contract-lab-v1-behind.png`;
- `reports/visual-contract-lab-v1-seated.png`;
- `reports/visual-contract-lab-v1-debug.png`.

## Cómo probarlo

1. Abrir `http://127.0.0.1:5173/visual-contract-lab.html`.
2. Usar WASD manteniendo una tecla: el desplazamiento no debe hacer snap.
3. Hacer clic en diferentes sectores del piso.
4. Hacer clic sobre el sofá o la mesa: el actor no debe entrar.
5. Pulsar **Recorrido suave** para observar desaparición detrás y reaparición
   delante del sofá.
6. Pulsar **Sentarse** para probar el anchor y las capas.
7. Pulsar **Ver sistema** para revelar la grilla, ocupación y anchors.
8. Pulsar **Objetivo visual** para comparar el runtime con el concepto.

## Límite honesto

Este laboratorio demuestra que visual aprobado, grilla invisible y movimiento
continuo pueden convivir. Todavía no es el Café final. Solo contiene un actor,
un sofá interactivo y una mesa bloqueante. No cubre varios actores, evasión
local, rotaciones, editor, otros anchors, portales, save/load ni bridge.

El siguiente gate correcto es la aprobación visual manual. Si se aprueba, se
puede convertir esta escena en el kit maestro de interiores y migrar un rincón
experimental del Café; no corresponde rehacer todo el interior de una sola vez.
