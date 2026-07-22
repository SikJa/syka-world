# Lenguaje visual de estados v1

Estado: aprobado como contrato inicial entre Syka World Bridge y el futuro frontend.

La fuente legible por máquinas está en `config/visual-states.json`. El frontend debe representar el estado entregado por el bridge; no debe interpretar directamente eventos internos de Hermes.

## Principio de movimiento

Mientras un personaje está libre, recorre la ciudad con rutinas locales que no requieren IA. Cuando llega `activity.started`, su destino pasa a su edificio de trabajo. El frontend anima el trayecto; al llegar reproduce la acción indicada. Si una herramienta cambia durante el trayecto, se conserva el último estado y se ejecuta al llegar.

## Estados canónicos

| Estado | Lugar | Acción principal | Señal de interfaz |
|---|---|---|---|
| `idle` | Ciudad, plaza, café o casa | Caminar, sentarse o socializar | Sin resumen abierto |
| `working/thinking` | Edificio de trabajo | Pensar, pizarra o escritorio | Resumen corto de la tarea |
| `working/using-tool` | Edificio de trabajo | Acción según familia de herramienta | Resumen y tipo de trabajo |
| `waiting` | Edificio de trabajo | Pausa visible mirando al jugador | Indicador ámbar “esperando aprobación” |
| `done` | Edificio de trabajo | Celebración breve | Indicador verde durante 6 segundos |
| `interrupted` | Edificio de trabajo | Confusión o pausa breve | Indicador gris durante 6 segundos |
| `error` | Edificio de trabajo | Reacción de problema, sin dramatismo | Indicador rojo suave durante 6 segundos |
| `offline` | Casa | Dormir o descansar | Perfil desconectado |

Después de `done`, `interrupted` o `error`, el bridge emite `activity.settled` y devuelve al personaje a `idle/roaming`. `last_outcome` permanece disponible para inspección, aunque la animación ya haya terminado.

## Herramientas y utilería

| Familia | Animación | Objeto sugerido |
|---|---|---|
| `files` | `reading` | Documento, carpeta o biblioteca |
| `terminal` | `typing` | Computadora con terminal |
| `code` | `typing` | Computadora con editor |
| `browser` | `using-computer` | Monitor con navegador |
| `research` | `thinking` | Pizarra, libros o lupa |
| `communication` | `using-phone` | Teléfono o videollamada |
| `crm` | `organizing` | Tarjetas, tablero o archivador |
| `other` | `working` | Escritorio genérico |

## Prioridad visual

Si llegan señales cercanas entre sí, la representación usa esta prioridad: `offline` → `error` → `interrupted` → `waiting` → `done` → `using-tool` → `thinking` → `idle`. La prioridad evita que una animación ambiental tape una aprobación o un error.

## Reglas de privacidad

- Mostrar sólo `task_summary`, limitado y sanitizado por el observador.
- No mostrar prompts completos, argumentos, resultados, historial ni razonamiento.
- Ocultar el resumen cuando el personaje vuelve a `idle`, aunque se conserve para inspección histórica.
- Los errores se muestran como estado general; no se exponen mensajes internos de proveedores.

## Transiciones mínimas del primer prototipo

```text
idle -> thinking -> using-tool -> thinking -> done -> idle
                  -> waiting -> thinking
                  -> error -> idle
                  -> interrupted -> idle
```

El movimiento físico y la animación son responsabilidad del frontend. El bridge entrega intención (`destination`) y estado (`status`, `activity`, `animation`), de modo que el mundo puede cambiar de tecnología visual sin modificar la integración con Hermes.
