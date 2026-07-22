# Goal — Syka World Isometric Playable Alpha v1

Estado: lista para ejecutar cuando Sikora la inicie mediante `/goal` con GPT-5.0 en modo Max.

## Misión

Convertir las bases de Foundations v1 en una **alpha jugable local** de Syka World. La entrega debe unir bridge, simulación, presentación 2.5D isométrica e interacción en una experiencia coherente y verificable.

El resultado esperado no es “el juego completo”. Es un vertical slice suficientemente real para jugar, evaluar y ampliar:

```text
construir una pequeña ciudad
→ verla vivir durante día y noche
→ entrar a una cafetería detallada
→ observar rutinas locales
→ ver tareas Hermes reflejadas
→ ganar Lúmenes
→ comprar y mejorar espacios
→ guardar y continuar
```

La goal debe priorizar una experiencia pequeña pero integrada sobre una enorme cantidad de contenido superficial.

## Resultado prometido y límite honesto

### La goal sí debe intentar entregar

- una aplicación web local jugable;
- mundo isométrico pixel art con cámara fija, pan y zoom;
- mapa editable con colocación libre de edificios;
- modo de muestra ya construido y modo de partida progresiva;
- compra, construcción y al menos una mejora de edificio;
- ciclo visible de día/noche;
- cafetería con interior aislado, detallado y completamente amueblado;
- transición ciudad → interior → ciudad conservando estado y cámara;
- cuatro agentes placeholder con rutinas locales;
- bridge Hermes de sólo lectura conectado a los estados visuales;
- Lúmenes, recompensa, catálogo mínimo y guardado/carga;
- pruebas automáticas, QA visual y documentación reproducible.

### La goal no puede prometer en una sola ejecución

- decenas de edificios e interiores con arte final;
- avatares o pets definitivos;
- balance final de largo plazo;
- editor de decoración tan profundo como un juego comercial;
- chat o ejecución de tareas desde el mundo;
- publicación, instalador, inicio automático o versión móvil;
- igualdad pixel por pixel con una ilustración generada.

Si la dirección artística exige más trabajo manual del disponible, debe conservar el sistema jugable, entregar un kit visual pequeño y honesto, y documentar exactamente qué assets continúan provisionales. Nunca presentar placeholders como arte final.

## Contexto que debe leerse antes de modificar

Leer por completo:

- `CURRENT_PROJECT_STATE.md`
- `TASKS.md`
- `README.md`
- `docs/VISION.md`
- `docs/DECISIONS.md`
- `docs/BRIDGE_V0_3.md`
- `docs/BRIDGE_RUNBOOK.md`
- `docs/SIMULATION_ARCHITECTURE.md`
- `docs/GAME_DESIGN_V0_1.md`
- `docs/VISUAL_STATE_LANGUAGE.md`
- `docs/CHARACTER_PETS_STRATEGY.md`
- `docs/VISUAL_STYLE_GUIDE.md`
- `reports/FOUNDATIONS_V1_FINAL_REPORT.md`
- `research/visual-concepts/approved-direction-v1/README.md`

Inspeccionar los cuatro PNG del directorio de dirección aprobada a resolución completa.

Ejecutar la suite existente antes de cambiar código y conservar el resultado como baseline.

## Decisiones confirmadas e innegociables

### Dirección exterior

- Pixel art isométrico detallado y nítido.
- Cámara ortográfica fija; se permite pan y zoom, nunca rotación.
- La referencia exterior principal es `city-layout-a-twilight.png`.
- Las otras ciudades demuestran distribuciones libres; una plaza central no es obligatoria.
- Atardecer y noche deben verse especialmente atractivos, pero existe ciclo completo de día/noche.
- Faroles, ventanas, jardines y pequeños objetos dan vida al exterior.
- No usar el aspecto low-poly del Visual Lab v0.1 como dirección final.

### Dirección interior

- La referencia interior principal es `cafe-interior-library.png`.
- Whisper of the House inspira densidad, legibilidad, calidez y narrativa de objetos sólo como referencia; no copiar assets o layouts.
- El interior se abre como una escena aislada y más cercana, no levantando el techo sobre el mapa exterior.
- El fondo no será negro: debe mostrar una versión desenfocada, atenuada o simplificada de la ciudad y respetar hora/clima.
- La cafetería usa madera, libros, chimenea, luces cálidas, cocina y mobiliario completo.

### Edificios y decoración

- Todo edificio terminado aparece funcional y amueblado.
- Decorar es opcional: comprar, añadir o reemplazar objetos, nunca llenar una carcasa vacía por obligación.
- Cada prefab contiene exterior, interior predeterminado, entrada, ocupación, costo, estados de construcción y slots opcionales.

### Progresión

- La partida progresiva comienza pequeña.
- Se compran edificios o planos con Lúmenes.
- Se elige libremente dónde construir dentro de reglas de terreno.
- La construcción tiene etapas visibles.
- Nuevos edificios, sectores y mejoras se desbloquean con progreso.
- No hay castigo por no usar Hermes, por errores o por interrupciones.

### Personajes

- Syka → `default`; Elen → `elen`; Astrelis → `astrelis`; Zerny → `zerny`.
- Los avatares definitivos siguen abiertos.
- Usar placeholders pixelados discretos y neutrales; evitar cabezas gigantes o estética Funko.
- Incluir un toggle de desarrollo para ocultarlos y evaluar el mundo solo.

## Arquitectura objetivo

Preservar la separación existente:

```text
Hermes
  ↓ sólo lectura
Bridge v0.3
  ↓ contratos versionados
Simulación headless
  ↓ estado de juego
Aplicación isométrica
  ├── escena exterior
  ├── escena interior
  └── UI/interacción
```

No introducir imports de Hermes dentro de la simulación o renderer. El frontend consume contratos propios.

### Aplicación nueva

Crear la aplicación definitiva de la alpha en una carpeta nueva y explícita, por ejemplo `app/game`, sin convertir silenciosamente `lab/visual` en producto.

El Visual Lab v0.1 queda preservado como experimento descartado. Puede reutilizar ideas, nunca promover su renderer o assets por inercia.

### Renderer recomendado

Usar TypeScript + Vite y evaluar Phaser como primera opción por escenas, cámara, input y sprites 2D. Implementar proyección isométrica propia si hace falta:

```text
screenX = (gridX - gridY) × tileWidth / 2
screenY = (gridX + gridY) × tileHeight / 2 - elevation
```

PixiJS u otra alternativa sólo debe elegirse si un spike medido demuestra una ventaja concreta. Registrar la decisión en `docs/DECISIONS.md`. No adoptar un motor 3D visible para intentar imitar el concepto.

## Estrategia artística y de assets

Las imágenes conceptuales son objetivos, no sprites recortables automáticamente.

### Art bible mínima

Definir y documentar antes de escalar:

- proporción del tile isométrico;
- resolución lógica y pixel density;
- escala de edificios y personajes;
- dirección única de luz;
- paleta base de día, atardecer y noche;
- contornos, sombras y clusters;
- altura y footprints de lotes;
- reglas de puertas, ventanas y accesos;
- densidad máxima de props;
- nearest-neighbor e integer zoom cuando sea viable.

### Pipeline permitido

Se puede experimentar con:

1. sprites originales dibujados/generados sobre footprints controlados;
2. modelos sencillos renderizados desde un ángulo fijo y terminados como pixel art;
3. composición modular de paredes, techos, ventanas y props;
4. atlas originales con licencia propia/compatible;
5. `$imagegen` para conceptos o fuentes de assets originales, seguido de recorte, normalización y QA.

No copiar assets de Whisper of the House, Tiny Life u otros juegos. No incorporar packs externos sin verificar licencia.

### Gate visual obligatorio

Antes de implementar una ciudad grande, producir una escena pequeña con:

- terreno y caminos;
- un hogar;
- la cafetería exterior;
- vegetación y faroles;
- ciclo atardecer/noche;
- pan y zoom sin rotación;
- captura 1440×900.

Debe verse coherente al 100%, 150% y 200% de zoom, sin blur, shimmering o escalas inconsistentes. Si falla, iterar el pipeline como máximo dos veces antes de escalar. Registrar comparación y limitaciones.

## Plan de ejecución por fases

## Fase 0 — Auditoría y baseline

- comprobar estado del worktree sin sobrescribir cambios del usuario;
- ejecutar las 39 pruebas existentes;
- comprobar bridge vivo sin reiniciar Hermes innecesariamente;
- inspeccionar dependencias disponibles y versiones oficiales;
- medir el Visual Lab v0.1 sólo como baseline, no como objetivo;
- crear plan interno y matriz requisito → prueba.

Salida: reporte de baseline y ninguna regresión.

## Fase 1 — Contratos de presentación

Crear contratos versionados para:

- mapa, tile, elevación y ocupación;
- catálogo de edificios;
- footprint, entrada y orientación;
- construcción y mejoras;
- escena interior;
- furniture slots y decoración opcional;
- cámara y transición;
- snapshot visual de agentes;
- save game/migración;
- comunicación frontend-simulación.

La simulación debe seguir siendo determinista y renderer-agnostic.

Salida: contratos, fixtures y pruebas.

## Fase 2 — Spike isométrico y gate visual

- scaffold de `app/game`;
- renderer 2D con proyección isométrica;
- ordenamiento correcto por profundidad;
- cámara fija con pan, zoom y límites;
- cero rotación accesible por mouse o teclado;
- terreno, caminos, vegetación y luces;
- primer edificio modular;
- day/night mínimo;
- captura y QA del gate visual.

No continuar a contenido masivo hasta que el spike sea reproducible.

## Fase 3 — Kit visual mínimo coherente

Crear assets originales suficientes para una alpha:

- terreno y bordes;
- caminos rectos, esquinas, cruces y accesos;
- faroles, árboles, arbustos, flores, bancos y cercas;
- casa inicial;
- cafetería;
- oficina creativa/marketing;
- oficina comercial;
- taller construcción/CRM;
- al menos tres etapas visuales de construcción;
- marcadores discretos de estado;
- cuatro placeholders de agentes.

Priorizar coherencia sobre cantidad. Implementar atlas/manifiesto y tooling reproducible.

## Fase 4 — Ciudad, catálogo y construcción

Implementar dos entradas:

### Modo muestra

- ciudad preconstruida inspirada en layout A;
- suficiente dinero y edificios para explorar;
- acceso inmediato a cafetería;
- toggle de personajes;
- ciclo día/noche acelerable.

### Nueva partida

- mapa inicial pequeño y parcialmente vacío;
- casa/base inicial de Syka o centro mínimo;
- catálogo de edificios y costos;
- previsualización fantasma del footprint;
- validación de terreno, colisión y acceso;
- colocar/cancelar construcción;
- etapas de construcción visibles;
- edificio terminado y automáticamente amueblado;
- caminos colocables o conexión simple a accesos;
- distribución totalmente libre, sin plaza obligatoria.

Implementar al menos una expansión de terreno o sector desbloqueable.

## Fase 5 — Cafetería interior

- edificio exterior seleccionable con hover claro;
- clic → acercamiento breve → transición;
- escena interior aislada y detallada;
- fondo con captura o representación atenuada de la ciudad;
- hora y luz exterior sincronizadas;
- mobiliario completo desde el primer acceso;
- objetos inspeccionables esenciales;
- slots opcionales para añadir/reemplazar un pequeño catálogo de muebles;
- comprar al menos un objeto decorativo y colocarlo en un slot válido;
- volver a ciudad preservando cámara, tiempo y simulación.

Evitar convertir decoración en trabajo obligatorio.

## Fase 6 — Progresión y economía visible

Conectar Lúmenes a la UI y simulación:

- saldo inicial comprensible;
- precios de casa/cafetería/oficinas/mejoras;
- recompensa local que funciona sin Hermes;
- recompensa moderada por completion Hermes;
- catálogo con bloqueados y condiciones legibles;
- una mejora funcional/visual de cafetería;
- una expansión de mapa;
- feedback de compra, construcción y desbloqueo;
- sin rachas ni penalizaciones productivistas.

Agregar modo de desarrollo para acelerar economía y construcción durante QA, claramente separado de la partida normal.

## Fase 7 — Rutinas y cuatro agentes

- proyectar posiciones de simulación a la grilla visual;
- navegación simple por caminos o A* limitado;
- rutina casa → café → trabajo → espacio comunitario → casa;
- entrada/salida de edificios;
- ocupación visible en inspector;
- estados `idle`, `thinking`, `using-tool`, `waiting`, `done`, `interrupted`, `error`, `offline`;
- herramientas cambian pose/objeto de forma discreta;
- ocultar agentes no pausa simulación.

Los placeholders no deben confundirse con avatares aprobados.

## Fase 8 — Bridge real de sólo lectura

- cliente con snapshot inicial y reconexión `after=<event_id>`;
- indicador `simulated`, `online`, `degraded`, `offline`;
- tarea Hermes desplaza al agente hacia su lugar de trabajo;
- sesión concurrente conserva actividad hasta terminar todas;
- waiting visible;
- completion celebra y entrega recompensa moderada;
- failed/interrupted replanifica sin castigo;
- resumen corto y sanitizado; nunca prompt completo, razonamiento, argumentos o resultados;
- funcionamiento simulado cuando el bridge no está disponible.

No enviar comandos a Hermes.

## Fase 9 — Persistencia y experiencia de uso

- save atómico y versionado;
- autosave prudente;
- continuar partida;
- reset con confirmación;
- persistir mapa, edificios, etapas, economía, mejoras, decoración, reloj y agentes;
- migración o rechazo explícito de esquemas incompatibles;
- UI mínima, cálida y no técnica;
- tooltips claros;
- controles de cámara accesibles;
- pausa y velocidades del reloj;
- sonido sólo si existen assets propios/licenciados y puede desactivarse.

## Fase 10 — Verificación completa

### Pruebas unitarias

- proyección y profundidad isométrica;
- ocupación, colisiones y footprints;
- costos, compras y saldo;
- construcción y mejora;
- interior/exterior y persistencia;
- rutinas y pathfinding;
- bridge y concurrencia;
- migración de save.

### Pruebas end-to-end

1. abrir modo muestra;
2. mover cámara y hacer zoom sin rotarla;
3. cambiar día → atardecer → noche;
4. seleccionar cafetería;
5. entrar al interior;
6. comprar/agregar un objeto opcional;
7. volver y conservar cámara;
8. iniciar nueva partida;
9. comprar y colocar cafetería;
10. verla construirse y abrir su interior;
11. guardar, recargar y conservar estado;
12. ejecutar secuencia completa de estados;
13. conectar/desconectar bridge controlado;
14. si el bridge real está disponible, validarlo sólo por lectura sin iniciar tareas.

### QA visual

- capturas de día, atardecer, noche e interior;
- 1440×900 y una resolución menor;
- arte nítido en zoom permitido;
- sin seams en tiles;
- sin depth sorting incorrecto;
- sin personajes Funko;
- sin fondo negro en interior;
- comparar con las referencias aprobadas y registrar diferencias honestas.

### Rendimiento objetivo

- objetivo 55–60 fps con mapa alpha y cuatro agentes en la máquina actual;
- carga local menor a 3 segundos después de cache;
- interacciones sin bloqueos visibles;
- medir heap, sprites/batches y tiempo de frame;
- no ocultar advertencias de bundle o memoria.

## Entregables obligatorios

1. `app/game` ejecutable y reproducible.
2. Modo muestra construido.
3. Nueva partida con construcción libre.
4. Renderer isométrico fijo.
5. Art bible y kit visual mínimo.
6. Catálogo, Lúmenes y progreso básico.
7. Ciclo día/noche.
8. Cafetería exterior e interior aislado.
9. Transición con fondo urbano no negro.
10. Edificios amueblados por defecto.
11. Decoración opcional mínima.
12. Rutinas y cuatro placeholders.
13. Integración bridge pasiva.
14. Save/load versionado.
15. Suite de pruebas ampliada.
16. QA visual/performance.
17. Runbook para abrir, probar y cerrar.
18. `README.md`, `CURRENT_PROJECT_STATE.md`, `TASKS.md`, decisiones y Obsidian actualizados.
19. Informe final con comprobado/prototipo/pendiente.
20. Capturas y, si es práctico, un pequeño video local de recorrido.

## Criterio de “alpha jugable terminada”

La goal sólo puede marcarse completa si:

1. el juego arranca con un comando documentado;
2. las 39 pruebas originales siguen pasando;
3. el usuario puede explorar un mapa isométrico sin rotación;
4. existe modo muestra y nueva partida;
5. se puede comprar, colocar y completar al menos un edificio;
6. la cafetería abre un interior aislado amueblado;
7. volver conserva estado y cámara;
8. día/noche afecta exterior e interior;
9. Lúmenes y desbloqueos funcionan sin Hermes;
10. los cuatro perfiles pueden representarse con datos simulados;
11. el frontend consume el bridge real en sólo lectura cuando está disponible;
12. save/load sobrevive a reinicio;
13. el flujo principal pasa en navegador automatizado;
14. rendimiento medido es suficiente o la limitación queda demostrada;
15. no quedan servidores temporales ni puertos de QA abiertos;
16. arte provisional está etiquetado y no se afirma que sea final;
17. no queda trabajo seguro, claramente incluido y posible sin intentar.

## Reglas de autonomía

Puede:

- modificar archivos dentro de la raíz canónica;
- crear la nueva app y assets originales;
- instalar dependencias locales fijadas y justificadas;
- ejecutar imagegen para conceptos/assets originales;
- iniciar servidores temporales controlados;
- usar el bridge vivo sólo por lectura;
- crear saves y spools temporales bajo `.runtime`;
- investigar documentación oficial y licencias;
- tomar decisiones reversibles y documentarlas.

No puede:

- hacer commit, push, PR, publicación o despliegue;
- iniciar tareas Hermes reales;
- modificar datos de negocio;
- cerrar Hermes o sesiones activas para una prueba;
- activar gastos de APIs externos;
- copiar assets de juegos comerciales;
- instalar inicio automático;
- borrar el Visual Lab anterior o proyecto heredado;
- fijar avatares/pets definitivos sin aprobación;
- borrar saves/eventos reales;
- sacrificar privacidad para mostrar más información.

## Manejo de bloqueos

- Un fallo artístico no justifica fingir calidad: reducir cantidad, mantener coherencia y documentar.
- Un paquete sin licencia compatible se descarta.
- Si una dependencia falla, probar una alternativa equivalente aislada.
- Si el bridge real no está disponible, completar QA con backend controlado y documentar el punto pendiente.
- No detener toda la goal por una preferencia de avatar; usar placeholders.
- No expandir alcance hacia chats, multiplayer o publicación.

## Política de calidad

- Inspeccionar antes de modificar.
- Preservar comportamiento comprobado.
- Usar contratos y fixtures en lugar de acoplamientos.
- Probar cada fase antes de apilar la siguiente.
- No medir éxito por cantidad de archivos o tokens.
- No declarar integración real con mocks.
- No declarar rendimiento sin medición.
- Mantener secretos, prompts, razonamiento y tool payloads fuera del juego.
- Actualizar estado canónico y espejo Obsidian como parte de done.

## Presupuesto recomendado

Para una ejecución verdaderamente amplia: **400.000–500.000 tokens**, con GPT-5.0 y razonamiento Max si la interfaz lo permite. Usar 500.000 si Sikora quiere máxima autonomía, pero detenerse cuando el criterio esté cumplido: no gastar tokens artificialmente.

## Texto listo para iniciar

Antes de enviarlo, seleccionar GPT-5.0 y modo Max en la interfaz.

```text
/goal Crea una goal con presupuesto de 500000 tokens. Lee por completo docs/GOAL_ISOMETRIC_PLAYABLE_ALPHA_V1.md y ejecútala de manera autónoma hasta cumplir sus criterios de finalización. Conserva Bridge v0.3 y la simulación existente, construye una alpha jugable 2.5D isométrica con ciudad editable, progresión, cafetería interior, ciclo día/noche, cuatro agentes y conexión Hermes pasiva. No hagas commits, pushes, publicaciones, despliegues ni cambios externos irreversibles. No inicies tareas reales de Hermes y no copies assets con licencia incompatible.
```
