# Syka World — Brief de ejecución Ultra y control visual v1

## Propósito

Este documento es el punto de entrada compacto para ejecutar la goal de **Syka World Isometric Playable Alpha v1** en modo Ultra/Max. No reemplaza el plan técnico principal: lo complementa y define cómo debe organizarse la ejecución, especialmente la validación artística independiente.

Antes de modificar el proyecto, el agente principal debe leer por completo:

1. `docs/GOAL_ISOMETRIC_PLAYABLE_ALPHA_V1.md`
2. `CURRENT_PROJECT_STATE.md`
3. `docs/VISUAL_STYLE_GUIDE.md`
4. `docs/DECISIONS.md`
5. `research/visual-concepts/approved-direction-v1/README.md`
6. Todas las imágenes dentro de `research/visual-concepts/approved-direction-v1/`, inspeccionadas en resolución completa.

Si existe una contradicción, prevalecen en este orden:

1. instrucciones explícitas del usuario;
2. este brief y las decisiones visuales confirmadas;
3. el plan principal de la goal;
4. documentación histórica;
5. código heredado.

## Resultado buscado

Construir una alpha web local y jugable de Syka World: una ciudad 2.5D isométrica en pixel art detallado donde Syka, Elen, Astrelis y Zerny tengan hogares, destinos, trabajos, rutinas locales y estados visuales conectados pasivamente con Hermes.

La prioridad es:

1. coherencia y calidad visual;
2. estabilidad de sistemas;
3. experiencia jugable completa;
4. integración pasiva con Hermes;
5. cantidad de contenido.

Ante un conflicto entre cantidad y calidad, reducir mapa, edificios o variantes, pero conservar una escena pequeña, bella, coherente, jugable y extensible.

## Organización multiagente obligatoria

El agente principal es responsable de arquitectura, implementación, integración, pruebas y documentación.

Debe desplegar un subagente independiente llamado `visual_director_qa`, dedicado a proteger la dirección artística. Este subagente no puede aprobar basándose sólo en código, descripciones, prompts o assets aislados: debe examinar capturas reales del juego y compararlas con las referencias aprobadas.

El agente principal puede implementar correcciones, pero no puede sustituir la evaluación independiente del subagente visual. El subagente puede rechazar el gate, identificar defectos concretos y exigir una nueva iteración antes de escalar la ciudad.

## Dirección visual innegociable

### Exterior

- Referencia principal: `city-layout-a-twilight.png`.
- Pixel art isométrico detallado, nítido y modular.
- Cámara ortográfica fija con pan y zoom; nunca rotación.
- Atardecer y noche especialmente atractivos, con ciclo completo de día y noche.
- Ventanas y faroles cálidos, vegetación abundante y pequeños objetos que den vida al exterior.
- Distribución libre de edificios; no imponer plaza central.
- Evitar low-poly, blur, escalas inconsistentes, cabezas gigantes y estética Funko.

### Interior

- Referencia principal: `cafe-interior-library.png`.
- Whisper of the House sólo inspira densidad, legibilidad, calidez y narrativa de objetos; no copiar assets ni layouts.
- La cafetería abre como escena aislada y cercana, no levantando el techo sobre el exterior.
- Fondo con ciudad atenuada o simplificada y sincronizada con la hora; nunca negro.
- Madera, libros, chimenea, cocina, mobiliario completo y luz cálida.
- Los edificios terminados aparecen funcionales y amueblados. Decorar es opcional.

Las imágenes son referencias artísticas, no sprites listos para usar. El runtime debe utilizar assets originales, modulares y legalmente compatibles.

## Gate visual obligatorio

Antes de construir contenido masivo, crear un spike reproducible con:

- terreno y caminos;
- una casa;
- exterior de cafetería;
- árboles, jardines, faroles y objetos ambientales;
- atardecer y noche;
- cámara fija, pan y zoom sin rotación.

Producir capturas reales a 1440x900 en zoom 100%, 150% y 200%. `visual_director_qa` debe revisarlas con una rúbrica explícita:

- composición isométrica;
- proporciones y escala;
- nitidez del pixel art;
- coherencia entre tiles y sprites;
- densidad de detalles;
- arquitectura exterior;
- vegetación y objetos ambientales;
- iluminación, faroles y ventanas;
- paleta y contraste;
- profundidad y orden visual;
- ausencia de blur o shimmering;
- legibilidad en los tres niveles de zoom;
- distancia respecto de las referencias y correcciones prioritarias.

Permitir hasta tres ciclos completos de implementación, captura, revisión y corrección. No escalar la ciudad hasta obtener aprobación documentada. Si persiste una limitación artística real, conservar la mejor versión y documentar con honestidad qué sigue provisional; nunca afirmar equivalencia pixel por pixel ni presentar placeholders como arte final.

## Sistemas que debe implementar la alpha

Seguir todas las fases y criterios de `docs/GOAL_ISOMETRIC_PLAYABLE_ALPHA_V1.md`, incluyendo:

- aplicación nueva en `app/game`, sin promover el Visual Lab 3D descartado;
- renderer 2D isométrico con profundidad correcta;
- modo muestra y nueva partida progresiva;
- mapa editable y colocación libre;
- catálogo, Lúmenes, compra, construcción por etapas, desbloqueos y al menos una mejora;
- ciclo día/noche;
- cafetería exterior e interior amueblado;
- transición interior/exterior conservando cámara, hora y estado;
- decoración posterior opcional;
- guardado, carga y migración segura;
- inspector de edificios y agentes;
- pruebas unitarias, integración, navegador, QA visual y medición de rendimiento.

## Agentes y rutinas

Mapeo obligatorio:

- Syka → `default`
- Elen → `elen`
- Astrelis → `astrelis`
- Zerny → `zerny`

Implementar cuatro placeholders pixelados neutrales, reemplazables en el futuro por avatares o mascotas definitivos. Cada agente debe tener hogar, trabajo y destinos, con una rutina local casa → cafetería → trabajo → espacio comunitario → casa, navegación, entrada y salida de edificios, ocupación visible y estados `idle`, `thinking`, `using-tool`, `waiting`, `done`, `interrupted`, `error` y `offline`.

Ocultar personajes no debe detener la simulación. La vida ambiental debe funcionar sin LLM y sin Hermes.

## Bridge Hermes

Conservar Bridge v0.3 y conectarlo en modo estrictamente de sólo lectura:

- snapshot inicial y reconexión desde el último `event_id`;
- estados `simulated`, `online`, `degraded` y `offline`;
- una tarea real lleva al agente a su lugar de trabajo;
- sesiones concurrentes mantienen actividad hasta concluir;
- `waiting` visible;
- `done` produce celebración discreta y recompensa moderada;
- `failed` o `interrupted` provoca recuperación sin castigo;
- sólo resumen corto y sanitizado de tarea.

Nunca enviar comandos, iniciar tareas reales, mostrar prompts completos, razonamiento privado, argumentos de herramientas o resultados sensibles. La economía y la simulación deben seguir funcionando si el bridge no está disponible.

## Revisión final independiente

Antes de declarar la goal completa, `visual_director_qa` debe revisar capturas de:

- ciudad de día;
- ciudad al atardecer;
- ciudad de noche;
- cafetería interior;
- zoom 100%, 150% y 200%;
- mundo con agentes visibles;
- mundo con agentes ocultos.

Debe entregar un veredicto, puntuación por criterio, diferencias frente a las referencias y lista de assets provisionales. Los reportes y capturas deben guardarse dentro del proyecto.

Además, deben cumplirse todos los criterios de finalización del plan principal: arranque documentado, pruebas anteriores sin regresiones, compra y construcción funcionales, interior, rutinas, bridge pasivo, save/load, flujo automatizado de navegador, rendimiento medido y ausencia de servidores temporales abiertos.

## Límites

- No hacer commits, pushes, publicaciones ni despliegues.
- No instalar inicio automático ni empaquetar una aplicación de escritorio.
- No hacer cambios externos irreversibles.
- No iniciar tareas reales de Hermes ni volver bidireccional el bridge.
- No copiar assets de MiniTown, Whisper of the House, Tiny Life u otros juegos.
- No incorporar assets externos sin verificar su licencia.
- No sacrificar coherencia visual por volumen de contenido.
- No marcar la goal completa por agotamiento de presupuesto.
- Preservar cambios del usuario y mantener actualizados `CURRENT_PROJECT_STATE.md`, `TASKS.md`, `docs/DECISIONS.md` y el espejo de Obsidian tras cambios materiales.

## Texto corto para iniciar la goal

Seleccionar modo Ultra/Max y pegar:

```text
/goal Crea una goal con presupuesto de 500000 tokens. Lee por completo docs/GOAL_ULTRA_VISUAL_EXECUTION_V1.md y todos los documentos y referencias que exige. Ejecuta autónomamente el plan completo de Syka World Isometric Playable Alpha v1. Despliega el subagente independiente visual_director_qa y no escales la ciudad hasta que apruebe el gate visual mediante capturas reales comparadas con las referencias. Prioriza calidad visual, luego sistemas, experiencia jugable e integración Hermes pasiva. Cumple todos los criterios de finalización y límites de seguridad. No hagas commits, pushes, publicaciones, despliegues ni tareas reales de Hermes.
```
