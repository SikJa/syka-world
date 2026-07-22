# Syka World — informe final Isometric Playable Alpha v1

Fecha de cierre: 2026-07-16  
Resultado: **ALPHA LOCAL JUGABLE — COMPLETADA CON PROVISIONALES DOCUMENTADOS**

## Resultado entregado

La ejecución convirtió Foundations v1 en una app web local nueva bajo `app/game`, sin reemplazar el Visual Lab. La alpha une una ciudad isométrica editable, progresión, Café Biblioteca interior, ciclo día/noche, cuatro agentes locales, persistencia y un bridge Hermes estrictamente pasivo.

Flujo demostrado:

```text
abrir Muestra o Nueva partida
→ explorar con pan/zoom fijo
→ comprar y colocar
→ ver cimientos y estructura
→ entrar al interior amueblado
→ instalar decoración
→ volver conservando estado
→ guardar, recargar y continuar
```

## Sistemas verificados

- Phaser 4.2.1 + TypeScript + Vite, renderer WebGL mediante `Phaser.AUTO`;
- cámara 2.5D isométrica fija, zoom 100/150/200%, sin rotación;
- Muestra con nueve edificios y Nueva partida con 420 Lúmenes/hogar inicial;
- catálogo, placement, colisiones, acceso, costo y saldo insuficiente;
- cimientos, framing, terminación, mejora de cafetería y sector desbloqueable;
- día, atardecer y noche;
- interior aislado, amueblado por defecto y decoración opcional;
- cuatro agentes y rutinas locales; ocultarlos no pausa el mundo;
- ocho estados derivados del bridge y recompensa local moderada;
- bridge online/simulated/degraded/offline limitado a GET;
- save/load `syka.world.save.v1`, migración explícita y errores seguros;
- QA local visible y separado que nunca actúa sobre Hermes.

## Evidencia final

| Superficie | Resultado | Evidencia |
|---|---|---|
| Frontend tests | 18 archivos, **84/84 PASS** | corrida final desde `app/game` |
| Typecheck | **PASS** | `npm run typecheck` |
| Build | **PASS** | `npm run build` |
| Suite Python | **39/39 PASS** | `.venv\Scripts\python -m unittest discover -s tests -v` |
| E2E Chromium | **14/14 PASS**, 0 fail, 0 blocked | `reports/e2e/alpha-v1/ALPHA_V1_E2E_REPORT.md` |
| Higiene navegador | 0 page errors, 0 console errors inesperados, 0 assets fallidos | informe E2E/JSON |
| QA visual independiente | **APROBADO PARA ALPHA — 86,2/100** | `reports/visual-qa/final-alpha/FINAL_VISUAL_QA.md` |
| Bridge controlado | 27 requests, sólo GET, 0 bodies | E2E #13 |
| Bridge real | 4 requests, sólo GET, cuatro perfiles, `tasks_started=0` | E2E #14 |
| Puertos frontend | 5173/4173 sin listeners | comprobación posterior al último pase |

## Rendimiento observado

- carga fría hasta ready: **0,952 s**;
- recarga cálida: **0,502 s**;
- Phaser `actualFps` mediana: **60,14**;
- Phaser p10: **59,91**;
- RAF navegador: **60,23 FPS**;
- mediana: **16,67 ms/frame**;
- heap usado: **60,3 MB**;
- escena: 538 display objects, 529 images, 11 textures y 13 draw calls.

La prueba se ejecutó en Chromium headless sobre la máquina actual. Estos números validan el mapa alpha; no son una promesa para hardware o mapas futuros.

## Cierre visual

Las capturas finales demuestran ciudad de día/atardecer/noche, zoom 100/150/200, agentes visibles/ocultos, nueva partida, construcción, interior y 1024×640.

El feedback ambiental quedó aplicado y recapturado después del último ajuste:

- farolas pequeñas con la base sobre pasto junto a cruces, no en el asfalto;
- bancos pequeños, completos y alineados con la senda;
- césped con motas, hojas, flores y variación tonal sutil;
- sin fuente pública improvisada;
- decoración interior comprada como objeto individual;
- interior sin fondo negro, con madera, libros, chimenea, cocina/barra, mesas, plantas y ciudad por la ventana.

La aprobación visual no oculta diferencias frente a las referencias: el exterior tiene menos vegetación orgánica, más repetición residencial y conos de luz más duros. El interior alcanza una cercanía de lenguaje mucho mayor.

## Bridge y seguridad

El bridge sigue siendo fuente de observación, no de ejecución. La validación real leyó `/health`, estado y eventos; observó exactamente `default`, `elen`, `astrelis` y `zerny`, todos online/idle en ese momento. No se inició una tarea para fabricar evidencia y no se usó POST.

También se preservaron estos límites:

- sin prompts completos, razonamiento, argumentos de tools o resultados sensibles;
- sin commit, push, PR, deploy o publicación;
- sin empaquetado o inicio automático;
- sin cerrar ni alterar Hermes;
- sin acciones externas irreversibles.

## Provisionales y deuda conocida

- Los cuatro agentes son placeholders; no fijan pet, especie o avatar final.
- El kit raster `alpha-v1` está aprobado para esta integración, no congelado como arte final.
- `Lúmenes` y su balance pueden cambiar.
- La secuencia de ocho estados está validada funcionalmente, pero no hay una captura final legible de cada variante.
- El bundle principal es **1.504,33 kB** (**397,86 kB gzip**) y Vite conserva el warning de chunk mayor a 500 kB. La carga local cumple, pero conviene dividirlo antes de crecer.
- Quedan como pulido conos de luz, vegetación/microescenas, variantes residenciales y UI en resolución pequeña.
- Una tarea Hermes natural podrá observarse en una sesión futura; no es requisito seguro para cerrar esta alpha.

## Cómo probar

Seguir `docs/ALPHA_RUNBOOK.md`. En resumen:

```powershell
Set-Location -LiteralPath 'F:\Coding Proyects\Syka World Game\app\game'
npm ci
npm run dev
```

Abrir `http://127.0.0.1:5173/` o `http://127.0.0.1:5173/?mode=progressive`. Al terminar, detener Vite y comprobar que 5173/4173 estén libres.

## Conclusión

La meta de producir una alpha vertical local, jugable, visualmente coherente y conectada de forma pasiva con Hermes queda cumplida. El siguiente paso correcto es jugarla y elegir pulido/personajes; no reabrir la arquitectura ya validada ni presentar los provisionales como definitivos.
