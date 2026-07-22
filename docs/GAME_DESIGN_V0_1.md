# Game Design Document v0.1

Estado: base jugable ejercitada por el simulador; valores sujetos a balance.

## Fantasía

Syka World es una maqueta viva y personal. El jugador observa a Syka, Elen, Astrelis y Zerny tener una vida cotidiana, embellece sus espacios y ve cómo el trabajo real de Hermes se vuelve movimiento legible. No es un tablero de productividad disfrazado de juego.

## Bucle principal

```text
rutinas y actividad
  → Lúmenes, experiencia y recuerdos visibles
  → decoración, edificios y nuevas rutinas
  → más variedad y personalidad
  → un mundo más agradable de observar
```

La vida local siempre produce progreso. Hermes agrega momentos especiales y acelera moderadamente algunas rutas, pero un día sin tareas reales sigue siendo un día válido.

## Agencia del jugador

Primera capa:

- observar;
- inspeccionar personaje o edificio;
- adelantar/pausar el reloj del juego;
- decorar con objetos ganados;
- elegir pequeñas mejoras;
- usar modo Explore sin colocar nada.

Capas posteriores:

- órdenes espaciales locales;
- construcción y zonificación;
- chat y trabajo real con frontera de permisos separada.

## Moneda

Nombre provisional: **Lúmenes** (`L`). Representa energía creativa y vida acumulada, no dinero real ni medición laboral.

Fuentes actuales:

- práctica profesional local;
- vida comunitaria;
- misión diaria y semanal;
- tarea Hermes completada.

Sumideros actuales o preparados:

- costo de vida abstracto;
- mantenimiento de la ciudad;
- colección semanal de decoración;
- más adelante: muebles, vegetación, mejoras de hogar/oficina y edificios.

Una tarea fallida, interrumpida o cancelada nunca resta Lúmenes. Tampoco hay multa por no usar Hermes.

## Recompensa Hermes

Las primeras cuatro finalizaciones diarias por personaje dan 5 L. Las siguientes dan 1 L. Esto conserva el momento de celebración sin volver óptimo fabricar tareas triviales. La vida local sigue generando la mayoría de la estructura cotidiana.

## Costos objetivo para el vertical slice

| Compra | Rango inicial |
|---|---:|
| objeto pequeño | 4–10 L |
| planta o luz | 8–16 L |
| mueble expresivo | 15–30 L |
| set temático | 40–75 L |
| mejora de habitación | 80–140 L |
| mejora de edificio | 180–320 L |

Los objetos cosméticos no deben bloquear estados funcionales del bridge.

## Progresión

Hay nivel general y experiencia profesional. El nivel desbloquea pocas cosas observables: nuevas poses, objetos de rol, variantes de rutina y mejoras de espacio. No se diseña todavía un árbol grande.

Rutas profesionales:

- Syka: dirección, coordinación y creatividad.
- Elen: marketing y comunicación.
- Astrelis: comercio y relaciones.
- Zerny: construcción y CRM.

También existen reputación, afinidad y colecciones como contratos, pero no se aceleran hasta que produzcan decisiones visibles.

## Necesidades

Se conservan cinco porque todas pueden traducirse en una acción legible:

- energía → dormir o descansar;
- concentración → pausa o café;
- ánimo → ocio o personalización;
- sociabilidad → plaza/café;
- comodidad → hogar y decoración.

No hay hambre, higiene, vejiga ni salud en v0.1. Añadirlas ahora generaría mantenimiento sin enriquecer la fantasía.

## Rutina base

| Hora | Actividad preferida |
|---|---|
| 22:00–07:00 | dormir en casa |
| 07:00–09:00 | rutina de mañana en café |
| 09:00–12:00 | práctica profesional local |
| 12:00–14:00 | socializar/almorzar |
| 14:00–17:00 | práctica profesional local |
| 17:00–20:00 | vida comunitaria en plaza |
| 20:00–22:00 | personalizar o descansar en casa |

Una necesidad crítica puede reemplazar el bloque. Una tarea Hermes aplaza la rutina y, al terminar, el selector recalcula desde el estado actual.

## Misiones y eventos

Implementado:

- objetivo diario de dos acciones significativas;
- objetivo semanal de vida comunitaria;
- finalización Hermes como evento moderado.

Diseñado para siguientes iteraciones:

- misión personal por rol;
- proyecto comunitario compartido;
- colección de plantas, luminarias y objetos de escritorio;
- celebración de nivel, nuevo edificio o aniversario del mundo;
- pequeños eventos: mercado, lluvia, picnic, visita entre agentes.

Las recompensas deben ser principalmente expresivas. No habrá rachas que castiguen días ausentes.

## Victoria y fracaso

No existe derrota global. El objetivo es construir una historia visual acumulativa. El jugador “gana” cuando el mundo se siente más propio, variado y vivo. Errores de herramientas son estados narrativos breves, no fracasos morales ni económicos.
