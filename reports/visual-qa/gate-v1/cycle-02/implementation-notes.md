# Notas de implementación — gate visual ciclo 02

Fecha: 2026-07-16  
Escena: `VisualGateScene`  
Estado de escala: ciudad todavía no escalada; sólo spike exterior.

## Contrato visual

- Canvas lógico: 720×450.
- Viewport QA: 1440×900 CSS px, DPR 1.
- Tile lógico: 32×16, proporción isométrica 2:1.
- Proyección: ejes fijos opuestos; cámara sin rotación.
- Renderer: Phaser 4 2D con selección automática WebGL/Canvas; las capturas QA usan WebGL de Chromium.
- Filtrado: nearest-neighbor, `pixelArt`, sin antialias y con `roundPixels`.
- Atlas de terreno: 8 frames de 320×160 renderizados a 32×16, alpha binario, sin gutters.
- Sprites: crops y pivotes explícitos según `atlas-manifest.json`; edificios con pivote inferior y props con pivote inferior central.
- Profundidad: orden determinista por suma de coordenadas de grilla y offsets por familia.

## Cámara y evidencia

- Zooms discretos reproducibles: 1.0, 1.5 y 2.0.
- Pan por arrastre; no existe control de rotación.
- La serie conserva el mismo ancla de cámara; a 150% y 200% el recorte es una consecuencia real del zoom.
- Atardecer: hora 19.25, tinte ambiental cálido y luces activas.
- Noche: hora 22.0, ambiente frío más oscuro y luces locales identificables.

## Cambios frente al ciclo 01

- Se reemplazaron edificios, árboles, props y tiles procedimentales dominantes por un kit raster original generado y normalizado.
- Casa y cafetería poseen silueta, footprint y utilería diferentes.
- Se incorporaron tres escalas de vegetación y grupos narrativos de objetos.
- Se agregaron microdetalles de césped en una capa modular y escasa; no reemplazan los tiles ni bloquean caminos.
- El estado nocturno ahora altera materialmente el mundo mediante tintes del renderer WebGL, no sólo el HUD o el fondo.
- Se agregó el paquete completo de seis capturas, metadata y doce frames de pan.

## Limitaciones honestas

- Todos los assets del kit siguen siendo provisionales hasta el veredicto independiente y la aprobación del usuario.
- El borde vertical de la isla y el HUD aún son formas simples del renderer.
- El set contiene sólo una casa y una cafetería; no debe escalarse antes de aprobar el gate.
- Los halos de faroles son una contribución aditiva pequeña y todavía deben juzgarse en las capturas nocturnas.
- El bundle de Phaser supera 500 kB y Vite emite una advertencia de tamaño; no afecta este gate visual, pero queda para optimización posterior.
