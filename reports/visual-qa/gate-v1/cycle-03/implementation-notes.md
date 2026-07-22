# Notas de implementación — gate visual ciclo 03

Fecha: 2026-07-16  
Escena: `VisualGateScene`  
Estado: spike exterior congelado para revisión; ciudad no escalada.

## Contrato técnico

- Canvas lógico 720×450; viewport QA 1440×900 CSS px, DPR 1.
- Proyección isométrica fija 2:1; tile lógico 32×16.
- Phaser 4 2D; Chromium QA selecciona WebGL.
- `nearest-neighbor`, `pixelArt`, sin antialias y `roundPixels`.
- Zoom discreto 1.0/1.5/2.0; pan por arrastre; rotación inexistente.
- Profundidad determinista por coordenadas de grilla y capa semántica.

## Correcciones del ciclo 03

- Atlas de terreno v2: ocho frames exactos 320×160 a escala 0.1, alpha binario y sin outline oscuro perimetral.
- Tres variantes de césped combinadas con microdecals escasos; la retícula ya no se dibuja mediante bordes de tile.
- Sólo seis farolas, reducidas y desplazadas al borde exterior de las veredas; ninguna se ancla al asfalto.
- Un único banco reducido dentro de un rincón pavimentado con jardinera y árbol.
- Atardecer con ambiente más frío; noche más oscura pero navegable.
- Máscaras raster de luz con mezcla aditiva: pools de farolas, derrames de puertas y halos de ventanas/bombillas.
- Las fuentes locales afectan suelo/fachada de forma no uniforme; no se usa un overlay nocturno único.

## Evidencia

- Seis PNG reproducibles con mismo ancla de cámara.
- Doce frames consecutivos de pan a 150%.
- Estado del navegador, errores y metadata registrados automáticamente.
- Capturas sin retoque ni reescalado posterior.

## Limitaciones honestas

- Casa, cafetería, props, terreno y FX siguen siendo candidatos provisionales.
- El borde vertical de isla y el HUD continúan simples.
- El gate contiene sólo dos edificios por diseño; no se amplió antes del veredicto.
- Los pools de luz se validan por primera vez en este ciclo y pueden requerir ajuste de intensidad posterior.
- Vite aún advierte que el bundle monolítico de Phaser supera 500 kB; no afecta la evaluación visual del spike.
