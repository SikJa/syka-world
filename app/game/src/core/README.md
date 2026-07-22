# Syka World game core

Este directorio contiene reglas puras y serializables. No importa Phaser, DOM,
Hermes ni el cliente HTTP del bridge.

## Contratos

- `contracts.ts`: esquemas versionados para mapa, catálogo, edificios,
  interiores, cámara, agentes, señales del bridge y save.
- `catalog.ts`: kit funcional mínimo de casa, café, oficinas, taller, espacio
  comunitario, mobiliario predeterminado y mejora del café.
- `state.ts`: fixtures reproducibles de modo muestra y partida progresiva.

## Sistemas

- `map.ts`: footprints rotables, acceso por camino, colisión y sectores.
- `economy.ts`: Lúmenes sin saldos negativos ni castigos productivistas.
- `construction.ts`: compra, tres etapas, amueblado automático, mejora,
  decoración opcional y expansión de sector.
- `pathfinding.ts` y `agents.ts`: A* cardinal limitado, rutina determinista de
  cuatro perfiles y proyección segura de señales concurrentes.
- `navigation.ts`: transición a interior aislado conservando la cámara urbana.
- `simulation.ts`: tick único de construcción, reloj, agentes y progreso local.
- `save.ts` y `storage.ts`: validación, migración explícita y almacenamiento de
  dos fases mediante un adaptador inyectado.

## Invariantes

1. Hermes nunca se importa ni recibe comandos desde este núcleo.
2. Ocultar agentes no detiene el reloj ni las rutinas.
3. Un fallo o interrupción del bridge no resta Lúmenes.
4. Un edificio terminado nace amueblado; decorar después es opcional.
5. Un save desconocido se rechaza, nunca se interpreta silenciosamente.
6. Misma entrada + mismo estado produce el mismo resultado.
