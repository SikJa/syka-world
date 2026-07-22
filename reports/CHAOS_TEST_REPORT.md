# Informe de caos — Bridge v0.3

Fecha: 2026-07-16. Estado: 13 escenarios cubiertos con procesos o archivos temporales; ninguna sesión real fue interrumpida.

| Riesgo | Evidencia | Resultado |
|---|---|---|
| duplicados | reducer + replay incremental | idempotente |
| evento atrasado | orden por timestamp por sesión | no reemplaza estado nuevo |
| fuera de orden entre archivos | replay global ordenado | transición correcta |
| última línea parcial | offset retenido hasta newline | recuperada en el siguiente scan |
| línea/archivo corrupto | aislamiento por línea y diagnóstico | siguiente evento válido sobrevive |
| truncado/rotación | detección `size < offset` + deduplicación | sin doble estado |
| reinicio | checkpoint atómico versionado | estado y offsets restaurados |
| backend/observador caído | reconciliación por PID controlado | sesión interrumpida de forma segura |
| dos sesiones por perfil | reducer por `(profile, session)` | una finalización no oculta la otra |
| plugin ausente | SQLite fallback temporal | estado degradado observable |
| plugin + fallback | precedencia explícita | plugin conserva autoridad |
| checkpoint corrupto | carga defensiva | replay seguro y diagnóstico |
| frontend reconectado | `events?after=<id>` | entrega sólo eventos posteriores |

Comando de verificación:

```powershell
.venv\Scripts\python -m unittest discover -s tests -v
```

Resultado final: 39/39 pruebas pasaron. La retención se probó archivando y restaurando archivos temporales con SHA-256; no se activó sobre el spool real.
