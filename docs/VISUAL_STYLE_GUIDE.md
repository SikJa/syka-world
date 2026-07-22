# Guía visual v0.1

Estado: dirección exterior/interior confirmada; renderer y avatares finales siguen abiertos.

## Fórmula visual

La ciudad usa pixel art 2.5D isométrico de alta nitidez con cámara fija. MiniTown aporta la lectura observacional y construcción sobre grilla. Los interiores de Whisper of the House aportan densidad, calidez y narrativa de objetos, extrapoladas a exteriores originales sin copiar assets. Garden Galaxy sigue informando variedad de objetos; Tiny Life informa rutinas y vida cotidiana, no el arte principal.

## Requisitos del primer vertical slice

- cámara isométrica fija, sin rotación, con pan y zoom legible;
- mapa compacto que pueda comprenderse de una mirada;
- tiles y sprites modulares con pixel density coherente;
- edificios con siluetas distintas y acceso visual al interior;
- caminos cálidos sobre vegetación abundante;
- pixel clusters deliberados, nearest-neighbor y ausencia de blur;
- luz diurna cálida y noche azul suave con ventanas ámbar;
- objetos pequeños suficientes para diferenciar cada lugar;
- indicadores de estado discretos que no conviertan el mundo en un dashboard;
- cuatro placeholders pixelados discretos, delgados y neutrales, sin proporción Funko;
- animaciones legibles para caminar, pensar, usar herramienta, esperar, celebrar, interrumpirse, fallar y estar offline.

## Paleta inicial

| Uso | Color |
|---|---|
| vegetación base | `#a8c98d` |
| vegetación profunda | `#527a52` |
| caminos | `#e8d9ad` |
| crema arquitectónico | `#f0dba9` |
| coral | `#d56a4c` |
| azul gris | `#8aa9a3` |
| madera | `#795a42` |
| noche | `#263c49` |
| luz nocturna | `#ffe39a` |

## Escala y densidad

Un edificio de trabajo ocupa aproximadamente 7×6 unidades; un personaje mide unas 2,2. La plaza debe reunir a los cuatro sin perderlos. Los objetos decorativos se agrupan en pequeñas composiciones, con espacio negativo suficiente para caminar y leer el estado.

## Interiores y personajes

Los interiores son escenas aisladas de mayor detalle. La cafetería se abre con transición y muestra madera, libros, chimenea, cocina y mobiliario completo. El fondo debe insinuar la ciudad y sincronizar hora, nunca ser negro. Escritorios, pantallas, sillas y plantas incluyen slots opcionales de personalización. La identidad visual de Syka, Elen, Astrelis y Zerny debe residir más adelante en assets separados; las pets actuales son referencias de personalidad, no modelos que deban incrustarse literalmente.

## Presupuesto provisional de rendimiento

- cuatro personajes y cinco edificios visibles a 1080p;
- objetivo de 55–60 fps en la máquina actual;
- carga local menor a tres segundos después de cache;
- atlas comprimidos, batching y culling cuando el mapa crezca;
- zoom limitado a escalas que preserven nitidez;
- cargar sectores o decoración bajo demanda cuando el mapa crezca.

## Decisiones abiertas

- diseño definitivo de cada avatar y relación con su pet;
- cantidad de hogares visibles en el primer mapa;
- nivel final de detalle interior;
- Phaser, PixiJS u otra capa 2D para el frontend definitivo.
