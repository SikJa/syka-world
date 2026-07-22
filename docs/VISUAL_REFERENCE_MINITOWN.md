# Referencia visual — MiniTown adaptado a Syka World

Estado: referencia de dirección visual; no es todavía un prompt de implementación ni una decisión de motor.

Fuente original preservada en Obsidian: `03 Proyectos/Syka World/Fuentes/MiniTown - Prompt original de Codex.md`.

## Qué conservamos de MiniTown

- Mundo acogedor cuyo placer principal es observar.
- Cámara ligeramente elevada para leer la ciudad completa.
- Estética retro con sabor pixel art y formas simples, técnicamente alcanzables.
- Habitantes con hogares, trabajos, horarios y destinos.
- Movimiento visible de personas y, más adelante, vehículos.
- Inspección por hover/click para saber quién está en un lugar y qué está haciendo.
- Ciclo día/noche con colores fríos de noche y luces cálidas en edificios ocupados.
- Modo Explore para recorrer sin colocar ni ordenar nada.
- Crecimiento progresivo y variedad suficiente para que la ciudad no se sienta repetitiva.

## Qué cambia para Syka World

MiniTown simula residentes genéricos. Syka World representa identidades y actividad reales:

- Syka vive en el mundo y corresponde al perfil Hermes `default`.
- Elen tiene hogar y espacio de marketing.
- Astrelis tiene hogar y espacio comercial/estratégico.
- Zerny tiene hogar y taller/oficina de construcción y CRM.
- La ciudad recibe eventos del bridge y transforma `idle`, `thinking`, `working`, `waiting`, `done` y `error` en desplazamientos, destinos, poses, animaciones y señales ambientales.
- La vida local sigue funcionando cuando no hay tareas reales.
- Inspeccionar un personaje o edificio muestra estado visual seguro; no expone razonamiento interno completo.
- Las pets actuales pueden aparecer como placeholders en el visor técnico, pero el mundo definitivo usará avatares adaptados a una perspectiva, escala y dirección artística comunes.

## Qué no necesita el primer vertical slice

El prompt original incluye zonificación, construcción por etapas, crecimiento de edificios, carreteras automáticas y bloques conectados. Son buenas mecánicas futuras, pero no son necesarias para probar la fantasía central.

El primer vertical slice puede usar una ciudad pequeña prearmada con:

1. plaza o espacio común;
2. cuatro hogares;
3. oficina central;
4. estudio de marketing;
5. oficina comercial;
6. taller/CRM;
7. café o zona de descanso.

Debe demostrar:

- vida ambiental;
- transición visible desde idle hacia trabajo real;
- llegada al lugar correcto;
- pensamiento y trabajo distinguibles;
- finalización y regreso gradual a la rutina;
- inspección simple;
- cambio de día a noche.

## Evolución visual por etapas

### Etapa visual A — conceptos

Antes de construir el frontend definitivo, usar `imagegen` para producir conceptos técnicamente alcanzables:

1. vista general diurna del pueblo pequeño;
2. escena de agentes trabajando en sus edificios;
3. estado nocturno acogedor;
4. vista de inspección con un personaje o edificio seleccionado.

Cada concepto debe probar una pregunta visual concreta. No usar concept art imposible de reproducir en tiempo real.

### Etapa visual B — prototipos

Comparar pequeños prototipos 2D, 2.5D y 3D estilizado considerando:

- legibilidad de personajes;
- claridad de rutas y edificios;
- rendimiento con la app abierta muchas horas;
- facilidad para crear assets personalizados;
- animaciones y ciclo día/noche;
- esfuerzo de mantenimiento.

### Etapa visual C — mundo extensible

Después del bridge y el vertical slice:

- colocar zonas;
- construir edificios por etapas;
- generar carreteras;
- conectar bloques;
- incorporar tiendas, vehículos, moneda, recompensas y crecimiento.

## Prompt estructurado para futuros conceptos

```text
Use case: stylized-concept
Asset type: game environment concept art for a technically achievable local web game
Primary request: Design Syka World, a cozy observational town where four real Hermes AI agents live ordinary local lives and visibly transition into thinking and working when their real profiles receive tasks.
Scene/backdrop: A compact, readable town with a central plaza, four homes, a shared office, a marketing studio, a commercial strategy office, a CRM workshop, and a café. Clear paths connect every destination.
Subject: Four distinct recurring inhabitants — Syka, Elen, Astrelis, and Zerny — shown at readable scale with clear silhouettes and different homes/workplaces.
Style/medium: Retro-inspired, pixel-art-flavored stylized game world; simple geometry and materials achievable in a real-time web renderer; cozy god-game feeling.
Composition/framing: Slightly top-down camera showing most of the town; readable routes, buildings, inhabitants, and activity at a glance; no cinematic low-angle framing.
Lighting/mood: Warm, peaceful, playful and inhabited. Prepare compatible daytime and nighttime directions; nighttime uses soft cool ambient colors with warm windows and streetlights.
Interaction cues: Buildings and residents should feel inspectable. Visual language must support idle, thinking, working, waiting, done, and error without relying on dense dashboard UI.
Constraints: Observation is the main pleasure; the world must feel alive even without AI calls; keep assets and effects technically reproducible; preserve room for future expansion.
Avoid: Huge generic metropolis, photorealism, excessive cyberpunk dashboard UI, illegible tiny characters, impossible concept-art complexity, heavy particle effects, text labels, logos, and watermarks.
```

Este prompt es para concept art futuro. Cuando se use, se generará una imagen por estado visual y se validará antes de pasar al siguiente.
