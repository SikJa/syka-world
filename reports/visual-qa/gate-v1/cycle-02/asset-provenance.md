# Procedencia de assets — gate visual ciclo 02

Fecha: 2026-07-16  
Estado: candidatos de integración; ningún PNG se declara todavía arte final.

## Familias visibles

| Familia | Origen | Runtime | Estado |
|---|---|---|---|
| Casa | Generación original para Syka World mediante la herramienta integrada `image_gen` | `house-exterior-v1.png`, crop declarado | Provisional apto para gate |
| Cafetería | Generación original para Syka World mediante la herramienta integrada `image_gen` | `cafe-exterior-v1.png`, crop declarado | Provisional apto para gate |
| Vegetación y mobiliario | Generación original para Syka World mediante `image_gen`; limpieza chroma y crops propios | `environment-props-sheet-v1.png` | Provisional apto para gate |
| Microdetalles de suelo | Generación original para Syka World mediante `image_gen`; hoja de 12 decals con distribución escasa | `ground-decals-sheet-v1.png` | Provisional apto para gate |
| Terreno, asfalto y acera | Generación original para Syka World mediante `image_gen`; normalización nearest a diamante 2:1 | `terrain-tiles-atlas-v1.png` | Provisional apto para gate |
| Borde lateral de la isla | Geometría original del renderer, color plano | runtime | Provisional declarado |
| HUD mínimo | Tipografía y formas originales del frontend | runtime | Provisional declarado |

No se incorporaron assets, recortes ni texturas de juegos comerciales. Las referencias aprobadas se usaron únicamente para dirección visual y no se cargan en el runtime.

La procedencia completa, prompts, flujo chroma, validaciones alpha, archivos superados y limitaciones se conserva en:

- `app/game/public/assets/generated/gate-v2/asset-provenance.md`
- `app/game/public/assets/generated/gate-v2/atlas-manifest.json`

Clasificación interna: `Syka World project-generated asset; uso dentro del proyecto`. No se declara aún una licencia pública individual para los PNG.
