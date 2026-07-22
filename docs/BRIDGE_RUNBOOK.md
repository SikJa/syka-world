# Bridge v0.3 — operación

Estado: código y pruebas completos; plugin Desktop validado previamente en vivo con los cuatro perfiles. El fallback SQLite fue validado en modo de sólo lectura contra la estructura real de Hermes 0.18.2 y con bases temporales controladas.

## Flujo

```text
hooks públicos de Hermes (primario) ─┐
                                     ├→ reducer por sesión → snapshot/eventos
SQLite de sesiones (fallback) ───────┘
```

El plugin sanitiza eventos y escribe JSONL. El bridge mantiene cursores y estado en un checkpoint atómico. SQLite sólo aporta metadatos de lifecycle de sesiones Desktop; nunca selecciona contenido, razonamiento, argumentos ni resultados.

## Ejecutar

```powershell
.venv\Scripts\python -m syka_world_bridge.cli
```

Endpoints:

- `http://127.0.0.1:8765/health`
- `http://127.0.0.1:8765/api/world/state`
- `http://127.0.0.1:8765/api/world/events?after=<event_id>&wait=15`
- `http://127.0.0.1:8765/api/world/diagnostics`

Una lectura y salida sin abrir servidor:

```powershell
.venv\Scripts\python -m syka_world_bridge.cli --once
```

Desactivar fallback para diagnóstico:

```powershell
.venv\Scripts\python -m syka_world_bridge.cli --no-session-fallback
```

## Rutas predeterminadas

- spool: `%LOCALAPPDATA%\hermes\syka-world\events`
- checkpoint: `%LOCALAPPDATA%\hermes\syka-world\bridge-checkpoint-v1.json`
- default: `%LOCALAPPDATA%\hermes\state.db`
- otros perfiles: `%LOCALAPPDATA%\hermes\profiles\<perfil>\state.db`

Se puede usar `--spool` y `--checkpoint` para aislar pruebas. El replay completo se fuerza quitando o apartando explícitamente un checkpoint; no es el comportamiento normal.

## Presencia y concurrencia

El reducer registra una actividad por `(perfil, sesión)`. Si hay varias activas, `waiting` domina a `working`; luego gana la actualización más nueva y finalmente el ID de sesión. Terminar una sesión no vuelve idle al personaje si otra continúa. La presencia puede ser `online`, `degraded`, `offline` o `unknown`; un fallback activo marca degradado, no online.

## Recuperación

- checkpoint faltante: replay normal;
- checkpoint corrupto: diagnóstico `corrupt_replay` y replay seguro;
- línea JSONL parcial: se reintenta en el siguiente scan;
- línea corrupta: se registra y se continúa;
- proceso observador muerto con sesión abierta: interrupción sintética;
- cliente visual desconectado: reanuda con `after=<último_event_id>`;
- estado terminal: visible seis segundos y luego vuelve a vida ambiental.

## Privacidad

No se guardan ni exponen prompt completo, contenido de mensajes, razonamiento, argumentos o resultados de herramientas. El diagnóstico contiene identidad de perfil/sesión, fuente, estado, timestamps, conteos y errores técnicos.

## Retención

No hay limpieza automática. Consultar [RETENTION_POLICY.md](RETENTION_POLICY.md) para dry-run, archivo reversible y restauración.

## Reinstalar el observador

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-hermes-observer.ps1
```

El instalador conserva una copia fechada de cada configuración. Un proceso Hermes ya abierto cargará cambios sólo después de reiniciarse; no reiniciar una sesión activa para una prueba.
