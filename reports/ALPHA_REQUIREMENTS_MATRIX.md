# Syka World Alpha v1 — matriz requisito → evidencia

Última actualización: 2026-07-16. Estado: **cierre final**.

Leyenda:

- **verificado:** evidencia ejecutada o inspeccionada en la superficie adecuada;
- **verificado automatizado:** cubierto por tests de core/DOM, sin recorrido visual manual dedicado;
- **provisional:** usable para la alpha, pero no aprobado como diseño/arte final;
- **pendiente futuro:** fuera del cierre seguro de esta alpha.

Pasar pruebas unitarias no sustituye navegador, capturas, rendimiento o validación viva. La observación GET del bridge no se presenta como una tarea Hermes completa.

| # | Requisito | Evidencia de cierre | Estado |
|---:|---|---|---|
| 1 | app web local nueva | `app/game`; arranque, E2E, typecheck y build | verificado |
| 2 | Visual Lab heredado preservado | `lab/visual` separado; no se promueve ni sobrescribe | verificado |
| 3 | renderer isométrico fijo | Phaser 4.2.1, proyección propia, `rotation_available=false`, pan/zoom E2E | verificado |
| 4 | nitidez y profundidad | capturas runtime 100/150/200; QA visual sin blur/seams dominantes | verificado |
| 5 | gate visual previo a escala | ciclos 1–3; ciclo 3 aprobado 87/100 para spike | verificado para kit pequeño |
| 6 | kit visual alpha | atlas/manifests/provenance; QA técnico; integración visual final 86,2/100 | verificado provisional |
| 6a | farolas/bancos/césped/fuente | recapturas post-.16: bases en pasto, bancos pequeños/alineados, microdetalle, sin fuente | verificado |
| 7 | modo Muestra | E2E #01: nueve edificios y cuatro perfiles | verificado |
| 8 | Nueva partida | E2E #08: 420 Lúmenes y hogar inicial | verificado |
| 9 | mapa editable y placement | E2E #09 + tests de validez, colisión, acceso y sector | verificado |
| 10 | construcción por etapas | E2E #09/#10: cimientos, framing y completado | verificado |
| 11 | Lúmenes y compra | E2E registra 420→180 y decor 1015→1006; tests cubren saldo insuficiente | verificado |
| 12 | catálogo y bloqueos | catálogo/UI/tests exponen precio, bloqueo y mensajes | verificado automatizado |
| 13 | mejora de cafetería | core/model tests cubren costo, target level y construcción | verificado automatizado |
| 14 | expansión de sector | test DOM compra `east-gardens`; core valida pago y desbloqueo | verificado automatizado |
| 15 | día/atardecer/noche | E2E #03 y tres capturas 1440×900 | verificado |
| 16 | cafetería exterior seleccionable | E2E #04/#05 | verificado |
| 17 | interior aislado amueblado | E2E #05/#10; QA visual confirma objetos narrativos y escena separada | verificado |
| 18 | fondo urbano sincronizado | ciudad visible por ventana, período atardecer y fondo no negro | verificado visualmente |
| 19 | transición conserva estado | E2E #07 conserva centro y zoom; click-through corregido | verificado |
| 20 | decoración opcional | E2E #06 compra/instala helecho individual | verificado |
| 21 | cuatro perfiles correctos | `default`, `elen`, `astrelis`, `zerny` en Muestra y bridge real | verificado; avatares provisionales |
| 22 | rutinas locales | pathfinding/schedule tests y runtime de agentes | verificado automatizado |
| 23 | ocultar agentes no pausa | test de simulación + capturas visibles/ocultas | verificado |
| 24 | ocho estados visuales | E2E #12 observa 15 eventos, ocho estados y recompensa 5 | funcional verificado; variantes visuales finales no capturadas una por una |
| 25 | bridge GET-only | cliente fija GET; controlado 27 requests, real 4, bodies=0, tasks_started=0 | verificado |
| 26 | reconexión/concurrencia | E2E #13 + reducer/sesiones tests | verificado |
| 27 | online/simulated/degraded/offline | E2E online→simulated→online; tests cubren degradado/offline | verificado |
| 28 | privacidad/sanitización | tests de summary/errores + auditoría de red sin bodies | verificado |
| 29 | progreso sin Hermes | Nueva partida/simulación local funciona con fallback | verificado |
| 30 | save/load versionado | E2E #11, reload real, esquema `syka.world.save.v1` | verificado |
| 31 | migración/rechazo seguro | tests de v0 explícito e incompatibilidad | verificado automatizado |
| 32 | QA local separado | `?qa=1`, UI “nunca Hermes”, acciones sólo locales | verificado |
| 33 | suite histórica | Python 39/39 final | verificado |
| 34 | suite frontend | 18 archivos, 84/84; typecheck/build PASS | verificado |
| 35 | E2E principal | 14/14 PASS, 0 FAIL, 0 BLOCKED | verificado |
| 36 | QA visual final independiente | `reports/visual-qa/final-alpha/FINAL_VISUAL_QA.md` | aprobado para alpha, 86,2/100 |
| 37 | rendimiento | 60,14 FPS Phaser mediana; 60,23 RAF; 16,67 ms; cold .952 s; warm .502 s; 60,3 MB; 13 draws | verificado |
| 38 | cierre de servidores | comprobación final 5173/4173 sin listeners | verificado |
| 39 | documentación canónica | README, estado, tareas, decisiones, runbook e informe final | verificado |
| 40 | espejo Obsidian | índice, estado, tareas, decisiones, goal y runbook/informe sincronizados | verificado |
| 41 | límites de autonomía | sin commit/push/deploy/publicación/tarea Hermes; sólo GET | verificado |
| 42 | bundle y carga | build PASS; 1.504,33 kB / 397,86 gzip con warning >500 kB; carga medida cumple | verificado con deuda explícita |

## Resultado

Los requisitos del corte vertical quedan demostrados en proporción al riesgo. Permanecen como trabajo futuro —no como fallos ocultos— los avatares/pets definitivos, el pulido visual indicado por QA, la captura individual de los ocho indicadores, la división del bundle y cualquier ejecución iniciada desde el mundo.
