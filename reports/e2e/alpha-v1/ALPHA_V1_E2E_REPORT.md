# Syka World Alpha v1 — informe E2E

Estado general: **PASS** — 14 PASS, 0 FAIL, 0 BLOCKED.

Método: Chromium headless, Python Playwright y servidor temporal gestionado por `with_server.py`.
El `networkidle` se intenta expresamente; la preparación final se determina por UI + API QA porque el bridge mantiene un GET long-poll abierto por diseño.

## Flujos

| # | Flujo | Estado | Evidencia / resultado |
|---:|---|:---:|---|
| 01 | Abrir modo muestra | **PASS** | `reports/e2e/alpha-v1/screenshots/01-showcase-1440x900.png` |
| 02 | Pan y zoom sin rotación | **PASS** | {"before":{"center":{"x":12,"y":10},"zoom":1,"scene":"city"},"after":{"center":{"x":9,"y":10},"zoom":1.5,"scene":"city"},"rotation_available":false} |
| 03 | Día, atardecer y noche | **PASS** | `reports/e2e/alpha-v1/screenshots/03-city-twilight-z100-agents-visible.png`, `reports/e2e/alpha-v1/screenshots/03-city-twilight-z150-agents-visible.png`, `reports/e2e/alpha-v1/screenshots/03-city-twilight-z200-agents-visible.png`, `reports/e2e/alpha-v1/screenshots/03-city-twilight-z200-agents-hidden.png` |
| 04 | Seleccionar cafetería | **PASS** | {"building_id":"cafe-main","status":"complete","inspector_visible":true} |
| 05 | Entrar al interior | **PASS** | `reports/e2e/alpha-v1/screenshots/05-cafe-interior-1440x900.png` |
| 06 | Comprar decoración opcional | **PASS** | `reports/e2e/alpha-v1/screenshots/06-cafe-decor-installed.png` |
| 07 | Volver conservando cámara | **PASS** | `reports/e2e/alpha-v1/screenshots/07-returned-city.png` |
| 08 | Iniciar nueva partida | **PASS** | `reports/e2e/alpha-v1/screenshots/08-progressive-start.png` |
| 09 | Comprar y colocar cafetería | **PASS** | `reports/e2e/alpha-v1/screenshots/09-cafe-foundation.png` |
| 10 | Construcción completa e interior | **PASS** | `reports/e2e/alpha-v1/screenshots/10-cafe-framing.png`, `reports/e2e/alpha-v1/screenshots/10-completed-cafe-interior.png` |
| 11 | Guardar, recargar y conservar estado | **PASS** | `reports/e2e/alpha-v1/screenshots/11-after-reload.png` |
| 12 | Secuencia completa de estados | **PASS** | {"observed":[{"event_id":"qa-event-001","event":"activity.started","expected":"thinking","activity":"thinking","presence":"online","active_sessions":1},{"event_id":"qa-event-002... |
| 13 | Bridge controlado: desconectar y reconectar | **PASS** | {"connected_initial":"online","disconnected_fallback":"simulated","reconnected":"online","request_count":26,"methods":["GET"]} |
| 14 | Bridge real GET-only | **PASS** | {"mode":"online","source":"bridge","ready_seconds":0.63,"methods":["GET"],"request_count":4,"agents":[{"profile_id":"default","status":"idle","presence":"online","active_session... |

## Auditoría del bridge

- `controlled`: 27 requests observadas; métodos `['GET']`; requests con body: `0`.
- `real`: 4 requests observadas; métodos `['GET']`; requests con body: `0`.

## Gates adicionales

- **PASS** — Higiene del navegador: Sin page errors, console errors inesperados ni assets HTTP fallidos.
- **PASS** — Rendimiento alpha: mediana 60.22 FPS Phaser, p10 60.06, 60.44 FPS RAF, mediana 16.67 ms/frame y carga cálida product-ready en 0.477 s.

## Rendimiento observado

```json
{
  "cold_ready_seconds_controlled": 0.624,
  "feedback_visual_evidence": "reports/e2e/alpha-v1/screenshots/03-city-twilight-z200-agents-visible.png",
  "warm_reload_ready_seconds": 0.477,
  "runtime_after_reload": {
    "actualFps": 60.31,
    "frameMilliseconds": 16.67,
    "activeScenes": [
      "city"
    ],
    "displayObjects": 538,
    "imageObjects": 529,
    "textureCount": 11,
    "renderer": "webgl",
    "rendererDrawCount": 13,
    "heapUsedBytes": 60300000,
    "samples": [
      {
        "actualFps": 60.06,
        "frameMilliseconds": 16.67,
        "activeScenes": [
          "city"
        ],
        "displayObjects": 538,
        "imageObjects": 529,
        "textureCount": 11,
        "renderer": "webgl",
        "rendererDrawCount": 13,
        "heapUsedBytes": 60300000
      },
      {
        "actualFps": 60.06,
        "frameMilliseconds": 16.66,
        "activeScenes": [
          "city"
        ],
        "displayObjects": 538,
        "imageObjects": 529,
        "textureCount": 11,
        "renderer": "webgl",
        "rendererDrawCount": 13,
        "heapUsedBytes": 60300000
      },
      {
        "actualFps": 60.29,
        "frameMilliseconds": 16.67,
        "activeScenes": [
          "city"
        ],
        "displayObjects": 538,
        "imageObjects": 529,
        "textureCount": 11,
        "renderer": "webgl",
        "rendererDrawCount": 13,
        "heapUsedBytes": 60300000
      },
      {
        "actualFps": 60.29,
        "frameMilliseconds": 16.67,
        "activeScenes": [
          "city"
        ],
        "displayObjects": 538,
        "imageObjects": 529,
        "textureCount": 11,
        "renderer": "webgl",
        "rendererDrawCount": 13,
        "heapUsedBytes": 60300000
      },
      {
        "actualFps": 60.22,
        "frameMilliseconds": 16.67,
        "activeScenes": [
          "city"
        ],
        "displayObjects": 538,
        "imageObjects": 529,
        "textureCount": 11,
        "renderer": "webgl",
        "rendererDrawCount": 13,
        "heapUsedBytes": 60300000
      }
    ],
    "actualFpsMedian": 60.22,
    "actualFpsP10": 60.06,
    "frameMillisecondsMedian": 16.67,
    "browserRafFps": 60.44
  },
  "small_viewport": {
    "width": 1008,
    "height": 548,
    "canvas_width": 876.8,
    "canvas_height": 548,
    "canvas_ratio": 1.6,
    "canvas_visible": true,
    "ui_visible": true,
    "evidence": "reports/e2e/alpha-v1/screenshots/responsive-1008x548.png"
  },
  "browser_hygiene": {
    "page_errors": [],
    "console_errors": [],
    "failed_asset_responses": []
  }
}
```

## Higiene del navegador

- Page errors: `0`.
- Console errors: `0`.
- Respuestas HTTP fallidas: `0`.
- El 503 provocado deliberadamente para probar la desconexión controlada se conserva en el JSON pero no cuenta como error inesperado.
- Las advertencias repetitivas del driver WebGL headless quedan conservadas en el JSON y no se reinterpretan como fallo funcional.

## Límites

- La prueba controlada intercepta únicamente `/bridge/api/world/*`; no representa una integración Hermes real.
- La prueba real sólo observa estado/eventos mediante GET y nunca inicia tareas.
- Los avatares siguen siendo placeholders provisionales según la definición de la alpha.
