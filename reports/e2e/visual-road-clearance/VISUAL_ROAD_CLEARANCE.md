# Visual road clearance gate

**Resultado:** PASS

Máscara alfa mínima: 48; distancia requerida: 2 px (un píxel completo de pasto entre edificio y carretera).
Contacto de suelo: envolvente inferior de 3 px dentro de la banda baja de 40 px del sprite.
Componentes: sólo máscaras conectadas que llegan a 12 px del fondo global del sprite.

| Edificio | Sin filtro comp. | Refinado | Gap visible | Pasto probado | Segmentos cercanos | Resultado |
|---|---:|---:|---:|:---:|---|:---:|
| home-syka | 3 | 3 | 2 | sí | 3,7, 2,7 | PASS |
| home-elen | 3 | 3 | 2 | sí | 10,7, 9,7 | PASS |
| home-astrelis | 3 | 3 | 2 | sí | 16,7, 15,7 | PASS |
| home-zerny | 3 | 3 | 2 | sí | 23,7, 22,7 | PASS |
| cafe-main | 5 | 5 | 4 | sí | 3,14, 2,14 | PASS |
| office-marketing | 0 | 4 | 3 | sí | 10,14 | PASS |
| office-commercial | 2 | 2 | 1 | sí | 19,11, 19,10 | PASS |
| workshop-crm | 2 | 2 | 1 | sí | 22,14 | PASS |
| community-main | 2 | 2 | 1 | sí | 13,20, 14,20 | PASS |

Captura enfocada: `reports/e2e/visual-road-clearance/screenshots/road-clearance-cafe-main.png`
Captura del taller: `reports/e2e/visual-road-clearance/screenshots/road-clearance-workshop-crm.png`

La medición usa los frames raster y escalas exactas cargadas por Phaser; no infiere separación desde `occupiedTiles`.
Consola accionable: 0; ruido WebGL ReadPixels ignorado: 4.
