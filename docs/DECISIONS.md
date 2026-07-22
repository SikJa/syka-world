# Decisiones de Syka World

Última actualización: 2026-07-20 — Café Biblioteca Safe Floor v2 integrado.

## Confirmadas

- Syka World es un proyecto personal/hobby y evolutivo.
- Hermes sigue siendo el lugar principal de trabajo; el juego observa, no reemplaza su ejecución.
- La integración inicial es pasiva y visual, limitada a GET.
- La vida ambiental inicial es local y predefinida, sin consumo de LLM.
- Personajes iniciales: Syka (`default`), Elen (`elen`), Astrelis (`astrelis`) y Zerny (`zerny`).
- La primera entrega es web local; empaquetado/inicio automático quedan para una decisión futura.
- Órdenes visuales y tareas reales son contratos separados.
- El mundo sólo muestra resúmenes breves y sanitizados; nunca prompts completos, razonamiento, argumentos o resultados sensibles.
- Las pets actuales son semillas de identidad; los world avatars definitivos son assets separados.
- `F:\Coding Proyects\Syka World Game` es la raíz canónica.
- El frontend consume contratos versionados del bridge, no formatos internos de Hermes.
- La cámara de ciudad permite pan y zoom, nunca rotación.
- Entrar a un edificio abre una escena interior aislada; no se levanta el techo sobre la ciudad.
- Los edificios terminados aparecen amueblados; la personalización posterior es opcional.
- El jugador decide la distribución urbana; no hay plaza central obligatoria.

## ADR Foundations v1

1. **Plugin primero, SQLite como fallback.** Los hooks públicos tienen autoridad; SQLite se abre en sólo lectura y toma únicamente metadatos de lifecycle Desktop.
2. **Agregación por sesión.** La identidad de concurrencia es `(perfil, sesión)`; `waiting` domina, luego actualización más nueva e ID como desempate.
3. **Checkpoint atómico.** El reinicio restaura reducer, fuentes y cursores; corrupción produce replay seguro y diagnóstico.
4. **Capas reemplazables.** Hermes, bridge, simulación y presentación sólo comparten contratos versionados.
5. **Progreso sin Hermes.** Rutinas, comunidad y misiones locales permiten avanzar sin trabajo real.
6. **Sin castigo productivista.** Fallos, interrupciones y días sin tareas no descuentan moneda.
7. **Retención reversible.** No existe borrado automático; primero dry-run, luego archivo con checksum y restauración.
8. **Avatares abiertos.** Los placeholders no fijan pets, especies ni proporciones finales.

## ADR Isometric Playable Alpha v1

9. **Aplicación nueva.** `app/game` es la alpha jugable; `lab/visual` se conserva como experimento histórico y no se promueve.
10. **Renderer medido.** Phaser 4.2.1 + TypeScript + Vite, `Phaser.AUTO` con WebGL disponible, pixelArt/nearest-neighbor y proyección isométrica propia.
11. **Dos modos.** Muestra valida arte/sistemas; Nueva partida valida progreso, compra y construcción.
12. **Kit raster provisional.** Los assets generados son modulares, manifiestos y documentados; se aprueban para alpha, no como arte final.
13. **Guardado local versionado.** `syka.world.save.v1` vive en localStorage bajo namespace `syka-world.`; sólo migra versiones explícitamente soportadas.
14. **QA aislado.** `?qa=1` acelera reloj, obras y saldo local, muestra su carácter de prueba y nunca envía acciones a Hermes.
15. **Bridge GET-only.** Estado y eventos se leen por proxy `/bridge`; la caída cambia a simulated/degraded/offline y no detiene el juego.
16. **Interior de alta densidad.** El Café Biblioteca usa madera, libros, chimenea, cocina/barra, mesas, plantas, vajilla y ciudad atenuada por la ventana.
17. **Correcciones ambientales vinculantes.** Farolas y bancos se apoyan en pasto junto a caminos, los bancos son pequeños/alineados, el césped usa microdetalle sutil y no se incluye una fuente pública deficiente.
18. **No provocar una tarea real para QA.** La validación viva observa los cuatro perfiles por GET; un POST manual o una tarea iniciada por el test no cuentan como prueba válida.
19. **Aprobación visual acotada.** El QA final aprueba la alpha con 86,2/100; avatares, kit y pulido restante continúan provisionales.
20. **Evidencia antes que afirmación.** Tests, E2E, visual, rendimiento y cierre de puertos se registran por separado; pasar unit tests no sustituye navegador o capturas.
21. **Huellas calibradas por familia.** Los seis edificios usan huellas y offsets propios; Casa acogedora ocupa 4×3. La única orientación visual real es `north` y no se ofrece una rotación falsa sin sprites equivalentes.
22. **Viewport lógico adaptativo.** La escena conserva alto lógico 450 y calcula un ancho de 720–1080 según el aspect ratio. El shell es contextual y responsive, validado en 1008×548, 1440×900 y 2560×1080, sin deformar el pixel art.
23. **Cámara coherente.** El exterior usa bias vertical 12 y conserva el mismo marco al hacer pan, zoom o regresar desde un interior.
24. **Interior sin overlays invasivos.** La escena interior es responsive y sus interacciones usan hotspots localizados, no rectángulos visibles permanentes.
25. **Tiempo espacial determinista inicial.** La alpha partió de 3 minutos por tile y simulación minuto a minuto para saltos grandes. El Café Actor Runtime follow-up conserva la equivalencia pero reemplaza la cadencia por la decisión 51.
26. **Caminar no es trabajar.** Ruta, destino y ubicación se distinguen de actividad laboral; ubicación y ocupantes deben ser legibles, y un workplace no construido bloquea trabajo y ocupación.
27. **Reconciliación conservadora.** Bootstrap y reconexión parten del snapshot y después aplican eventos nuevos. Una completion se conserva durante el viaje hasta la llegada al workplace, sin convertir el trayecto en trabajo.
28. **Seeds válidos y saves defensivos.** Los nueve edificios de Muestra deben entrar completos y reservar sólo terreno construible; un save con una huella sobre carretera se rechaza para no reintroducir geometría visualmente corrupta.
29. **La separación visual se valida sobre el raster.** Un gate de huellas/`occupiedTiles` no demuestra distancia visible: el contacto provenía de anchos de dibujo de 100–106% de parcela aunque la grilla fuese válida. El fix no cambia huellas ni roads; calibra tamaño y offset runtime.
30. **Calibración runtime canónica.** Home `92×98 [-8,-10]`, café `118×116 [-11,-13]`, marketing `112×110 [-5,-15]`, comercial `108×106 [-2,-14]`, taller `118×106 [-8,-18]` y hall `117×108 [-7,-16]`.
31. **Gate de clearance físico.** `app/game/e2e/visual_road_clearance_e2e.py` mide componentes de alfa en contacto con suelo y exige al menos un píxel real de pasto. La pasada vigente es 9/9: homes 3, café 5, marketing 4, comercial 2, taller 2 y hall 2 px de distancia de máscara.
32. **QA sin mutar Hermes.** La validación de navegador y el gate raster usan bridge GET-only controlado; no crean tareas ni modifican el bridge. La aprobación manual del usuario sigue pendiente.

## ADR Mechanic Integration Pass v1

33. **Bindings por función, no por ID mágico.** Los edificios creados por el jugador deben convertirse en destinos por su kind y estado completo; IDs como cafe-main sólo pueden ser seeds, nunca el contrato de rutina.
34. **Vegetación física separada de microdetalle.** Árboles, arbustos grandes, bancos, jardineras y farolas son objetos persistentes y participan de colisiones. Briznas, hojas y piedras pequeñas pueden seguir siendo decoración procedural no bloqueante.
35. **Sin superposición silenciosa.** Construir sobre vegetación común exige preview, coste y confirmación de retiro. Los objetos no removibles bloquean con una razón visible.
36. **Carretera automática v1 como conector.** El primer pase propone una ruta corta desde el acceso del edificio hasta la red existente. Las manzanas MiniTown y el editor vial completo quedan para después.
37. **Aceleración local, no monetización móvil.** Se puede acelerar una hora o terminar una obra pagando Lúmenes con coste transparente, sin dinero real y usando la misma completion que el reloj.
38. **Interior basado en anchors.** Entrada, barra, cafetera, asientos, biblioteca y chimenea son destinos semánticos persistentes. Las etiquetas de depuración no son interacción final.
39. **NPCs aplazados dentro de este pass.** El Mechanic Integration Pass conserva a los cuatro agentes existentes y sólo prepara una bartender-station compatible. La decisión histórica fue superada después por una aprobación explícita para el Café Actor Runtime follow-up.
40. **Profundidad antes que más edificios.** Los seis tipos actuales son suficientes para este corte; se priorizan interacción, carreteras, objetos y UI.
41. **Sistemas diferidos.** Necesidades, misiones y relaciones se preservan en diseño, pero no se implementan ni exponen en este pass.
42. **Timebox vinculante (histórico, superado para esta ejecución).** El plan original apuntaba a 60 minutos y cortaba a los 80. El usuario anuló expresamente ese límite antes del cierre del pass; por ello esta ejecución se cerró por criterios de aceptación y evidencia, no por reloj. Esta excepción no convierte tiempo agotado en completitud ni modifica futuros timeboxes sin una nueva decisión explícita.
43. **Un plan gobierna preview y commit.** La previsualización y la colocación consumen el mismo resultado de planificación: huella, acceso, conector, objetos retirados y desglose de costes. Cancelar no muta terreno, saldo u objetos.
44. **Exterior persistente y reversible.** El catálogo ofrece nueve objetos físicos. Los objetos adquiridos pueden retirarse con reembolso único del 50%; la microfauna y el microdetalle no son inventario ni colisión.
45. **Ubicación espacial persistente.** Un agente puede estar en exterior, tránsito o interior. Los anchors interiores se reservan para evitar solapamientos y la salida devuelve al agente al tile de acceso, sin teletransporte silencioso.
46. **Luz por familia y período.** Ventanas, edificios y farolas no comparten un cono genérico. Las farolas se apagan de día y usan pools pequeños/localizados al atardecer y de noche.
47. **Conceptos NPC fuera del runtime.** `Asset/NPCs/Cafe-Cohort-v0.1` conserva cinco identidades y tres imágenes como dirección de arte. Esos archivos no se cargan directamente en el juego; un derivado posterior sólo puede entrar con atlas, manifest y provenance propios.

## ADR Café Actor Runtime follow-up

48. **NPCs locales, no perfiles Hermes.** Alma, Beni, Iara, Milo y Noa viven en `game.npcs`, siguen rutinas deterministas y nunca reciben perfil, sesión, recompensa, tarea ni estado del bridge.
49. **Derivado runtime trazable.** El atlas aprobado se generó a partir de la identidad conceptual, se corrigió con transparencia y se normalizó a un contrato estricto de 5 columnas × 4 filas, celdas 128×160 y pivote común. El runtime carga sólo `cafe-npcs-atlas-v1.png`.
50. **Escala y superficies semánticas.** Protagonistas y NPC usan alturas responsive legibles. La decoración opcional declara superficie; los helechos sólo ocupan slots de piso seguros y no mesas, sillones u otras plantas.
51. **Movimiento continuo y entrada coherente.** El renderer interpola coordenadas flotantes a 20 px/s con escalas 1×/2×/4×. Las rutinas usan 2 min/tile y la orden local al Café 1 min/tile. Llegar al Café reserva un anchor visible; llegar al hogar retira lógicamente al agente de la calle.
52. **Descubrimiento persistente.** **Construir** debe seguir visible en ciudad y convertirse en **Volver a la ciudad** dentro del Café. **Referencias** abre una galería accesible con las cuatro maquetas aprobadas.
53. **No inventar interiores faltantes.** Este follow-up no crea escenas de casas u oficinas. La entrada lógica queda lista, pero su representación requiere una fase posterior de diseño y assets.
54. **Validación física específica.** La escala de actores, los NPC cargados, la posición de helechos y el tráfico GET-only se comprueban en navegador real; tests unitarios o inspección del estado no sustituyen esa evidencia.
55. **Calibrar la silueta, no la celda.** Los atlas conservan celdas uniformes pero sus figuras tienen padding distinto. Cada perfil usa una calibración propia para igualar altura aparente y anclar pies o patas; los NPC humanos comparten una altura visible común.
56. **Oclusión mediante arte real.** La barra, las mesas y el sofá vuelven a dibujarse como cinco recortes de primer plano del raster original. No se aceptan rectángulos, máscaras genéricas ni actores siempre por encima del mobiliario.
57. **Tránsito NPC persistido y local.** Un NPC puede estar `offstage`, en `transit` o en `interior`. Aparece en un borde conectado, camina a 2 tiles por minuto y completa físicamente entrada y salida sin adquirir perfil, sesión ni vínculo Hermes.
58. **Base isométrica legible.** El mapa usa espesor de tierra, sombra, microtextura determinista y vallas perimetrales con aperturas. Estas capas son presentación: no alteran grilla, colisiones ni parcelas construibles.
59. **Salida redundante del interior.** `B`, `Esc` y el botón contextual deben volver a la ciudad. La escena interior no puede atrapar al jugador.

## ADR Interior Entity & Possession Pass v1

60. **Runtime espacial pequeño y compartido.** Ciudad y Café declaran escenas, entidades, footprints, transitabilidad, anchors, interacciones, portales, ocupación y reservas mediante contratos TypeScript reutilizables. No se adopta un ECS pesado ni física 3D.
61. **Tres fuentes de intención, una grilla.** Rutina autónoma, orden por clic y posesión consultan el mismo contrato de movimiento y ocupación. El control manual es estado local del juego y nunca escribe ni falsifica estado Hermes.
62. **Mapa de controles congelado.** Clic selecciona o da una orden de suelo; botón **Poseer**/`P` alterna control; WASD mueve; `E` interactúa; `F` usa portales; el primer `Esc` libera posesión. `B` conserva Construir en ciudad y salida compatible en interior. Inputs editables bloquean atajos.
63. **WASD por vecino cardinal.** Cada tecla solicita una casilla relativa a pantalla, no desplaza el sprite libremente. La cola está acotada y key repeat no puede atravesar entidades.
64. **Interacción sobre anchor exacto.** `E` resuelve una interacción alcanzable, reserva su anchor y recorre la ruta antes de ejecutar. La capa semántica no puede elegir después otro asiento y teletransportar al actor.
65. **Portales con aproximación física.** `F` sólo atraviesa una puerta válida desde su casilla de aproximación. En interior, `Esc` o la salida compatible auto-enrutan hasta la puerta antes de cambiar de escena; salir no teletransporta desde el centro del Café.
66. **Ocupación y reconciliación deterministas.** Agentes y NPC no terminan en la misma casilla o anchor. Si cambia el conjunto autónomo, el runtime conserva una ruta manual válida, reubica seeds conflictivos de forma determinista y evita bucles de reconfiguración.
67. **Hold manual breve.** Una orden por clic mantiene el destino durante tres segundos al llegar. Después, y sólo si no existe posesión ni una nueva orden, el agente vuelve a su rutina autónoma.
68. **Persistir posición, no posesión.** Save/load conserva escena, casilla y ubicación real del agente. Selección temporal, cola de teclas y posesión activa no sobreviven a la recarga.
69. **Arte aprobado como estructura, no como descarte.** El Café rasterizado continúa siendo la capa visual canónica. Los muebles espacialmente relevantes y la decoración bloqueante se describen como entidades; el microdetalle puede permanecer horneado. Depth y recortes visuales quedan asociados a esas entidades.
70. **Prioridad de Hermes sin superficie de escritura.** Si aparece actividad real de Hermes mientras un agente está poseído, el control local se libera para que la simulación represente la actividad. El bridge permanece GET-only y Syka World no inicia tareas.
71. **Interiores faltantes no se improvisan.** Casas, oficinas y taller todavía no poseen escenas modulares. Editor tipo Habbo, multiplayer, chat, relaciones, necesidades y misiones continúan fuera del alcance de este pass.
72. **Cierre histórico por evidencia independiente.** La goal se cerró tras QA físico/visual independiente 15/15 para el alcance ejecutado, responsive PASS en 1008×548, 2560×1080 y 640×720, 20 GET sin body y hashes preservados. La auditoría vive en `reports/interior-entity-possession-v1/independent-final-audit.md`; ADR-78 agrega después el gate de reentrada same-runtime que aquella pasada no cubría.
73. **Rendimiento exterior como riesgo menor.** Ciudad promedia 53,99 FPS y mejora el baseline, aunque queda cerca de 1 FPS bajo el objetivo aproximado; Café promedia 56,89 FPS. No se reabre la lógica espacial por esta deuda de optimización.

## ADR Corrección de integridad y reentrada del Café

74. **Frame base explícito en texturas con recortes derivados.** El cuarto del Café siempre se crea con `alpha-cafe-interior/__BASE`. Ningún renderer puede depender de `firstFrame` cuando la misma textura recibe frames de recorte durante el runtime.
75. **Shutdown elimina identidad runtime.** Al abandonar una escena se cancelan tweens y se destruyen/vacían vistas, capas y referencias opcionales. Reingresar reconstruye agentes y NPC; no reutiliza objetos Phaser destruidos.
76. **Walk grid completamente conectado.** Toda casilla marcada transitable debe pertenecer al componente alcanzable desde la entrada. La puerta canónica del Café es `{16,17}` y debe ofrecer al menos un vecino cardinal interior válido; una celda aislada no es un destino permitido aunque esté dentro de los límites.
77. **Una posición física y una ruta.** La celda autoritativa del controlador espacial alimenta el renderer. Agentes y NPC cambian de anchor recorriendo `findSpatialPath` paso por paso; un tween recto entre destinos semánticos no puede representar movimiento físico. Un save antiguo imposible se sanea sin atravesar visualmente muebles.
78. **La prueba de ciclo de vida es obligatoria.** La evidencia de primera entrada no valida un interior reutilizable. Cualquier cierre futuro del Café debe probar entrada → salida → reentrada dentro de la misma página y el mismo `Phaser.Game`, con actores presentes, input y colisión después de reconstruir la escena. La auditoría 15/15 anterior queda como evidencia histórica, no como cobertura de esta regresión.

## ADR Habbo Spatial Public Foundation v1

79. **Compositor de profundidad determinista.** `computeSpatialDepth()` calcula un entero estable a partir de cell + elevation + subLayer + tieBreaker. La elevación domina el sub-layer (stairs/raised platforms sortean encima del mobiliario de planta) y el sub-layer ordena back < body < actor < front < overlay en la misma celda. El renderer del Café usa este compositor para `cafeForegroundDepth` y `actorDepth`, reemplazando los cálculos manuales de Y-lineal.

80. **Render parts explícitos para multi-part furniture.** `SpatialRenderPartV1` declara roles `back`/`body`/`front`/`overlay`/`shadow` con `depthOffset` y `normalizedRect` opcionales. Las entidades del Café con `normalizedOcclusionRect` ahora declaran `partsV2` (body/front) explícitamente, permitiendo que el compositor intercale actores entre el body y el front crop. Esto es el contrato Habbo: background → actor behind counter → counter body → actor in front → counter front.

81. **Height map y pathfinding con elevation.** `SpatialHeightMapV1` permite elevación per-cell. `findSpatialPath` acepta `maxElevationStep` (default 1) y rechaza cliffs más altos. Esto habilita escaleras y plataformas elevadas sin atravesar muros invisibles.

82. **Placement validation como contrato puro.** `validateSpatialPlacement()` valida ground/on-entity, stacking (`stackable`), altura máxima (`maxStackHeight`) y conflictos de celdas bloqueantes. Es el primer slice del editor tipo Habbo, aunque aún no está conectado a la UI.

83. **ProfileId como string validado, no union.** `ProfileId` pasa de `"default"|"elen"|"astrelis"|"zerny"` a `string`. La validación ocurre en el runtime `ProfileRegistry`, no en un guard TypeScript que rechaza unknowns. Esto permite que un clon público descubra cero, uno, cuatro o muchos perfiles sin cambios de código.

84. **CharacterId separado de ProfileId.** `CharacterId = string` es una identidad interna estable que sobrevive a un profile offline. Un profile puede irse y volver; su character mantiene nombre, avatar, home y workplace. Los saves legacy usan el mismo string para ambos.

85. **Perfiles desconocidos se preservan, no se descartan.** Los eventos del bridge con `profile_id` desconocido no se atribuyen a Syka ni se descartan. Se añaden como `DiscoveredProfileV1` (source: bridge-payload) y el usuario puede mapearles un character después. El orden del snapshot preserva los profiles legacy primero, unknowns después.

86. **Preset de Sikora como configuración opcional.** `config/presets/sikora-world.json` es el único lugar donde viven los cuatro nombres legacy. Un clon público puede removerlo o reemplazarlo sin cambios de código. `loadPresetIntoRegistry()` lo carga en el registry; `legacyAgentIdForProfile()` resuelve el AgentId del atlas para profiles legacy.

87. **UI English-first para repositorio público.** La UI del juego se traduce al inglés para el repositorio público. Los nombres propios del catálogo (Café Biblioteca, Casa acogedora, Estudio de Elen) se mantienen como proper nouns. `formatLumenes` usa `en-US` y "Lumens".

88. **AgentId permanece como union para el renderer.** `AgentId = "syka"|"elen"|"astrelis"|"zerny"` se mantiene porque indexa el atlas de sprites aprobado. Los perfiles dinámicos que no matchean un slot legacy caen a un placeholder neutral. Es una concern visual, no del modelo de save/bridge.

89. **reservationCapacity y walkableOffsets.** Los anchors pueden declarar `reservationCapacity` (default 1) para zonas broader. Los footprints pueden declarar `walkableOffsets` para arcos, puentes y entidades que se pueden cruzar por debajo.

## ADR Café Biblioteca Safe Floor v2

90. **La superficie de pies es positiva.** En el raster aprobado del Café no se calcula movimiento como “todo el piso menos una caja por mueble”. Sólo existen las celdas expresamente autorizadas sobre suelo visualmente vacío; lo omitido es estructuralmente inaccesible.

91. **Landmark no significa collider.** Barra, cocina, mesas, sofá, biblioteca, chimenea y aparador continúan como entidades semánticas consultables, pero no generan footprints bloqueantes aproximados. La safe floor es la única autoridad de tránsito del raster.

92. **Dos componentes deliberados.** La decisión 76 queda superada para el Café v2: el pasillo de visitantes forma un componente conectado a la entrada y la isla del staff forma otro componente intencionalmente aislado detrás de la barra. Visitantes no pueden enrutar hacia el área de servicio.

93. **Sólo la barra necesita foreground.** Al no existir rutas detrás de sofá, mesas o biblioteca, sus recortes frontales se eliminan. El frente de barra se conserva porque staff sí puede estar detrás de él.

94. **Pies sin corrección cosmética.** Cuando el runtime entrega una celda física, el renderer no aplica nudge por personaje. Pivote, contacto, pathfinding y dibujo comparten exactamente la misma posición de pies.

95. **Conservadurismo antes que falsa libertad.** Safe Floor v2 entrega un pasillo central pequeño y verificable. No se declara libre toda la habitación. Cada ampliación futura exige un corredor visible, tests de conectividad y QA real; nunca una vuelta automática a rectángulos por sprite.

## Provisionales

- Syka Pixel Office y repositorios externos son fuentes de rescate/referencia, no bases aceptadas en bloque.
- La moneda se llama `Lúmenes` y puede migrarse mediante versión de balance.
- Las necesidades locales siguen siendo energía, concentración, ánimo, sociabilidad y comodidad.
- Las rutinas son deterministas; Hermes interrumpe o aplaza, pero no reemplaza la vida local.
- Atlas de agentes, pets, iconografía y algunos indicadores visuales.

## Abiertas

- Diseño final de los cuatro avatares/pets.
- Ajuste visual de iluminación, vegetación, variedad residencial y UI pequeña.
- Estrategia de división del bundle principal de 1.514,90 kB (400,78 kB gzip).
- Observación natural de una tarea Hermes real ya iniciada, sin provocarla desde Syka World.
- PWA, Tauri, Electron u otro empaquetado final.
- Chat, órdenes espaciales y cualquier capacidad futura de ejecutar tareas, siempre con permisos explícitos.
- Diseño y assets de interiores modulares para casas, oficinas y taller sobre el contrato espacial ya probado.
