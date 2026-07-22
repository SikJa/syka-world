# Syka World — verificación final de navegador

**Resultado:** PASS

Método: Chromium headless, Python Playwright, bridge controlado GET-only y servidor temporal gestionado por `with_server.py`.

## 1008x548 — PASS

- Canvas: 828×450 lógico; cobertura 0.999658; error de escala 3e-05.
- Syka: 24 nodos de ruta; 405 comandos gráficos.
- Framing Muestra: cámara estable al seleccionar Syka = True; visibilidad mínima de edificio = 1.
- Edificios: 9 sprites medidos contra sus huellas; solapamientos lógicos con carretera = 0.
- Interior: 4 hotspots medidos y 4 hover/click físicos.
- Bridge: 4 requests observadas, sólo GET = True.
- Consola: 0 warnings/errors; page errors: 0; respuestas HTTP fallidas: 0.
- Ruido del driver ignorado: 4 warnings WebGL ReadPixels provocadas por capturas.
- Rendimiento: ciudad 53.25 FPS; interior 52.51 FPS.
- Evidencias: reports/e2e/final-browser/screenshots/city-syka-path-1008x548.png, reports/e2e/final-browser/screenshots/cafe-interior-hotspot-1008x548.png

## 1440x900 — PASS

- Canvas: 720×450 lógico; cobertura 1.0; error de escala 0.
- Syka: 24 nodos de ruta; 405 comandos gráficos.
- Framing Muestra: cámara estable al seleccionar Syka = True; visibilidad mínima de edificio = 1.
- Edificios: 9 sprites medidos contra sus huellas; solapamientos lógicos con carretera = 0.
- Interior: 4 hotspots medidos y 4 hover/click físicos.
- Bridge: 4 requests observadas, sólo GET = True.
- Consola: 0 warnings/errors; page errors: 0; respuestas HTTP fallidas: 0.
- Ruido del driver ignorado: 0 warnings WebGL ReadPixels provocadas por capturas.
- Rendimiento: ciudad 52.66 FPS; interior 51.25 FPS.
- Evidencias: reports/e2e/final-browser/screenshots/city-syka-path-1440x900.png, reports/e2e/final-browser/screenshots/cafe-interior-hotspot-1440x900.png

## Criterios aplicados

- El canvas debe cubrir el viewport y mantener el mismo factor de escala horizontal y vertical.
- La selección de Syka debe abrir inspector, mostrar destino/tramos y producir geometría real de trayectoria.
- Cada sprite debe respetar offset/pivote calibrado, huella sólida y acceso de carretera sin reservar tiles de carretera.
- El Café debe adaptarse al viewport; sus hotspots deben quedar dentro de la habitación, responder a hover/click y no crear cues u overlays gigantes.
- El bridge queda estrictamente pasivo: sólo lecturas GET sin body ni endpoints de comandos/tareas.
