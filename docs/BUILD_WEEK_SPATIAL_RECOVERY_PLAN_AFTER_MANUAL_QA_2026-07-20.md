# Syka World — Build Week Spatial Recovery Plan

Fecha: 2026-07-20  
Estado: plan de implementación posterior a QA manual  
Raíz canónica: `F:\Coding Proyects\Syka World Game`  
Handoff base: `docs/HANDOFF_HABBO_SPATIAL_PUBLIC_FOUNDATION_V1_2026-07-20.md`

## 1. Resultado de la prueba manual

La prueba del usuario confirma el siguiente estado real:

| Área | Estado observado |
| --- | --- |
| Construcción exterior | Funciona razonablemente y los edificios se construyen. |
| Catálogo/UI | Mezcla inglés y español: tabs en inglés y nombres/acciones en español. No existe un selector de idioma claro. |
| Poseer en exterior | Funciona, pero el desplazamiento es demasiado lento y se percibe como saltos entre casillas. |
| Entrada/salida del Café | El cambio de escena funciona de forma básica. |
| Actores dentro del Café | Escala incorrecta, sprites pequeños o cortados, movimiento ausente o poco fiable. |
| NPC del Café | Se corta, desaparece o se superpone incorrectamente. |
| Colisiones interiores | Los actores atraviesan barra, mesas, sillones y otras estructuras. |
| Profundidad interior | No existe una relación visual fiable delante/detrás de los muebles. |
| `E` y `F` | No hay evidencia manual suficiente de que las interacciones produzcan el estado esperado. |

La prueba invalida cualquier afirmación de que el runtime espacial del Café esté terminado. Los contratos y tests existentes son una base útil, pero el resultado visible sigue siendo una composición de sprites sobre una ilustración plana.

## 2. Decisión visual y técnica

No se migrará a un juego 3D con cámara libre. Se conservará la dirección aprobada:

- pixel art isométrico;
- cámara fija sin rotación;
- zoom y paneo;
- estética detallada del Café actual;
- experiencia 2.5D similar a Habbo en su lógica espacial.

La solución correcta es una **reconstrucción espacial 2.5D basada en entidades**, no colocar actores encima de un PNG y tampoco reemplazar todo por modelos 3D.

La escena debe separar:

1. suelo y paredes de fondo;
2. entidades físicas de mobiliario;
3. partes traseras, cuerpo y partes delanteras de cada entidad;
4. colisiones y zonas caminables;
5. anchors de uso, asiento, servicio y portal;
6. actores con una posición de pies autoritativa;
7. profundidad calculada desde la posición de los pies y la elevación.

El raster aprobado puede mantenerse temporalmente como referencia y backplate, pero no puede continuar siendo la única fuente de verdad espacial.

## 3. Alcance de cierre para Build Week

El objetivo inmediato no es completar toda la goal anterior. Es entregar un slice coherente y demostrable de ciudad + Café.

### P0 — obligatorio

1. Recuperar typecheck y baseline verde.
2. Unificar la UI visible del flujo probado en inglés.
3. Hacer continuo, rápido y legible el movimiento exterior e interior.
4. Normalizar escala, anchor y recorte de todos los actores.
5. Reconstruir espacialmente el Café para barra, mesas, sillones, entrada y NPC.
6. Impedir que actores y NPC atraviesen entidades bloqueantes.
7. Probar profundidad delante/detrás con actores reales.
8. Hacer verificables `E` y `F`.
9. Preservar entrada, salida, reentrada, rutinas y save/load.
10. Ejecutar QA físico y actualizar documentación con evidencia actual.

### P1 — sólo si P0 queda estable

- pulido responsive del panel de construcción;
- más entidades interiores modulares;
- mejora visual de animaciones;
- evidencia en video corta;
- limpieza de bundle y performance.

### Fuera de alcance para este cierre

- 3D real o cambio de motor;
- rotación de cámara;
- interiores de todos los edificios;
- catálogo grande de muebles;
- editor completo de interiores;
- selector bilingüe completo;
- personajes o pets finales;
- economía avanzada, relaciones, misiones o multiplayer.

## 4. Plan de implementación

### Fase A — recuperar un baseline honesto

1. Reproducir el error actual de `previewFurniturePlacement`.
2. Retirar o aislar el stub incompleto si no se va a terminar en este cierre.
3. No declarar placement terminado sólo por corregir el tipo.
4. Ejecutar typecheck, tests frontend, build y tests Python.
5. Congelar resultados como baseline previo al cambio espacial.

Resultado esperado: repositorio verde antes de tocar movimiento o render.

### Fase B — consistencia de idioma

Para Build Week se elegirá **inglés como único idioma visible**. No se construirá ahora un sistema i18n completo.

Cambiar, como mínimo:

- nombres y descripciones de los seis edificios;
- acciones `Ir al Café`, entrada/salida y toasts;
- estados de agentes, construcción y aceleración;
- labels del interior;
- mensajes de error visibles.

Los nombres propios `Syka`, `Elen`, `Astrelis` y `Zerny` se mantienen. El nombre de marca `Café Biblioteca` puede mantenerse sólo si se decide tratarlo como nombre propio; de lo contrario usar `Library Café` de forma consistente.

Resultado esperado: no mezclar tabs ingleses con contenido español y no mostrar un selector de idioma inexistente.

### Fase C — movimiento libre y fluido

La grilla puede sobrevivir internamente para planificación, reservas y determinismo, pero no debe ser visible como saltos.

Implementar:

1. posición continua de mundo/subcelda para actores;
2. interpolación por tiempo delta entre waypoints;
3. velocidad configurada en unidades por segundo, independiente del framerate;
4. click-to-move con ruta suave;
5. `WASD` con movimiento continuo mientras se mantiene la tecla;
6. detección de colisión contra geometría caminable y obstáculos;
7. misma locomoción para jugador poseído, agentes autónomos y NPCs;
8. animación y facing derivados de la velocidad real;
9. velocidad inicial aproximadamente 1,7–2 veces más rápida que la observada, ajustada mediante prueba visual.

No usar una sucesión visible de `requestPossessedStep()` con bloqueo por casilla como experiencia final. La celda lógica puede actualizarse al cruzar límites o llegar a un waypoint sin teletransportar el sprite.

Resultado esperado: Elen recorre el exterior y el Café de forma continua, sin pausa perceptible entre casillas.

### Fase D — contrato visual único para actores

Crear un contrato compartido para perfiles y NPCs:

- anchor de pies `bottom-center`;
- altura visual canónica;
- escala por escena definida una sola vez;
- hitbox/collider separado de los píxeles transparentes;
- shadow alineada con los pies;
- depth basado en pies, no en el bounding box completo;
- crop/mask únicamente por oclusión espacial válida;
- prohibido escalar personajes según la zona del raster.

El bartender y los perfiles deben usar el mismo renderer y pipeline de movimiento. Sólo cambia su capacidad de ser poseídos y sus rutinas.

Resultado esperado: ningún actor se ve diminuto, cortado o flotando y todos mantienen proporciones coherentes.

### Fase E — reconstrucción espacial del Café

Construir una definición autoritativa `CafeSpatialSceneV2` con:

- polígono navegable del suelo;
- entrada/portal y approach anchor;
- barra con footprint, zona frontal y parte de oclusión;
- mesas con footprints circulares o poligonales aproximados;
- sillones y sofá con footprints bloqueantes;
- cocina, chimenea y paredes como bloqueantes;
- sillas/asientos con anchors y orientación;
- estación del bartender con anchor reservado;
- capas `back`, `body`, `front`, `overlay` y `shadow`;
- depth determinista desde coordenada isométrica y elevación.

Estrategia visual incremental:

1. separar el raster en backplate limpio y máscaras/front-parts para barra, mesas y sillones;
2. usar esas partes como entidades renderizables alineadas al backplate;
3. migrar primero barra + una mesa + un sofá;
4. validar escala, colisión y delante/detrás;
5. ampliar al resto del Café sólo si el gate funciona.

Si separar el raster produce artefactos visibles, reemplazar únicamente las entidades del gate por sprites isométricos compatibles. No generar un interior nuevo completo durante este cierre.

Resultado esperado: un actor puede rodear la barra y una mesa, quedar oculto por su parte delantera y reaparecer sin atravesarlas.

### Fase F — interacciones reales

`E` debe:

1. localizar el anchor compatible más cercano;
2. navegar hasta su approach cell/posición;
3. reservarlo;
4. cambiar a pose coherente;
5. producir un estado observable, por ejemplo sentarse o pedir/servir café;
6. liberar la reserva al moverse.

`F` debe:

1. funcionar sólo cerca de un portal válido;
2. entrar o salir del Café;
3. conservar identidad y estado del actor;
4. soportar salida y reentrada en el mismo runtime.

Resultado esperado: ambas teclas modifican estado verificable; no basta con que no lancen errores.

### Fase G — QA físico y cierre

El E2E debe usar inputs reales para:

1. crear/cargar una partida;
2. seleccionar y poseer a Elen;
3. caminar continuamente en exterior;
4. entrar al Café;
5. recorrer al menos veinte trayectos alrededor de barra, mesa y sofá;
6. comprobar que no cruza footprints bloqueantes;
7. capturar una posición detrás y otra delante de cada entidad del gate;
8. validar bartender + al menos dos perfiles simultáneos;
9. ejecutar `E` y comprobar pose/reserva/acción;
10. ejecutar `F`, salir, reentrar y comprobar identidad;
11. guardar, recargar y comprobar compatibilidad;
12. ejecutar typecheck, tests, build y Python.

Generar capturas originales y un reporte que distinga prueba automática de inspección visual humana.

## 5. Criterios de aceptación manual

El usuario debe poder confirmar todos:

- el catálogo visible no mezcla inglés y español;
- Elen se mueve a una velocidad agradable;
- `WASD` y click-to-move no parecen saltos de casilla;
- Elen, otros perfiles y bartender tienen escala coherente;
- ningún actor atraviesa barra, mesas, sofá, cocina o paredes;
- los personajes pasan de forma convincente delante y detrás de objetos;
- al menos dos perfiles pueden compartir el Café;
- `E` produce una interacción visible;
- `F` entra o sale de forma consistente;
- salir y volver a entrar no rompe sprites ni posiciones;
- la ciudad, construcción y guardado siguen funcionando.

## 6. Estimación y estrategia de ejecución

Estimación para un agente fuerte con alcance controlado:

- baseline + idioma: 45–90 minutos;
- locomoción continua + escala: 1,5–2,5 horas;
- gate espacial del Café: 2–4 horas;
- interacciones + QA + documentación: 1,5–3 horas.

Total estimado: **6–10 horas**, dependiendo de cuánto pueda reutilizarse el raster sin artefactos.

Configuración recomendada:

- GPT-5.6 Max inicialmente;
- modo estándar, no Fast;
- un solo agente durante la implementación principal;
- checkpoint después de baseline, después del gate de barra/mesa y antes de ampliar alcance;
- Ultra sólo para una auditoría visual/arquitectónica final si queda cuota.

## 7. Prompt compacto para ejecutar el plan

```text
Trabajá únicamente en F:\Coding Proyects\Syka World Game. Leé completos docs/HANDOFF_HABBO_SPATIAL_PUBLIC_FOUNDATION_V1_2026-07-20.md y docs/BUILD_WEEK_SPATIAL_RECOVERY_PLAN_AFTER_MANUAL_QA_2026-07-20.md. El segundo documento contiene la QA manual más reciente y reemplaza prioridades anteriores cuando entren en conflicto.

Objetivo: entregar un slice demostrable de ciudad + Café isométrico 2.5D. Primero recuperá typecheck y suites verdes; retirando o aislando el placement stub si no se completa honestamente. Después unificá en inglés el flujo visible, implementá movimiento continuo y más rápido para click/WASD/rutinas, normalizá escala y feet-anchor de todos los actores, y reconstruí el gate espacial del Café para barra + mesa + sofá con entidades, colisiones, anchors, render parts y depth determinista. E y F deben producir estados verificables. Preservá construcción, entrada/salida, reentrada, bridge GET-only y save/load.

No conviertas el juego a 3D, no rehagas todo el arte, no implementes editor completo, otros interiores, economía, pets ni publicación. Conservá el pixel art aprobado. Usá un solo agente y detené expansión si el gate no supera QA visual. Ejecutá inputs físicos, tests, build y capturas originales. Actualizá documentación sólo con resultados comprobados.
```

## 8. Estado al entregar este documento

- Este documento es planificación; no implementa las correcciones.
- El servidor local puede seguir ejecutándose, pero debe revalidarse al iniciar una nueva sesión.
- El typecheck continúa roto por el placement parcial descrito en el handoff.
- La última QA manual del usuario es la autoridad sobre el estado visual del Café.

## 9. Actualización — Spatial Entity Lab v1

El 2026-07-20 se implementó el gate aislado pedido por el usuario antes de migrar el Café completo.

- entrada: `http://127.0.0.1:5173/spatial-lab.html`;
- backplate vacío + barra + mesa + sofá como entidades independientes;
- movimiento continuo WASD y click-to-move;
- colisiones, depth por pies, anchors e interacción `E`;
- diagnóstico visual de footprints;
- pruebas 3/3 y QA en navegador sin errores.

Conclusión del gate: la arquitectura 2.5D modular funciona y conserva el nivel de detalle. Todavía falta alinear y migrar el Café real detrás de una ruta experimental; no se modificó la escena principal en este pass. Ver `docs/SPATIAL_ENTITY_LAB_V1_2026-07-20.md`.
