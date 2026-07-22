# Syka World — Alpha + Interior Entity & Possession Pass v1 — runbook local

Estado del documento: operativo. Interior Entity & Possession Pass v1 y la corrección de reentrada del Café fueron verificadas el 2026-07-17. La regresión de ciclo de vida vive en `reports/cafe-runtime-regression/`, la evidencia del pass en `reports/interior-entity-possession-v1/`, la del pass mecánico en `reports/e2e/mechanic-integration-v1/` y la del corte alpha original en `reports/final-alpha/`.

## Qué abre cada modo

| Modo | URL local | Uso |
|---|---|---|
| Muestra | `http://127.0.0.1:5173/` | Ciudad preconstruida para explorar sistemas y arte. |
| Nueva partida | `http://127.0.0.1:5173/?mode=progressive` | Terreno inicial, economía y construcción progresiva cuando no existe un save previo. |
| QA local | `http://127.0.0.1:5173/?mode=progressive&qa=1` | Atajos visibles para acelerar tiempo, obras y Lúmenes. Nunca envía acciones a Hermes. |
| Gate visual histórico | `http://127.0.0.1:5173/?gate=1` | Spike exterior pequeño aprobado; no es la ciudad completa. |

El juego es local y web. No está publicado, desplegado, empaquetado ni configurado para iniciar con Windows.

Un guardado válido existente tiene prioridad al arrancar. Para reemplazarlo por una partida realmente nueva, elegir **Nueva partida** en el selector de modo y confirmar el reinicio.

## Requisitos

- Windows PowerShell;
- Node.js y npm;
- dependencias instaladas desde el lockfile de `app/game`;
- bridge local opcional en `127.0.0.1:8765`.

El bridge no es requisito para jugar. Si no responde, la ciudad conserva vida, economía y rutinas locales y la interfaz debe indicar modo simulado/degradado/offline. No hace falta reiniciar ni cerrar Hermes para abrir el juego.

## Primera instalación

Desde la raíz canónica `F:\Coding Proyects\Syka World Game`:

```powershell
Set-Location -LiteralPath 'F:\Coding Proyects\Syka World Game\app\game'
npm ci
```

`npm ci` usa `package-lock.json`; no hace falta instalar paquetes globales.

## Abrir para jugar

```powershell
Set-Location -LiteralPath 'F:\Coding Proyects\Syka World Game\app\game'
npm run dev
```

Esperar la dirección `http://127.0.0.1:5173/` y abrir uno de los modos de la tabla. Mantener esa terminal abierta mientras se juega.

### Controles principales

Este mapa está congelado para el pass y no debe cambiarse silenciosamente:

| Entrada | Contexto | Acción |
|---|---|---|
| Clic en agente | ciudad/interior | Seleccionar al agente. |
| Clic en casilla válida | agente seleccionado, no poseído | Crear una ruta y caminar automáticamente hasta la casilla. Al llegar mantiene el destino 3 s y luego vuelve a su rutina. |
| Clic en edificio/objeto | ciudad/interior | Seleccionar o inspeccionar; no se interpreta como clic de suelo. |
| Botón **Poseer** | agente principal seleccionado | Iniciar control directo. |
| `P` | sin input editable enfocado | Alternar Poseer/liberar. |
| `W` / `A` / `S` / `D` | poseído | Solicitar un paso cardinal relativo a pantalla sobre la grilla. |
| `E` | poseído o seleccionado | Ir al anchor contextual exacto y usarlo. |
| `F` | frente a portal válido | Entrar o salir por la puerta. |
| `Esc` | poseído | Liberar posesión sin salir de escena. |
| `Esc` | libre, dentro del Café | Auto-enrutar a la puerta y volver a la ciudad; no teletransporta desde lejos. |
| `B` | ciudad | Abrir/cerrar **Construir**. |
| `B` | interior | Salida compatible: auto-enrutar a la puerta y volver a la ciudad. |
| `H` | ciudad/interior | Mostrar u ocultar habitantes sin pausar sus rutinas. |

Además:

- arrastrar sobre el mundo mueve la cámara y la rueda conserva zoom 100%, 150% o 200%;
- WASD no mueve simultáneamente cámara y agente;
- key repeat usa una cola acotada y no atraviesa obstáculos;
- si el foco está en `input`, `textarea`, un selector editable o `contenteditable`, se ignoran las teclas de juego;
- el catálogo, la pestaña **Exterior**, el recibo de placement, la aceleración de obras, guardar/cargar/reiniciar y los controles del reloj conservan su comportamiento previo;
- `R` sólo rota un footprint de placement si existe una variante visual válida; la cámara nunca rota.

No existe control de rotación de cámara.

## Recorrido manual mínimo

### Modo muestra

1. Abrir `/` y confirmar que la ciudad, UI y cuatro habitantes aparecen.
2. Mover la cámara y probar los tres zooms; comprobar que el mundo nunca rota.
3. Seleccionar a Syka, hacer clic en una casilla de carretera libre y confirmar que camina hasta allí.
4. Hacer clic sobre un edificio o árbol y confirmar que selecciona/inspecciona sin tratar el clic como destino de suelo.
5. Pulsar `P` o **Poseer**, recorrer varias casillas con WASD y mantener una tecla contra un obstáculo: el agente no debe atravesarlo.
6. Llegar a la aproximación del Café y pulsar `F`; la escena interior debe abrir sin perder hora, cámara o estado.
7. Rodear barra, mesas, sillas y plantas con clic o WASD; los actores no deben compartir casilla ni quedar siempre por encima del mobiliario.
8. Pulsar `E` cerca de un asiento y comprobar que el agente alcanza el anchor exacto antes de usarlo.
9. Pulsar `Esc` mientras está poseído: debe liberarse sin salir. Pulsarlo libre dentro del Café debe enrutar a la puerta y regresar a la ciudad.
10. Enfocar un campo editable y pulsar WASD/P/E/F; ninguna tecla debe mover o controlar al agente.
11. Guardar y recargar: la casilla se conserva, pero el juego no vuelve poseído.
12. Acelerar el tiempo hasta observar día, atardecer y noche.
13. Ocultar habitantes, esperar unos segundos y mostrarlos otra vez; ocultarlos no debe pausar sus rutinas.

### Nueva partida

1. Abrir `/?mode=progressive`.
2. Confirmar que los cuatro agentes se mueven aunque todavía no tengan workplace construido.
3. Elegir el Café Biblioteca y mover el cursor sobre una parcela que requiera retirar vegetación.
4. Revisar el fantasma y el recibo: edificio, camino automático, limpieza y total deben coincidir con lo que se confirma.
5. Cancelar una vez y comprobar que saldo, terreno y objetos no cambian; volver a colocar físicamente el café.
6. Confirmar descuento de Lúmenes y etapas visibles; adelantar una hora o terminar ahora desde el inspector.
7. Verificar que la completion concede XP una sola vez y que el café terminado se convierte en destino funcional.
8. Seleccionar un agente, emitir **Ir al Café**, observar el trayecto y entrar al interior.
9. Seleccionar al agente dentro del café, ejecutar una acción contextual y usar **Salir a la ciudad**.
10. Abrir **Exterior**, comprar varios objetos y retirar uno; comprobar el reembolso del 50% una sola vez.
11. Probar día, atardecer y noche: la farola debe estar apagada de día y usar luz localizada después.
12. Mejorar el café y confirmar un cambio visual exterior reconocible.
13. Guardar, recargar y comprobar café, mejora, caminos, objetos, saldo, agentes y ubicación interior.

## Bridge pasivo

El frontend sólo consume `/api/world/state` y `/api/world/events` mediante solicitudes GET a través del proxy local `/bridge`. No tiene superficie para comandos o tareas.

Comprobación no invasiva opcional:

```powershell
Invoke-RestMethod -Method Get -Uri 'http://127.0.0.1:8765/health'
Invoke-RestMethod -Method Get -Uri 'http://127.0.0.1:8765/api/world/state'
```

Esto sólo lee el estado. No usar POST, no iniciar tareas de prueba y no cerrar Hermes. Una respuesta manual del endpoint por sí sola tampoco demuestra el flujo Hermes → mundo; la validación final exige observación end-to-end de sólo lectura.

## Verificación técnica

Desde `app/game`:

```powershell
npm run typecheck
npm test
npm run build
```

E2E físico del Interior Entity & Possession Pass, mediante servidor temporal controlado en 5188:

```powershell
python <path-to-webapp-testing>\scripts\with_server.py `
  --server "npm --prefix app/game run dev -- --port 5188" --port 5188 --timeout 60 -- `
  .venv\Scripts\python app\game\e2e\interior_entity_possession_v1_e2e.py
```

El comando anterior se ejecuta desde la raíz canónica. Su resultado vigente se guarda en `reports/interior-entity-possession-v1/physical-e2e.json`; el runner debe terminar en PASS y el puerto 5188 debe quedar cerrado.

Regresión específica de ciclo de vida del Café, con el servidor local ya disponible en `127.0.0.1:5173`:

```powershell
.venv\Scripts\python app\game\e2e\cafe_reentry_regression_e2e.py
```

Esta prueba conserva la misma página, el mismo contexto, el mismo `Phaser.Game` y el mismo estado. Debe completar: primera entrada → salida → segunda entrada con Syka, Alma y Milo → posesión → `W` válido → colisión bloqueada. En ambas entradas el room frame debe ser `__BASE`, su fuente 1774×887 y su display coincidir con `roomBounds`. El informe vigente queda en `reports/cafe-runtime-regression/cafe-reentry-regression-report.json`.

La comprobación manual equivalente es: entrar al Café, volver a la ciudad sin recargar la pestaña, entrar otra vez, poseer a Syka y moverlo con WASD. No alcanza con inspeccionar sólo la primera entrada.

Desde la raíz del proyecto, la suite histórica:

```powershell
.venv\Scripts\python -m unittest discover -s tests -v
```

El resumen de cierre debe vivir en `reports/final-alpha/` y enlazar la evidencia detallada de navegador/capturas/rendimiento donde corresponda (por ejemplo `reports/e2e/alpha-v1/`). No inferir esos resultados sólo porque el build o las pruebas unitarias pasen.

El recorrido Playwright reproducible y su uso obligatorio del servidor temporal controlado están documentados en `app/game/e2e/README.md`. Su informe debe terminar sin flujos bloqueados antes de usarlo como evidencia de cierre.

## Cerrar sin dejar procesos

1. Volver a la terminal donde corre Vite.
2. Presionar `Ctrl+C` una vez y esperar el prompt de PowerShell.
3. Verificar únicamente los puertos temporales del juego:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 5173,4173,5188 -ErrorAction SilentlyContinue
```

El resultado esperado es vacío. No cerrar el puerto `8765`: pertenece al bridge/Hermes y queda fuera del cierre del frontend.

Si un flujo automatizado inició otro puerto temporal, debe registrar el puerto exacto y cerrarlo al terminar. No declarar la alpha completa mientras quede un servidor de QA abierto.

## Guardado y privacidad

- guardado local versionado: `syka-world.alpha-v1.save`;
- autosave prudente y guardado al cerrar cuando existen cambios;
- sólo se aceptan claves bajo el namespace `syka-world.`;
- la UI muestra resúmenes cortos y sanitizados;
- nunca deben aparecer prompts completos, razonamiento privado, argumentos de herramientas o resultados sensibles.

## Solución rápida de problemas

| Síntoma | Comprobación segura |
|---|---|
| `5173` ocupado | Cerrar sólo el Vite que se inició para esta prueba; no matar procesos por nombre de forma global. |
| La UI dice Vida local/Simulado | El bridge es opcional; comprobar `/health` por GET si se necesita validar la conexión. |
| No permite construir | Revisar el motivo visible: saldo, desbloqueo, huella, objeto no removible o imposibilidad de crear el conector vial. |
| No abre el interior | La cafetería debe estar terminada y seleccionada. |
| El Café aparece como una barra gigante o con recortes flotantes | Hacer una recarga dura si la pestaña conserva código anterior y ejecutar la regresión de reentrada. El fondo debe usar siempre el frame `__BASE`; no aceptar una captura de primera entrada como validación suficiente. |
| Ir al Café no está disponible | Debe existir un café terminado, una ruta accesible y un anchor interior libre. |
| Clic no mueve al agente | Seleccionar primero un agente principal, salir de Poseer y clicar una casilla transitable; edificios, objetos y actores bloquean. |
| WASD no mueve | Activar **Poseer**/`P`, comprobar que no exista un input editable enfocado y que la casilla vecina no esté ocupada. |
| `E` no ejecuta una acción | Debe existir una interacción alcanzable y un anchor libre; el agente puede necesitar recorrer primero una ruta corta. |
| `F` no entra/sale | El agente debe estar frente a una aproximación de portal válida. `Esc`/`B` pueden auto-enrutar a la puerta desde el interior. |
| Una compra Exterior no aparece | Comprobar terreno libre, saldo y que el objeto no colisione con edificio, camino u otro objeto físico. |
| El guardado no carga | Usar el mensaje visible; no editar manualmente el save. Un esquema incompatible debe rechazarse explícitamente. |
| Arte borroso | Usar los zooms permitidos y comprobar que el navegador no aplique un zoom externo extraño. |

## Evidencia vigente del Mechanic Integration Pass v1

La pasada física registrada en `reports/e2e/mechanic-integration-v1/mechanic-integration-e2e.json` figura como **PASS** y contiene:

- frontend 138/138, typecheck y build verdes;
- suite Python/bridge/simulación 39/39;
- gate raster 9/9;
- 11/11 flujos físicos del pass, siete colocaciones físicas y save/load del circuito completo;
- responsive PASS en 1008×548 y 2560×1080;
- ocho solicitudes auditadas del bridge, todas GET y sin cuerpo;
- cero errores de página, consola o respuestas HTTP fallidas;
- capturas de construcción, agente interior, catálogo Exterior, día/atardecer/noche, mejora y recarga.

La evidencia histórica de la alpha original —14/14 E2E, QA visual 86,2/100 y métricas de rendimiento— se conserva en `reports/final-alpha/` y no se confunde con esta pasada nueva.

El build mantiene la advertencia conocida de chunk principal por encima del umbral de 500 kB de Vite. La división del bundle queda como deuda explícita.

## Evidencia vigente del Interior Entity & Possession Pass v1

La pasada registrada en `reports/interior-entity-possession-v1/physical-e2e.json` figura como **PASS** y contiene:

- frontend **225/225 PASS**;
- typecheck y build **PASS**;
- Python/bridge/simulación **39/39 PASS**;
- **14/14 pasos físicos PASS** a 1440×900: selección, clic exterior, separación clic de objeto/suelo, Poseer/WASD, key repeat contra colisión, `F` ciudad→Café, clic interior, `E` físico sobre asiento, `E` físico `serve-coffee` sobre anchor `counter`, colisión/depth, foco editable, save/reload sin posesión, `F` Café→ciudad y auditoría final;
- ocho requests del bridge, todas `GET`, sin body, cero writes y cero tareas Hermes;
- capturas `screenshots/01-city-possession-1440x900.png` y `screenshots/02-cafe-interaction-1440x900.png`;
- video final `syka-world-possession-pass-v1-20s.mp4`, duración exacta **20.000 s**, resolución **1440×900**.

El warning de chunk >500 kB sigue documentado. Los avisos `GL Driver Message ... ReadPixels` registrados durante las capturas headless son warnings del driver de Chromium, no errores de página ni fallos de assets.

La auditoría independiente histórica en `reports/interior-entity-possession-v1/independent-final-audit.md` cerró **PASS** para el alcance que ejecutó:

- 15/15 criterios físicos PASS;
- responsive PASS en 1008×548, 2560×1080 y 640×720;
- 20 requests independientes, todas GET sin body;
- cero errores inesperados de página, consola, HTTP o assets;
- video H.264 1440×900, 25 fps, 500 frames y 20.000 s;
- hashes de referencia, Café, agentes y NPC verificados sin degradación material;
- ciudad 53,99 FPS y Café 56,89 FPS; la ciudad queda como riesgo menor de optimización, no bloqueante;
- 5188 cerrado y 5173 preexistente intacto.

Esa auditoría no ejecutaba salida y reentrada en el mismo runtime, por lo que no cubría la corrupción descubierta después. La cobertura vigente de ese ciclo es `app/game/e2e/cafe_reentry_regression_e2e.py`, que ya termina en PASS junto con la repetición 14/14 del E2E físico.
