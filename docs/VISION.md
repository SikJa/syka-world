# Visión de Syka World

## La fantasía central

Syka World convierte agentes invisibles en habitantes visibles. El placer principal no es administrar un dashboard: es observar un mundo personal que se siente vivo y que refleja, de manera legible y entretenida, el trabajo real que ocurre en Hermes.

Es un hobby de largo plazo, no un producto pensado inicialmente para venderse. El mundo crecerá por capas, como un juego personal que siempre puede recibir nuevos lugares, rutinas, sistemas y personajes.

## Bucle inicial

1. Cuando no hay trabajo real, los personajes caminan, descansan, visitan lugares y cumplen rutinas locales predefinidas.
2. Cuando un perfil Hermes recibe una tarea desde chat, API, Telegram o Gateway, el personaje correspondiente deja su rutina.
3. El personaje se desplaza a un lugar coherente y representa `thinking`, `working`, `waiting`, `done` o `error` mediante animaciones.
4. Al terminar, vuelve gradualmente a su vida ambiental.

## Tres capas de interacción

### Capa 1 — vida y representación pasiva

El mundo observa Hermes. No inicia trabajo. La vida ambiental no usa tokens.

### Capa 2 — órdenes del mundo

El jugador puede dar órdenes espaciales o lúdicas: ir al café, volver a casa, reunirse o usar un objeto. Estas órdenes modifican el mundo, no ejecutan Hermes.

### Capa 3 — trabajo dentro del mundo

Cada personaje puede tener chat, continuidad de sesión y tareas reales. Esta capa deberá distinguir claramente juego y ejecución, exigir confirmaciones cuando corresponda y respetar los permisos del perfil.

## Personajes iniciales

- Syka — perfil `default`; habitante principal y centro del mundo.
- Elen — operadora de marketing.
- Astrelis — operador comercial.
- Zerny — constructor y trabajador de CRM.

Sus identidades visuales se conectarán con las pets existentes o con nuevos personajes personalizados.

## Dirección visual

MiniTown es la referencia principal de experiencia: cámara ligeramente elevada, observación placentera, residentes con hogares/destinos, edificios inspeccionables, crecimiento gradual y ambiente acogedor con ciclo día/noche.

Esto no fija todavía la tecnología. La primera prueba puede ser 2D o 2.5D para mantener el proyecto liviano. La elección final entre 2D, 2.5D y 3D se tomará mediante prototipos pequeños, no por entusiasmo con una sola captura.

La adaptación completa del prompt y el alcance recomendado del primer vertical slice están en [Referencia visual — MiniTown adaptado a Syka World](VISUAL_REFERENCE_MINITOWN.md).

## Futuro deseado

El mundo podrá incorporar casas, oficinas, café, tiendas, monedas, recompensas, horarios, relaciones tipo Sims, diálogos y cerebros autónomos económicos. Estas capas se agregan después de que el bridge pasivo y el bucle visual sean confiables.

## Principios innegociables

- Hermes es la fuente de verdad del trabajo real.
- La simulación ambiental debe poder funcionar sin LLM.
- El mundo no ejecuta tareas reales por accidente.
- El frontend heredado se reemplaza.
- Se rescata código sólo con evidencia de que funciona y encaja.
- Bridge, simulación y renderizado permanecen desacoplados.
- La primera versión es web local; el empaquetado de escritorio se decide después.
