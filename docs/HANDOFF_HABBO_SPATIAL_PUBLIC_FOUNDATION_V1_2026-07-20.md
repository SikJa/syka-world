# Syka World — Handoff de Habbo Spatial Public Foundation v1

Última auditoría: 2026-07-20 10:06 (America/Argentina/Buenos_Aires)  
Raíz canónica: `F:\Coding Proyects\Syka World Game`  
Goal autoritativa: `docs/GOAL_HABBO_SPATIAL_PUBLIC_FOUNDATION_V1.md`  
Sesión Hermes detenida: `20260719_203920_31c0c3` (`syka-world`)  
Backup previo verificado: `F:\Coding Proyects\Syka World Game Backups\Syka World Game_before_glm_goal_20260719-175605`

> **Actualización posterior a QA manual:** leer también `docs/BUILD_WEEK_SPATIAL_RECOVERY_PLAN_AFTER_MANUAL_QA_2026-07-20.md`. La prueba del usuario confirmó movimiento lento y visible por casillas, mezcla de idiomas, actores interiores pequeños/cortados y colisiones/profundidad del Café no funcionales. Ese plan reemplaza el orden de continuación de este handoff cuando exista conflicto.

## Resumen en criollo

La sesión anterior dejó una base técnica importante: compositor espacial y de profundidad, perfiles Hermes dinámicos, UI en inglés, profundidad exterior representativa y un E2E nuevo con capturas y métricas. Sin embargo, se detuvo a mitad de la integración del placement editor. El repositorio **no está verde actualmente**: `npm run typecheck` falla porque el QA API llama a una acción que todavía no existe en `AlphaRuntimeActions`.

No conviene reanudar la sesión vieja. TokenRouter dejó de responder a las 05:54 después de cinco intentos stale; la goal quedó marcada `active` aunque no hace trabajo. Esa sesión procesó aproximadamente 39,1 M tokens de entrada y arrastra más de 350 K tokens por llamada. Los cambios útiles están guardados en disco y pueden continuarse desde una sesión nueva leyendo este documento.

El primer objetivo de la nueva sesión es recuperar un baseline verde sin fingir que el placement está terminado. Después debe implementar un vertical slice real de placement, verificar interacciones físicas y continuar P1 en el orden definido aquí.

## 1. Límites y fuentes de verdad

- Trabajar solamente en la raíz canónica indicada arriba.
- Leer completamente la goal autoritativa antes de editar.
- Hermes continúa siendo la fuente de verdad de la actividad real de agentes.
- El bridge debe permanecer privado, pasivo y GET-only. No iniciar tareas reales de Hermes.
- No exponer prompts, mensajes, herramientas, secretos, bases de estado ni auth de Hermes.
- No hacer commit, push, deploy ni publicación sin autorización explícita.
- No usar `git reset`, `git checkout --` ni operaciones destructivas.
- **Advertencia Git:** actualmente Git muestra prácticamente todo el proyecto como `untracked`; no existe un baseline Git útil para restaurar o atribuir cambios. Para recuperar archivos, comparar selectivamente con el backup, sin sobrescribir trabajo válido en bloque.
- Preservar el pixel art detallado aprobado, el raster del Café Biblioteca y los saves compatibles.

## 2. Resultado implementado antes del bloqueo

### 2.1 Fundación espacial

Se implementaron o extendieron contratos en `app/game/src/core/spatial.ts`:

- `SpatialRenderPartV1` con roles `back`, `body`, `front`, `overlay` y `shadow`;
- `SpatialHeightMapV1` y elevación por celda;
- `computeSpatialDepth()` y `spatialRenderPartDepth()` deterministas;
- placement constraints para ground/on-entity, stacking y altura;
- pathfinding con `maxElevationStep`;
- footprints con `walkableOffsets`;
- capacidad y reservas de anchors;
- pose e interaction anchors.

El Café integra el compositor mediante:

- `app/game/src/presentation/interior/cafeSpatialModel.ts`;
- `app/game/src/presentation/scenes/CafeInteriorScene.ts`.

El raster aprobado se mantiene como capa visual principal; las entidades y partes de render aportan verdad espacial y profundidad.

### 2.2 Perfiles Hermes dinámicos

Implementado principalmente en:

- `app/game/src/core/contracts.ts`;
- `app/game/src/integrations/profiles.ts`;
- `app/game/src/integrations/mapping.ts`;
- `app/game/src/integrations/types.ts`;
- `config/presets/sikora-world.json`.

Estado:

- `ProfileId` y `CharacterId` admiten strings runtime;
- existe `ProfileRegistry` para discovery, binding y perfiles offline/desconocidos;
- Syka, Elen, Astrelis y Zerny sobreviven como preset opcional, no como supuesto universal;
- perfiles desconocidos del bridge no deben convertirse silenciosamente en Syka;
- `AgentId` todavía conserva un union legacy para atlas/rendering y debe tratarse como compatibilidad visual, no identidad pública.

### 2.3 UI y repositorio público

- UI afectada por este pass traducida al inglés;
- `index.html` usa `lang="en"`;
- README reescrito en inglés;
- labels de actividad, bridge, construcción, interiores y errores actualizados;
- nombres propios del mundo pueden conservarse en español cuando son identidad del juego.

### 2.4 Profundidad exterior representativa

La sesión añadió adopción del compositor exterior en:

- `app/game/src/presentation/city/projection.ts` — `cityEntityDepth()` usa `computeSpatialDepth()`;
- `app/game/src/presentation/scenes/CityScene.ts` — objetos exteriores representativos usan el depth compartido, incluidos árboles, bancos y farolas.

Este cambio fue ejercitado por el E2E del navegador, pero todavía necesita una inspección visual dedicada de actores pasando delante y detrás de objetos exteriores.

### 2.5 E2E y evidencia creada

Runner:

- `app/game/e2e/habbo_spatial_v1_e2e.py`

Evidencia:

- `reports/habbo-spatial-v1/physical-e2e.json`;
- `reports/habbo-spatial-v1/PHYSICAL_E2E_REPORT.md`;
- `reports/habbo-spatial-v1/screenshots/`;
- `reports/habbo-spatial-v1/FINAL_REPORT.md`.

Último run anterior al placement incompleto, 2026-07-20 04:27:

- 13/13 flujos reportados PASS;
- WASD real movió `default` de `{x: 7, y: 7}` a `{x: 7, y: 6}`;
- entrada, salida, reentrada y save/load pasaron;
- ciudad: 60,67 FPS;
- café: 60,33 FPS;
- cuatro resoluciones capturadas;
- siete requests del bridge, todos GET y sin body;
- los 502 de `/bridge/api/world/state` fueron el fallback esperado porque no había bridge en 8765.

#### Límites honestos del E2E

El “13/13” no equivale a completar toda la matriz física de la goal:

- el flujo de `E` sólo comprueba que presionar la tecla no genera page errors; no prueba cambio de pose, reserva, asiento ni café servido;
- no existe una prueba física explícita de `F`;
- no prueba con assertions visuales que un actor pase detrás y delante de counter/table/sofa;
- no prueba placement válido/incorrecto ni persistencia de placement;
- la selección y entrada al café usan el QA API para setup; la nueva sesión debe distinguir setup determinista de input físico real;
- las capturas existen, pero todavía requieren inspección original-resolution con criterios de contacto, escala y oclusión.

No describir estos gaps como completos.

### 2.6 Suites verdes históricas

Antes del cambio incompleto de placement se habían reportado:

- frontend: 255/255;
- Python: 39/39;
- typecheck: PASS;
- build: PASS, conservando el warning conocido de chunk >500 kB.

Estos números son históricos. Deben repetirse después de recuperar el estado actual.

## 3. Punto exacto donde se detuvo

La sesión comenzó un placement editor slice y dejó dos cambios parciales:

1. `app/game/src/application/GameController.ts`
   - añadió `previewFurniturePlacement(buildingId, slotId, furnitureId)`;
   - actualmente ignora `slotId` y `furnitureId`;
   - sólo comprueba que exista el interior y que el edificio esté completo;
   - devuelve `ok: true` sin llamar a `validateSpatialPlacement()`;
   - por lo tanto, **no es validación espacial real**.

2. `app/game/src/qa/alphaQaApi.ts`
   - añadió `previewFurniturePlacement` a `AlphaQaApi`;
   - llama a `runtime.actions.previewFurniturePlacement(...)`;
   - `AlphaRuntimeActions` no expone esa acción.

Estado reproducido durante esta auditoría:

```text
cd app/game
npm run typecheck -- --pretty false

src/qa/alphaQaApi.ts(124,38): error TS2339:
Property 'previewFurniturePlacement' does not exist on type 'AlphaRuntimeActions'.
```

No hay ghost preview, feedback de celda, confirmación/cancelación, validación de overlap, slot-to-cell mapping ni persistencia probada. No intentar “arreglar” solamente el tipo y llamar terminado al vertical slice.

## 4. Estado de la sesión y procesos

### Hermes

- sesión: `20260719_203920_31c0c3`;
- goal aún figura `active`;
- 8/20 goal turns utilizados;
- último trabajo de código: 05:28;
- a las 05:54 el proveedor abortó tras cinco stale attempts;
- logs posteriores son reintentos fallidos de `scrapling`, no progreso;
- consumo observado: aproximadamente 39.134.223 input tokens y 120.437 output tokens.

No reanudar esa sesión para desarrollo normal. Crear una sesión limpia.

### Dev server

- el servidor preexistente PID 24168 fue terminado por error durante la sesión;
- la sesión inició un reemplazo;
- al momento de esta auditoría `127.0.0.1:5173` escucha mediante Node PID 3088, iniciado a las 01:56;
- los PID son datos temporales: una nueva sesión debe comprobar puerto y command line antes de actuar;
- no matar procesos preexistentes o desconocidos;
- si el reemplazo desaparece, iniciar Vite mediante el comando portable documentado.

## 5. Documentación actualmente desincronizada

No confiar ciegamente en estos documentos hasta el cierre:

- `CURRENT_PROJECT_STATE.md` todavía afirma que E2E, capturas, FPS y exterior depth no se realizaron;
- `TASKS.md` no refleja este pass nuevo;
- `reports/habbo-spatial-v1/FINAL_REPORT.md` mezcla afirmaciones actualizadas con secciones antiguas: su encabezado dice que no hubo E2E, P0 vuelve a pedir pruebas ya ejecutadas y exterior depth continúa listado como incompleto;
- el mismo reporte dice “No unrelated processes terminated”, aunque el PID preexistente 24168 sí fue terminado.

Actualizar estos documentos solamente después de recuperar el baseline y verificar el estado final.

## 6. Orden recomendado para continuar

### Fase A — preflight y recuperación verde

1. Leer este handoff, la goal autoritativa y los archivos enumerados en la sección 9.
2. Ejecutar `git status --short` y recordar que no existe baseline Git útil.
3. Verificar puerto 5173 sin matar nada.
4. Reproducir el typecheck roto.
5. Elegir una de estas rutas:
   - implementar correctamente la acción a través de `AlphaRuntimeActions`, **pero sólo junto con validación real**; o
   - retirar temporalmente el stub y el hook QA para recuperar verde antes de diseñar el slice.
6. Ejecutar typecheck y tests antes de agregar más alcance.

### Fase B — vertical slice real de placement

El vertical slice mínimo aceptable debe:

- mapear un `slotId` + `furnitureId` a una celda, footprint, surface y constraints concretos;
- llamar realmente a `validateSpatialPlacement()` con la escena/candidato correctos;
- devolver razones tipadas para válido, bloqueado, overlap, surface o altura;
- mostrar preview/ghost alineado con la grilla y feedback legible;
- usar la misma fuente de verdad para preview y confirmación;
- permitir confirmar/cancelar un objeto soportado;
- persistir y restaurar ese placement;
- no permitir atravesar ni superponer entidades bloqueantes;
- agregar tests unitarios de válido/inválido y un flujo físico Playwright;
- mantener application/core desacoplado de presentation, evitando imports circulares.

Un método que sólo comprueba que el edificio está completo no satisface esta fase.

### Fase C — cerrar P0 con evidencia física real

Extender el E2E para comprobar estado, no ausencia de errores:

- click válido y destino bloqueado;
- coordenadas antes/después para WASD;
- `E` con anchor, pose/reserva y acción resultante verificables;
- `F` para portal válido;
- al menos dos relaciones visuales actor detrás/delante de counter/table;
- NPC de servicio y dos actores sin overlap;
- placement válido e inválido, más save/reload;
- perfil desconocido no convertido en Syka;
- bridge GET-only, sin body ni writes;
- cero errores inesperados de page/console/HTTP/assets.

Inspeccionar capturas a resolución original. Un runner verde no sustituye QA visual.

### Fase D — P1 después de P0 estable

Orden recomendado:

1. completar placement editor vertical slice;
2. probar visualmente exterior depth para árbol, banco y farola;
3. crear el gate modular del Café con counter/table multi-part reales sin degradar el raster aprobado;
4. ampliar onboarding/settings para perfiles dinámicos;
5. pulido responsive/UI restante;
6. performance/bundle cleanup;
7. video corto sólo cuando el resultado sea demostrable honestamente.

No reconstruir todos los interiores, personajes finales, economía avanzada, multiplayer ni publicación en este pass.

### Fase E — cierre

1. Repetir todas las suites.
2. Generar evidencia nueva sin reutilizar resultados stale.
3. Corregir `CURRENT_PROJECT_STATE.md`, `TASKS.md`, decisiones, README/runbook y final report.
4. Registrar gaps restantes sin presentarlos como terminados.
5. Cerrar solamente procesos temporales iniciados por la nueva sesión.

## 7. Comandos de verificación

Desde la raíz canónica:

```powershell
Set-Location 'F:\Coding Proyects\Syka World Game\app\game'
npm run typecheck
npm run test
npm run build

Set-Location 'F:\Coding Proyects\Syka World Game'
uv run --with pytest pytest tests/ -q
```

Para E2E, comprobar primero que 5173 responde. Si no hay servidor conocido:

```powershell
Set-Location 'F:\Coding Proyects\Syka World Game\app\game'
npm run dev
```

En otra terminal, desde la raíz:

```powershell
uv run --with playwright python app/game/e2e/habbo_spatial_v1_e2e.py
```

No afirmar PASS si un comando no se ejecutó realmente en la sesión actual.

## 8. Criterio de recuperación mínima

Antes de continuar P1 deben cumplirse todos:

- typecheck PASS;
- frontend tests PASS;
- build PASS;
- Python tests PASS;
- E2E sin falsos positivos;
- `E` y `F` verifican cambios de estado/portal, no sólo ausencia de excepciones;
- screenshots inspeccionadas a resolución original;
- ninguna acción real de Hermes;
- bridge conserva GET-only;
- documentación distingue completado, parcial y pendiente.

## 9. Primeros archivos que debe leer la nueva sesión

En este orden:

1. `docs/HANDOFF_HABBO_SPATIAL_PUBLIC_FOUNDATION_V1_2026-07-20.md`;
2. `docs/GOAL_HABBO_SPATIAL_PUBLIC_FOUNDATION_V1.md`;
3. `app/game/src/application/GameController.ts`;
4. `app/game/src/application/AlphaRuntime.ts`;
5. `app/game/src/qa/alphaQaApi.ts`;
6. `app/game/src/core/spatial.ts`;
7. `app/game/src/presentation/interior/cafeSpatialModel.ts`;
8. `app/game/src/presentation/scenes/CafeInteriorScene.ts`;
9. `app/game/src/presentation/city/projection.ts`;
10. `app/game/src/presentation/scenes/CityScene.ts`;
11. `app/game/e2e/habbo_spatial_v1_e2e.py`;
12. `reports/habbo-spatial-v1/PHYSICAL_E2E_REPORT.md`;
13. `reports/habbo-spatial-v1/FINAL_REPORT.md`.

## 10. Prompt compacto para una nueva goal

```text
Trabajá únicamente en F:\Coding Proyects\Syka World Game. Leé completamente docs/HANDOFF_HABBO_SPATIAL_PUBLIC_FOUNDATION_V1_2026-07-20.md y docs/GOAL_HABBO_SPATIAL_PUBLIC_FOUNDATION_V1.md; el handoff describe el estado real actual y la goal define el resultado final. No reanudes ni confíes en la sesión vieja.

Primero recuperá un baseline verde. El placement quedó incompleto: alphaQaApi llama previewFurniturePlacement pero AlphaRuntimeActions no lo expone, y el método actual de GameController sólo comprueba interior/edificio sin usar validateSpatialPlacement. No maquilles el typecheck ni presentes ese stub como implementación. Diseñá un vertical slice real con candidato espacial tipado, validación válida/inválida, preview alineado, confirmación, persistencia, tests y E2E.

Después cerrá P0 con evidencia física stateful: click, WASD, E, F, anchors/reservas, front/behind, NPC + actores, reentrada, save/load, perfil desconocido y bridge GET-only. Usá Playwright real para inputs; QA API sólo para setup/snapshots. Inspeccioná screenshots originales. Sólo con P0 estable continuá P1: placement completo, exterior depth visual, gate modular del Café, perfiles/UI y cleanup.

No hagas commit, push, deploy ni publicación; no inicies tareas Hermes; no expongas secretos; no mates procesos preexistentes. Todo el proyecto aparece untracked, así que no uses Git destructivo. Ejecutá typecheck, frontend tests, build, Python y E2E reales. Actualizá la documentación contradictoria únicamente con resultados actuales. Terminá cuando los criterios estén verificados, no por consumo de tokens.
```

## 11. Estado para la siguiente persona/agente

- Los cambios están en disco.
- La sesión anterior está abandonada por fallo del proveedor, no completada.
- El juego puede seguir sirviéndose en 5173, pero el estado del proceso debe revalidarse.
- El repositorio compila mediante Vite en runtime, pero **typecheck está fallando actualmente** por el placement parcial.
- La prioridad inmediata es recuperar verde y construir placement real.
- La arquitectura general y la evidencia previa deben preservarse, no reescribirse desde cero.
