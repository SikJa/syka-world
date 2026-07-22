# Procedencia de assets — gate visual ciclo 03

Fecha: 2026-07-16  
Estado: kit provisional sometido a gate; no se declara arte final.

## Familias visibles

| Familia | Origen | Runtime | Estado |
|---|---|---|---|
| Casa | Generación original para Syka World mediante `image_gen` | `gate-v2/house-exterior-v1.png` | Provisional |
| Cafetería | Generación original para Syka World mediante `image_gen` | `gate-v2/cafe-exterior-v1.png` | Provisional |
| Vegetación y mobiliario | Generación original, chroma limpiado y crops explícitos | `gate-v2/environment-props-sheet-v1.png` | Provisional |
| Microdetalles de suelo | Generación original; doce decals distribuidos de forma escasa | `gate-v2/ground-decals-sheet-v1.png` | Provisional |
| Terreno v2 | Nueva generación original y normalización 2:1 sin outline perimetral | `gate-v2/terrain-tiles-atlas-v2.png` | Provisional preferido |
| Iluminación localizada | Generación original; seis máscaras pixeladas con alpha parcial | `gate-v3/light-fx-sheet-v1.png` | Provisional preferido |
| Borde de isla y HUD | Formas originales del renderer/frontend | runtime | Provisional declarado |

No se cargan en runtime las referencias conceptuales ni assets de juegos comerciales. La generación usó la herramienta integrada `image_gen`; el chroma, alpha, normalización nearest, crops, pivotes y validaciones están documentados en:

- `app/game/public/assets/generated/gate-v2/asset-provenance.md`
- `app/game/public/assets/generated/gate-v2/atlas-manifest.json`
- `app/game/public/assets/generated/gate-v2/ground-decals-manifest.json`
- `app/game/public/assets/generated/gate-v2/terrain-tiles-manifest-v2.json`
- `app/game/public/assets/generated/gate-v3/asset-provenance.md`
- `app/game/public/assets/generated/gate-v3/light-fx-sheet-v1.manifest.json`

Clasificación interna: `Syka World project-generated asset; uso dentro del proyecto`. No se declara aún una licencia pública individual para cada PNG.
