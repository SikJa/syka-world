# Syka World Alpha v1 — QA visual final independiente

Fecha: 2026-07-16  
Responsable: `alpha_docs`, revisión separada de la implementación  
Veredicto: **APROBADO PARA ALPHA — 86,2/100**

## Alcance del veredicto

Este veredicto evalúa capturas sin retoque obtenidas del runtime local. Aprueba la dirección y la integración visual de la **alpha**, no convierte sus assets en arte final ni afirma equivalencia píxel por píxel con las referencias conceptuales.

Las correcciones solicitadas por Sikora se evaluaron únicamente en las recapturas estables posteriores al último ajuste de posición (`.16`):

- `reports/e2e/alpha-v1/screenshots/feedback-crossing-lamp-bench-grass-z200.png`;
- `reports/e2e/alpha-v1/screenshots/feedback-bench-grass-z200.png`.

Para el resto de la ciudad se inspeccionaron las capturas estables de día, atardecer y noche; zoom 100%, 150% y 200%; agentes visibles y ocultos; interior, decoración, construcción, nueva partida y viewport 1024×640 bajo `reports/e2e/alpha-v1/screenshots/`.

## Puntuación

Se reutiliza la rúbrica de `reports/visual-qa/VISUAL_GATE_RUBRIC_V1.md`. Cada nota es de 0 a 5 y los puntos se calculan como `peso × nota / 5`.

| # | Criterio | Peso | Nota | Puntos | Observación |
|---:|---|---:|---:|---:|---|
| 1 | Proyección isométrica y cámara fija | 10 | 5 | 10,0 | Los tres zooms conservan ejes y perspectiva; la UI muestra rotación no disponible. |
| 2 | Composición y lectura espacial | 8 | 4 | 6,4 | Núcleo urbano legible y destinos reconocibles; los paños abiertos de la alpha reducen variedad compositiva. |
| 3 | Proporciones y escala | 8 | 4 | 6,4 | Edificios, caminos, agentes y props pertenecen al mismo mundo; farolas y bancos ya no dominan la escena. |
| 4 | Nitidez y estabilidad de píxel | 15 | 5 | 15,0 | 100%, 150% y 200% mantienen bordes nítidos, sin blur o bleeding visible. |
| 5 | Coherencia entre tiles y sprites | 10 | 4 | 8,0 | Material, contorno y densidad son consistentes; el interior usa mayor detalle de forma intencional por su acercamiento. |
| 6 | Arquitectura y siluetas exteriores | 8 | 4 | 6,4 | Café, casas, oficina, estudio, taller y casa comunitaria son distinguibles; la hilera de casas repite silueta. |
| 7 | Densidad y narrativa de objetos | 10 | 4 | 8,0 | Fachadas, jardines, marquesinas, mesas y pequeños objetos crean microescenas legibles. |
| 8 | Vegetación y props ambientales | 8 | 3 | 4,8 | La corrección de escala/ubicación funciona y el césped tiene microdetalle; todavía falta la riqueza orgánica de la referencia exterior. |
| 9 | Iluminación de atardecer y noche | 12 | 4 | 9,6 | Día, tarde y noche son distinguibles, con ventanas cálidas y navegación legible; algunos conos de luz son más duros que la referencia. |
| 10 | Paleta, contraste y materiales | 5 | 5 | 5,0 | Madera, ladrillo, asfalto, pasto y luz se separan bien dentro de una paleta cozy. |
| 11 | Orden de profundidad, seams y oclusión | 4 | 5 | 4,0 | No se observaron seams, z-fighting ni oclusiones repetidas en los zooms revisados. |
| 12 | Originalidad y legitimidad visible del runtime | 2 | 4 | 1,6 | La escena se percibe modular, no como fondo plano de referencia; la procedencia legal se documenta aparte y no se infiere sólo de la imagen. |
|  | **Total** | **100** |  | **86,2** | Todos los criterios críticos alcanzan 4/5 o más. |

## Cierre explícito del feedback de Sikora

| Pedido | Evidencia observada | Resultado |
|---|---|:---:|
| Farolas fuera de la calle y junto a cruces/sendas | En ambas recapturas enfocadas, las bases descansan sobre pasto junto al borde de circulación; ninguna base ocupa el asfalto. | **CUMPLE** |
| Bancos más pequeños y bien orientados | `feedback-bench-grass-z200.png` aísla bancos pequeños, completos y alineados con el eje de la senda. Uno queda cerca del borde del mapa, sin problema de escala o apoyo. | **CUMPLE** |
| Pasto base con más detalle | Se observan variaciones tonales, motas, hojas y flores pequeñas sin costuras ni retícula dominante. | **CUMPLE** |
| Quitar la fuente de baja calidad | No aparece una fuente pública improvisada en ninguna captura final de ciudad. | **CUMPLE** |

## Extensión visual de la alpha

| Superficie | Resultado | Evidencia/nota |
|---|:---:|---|
| Ciudad día / atardecer / noche | **CUMPLE** | `03-day-1440x900.png`, `03-twilight-1440x900.png`, `03-night-1440x900.png`. |
| Zoom 100 / 150 / 200 | **CUMPLE** | Las tres capturas `03-city-twilight-z*-agents-visible.png` son nítidas y coherentes. |
| Agentes visibles / ocultos | **CUMPLE PROVISIONAL** | La presencia cambia sin contaminar la arquitectura; los avatares siguen siendo placeholders no aprobados. |
| Interior aislado | **CUMPLE** | `05-cafe-interior-1440x900.png`: escena separada, amueblada, con madera, libros, chimenea, cocina/barra, mesas, plantas y ciudad visible por la ventana; no usa fondo negro. |
| Decoración opcional individual | **CUMPLE** | `06-cafe-decor-installed.png`: el helecho comprado aparece como objeto pequeño e individual, no como recorte de toda la habitación. |
| Construcción | **CUMPLE** | `09-cafe-foundation.png` y `10-cafe-framing.png` distinguen claramente cimientos y estructura. |
| Nueva partida / modo muestra | **CUMPLE** | Ambos estados son visualmente diferentes y legibles. |
| Viewport 1024×640 | **CUMPLE CON LÍMITE** | La UI permanece usable, aunque ocupa una proporción importante del área visible. |
| Ocho indicadores de actividad | **NO DEMOSTRADO VISUALMENTE** | La secuencia funcional está registrada por E2E, pero el set final no incluye una captura legible de cada variante visual. No se usa como evidencia para elevar la nota. |

## Diferencias honestas frente a las referencias

- La referencia exterior posee más barrios, vegetación en capas, caminos secundarios y composición orgánica; la alpha se concentra en un núcleo más pequeño y repite varias casas.
- Las piscinas/conos de luz del runtime son más geométricos y duros que la iluminación difusa de la referencia de atardecer.
- Los sectores aún sin construir se leen como grandes superficies de pasto; es coherente con una ciudad editable, pero hoy aportan poca narrativa visual.
- El interior se aproxima mucho mejor a la densidad, calidez y narrativa de objetos de `cafe-interior-library.png` que el exterior a la amplitud de `city-layout-a-twilight.png`.
- Los cuatro agentes son marcadores provisionales de integración; no fijan mascotas, especies ni diseño final.

## Pulido posterior, no bloqueante para esta alpha

1. Suavizar y acortar algunos conos de luz para que cada fuente se perciba más localizada.
2. Añadir grupos orgánicos de vegetación y microescenas a los paños libres sin convertirlos en ruido.
3. Variar la hilera residencial mediante flips, pequeñas extensiones o variantes de techo/fachada.
4. Capturar y revisar visualmente los ocho indicadores de actividad antes de tratarlos como lenguaje final.
5. Reducir la ocupación de paneles en resoluciones pequeñas.

## Assets que continúan provisionales

- atlas de agentes y sus identidades visuales;
- kit exterior e interior `alpha-v1` como candidato de integración, no arte final congelado;
- iconografía y algunos indicadores de actividad;
- nombre/balance visual de Lúmenes.

## Decisión

No hay bloqueador visual inmediato en el set estable revisado. El total supera 85/100, todos los criterios críticos alcanzan al menos 4/5 y las cuatro correcciones concretas de Sikora están demostradas en runtime. Por lo tanto, el veredicto es:

```text
APROBADO PARA ALPHA — 86,2/100
```

Esta aprobación permite cerrar la alpha actual con sus provisionales documentados; no autoriza presentar los avatares o el kit como arte definitivo.
