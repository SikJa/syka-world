# Syka World — Rúbrica del gate visual v1

Estado: **PENDIENTE DE EVIDENCIA — NO APROBADO**  
Responsable de veredicto: `visual_director_qa`  
Alcance: spike isométrico exterior previo a escalar la ciudad  
Versión de la rúbrica: 1.0 — 2026-07-16

## Regla de independencia

Esta rúbrica no aprueba conceptos, prompts, código, sprites aislados ni una descripción de intención. El gate sólo puede aprobarse después de inspeccionar **capturas sin retoque obtenidas del juego ejecutándose** y compararlas con las referencias aprobadas.

Hasta que exista un veredicto escrito `APROBADO`, el estado operativo es:

```text
NO ESCALAR LA CIUDAD
```

No hay aprobación implícita por ausencia de comentarios. Tampoco existe aprobación condicional: cualquier corrección pendiente que afecte un criterio crítico mantiene el gate rechazado.

## Fuentes de autoridad inspeccionadas

La evaluación aplica, en este orden:

1. `research/visual-concepts/approved-direction-v1/city-layout-a-twilight.png` — referencia exterior principal.
2. `research/visual-concepts/approved-direction-v1/cafe-interior-library.png` — referencia futura de densidad y calidez interior; no forma parte del score del spike exterior.
3. `research/visual-concepts/approved-direction-v1/city-layout-b-main-street.png` — evidencia de distribución libre con calle principal y plaza lateral.
4. `research/visual-concepts/approved-direction-v1/city-layout-c-green-districts.png` — evidencia de microbarrios, vegetación y ausencia de plaza central obligatoria.
5. `docs/VISUAL_STYLE_GUIDE.md`, `docs/GOAL_ULTRA_VISUAL_EXECUTION_V1.md` y `docs/GOAL_ISOMETRIC_PLAYABLE_ALPHA_V1.md` — restricciones de runtime y producto.

Los cuatro conceptos fueron inspeccionados a resolución completa:

| Referencia | Resolución |
|---|---:|
| `city-layout-a-twilight.png` | 1816×866 |
| `cafe-interior-library.png` | 1712×919 |
| `city-layout-b-main-street.png` | 1815×867 |
| `city-layout-c-green-districts.png` | 1814×867 |

## ADN visual que debe preservarse

### 1. Lectura isométrica estable

- El mundo se lee como una maqueta isométrica observada desde una única dirección.
- Los dos ejes del suelo mantienen pendientes opuestas constantes y una retícula aproximadamente 2:1.
- Fachadas, techos, caminos, cercas y props comparten la misma proyección; ningún objeto parece frontal, cenital o inclinado con otra cámara.
- La cámara permite pan y zoom, pero nunca rotación ni perspectiva cambiante.
- La profundidad nace del orden de capas, solapes y elevación, no de perspectiva 3D visible.

### 2. Ciudad compacta, densa y legible

La referencia A no es una grilla vacía con edificios aislados. Es una ciudad compacta con:

- edificios de uno y dos pisos con siluetas claramente distintas;
- carreteras oscuras, aceras claras, accesos y cruces que organizan la lectura;
- jardines, patios, terrazas y bordes de lote que conectan arquitectura y calle;
- espacios negativos suficientes para reconocer caminos y entradas;
- pequeños focos narrativos distribuidos, sin concentrar todo en una plaza central.

El spike puede ser mucho más pequeño que la referencia, pero debe parecer un fragmento terminado del mismo tipo de mundo, no un prototipo vacío esperando contenido.

### 3. Arquitectura cálida y variada

- La casa y la cafetería deben diferenciarse por footprint, techo, fachada, acceso y utilería, no sólo por color o cartel.
- Las formas combinan crema, madera, ladrillo/coral y techos oscuros o rojizos.
- Puertas, ventanas, aleros, chimeneas, toldos y marcos aportan profundidad en varios planos.
- Los edificios exteriores se presentan completos. Aunque la referencia conceptual muestre algunos cutaways, el contrato de Syka World abre interiores en una escena aislada; no debe copiarse el techo abierto como mecanismo principal.
- Se evitan cajas genéricas, low-poly visible, bordes vectoriales lisos y apariencia de diorama 3D renderizado sin tratamiento pixel art.

### 4. Detalle con intención, no ruido

La riqueza proviene de grupos semánticos de objetos. En el spike deben existir microescenas reconocibles, por ejemplo:

- mesa, sillas y macetas junto a la cafetería;
- banco, farol y cantero junto a un camino;
- cerca, buzón, flores y sendero junto a la casa;
- bicicleta, cartel, cajas o herramientas vinculadas a un edificio.

Como objetivo mínimo de gate, cada edificio debe tener al menos **tres grupos de detalle** en su perímetro y el espacio público al menos **dos grupos** adicionales. Repetir el mismo arbusto muchas veces no cuenta como variedad narrativa.

### 5. Vegetación en tres escalas

- Dosel: árboles con volumen y siluetas distinguibles.
- Masa media: arbustos, setos, jardineras y trepadoras.
- Acento: flores, hierba, pequeñas plantas y bordes orgánicos.

La vegetación debe integrarse a fachadas, lotes y caminos, no formar una franja decorativa independiente. Los conceptos A y C preservan alta densidad verde aun en zonas construidas.

### 6. Iluminación cálida dentro de ambiente frío

El rasgo más importante de la referencia A es el contraste de temperatura:

- ambiente de atardecer azul suave y sombras frías;
- ventanas, faroles, chimenea o lámparas con luz ámbar localizada;
- reflejos o halos contenidos que nacen de fuentes identificables;
- materiales y siluetas todavía legibles fuera de las áreas iluminadas.

La noche no puede ser únicamente una capa azul sobre la escena diurna. Deben cambiar ambiente, contraste y contribución de luces locales sin perder el suelo, entradas o vegetación. Tampoco debe aplicarse un bloom continuo que borre los clusters de píxel.

### 7. Paleta y jerarquía de materiales

La paleta documentada funciona como familia, no como obligación de usar sólo nueve colores:

- vegetación base `#a8c98d` y profunda `#527a52`;
- caminos/aceras cálidos `#e8d9ad`;
- arquitectura crema `#f0dba9`, coral `#d56a4c` y madera `#795a42`;
- ambiente nocturno `#263c49` y luz `#ffe39a`.

El asfalto debe separarse del césped; la acera, del camino; la madera, del ladrillo; y la luz emitida, del color base del objeto. Se rechaza tanto una paleta gris uniforme como una saturación alta sin jerarquía.

### 8. Pixel art de runtime, no imagen plana

- Los clusters, contornos y sombras deben compartir una densidad de píxel coherente.
- El filtrado es `nearest-neighbor`; no hay blur bilinear, suavizado de textura ni escalado borroso.
- Tiles y sprites son modulares y mantienen pivotes, escalas y dirección de luz comunes.
- Las referencias no pueden usarse como fondo plano, recorte o atlas de runtime.
- La meta es fidelidad de lenguaje visual, no igualdad píxel por píxel con una ilustración conceptual generada.

### 9. Qué no debe heredarse literalmente de los conceptos

- Geometrías ambiguas o inconsistentes propias de una imagen generada.
- Cutaways exteriores como sustituto de la escena interior aislada.
- Una distribución fija: A, B y C prueban que la ciudad debe admitir composiciones distintas.
- Microdetalle imposible de modularizar o leer en movimiento.
- El fondo azul como solución obligatoria del mundo.
- Cualquier asset o layout tomado de juegos comerciales.

## Paquete de evidencia obligatorio

Guardar cada ciclo en:

```text
reports/visual-qa/gate-v1/cycle-01/
reports/visual-qa/gate-v1/cycle-02/
reports/visual-qa/gate-v1/cycle-03/
```

### Condiciones comunes

- Capturas PNG directas del runtime, exactamente a **1440×900 CSS px**.
- Registrar `devicePixelRatio`; si no es `1`, conservar la imagen nativa y declarar su tamaño físico. La comparación principal se realiza sobre el viewport 1440×900, sin reescalado posterior.
- UI de depuración, grilla, hitboxes, cursores y agentes ocultos. Puede permanecer una UI mínima del juego sólo si no tapa la escena.
- Sin edición, composición, sharpening, filtros externos, recorte ni reemplazo de fondo después de capturar.
- Misma versión del juego, mapa, centro de cámara y punto temporal para la serie equivalente.
- La escena debe mostrar como mínimo terreno, caminos, una casa, exterior de cafetería, árboles, jardines, faroles y props ambientales.
- El zoom indicado es el zoom de juego reproducible, no un zoom del visor de imágenes.

### Seis capturas mínimas

| Archivo | Hora/estado | Zoom | Encuadre |
|---|---|---:|---|
| `twilight-z100-1440x900.png` | atardecer | 100% | spike completo, centro fijo |
| `twilight-z150-1440x900.png` | atardecer | 150% | mismo ancla, casa y café visibles |
| `twilight-z200-1440x900.png` | atardecer | 200% | mismo ancla, detalle de café y calle |
| `night-z100-1440x900.png` | noche | 100% | spike completo, centro fijo |
| `night-z150-1440x900.png` | noche | 150% | mismo ancla, casa y café visibles |
| `night-z200-1440x900.png` | noche | 200% | mismo ancla, detalle de café y calle |

Si a 150% o 200% el mapa completo no cabe, se conserva el mismo punto de anclaje y se documentan las coordenadas de cámara; no se recompone manualmente para favorecer cada captura.

### Evidencia técnica complementaria

1. `capture-metadata.json` con fecha, URL local, navegador, viewport, DPR, zoom de juego, hora simulada, cámara y versión/estado del build.
2. `motion-pan-z150.webm` de 6–10 segundos, o una secuencia equivalente de al menos 12 frames, con pan lento a 150%. Es obligatorio para verificar shimmering, saltos de orden y estabilidad subpíxel que una captura no puede demostrar.
3. `asset-provenance.md` con origen/licencia de cada familia visible y separación entre terminado/provisional.
4. `implementation-notes.md` con tile lógico, proyección, filtrado, reglas de pixel snapping y limitaciones conocidas. Estas notas ayudan a diagnosticar, pero nunca sustituyen la evidencia visual.

La ausencia de cualquiera de las seis capturas bloquea el veredicto. La ausencia de evidencia de movimiento bloquea sólo los criterios de estabilidad durante pan; por lo tanto, también impide la aprobación final del gate.

## Método de puntuación

Cada criterio recibe una nota entera de 0 a 5:

| Nota | Significado |
|---:|---|
| 0 | ausente, roto o dirección contraria |
| 1 | placeholder técnico sin lenguaje visual aprobado |
| 2 | parcialmente reconocible, con defectos dominantes |
| 3 | funcional y coherente, pero claramente distante de la referencia |
| 4 | sólido, cercano y apto para escalar con retoques menores |
| 5 | referencia del kit: convincente, consistente y sin defecto relevante visible |

Puntos del criterio:

```text
puntos = peso × nota / 5
```

La puntuación final se expresa sobre 100 con un decimal. La nota no reemplaza los bloqueadores ni los mínimos críticos.

## Rúbrica puntuable del gate exterior

| # | Criterio | Peso | Crítico | Evidencia para nota 5 |
|---:|---|---:|:---:|---|
| 1 | Proyección isométrica y cámara fija | 10 | Sí | Retícula y objetos comparten ejes; profundidad convincente; pan/zoom sin rotación ni perspectiva variable. |
| 2 | Composición y lectura espacial | 8 | No | Casa, café, caminos y espacios verdes forman un fragmento compacto con focos claros y circulación legible. |
| 3 | Proporciones y escala | 8 | Sí | Footprints, puertas, ventanas, props y futura escala de personaje pertenecen al mismo mundo; no hay objetos miniatura o gigantes accidentales. |
| 4 | Nitidez y estabilidad de píxel | 15 | Sí | 100/150/200% se ven nítidos, sin blur, shimmering, píxeles desiguales, texture bleeding ni temblores durante pan. |
| 5 | Coherencia entre tiles y sprites | 10 | Sí | Pixel density, contorno, luz, sombra, pivote y acabado son homogéneos; no parece collage de packs distintos. |
| 6 | Arquitectura y siluetas exteriores | 8 | No | Casa y cafetería se reconocen sin rótulo, tienen varios planos y detalle cálido comparable en intención con la referencia A. |
| 7 | Densidad y narrativa de objetos | 10 | No | Hay microescenas variadas alrededor de edificios y calle, abundantes pero legibles; ningún sector principal parece vacío. |
| 8 | Vegetación y props ambientales | 8 | No | Tres escalas de vegetación, variedad de silueta y grupos integrados a lotes/caminos; faroles y props no son repetición mecánica. |
| 9 | Iluminación de atardecer y noche | 12 | Sí | Contraste frío/cálido localizado, fuentes legibles, noche distinta del tintado global y escena aún navegable sin bloom borroso. |
| 10 | Paleta, contraste y materiales | 5 | No | Materiales se separan claramente y la paleta mantiene armonía cálida/cozy sin gris uniforme ni sobresaturación. |
| 11 | Orden de profundidad, seams y oclusión | 4 | Sí | Sin seams, z-fighting visual, fachadas atravesadas, árboles mal ordenados o luces que ignoran oclusión. |
| 12 | Originalidad y legitimidad de runtime | 2 | Sí | Escena compuesta con kit modular original/licenciado; ninguna referencia se usa como fondo/recorte y los provisionales están declarados. |
|  | **Total** | **100** |  |  |

### Umbral de aprobación

El gate obtiene `APROBADO` únicamente si se cumplen simultáneamente:

1. paquete de evidencia completo y auténtico;
2. **85,0/100 o más**;
3. nota **4/5 o mayor en todos los criterios críticos**;
4. ningún criterio con nota 0;
5. ningún bloqueador de rechazo presente;
6. lista de assets provisionales y diferencias frente a las referencias documentada.

Un total alto no compensa un criterio crítico bajo. Por ejemplo, una escena detallada con blur a 150% queda rechazada aunque supere 85 puntos.

## Bloqueadores de rechazo inmediato

El veredicto es `RECHAZADO — ITERAR` sin importar el score si aparece cualquiera de estos casos:

1. La evidencia no proviene del juego en ejecución, está retocada o no puede reproducirse.
2. Falta una captura obligatoria, la resolución no corresponde o el zoom fue simulado reescalando la imagen.
3. Existe rotación accesible o la proyección cambia con cámara/perspectiva.
4. La dirección dominante es 3D low-poly, vectorial suave o diorama con antialiasing, en vez de pixel art isométrico nítido.
5. Hay filtrado bilinear, blur visible, shimmering dominante o densidad de píxel incompatible entre familias principales.
6. La escena omite la casa, la cafetería, caminos, vegetación o luces requeridas.
7. Atardecer y noche son indistinguibles salvo por un overlay global, o la noche vuelve ilegible la navegación.
8. Existen errores repetidos de depth sorting, seams o tiles sangrando en cualquiera de los zooms.
9. La referencia conceptual, un screenshot o un asset comercial fue reutilizado como fondo, sprite o textura sin licencia compatible.
10. El kit depende de placeholders no declarados que dominan más de un elemento principal del spike.
11. Se escala la ciudad o se produce contenido masivo antes del veredicto independiente.

## Clasificación de defectos

- **P0 — bloqueador:** invalida runtime, autenticidad, proyección, nitidez, licencia o lectura básica. Debe corregirse antes de cualquier aprobación.
- **P1 — mayor:** distancia visual clara respecto de la referencia en arquitectura, iluminación, densidad, escala o cohesión. Debe corregirse dentro del ciclo del gate.
- **P2 — pulido:** defecto localizado que no rompe el lenguaje del kit. Puede entrar en la lista posterior sólo si todos los críticos están aprobados y el score supera el umbral.

Toda observación debe incluir archivo, zoom, zona visible, criterio afectado y corrección verificable. “Mejorar el arte” no es una observación suficiente.

## Procedimiento por ciclo

1. Verificar integridad y metadata del paquete.
2. Inspeccionar cada PNG al 100% de tamaño físico, sin suavizado del visor.
3. Comparar primero silueta, composición, escala y temperatura con la referencia A.
4. Comparar después clusters, props, vegetación, arquitectura y luces en detalle.
5. Revisar pares atardecer/noche con el mismo zoom y ancla.
6. Revisar el movimiento a 150% para pixel snapping, sorting y seams.
7. Completar score, bloqueadores y diferencias honestas.
8. Emitir un único veredicto: `APROBADO`, `RECHAZADO — ITERAR` o `EVIDENCIA INCOMPLETA`.
9. Si se rechaza, entregar como máximo cinco correcciones P0/P1 ordenadas por impacto visual.
10. La siguiente iteración debe aportar un paquete nuevo; no se sobrescribe la evidencia anterior.

Se permiten hasta tres ciclos. Si el tercero no cumple el umbral, el veredicto sigue siendo rechazado y se documenta la mejor versión y la limitación; no se convierte el fracaso en aprobación administrativa.

## Plantilla de veredicto

```markdown
# Visual gate — ciclo NN

Veredicto: EVIDENCIA INCOMPLETA | RECHAZADO — ITERAR | APROBADO
Puntuación: NN.N/100
Referencia principal: city-layout-a-twilight.png

## Integridad de evidencia
- [ ] seis capturas 1440×900
- [ ] zooms 100/150/200 reproducibles
- [ ] atardecer y noche
- [ ] metadata
- [ ] evidencia de pan a 150%
- [ ] procedencia y provisionales

## Score
| # | Criterio | Nota 0–5 | Puntos | Evidencia |
|---:|---|---:|---:|---|

## Bloqueadores
- ninguno | lista concreta

## Diferencias frente a las referencias
- preservado:
- simplificado de forma aceptable:
- todavía provisional:
- dirección incorrecta:

## Correcciones prioritarias
1. [P0/P1] problema, ubicación y resultado esperado.

## Autorización de escala
NO AUTORIZADA | AUTORIZADA
```

## Extensión para la revisión final de la alpha

El gate inicial evalúa el kit exterior sin agentes. La revisión final reutilizará esta rúbrica y agregará evidencia de:

- ciudad de día, atardecer y noche;
- cafetería interior aislada;
- ciudad con agentes visibles y con agentes ocultos;
- UI/indicadores en estados `idle`, `thinking`, `using-tool`, `waiting`, `done`, `interrupted`, `error` y `offline`;
- zoom 100%, 150% y 200%;
- nueva partida y modo muestra.

En esa revisión serán bloqueadores adicionales:

1. interior con fondo negro o sin sincronía temporal;
2. cafetería vacía, sin madera/libros/chimenea/cocina o sin rutas caminables;
3. interior que usa el exterior levantando el techo en lugar de escena aislada;
4. agentes con escala dominante, cabezas gigantes, estética Funko o pixel density incompatible;
5. indicadores que convierten el mundo en dashboard o tapan la arquitectura;
6. ocultar agentes detiene o altera visualmente la simulación del mundo.

La cafetería debe conservar la organización narrativa de la referencia interior: barra/cocina funcional, zona de mesas, biblioteca/lectura, hogar de fuego, plantas, vajilla y objetos pequeños; fondo urbano atenuado que se reconoce como Syka World sin competir con el primer plano. No se exige copiar su layout ni sus assets.

## Estado inicial del gate

No se recibieron todavía capturas reales del spike. Por lo tanto:

```text
VEREDICTO: EVIDENCIA INCOMPLETA
PUNTUACIÓN: NO EVALUADA
AUTORIZACIÓN DE ESCALA: NO AUTORIZADA
```
