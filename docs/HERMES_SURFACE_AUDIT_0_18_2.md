# Auditoría de superficies Hermes 0.18.2

Fecha: 2026-07-16. Estado: comprobado contra la instalación local; inspección de sólo lectura.

## Resultado

La fuente primaria adecuada sigue siendo el plugin observador basado en hooks públicos. El fallback más seguro disponible en la instalación real es `state.db` por perfil, leído en modo SQLite `mode=ro` y limitado a metadatos de lifecycle. Los antiguos archivos JSON/JSONL existen, pero ya no son la fuente actual más confiable para Desktop.

## Ubicación real por perfil

| Perfil | Base actual | Sesiones históricas |
|---|---|---|
| `default` | `%LOCALAPPDATA%\hermes\state.db` | `%LOCALAPPDATA%\hermes\sessions` |
| `astrelis` | `%LOCALAPPDATA%\hermes\profiles\astrelis\state.db` | `...\profiles\astrelis\sessions` |
| `elen` | `%LOCALAPPDATA%\hermes\profiles\elen\state.db` | `...\profiles\elen\sessions` |
| `zerny` | `%LOCALAPPDATA%\hermes\profiles\zerny\state.db` | `...\profiles\zerny\sessions` |

No se leyó ningún `.env`, token, prompt, respuesta ni razonamiento durante la auditoría.

## Formatos confirmados

### SQLite actual

Las cuatro bases contienen las tablas `sessions` y `messages` con el mismo núcleo de esquema. Para fallback sólo hacen falta:

- `sessions.id`, `sessions.source`, `sessions.started_at`;
- `messages.id`, `messages.session_id`, `messages.role`;
- `messages.tool_name`, `messages.timestamp`, `messages.finish_reason`;
- la expresión booleana `messages.tool_calls IS NOT NULL`.

El lector no selecciona `content`, `tool_calls`, `reasoning`, `reasoning_content`, `reasoning_details`, `system_prompt`, `title` ni campos de respuesta.

Secuencia Desktop observada, sólo por metadatos:

```text
user
assistant / finish_reason=tool_calls
tool / tool_name=<nombre>
assistant / finish_reason=stop
```

Esto permite reconstruir `activity.started`, uso de herramienta y `activity.completed` sin recuperar contenido privado.

### JSON/JSONL histórico

Cada perfil conserva una carpeta `sessions` con `session_*.json`, `*.jsonl`, `request_dump_*.json` y un índice `sessions.json`. Su volumen y antigüedad varían; los archivos de dump contienen información demasiado amplia y quedan explícitamente fuera del fallback. La implementación actual no los necesita.

## Hooks públicos confirmados

El observador instalado usa:

- `on_session_start`;
- `pre_llm_call`;
- `pre_tool_call`;
- `post_tool_call`;
- `on_session_end`;
- `pre_approval_request`;
- `post_approval_response`.

`ctx.profile_name` sigue siendo la identidad pública correcta. Un puerto no identifica un perfil.

## Frontera de estabilidad

| Superficie | Clasificación | Uso |
|---|---|---|
| hooks del plugin y `ctx.profile_name` | pública en el runtime instalado | fuente primaria |
| API Desktop/Gateway | pública, autenticada y orientada a ejecución | no requerida para observar; futura compatibilidad |
| esquema de `state.db` | implementación interna confirmada | fallback degradado, validado en startup |
| archivos `sessions` antiguos | implementación histórica | diagnóstico manual, no live |
| `kanban.db` | señal de dominio secundaria | no representa lifecycle completo |

Si una actualización cambia las columnas mínimas, el lector se deshabilita para ese perfil, publica diagnóstico degradado y nunca intenta adivinar otro formato.

## Limitación conocida

Hermes conserva muchas sesiones con `ended_at IS NULL`; ese dato no significa que continúen trabajando. Por eso el fallback se basa en nuevas filas de `messages`, no en contar sesiones abiertas. El primer arranque sólo mira una ventana reciente de diez minutos y luego continúa por cursor incremental.
