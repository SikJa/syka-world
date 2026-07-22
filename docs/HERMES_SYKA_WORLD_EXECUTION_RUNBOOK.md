# Ejecutar el pase espacial colaborativo con Kimi K3 en Hermes Desktop

Estado: perfil creado y validado el 2026-07-18.

## Configuración preparada

- Perfil Hermes: `syka-world`
- Modelo: `zyloo/kimi-k3`
- Workspace: `F:\Coding Proyects\Syka World Game`
- Goal inmediata: `docs/GOAL_SPATIAL_COLLABORATIVE_PASS_V1.md`
- Roadmap amplio de referencia: `docs/GOAL_HABBO_SPATIAL_PUBLIC_FOUNDATION_V1.md` (no ejecutar completo ahora).
- Gateway del perfil: apagado intencionalmente, sin servicio ni acceso de inicio automático instalado; no hace falta para trabajar desde Desktop.
- Telegram está desactivado en sus dos capas de configuración y el API server está apagado. Su puerto reservado es `8646`, separado del `8644` de Zerny.
- Checkpoints: activados para esta sesión de desarrollo.

El perfil ya respondió correctamente una inferencia mínima con Kimi K3. No hace falta ejecutar `setup` nuevamente salvo que Zyloo cambie o invalide la credencial.

## Antes de empezar

1. Conectar la computadora a la corriente.
2. Evitar que Windows se suspenda durante esta ejecución corta.
3. Cerrar cualquier otra goal o agente que esté editando este mismo repositorio.
4. No iniciar el gateway `syka-world`; el trabajo se hará desde Hermes Desktop.
5. Recordar que el repositorio todavía no tiene un commit base. Los checkpoints ayudan, pero no equivalen a un historial Git completo.

## Método recomendado: abrir directamente el perfil y el proyecto

Abrir PowerShell y ejecutar:

```powershell
Set-Location -LiteralPath 'F:\Coding Proyects\Syka World Game'
hermes -p syka-world desktop --cwd 'F:\Coding Proyects\Syka World Game'
```

Hermes puede tardar en preparar o verificar la aplicación Desktop. Si ya existe una ventana abierta y el comando no cambia el perfil, cerrar solamente la ventana de Hermes Desktop y repetirlo.

## Comprobaciones dentro de Hermes Desktop

Antes de iniciar la goal, comprobar visualmente:

1. El perfil seleccionado debe ser **syka-world**.
2. El modelo debe aparecer como **zyloo/kimi-k3** o **Kimi K3**.
3. La carpeta/proyecto activo debe ser:

```text
F:\Coding Proyects\Syka World Game
```

4. Crear una tarea/chat nuevo. No reutilizar una sesión de CRM de Zerny.
5. No activar Telegram, Gateway ni canales externos.

## Prompt para iniciar la ejecución

Copiar y pegar exactamente este mensaje en el chat nuevo:

```text
/goal Work in the current Syka World repository and read docs/GOAL_SPATIAL_COLLABORATIVE_PASS_V1.md completely. Execute only that focused pass. Do not treat time or tokens as a quota: finish as soon as its acceptance criteria are genuinely verified, targeting roughly 90–150 minutes and stopping by 3 hours. Prioritize a spatially correct café vertical slice, unified click/WASD/NPC navigation, deterministic front/behind rendering, and the smallest safe dynamic Hermes-profile boundary improvement. Preserve the approved detailed pixel-art visual, existing gameplay, saves, and private passive GET-only bridge. Do not rebuild the whole game, perform a full UI redesign, start real Hermes tasks or a Gateway, expose private data, commit, push, publish, deploy, or modify unrelated work. Physically test the result, report incomplete criteria honestly, and return control for collaborative review.
```

## Qué debería hacer Kimi al comenzar

Durante los primeros 10–20 minutos debería:

- leer completamente el documento de la goal;
- inspeccionar sólo el estado, decisiones y módulos directamente relevantes;
- revisar el worktree sin borrar nada;
- ejecutar el baseline de pruebas;
- identificar los módulos reales de spatial runtime, café, perfiles, bridge y saves;
- dejar un baseline breve y empezar el cambio integrado.

Si empieza inmediatamente a borrar el café, crear otro proyecto o reemplazar todo por 3D sin hacer esta auditoría, interrumpir la ejecución.

## Cómo supervisarla sin molestarla

### A los 15–25 minutos

Confirmar que encontró la alpha existente y que está trabajando sobre `app/game`, no creando un proyecto paralelo.

### Cerca de los 60–90 minutos

Debería existir una primera vertical slice real: ocupación, navegación y profundidad compartidas dentro del café.

### Cerca de las 2 horas

Debe estar integrando, probando físicamente y corrigiendo; no agregando nuevas familias de features.

### Antes de las 3 horas

Debe cerrar con un informe honesto aunque quede trabajo. El tiempo no es una meta que haya que llenar.

## Cuándo intervenir

Intervenir solamente si:

- pide una autorización material que el documento no cubre;
- intenta hacer commit, push, deploy o publicación;
- intenta iniciar tareas reales de Hermes;
- intenta copiar datos privados al repositorio;
- está trabajando fuera de la carpeta canónica;
- reemplaza la estética aprobada por una versión claramente inferior;
- repite el mismo bloqueo sin progresar;
- se acerca a las siete horas sin haber comenzado QA y documentación.

## Qué revisar cuando termine

1. Leer primero el resumen final del agente.
2. Abrir `CURRENT_PROJECT_STATE.md` y comprobar que la fecha y el estado fueron actualizados.
3. Buscar el nuevo directorio de evidencia dentro de `reports/`.
4. Ejecutar el juego con los comandos que indique el informe.
5. Ver las capturas y el video, si fueron producidos.
6. Probar personalmente:
   - caminar por ciudad;
   - entrar al café;
   - pasar delante y detrás de objetos;
   - sentarse o interactuar;
   - salir y volver a entrar;
   - revisar la UI;
   - revisar detección de perfiles.
7. No publicar todavía. Primero revisar privacidad, licencias, rutas absolutas, assets y estado del worktree.

## Alternativa por terminal

Si Hermes Desktop no abre, se puede iniciar la misma sesión desde PowerShell:

```powershell
Set-Location -LiteralPath 'F:\Coding Proyects\Syka World Game'
syka-world chat
```

Después pegar el mismo prompt de `/goal`. Desktop sigue siendo la opción recomendada porque permite supervisar mejor la ejecución.
