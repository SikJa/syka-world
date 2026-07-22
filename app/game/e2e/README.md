# Syka World Alpha v1 — E2E reproducible

El runner usa Python Playwright en Chromium headless. El servidor no se inicia
desde el script: se gestiona obligatoriamente con el helper `with_server.py` de
la skill `webapp-testing`.

Desde `app/game`:

```powershell
python <path-to-webapp-testing>\scripts\with_server.py `
  --server "npm run dev" --port 5173 --timeout 60 -- `
  uv run --python 3.11 --with playwright python e2e\alpha_v1_e2e.py
```

Antes de usar el helper por primera vez se verificó su interfaz mediante
`python ...\with_server.py --help`, como exige la skill.

La prueba cubre los 14 recorridos del goal, guarda capturas bajo
`reports/e2e/alpha-v1/screenshots`, genera JSON legible por máquinas y un informe
Markdown. El bridge controlado sólo intercepta GET del navegador. El paso real
usa el bridge vivo si está disponible, sólo por lectura, y no inicia tareas.

La separación física entre los sprites y las carreteras tiene un gate raster
propio. A diferencia de la validación de `occupiedTiles`, éste rasteriza los
frames y tiles realmente cargados por Phaser, aísla los componentes opacos que
tocan el suelo y exige al menos un píxel completo de césped:

```powershell
python <path-to-webapp-testing>\scripts\with_server.py `
  --server "npm run dev" --port 5173 --timeout 60 -- `
  uv run --python 3.11 --with playwright python e2e\visual_road_clearance_e2e.py
```

El smoke final responsive, incluyendo ciudad, ruta de Syka, interior y bridge
GET-only controlado, se repite sustituyendo el runner por
`e2e\final_browser_e2e.py`.

El pass mecánico integrado tiene un runner independiente en el puerto 5187.
La cafetería y los objetos Exterior se colocan mediante clicks físicos sobre
la UI y el canvas; la superficie QA queda limitada a hora y saldo local:

```powershell
python <path-to-webapp-testing>\scripts\with_server.py `
  --server "npm run dev -- --port 5187" --port 5187 --timeout 60 -- `
  uv run --python 3.11 --with playwright python e2e\mechanic_integration_v1_e2e.py
```

El resultado se escribe en
`reports/e2e/mechanic-integration-v1/MECHANIC_INTEGRATION_E2E.md`, junto con
el JSON reproducible y las capturas de 1008×548, 1440×900 y 2560×1080.

El Interior Entity & Possession Pass v1 tiene un runner físico separado en el
puerto 5188. Desde la raíz canónica prueba clic de suelo/objeto, Poseer/WASD,
key repeat contra colisiones, `E`, `F`, foco editable, save/reload sin posesión
y auditoría GET-only:

```powershell
python <path-to-webapp-testing>\scripts\with_server.py `
  --server "npm --prefix app/game run dev -- --port 5188" --port 5188 --timeout 60 -- `
  .venv\Scripts\python app\game\e2e\interior_entity_possession_v1_e2e.py
```

El resultado vigente queda en
`reports/interior-entity-possession-v1/physical-e2e.json`, con 14/14 pasos PASS,
incluido `E` físico `serve-coffee` sobre el anchor `counter`, y capturas en su
subcarpeta `screenshots/`. El video final se conserva como
`syka-world-possession-pass-v1-20s.mp4`: 20.000 s exactos a 1440×900. La pasada
vigente auditó ocho requests, todas GET sin body, cero writes y cero tareas
Hermes. Antes del cierre, verificar que 5188 ya no escuche.

La regresión de ciclo de vida del Café debe ejecutarse además contra el Vite
local en 5173, desde la raíz canónica:

```powershell
.venv\Scripts\python app\game\e2e\cafe_reentry_regression_e2e.py
```

Conserva la misma página, contexto, instancia de Phaser y estado para probar
primera entrada → salida → segunda entrada con Syka/Alma/Milo → posesión/WASD.
Verifica que ambas entradas usen `alpha-cafe-interior/__BASE`, que las vistas
anteriores queden inactivas, que las nuevas se reconstruyan y que una colisión
se rechace. El resultado vive en
`reports/cafe-runtime-regression/cafe-reentry-regression-report.json`.

La auditoría independiente histórica está en
`reports/interior-entity-possession-v1/independent-final-audit.md`: 15/15
criterios físicos y responsive 1008×548/2560×1080/640×720 PASS, 20 GET sin
body, arte/hash preservado y video de 20.000 s verificado. Esa pasada no incluía
salida y reentrada dentro del mismo runtime; la regresión específica anterior
cierra esa cobertura.
Registró ciudad a 53,99 FPS como riesgo menor no bloqueante y Café a 56,89
FPS. Confirmó 5188 cerrado sin alterar el servidor preexistente 5173.

Para volver a grabar el recorrido visual corto (ciudad al atardecer, cafetería
y regreso), usar el mismo helper con el runner de video:

```powershell
python <path-to-webapp-testing>\scripts\with_server.py `
  --server "npm run dev" --port 5173 --timeout 60 -- `
  uv run --python 3.11 --with playwright python e2e\record_alpha_tour.py
```

El resultado queda en `reports/e2e/alpha-v1/syka-world-alpha-tour.webm`.

Las dos comprobaciones visuales enfocadas del feedback se regeneran con
`e2e\capture_feedback_detail.py` (cruce y farolas) y
`e2e\capture_bench_detail.py` (banco aislado). Ambos runners usan el mismo
comando anterior, sustituyendo únicamente el nombre del script.

El bridge usa long-poll, por lo que `networkidle` puede no completarse. El runner
lo intenta expresamente y después espera tres señales de producto: UI visible,
API QA instalada y pantalla de carga oculta.

En Windows, algunas versiones del helper pueden cerrar el proceso padre de npm
pero dejar vivo el proceso hijo de Vite. Después del comando, verificar que el
puerto 5173 esté libre antes de considerar terminada la sesión de QA.
