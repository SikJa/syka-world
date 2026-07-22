# Syka World — Mechanic Integration Pass v1

Estado: ejecutado y verificado el 2026-07-16.

Fecha de definición: 2026-07-16.

Ventana de ejecución original (histórica):

- objetivo operativo: 60 minutos;
- margen para validación y cierre: 20 minutos;
- límite absoluto: 80 minutos desde el comienzo de la ejecución;
- a partir del minuto 60 no se abre ninguna línea nueva de trabajo;
- a partir del minuto 72 sólo se permiten pruebas, correcciones bloqueantes, documentación y cierre de procesos.

El usuario anuló expresamente este timebox para la ejecución realizada. El alcance se cerró por criterios de aceptación y evidencia; la especificación inferior se conserva como contrato histórico del pass.

Este documento define una etapa nueva sobre la Isometric Playable Alpha v1. No reabre el proyecto desde cero y no autoriza una reconstrucción completa del frontend.

## 1. Misión

Convertir la alpha visual actual en el primer circuito mecánico integrado de Syka World.

El resultado demostrable debe permitir:

1. iniciar una Nueva partida;
2. ver a los cuatro agentes moverse aunque todavía falten destinos;
3. elegir un lugar razonable para el Café Biblioteca;
4. entender en el fantasma qué terreno, vegetación y conexión vial utilizará;
5. construirlo sin superponer árboles ni objetos;
6. crear automáticamente un acceso hasta la carretera existente;
7. pagar Lúmenes para acelerar la obra;
8. completar la cafetería y verla reconocida por las rutinas aunque su ID sea generado;
9. ordenar localmente a un agente que vaya al café;
10. verlo caminar, entrar, ubicarse en un punto interior y realizar una acción sencilla;
11. comprar y colocar objetos exteriores desde Construir;
12. observar una diferencia correcta entre luz de día, atardecer y noche;
13. mejorar la cafetería y ver un cambio visual identificable;
14. guardar, recargar y recuperar edificios, carreteras, objetos y ubicación de agentes.

Esta es una vertical slice. Debe preferirse un circuito pequeño, verdadero y verificable antes que una gran cantidad de botones o contenido simulado.

## 2. Fuentes obligatorias y orden de autoridad

Antes de editar, leer por completo:

1. este documento;
2. CURRENT_PROJECT_STATE.md;
3. TASKS.md;
4. docs/DECISIONS.md;
5. docs/VISUAL_STYLE_GUIDE.md;
6. docs/ALPHA_RUNBOOK.md;
7. app/game/src/core/contracts.ts;
8. app/game/src/core/state.ts;
9. app/game/src/core/construction.ts;
10. app/game/src/core/map.ts;
11. app/game/src/core/simulation.ts;
12. app/game/src/presentation/city/decor.ts;
13. app/game/src/presentation/scenes/CityScene.ts;
14. app/game/src/presentation/scenes/CafeInteriorScene.ts;
15. app/game/src/ui/createAlphaUi.ts.

Si existe contradicción, prevalecen:

1. las instrucciones explícitas más recientes del usuario;
2. este documento;
3. CURRENT_PROJECT_STATE.md y docs/DECISIONS.md;
4. el comportamiento confirmado del código actual;
5. documentación histórica de la alpha;
6. supuestos del agente.

No asumir que una prueba histórica demuestra el comportamiento actual. La prueba manual del usuario del 2026-07-16 encontró huecos reales que deben reproducirse.

## 3. Restricciones innegociables

- La raíz canónica es F:\Coding Proyects\Syka World Game.
- Preservar cambios existentes del usuario.
- No hacer commits, pushes, publicaciones ni despliegues.
- No instalar una app de escritorio ni configurar inicio automático.
- No iniciar tareas reales en Hermes.
- Mantener el bridge estrictamente GET-only.
- No cerrar Hermes ni modificar perfiles.
- No copiar assets de otros juegos.
- No incorporar dependencias o assets externos sin necesidad y licencia clara.
- Conservar Phaser, TypeScript, Vite, cámara isométrica fija, pan y zoom sin rotación.
- Conservar la dirección pixel art, escala, nitidez y calibraciones visuales aprobadas.
- No reintroducir rotaciones falsas de edificios.
- No modificar necesidades, misiones o relaciones en esta ejecución.
- No crear chat, LLMs, tareas reales ni autonomía de personajes.
- No crear todavía NPCs nuevos, bartender, clientes recurrentes ni arte final de avatares.
- No presentar placeholders como personajes definitivos.
- No marcar completo por agotamiento de tiempo.
- No dejar servidores temporales abiertos.

## 4. Alcance cerrado y elementos aplazados

### Sí entra

- corrección de rutinas y bindings en Nueva partida;
- movimiento ambiental mínimo cuando faltan destinos;
- progreso de ciudad realmente conectado;
- construcción sobre terreno con vegetación;
- preview y creación automática de un conector vial;
- aceleración de obras con Lúmenes;
- cambio visual de la mejora del café;
- orden espacial local para los cuatro agentes;
- entrada, permanencia y salida del Café Biblioteca;
- acciones interiores predefinidas;
- objetos exteriores comprables, colocables y persistentes;
- corrección del sistema de iluminación;
- reorganización profesional y acotada de la UI;
- pruebas unitarias, navegador, capturas y documentación.

### No entra

- necesidades de energía, concentración, ánimo, sociabilidad o comodidad;
- misiones;
- relaciones entre agentes;
- economía final o balance definitivo;
- NPC bartender;
- clientes NPC;
- los otros cinco interiores jugables;
- mascotas o avatares finales;
- chat individual;
- tareas Hermes bidireccionales;
- sistema completo de carreteras manuales;
- zoning de manzanas de uno, dos o tres edificios;
- decenas de variantes residenciales;
- empaquetado o publicación.

### Preparación mínima para NPCs futuros

El modelo interior puede reservar roles y estaciones semánticas:

- entry;
- counter-service;
- coffee-machine;
- table-seat;
- bookcase;
- fireplace;
- bartender-station.

No debe renderizarse un bartender ni simularse un NPC. Durante esta versión, la acción de café puede expresarse como “Servirse un café”. El contrato debe permitir reemplazarla luego por “Pedir al bartender” sin rehacer navegación, anchors o persistencia.

## 5. Defectos confirmados que esta goal debe tratar

### 5.1 Agentes quietos en Nueva partida

Muestra utiliza IDs conocidos como cafe-main y community-main. La construcción normal genera IDs como building-1. Las rutinas todavía apuntan a IDs fijos, por lo que un café construido por el jugador no se convierte en destino real.

Además, cuando falta un destino, el agente puede permanecer indefinidamente en su posición.

### 5.2 Progresión desconectada

Existe addTownXp, pero la progresión debe quedar conectada a acciones reales. Sin XP efectivo, los edificios de nivel 2 pueden quedar inaccesibles en una Nueva partida.

### 5.3 Vegetación no física

Árboles, arbustos, bancos y farolas actuales se derivan de un plan visual procedural. No forman parte del estado persistido ni de las reglas de colisión. Por eso el fantasma puede aparecer sobre un árbol.

### 5.4 Construcción demasiado dependiente de carreteras preexistentes

El acceso debe enfrentar una carretera ya pintada. El mapa inicial ofrece muy pocos puntos válidos y la UI no explica suficientemente el motivo.

### 5.5 Interior sólo inspeccionable

Los hotspots actuales muestran etiquetas como “Zona de mesas” y generan inspección, pero no ofrecen acciones espaciales. Los agentes llegan a un acceso exterior; no existe todavía una presencia interior visible y persistente.

### 5.6 Iluminación genérica

Faroles y luces de edificios comparten una curva global. Durante el día queda alpha residual y algunos efectos producen conos o manchas demasiado grandes.

### 5.7 Mejora del café poco visible

El upgrade cambia estado y visualVariant, pero el renderer debe demostrar una variante visible y no depender sólo de una insignia o texto.

## 6. Arquitectura mínima esperada

Mantener las capas:

Hermes GET-only → bridge → core determinista → controlador → presentación Phaser/UI.

La implementación debe extender contratos del core, no guardar verdad jugable sólo en objetos Phaser o elementos del DOM.

### 6.1 Identidad funcional de edificios

Resolver destinos por función y estado, no por un ID mágico.

Requisitos:

- un registro o resolver determinista encuentra el primer edificio completo apto por kind;
- café: primer cafe completo disponible;
- comunidad: primer community-hall completo;
- Elen: primer marketing-office completo;
- Astrelis: primer commercial-office completo;
- Zerny: primer crm-workshop completo;
- Syka puede usar home o community-hall como workplace local hasta una decisión posterior;
- los hogares conservan asignación explícita cuando exista;
- al completar, cargar o mejorar un edificio se recalculan bindings sin perder identidad;
- si existen varios candidatos, usar una regla estable documentada;
- no renombrar instancias del jugador para fingir compatibilidad.

### 6.2 Ubicación espacial de agentes

Extender el estado con una representación clara y persistible:

- exterior sobre una tile;
- transitando hacia una entrada;
- interior de un buildingId;
- anchor interior opcional;
- acción local opcional;
- destino y ruta separados de actividad Hermes.

El estado Hermes nunca debe reemplazar la ubicación. Una tarea puede influir en el destino laboral, pero no teletransportar.

### 6.3 Objetos del mundo

Agregar un contrato renderer-agnostic de objetos exteriores persistentes.

Cada instancia debe incluir como mínimo:

- instanceId;
- definitionId;
- hostTile;
- orientación o variante cuando corresponda;
- estado de colocación;
- lightSource opcional;
- removable;
- provenance o categoría de catálogo cuando sea necesario.

Los detalles mínimos de césped pueden seguir siendo procedurales y no bloqueantes. Árboles, arbustos grandes, bancos, jardineras y farolas deben convertirse en objetos físicos.

Los saves anteriores sin esta colección deben migrar de forma explícita y determinista o cargarse con un valor seguro. No cambiar silenciosamente el esquema sin prueba.

## 7. Fase 1 — Integración fundamental

Prioridad P0.

### Trabajo

1. Reproducir Nueva partida sin alterar el save del usuario.
2. Cubrir con tests el caso de un café construido con ID generado.
3. Reemplazar bindings mágicos por resolución funcional.
4. Hacer que la finalización de edificios aporte XP de ciudad una sola vez.
5. Definir cantidades pequeñas y documentadas de XP:
   - edificio completado: base por coste o tamaño;
   - mejora completada: XP adicional;
   - objeto exterior: no debe permitir farm de XP.
6. Desbloquear correctamente nivel 2 al alcanzar el umbral ya existente.
7. Añadir movimiento ambiental determinista sobre la red alcanzable cuando el destino de rutina no existe.
8. Evitar jitter, teletransporte y movimiento fuera de carretera.
9. Conservar reconciliación Hermes y GET-only.

### Criterios

- En Nueva partida los cuatro agentes no permanecen superpuestos e inmóviles todo el día.
- Un café building-N completo es reconocido como café por los cuatro.
- Elen, Astrelis y Zerny reconocen sus oficinas cuando se construyen.
- Completar edificios incrementa XP una sola vez.
- Guardar/cargar no duplica XP ni cambia bindings de forma aleatoria.
- Muestra no pierde sus rutinas actuales.

## 8. Fase 2 — Construcción inteligente y carreteras

Prioridad P0.

### Objetos y vegetación

Separar:

- microdetalle procedural no bloqueante: briznas, trébol, hojas, piedras pequeñas;
- objeto físico: árbol, arbusto, seto, jardinera, banco y farola.

Al previsualizar un edificio:

- ningún objeto físico puede quedar oculto sin explicación;
- los objetos removibles afectados se resaltan;
- la UI muestra “Se retirarán X objetos”;
- el coste adicional, si existe, aparece antes de confirmar;
- no se cobra nada hasta confirmar;
- objetos especiales no removibles bloquean con un motivo legible.

Para v1 se permite retirar automáticamente vegetación común al confirmar. No se permite superposición silenciosa.

### Conector vial automático v1

No implementar todavía el sistema completo de manzanas.

Implementar un conector corto y determinista:

1. el jugador elige el origen del edificio;
2. el fantasma muestra huella, acceso y ruta propuesta;
3. la ruta une accessTile con la carretera desbloqueada más cercana;
4. evita huellas, agua, roca, sectores bloqueados y objetos no removibles;
5. puede retirar vegetación común sólo si se muestra en el preview;
6. el coste total incluye carretera y limpieza;
7. ninguna tile de carretera invade occupiedTiles;
8. si no existe ruta válida, la UI explica el motivo;
9. el pathfinding de agentes puede usar el conector inmediatamente;
10. las reglas son deterministas y se guardan.

Precio provisional recomendado: 3 Lúmenes por tile de carretera. Puede ajustarse sólo si la prueba demuestra que imposibilita construir el primer café con el saldo inicial.

No ampliar el mapa ni alterar la orientación artística north en este pass.

### Criterios

- El café puede colocarse en más de una franja razonable del mapa inicial.
- La captura del usuario con el árbol ya no puede ocurrir silenciosamente.
- Preview y resultado final usan exactamente la misma ruta y costes.
- Cancelar no cambia saldo, vegetación o carretera.
- Confirmar cambia todo de forma atómica.
- Save/load conserva carretera y objetos retirados.

## 9. Fase 3 — Construcción, aceleración y mejora visible

Prioridad P0.

### Acelerar obras

Agregar dos acciones de juego, no de QA:

- Acelerar 1 hora;
- Terminar ahora.

Reglas:

- precio visible antes de confirmar;
- coste basado en minutos restantes;
- redondeo documentado;
- nunca puede producir saldo negativo;
- no usa dinero real;
- no modifica el reloj global;
- respeta transición de etapas;
- completar por aceleración dispara exactamente los mismos efectos, XP, furnishing y bindings que completar por tiempo;
- el botón QA existente sigue separado y visible sólo con qa=1.

Fórmula inicial recomendada:

- 4 Lúmenes por cada hora restante, redondeada hacia arriba;
- Acelerar 1 hora cuesta 4 Lúmenes o el proporcional final si resta menos;
- Terminar ahora muestra el coste total calculado.

### Mejora visible de cafetería

El visualVariant debe participar de la selección real del sprite o de una composición visual clara.

La mejora “Rincón de lectura” debe mostrar al menos dos cambios legibles desde la ciudad, por ejemplo:

- volumen lateral o pequeño anexo;
- toldo, cartel o ventana adicional;
- jardín, libros o iluminación exterior asociada.

No basta con:

- texto “nivel 2”;
- halo genérico;
- badge;
- cambio sólo en el inspector.

La variante debe mantener huella, separación de carretera, depth sorting y calidad pixel art.

### Criterios

- ambas opciones descuentan correctamente;
- saldo insuficiente impide acelerar;
- los tres estados de obra siguen observables;
- completar normalmente y pagar para completar producen el mismo estado final;
- existen capturas antes/después de la mejora del café;
- el gate de separación raster continúa pasando.

## 10. Fase 4 — Loop espacial de agentes e interior

Prioridad P0.

### Orden local

Implementar una orden espacial local y predefinida:

Seleccionar agente → Ir al Café.

No es una tarea Hermes, no consume API y no autoriza trabajo real.

Flujo:

1. seleccionar Syka, Elen, Astrelis o Zerny;
2. elegir Ir al Café;
3. resolver un café completo;
4. caminar por carretera hasta su accessTile;
5. alcanzar la entrada sin teletransporte;
6. pasar a estado interior;
7. aparecer en el anchor entry;
8. desplazarse a un anchor de acción;
9. ejecutar una acción local;
10. poder salir y recuperar posición exterior coherente.

### Acciones interiores v1

Como mínimo:

- Sentarse;
- Leer;
- Servirse un café;
- Volver a la ciudad.

Si el tiempo lo permite:

- Calentarse junto a la chimenea;
- Conversar cuando dos agentes ocupan una misma zona.

Las acciones son deterministas y cortas. No alteran necesidades, relaciones o misiones.

### Interacción visual

- eliminar etiquetas permanentes o debug-like como “Zona de mesas”;
- no dibujar rectángulos gigantes;
- hover sólo produce un glow, outline o cursor discreto sobre el objeto real;
- click abre acciones contextuales útiles;
- asientos ocupados no aceptan dos agentes;
- la ocupación debe seguir existiendo aunque el jugador vuelva a la ciudad;
- al reabrir el café, el agente sigue en su anchor.

### Criterios

- al menos un agente completa exterior → puerta → interior → asiento/acción → salida;
- el mismo flujo funciona en Nueva partida con un café building-N;
- no se considera “dentro” mientras sigue visible detenido en la calle;
- guardar/cargar conserva interior, anchor y acción de forma segura;
- ocultar agentes no pausa el loop;
- Muestra sigue funcionando.

## 11. Fase 5 — Objetos exteriores comprables

Prioridad P1 obligatoria dentro de esta vertical slice.

Agregar una categoría Exterior dentro de Construir.

Catálogo inicial, reutilizando los assets originales ya existentes:

| Objeto | Precio inicial | Regla |
|---|---:|---|
| Flores silvestres | 4 L | pasto libre, no bloquea edificios después de aviso |
| Arbusto redondo | 8 L | pasto libre, objeto físico |
| Arbusto con flores | 10 L | pasto libre, objeto físico |
| Seto corto | 12 L | pasto libre, objeto físico |
| Jardinera | 14 L | pasto o borde apto, objeto físico |
| Banco | 16 L | pasto junto a carretera o sendero |
| Farola | 24 L | pasto junto a carretera, luz nocturna compacta |
| Árbol redondo | 20 L | pasto libre, objeto físico |
| Árbol alto | 22 L | pasto libre, objeto físico |

Los precios son balance alpha y deben quedar versionados, no tratados como economía final.

### Flujo

1. abrir Construir;
2. elegir Edificios o Exterior;
3. seleccionar objeto;
4. ver fantasma a escala real;
5. recibir razón verde/roja exacta;
6. confirmar y pagar;
7. seleccionar el objeto colocado;
8. poder retirarlo con confirmación.

Regla de retiro v1:

- devolver 50% del precio, redondeado hacia abajo;
- no dar XP;
- no permitir duplicación de saldo mediante save/load.

No crear nuevos sprites si los assets actuales cubren el catálogo. Si falta una orientación de banco o farola, reducir variantes antes de generar arte inconsistente.

### Criterios

- comprar al menos árbol, arbusto, flores, banco y farola funciona;
- todos aparecen en profundidad correcta;
- no se superponen edificios, roads u objetos físicos;
- farola se apaga de día y se ilumina de noche;
- guardar/cargar conserva colocación y saldo;
- retirar aplica el reembolso una sola vez.

## 12. Fase 6 — Iluminación y UI profesional acotada

Prioridad P1.

### Iluminación

Separar curvas por familia:

1. ventanas;
2. farolas;
3. ambiente interior/exterior de edificio.

Contrato visual:

- día: pools y conos exteriores en alpha 0; ventanas sin halo;
- atardecer: ventanas cálidas y pools pequeños;
- noche: intensidad mayor pero localizada;
- ninguna luz cruza una carretera como triángulo gigante;
- ninguna farola ilumina desde el centro de la calle;
- el pool sigue a su fuente;
- no tapar agentes, entradas o UI.

Crear capturas comparables de:

- 12:00;
- 18:30;
- 22:00;
- exterior con farola comprada;
- Café Biblioteca antes y después de upgrade.

### UI

No rehacer todo el diseño. Reorganizar los flujos que intervienen en esta goal:

- barra superior compacta: Lúmenes, hora, velocidad y modo bridge;
- catálogo Construir como drawer o bandeja contextual;
- pestañas Edificios y Exterior;
- tarjeta clara de coste, huella/regla y disponibilidad;
- preview con desglose de edificio, carretera y limpieza;
- inspector contextual sólo cuando existe selección;
- chips compactos de Syka, Elen, Astrelis y Zerny con actividad y destino;
- acciones espaciales desde la selección del agente;
- acciones interiores desde el objeto real;
- progreso de obra y aceleración en el inspector;
- mensajes cortos, en español y sin vocabulario técnico.

Mantener la ciudad como protagonista. Los paneles no pueden ocupar permanentemente grandes laterales ni ocultar la zona de juego.

Validar como mínimo:

- 1008×548;
- 1440×900;
- 2560×1080.

## 13. Estrategia de tiempo

El agente debe registrar hora de inicio y consultar el tiempo transcurrido después de cada gate. El límite es de ejecución, no una invitación a esperar.

### Minutos 0–5

- leer documentación requerida;
- revisar git status sin limpiar cambios;
- ejecutar baseline rápido;
- reproducir Nueva partida;
- registrar defectos exactos.

### Minutos 5–20

- Fase 1;
- tests unitarios focalizados;
- no tocar UI salvo lo imprescindible.

### Minutos 20–35

- contratos de world objects;
- colisión/limpieza;
- conector vial automático;
- catálogo Exterior básico.

### Minutos 35–50

- acelerar obras;
- binding post-construcción;
- orden Ir al Café;
- entrada y acción interior mínima.

### Minutos 50–60

- mejora visible;
- iluminación;
- UI de los flujos nuevos.

### Minutos 60–72

- congelar features;
- completar sólo criterios P0 faltantes;
- ejecutar tests, navegador y capturas;
- corregir regresiones.

### Minutos 72–80

- no abrir código nuevo salvo una corrección que impida build o cierre;
- cerrar servidores temporales;
- actualizar documentos y espejo Obsidian;
- escribir informe honesto;
- entregar lo logrado y listar lo pendiente.

Si una tarea consume más de ocho minutos sin producir un cambio verificable:

1. detener esa vía;
2. registrar el bloqueo;
3. elegir la implementación mínima compatible con la arquitectura;
4. conservar pruebas y estado estable;
5. continuar con el siguiente criterio de mayor prioridad.

## 14. Orden de recorte si falta tiempo

No se elimina ningún frente silenciosamente. Se reduce profundidad en este orden:

1. conversación junto a la chimenea;
2. variantes adicionales de flores/arbustos;
3. segunda orientación de banco;
4. reembolso visual animado;
5. animación compleja de preparar café;
6. refinamiento ornamental adicional de la UI;
7. capturas en resoluciones extra.

No recortar:

- bindings dinámicos;
- movimiento en Nueva partida;
- no superponer árboles;
- preview de carretera;
- carretera automática mínima;
- acelerar construcción;
- un flujo real de entrada al café;
- objetos Exterior persistentes;
- corrección del cono gigante;
- save/load;
- tests y cierre de procesos.

## 15. Validación obligatoria

### Unitarias

Agregar o actualizar tests para:

- resolver building-N por función;
- XP una sola vez;
- movimiento sin destino;
- world objects y colisiones;
- limpieza atómica;
- ruta vial determinista;
- coste total;
- aceleración;
- visualVariant;
- ubicación interior;
- asiento ocupado;
- compra/retiro de objetos;
- migración/save/load.

### Técnica

Desde app/game:

- npm run typecheck;
- npm test;
- npm run build.

La suite Python histórica sólo se ejecuta si hubo cambios en bridge, contratos compartidos o queda tiempo. No modificar bridge para cumplir este goal.

### Navegador físico

La validación principal no puede saltarse la UI llamando una API QA para colocar el edificio.

Recorrido mínimo:

1. abrir Nueva partida limpia;
2. comprobar movimiento ambiental;
3. abrir Construir;
4. elegir café;
5. mover fantasma sobre árbol y ver aviso;
6. elegir parcela sin carretera adyacente;
7. confirmar preview con conector;
8. acelerar y completar;
9. seleccionar agente;
10. ordenar Ir al Café;
11. ver entrada y acción interior;
12. volver;
13. comprar árbol, banco y farola;
14. comprobar día/noche;
15. mejorar cafetería;
16. guardar, recargar y verificar estado.

También ejecutar un smoke test de Muestra.

### Visual

Capturas mínimas:

- Nueva partida inicial con agentes separados;
- fantasma sobre árbol con feedback;
- preview de carretera;
- obra en progreso;
- café completo;
- agente dentro del café;
- catálogo Exterior;
- farola de día y de noche;
- café nivel 1 y nivel 2;
- 1008×548 y 1440×900.

No afirmar equivalencia con referencias visuales; evaluar coherencia con el kit actual.

## 16. Criterios de finalización

La goal sólo puede marcarse completa si:

1. el build pasa;
2. las pruebas nuevas y anteriores relevantes pasan;
3. Nueva partida muestra vida ambiental;
4. un café con ID generado es destino real;
5. un árbol nunca queda silenciosamente debajo de una construcción;
6. existe un conector vial automático visible antes de confirmar;
7. acelerar consume Lúmenes y completa mediante la misma lógica;
8. un agente entra realmente al interior y ocupa un anchor;
9. desaparecieron labels interiores debug-like;
10. los objetos Exterior son comprables y persistentes;
11. la farola respeta día/noche;
12. el cono gigante está ausente;
13. la mejora del café cambia el arte visible;
14. save/load recupera el circuito;
15. el bridge sigue GET-only;
16. no se inició ninguna tarea Hermes;
17. no quedaron puertos temporales abiertos;
18. CURRENT_PROJECT_STATE.md, TASKS.md, docs/DECISIONS.md y Obsidian están actualizados;
19. existe un informe de ejecución con evidencia y límites.

Si el límite de 80 minutos llega antes:

- detener implementación;
- no afirmar que está completo;
- dejar build estable si es posible;
- documentar cada criterio como PASS, FAIL o NO EJECUTADO;
- indicar el siguiente cambio exacto;
- cerrar procesos.

## 17. Entregables

- cambios en app/game;
- tests focalizados;
- recorrido E2E reproducible;
- capturas en reports/e2e/mechanic-integration-v1/screenshots;
- reports/e2e/mechanic-integration-v1/MECHANIC_INTEGRATION_E2E.md;
- reports/mechanic-integration-v1/MECHANIC_INTEGRATION_FINAL_REPORT.md;
- actualización de CURRENT_PROJECT_STATE.md;
- actualización de TASKS.md;
- actualización de docs/DECISIONS.md;
- espejo de Obsidian sincronizado.

## 18. Texto corto para iniciar

Seleccionar GPT-5.0 y modo Max. Después enviar:

    /goal Lee por completo docs/GOAL_MECHANIC_INTEGRATION_PASS_V1.md y ejecútala autónomamente sobre la alpha actual. Implementa sus seis fases y el catálogo Exterior como una vertical slice integrada: Nueva partida con agentes vivos, construcción consciente de vegetación, conector vial automático, aceleración con Lúmenes, mejora visible del café, orden local Ir al Café con entrada/interacción interior, iluminación correcta, UI contextual y save/load. No crees NPCs todavía; deja preparado el contrato para un futuro bartender. Objetivo 60 minutos y límite absoluto 80: desde el minuto 60 congela features y antes del 80 valida, documenta y cierra procesos. No hagas commits, pushes, deploys ni tareas Hermes; conserva el bridge GET-only y reporta honestamente cualquier criterio incompleto.

No agregar un presupuesto artificial de tokens. La restricción principal de esta ejecución es el tiempo y el resultado verificable.
