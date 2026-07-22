# Goal nocturna — Syka World Foundations v1

Estado: lista para ejecutar cuando Sikora lo autorice mediante `/goal`.

## Objetivo

Avanzar autónomamente las bases técnicas, jugables y visuales de Syka World durante una sesión larga de trabajo. El resultado debe convertir el proyecto actual —bridge pasivo funcional pero juego todavía temprano— en una base preparada para construir un vertical slice real.

La goal debe priorizar trabajo comprobable: código ejecutable, simulaciones, pruebas, auditorías con fuentes, decisiones documentadas y prototipos aislados. No debe consumir tiempo o tokens artificialmente ni declarar éxito sin evidencia.

## Contexto confirmado

Syka World es un hobby personal y evolutivo: un mundo donde los perfiles reales de Hermes aparecen como personajes con hogares, trabajos, rutinas, relaciones y progresión. La actividad real de Hermes afecta visualmente a los personajes, pero la mayor parte de la vida ambiental y la lógica del juego debe ejecutarse localmente sin llamadas continuas a modelos.

Personajes iniciales:

- Syka → perfil Hermes `default`.
- Elen → perfil `elen`; marketing.
- Astrelis → perfil `astrelis`; comercial.
- Zerny → perfil `zerny`; construcción y CRM.

Estado técnico inicial:

- Bridge pasivo v0.2 implementado y validado.
- Observador instalado en los cuatro perfiles.
- Estados visuales v1 definidos.
- Frontend definitivo todavía no iniciado.
- Syka Pixel Office heredado se conserva intacto como fuente de rescate.

Antes de trabajar, leer como mínimo:

- `CURRENT_PROJECT_STATE.md`
- `TASKS.md`
- `README.md`
- `docs/VISION.md`
- `docs/BRIDGE_ARCHITECTURE.md`
- `docs/BRIDGE_RUNBOOK.md`
- `docs/VISUAL_STATE_LANGUAGE.md`
- `docs/DECISIONS.md`
- `docs/REFERENCE_AUDIT.md`
- `docs/CHARACTER_PETS_STRATEGY.md`
- `docs/VISUAL_REFERENCE_MINITOWN.md`

## Dirección visual confirmada

No tratar las referencias como paquetes que deban copiarse completos. Extraer de cada una únicamente lo indicado:

### MiniTown — referencia principal

- Cámara elevada y observacional.
- Ciudad compacta tipo maqueta.
- Lectura clara de edificios, caminos y habitantes.
- Iluminación acogedora.
- Sensación de mundo vivo que se disfruta observando.
- 3D ligero y técnicamente alcanzable.

### Tiny Glade — referencia de ambiente

- Colores.
- Vegetación abundante y agradable.
- Calidez de la iluminación.
- Integración orgánica entre arquitectura y naturaleza.

No copiar su nivel máximo de realismo o detalle si perjudica rendimiento, modularidad o facilidad de producción.

### ISLANDERS — referencia secundaria de arquitectura

- Estructura y silueta de las casas.
- Geometría simplificada y modular.
- Lectura clara a distancia.

La preferencia es moderada: usar como orientación técnica, no como dirección artística dominante.

### Garden Galaxy — referencia de detalle

- Densidad y variedad de objetos pequeños.
- Decoración de espacios.
- Sensación de colección y personalización.
- Objetos que hacen que cada lugar se sienta propio.

### Minami Lane — referencia secundaria de vida y juego

- Calle o espacio pequeño que se siente vivo.
- Habitantes observables.
- Economía y gestión ligeras.
- Escala manejable y lectura inmediata.

### Hipótesis visual de trabajo

Mundo 3D ligero con cámara de maqueta inspirada principalmente en MiniTown; color y vegetación inspirados en Tiny Glade; arquitectura modular parcialmente informada por ISLANDERS; riqueza de objetos inspirada en Garden Galaxy; vida cotidiana y economía ligera informadas por Minami Lane.

Evitar personajes cabezones con apariencia de Funko. Para prototipos se permiten placeholders neutrales. No fijar todavía el diseño definitivo de las pets o world avatars.

## Alcance de la goal

La goal tiene seis frentes. Puede reorganizarlos cuando exista una dependencia real, pero no omitirlos silenciosamente.

## Frente A — Bridge v0.3

### A1. Auditoría real de fuentes Hermes

- Inspeccionar de forma sólo lectura las superficies públicas y archivos reales de Hermes 0.18.2.
- Localizar sesiones por perfil, formatos, identificadores, timestamps y señales de lifecycle.
- Diferenciar API pública, contrato estable e implementación interna.
- Documentar qué fuente cubre Desktop y qué puede servir como fallback.
- No exponer tokens, prompts completos, resultados o razonamiento.

### A2. Fallback de sesiones

- Implementar un lector por perfil únicamente para recuperación y modo degradado.
- No reemplazar al plugin como fuente primaria.
- Soportar los formatos reales encontrados; no inventar formatos.
- Manejar JSON, JSONL, SQLite u otro almacenamiento sólo si se confirma en la instalación real.
- Aplicar offsets/checkpoints, deduplicación y orden temporal.
- Marcar claramente la fuente de cada evento.

### A3. Checkpoints persistentes

- Persistir cursores suficientes para reiniciar sin reprocesamiento innecesario.
- Usar escritura atómica y esquema versionado.
- Recuperarse de checkpoint faltante o corrupto.
- Mantener replay completo como herramienta diagnóstica explícita.

### A4. Presencia por perfil

- Modelar `online`, `offline`, `degraded` y `unknown`.
- Registrar última señal y fuente activa.
- Evitar asumir que un puerto identifica permanentemente un perfil.
- No marcar offline porque muera un proceso si existe otra fuente válida para el mismo perfil.

### A5. Sesiones concurrentes

- Diseñar y probar múltiples sesiones activas para un mismo perfil.
- Mantener un registro por sesión, no sólo por personaje.
- Elegir una sesión dominante mediante reglas deterministas y documentadas.
- Evitar que el final de una sesión devuelva a `idle` si otra continúa trabajando.
- Exponer conteo de sesiones activas y actividad agregada segura.

### A6. Diagnósticos

- Añadir información operativa de sólo lectura: fuente primaria, fuente fallback, última señal, checkpoint, sesión dominante, sesiones activas, recuperación y estado degradado.
- Mantener `/health` simple y estable.
- No exponer datos sensibles.

### A7. Retención

- Diseñar rotación y retención segura del spool.
- No borrar eventos reales durante esta goal salvo archivos temporales creados por las propias pruebas.
- Proponer política y crear tooling reversible; no activar limpieza destructiva automáticamente.

## Frente B — Arquitectura del juego

Definir e implementar la base headless separando:

```text
Hermes → Bridge → Simulación → Presentación visual → Interacción
```

Crear contratos versionados para:

- reloj del mundo;
- personajes;
- lugares y edificios;
- rutinas y acciones;
- necesidades;
- inventario;
- economía;
- progresión;
- relaciones;
- misiones y eventos;
- guardado/carga;
- señales provenientes del bridge.

La simulación no debe importar código de Hermes ni depender del futuro renderer. El frontend debe poder reemplazarse sin reescribir reglas de juego.

## Frente C — Game Design v0.1

### C1. Bucle principal

Diseñar un bucle que combine observación, personalización y progreso:

```text
rutinas y actividad → recompensas → mejoras → nuevas posibilidades → mundo más vivo
```

Debe funcionar aunque no haya tareas reales de Hermes. Hermes enriquece el mundo, pero no puede ser la única forma de progresar.

### C2. Economía

Definir:

- nombre provisional de moneda;
- fuentes de ingreso;
- gastos y sumideros;
- costos de objetos, mejoras y edificios;
- recompensas por actividad real y simulada;
- límites diarios o rendimientos decrecientes cuando hagan falta;
- protección contra inflación y farming trivial;
- política de migración para cambios de balance.

No penalizar errores, cancelaciones o días sin productividad real.

### C3. Progresión

Diseñar progreso general y profesional:

- Syka: dirección, coordinación y creatividad.
- Elen: marketing y comunicación.
- Astrelis: comercio y relaciones.
- Zerny: construcción y CRM.

Considerar nivel, experiencia profesional, reputación, afinidad, rutinas desbloqueadas, objetos, hogar y oficina. Evitar árboles enormes sin impacto observable.

### C4. Necesidades y rutinas

Evaluar un conjunto pequeño como energía, concentración, ánimo, sociabilidad y comodidad. Implementar sólo las necesidades que generen decisiones o animaciones útiles.

Las rutinas deben ejecutarse localmente con máquinas de estado, behavior trees simples u otro sistema determinista justificado. No usar un LLM para caminar, dormir, comer o elegir una actividad cotidiana.

### C5. Recompensas, misiones y eventos

Diseñar:

- objetivos diarios y semanales;
- misiones personales;
- mejoras comunitarias;
- colecciones;
- logros;
- eventos pequeños de ciudad;
- celebraciones por hitos;
- recompensas principalmente cosméticas y expresivas.

### C6. Integración bridge-juego

Definir cómo cada evento real afecta la simulación:

- una tarea interrumpe o aplaza una rutina;
- el personaje viaja a un lugar de trabajo;
- herramientas cambian animación/objeto;
- waiting pausa visiblemente;
- completion otorga una recompensa moderada;
- failed/interrupted no castigan al jugador;
- al terminar se replanifica la rutina.

## Frente D — Simulador headless y balance

Construir una simulación ejecutable sin gráficos capaz de acelerar días o semanas.

Debe permitir semillas deterministas y producir métricas como:

- distribución de tiempo por actividad;
- ingresos y gastos;
- progresión por personaje;
- uso de edificios;
- frecuencia de eventos;
- necesidades fuera de rango;
- cantidad de decisiones ociosas;
- efecto de tareas Hermes simuladas;
- efecto de días sin Hermes.

Crear escenarios como mínimo:

1. día sin tareas reales;
2. carga normal repartida;
3. un perfil con muchas tareas;
4. varias sesiones concurrentes;
5. interrupciones y errores;
6. siete días de simulación acelerada;
7. treinta días para observar economía e inflación.

Ajustar parámetros con evidencia y conservar un reporte de balance. No buscar una economía perfecta; buscar una base comprensible y modificable.

## Frente E — Investigación y rescate

Auditar, cuando estén disponibles:

- Syka Pixel Office heredado;
- Hermes Office;
- Pixel Agents;
- Hermes Pixel Agents;
- Claw3D;
- My Virtual World;
- MiniTown;
- referencias adicionales estrictamente relevantes.

Para cada fuente registrar:

- licencia;
- stack;
- actividad/mantenimiento;
- arquitectura útil;
- código o assets potencialmente reutilizables;
- incompatibilidades;
- riesgos;
- decisión: rescatar, adaptar, estudiar o descartar.

No copiar código o assets sin licencia compatible y verificada.

## Frente F — Preproducción y laboratorio visual

### F1. Guía visual

Crear una guía basada en las referencias confirmadas:

- cámara;
- escala;
- geometría;
- paleta;
- vegetación;
- materiales;
- iluminación;
- arquitectura;
- interiores;
- densidad de objetos;
- personajes placeholder;
- animaciones de trabajo;
- ciclo día/noche;
- indicadores de estado;
- límites de rendimiento.

Separar “inspiración” de “requisito”. Registrar qué decisiones continúan abiertas.

### F2. Laboratorio aislado

Construir un prototipo separado del frontend definitivo con:

- una plaza;
- café;
- cuatro edificios de trabajo;
- caminos;
- vegetación;
- iluminación básica;
- interiores recortados o inspeccionables;
- cuatro placeholders neutrales;
- movimiento ambiental;
- ciclo día/noche mínimo;
- estados `idle`, `thinking`, `using-tool`, `waiting`, `done`, `interrupted`, `error` y `offline`;
- modo de datos simulados;
- conexión opcional de sólo lectura al bridge.

Preferir una implementación web ligera y aislada. Investigar y justificar la tecnología antes de adoptarla. No promover el prototipo como frontend definitivo.

### F3. Evaluación

Medir cuando sea práctico:

- tiempo de carga;
- estabilidad;
- CPU/GPU/memoria aproximadas;
- fluidez con cuatro personajes;
- facilidad para agregar objetos;
- facilidad para cambiar personajes;
- complejidad de empaquetado futuro.

## Pruebas de caos obligatorias

Ejecutar en entornos temporales o procesos controlados:

- duplicados;
- eventos atrasados;
- eventos fuera de orden;
- línea JSONL parcial;
- archivo corrupto;
- rotación/truncado;
- reinicio del bridge;
- caída de un backend Hermes controlado;
- dos sesiones del mismo perfil;
- plugin ausente con fallback disponible;
- plugin y fallback activos simultáneamente;
- checkpoint corrupto;
- frontend desconectado y reconectado.

No matar ni interrumpir una sesión real del usuario para probar caos. Lanzar procesos controlados propios cuando sea necesario.

## Reglas de autonomía

La goal puede decidir de forma autónoma cuando la decisión sea reversible, aislada y esté respaldada por pruebas. Debe registrar decisiones importantes en ADRs o `docs/DECISIONS.md`.

Puede:

- crear y modificar archivos dentro de la raíz canónica;
- ejecutar pruebas;
- iniciar servidores y backends temporales controlados;
- investigar documentación y repositorios públicos;
- crear prototipos aislados;
- instalar dependencias locales al proyecto cuando estén justificadas, fijadas y documentadas;
- mejorar documentación y tareas.

No puede sin nueva autorización:

- publicar o desplegar;
- enviar mensajes externos;
- ejecutar tareas reales de marketing, ventas o CRM;
- modificar datos reales de negocio;
- reemplazar el frontend definitivo;
- rediseñar de forma definitiva las pets;
- activar gastos de APIs;
- instalar inicio automático en Windows;
- borrar el proyecto heredado;
- copiar código o assets con licencia incierta;
- hacer cambios destructivos fuera de la raíz canónica;
- cerrar una sesión real activa de Hermes para una prueba.

Si una decisión bloquea sólo el frente visual, continuar con backend, simulación, pruebas y documentación. No detener toda la goal por una preferencia artística pendiente.

## Política de calidad

- Inspeccionar antes de modificar.
- Preservar comportamiento ya comprobado.
- Mantener cambios pequeños y verificables.
- No presentar mocks como integraciones reales.
- No declarar rendimiento sin medirlo.
- No declarar una fuente pública/estable sin evidencia.
- No guardar prompts completos, razonamiento o secretos.
- Mantener la raíz canónica limpia; temporales en `.runtime` o directorios ignorados.
- No hacer commit, push o publicación salvo autorización explícita.

## Entregables esperados

Como mínimo:

1. Bridge v0.3 o informe preciso de cualquier parte bloqueada.
2. Fallback por sesiones probado contra formatos reales.
3. Checkpoints persistentes.
4. Modelo de presencia y concurrencia.
5. Diagnósticos de sólo lectura.
6. Suite ampliada de pruebas y caos.
7. Arquitectura versionada de simulación.
8. Game Design Document v0.1.
9. Diseño de economía y progresión.
10. Diseño de rutinas y necesidades.
11. Simulador headless determinista.
12. Escenarios y reporte de balance.
13. Auditoría de referencias y rescate.
14. Guía visual basada en MiniTown, Tiny Glade, ISLANDERS, Garden Galaxy y Minami Lane.
15. Laboratorio visual aislado ejecutable.
16. Informe técnico del laboratorio.
17. ADRs/decisiones.
18. `CURRENT_PROJECT_STATE.md`, `TASKS.md`, `README.md` y runbooks actualizados.
19. Resumen final con pruebas ejecutadas, resultados, limitaciones y próximos pasos.

## Criterio de finalización

La goal sólo se considera completa cuando:

1. el bridge conserva el comportamiento v0.2 y las pruebas anteriores;
2. fallback, checkpoints, presencia y concurrencia tienen código y pruebas o un bloqueo externo demostrado;
3. la simulación puede ejecutar al menos 30 días deterministas sin frontend;
4. economía, rutinas y progresión están documentadas y ejercitadas por escenarios;
5. las pruebas de caos relevantes pasan;
6. el laboratorio visual arranca de forma reproducible y puede usar datos simulados;
7. al menos una secuencia completa de estados se representa en el laboratorio;
8. no quedan procesos temporales ni puertos de validación abiertos;
9. la documentación distingue claramente comprobado, prototipo y propuesta;
10. no queda trabajo seguro y claramente incluido en el alcance sin intentar.

Un bloqueo artístico no impide completar los entregables técnicos. Un bloqueo externo debe documentarse con evidencia, alternativas probadas y el punto exacto que requiere al usuario.

## Presupuesto sugerido

Entre 120.000 y 150.000 tokens. Para una ejecución nocturna amplia, usar 150.000 tokens si Sikora lo autoriza explícitamente.

## Texto recomendado para iniciar la goal

Sin presupuesto explícito:

```text
/goal Lee por completo docs/GOAL_OVERNIGHT_FOUNDATIONS_V1.md y ejecuta esa goal de manera autónoma. Respeta su alcance, reglas, entregables y criterios de finalización. No hagas commits, pushes, publicaciones ni cambios externos irreversibles.
```

Con presupuesto explícito:

```text
/goal Crea una goal con presupuesto de 150000 tokens. Lee por completo docs/GOAL_OVERNIGHT_FOUNDATIONS_V1.md y ejecútala de manera autónoma. Respeta su alcance, reglas, entregables y criterios de finalización. No hagas commits, pushes, publicaciones ni cambios externos irreversibles.
```

