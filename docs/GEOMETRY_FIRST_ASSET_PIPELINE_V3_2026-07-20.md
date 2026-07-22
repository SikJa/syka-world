# Syka World — Geometry First Asset Pipeline v3

Fecha: 2026-07-20  
Estado: sofá y mesa integrados y corregidos en laboratorio aislado  
Entrada local: `http://127.0.0.1:5173/geometry-first-lab.html`

## Objetivo

Comprobar si el pipeline híbrido validado con la estantería puede repetirse con
dos muebles de silueta distinta sin tocar el Café principal: un sofá ancho y
una mesa redonda.

## Assets producidos

ImageGen integrado se usó en modo de generación nueva con dos llamadas
independientes. Ambas tomaron como referencias la composición interior aprobada
y una captura del laboratorio para conservar cámara, densidad y paleta.

### Sofá

Prompt final resumido: sofá modular aislado de dos plazas, terciopelo verde
bosque capitonado, estructura de nogal cálido, pixel art detallado, perspectiva
isométrica ortográfica idéntica al laboratorio, cuatro apoyos legibles y fondo
croma `#ff00ff`; sin habitación, suelo, sombra, texto, personajes ni objetos
adicionales.

- fuente: `public/assets/generated/geometry-first-v3/sofa-source-chroma-v1.png`;
- transparencia: `public/assets/generated/geometry-first-v3/sofa-skin-v1.png`;
- asset consumido: `public/assets/generated/geometry-first-v3/sofa-skin-trimmed-v1.png`.

### Mesa

Prompt final resumido: mesa redonda de café aislada, madera nogal, pedestal
central y cuatro apoyos, dos tazas y una vela, pixel art detallado, perspectiva
isométrica ortográfica idéntica al laboratorio y fondo croma `#ff00ff`; sin
sillas, habitación, suelo, sombra, texto, personas ni objetos adicionales.

- fuente: `public/assets/generated/geometry-first-v3/table-source-chroma-v1.png`;
- transparencia: `public/assets/generated/geometry-first-v3/table-skin-v1.png`;
- asset consumido: `public/assets/generated/geometry-first-v3/table-skin-trimmed-v1.png`.

## Corrección del sofá

La primera integración reutilizaba la huella del sofá procedural anterior y
registraba el sprite por el centro alfa de sus píxeles inferiores. Esa banda
estaba sesgada hacia la pata frontal derecha: el dibujo se desplazó respecto de
la huella y el personaje podía aparecer dentro de media silueta.

La corrección final:

- restaura un pivote horizontal centrado (`0.5`);
- amplía la huella a `2.86 × 1.42`, cubriendo la base visible completa;
- amplía preventivamente la mesa a `1.56 × 1.56`;
- deriva colliders, tour, aproximación y overlay del mismo manifiesto;
- conserva el asiento del sofá en `(1.72, -0.99)`.

## Validación

- 3 archivos Vitest, 13/13 tests PASS;
- clic sobre la zona lateral ahora rechaza la ruta como físicamente inaccesible;
- tour sofá → mesa → estantería completado;
- asiento del sofá completado y visible;
- navegador sin errores ni warnings de aplicación;
- evidencia limpia: `reports/geometry-first-lab-v3/sofa-table-clean-corrected.png`;
- huellas corregidas: `reports/geometry-first-lab-v3/sofa-table-physics-corrected.png`;
- asiento: `reports/geometry-first-lab-v3/sofa-seated-corrected.png`.

## Conclusión honesta de escalabilidad

Este sistema evita escribir una implementación distinta por mueble, pero no
puede deducir una colisión exacta desde una imagen generada arbitrariamente.
Cada prop interactuable todavía necesita una única calibración de:

- escala visual;
- pivote de suelo;
- ancho y profundidad de la huella;
- anchors de interacción cuando correspondan.

Eso es normal en un pipeline de sprites, pero no escala bien a cientos de props
generados sin restricciones. Para Syka World es viable si el cuarto completo se
hornea como fondo y solo 10–25 entidades importantes reciben física. Para un
editor con cientos de muebles, hay que adoptar una plantilla isométrica estricta
por tamaños o usar geometría 3D como fuente autoritativa y renderizarla con piel
pixel-art.

No se recomienda migrar todavía el Café. El siguiente gate es una decisión de
producto/pipeline, no otro ajuste visual: limitar la cantidad de interactuables
o pasar la producción de props a plantillas espaciales estrictas.
