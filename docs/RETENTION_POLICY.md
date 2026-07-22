# Retención segura del spool

Estado: política implementada, desactivada por defecto y probada sólo con archivos temporales.

## Principio

Los eventos del observador son evidencia operativa, no basura descartable. El bridge nunca los elimina automáticamente. La única operación implementada es un archivado reversible de archivos JSONL antiguos cuyo proceso escritor ya no está vivo.

## Política propuesta

- conservar en el spool activo un mínimo de 14 días;
- omitir cualquier archivo asociado a un PID todavía vivo;
- ejecutar primero un dry-run y revisar la lista;
- mover, no borrar, los candidatos a un archivo fechado;
- guardar ruta original, tamaño, fecha y SHA-256 en `manifest.json`;
- conservar los archivos archivados 90 días como propuesta, sin automatizar su eliminación;
- restaurar desde el manifiesto si hace falta replay o diagnóstico.

## Uso

El modo por defecto sólo informa:

```powershell
.venv\Scripts\python -m syka_world_bridge.retention "$env:LOCALAPPDATA\hermes\syka-world\events"
```

El archivado requiere dos decisiones explícitas:

```powershell
.venv\Scripts\python -m syka_world_bridge.retention `
  "$env:LOCALAPPDATA\hermes\syka-world\events" `
  --older-than-days 14 `
  --archive-dir "$env:LOCALAPPDATA\hermes\syka-world\archive" `
  --apply
```

Restauración:

```powershell
.venv\Scripts\python -m syka_world_bridge.retention . --restore <ruta-al-manifest.json>
```

## Límites

No hay borrado definitivo, tarea programada ni limpieza automática. Antes de activar una política real conviene observar durante varias semanas cuánto crece el spool y definir una copia de seguridad. Durante Foundations v1 no se movió ningún evento real.
