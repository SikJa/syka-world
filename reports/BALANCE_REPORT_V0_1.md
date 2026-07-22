# Reporte de balance v0.1

Fecha: 2026-07-16. Motor: `syka.world.simulation.v1`. Tick: 15 minutos.

## Escenarios ejecutados

| Escenario | Días | Cambio neto global | Saldos finales | Hermes inicio/fin/fallo | Necesidad crítica |
|---|---:|---:|---|---|---:|
| sin Hermes | 1 | +16 L | 45/45/45/45 | 0/0/0 | 0 min |
| carga normal | 1 | +32 L | 49/48/49/50 | 4/4/0 | 0 min |
| Zerny sobrecargado | 1 | +31 L | 45/45/45/60 | 8/8/0 | 0 min |
| dos sesiones Elen | 1 | +23 L | 45/52/45/45 | 2/2/0 | 0 min |
| errores e interrupciones | 1 | +17 L | 44/45/44/48 | 3/1/2 | 0 min |
| normal semanal | 7 | +200 L | 97/90/97/104 | 28/28/0 | 0 min |
| normal largo | 30 | +864 L | 286/256/286/316 | 120/120/0 | 0 min |

Orden de saldos: Syka, Elen, Astrelis, Zerny.

## Ajuste realizado

La primera corrida de 30 días terminaba entre 568 y 688 L por personaje: demasiado crecimiento para los rangos de objetos previstos. Se redujo práctica local de 2 a 1 L, misión diaria de 3 a 1 L, misión semanal de 12 a 6 L; el costo de vida pasó de 3 a 5 L y se añadió una compra semanal reversible de decoración por 12 L cuando queda una reserva mínima de 30 L.

Después del ajuste, 30 días normales terminan entre 256 y 316 L. Eso permite varias compras pequeñas y una mejora relevante sin vaciar la progresión.

## Hallazgos

- El mundo progresa sin Hermes: cada personaje termina el primer día con 45 L y 36 XP profesional.
- Cuatro tareas normales agregan 20 L globales, pero sustituyen parte de la práctica local; no duplican todo el ingreso.
- Ocho tareas para Zerny entregan 24 L por rendimientos decrecientes, no 40 L.
- Una sesión concurrente que termina no saca a Elen del trabajo mientras la otra sigue activa.
- Fallos e interrupciones no crean gastos ni pérdida directa de saldo.
- Ningún escenario produjo necesidades fuera de rango, saldos negativos o decisiones ociosas.

## Riesgos y próximos ajustes

- Cero minutos críticos puede indicar una rutina demasiado cómoda. Conviene validar visualmente antes de aumentar presión; el objetivo no es un survival game.
- Elen gana un poco menos en carga normal por el horario de su señal. Esto es emergente, no un modificador por personaje; revisar que no se acumule injustamente.
- La economía todavía no simula compras elegidas por el jugador, sólo una colección semanal. Los costos reales deberán calibrarse con el placer de decorar.
- El saldo municipal puede ser negativo porque aún no tiene ingresos propios; no afecta personajes y debe resolverse cuando existan edificios mejorables.

## Reproducción

```powershell
.venv\Scripts\python -m syka_world_sim.cli --scenario all --pretty
```
