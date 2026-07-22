# Syka World — Mechanic Integration Pass v1 — E2E

**Resultado:** PASS

Método: Chromium headless con Python Playwright; servidor temporal gestionado por `with_server.py`; bridge controlado y estrictamente GET-only.

La API QA se usó únicamente para controlar hora y otorgar Lúmenes locales. La cafetería y los objetos Exterior se colocaron mediante clicks físicos sobre tarjetas visibles y canvas.

## Recorrido principal 1440×900 — PASS

- **01. Nueva partida con vida ambiental — PASS** (3.308 s)
- **02. Preview explica árbol, limpieza y conector — PASS** (2.489 s)
- **03. Colocación física y carretera automática — PASS** (2.404 s)
- **04. Aceleración real y binding dinámico — PASS** (2.898 s)
- **05. Orden local Ir al Café y entrada sin teletransporte — PASS** (2.994 s)
- **06. Agente visible, anchor y acción interior — PASS** (3.918 s)
- **07. Catálogo Exterior: cinco compras físicas — PASS** (6.458 s)
- **08. Iluminación por familia: día, tarde y noche — PASS** (5.818 s)
- **09. Mejora del Café con cambio visual real — PASS** (4.835 s)
- **10. Retiro de Exterior y reembolso — PASS** (1.641 s)
- **11. Guardar y recargar el circuito completo — PASS** (8.543 s)

- Colocaciones físicas registradas: 7.
- Requests bridge: 8; sólo GET: True.
- Console warnings/errors accionables: 0; page errors: 0; HTTP fallidas: 0.
- Evidencias: reports/e2e/mechanic-integration-v1/screenshots/01-nueva-partida-agentes-1440x900.png, reports/e2e/mechanic-integration-v1/screenshots/02-preview-arbol-y-conector-1440x900.png, reports/e2e/mechanic-integration-v1/screenshots/03-cafe-en-obra-con-camino-1440x900.png, reports/e2e/mechanic-integration-v1/screenshots/04-cafe-completo-nivel-1-1440x900.png, reports/e2e/mechanic-integration-v1/screenshots/05-agente-leyendo-interior-1440x900.png, reports/e2e/mechanic-integration-v1/screenshots/07-catalogo-exterior-colocado-1440x900.png, reports/e2e/mechanic-integration-v1/screenshots/07b-catalogo-exterior-abierto-precios-1440x900.png, reports/e2e/mechanic-integration-v1/screenshots/08-farola-dia-1200-1440x900.png, reports/e2e/mechanic-integration-v1/screenshots/09-farola-atardecer-1830-1440x900.png, reports/e2e/mechanic-integration-v1/screenshots/10-farola-noche-2200-1440x900.png, reports/e2e/mechanic-integration-v1/screenshots/11-cafe-nivel-1-antes-upgrade-1440x900.png, reports/e2e/mechanic-integration-v1/screenshots/12-cafe-nivel-2-despues-upgrade-1440x900.png, reports/e2e/mechanic-integration-v1/screenshots/13-save-reload-restaurado-1440x900.png.

## Responsive y smoke de Muestra

- **1008x548 — PASS**: 9 edificios, 4 agentes, error de escala 0.000030.
- **2560x1080 — PASS**: 9 edificios, 4 agentes, error de escala 0.000009.

## Garde-fous verificados

- Ninguna colocación utilizó `QA.placeBuilding` ni una mutación directa del core.
- El bridge sólo recibió GET sin body y nunca endpoints de comandos o tareas.
- El recorrido cubre cancelación atómica, conector vial, aceleración paga, binding `building-N`, entrada/acción interior, Exterior, luz, upgrade y save/reload.
- Los tres viewports obligatorios quedaron representados: 1008×548, 1440×900 y 2560×1080.
