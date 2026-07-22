# Syka World — Revisión del gate visual, ciclo 2

Fecha: 2026-07-16  
Revisor independiente: `visual_director_qa_cycle2`  
Rúbrica aplicada: `reports/visual-qa/VISUAL_GATE_RUBRIC_V1.md`  
Referencia principal: `research/visual-concepts/approved-direction-v1/city-layout-a-twilight.png`

## Veredicto

```text
VEREDICTO: RECHAZADO — ITERAR
PUNTUACIÓN: 65,0/100
AUTORIZACIÓN PARA ESCALAR LA CIUDAD: NO AUTORIZADA
```

El ciclo 2 reemplaza correctamente el placeholder procedural dominante por un kit raster original y supone un salto visual material respecto del ciclo 1. La casa y la cafetería ya son siluetas cálidas, distintas y reconocibles; la captura es nítida y la evidencia es reproducible. Sin embargo, todavía no alcanza el gate para escalar: terreno y sprites no forman un conjunto suficientemente homogéneo, bancos y faroles tienen escala/implantación incorrectas, quedan seams visuales de teselación y la noche se obtiene principalmente oscureciendo el estado de atardecer sin una contribución local de luces comparable con la referencia.

## Integridad de evidencia

- [x] Seis capturas PNG directas de 1440×900.
- [x] Viewport 1440×900 CSS px y `devicePixelRatio: 1` declarados.
- [x] Zooms de juego 100%, 150% y 200% reproducibles, con el mismo ancla de cámara (`scrollX: 540`, `scrollY: 20`).
- [x] Estados atardecer 19:15 y noche 22:00.
- [x] Doce frames 1440×900 de pan a 150%; todos tienen hashes distintos y muestran desplazamiento progresivo.
- [x] `capture-metadata.json`, `browser-state.txt`, `asset-provenance.md` e `implementation-notes.md` presentes.
- [x] Sin errores de consola o página registrados.
- [x] Procedencia ampliada y crops/pivotes documentados en el manifiesto enlazado.

Las seis capturas son RGB 1440×900 y poseen SHA-256 distintos. Las parejas atardecer/noche cambian materialmente: en el área de mundo analizada cambia aproximadamente 98% de los píxeles. Esa diferencia objetiva resuelve el fallo de identidad byte por byte del ciclo 1, pero la inspección visual muestra que casi todo el cambio es un tinte/oscurecimiento global.

## Score

| # | Criterio | Peso | Nota | Puntos | Evidencia concreta |
|---:|---|---:|---:|---:|---|
| 1 | Proyección isométrica y cámara fija | 10 | 4/5 | 8,0 | Terreno, vías, arquitectura y props conservan ejes 2:1 y una única dirección. Los doce frames demuestran pan sin rotación ni cambio de perspectiva. Quedan pequeñas ambigüedades de apoyo de sprites generados sobre el tile, por lo que no llega a 5. |
| 2 | Composición y lectura espacial | 8 | 3/5 | 4,8 | La intersección organiza con claridad casa y café, pero el fragmento está partido entre una mitad superior edificada y grandes paños de césped inferior/izquierdo. Se lee más como muestra de dos assets que como un pequeño trozo terminado de ciudad. |
| 3 | Proporciones y escala | 8 | 3/5 | 4,8 | Edificios, puertas y árboles son plausibles entre sí. Los dos bancos ocupan demasiado espacio para su función y quedan girados/desplazados respecto de senderos; varios faroles invaden el asfalto o se apoyan en el eje interior de la acera, en vez de bordes/esquinas seguras. Este defecto se repite en 100%, 150% y 200%. |
| 4 | Nitidez y estabilidad de píxel | 15 | 4/5 | 12,0 | Las tres escalas son nítidas, nearest-neighbor y sin blur bilinear visible. El pan mantiene contornos estables y no muestra saltos dominantes de sorting. No llega a 5 por las líneas periódicas del terreno y pequeños cambios de cadencia de cluster a 150%. |
| 5 | Coherencia entre tiles y sprites | 10 | 3/5 | 6,0 | Casa, café, árboles y props comparten paleta, contorno y dirección. El suelo, en cambio, tiene una retícula punteada mucho más mecánica y una densidad de detalle inferior; los edificios parecen colocados sobre una base de otro nivel de acabado. |
| 6 | Arquitectura y siluetas exteriores | 8 | 4/5 | 6,4 | La casa se reconoce por acceso, chimenea, cerca, buzón y jardín; la cafetería por toldo, escaparate, terraza, mesas, madera y vegetación. Son distintas sin rótulos y tienen varios planos. Aún falta integrarlas al lote mediante accesos y contacto/sombra de suelo más convincentes. |
| 7 | Densidad y narrativa de objetos | 10 | 3/5 | 6,0 | Existen microgrupos residenciales y de cafetería, más bancos, flores y jardineras públicas. La densidad sigue concentrada en los propios sprites de edificio; el espacio público repite farol–banco–flor sin relaciones funcionales claras y deja zonas amplias sin narrativa. |
| 8 | Vegetación y props ambientales | 8 | 3/5 | 4,8 | Hay dosel, masa media y acentos, con dos siluetas de árbol, setos, arbustos, jardineras, flores y microdecals. La distribución es dispersa y mecánica; los faroles dominan por número y ubicación, mientras bancos y vegetación no forman suficientes bordes de lote o rincones intencionales. |
| 9 | Iluminación de atardecer y noche | 12 | 2/5 | 4,8 | La noche ya es distinta y sigue navegable, pero se comporta principalmente como un oscurecimiento global. El atardecer parece pleno día por el fondo celeste y el césped amarillo-verde; ventanas y faroles brillan, pero no proyectan una contribución ámbar localizada legible sobre acera, fachada o vegetación. No reproduce el contraste frío/cálido que define la referencia A. |
| 10 | Paleta, contraste y materiales | 5 | 3/5 | 3,0 | Asfalto, acera, césped, madera, techo y luz se separan. La familia arquitectónica es acogedora, pero el césped demasiado luminoso/saturado y el fondo celeste plano reducen el ambiente de atardecer; en noche, los materiales pierden jerarquía de forma bastante uniforme. |
| 11 | Orden de profundidad, seams y oclusión | 4 | 3/5 | 2,4 | No hay fachadas atravesadas ni saltos de orden dominantes durante pan. Sí aparecen juntas oscuras/punteadas repetidas entre diamantes de césped, asfalto y acera, especialmente visibles en `twilight-z200-1440x900.png`; algunos faroles se superponen a calle y banco de manera espacialmente confusa. |
| 12 | Originalidad y legitimidad de runtime | 2 | 5/5 | 2,0 | La escena usa assets originales generados para Syka World, con prompts, chroma, alpha, crops, pivotes, atlas y estado provisional documentados. No se detecta reutilización de referencias o assets comerciales en runtime. |
|  | **Total** | **100** |  | **65,0** | Umbral requerido: 85,0 y todos los críticos ≥4/5. |

## Criterios críticos incumplidos

- proporciones y escala: 3/5;
- coherencia entre tiles y sprites: 3/5;
- iluminación de atardecer y noche: 2/5;
- profundidad, seams y oclusión: 3/5.

Proyección/cámara, nitidez y legitimidad sí alcanzan el mínimo crítico de 4/5 o más.

## Bloqueadores

### B1 — Iluminación todavía basada en cambio global

La noche es objetivamente diferente, pero fuera de bombillas y ventanas conserva esencialmente la misma distribución lumínica del atardecer bajo un tinte más oscuro. No se observan halos contenidos ni píxeles de luz que afecten de forma localizada suelo, fachada o vegetación. Activa el bloqueador 7 de la rúbrica en su forma de “overlay global” y deja el criterio crítico 9 en 2/5.

### B2 — Cohesión y seams del terreno por debajo del mínimo crítico

En `twilight-z150-1440x900.png`, `twilight-z200-1440x900.png` y toda la secuencia de pan, las uniones de los tiles forman una cuadrícula punteada regular sobre césped, acera y asfalto. No es texture bleeding severo, pero sí una costura visual repetida que separa el suelo del acabado orgánico de los sprites. El criterio crítico 11 no alcanza 4/5.

No se detectaron bloqueadores de autenticidad, licencia, resolución, ausencia de captura, rotación, blur bilinear dominante ni omisión de casa/cafetería.

## Diferencias frente a las referencias

### Preservado

- cámara isométrica fija, pan y zoom sin rotación;
- pixel art raster nítido y modular;
- arquitectura crema/madera/coral con techos oscuros;
- casa y cafetería inequívocamente distintas;
- vegetación en tres escalas y luces cálidas identificables;
- carreteras oscuras y aceras claras con circulación legible.

### Simplificado de forma aceptable para el spike

- sólo dos edificios y un fragmento pequeño;
- ausencia de personajes y vehículos;
- borde de isla y fondo todavía simples;
- menos variedad arquitectónica que A, B y C.

### Todavía provisional

- integración edificio–lote y sombras/contactos de base;
- escala y orientación del banco;
- distribución funcional de faroles;
- textura del césped y microdetalles del espacio público;
- borde lateral del terreno y HUD.

### Dirección todavía incorrecta

- la referencia A construye el atardecer con ambiente frío y luz ámbar localizada; ciclo 2 parece día claro y luego el mismo mundo uniformemente oscurecido;
- A y C ocultan la retícula mediante material y vegetación; ciclo 2 expone líneas punteadas en cada tile;
- las referencias ubican faroles en bordes y esquinas de circulación; ciclo 2 repite postes dentro del corredor vial/peatonal;
- los bancos de las referencias pertenecen a rincones pavimentados o jardines definidos; aquí son grandes, quedan ladeados y flotan como props sueltos sobre césped.

## Correcciones prioritarias

1. **[P0] Rehacer la contribución lumínica, no sólo el tinte.** En las seis vistas equivalentes, el atardecer debe ser frío pero todavía cálido en fachadas, y la noche debe incorporar máscaras/tiles de luz ámbar local por farol y ventana sobre acera, pared y vegetación inmediata, con límites pixelados contenidos. Resultado verificable: al comparar parejas, las diferencias no son uniformes y cada fuente altera su entorno sin bloom borroso.
2. **[P0] Corregir escala y anclaje del mobiliario.** Reducir los bancos aproximadamente 20–30%, alinearlos con la proyección y situarlos junto a un sendero/rincón pavimentado con acceso libre. Mover cada farol a borde o esquina exterior de acera, nunca sobre asfalto ni en el centro del corredor; disminuir su cantidad y evitar que ocluyan bancos o accesos.
3. **[P0] Eliminar la cuadrícula/seams dominante y enriquecer el césped.** Ajustar máscara/solape del diamante para que no aparezcan juntas oscuras entre tiles y quitar el punteado perimetral repetido. Introducir 2–3 variantes de césped y decals seeded muy sutiles, concentrados cerca de jardines y bordes, sin dibujar una grilla.
4. **[P1] Reorganizar la composición en microescenas funcionales.** Conservar el mismo alcance de dos edificios, pero conectar accesos a acera, agrupar banco–jardinera–árbol en un rincón público y redistribuir masa vegetal para reducir vacíos sin llenar por repetición. Cada prop debe explicar un uso o borde del lote.
5. **[P1] Unificar el contacto visual entre edificios, props y suelo.** Añadir apoyos/sombras pixeladas discretas y revisar pivotes a 100/150/200% para que casa, café, árboles, bancos y postes parezcan compartir exactamente el mismo plano; recapturar los doce frames para comprobar que no reaparecen seams ni solapes confusos durante pan.

## Autorización de escala

```text
NO AUTORIZADA
```

El ciclo 3 debe mantener el mismo mapa pequeño y corregir primero iluminación, terreno, escala y colocación. No está autorizado producir más edificios, barrios, interiores o agentes antes de obtener `APROBADO` con 85,0/100 o más y todos los criterios críticos en 4/5 o superior.

