# Syka World — Revisión del gate visual, ciclo 3

Fecha: 2026-07-16  
Revisor independiente: `visual_director_qa_cycle3`  
Rúbrica aplicada: `reports/visual-qa/VISUAL_GATE_RUBRIC_V1.md`  
Referencia principal: `research/visual-concepts/approved-direction-v1/city-layout-a-twilight.png`

## Veredicto

```text
VEREDICTO: APROBADO
PUNTUACIÓN: 87,0/100
AUTORIZACIÓN PARA ESCALAR LA CIUDAD: AUTORIZADA
```

El ciclo 3 resuelve los bloqueadores del ciclo 2 sin ampliar artificialmente el alcance del spike. El terreno ya no expone una retícula de seams, las seis farolas están fuera del asfalto y vinculadas a bordes o rincones de vereda, el único banco tiene una escala plausible y forma una microescena pública, y los estados atardecer/noche incorporan contribuciones de luz local visibles. La casa y la cafetería siguen siendo el núcleo más fuerte del kit y ahora se apoyan sobre un suelo compatible en densidad, paleta y proyección.

La aprobación corresponde al **kit exterior pequeño sometido al gate**, no declara arte final ni equipara la densidad de este fragmento con una ciudad terminada. Los assets continúan correctamente inventariados como provisionales y deberán conservar las reglas verificadas al escalar.

## Integridad de evidencia

- [x] Seis capturas PNG directas de 1440×900.
- [x] Viewport 1440×900 CSS px y `devicePixelRatio: 1`.
- [x] Zooms de juego 100%, 150% y 200%, con el mismo ancla (`scrollX: 540`, `scrollY: 20`).
- [x] Atardecer 19:15 y noche 22:00.
- [x] Doce frames consecutivos de pan a 150%, todos inspeccionados a resolución original.
- [x] Metadata, estado del navegador, procedencia y notas de implementación.
- [x] Sin errores de consola o página registrados.
- [x] Assets visibles y provisionales identificados; ninguna referencia conceptual se usa en runtime.

También se inspeccionaron a resolución completa las cuatro referencias aprobadas. La referencia interior se usó sólo como control futuro de densidad y calidez, no para puntuar este spike exterior.

## Score

| # | Criterio | Peso | Nota | Puntos | Evidencia concreta |
|---:|---|---:|---:|---:|---|
| 1 | Proyección isométrica y cámara fija | 10 | 5/5 | 10,0 | Terreno, calles, edificios y props comparten una lectura 2:1 estable. Las seis escalas y los doce frames mantienen dirección, profundidad y cámara sin rotación ni perspectiva variable. |
| 2 | Composición y lectura espacial | 8 | 4/5 | 6,4 | El cruce organiza casa, café y rincón público; accesos y circulación se entienden sin rótulos. La mitad baja conserva más espacio negativo que la referencia, pero ya funciona como pequeño fragmento terminado y no como muestra de assets sueltos. |
| 3 | Proporciones y escala | 8 | 4/5 | 6,4 | Puertas, ventanas, árboles, jardineras, farolas y banco pertenecen al mismo mundo. El banco quedó único, reducido y anclado al rincón pavimentado. Ninguna farola está sobre el asfalto; algunas siguen visualmente prominentes, pero no rompen la escala. |
| 4 | Nitidez y estabilidad de píxel | 15 | 5/5 | 15,0 | Los zooms 100/150/200 permanecen nítidos, sin bilinear ni bleeding. La secuencia de pan conserva contornos, pivotes y orden; no aparecen saltos de sorting, blur o shimmering dominante. |
| 5 | Coherencia entre tiles y sprites | 10 | 4/5 | 8,0 | Suelo, edificios, vegetación y mobiliario comparten paleta, contornos, dirección de luz y densidad de pixel art. El terreno ya no parece una base técnica distinta; sus microtexturas son algo más uniformes que la arquitectura, diferencia de pulido menor. |
| 6 | Arquitectura y siluetas exteriores | 8 | 5/5 | 8,0 | Casa y cafetería son inequívocas sin UI: varían footprint, acceso, fachada y utilería. Chimenea, aleros, marcos, cerca y buzón distinguen la casa; toldo, escaparate, terraza, cartel y mesas distinguen el café. |
| 7 | Densidad y narrativa de objetos | 10 | 4/5 | 8,0 | Ambos edificios superan los grupos mínimos de detalle y el espacio público suma banco–jardinera–farol, arbolado y acentos de jardín. Aún hay césped abierto en el sector inferior, pero sirve como respiración y no domina el fragmento. |
| 8 | Vegetación y props ambientales | 8 | 4/5 | 6,4 | Hay dosel, masa media y acentos: árboles de silueta distinta, setos, arbustos, jardineras, flores, hierbas y pequeños decals. La colocación está integrada a lotes y veredas; quedan repeticiones propias del alcance reducido, no repetición mecánica dominante. |
| 9 | Iluminación de atardecer y noche | 12 | 4/5 | 9,6 | La noche es materialmente distinta y navegable. Farolas, puertas y ventanas producen pools/derrames localizados sobre suelo y vegetación; la diferencia ya no es un simple overlay uniforme. Los halos son contenidos y pixelados, aunque su transición y matiz verdoso aún admiten pulido. |
| 10 | Paleta, contraste y materiales | 5 | 4/5 | 4,0 | Asfalto, vereda, césped, madera, crema, coral y techos oscuros se separan con claridad. El ambiente frío y las fuentes cálidas forman una familia cozy; el fondo y el borde de isla siguen deliberadamente simples. |
| 11 | Orden de profundidad, seams y oclusión | 4 | 4/5 | 3,2 | No se observan seams de teselación, grid oscuro, fachadas atravesadas ni cambios de depth durante el pan. Luces y mobiliario conservan apoyos coherentes. Algunos contactos de luz con vegetación pueden refinarse, pero no hay defecto repetido ni bloqueador. |
| 12 | Originalidad y legitimidad de runtime | 2 | 5/5 | 2,0 | Kit original generado para Syka World, con chroma/alpha, crops, pivotes, manifiestos y estado provisional documentados. No se reutilizan capturas, referencias ni assets comerciales en runtime. |
|  | **Total** | **100** |  | **87,0** | Umbral: 85,0; todos los criterios críticos alcanzan 4/5 o más. |

## Criterios críticos

Todos cumplen el mínimo:

- proyección/cámara: 5/5;
- proporciones/escala: 4/5;
- nitidez/estabilidad: 5/5;
- coherencia del kit: 4/5;
- iluminación: 4/5;
- profundidad/seams/oclusión: 4/5;
- originalidad/procedencia: 5/5.

## Bloqueadores

Ninguno.

- No falta evidencia ni hay indicios de retoque.
- No hay rotación, perspectiva variable, blur bilinear o dirección 3D low-poly.
- Casa, cafetería, caminos, vegetación y luces están presentes.
- Atardecer y noche no son indistinguibles ni dependen sólo de un overlay global.
- No hay seams repetidos, grid visible o errores dominantes de profundidad.
- Los placeholders/provisionales están declarados y no se usa material comercial o conceptual en runtime.

## Diferencias frente a las referencias

### Preservado

- cámara isométrica fija y lectura 2:1;
- arquitectura cálida crema/madera/coral con techos oscuros;
- cafetería y vivienda con siluetas y narrativa propias;
- carreteras oscuras, veredas claras y accesos legibles;
- vegetación en tres escalas;
- contraste de ambiente frío con iluminación ámbar localizada;
- pixel art raster modular y nítido.

### Simplificado de forma aceptable

- sólo dos edificios y una intersección;
- menos densidad y variedad urbana que A, B y C;
- ausencia de personajes, vehículos e interiores;
- borde de isla y fondo sin tratamiento final.

### Todavía provisional

- todos los assets visuales declarados en procedencia;
- transición/intensidad exacta de algunos pools de luz;
- textura repetitiva de vereda y microdetalle de grandes paños de césped;
- HUD y canto vertical de la isla.

### Dirección incorrecta

- ninguna diferencia restante obliga a cambiar la dirección visual del kit.

## Recomendaciones de escalado — no bloqueantes

1. Mantener el mismo tile lógico, nearest-neighbor, pivotes y snapping; cada nueva familia debe validarse a 100/150/200% antes de incorporarse masivamente.
2. Variar con moderación textura de césped y vereda mediante decals seeded, sin reintroducir contornos de tile ni una grilla visible.
3. Conservar farolas sólo en bordes/esquinas de circulación y diseñar el mobiliario como microescenas funcionales, no como distribución automática por intervalo.
4. Refinar los pools de luz para reducir el matiz verde y mejorar contacto con fachadas/vegetación, preservando bordes pixelados sin bloom suave.
5. Al agregar edificios, sostener la densidad arquitectónica de casa/café y evitar que una calle sobredimensionada vuelva a dominar la composición.

## Autorización de escala

```text
AUTORIZADA
```

La autorización habilita continuar con el kit exterior y los siguientes sistemas de la alpha. No habilita degradar el estándar: una regresión en seams, colocación de farolas, escala de props, pixel snapping o iluminación localizada debe tratarse como fallo visual antes de expandirse a más barrios.

```text
VEREDICTO FINAL DEL CICLO 3: APROBADO
PUNTUACIÓN FINAL: 87,0/100
AUTORIZACIÓN PARA ESCALAR: AUTORIZADA
```
