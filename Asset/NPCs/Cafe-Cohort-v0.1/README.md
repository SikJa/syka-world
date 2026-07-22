# Cafe Cohort v0.1

Estado: **fuente conceptual preservada; derivado runtime aprobado el 2026-07-16**.

Este paquete explora un pequeño elenco secundario para darle microvida al Café Biblioteca sin confundir NPCs con Syka, Elen, Astrelis o Zerny. Sus imágenes siguen siendo dirección de identidad, silueta, paleta, escala y acciones: no se importan directamente en el juego. El runtime usa un derivado independiente, generado y normalizado, en `app/game/public/assets/generated/npc-v1/`.

## Contenido

- `cafe-npc-cast-concept-v1.png`: cinco identidades, reversos y poses de rol.
- `cafe-npc-pose-matrix-v1.png`: matriz de idle, caminata, trabajo y socialización.
- `cafe-npc-microlife-scene-v1.png`: prueba del elenco dentro del Café Biblioteca al atardecer.
- `NPC_ROSTER.md`: ficha narrativa y visual de cada NPC.
- `MICRO_LIFE_NOTES.md`: ideas de comportamiento interior y exterior, sólo conceptuales.
- `PROMPTS_AND_PROVENANCE.md`: prompts completos, referencias, procedencia y revisión visual.
- `manifest.json`: inventario verificable del paquete.
- `app/game/public/assets/generated/npc-v1/cafe-npcs-atlas-v1.png`: derivado runtime aprobado, fuera de esta carpeta conceptual.
- `app/game/public/assets/generated/npc-v1/asset-provenance.md`: prompt, referencias y corrección técnica del derivado.

## Reglas de aislamiento

1. No importar los PNG conceptuales desde Phaser, TypeScript, bridge ni simulación; el único asset cargable es el atlas derivado con manifest y provenance propios.
2. No asignar perfiles Hermes, sesiones, recompensas o tareas a estos NPCs.
3. No tratar los conceptos como sprites listos ni reemplazar el atlas normalizado por un escalado directo de estas imágenes.
4. Mantener las rutinas locales separadas de Hermes y validar cualquier cambio de escala o pose dentro del Café real.

## Resultado de revisión

- Las cinco siluetas se distinguen por forma, color y prop principal.
- Las identidades permanecen coherentes entre hoja de elenco, matriz de poses y escena.
- El bartender se reconoce de inmediato por delantal, pañuelo y bandeja/cafetera.
- La escena contiene exactamente los cinco NPCs y conserva el lenguaje visual cálido del Café.
- No hay texto, logos, marcas de agua ni semejanza intencional con los cuatro protagonistas.

El derivado aprobado usa un atlas 640×640 de 5 columnas × 4 filas, celdas 128×160 y pivote común. La generación no respetó inicialmente límites matemáticos perfectos; `scripts/normalize_cafe_npc_atlas.py` recortó huecos, normalizó las poses con nearest-neighbour y preservó la fuente original. El manifest y los hashes viven junto al atlas.
