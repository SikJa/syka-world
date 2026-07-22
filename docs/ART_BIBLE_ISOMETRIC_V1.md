# Syka World — Art Bible isométrica v1

Estado: contrato de producción para el gate y la alpha. La aprobación visual depende de capturas de runtime, no de este documento.

## Cámara y resolución

- proyección isométrica 2:1 con una única orientación;
- tile lógico inicial: 32×16 px;
- canvas lógico: 720×450, mostrado a 1440×900 durante el QA principal;
- `nearest-neighbor`, antialias desactivado y coordenadas redondeadas;
- zoom permitido: 100%, 150% y 200%;
- pan con cámara fija y ninguna ruta de entrada para rotación;
- edificios, caminos, props y personajes usan la misma proyección y dirección de luz.

## Jerarquía de escala

| Familia | Escala lógica objetivo |
|---|---:|
| puerta | 8–11 px de ancho, 16–20 px de alto |
| personaje placeholder | 9–12 px de ancho, 20–25 px de alto |
| árbol adulto | 20–30 px de copa, 38–52 px de alto |
| casa | footprint 3×3 o 4×3 tiles |
| cafetería | footprint 4×3 o 5×4 tiles |
| oficina/taller | footprint 5×4 a 7×6 tiles |

Las referencias conceptuales tienen microdetalle muy alto. En runtime se conserva su lenguaje mediante grupos legibles, no reduciendo cada objeto hasta volverlo ruido.

## Paleta y materiales

Familia base:

- vegetación clara `#A8C98D`;
- vegetación media `#89A968`;
- vegetación profunda `#527A52`;
- asfalto `#465252` y sombra `#303B3D`;
- camino/acera `#E8D9AD`;
- crema arquitectónico `#F0DBA9`;
- coral `#D56A4C`;
- madera `#795A42`;
- pizarra azul `#45616A`;
- ambiente nocturno `#263C49`;
- luz emitida `#FFE39A`.

Cada material necesita al menos base, sombra y acento. La luz emitida no sustituye el color del material.

## Dirección de luz

- luz ambiente desde arriba/izquierda;
- paredes derechas ligeramente más luminosas que las izquierdas sólo cuando coincida con la lectura del volumen;
- sombra proyectada hacia abajo/derecha;
- atardecer: ambiente frío moderado y ventanas/faroles ámbar;
- noche: reducción real de ambiente más aportes locales identificables;
- halos pixelados contenidos; nunca bloom suave sobre toda la escena.

## Lenguaje de píxel

- contorno exterior de 1 px lógico en objetos principales;
- contorno interior más suave o parcial;
- clusters rectangulares deliberados, sin líneas vectoriales suavizadas;
- texturas repetidas con variaciones controladas;
- ningún sprite se escala de forma independiente con filtrado diferente;
- roof shingles, ladrillos y madera respetan la inclinación isométrica;
- evitar diagonales de un solo píxel demasiado largas que produzcan shimmering.

## Arquitectura

Una silueta debe permitir identificar el uso sin leer UI:

- casa: techo inclinado, chimenea, pequeño jardín, buzón/cerca y sendero;
- cafetería: mayor fachada pública, toldo, cartel, terraza, mesas/macetas y ventanas cálidas;
- marketing: grandes ventanas, vegetación creativa, carteles o materiales de estudio;
- comercial: fachada ordenada, acceso formal y zona de reunión;
- CRM/taller: portón, cajas, herramientas, archivadores y patio de trabajo;
- espacio comunitario: asientos, agua/vegetación y circulación abierta.

Todo edificio terminado está amueblado. El interior es una escena separada, nunca un techo levantado sobre el exterior.

## Densidad narrativa

Por edificio visible en el gate:

- mínimo tres grupos diferentes de detalle perimetral;
- mínimo dos niveles de vegetación además de árboles;
- entrada y relación con camino claramente legibles;
- al menos una microescena funcional: terraza, jardín, carga, lectura o reunión.

El espacio público del gate necesita al menos dos grupos adicionales: por ejemplo banco+farol+cantero y fuente+cartel+jardineras. Repetir el mismo árbol no aumenta densidad narrativa.

## Vegetación

Tres escalas obligatorias:

1. dosel: árboles con al menos dos siluetas;
2. masa media: setos, arbustos, jardineras y trepadoras;
3. acento: flores, hierba, macetas y bordes orgánicos.

La vegetación se adhiere a lotes, fachadas y caminos. No debe parecer sembrada al azar sobre tiles vacíos.

## UI

- mínima, cálida y no técnica;
- tipografía editorial compacta, con cifras legibles;
- paneles oscuros con crema/ámbar, sin gradientes morados ni estética de dashboard SaaS;
- estados Hermes se muestran como señales pequeñas en el mundo o inspector contextual;
- la UI nunca tapa el foco visual del gate.

## Personajes provisionales

- siluetas delgadas y neutrales;
- pivote en los pies y escala consistente con puertas/muebles;
- sin cabezas gigantes, estética Funko o especies definitivas;
- los ocho estados se diferencian por pose y objeto, no por paneles invasivos;
- ocultarlos no altera la simulación.

## Procedencia

El kit de runtime es original y se construye dentro del proyecto mediante código y assets propios. Las cuatro imágenes aprobadas son referencias de lenguaje visual; nunca fondos, recortes o atlas. Ningún asset comercial se incorpora sin licencia verificada.

## Rechazos inmediatos

- apariencia 3D low-poly o vectorial suavizada;
- noche resuelta únicamente con un overlay uniforme;
- edificios genéricos que sólo cambian color;
- árboles idénticos repetidos como principal fuente de detalle;
- blur o píxeles desiguales en cualquiera de los tres zooms;
- fondo conceptual usado como escena no interactiva;
- interior negro, vacío o integrado levantando el techo;
- personajes provisionales presentados como diseño definitivo.
