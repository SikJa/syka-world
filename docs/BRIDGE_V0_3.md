# Syka World Bridge v0.3

Estado: implementado y probado en entorno temporal; lectura real de los cuatro perfiles verificada.

## Capas

```text
Hermes plugin oficial ─┐
                      ├─ eventos v1 ─ reducer por sesión ─ estado v1 ─ API read-only
SQLite por perfil ────┘
       fallback
```

## Fuente primaria y fallback

`hermes-plugin` es autoritativa. `hermes-session-sqlite` sólo recupera lifecycle de Desktop cuando el plugin no produjo eventos para esa sesión. Si ambas fuentes aparecen para el mismo `session_id`, el reducer conserva el plugin aunque el fallback llegue después.

El fallback:

- abre `state.db` con `mode=ro`;
- valida que existan `sessions` y `messages`;
- permite por defecto sólo `source=desktop`;
- no lee contenido, argumentos, respuestas ni razonamiento;
- usa cursor de `messages.id` por perfil;
- genera IDs deterministas para deduplicación;
- publica disponibilidad y error por perfil.

## Concurrencia

El reducer mantiene un registro por `(profile_id, session_id)`. Un personaje expone:

- `active_session_count`;
- `dominant_session_id`;
- `active_source`;
- actividad agregada segura.

La sesión dominante se elige por:

1. `waiting` sobre `working`;
2. señal más reciente;
3. `session_id` como desempate estable.

Finalizar una sesión no devuelve el personaje a `idle` mientras otra siga activa.

## Presencia

Estados disponibles:

- `online`: señal reciente de una fuente oficial;
- `degraded`: actividad recuperada únicamente desde SQLite;
- `offline`: señal explícita de desconexión;
- `unknown`: todavía no hay evidencia suficiente.

Una interrupción sintética del bridge no cambia por sí sola la presencia. La muerte de un proceso observador afecta sólo las sesiones que pertenecían a su spool; no invalida otras sesiones del perfil.

## Checkpoint

Esquema: `syka.world.bridge-checkpoint.v1`.

Persiste atómicamente:

- offsets por archivo JSONL;
- IDs de eventos vistos;
- estado agregado de personajes;
- registro de sesiones;
- último spool por sesión;
- cursores del fallback.

La escritura usa archivo temporal y reemplazo atómico. Un checkpoint ausente produce replay explícito. Uno corrupto genera `checkpoint_status=corrupt_replay`, registra diagnóstico y reconstruye desde fuentes sin borrar el archivo manualmente.

## API

- `GET /health`: mínimo y estable; no contiene datos sensibles.
- `GET /api/world/state`: estado para el juego.
- `GET /api/world/events`: long-poll incremental.
- `GET /api/world/diagnostics`: checkpoint, fuentes, sesiones seguras y últimos errores.

## Retención

El spool no se limpia automáticamente. La política propuesta está en `RETENTION_POLICY.md`; cualquier archivado requiere una ejecución explícita, conserva hash y manifiesto, y nunca toca un proceso vivo.
