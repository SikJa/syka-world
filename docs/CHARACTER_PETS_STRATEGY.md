# Estrategia de pets y personajes

Última actualización: 2026-07-15

## Decisión

Las pets actuales serán la semilla visual de cada identidad, pero no se asumirán como los sprites finales de Syka World.

```text
Hermes profile -> agent identity -> current desktop pet -> future world avatar
```

La pet de escritorio y el avatar del mundo pueden compartir identidad sin usar exactamente el mismo asset.

## Estado comprobado

| Personaje | Perfil | Pet configurada | Estado |
|---|---|---|---|
| Syka | `default` | ninguna; pets desactivadas | identidad visual pendiente |
| Elen | `elen` | `elen` | humanoide personalizada, formato anterior |
| Astrelis | `astrelis` | `black-cat-1` | gato negro, formato anterior |
| Zerny | `zerny` | `shrimpy-keys` | camarón rojo con lentes y teclado, formato v2 |

## Por qué no insertarlas sin adaptación

Las hojas actuales son sprites 2D para pets de escritorio. Sus animaciones expresan estados de Codex/Hermes, pero no comparten necesariamente:

- perspectiva cenital o isométrica;
- escala corporal;
- estilo y nivel de detalle;
- locomoción en cuatro u ocho direcciones;
- pivote de pies y colisiones;
- separación entre cuerpo y objetos de trabajo;
- paleta y luz del mundo MiniTown.

Ponerlas literalmente dentro de una ciudad cenital podría hacer que parezcan stickers flotantes y que Elen, el gato y el camarón pertenezcan a juegos distintos.

## Estrategia por etapas

### Etapa 1 — placeholders honestos

En el visor técnico del bridge:

- usar las pets actuales para reconocer inmediatamente a Elen, Astrelis y Zerny;
- usar una silueta o placeholder neutral para Syka;
- aceptar que todavía no coincidan perfectamente con el mundo;
- probar identidad, estados y flujo Hermes → personaje.

No modificar ni reemplazar las pets instaladas.

### Etapa 2 — ficha de identidad

Definir para cada personaje:

- especie o forma definitiva;
- personalidad visual;
- silueta;
- colores y marcas esenciales;
- ropa/accesorios;
- rol y edificio;
- manera de caminar, pensar, trabajar, esperar y descansar;
- rasgos que deben conservarse de la pet actual.

La decisión puede confirmar la forma actual, transformarla o diseñar algo nuevo.

### Etapa 3 — world avatars coherentes

Crear un set nuevo para el mundo con:

- misma cámara y escala;
- misma dirección de luz;
- locomoción coherente;
- animaciones de idle, walk, thinking, working, waiting, done y error;
- variantes de trabajo por personaje;
- retrato de inspección;
- consistencia visual entre humano, gato, camarón y futura identidad de Syka.

Las pets actuales se usarán como referencias de identidad durante la creación.

### Etapa 4 — sincronización opcional

Más adelante se puede compartir una ficha de identidad entre la pet de escritorio y el world avatar. Cambiar una no debe romper automáticamente la otra: la sincronización será explícita y versionada.

## Criterio para elegir personajes definitivos

No hace falta decidirlos ahora. Antes del frontend definitivo se hará una revisión individual:

1. ¿La forma actual representa realmente al agente?
2. ¿Es reconocible a escala pequeña?
3. ¿Puede moverse naturalmente en el mundo?
4. ¿Combina con los otros habitantes?
5. ¿Qué rasgos deben preservarse aunque cambie el diseño?

## Uso de hatch-pet e imagegen

Cuando se decida crear o actualizar una pet, se utilizará el flujo `hatch-pet` para generar y validar su atlas completo. Los world avatars podrán necesitar otro contrato de sprites específico del juego; no se forzará el formato de pet de escritorio si no encaja con la cámara del mundo.
