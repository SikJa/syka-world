# Informe técnico — Visual Lab v0.1

Estado: prototipo aislado ejecutable; no es el frontend definitivo.

## Elección técnica

Se usó Three.js directo con Vite. Para este laboratorio pequeño evita acoplar la simulación a React u otro framework, mantiene el renderer reemplazable y permite probar cámara, iluminación, personajes y bridge con una dependencia visual principal. La decisión no obliga al vertical slice a conservar el mismo stack.

## Lo implementado

- plaza, café y cuatro edificios de trabajo;
- caminos, vegetación, faroles e interiores recortados;
- cuatro placeholders neutrales;
- movimiento local y ciclo día/noche;
- inspección de personaje o edificio;
- los ocho estados visuales canónicos;
- secuencia automática con datos simulados;
- conexión opcional de sólo lectura al snapshot del bridge mediante proxy local.

## Reproducción

```powershell
cd lab\visual
npm install
npm run dev
```

Build:

```powershell
npm run build
```

## Medición actual

Prueba headless en Microsoft Edge, viewport 1440×900:

- 57 fps observados;
- 311 draw calls;
- 680 ms hasta `load` en la corrida headless local;
- 15,9 MiB de heap JavaScript usado;
- 68 nodos DOM y 8 recursos durante la prueba conectada al bridge;
- los ocho estados representados y verificados;
- 0 errores de consola;
- build: 543,66 kB JS minificado / 139,56 kB gzip;
- CSS: 5,59 kB / 2,02 kB gzip;
- `npm audit`: 0 vulnerabilidades conocidas.

La captura de QA está en `.runtime/visual-lab-qa.png`. El lanzador de pruebas detuvo el servidor al terminar y el laboratorio ya no depende de Google Fonts ni de otra red para arrancar. CPU y memoria GPU no se informan porque un navegador headless no da una medida representativa de una sesión interactiva; se conservan fps, draw calls, heap JavaScript y tiempo de carga como indicadores reproducibles.

## Evaluación

- **Carga:** pequeña en transferencia gzip, aunque Three.js produce una advertencia por chunk bruto mayor a 500 kB.
- **Fluidez:** suficiente con cuatro personajes en la máquina actual.
- **Objetos:** agregar muebles o vegetación es simple, pero cada mesh separado eleva draw calls.
- **Personajes:** cada placeholder es un grupo reemplazable y no contiene identidad final.
- **Empaquetado:** Vite permite web local y luego podría envolverse en PWA o Tauri.
- **Límite principal:** antes de ampliar el mapa conviene instanciar vegetación/props y dividir o cargar Three.js estratégicamente.
