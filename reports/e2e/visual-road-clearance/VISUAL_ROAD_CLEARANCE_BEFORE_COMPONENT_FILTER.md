# Visual road clearance gate

**Resultado:** FAIL

Máscara alfa mínima: 48; distancia requerida: 2 px (un píxel completo de pasto entre edificio y carretera).
Contacto de suelo: envolvente inferior de 3 px dentro de la banda baja de 40 px del sprite.

| Edificio | Distancia | Gap visible | Pasto probado | Segmentos cercanos | Resultado |
|---|---:|---:|:---:|---|:---:|
| home-syka | 5 | 4 | sí | 3,7 | PASS |
| home-elen | 5 | 4 | sí | 10,7 | PASS |
| home-astrelis | 5 | 4 | sí | 16,7 | PASS |
| home-zerny | 5 | 4 | sí | 23,7 | PASS |
| cafe-main | 2 | 1 | sí | 7,10, 7,11 | PASS |
| office-marketing | 0 | 0 | no | 7,12 | FAIL |
| office-commercial | 3 | 2 | sí | 15,14, 19,11, 19,10 | PASS |
| workshop-crm | 2 | 1 | sí | 22,14 | PASS |
| community-main | 2 | 1 | sí | 13,20 | PASS |

Captura enfocada: `reports/e2e/visual-road-clearance/screenshots/road-clearance-cafe-main.png`

La medición usa los frames raster y escalas exactas cargadas por Phaser; no infiere separación desde `occupiedTiles`.

## Falla

AssertionError: Opaque building pixels lack a full grass gap: office-marketing distance=0 segments=7,12
