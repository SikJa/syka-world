# Habbo Spatial Public Foundation v1 — Physical E2E Report

**Date:** 2026-07-20T07:27:35Z
**Flows:** 13/13 PASS, 0 FAIL

## Flows

### 01 — City loads with English UI — PASS
- Duration: 0.914s
- lang: en
- title: Syka World

### 02 — Agent selectable with real profile ID — PASS
- Duration: 0.946s
- profileId: default

### 03 — Responsive screenshots at 4 resolutions — PASS
- Duration: 3.461s
- screenshots: 4

### 04 — FPS measurement in city — PASS
- Duration: 3.324s
- fps: 60.67

### 05 — Possess + WASD moves actor in city — PASS
- Duration: 2.395s
- profileId: default
- before: {'x': 7, 'y': 7}
- after: {'x': 7, 'y': 6}
- moved: True

### 06 — Enter the cafe interior — PASS
- Duration: 3.039s
- cafe_id: cafe-main
- scene_before: city
- scene_after: interior

### 07 — FPS measurement in cafe — PASS
- Duration: 3.192s
- fps: 60.33

### 08 — E key in cafe interior without errors — PASS
- Duration: 1.813s
- scene: interior
- interior_actors: 2
- e_pressed: True
- no_errors: True

### 09 — Exit and re-enter cafe in same game — PASS
- Duration: 4.758s
- scene_after_exit: city
- scene_after_reentry: interior

### 10 — Save and reload — PASS
- Duration: 1.982s
- scene_after_reload: interior

### 11 — Input focus does not trigger game controls — PASS
- Duration: 0.562s
- input_was_focused: True

### 12 — Bridge traffic is GET-only with no body — PASS
- Duration: 0.0s
- total_requests: 7
- all_get: True
- no_body: True

### 13 — No unexpected page/console/HTTP errors — PASS
- Duration: 0.0s
- page_errors: 0
- failed_responses: 7
- non_bridge_failures: 0

## Bridge audit
- Console warnings/errors: 11
- Page errors: 0
- Bridge requests: 7
- Failed responses: 7
- Methods: {'GET'}
- Any body: False

## Metrics
- city_fps: 60.67
- cafe_fps: 60.33