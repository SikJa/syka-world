# Arquitectura propuesta del bridge

Estado: bridge v0.3 implementado; canal plugin Desktop validado en vivo con los cuatro perfiles y fallback SQLite comprobado en sólo lectura.

## Arquitectura vigente v0.3

La frontera sigue siendo pasiva, pero ahora combina dos fuentes con autoridad explícita. El plugin de hooks públicos es primario. Un lector SQLite por perfil reconstruye únicamente lifecycle Desktop cuando el plugin está ausente o recuperándose. El reducer mantiene estado por `(profile_id, session_id)`, agrega una sesión dominante de forma determinista y persiste su estado y cursores en un checkpoint atómico versionado.

La simulación vive en otro paquete y sólo consume señales `syka.world.event.v1`; no importa Hermes, el lector SQLite ni el renderer. El laboratorio visual consume snapshots de sólo lectura y puede reemplazarse sin alterar reglas.

## Decisión central

No conectar el juego directamente a archivos, puertos o detalles internos de Hermes. Crear una frontera propia y versionada: **Syka World Bridge**.

La implementación v0.1 eligió hooks oficiales mediante un plugin observador. Los eventos se escriben en archivos JSONL separados por perfil/proceso y el bridge los consume de manera incremental. La API inicial usa snapshot más long-poll; WebSocket/SSE queda para cuando un frontend lo necesite.

```text
Hermes y sus canales
  ├─ eventos live oficiales / Gateway / SSE
  ├─ sesiones por perfil como fallback
  ├─ Kanban como señal secundaria
  └─ futuros comandos desde el mundo
             ↓
      conectores por fuente
             ↓
      normalizador de eventos
             ↓
  syka.world.event.v1
             ↓
      reducer de estado
             ↓
  syka.world.state.v1
             ↓
 API/stream estable para cualquier frontend
```

## Capas

### 1. Registro de perfiles

Descubre perfiles y disponibilidad desde Hermes. Los puertos son estado runtime y no identidad. Cada personaje se vincula mediante `profile_id`, no mediante un puerto hardcodeado.

El registro se divide en dos:

```text
Character Registry — estable y editado por nosotros
syka     -> Hermes profile default
elen     -> Hermes profile elen
astrelis -> Hermes profile astrelis
zerny    -> Hermes profile zerny

Runtime Registry — descubierto y renovable
profile_id -> home path, gateway status, API address, capabilities, last_seen
```

Al iniciar:

1. consulta perfiles reales mediante superficies públicas de Hermes;
2. resuelve el directorio de cada perfil;
3. determina qué gateway/API está disponible;
4. valida cada conexión con un health check;
5. publica online/offline sin cambiar la identidad del personaje.

Si Hermes no expone una dirección mediante CLI/API, se usará un archivo local de conexiones separado y validado en startup. Nunca se guardará un puerto dentro de la identidad del personaje ni se asumirá que `8642` pertenece siempre al mismo perfil.

Si aparece actividad de un perfil desconocido, se conserva como evento no asignado para diagnóstico. Nunca se atribuye automáticamente a Syka.

### 2. Ingress live

Fuente preferida para detectar inicio de sesión, pensamiento, herramientas, espera, finalización y error. Primero se auditarán las superficies públicas de Hermes 0.18.2. El patrón de adaptador WebSocket de Claw3D es una referencia fuerte, pero hay que comprobar si observa tareas iniciadas desde todos los canales o sólo las que pasan por su propio adaptador.

### 3. Recuperación por sesiones

Cada perfil tiene su propio directorio. El lector debe servir para reconstrucción, recuperación y degradación controlada, no como único mecanismo live. Debe manejar JSON/JSONL, offsets, duplicados y eventos fuera de orden.

### 4. Normalizador

Convierte señales heterogéneas en un contrato estable. Campos mínimos sugeridos:

```json
{
  "schema": "syka.world.event.v1",
  "event_id": "...",
  "occurred_at": "...",
  "profile_id": "elen",
  "agent_id": "elen",
  "session_id": "...",
  "type": "activity.started",
  "activity": "working",
  "tool_family": "browser",
  "source": "hermes-live",
  "correlation_id": "...",
  "metadata": {}
}
```

No guardar razonamiento interno completo. Para el mundo bastan señales y resúmenes seguros.

### 5. Reducer de mundo

Transforma eventos en estado determinista: ubicación deseada, actividad, animación, tarea visible y última actualización. El frontend recibe estado; no interpreta directamente formatos de Hermes.

### 6. Stream al frontend

Una API de snapshot más un canal de eventos. La combinación inicial recomendada es `GET /api/world/state` y WebSocket o SSE para actualizaciones. La elección se hará según simplicidad y reconexión.

### 7. Command boundary futura

Separar dos contratos:

- `world command`: acción visual segura y local.
- `agent task`: trabajo real de Hermes, autenticado y explícito.

## Estrategia de fuentes

Orden recomendado:

1. Eventos live desde una superficie pública de Hermes que cubra los canales reales.
2. API/SSE autenticada por perfil para ejecuciones y chats iniciados desde Syka World.
3. Archivos de sesiones por perfil como fallback/replay.
4. Kanban como enriquecimiento de dominio.
5. Inferencia por procesos o scraping de UI sólo como último recurso.

## Criterio de bridge v1 terminado

No alcanza con aceptar un POST manual. Se considera terminado cuando una tarea iniciada por cada canal acordado produce, sin intervención manual, el perfil, estado y transición correctos; además sobrevive reinicios, reconexión y eventos duplicados.

Estado actual: contratos, observador, reducer, replay, duplicados y API probados. El camino Desktop → plugin → bridge fue validado con tareas reales en los cuatro perfiles. La v0.3 conserva la robustez v0.2 y agrega fallback SQLite, checkpoints persistentes, presencia, concurrencia, diagnósticos y retención reversible.

## Secuencia de implementación

### Paso 1 — auditoría de Hermes

Determinar qué superficie live de Hermes 0.18.2 ve realmente cada canal y qué metadatos entrega. No instalar un plugin hasta saber qué hooks oficiales existen.

### Paso 2 — bridge aislado

Construir sólo descubrimiento, contratos, normalización, reducer y replay. Sin frontend definitivo y sin capacidad de ejecutar tareas.

### Paso 3 — prueba por perfiles

Lanzar una tarea pequeña y segura en cada perfil/canal acordado. Verificar eventos y estado por API:

```text
perfil correcto -> sesión correcta -> estado correcto -> fin correcto
```

### Paso 4 — cliente visual mínimo

Conectar un visor descartable que muestre cuatro personajes simples y las transiciones. Esto valida la frontera antes de invertir en el mundo.

### Paso 5 — vertical slice MiniTown

Conectar el bridge probado con una ciudad pequeña, vida ambiental e inspección. El frontend definitivo empieza recién acá.

## Decisiones que debe confirmar Sikora

Confirmadas:

1. Syka → `default`, Elen → `elen`, Astrelis → `astrelis`, Zerny → `zerny`.
2. Syka World sólo observa; no inicia gateways.
3. Hermes Desktop/chat es el único canal obligatorio del MVP.
4. La pantalla muestra un resumen corto de la tarea.
5. Edificios iniciales: Syka central, Elen marketing, Astrelis comercial, Zerny taller/CRM, plaza y café compartidos.

Pendiente: convertir estas decisiones en criterios de aceptación medibles antes de implementar.
