# Café Biblioteca Safe Floor Integration v2

Fecha: 2026-07-20

## Resultado

La solución se integró en el Café real de Syka World. El raster aprobado sigue siendo la capa visual canónica; no se regeneró el interior ni se migró el juego a 3D.

## Contrato

- Los personajes sólo pueden apoyar los pies sobre celdas incluidas en la safe floor.
- Los visitantes comparten un pasillo central conectado a la entrada.
- El staff usa una isla separada detrás de la barra.
- Los muebles pintados siguen siendo landmarks semánticos, pero no cajas de colisión aproximadas.
- Sólo la barra usa un recorte frontal para ocultar correctamente la parte inferior del bartender.
- Una celda física se dibuja sin nudge por personaje.
- Un tile heredado fuera de la safe floor vuelve a un anchor válido.

## Alcance deliberado

Esta versión prioriza que ningún actor atraviese muebles. Por eso no habilita todo el suelo aparente ni asientos reales. Mesa, sofá, biblioteca y chimenea conservan acciones semánticas, pero sus puntos de aproximación actuales viven dentro del corredor seguro.

La expansión correcta es agregar corredores pequeños y verificarlos visualmente. No debe restaurarse el modelo anterior de un rectángulo por cada objeto pintado.

## Evidencia

- `npm test -- --run`: 37 archivos, 281 tests PASS.
- `npx vite build`: PASS; conserva el warning histórico del chunk principal.
- QA en navegador real: entrada de Syka, movimiento WASD, detención en el límite, NPC de servicio detrás de la barra y salida → reentrada same-runtime PASS.
- `npm run typecheck`: tres errores preexistentes fuera de este cambio (`habbo-lab/main.ts` ×2 y `qa/alphaQaApi.ts` ×1).

## Archivos principales

- `app/game/src/presentation/interior/cafeSpatialModel.ts`
- `app/game/src/presentation/interior/interiorModel.ts`
- `app/game/src/presentation/scenes/CafeInteriorScene.ts`
- tests homónimos en las mismas carpetas.
