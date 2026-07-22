# Arquitectura de simulación v1

Estado: implementada como núcleo headless determinista.

## Frontera

```text
Hermes → Syka World Bridge → BridgeSignal v1
                              ↓
                    SimulationEngine v1
                              ↓
                 World state / save v1
                              ↓
          cualquier renderer o interacción futura
```

`syka_world_sim` no importa Hermes, el plugin ni el servidor del bridge. Tampoco conoce Three.js, canvas, React o un motor de juego. Recibe señales pequeñas y versionadas, y entrega estado serializable.

## Contratos implementados

| Dominio | Contrato |
|---|---|
| reloj | `WorldClock`: día, minuto del día y minutos totales |
| personajes | `Character`: identidad, rol, hogar, trabajo, acción y ubicación |
| lugares | `Building`: tipo, capacidad y nivel |
| rutinas | `action`, `action_minutes` y selector determinista |
| necesidades | `Needs`: energía, concentración, ánimo, sociabilidad y comodidad |
| inventario | `Inventory` con cantidades por objeto |
| economía | saldo por personaje, saldo municipal y métricas por fuente/sumidero |
| progresión | nivel, XP general/profesional, reputación y afinidad |
| relaciones | pares de personajes con afinidad |
| misiones | cadencia, objetivo, progreso y completado |
| bridge | `syka.world.bridge-signal.v1` |
| guardado | `syka.world.save.v1` con reemplazo atómico |
| simulación | `syka.world.simulation.v1` |

## Tiempo y determinismo

El tick inicial es de 15 minutos. Toda decisión depende sólo del estado, la configuración y señales programadas. La misma semilla y entradas producen exactamente el mismo resultado. La simulación puede acelerar 30 días en menos de un segundo en la máquina de validación.

## Integración con actividad real

- `activity.started`: registra la sesión y desplaza al personaje al trabajo.
- `activity.waiting`: mantiene el lugar y cambia a espera visible.
- `activity.resumed`: vuelve a trabajo.
- `activity.completed`: retira sólo esa sesión y otorga recompensa moderada.
- `activity.failed` o `activity.interrupted`: retira la sesión sin multa.
- otra sesión activa conserva al personaje trabajando.

## Persistencia y migración

Los saves tienen versión propia. Un cambio incompatible debe incluir migrador explícito; nunca se interpretará silenciosamente un save desconocido. Los valores de balance viven en `config/game-balance.v1.json`, separados de los saves para permitir ajustes. Una futura migración económica debe guardar versión de balance y aplicar un factor documentado, con piso que preserve compras ya obtenidas.

## Métricas

El motor registra minutos por actividad y edificio, ingresos, gastos, XP, eventos, necesidades críticas, decisiones ociosas y efecto Hermes. Esto permite balancear sin depender de impresiones visuales.
