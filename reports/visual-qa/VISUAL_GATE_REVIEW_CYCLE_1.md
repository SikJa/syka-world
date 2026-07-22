# Syka World — Revisión del gate visual, ciclo 1

Fecha: 2026-07-16  
Revisor independiente: `visual_director_qa`  
Rúbrica aplicada: `reports/visual-qa/VISUAL_GATE_RUBRIC_V1.md`  
Referencia principal: `research/visual-concepts/approved-direction-v1/city-layout-a-twilight.png`

## Veredicto

```text
VEREDICTO: RECHAZADO — ITERAR
PUNTUACIÓN: 36,6/100
AUTORIZACIÓN PARA ESCALAR LA CIUDAD: NO AUTORIZADA
```

El ciclo 1 demuestra una proyección isométrica navegable y un render nítido en capturas estáticas, pero todavía es un **placeholder procedural de formas planas**, no un kit de pixel art detallado cercano a la dirección aprobada. La diferencia no es de pulido menor: arquitectura, vegetación, densidad narrativa y, sobre todo, iluminación requieren otro pase artístico de base antes de escalar contenido.

Además, el estado noche no está implementado visualmente en la evidencia. Las parejas a 150% y 200% son archivos idénticos byte por byte; a 100% cambia el rótulo horario, pero el mundo visible permanece igual.

## Evidencia inspeccionada

Se inspeccionaron a resolución completa:

- `gate-twilight-zoom-100.png` — 1440×900;
- `gate-twilight-zoom-150.png` — 1440×900;
- `gate-twilight-zoom-200.png` — 1440×900;
- `gate-night-zoom-100.png` — 1440×900;
- `gate-night-zoom-150.png` — 1440×900;
- `gate-night-zoom-200.png` — 1440×900;
- `gate-pan-after.png` — un único frame posterior al pan;
- `browser-state.txt` — estado final y ausencia de errores de consola/página;
- `gate-startup-failure.png` y `startup-errors.txt` — evidencia de arranque del laboratorio descartado, no evidencia del gate artístico.

También se compararon a resolución completa las cuatro referencias de `research/visual-concepts/approved-direction-v1/`.

### Integridad y autenticidad

| Requisito | Estado | Evidencia |
|---|---|---|
| Seis capturas 1440×900 | Cumple | Las seis existen y tienen la resolución correcta. |
| Atardecer y noche | Falla material | Los rótulos cambian, pero la escena no cambia visualmente. |
| Zooms 100/150/200 reproducibles | Parcial | Las escalas son distintas; falta metadata completa que pruebe zoom/cámara. |
| Mismo ancla por pareja | Aparenta cumplir | El encuadre coincide en cada pareja, pero no hay `capture-metadata.json`. |
| Evidencia de movimiento a 150% | No cumple | Sólo existe `gate-pan-after.png`; no hay video ni secuencia de 12 frames. |
| Procedencia/licencias | No cumple | Falta `asset-provenance.md`. |
| Parámetros del renderer | No cumple | Falta `implementation-notes.md`. |
| Sin errores de consola | Cumple | `browser-state.txt` registra `console_errors=[]` y `page_errors=[]`. |

### Prueba objetiva del fallo día/noche

- `gate-twilight-zoom-150.png` y `gate-night-zoom-150.png` comparten SHA-256 `2315F178625E208A8F0555513DA5285A967D010CD6F5116BF4CDE3D7265AA331`.
- `gate-twilight-zoom-200.png` y `gate-night-zoom-200.png` comparten SHA-256 `61D55AC1D2F37438440F231267410FE08AADCFA5F04C1FC27E3D7BD5B0A3078E`.
- En la pareja 100%, un muestreo de 57.375 píxeles del área de mundo a la derecha del HUD encontró cero diferencias. La diferencia visible se limita al texto `Atardecer · 19:15` frente a `Noche · 21:00`.

Por lo tanto, la evidencia contradice el requisito de dos estados visuales distintos.

## Puntuación

| # | Criterio | Peso | Nota | Puntos | Evaluación |
|---:|---|---:|---:|---:|---|
| 1 | Proyección isométrica y cámara fija | 10 | 3/5 | 6,0 | La retícula, caminos y edificios mantienen ejes isométricos reconocibles. El frame posterior prueba desplazamiento, pero falta evidencia continua y no se prueba que la rotación sea imposible. |
| 2 | Composición y lectura espacial | 8 | 2/5 | 3,2 | La cruz vial organiza el mapa, pero dos volúmenes enormes dominan un lote muy vacío; no existe jerarquía de vecindario ni foco de cafetería comparable con la referencia. |
| 3 | Proporciones y escala | 8 | 2/5 | 3,2 | Puertas y ventanas resultan diminutas sobre fachadas vacías; árboles, faroles, bancos y edificios no comparten una escala narrativa convincente. |
| 4 | Nitidez y estabilidad de píxel | 15 | 3/5 | 9,0 | Las capturas estáticas son nítidas y sin blur evidente en 100/150/200. No puede verificarse shimmering ni estabilidad subpíxel por falta de secuencia de pan. |
| 5 | Coherencia entre tiles y sprites | 10 | 3/5 | 6,0 | El acabado procedural plano es internamente consistente, pero no alcanza la densidad ni el tratamiento raster/pixel art de las referencias. La grilla y los outlines dominan demasiado. |
| 6 | Arquitectura y siluetas exteriores | 8 | 1/5 | 1,6 | Ambos edificios son cajas con techos piramidales y fachadas casi vacías. No se reconoce cafetería por arquitectura; faltan toldo, terraza, escaparate, chimenea, zócalos, marcos y planos secundarios. |
| 7 | Densidad y narrativa de objetos | 10 | 1/5 | 2,0 | Hay bancos, un kiosco, una fuente y flores aisladas, pero no existen tres microescenas por edificio ni narrativa de actividad. El mapa se siente como fixture técnico. |
| 8 | Vegetación y props ambientales | 8 | 1/5 | 1,6 | Se repite un único árbol de copa cuadrada que parece señalética; no hay dosel orgánico, setos, arbustos, jardineras, trepadoras ni composición por capas. |
| 9 | Iluminación de atardecer y noche | 12 | 0/5 | 0,0 | Criterio ausente. El mundo es idéntico entre atardecer y noche; sólo cambia el rótulo. Las luces no alteran ambiente, materiales ni contraste. |
| 10 | Paleta, contraste y materiales | 5 | 2/5 | 2,0 | Césped, asfalto y techos se distinguen, pero la paleta es plana y lavada. No existe el contraste ambiente frío/luz ámbar ni una jerarquía material rica. |
| 11 | Orden de profundidad, seams y oclusión | 4 | 2/5 | 1,6 | El sorting general es legible, pero hay elementos cortados fuera del terreno, copas superpuestas mecánicamente y una lectura confusa de postes/objetos bajo fachadas. Falta prueba en movimiento. |
| 12 | Originalidad y legitimidad de runtime | 2 | 1/5 | 0,4 | Parece producción original, pero no existe inventario de procedencia/licencia ni separación documentada entre arte final y placeholder. |
|  | **Total** | **100** |  | **36,6** | Umbral requerido: 85,0 y todos los críticos ≥4/5. |

## Criterios críticos incumplidos

Todos los criterios críticos quedan debajo del mínimo 4/5:

- proyección/cámara: 3/5;
- proporciones/escala: 2/5;
- nitidez/estabilidad: 3/5;
- coherencia del kit: 3/5;
- iluminación: 0/5;
- depth/seams: 2/5;
- legitimidad/procedencia: 1/5.

## Bloqueadores de rechazo

### B1 — Dirección artística incorrecta

La escena está dominada por polígonos planos, líneas de contorno y formas geométricas de baja densidad. Se lee como visualizador técnico vectorial/procedural, no como pixel art raster detallado y acogedor. Activa el bloqueador 4 de la rúbrica.

### B2 — Noche inexistente visualmente

Las escenas de atardecer y noche son idénticas salvo el HUD. No hay ambiente frío más oscuro, cambio de materiales, ventanas diferenciadas ni fuentes locales con contribución visible. Activa el bloqueador 7.

### B3 — Cafetería no identificable

Ninguno de los dos edificios se reconoce como cafetería sin información externa. Falta exterior específico, terraza, escaparate/toldo, acceso y utilería vinculada. El paquete no demuestra el exterior de cafetería requerido y activa el bloqueador 6.

### B4 — Evidencia de movimiento y procedencia incompleta

Un frame posterior al pan no permite inspeccionar shimmering, saltos de sorting o estabilidad. También faltan metadata, procedencia y notas de implementación. La aprobación no puede sostenerse con evidencia incompleta.

### B5 — Placeholders dominantes no inventariados

Edificios, árboles y props principales siguen siendo placeholders geométricos y no existe inventario que los marque como tales. Activa el bloqueador 10.

## Comparación con las referencias aprobadas

### Preservado

- Cámara isométrica fija como intención general.
- Carreteras oscuras sobre terreno verde.
- Ventanas y faroles con color cálido básico.
- Siluetas estáticas nítidas y zoom visualmente distinguible.
- Mapa pequeño, decisión válida para un gate.

### Simplificado de forma todavía aceptable

- Cantidad de edificios: el spike no necesita reproducir una ciudad completa.
- Fondo celeste y límites de terreno: pueden mantenerse durante el gate si la escena principal alcanza calidad.
- Ausencia de personajes: es correcta para evaluar el mundo.

### Distancia no aceptable

- La referencia A usa edificios con múltiples planos, materiales, aleros, terrazas, marcos y siluetas individuales; ciclo 1 usa dos cajas casi vacías.
- A y C integran árboles, setos, flores, jardines, agua y props en capas; ciclo 1 repite una copa cuadrada sin estratos vegetales.
- La referencia distribuye microescenas en cada lote y borde de calle; ciclo 1 deja grandes superficies sin narrativa.
- La referencia construye calidez mediante contraste azul/ámbar localizado; ciclo 1 conserva exactamente la misma iluminación en noche.
- La referencia posee clusters raster ricos y materialidad; ciclo 1 utiliza formas planas y líneas uniformes.

## Correcciones prioritarias para el ciclo 2

### 1. [P0] Sustituir el kit procedural por assets raster originales y modularizados

No conviene intentar salvar el aspecto final agregando más rectángulos al renderer actual. Crear una mini art bible y un kit raster propio —se permite generación de imagen como fuente original seguida de limpieza manual, recorte y normalización— con:

- tile 2:1 y resolución lógica única;
- `nearest-neighbor`, pivotes y pixel snapping documentados;
- paleta, contorno, sombra y dirección de luz comunes;
- casa, cafetería, 2–3 árboles, seto, arbusto, flores, farol, banco, cerca y props en sprites/atlas modulares;
- procedencia/licencia e inventario terminado/provisional.

Resultado verificable: en la captura 100%, casa y cafetería deben parecer assets intencionales del mismo juego, no primitivas del renderer.

### 2. [P0] Implementar dos estados lumínicos reales

Separar la paleta ambiental de las luces locales:

- atardecer con ambiente azul suave, fachadas todavía cálidas y primeras luces;
- noche más fría/oscura, pero legible;
- ventanas y faroles ámbar que alteren píxeles cercanos de forma localizada;
- sin bloom borroso ni overlay único.

Resultado verificable: las parejas twilight/night con mismo zoom y cámara deben diferir materialmente fuera del HUD; los hashes no pueden coincidir.

### 3. [P1] Rediseñar casa y cafetería como siluetas distintas y narrativas

- Casa: techo con alero/chimenea, sendero, cerca, buzón y jardín.
- Cafetería: toldo o escaparate, cartel, terraza con mesa/sillas, jardineras y acceso inequívoco.
- Añadir profundidad con zócalo, marcos, cornisas, sombras de alero y al menos dos materiales por fachada.
- Corregir escala de puertas, ventanas, faroles y bancos respecto de los footprints.

Resultado verificable: un revisor puede identificar ambos edificios sin texto ni inspector.

### 4. [P1] Construir densidad exterior en capas, sin llenar por repetición

Introducir tres estratos de vegetación y al menos tres microescenas por edificio más dos en el espacio público. Reducir la grilla visual dominante y agrupar props con espacio negativo transitable. Variar forma, altura y color de árboles; integrar setos, arbustos, trepadoras, macetas y flores a fachadas/caminos.

Resultado verificable: ningún perímetro principal queda vacío y ningún tipo de árbol representa por sí solo toda la vegetación.

### 5. [P0] Entregar un paquete de evidencia reproducible completo

Crear para ciclo 2:

- seis PNG 1440×900, mismo ancla por estado/zoom;
- `capture-metadata.json` con viewport, DPR, zoom, hora y cámara;
- video de 6–10 s o 12 frames de pan a 150%;
- `asset-provenance.md`;
- `implementation-notes.md`;
- UI de depuración oculta y sin elementos huérfanos fuera del terreno.

Resultado verificable: un tercero puede reproducir encuadre, zoom y estados y evaluar estabilidad sin inferencias.

## Condición para revisar ciclo 2

No se requiere una ciudad mayor. Se requiere el **mismo alcance pequeño** rehecho con un kit visual convincente: terreno, caminos, una casa, una cafetería, vegetación, faroles, atardecer y noche. Agregar oficinas, agentes, economía o interiores antes de resolver estos cinco puntos no mejora el gate y no está autorizado.

```text
VEREDICTO FINAL DEL CICLO 1: RECHAZADO — ITERAR
AUTORIZACIÓN PARA ESCALAR: NO AUTORIZADA
```
