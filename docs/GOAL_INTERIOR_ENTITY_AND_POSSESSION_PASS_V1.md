# Syka World — Interior Entity & Possession Pass v1

Estado: **COMPLETADA Y VERIFICADA** el 2026-07-17.

Fecha de definición: 2026-07-17.

Presupuesto operativo: aproximadamente el 15% del saldo de tokens disponible al iniciar la goal. No existe autorización para gastar tokens artificialmente; priorizar el circuito P0 y detenerse cuando esté demostrado. Si el presupuesto visible exige un número exacto, Sikora lo definirá al crear la goal.

## Estado de ejecución — 2026-07-17

Verificado:

- runtime espacial tipado compartido por ciudad y Café Biblioteca;
- movimiento por clic, pausa manual de 3 s y retorno a rutina;
- **Poseer**/`P`, WASD cardinal, colisiones y ocupación determinista;
- `E` sobre el anchor exacto y `F` sobre portales válidos;
- `Esc` libera primero y, ya libre en interior, auto-enruta a la puerta sin teletransporte;
- entidades bloqueantes y depth/occlusion del Café conservando el raster aprobado;
- save/load de escena/casilla sin persistir posesión activa;
- frontend 225/225, typecheck/build y Python 39/39 en PASS;
- E2E físico 14/14 pasos PASS en `reports/interior-entity-possession-v1/physical-e2e.json`, incluyendo `E` físico `serve-coffee` en el anchor `counter`;
- auditoría de ocho solicitudes bridge, todas GET sin body, cero writes y cero tareas Hermes;
- capturas limpias y video final `reports/interior-entity-possession-v1/syka-world-possession-pass-v1-20s.mp4`, duración exacta 20.000 s a 1440×900.

Auditoría independiente cerrada:

- informe: `reports/interior-entity-possession-v1/independent-final-audit.md`;
- QA físico 15/15 y responsive PASS en 1008×548, 2560×1080 y 640×720;
- 20 GET independientes sin body y cero errores inesperados;
- video 20.000 s verificado y hashes del arte preservados;
- ciudad 53,99 FPS y Café 56,89 FPS; la cifra exterior queda como riesgo no bloqueante;
- puerto 5188 cerrado y servidor 5173 preexistente intacto;
- bloqueantes del alcance ejecutado: ninguno. La auditoría no cubría salida y reentrada dentro del mismo runtime; una regresión posterior reveló ese hueco y quedó corregida/verificada en `reports/cafe-runtime-regression/`.

Corrección posterior de integridad: el fondo del Café fija `__BASE`, el shutdown limpia todas las vistas, el walk grid está conectado desde `{16,17}` y actores/NPC recorren rutas cardinales desde su celda autoritativa. `cafe_reentry_regression_e2e.py` prueba primera entrada → salida → segunda entrada → WASD en el mismo `Phaser.Game` y termina en PASS; el E2E físico 14/14 también fue repetido en PASS.

Límites confirmados: casas, oficinas y taller siguen sin interiores modulares; editor de habitaciones, multiplayer, chat, relaciones, necesidades y misiones permanecen fuera de alcance. El warning conocido de Vite por chunk principal mayor a 500 kB continúa documentado.

## 1. Misión

Convertir el movimiento actual de Syka World y el Café Biblioteca rasterizado en el primer sistema espacial verdaderamente jugable del proyecto, sin reconstruir la ciudad, el bridge, la simulación, la economía ni la progresión.

La entrega debe permitir:

1. seleccionar a Syka, Elen, Astrelis o Zerny;
2. hacer clic en una casilla válida de la ciudad o del Café y ver al agente caminar hasta ella;
3. activar el modo **Poseer** para controlar directamente al agente;
4. moverse con WASD sobre la misma grilla y las mismas reglas que usa el pathfinding;
5. interactuar con objetos cercanos mediante `E`;
6. entrar o salir por un portal mediante `F`;
7. chocar correctamente con barra, mesas, sillas, paredes, plantas grandes, edificios y demás obstáculos;
8. pasar por delante y detrás de objetos con profundidad visual coherente;
9. conservar las rutinas autónomas cuando ningún agente está bajo una orden manual;
10. demostrar el resultado mediante pruebas, capturas limpias y un video corto reproducible.

La meta no es “convertir todo en Habbo” ni rehacer todos los interiores. Habbo es una referencia de gramática espacial —grilla isométrica, mobiliario modular, actores con profundidad y destinos por casilla—, mientras Syka World conserva su identidad: ciudad personal, agentes autónomos conectados pasivamente con Hermes, progresión y control ocasional.

## 2. Resultado prometido y límite honesto

### Sí debe entregar

- un contrato reutilizable de escena interior modular;
- un registro de entidades espaciales e interactivas;
- walk grid, ocupación, colisiones, portales, anchors y profundidad compartidos;
- movimiento por clic en ciudad e interior;
- modo Poseer con WASD para los cuatro agentes principales;
- `E` para interacción contextual y `F` para portales;
- integración completa del contrato nuevo en el Café Biblioteca;
- adaptación de NPCs y agentes del Café a la misma ocupación y profundidad;
- preservación del aspecto cálido, denso y pixel art de la referencia aprobada;
- pruebas unitarias, E2E físico, QA visual independiente y video final;
- documentación y estado de proyecto actualizados.

### No debe prometer en esta ejecución

- interiores terminados de casas, oficinas o taller;
- editor libre de habitaciones comparable con Habbo;
- convertir cada taza, libro o adorno diminuto en una entidad;
- animaciones finales de todos los avatares;
- física 3D, cuerpos rígidos o motor 3D;
- NPCs poseíbles;
- multiplayer, chat, relaciones, necesidades o misiones;
- iniciar tareas reales desde Syka World;
- reemplazar arte aprobado por una versión modular visiblemente inferior.

## 3. Fuentes obligatorias y orden de autoridad

Antes de modificar código, leer por completo:

1. este documento;
2. `CURRENT_PROJECT_STATE.md`;
3. `TASKS.md`;
4. `docs/DECISIONS.md`;
5. `docs/VISUAL_STYLE_GUIDE.md`;
6. `docs/ALPHA_RUNBOOK.md`;
7. `docs/SIMULATION_ARCHITECTURE.md`;
8. `app/game/src/core/contracts.ts`;
9. `app/game/src/core/state.ts`;
10. `app/game/src/core/agents.ts`;
11. `app/game/src/core/pathfinding.ts`;
12. `app/game/src/core/npcs.ts`;
13. `app/game/src/core/save.ts`;
14. `app/game/src/presentation/scenes/CityScene.ts`;
15. `app/game/src/presentation/scenes/CafeInteriorScene.ts`;
16. `app/game/src/ui/createAlphaUi.ts`;
17. los tests actuales de movimiento, Café, guardado y navegador;
18. las referencias visuales originales a resolución completa, especialmente `research/visual-concepts/approved-direction-v1/cafe-interior-library.png` o su ubicación canónica vigente.

Si existe contradicción, prevalecen:

1. las instrucciones explícitas más recientes de Sikora;
2. este documento;
3. `CURRENT_PROJECT_STATE.md` y `docs/DECISIONS.md`;
4. el comportamiento actual confirmado mediante una prueba reproducible;
5. documentación histórica;
6. supuestos del agente.

No asumir que un PASS histórico sigue siendo válido después de esta refactorización.

## 4. Restricciones innegociables

- Raíz canónica: `F:\Coding Proyects\Syka World Game`.
- Preservar todos los cambios existentes del usuario; el worktree puede estar sin commits.
- No hacer commit, push, PR, publicación, despliegue ni cambios irreversibles externos.
- No cerrar, reiniciar ni reconfigurar Hermes.
- Bridge estrictamente GET-only; cero tareas reales iniciadas.
- Mantener Phaser 4.2.1, TypeScript, Vite, pixel art 2.5D y cámara isométrica fija sin rotación.
- Mantener bridge, simulación y renderer desacoplados.
- No usar física 3D para resolver colisiones 2D.
- No copiar assets, código o layouts protegidos de Habbo, Whisper of the House u otros juegos.
- Se puede usar ImageGen únicamente para assets originales y trazables, preservando prompt, manifest, hashes y provenance.
- No borrar ni sobrescribir la cafetería actual hasta que la nueva pase el gate visual y funcional.
- No presentar un laboratorio inferior como reemplazo terminado.
- No inventar interiores de casas u oficinas en esta goal.
- No dejar servidores o puertos temporales abiertos al finalizar.

## 5. Decisión de producto: tres modos de movimiento

Syka World tendrá un mismo sistema espacial y tres fuentes posibles de intención:

### 5.1 Rutina autónoma

- Es el modo normal.
- Los agentes siguen sus horarios y órdenes locales existentes.
- No requiere LLM ni llamadas a Hermes.
- Usa exactamente el mismo walk grid, pathfinding, reservas y colisiones que el control manual.

### 5.2 Orden por clic

- Clic sobre un agente principal: lo selecciona.
- Clic posterior sobre una casilla transitable: crea una orden local de movimiento.
- Debe aparecer un marcador de destino discreto y coherente con el pixel art.
- El agente calcula una ruta; nunca camina en línea recta atravesando obstáculos.
- Si la casilla es inválida o inalcanzable, no se mueve y la UI explica brevemente el motivo.
- Al llegar, conserva la posición durante un periodo manual corto y después puede reanudar su rutina. El periodo debe ser determinista y estar documentado; no puede reanudarla instantáneamente y frustrar la orden.
- Una nueva orden reemplaza la anterior de forma explícita.

### 5.3 Modo Poseer

- Sólo Syka, Elen, Astrelis y Zerny son poseíbles en v1.
- Se activa mediante el botón visible **Poseer** sobre el agente seleccionado o mediante `P` cuando no hay un campo de texto enfocado.
- La UI debe dejar inequívoco qué agente está poseído.
- Mientras está activo, la rutina ambiental de ese agente queda suspendida localmente.
- WASD solicita pasos sobre la grilla; no mueve el sprite libremente en píxeles.
- El desplazamiento entre casillas se interpola con suavidad y conserva el aspecto pixel art.
- `Esc` libera primero la posesión. Un segundo `Esc`, `B` o el botón contextual puede salir del interior según el contrato vigente.
- `P` vuelve a liberar la posesión.
- Al liberar, el agente replanifica desde su casilla real, sin teletransporte.
- Si comienza una actividad Hermes real que exige otro destino mientras el agente está poseído, mostrar un aviso, liberar el control local y permitir que la simulación represente correctamente la actividad. Nunca falsificar o modificar el estado Hermes.

## 6. Mapa de controles congelado

Este contrato debe documentarse en UI, runbook y tests. No se puede cambiar silenciosamente durante la implementación.

| Entrada | Contexto | Acción |
|---|---|---|
| Clic en agente | ciudad/interior | seleccionar agente |
| Clic en casilla válida | agente seleccionado, no poseído | caminar automáticamente hasta el destino |
| Clic en objeto | ciudad/interior | seleccionar o inspeccionar; no confundir con clic de suelo |
| Botón `Poseer` | agente principal seleccionado | iniciar control directo |
| `P` | sin input de texto enfocado | alternar Poseer/liberar |
| `W` | poseído | mover visualmente hacia arriba en pantalla por una casilla isométrica válida |
| `A` | poseído | mover visualmente hacia la izquierda en pantalla |
| `S` | poseído | mover visualmente hacia abajo en pantalla |
| `D` | poseído | mover visualmente hacia la derecha en pantalla |
| `E` | poseído o agente seleccionado adyacente | usar la interacción contextual más cercana y válida |
| `F` | poseído o agente seleccionado frente a portal | entrar o salir por puerta/portal |
| `Esc` | poseído | liberar posesión, sin salir inmediatamente de escena |
| `Esc` | no poseído, interior | volver a la ciudad |
| `B` | ciudad | abrir/cerrar Construir según contrato vigente |
| `B` | interior | volver a la ciudad por compatibilidad vigente |

Reglas adicionales:

- ignorar teclas de juego si el foco está en `input`, `textarea`, selector editable o elemento con `contenteditable`;
- impedir scroll del navegador sólo para teclas capturadas activamente por el juego;
- no permitir que WASD mueva simultáneamente cámara y agente;
- conservar pan con mouse y zoom existentes;
- limitar la cola de movimiento para impedir atravesar objetos por key repeat;
- no aceptar pasos diagonales extra: cada tecla representa uno de los cuatro vecinos cardinales de la grilla isométrica;
- flechas pueden reflejar WASD como accesibilidad si no generan conflicto, pero no son requisito P0.

## 7. Arquitectura espacial objetivo

No adoptar un ECS pesado por moda. Crear contratos pequeños, tipados y verificables.

### 7.1 Definición de escena

Una escena interior debe poder declarar como datos:

- identificador y versión;
- dimensiones del walk grid;
- tile size y proyección;
- capa estructural de fondo;
- paredes y límites;
- entidades de objeto;
- casillas transitables y elevación si corresponde;
- portales;
- anchors semánticos;
- zonas de entrada y salida;
- reglas de luz/día-noche;
- assets y provenance.

### 7.2 Entidad de objeto interior

Todo objeto espacial o interactivo debe declarar, según corresponda:

- `id`, `kind` y variante visual;
- posición, orientación y footprint;
- casillas bloqueadas;
- casillas ocupables o de asiento;
- anchors de interacción;
- distancia y orientación requerida para usarlo;
- partes de render trasera/cuerpo/delantera si necesita oclusión;
- regla de profundidad;
- estado y acciones permitidas;
- persistencia si es comprable, movible o reemplazable;
- etiquetas accesibles para inspector y QA.

### 7.3 Qué debe convertirse en entidad

Debe ser entidad si al menos una condición es verdadera:

- bloquea movimiento;
- puede tapar o ser tapado por un actor;
- puede usarse;
- puede comprarse, moverse o reemplazarse;
- reserva una posición para sentarse, trabajar o esperar;
- funciona como portal.

En el Café, como mínimo:

- barra y mesada;
- cafetera/estación del bartender;
- mesas y sillas;
- sillones;
- chimenea;
- biblioteca o estanterías relevantes;
- cocina bloqueante;
- plantas grandes colocables;
- puerta de entrada/salida.

No deben ser necesariamente entidades independientes:

- una taza pintada sobre una estantería;
- libros puramente decorativos;
- cuadros;
- vajilla sin interacción;
- pequeñas luces o partículas;
- microdetalle de madera y textura.

Estos elementos pueden permanecer horneados dentro de una capa estructural u objeto padre. El objetivo no es convertir cada píxel en lógica.

### 7.4 Contrato único de ocupación

- Clic, WASD, rutinas y NPCs consultan la misma fuente de transitabilidad.
- Un actor no puede ocupar una casilla bloqueada por mobiliario.
- Dos actores no pueden terminar en el mismo anchor o asiento.
- La ocupación temporal de actores debe evitar solapamientos, pero no puede producir deadlocks permanentes.
- Las mascotas usan la misma grilla con footprint apropiado, sin estirarse para imitar altura humana.
- Los objetos colocables validan footprint antes de confirmarse; no pueden aparecer sobre mesas, plantas, actores o superficies incompatibles.

### 7.5 Profundidad y oclusión

- Derivar el orden principal de la posición de suelo del actor/objeto, no de un rectángulo manual gigante.
- Los objetos altos pueden tener capa posterior y capa frontal.
- Un actor detrás de la barra debe quedar parcialmente oculto; delante debe verse completo.
- Pies y sombra de contacto deben tocar la casilla real.
- Escala de personajes constante por especie/rol en una misma escena.
- No utilizar cinco máscaras artesanales como contrato final si el sistema modular puede producir la relación desde entidades.
- Los recortes actuales pueden conservarse temporalmente sólo como referencia o fallback durante la migración.

## 8. Estrategia visual y migración segura

La ilustración actual del Café es la referencia visual aprobada, no un fondo descartable. La nueva implementación debe preservar:

- madera oscura y cálida;
- biblioteca abundante;
- chimenea encendida;
- cocina/barra rica en pequeños objetos;
- mesas, sillones verdes, alfombras y plantas;
- ventanas con ciudad y hora sincronizadas;
- densidad visual comparable con Whisper of the House sin copiar sus assets;
- pixel art nítido, sin blur ni apariencia genérica de tileset vacío.

### Gate previo a reemplazo

1. Crear el runtime modular en una escena/laboratorio aislado o detrás de un flag de desarrollo.
2. Implementar un recorte suficiente: entrada, barra, una mesa, dos sillas, una planta, un humano y una mascota.
3. Comparar en 1008×548 y 1440×900 con el Café actual.
4. Verificar movimiento, colisiones, oclusión, escala y nitidez.
5. Permitir hasta dos iteraciones de assets/pipeline antes de decidir integración completa.
6. Sólo reemplazar el runtime productivo cuando el gate funcional sea PASS y el evaluador visual independiente confirme que no existe una degradación material.

Si el gate visual continúa fallando después de dos iteraciones:

- no destruir la cafetería vigente;
- conservar el laboratorio y los contratos válidos;
- documentar exactamente la diferencia y los assets faltantes;
- no declarar la goal completa;
- no compensar con overlays o máscaras frágiles que reproduzcan el problema original.

## 9. Plan de ejecución por fases

### Fase 0 — Auditoría y baseline

- revisar worktree y preservar cambios existentes;
- ejecutar las suites vigentes y registrar baseline real;
- reproducir los defectos actuales: cruces, escalas, desapariciones y oclusiones;
- medir FPS, errores de navegador y activos cargados;
- identificar qué código y assets pueden conservarse;
- crear matriz requisito → prueba → evidencia.

Salida: baseline confirmado, sin afirmar que el Café actual es modular.

### Fase 1 — Contratos y simulación de control local

- definir escena, entidad, footprint, portal, anchor, ocupación e interacción;
- agregar un estado de control local separado de Hermes;
- definir selección, orden por clic, posesión, liberación y replanificación;
- decidir persistencia: la posición real puede persistir; la posesión activa no debe sobrevivir a recarga;
- implementar migración/rechazo explícito si el save necesita extensión;
- mantener contratos renderer-agnostic donde sea razonable.

Salida: tipos, fixtures y tests puros.

### Fase 2 — Walk grid y navegación unificada

- construir el walk grid del Café desde entidades;
- usar la misma consulta para clic, WASD, agentes y NPCs;
- reservar anchors y resolver ocupación temporal;
- adaptar pathfinding sin romper tránsito exterior;
- impedir rutas a través de barra, mesas, paredes y objetos colocados;
- proporcionar feedback para destinos inválidos.

Salida: navegación verificable sin depender del dibujo.

### Fase 3 — Laboratorio visual modular

- preservar el Café actual;
- crear las capas/objetos originales mínimos del gate;
- implementar depth sorting y oclusión por entidad;
- probar un humano, una mascota y al menos un NPC;
- verificar escala, pivote, sombras y movimientos;
- usar ImageGen sólo si hace falta crear fuentes originales coherentes, con pipeline trazable.

Salida: gate visual/funcional pequeño.

### Fase 4 — Clic para mover

- selección clara del agente;
- hover/cursor de casilla válida e inválida;
- marcador discreto de destino;
- ruta automática y movimiento interpolado;
- reemplazo/cancelación de orden;
- pausa manual breve al llegar y retorno documentado a rutina;
- soporte en ciudad y Café.

Salida: recorrido completo por mouse.

### Fase 5 — Poseer y controles

- botón Poseer y atajo `P`;
- WASD relativo a pantalla sobre vecinos de la grilla;
- cola acotada y bloqueo durante transición;
- indicador persistente del agente poseído;
- `Esc` libera antes de cerrar escena;
- replanificación al liberar;
- protección de inputs de texto;
- resolución segura si comienza actividad Hermes.

Salida: control directo jugable y predecible.

### Fase 6 — Interacciones y portales

- `E` selecciona la acción contextual válida más cercana;
- soportar al menos sentarse, usar cafetera/barra y una acción de lectura o descanso;
- el actor debe desplazarse al anchor correcto antes de ejecutar si está a una casilla permitida; no teletransportar desde lejos;
- `F` entra/sale sólo frente a un portal válido;
- ciudad → Café → ciudad conserva agente, cámara, hora y estado;
- puerta ocupada debe resolverse sin superponer actores.

Salida: circuito caminar → entrar → usar → salir.

### Fase 7 — Migración completa del Café

- convertir todos los objetos espacialmente relevantes del Café al contrato modular;
- mantener microdetalle horneado donde sea correcto;
- integrar agentes principales y NPCs;
- retirar únicamente los parches de oclusión que el nuevo sistema reemplaza de manera demostrada;
- conservar decoración opcional y evitar placements sobre superficies inválidas;
- validar responsive y día/noche.

Salida: Café productivo modular, si pasa el gate.

### Fase 8 — QA independiente, correcciones y evidencia

- delegar a un agente de QA independiente que no haya escrito el núcleo del runtime;
- el agente de QA debe probar el juego físicamente en navegador, intentar romper colisiones, controles, foco, portales, ocupación y profundidad;
- el QA debe inspeccionar capturas a resolución original, no sólo métricas DOM;
- registrar defectos concretos con reproducción;
- corregir bloqueantes y volver a ejecutar el mismo guion;
- grabar un video corto final del recorrido completo;
- cerrar servidores y verificar puertos.

Salida: informe independiente, capturas y video.

### Fase 9 — Documentación y cierre

- actualizar `CURRENT_PROJECT_STATE.md` con sólo lo realmente verificado;
- actualizar `TASKS.md` y `docs/DECISIONS.md`;
- documentar controles en `README.md`/runbook;
- actualizar el espejo Obsidian canónico de Syka World;
- separar completado, provisional, pendiente y bloqueado;
- dejar explícito que casas/oficinas aún no tienen interiores modulares si sigue siendo cierto.

## 10. Prioridad bajo presupuesto limitado

### P0 — obligatorio

- contratos de entidad y walk grid;
- Café modular mínimo que supere el gate;
- clic para mover;
- Poseer + WASD;
- colisiones reales;
- `E` y `F`;
- transición ciudad/Café;
- actores sin atravesar objetos ni compartir anchors;
- pruebas automáticas y E2E físico;
- bridge GET-only;
- QA independiente.

### P1 — completar si P0 está estable

- migración del Café completo con máxima fidelidad;
- varias microacciones;
- pulido de cursores, indicadores y feedback;
- video limpio y comparación visual exhaustiva;
- accesibilidad con flechas.

### P2 — no abrir si amenaza P0/P1

- definiciones vacías para futuros interiores;
- más objetos decorativos;
- nuevas animaciones no esenciales;
- mejoras generales de UI no relacionadas;
- herramientas de edición de habitaciones.

No ampliar alcance para “gastar tokens”.

## 11. Pruebas obligatorias

### Unitarias

- conversión tecla → vecino isométrico;
- footprint y casillas bloqueadas;
- destino válido/inválido/inalcanzable;
- pathfinding con muebles;
- reserva/liberación de anchors;
- dos actores no terminan en la misma casilla;
- `E` sólo usa interacciones alcanzables;
- `F` sólo funciona frente a portal;
- liberar posesión replanifica desde la posición real;
- inputs de texto ignoran controles;
- save/load conserva ubicación y objetos, pero no reabre posesión.

### E2E físico en navegador

1. abrir Muestra y seleccionar Syka;
2. hacer clic en un destino exterior y comprobar recorrido real;
3. intentar clicar una casilla bloqueada por edificio/árbol y comprobar rechazo;
4. poseer a Syka y recorrer al menos un circuito WASD;
5. intentar caminar contra un obstáculo durante key repeat y confirmar que no lo atraviesa;
6. llegar a la puerta del Café y entrar con `F`;
7. caminar alrededor de barra, mesas, sillas y plantas;
8. pasar delante y detrás de la barra verificando profundidad;
9. usar `E` para sentarse;
10. usar `E` en la estación de café con anchor correcto;
11. probar humano, mascota y NPC simultáneos sin solapamiento;
12. liberar con `Esc` sin salir accidentalmente;
13. salir con `F`, `B` o botón permitido y conservar estado;
14. repetir tras guardar y recargar;
15. probar teclas con un input enfocado;
16. confirmar cero errores inesperados de página, consola, HTTP o assets;
17. auditar que todo tráfico al bridge sea GET sin cuerpo y que se hayan creado cero tareas Hermes.

### QA visual

- 1008×548, 1440×900 y 2560×1080;
- una resolución estrecha ya soportada por el proyecto;
- zoom relevante sin blur;
- humanos con escala consistente;
- mascotas con proporción propia;
- pies sobre el suelo, sombras de contacto y pivotes coherentes;
- ningún actor cortado por el borde incorrecto de un objeto;
- ningún actor por encima de toda la barra cuando debería estar detrás;
- mobiliario denso y calidez equivalentes a la referencia aprobada;
- UI de posesión clara y no invasiva;
- sin rectángulos gigantes de hotspot.

### Rendimiento

- medir ciudad e interior con agentes y NPCs activos;
- objetivo: conservar aproximadamente 55–60 FPS en la máquina actual;
- registrar regresión si existe; no ocultarla;
- carga local y bundle deben medirse o conservar su warning documentado.

## 12. Video final obligatorio

Por instrucción posterior y explícita de Sikora, grabar un video local de **20 segundos**. Debe condensar, sin cortes engañosos, evidencia visible de:

1. selección de agente;
2. clic para caminar en ciudad;
3. activación de Poseer;
4. movimiento WASD alrededor de un obstáculo;
5. entrada al Café con `F`;
6. paso delante/detrás de mobiliario;
7. interacción con `E`;
8. liberación con `Esc`;
9. salida a la ciudad, si entra dentro del montaje de 20 segundos;
10. ausencia de errores visibles.

Los pasos que no quepan de forma legible en esos 20 segundos deben seguir demostrados por el E2E físico, las capturas y el informe; no se acelera el video hasta volverlo ilegible.

Guardar el video y capturas bajo un directorio nuevo y explícito de `reports/`, junto con un informe JSON o Markdown que indique resolución, commit inexistente/worktree, comandos, fecha y resultado.

## 13. Criterio de finalización

La goal sólo puede marcarse completa si todos son verdaderos:

1. el juego sigue iniciando mediante el comando documentado;
2. las suites baseline continúan pasando o cada cambio esperado está justificado;
3. ciudad y Café usan un contrato coherente de movimiento;
4. un agente seleccionado camina a una casilla clicada mediante pathfinding;
5. Poseer funciona con WASD y muestra claramente el control activo;
6. `E` ejecuta interacciones contextuales reales;
7. `F` atraviesa portales válidos;
8. barra, mesas, sillas, paredes, plantas y actores bloquean/ocupan correctamente;
9. profundidad y escala pasan QA visual en al menos 1008×548 y 1440×900;
10. dos agentes y NPCs pueden coexistir sin solaparse;
11. guardar/recargar no corrompe la partida;
12. una tarea Hermes no puede iniciarse desde este flujo;
13. tráfico bridge observado es exclusivamente GET;
14. el evaluador independiente completa su guion y los bloqueantes encontrados fueron corregidos/retesteados;
15. existe video final reproducible;
16. documentación y espejo Obsidian reflejan el estado real;
17. no quedan servidores temporales abiertos;
18. la cafetería productiva no fue reemplazada por una versión visualmente peor.

No marcar completa porque se agotaron tokens. Si el gate visual impide integrar, dejar la goal activa o reportarla honestamente incompleta; conservar la producción vigente.

## 14. Reglas para el agente principal y el agente de QA

### Agente principal

- inspeccionar antes de editar;
- trabajar por contratos y pruebas pequeñas;
- evitar reescrituras masivas sin necesidad;
- reutilizar pathfinding, estado, anchors y tests que estén realmente sanos;
- no pedir al usuario decisiones que ya están congeladas aquí;
- informar temprano si una limitación artística hace imposible el gate, pero intentar hasta dos iteraciones razonables;
- mantener actualizaciones concisas durante una ejecución larga.

### Agente de QA independiente

- actuar principalmente en lectura y ejecución de pruebas;
- no aceptar como evidencia sólo una API de QA o una métrica interna;
- usar interacción física del navegador para mouse y teclado;
- inspeccionar imágenes a resolución original;
- probar rutas inválidas y key repeat agresivo;
- comparar Café viejo, laboratorio y resultado integrado;
- reportar PASS/FAIL por criterio con evidencia;
- puede proponer fixes, pero el agente principal conserva la coordinación para evitar ediciones concurrentes conflictivas.

## 15. Entregables

1. Runtime espacial modular en `app/game`.
2. Contratos tipados de escena, entidad, ocupación, portal e interacción.
3. Café Biblioteca migrado si pasa el gate.
4. Movimiento por clic exterior/interior.
5. Modo Poseer con mapa de teclas congelado.
6. Interacciones `E` y portales `F`.
7. Tests unitarios y E2E ampliados.
8. Informe de QA independiente.
9. Capturas limpias y capturas técnicas.
10. Video final.
11. Runbook actualizado.
12. `CURRENT_PROJECT_STATE.md`, `TASKS.md`, `docs/DECISIONS.md` y espejo Obsidian actualizados.
13. Informe final separado en: verificado, provisional, pendiente y riesgos.

## 16. Texto corto listo para iniciar

Usar GPT-5.0 en modo Max. Al crear la goal, asignar aproximadamente el 15% de los tokens disponibles en ese momento.

```text
/goal Lee por completo docs/GOAL_INTERIOR_ENTITY_AND_POSSESSION_PASS_V1.md y ejecútalo de forma autónoma hasta cumplir sus criterios. Implementa movimiento por clic, modo Poseer con WASD, E para interactuar, F para portales y un runtime modular de entidades/colisiones/profundidad para ciudad y Café Biblioteca. Preserva ciudad, bridge, simulación, economía, saves y arte aprobado; no reconstruyas todo el juego ni reemplaces el Café por algo visualmente inferior. Usa un agente independiente para QA físico y visual, genera capturas y video, mantén Hermes GET-only y no hagas commits, pushes, publicaciones ni tareas reales.
```
