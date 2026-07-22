# Isometric Playable Alpha v1 — baseline

Fecha: 2026-07-16.

## Estado antes de implementar

- worktree preexistente sin commits; todos los archivos del proyecto aparecen sin seguimiento y se preservan;
- Python 3.11.15;
- Node 24.14.1;
- npm 11.14.1;
- Bridge v0.3 respondió en `127.0.0.1:8765/health` con `ok=true` y `errors=0`;
- no se reinició Hermes;
- 39/39 pruebas Python pasaron en 1,402 s;
- `app/game` no existía;
- el puerto 5173 estaba ocupado por un Vite del Visual Lab 3D; se verificó su command line y se cerró sólo ese proceso antes del QA del nuevo juego;
- el Visual Lab permanece preservado en `lab/visual` y no se reutiliza como frontend.

## Selección inicial de renderer

- TypeScript + Vite;
- Phaser 4.2.1, MIT, usado como motor 2D de escenas/cámara/input;
- renderer Canvas con `pixelArt`, antialias desactivado y `roundPixels`;
- proyección isométrica propia 2:1;
- canvas lógico 720×450 para captura 1440×900 a escala 2×.

El primer build de spike fue reproducible y sin errores de tipo. El bundle inicial de Phaser genera una advertencia de chunk grande; queda registrado para optimización después del gate, no se oculta.

## Estado del gate

El ciclo 1 produjo seis capturas y una captura posterior a pan. El director visual independiente todavía debe emitir el veredicto. La ciudad no está autorizada a escalar hasta un `APROBADO` escrito.
