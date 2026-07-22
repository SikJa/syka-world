# Auditoría de referencias y estrategia de rescate

Fecha de verificación: 2026-07-16. Se inspeccionaron repositorios oficiales, licencias, manifiestos y el proyecto heredado local. No se copió código ni assets durante esta auditoría.

## Decisión ejecutiva

No conviene forkear una solución completa. Syka World tiene una combinación singular: actividad Hermes real, simulación local de largo plazo, economía cozy y una ciudad observacional. La estrategia es:

- conservar nuestro bridge y simulación como núcleo;
- estudiar fronteras de runtime y reconexión de Claw3D;
- estudiar contratos de assets y layout de Pixel Agents;
- rescatar ideas y piezas locales con trazabilidad;
- usar My Virtual World sólo como referencia conceptual;
- construir un laboratorio visual propio y pequeño.

## Matriz

| Fuente | Licencia verificada | Stack/estado | Valor útil | Riesgo | Decisión |
|---|---|---|---|---|---|
| Syka Pixel Office local | avisos MIT/CC0 parciales; provenance por archivo pendiente | FastAPI, WebSocket, React/Vite; heredado | endpoints de mundo, clasificación, layout, experiencia acumulada | monolito, ejecución real mezclada, rutas antiguas, frontend descartable | rescatar selectivamente |
| `fathah/hermes-office` | MIT | fork TypeScript de Claw3D; último push 2026-06-04 | historial del adaptador Hermes y compatibilidad Desktop | fork pequeño y atrasado respecto de upstream | estudiar, no basar |
| `iamlukethedev/Claw3D` | MIT | Next 16, React 19, R3F/Three, Phaser, Vitest/Playwright; activo 2026-07 | runtime seam, proxy same-origin, demo gateway, reconexión, adapter tests | superficie enorme, dos stacks visuales, orientado a control/ejecución | adaptar patrones |
| `eliautobot/my-virtual-world` | todos los derechos reservados | Python server, Three.js, Colyseus, Rapier, Yuka; activo 2026-07 | vida, objetos, rutas, JSON persistente, modo demo, perfiles Hermes | prohíbe copiar/modificar/distribuir sin acuerdo; funciones con licencia | estudiar solamente |
| `pablodelucca/pixel-agents` | MIT; assets externos requieren sus avisos | TypeScript; core/adapters/transport y suite E2E; activo 2026-07 | contrato proveedor, layout, manifests de muebles, tests de lifecycle | dirección 2D distinta y assets con cadena de atribución | adaptar arquitectura; assets sólo con auditoría |
| `DevvGwardo/hermes-pixel-agents` | MIT | React/TypeScript; activo 2026-06 | `hermesClient`, `hermesAdapter`, mapeo de actividad | integración externa previa a nuestro plugin y DB actual | estudiar casos de test |
| `davinson-pezo/hermes-pixel-ui` | sin licencia detectada | JavaScript; push 2026-06 | FastAPI/WebSocket/scene editor como referencia histórica | sin licencia, no reutilizable por defecto | concepto solamente |
| OpenAI MiniTown | showcase, no repositorio/licencia de código publicados en la página | build interactivo publicado | cámara, observación, rutinas, crecimiento, día/noche | no es dependencia ni base descargable | referencia principal de experiencia |

## Syka Pixel Office heredado

Ruta preservada intacta:

`%LOCALAPPDATA%\hermes\syka-office\syka-pixel-office`

### Qué rescatar

- nombres y separación de endpoints `world/state`, `world/events` y profile map;
- ideas de clasificación de foco y destino;
- conexión secundaria Kanban;
- layout y catálogo como datos, después de verificar provenance;
- terceros documentados: Pixel Agents MIT y MetroCity CC0.

### Qué no trasladar

- `HermesBridge` que asume `~/.hermes/sessions` y parsea dumps completos;
- la mezcla de observer, replay visual, comandos y ejecución real en el mismo servidor;
- endpoints que lanzan tareas Hermes desde el mundo;
- IDs visuales basados en sesión en lugar de perfil;
- frontend React actual.

## Claw3D y Hermes Office

Claw3D documenta una frontera clara:

```text
Browser → Studio → adapter WebSocket → Hermes HTTP API
```

El adaptador soporta chat, sesiones, abort, configuración, aprobaciones y subagentes. Eso es valioso para la capa futura de trabajo dentro del mundo, pero no observa necesariamente tareas Desktop que no pasan por el adaptador. Nuestro plugin cubre mejor el MVP pasivo.

Patrones a adaptar:

- provider/runtime seam;
- proxy same-origin para evitar CORS y aislar secretos;
- demo gateway/datos simulados;
- perfiles de runtime;
- tests unitarios más E2E;
- subagentes como entidades separadas en una fase posterior.

No adoptar el frontend completo: combina R3F y Phaser, tiene mucha superficie operativa y carga conceptual que no pertenece al hobby cozy.

Fuentes: [Claw3D](https://github.com/iamlukethedev/Claw3D), [adaptador Hermes](https://github.com/iamlukethedev/Claw3D/blob/main/docs/hermes-gateway.md), [Hermes Office](https://github.com/fathah/hermes-office).

## Pixel Agents y Hermes Pixel Agents

Pixel Agents separa `core`, adapters, transport, provider y manifiestos de assets. Esa modularidad es transferible aunque la estética final sea 3D ligero. Su catálogo de muebles muestra un patrón útil: cada objeto tiene asset y manifest, lo que encaja con la riqueza de Garden Galaxy.

Antes de usar cualquier asset hay que seguir `docs/external-assets.md` y conservar notices. El proyecto heredado ya atribuye MetroCity CC0, pero esa atribución no sustituye una auditoría archivo por archivo.

Hermes Pixel Agents contiene adaptadores específicos y assets similares. Sirve para comparar estados y fallos de conexión; no debe reemplazar el bridge v0.3.

Fuentes: [Pixel Agents](https://github.com/pablodelucca/pixel-agents), [Hermes Pixel Agents](https://github.com/DevvGwardo/hermes-pixel-agents).

## My Virtual World

Es la referencia funcional más cercana a una vida completa: mundo voxel, interiores, uso de objetos, colas, movimiento, JSON persistente, Hermes opcional y runtime Colyseus. También declara requerir al menos 4 GB de RAM y usa funciones activadas por licencia.

Su licencia dice expresamente “All rights reserved” y niega permiso de copia, modificación, distribución, sublicencia o venta sin licencia escrita separada. Por eso sólo podemos usar ideas generales observables y documentación pública; ningún código, esquema detallado o asset debe copiarse.

Fuente: [My Virtual World](https://github.com/eliautobot/my-virtual-world).

## MiniTown

La página oficial confirma zonas, carreteras, crecimiento, rutinas, vehículos, ciclo día/noche y cámara ligeramente cenital. Para la primera slice, Syka World toma observación, escala y luz, pero posterga zonificación y construcción procedural.

Fuente: [OpenAI MiniTown](https://developers.openai.com/showcase/minitown).

## Regla de incorporación

Una pieza externa sólo entra al repositorio si registra:

1. URL y commit exacto;
2. licencia y notice;
3. archivos incorporados;
4. modificaciones realizadas;
5. prueba que demuestra su valor;
6. responsable de futuras actualizaciones.

Hasta entonces, toda referencia permanece en categoría `estudiar`.
