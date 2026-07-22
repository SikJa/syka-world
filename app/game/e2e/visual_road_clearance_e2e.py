"""Raster-level building-to-road clearance gate for Syka World.

Unlike logical footprint checks, this gate samples the exact alpha masks used
by Phaser after their configured display scaling. It compares every opaque
building pixel with the opaque diamond pixels of every rendered road tile and
requires at least one visible grass pixel between both masks.
"""

from __future__ import annotations

import json
import time
import traceback
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from playwright.sync_api import Page, sync_playwright

from alpha_v1_e2e import BASE_URL, BrowserAudit, ControlledBridge, qa_call, require, wait_ready
from final_browser_e2e import REPO_ROOT, actionable_console, instrument_document


REPORT_DIR = REPO_ROOT / "reports" / "e2e" / "visual-road-clearance"
SCREENSHOT_DIR = REPORT_DIR / "screenshots"
REPORT_JSON = REPORT_DIR / "visual-road-clearance.json"
REPORT_MD = REPORT_DIR / "VISUAL_ROAD_CLEARANCE.md"
ALPHA_THRESHOLD = 48
REQUIRED_MASK_DISTANCE = 2  # endpoints two pixels apart => one complete pixel of grass between them
GROUND_CONTACT_BAND = 40
GROUND_ENVELOPE_THICKNESS = 3
GROUND_COMPONENT_BOTTOM_TOLERANCE = 12


@dataclass
class GateResult:
    status: str = "PASS"
    buildings: list[dict[str, Any]] = field(default_factory=list)
    worst_building_id: str | None = None
    evidence_building_id: str | None = None
    screenshot: str | None = None
    workshop_screenshot: str | None = None
    bridge_requests: list[dict[str, Any]] = field(default_factory=list)
    console: list[dict[str, str]] = field(default_factory=list)
    ignored_driver_console: list[dict[str, str]] = field(default_factory=list)
    page_errors: list[str] = field(default_factory=list)
    failed_responses: list[dict[str, Any]] = field(default_factory=list)
    error: str | None = None
    traceback: str | None = None


def analyze_masks(page: Page) -> list[dict[str, Any]]:
    return page.evaluate(
        """async ({alphaThreshold, requiredDistance, groundContactBand, envelopeThickness, componentBottomTolerance}) => {
          const game = window.__SYKA_E2E_GAME__;
          const city = game.scene.getScene('city');
          const state = city.state;
          const terrainObjects = city.terrainObjects;

          const key = (x, y) => `${x},${y}`;
          const plainBounds = object => {
            const bounds = object.getBounds();
            return {
              x: Math.round(bounds.x),
              y: Math.round(bounds.y),
              width: Math.round(bounds.width),
              height: Math.round(bounds.height),
            };
          };

          function rasterize(object) {
            const bounds = plainBounds(object);
            const width = Math.max(1, bounds.width);
            const height = Math.max(1, bounds.height);
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext('2d', { willReadFrequently: true });
            context.imageSmoothingEnabled = false;
            const frame = object.frame;
            const source = object.texture.getSourceImage();
            const sourceX = frame.cutX ?? frame.x ?? 0;
            const sourceY = frame.cutY ?? frame.y ?? 0;
            const sourceWidth = frame.cutWidth ?? frame.width;
            const sourceHeight = frame.cutHeight ?? frame.height;
            context.save();
            if (object.flipX || object.flipY) {
              context.translate(object.flipX ? width : 0, object.flipY ? height : 0);
              context.scale(object.flipX ? -1 : 1, object.flipY ? -1 : 1);
            }
            context.drawImage(source, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
            context.restore();
            const data = context.getImageData(0, 0, width, height).data;
            const points = [];
            for (let y = 0; y < height; y += 1) {
              for (let x = 0; x < width; x += 1) {
                const alpha = data[(y * width + x) * 4 + 3];
                if (alpha >= alphaThreshold) points.push({ x: bounds.x + x, y: bounds.y + y });
              }
            }
            return { bounds, points };
          }

          const roadOwners = new Map();
          const grassPixels = new Set();
          for (let index = 0; index < state.map.tiles.length; index += 1) {
            const tile = state.map.tiles[index];
            const object = terrainObjects[index];
            if (!object || (tile.terrain !== 'road' && tile.terrain !== 'grass')) continue;
            const mask = rasterize(object);
            for (const point of mask.points) {
              const pixelKey = key(point.x, point.y);
              if (tile.terrain === 'grass') grassPixels.add(pixelKey);
              else {
                const owners = roadOwners.get(pixelKey) ?? [];
                owners.push(`${tile.position.x},${tile.position.y}`);
                roadOwners.set(pixelKey, owners);
              }
            }
          }

          function ringOffsets(radius) {
            if (radius === 0) return [[0, 0]];
            const offsets = [];
            for (let delta = -radius; delta <= radius; delta += 1) {
              offsets.push([delta, -radius], [delta, radius]);
              if (Math.abs(delta) !== radius) offsets.push([-radius, delta], [radius, delta]);
            }
            return offsets;
          }

          function shortestGrassPath(buildingPoint, roadPoint, distance) {
            const pixels = [];
            for (let step = 1; step < distance; step += 1) {
              const ratio = step / distance;
              const point = {
                x: Math.round(buildingPoint.x + (roadPoint.x - buildingPoint.x) * ratio),
                y: Math.round(buildingPoint.y + (roadPoint.y - buildingPoint.y) * ratio),
              };
              pixels.push({ ...point, grass: grassPixels.has(key(point.x, point.y)) });
            }
            return pixels;
          }

          function measureNearest(points) {
            let distance = null;
            const matches = [];
            for (let radius = 0; radius <= 24 && distance === null; radius += 1) {
              const offsets = ringOffsets(radius);
              for (const buildingPoint of points) {
                for (const [dx, dy] of offsets) {
                  const roadPoint = { x: buildingPoint.x + dx, y: buildingPoint.y + dy };
                  const owners = roadOwners.get(key(roadPoint.x, roadPoint.y));
                  if (!owners) continue;
                  distance = radius;
                  matches.push({ buildingPoint, roadPoint, owners });
                  if (matches.length >= 64) break;
                }
                if (matches.length >= 64) break;
              }
            }
            return { distance, matches };
          }

          const results = [];
          for (const building of state.buildings) {
            const sprite = city.buildingViews.get(building.id)?.sprite;
            if (!sprite) {
              results.push({ id: building.id, kind: building.kind, error: 'missing sprite', pass: false });
              continue;
            }
            const mask = rasterize(sprite);
            const groundCutoff = mask.bounds.y + mask.bounds.height - groundContactBand;
            // Connectivity is intentionally evaluated only inside the audited
            // low band. A hanging sign can be connected to the wall through a
            // bracket high above the ground, but its low-band island must not
            // become ground contact because of that elevated connection.
            const lowBandPoints = mask.points.filter(point => point.y >= groundCutoff);
            const opaqueByKey = new Map(lowBandPoints.map(point => [key(point.x, point.y), point]));
            const visited = new Set();
            const components = [];
            for (const seed of lowBandPoints) {
              const seedKey = key(seed.x, seed.y);
              if (visited.has(seedKey)) continue;
              const queue = [seed];
              const points = [];
              visited.add(seedKey);
              for (let cursor = 0; cursor < queue.length; cursor += 1) {
                const point = queue[cursor];
                points.push(point);
                for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
                  if (dx === 0 && dy === 0) continue;
                  const neighborKey = key(point.x + dx, point.y + dy);
                  if (visited.has(neighborKey)) continue;
                  const neighbor = opaqueByKey.get(neighborKey);
                  if (!neighbor) continue;
                  visited.add(neighborKey);
                  queue.push(neighbor);
                }
              }
              components.push({
                points,
                minY: Math.min(...points.map(point => point.y)),
                maxY: Math.max(...points.map(point => point.y)),
              });
            }
            const globalBottom = Math.max(...mask.points.map(point => point.y));
            const groundedComponents = components.filter(component => component.maxY >= globalBottom - componentBottomTolerance);
            const groundedPoints = groundedComponents.flatMap(component => component.points);
            const bottomByColumn = new Map();
            for (const point of groundedPoints) {
              bottomByColumn.set(point.x, Math.max(bottomByColumn.get(point.x) ?? -Infinity, point.y));
            }
            const contactPoints = groundedPoints.filter(point => {
              const bottom = bottomByColumn.get(point.x);
              return point.y >= groundCutoff && point.y >= bottom - (envelopeThickness - 1);
            });
            const unfilteredBottomByColumn = new Map();
            for (const point of lowBandPoints) {
              unfilteredBottomByColumn.set(point.x, Math.max(unfilteredBottomByColumn.get(point.x) ?? -Infinity, point.y));
            }
            const unfilteredContactPoints = lowBandPoints.filter(point =>
              point.y >= unfilteredBottomByColumn.get(point.x) - (envelopeThickness - 1)
            );
            const unfiltered = measureNearest(unfilteredContactPoints);
            const refined = measureNearest(contactPoints);
            const distance = refined.distance;
            const matches = refined.matches;
            const nearest = matches[0] ?? null;
            const segmentCounts = {};
            for (const match of matches) for (const owner of match.owners) {
              segmentCounts[owner] = (segmentCounts[owner] ?? 0) + 1;
            }
            const gapPath = nearest && distance !== null
              ? shortestGrassPath(nearest.buildingPoint, nearest.roadPoint, distance)
              : [];
            const grassGapVerified = distance !== null
              && distance >= requiredDistance
              && gapPath.length >= 1
              && gapPath.every(pixel => pixel.grass);
            results.push({
              id: building.id,
              kind: building.kind,
              spriteBounds: mask.bounds,
              opaqueBuildingPixels: mask.points.length,
              groundContactPixels: contactPoints.length,
              groundContactBand,
              envelopeThickness,
              componentBottomTolerance,
              alphaComponentCount: components.length,
              groundedComponentCount: groundedComponents.length,
              excludedComponents: components
                .filter(component => !groundedComponents.includes(component))
                .map(component => ({ pixelCount: component.points.length, minY: component.minY, maxY: component.maxY }))
                .sort((left, right) => right.pixelCount - left.pixelCount)
                .slice(0, 12),
              unfilteredContactPixels: unfilteredContactPoints.length,
              unfilteredMaskDistancePixels: unfiltered.distance,
              componentFilterChangedDistance: unfiltered.distance !== distance,
              maskDistancePixels: distance,
              visibleGapPixels: distance === null ? null : Math.max(0, distance - 1),
              overlap: distance === 0,
              touching: distance === 1,
              nearestRoadSegments: Object.entries(segmentCounts)
                .sort((left, right) => right[1] - left[1])
                .map(([tile, count]) => ({ tile, count })),
              nearestPair: nearest ? { building: nearest.buildingPoint, road: nearest.roadPoint } : null,
              grassGapPath: gapPath,
              grassGapVerified,
              pass: distance !== null && distance >= requiredDistance && grassGapVerified,
            });
          }
          return results;
        }""",
        {
            "alphaThreshold": ALPHA_THRESHOLD,
            "requiredDistance": REQUIRED_MASK_DISTANCE,
            "groundContactBand": GROUND_CONTACT_BAND,
            "envelopeThickness": GROUND_ENVELOPE_THICKNESS,
            "componentBottomTolerance": GROUND_COMPONENT_BOTTOM_TOLERANCE,
        },
    )


def capture_focus(page: Page, building: dict[str, Any]) -> str:
    state = page.evaluate("() => window.__SYKA_ALPHA_QA__.getSnapshot().game")
    instance = next(item for item in state["buildings"] if item["id"] == building["id"])
    xs = [tile["x"] for tile in instance["occupiedTiles"]]
    ys = [tile["y"] for tile in instance["occupiedTiles"]]
    center_x = round((min(xs) + max(xs)) / 2)
    center_y = round((min(ys) + max(ys)) / 2)
    require(qa_call(page, "focusGrid", center_x, center_y).get("ok") is True, "Could not focus failing building")
    require(qa_call(page, "setZoom", 2).get("ok") is True, "Could not zoom failing building")
    page.wait_for_timeout(350)
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    target = SCREENSHOT_DIR / f"road-clearance-{building['id']}.png"
    page.evaluate("() => { document.querySelector('#game-ui').style.visibility = 'hidden'; }")
    try:
        page.wait_for_timeout(150)
        box = page.locator("canvas").bounding_box()
        require(box is not None, "Canvas unavailable for clearance screenshot")
        target.write_bytes(page.screenshot(clip=box))
    finally:
        page.evaluate("() => { document.querySelector('#game-ui').style.visibility = ''; }")
    return str(target.relative_to(REPO_ROOT)).replace("\\", "/")


def render_markdown(payload: dict[str, Any]) -> str:
    lines = [
        "# Visual road clearance gate",
        "",
        f"**Resultado:** {payload['status']}",
        "",
        f"Máscara alfa mínima: {payload['alphaThreshold']}; distancia requerida: {payload['requiredMaskDistance']} px (un píxel completo de pasto entre edificio y carretera).",
        f"Contacto de suelo: envolvente inferior de {payload['groundEnvelopeThickness']} px dentro de la banda baja de {payload['groundContactBand']} px del sprite.",
        f"Componentes: sólo máscaras conectadas que llegan a {payload['groundComponentBottomTolerance']} px del fondo global del sprite.",
        "",
        "| Edificio | Sin filtro comp. | Refinado | Gap visible | Pasto probado | Segmentos cercanos | Resultado |",
        "|---|---:|---:|---:|:---:|---|:---:|",
    ]
    for building in payload["buildings"]:
        segments = ", ".join(segment["tile"] for segment in building.get("nearestRoadSegments", [])[:4]) or "—"
        lines.append(
            f"| {building['id']} | {building.get('unfilteredMaskDistancePixels', '—')} | {building.get('maskDistancePixels', '—')} | {building.get('visibleGapPixels', '—')} | "
            f"{'sí' if building.get('grassGapVerified') else 'no'} | {segments} | {'PASS' if building.get('pass') else 'FAIL'} |"
        )
    lines.extend([
        "",
        f"Captura enfocada: `{payload.get('screenshot') or 'no disponible'}`",
        f"Captura del taller: `{payload.get('workshop_screenshot') or 'no disponible'}`",
        "",
        "La medición usa los frames raster y escalas exactas cargadas por Phaser; no infiere separación desde `occupiedTiles`.",
        f"Consola accionable: {len(payload.get('console', []))}; ruido WebGL ReadPixels ignorado: {len(payload.get('ignored_driver_console', []))}.",
        "",
    ])
    if payload.get("error"):
        lines.extend(["## Falla", "", payload["error"], ""])
    return "\n".join(lines)


def main() -> int:
    started = time.time()
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    result = GateResult()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        bridge = ControlledBridge()
        audit = BrowserAudit("visual-road-clearance")
        try:
            instrument_document(context)
            context.route("**/bridge/api/world/**", bridge.handler)
            page = context.new_page()
            audit.attach(page)
            wait_ready(page, f"{BASE_URL}?qa=1")
            page.wait_for_function("() => Boolean(window.__SYKA_E2E_GAME__)")
            qa_call(page, "setPeriod", "day")
            page.wait_for_timeout(250)
            result.buildings = analyze_masks(page)
            ranked = sorted(
                result.buildings,
                key=lambda item: (item.get("maskDistancePixels") is None, item.get("maskDistancePixels") or 0, item["id"]),
            )
            worst = ranked[0]
            result.worst_building_id = worst["id"]
            evidence_building = next((building for building in result.buildings if building["id"] == "cafe-main"), worst)
            result.evidence_building_id = evidence_building["id"]
            result.screenshot = capture_focus(page, evidence_building)
            workshop = next((building for building in result.buildings if building["id"] == "workshop-crm"), worst)
            result.workshop_screenshot = capture_focus(page, workshop)
            failures = [building for building in result.buildings if not building.get("pass")]
            if failures:
                details = "; ".join(
                    f"{building['id']} distance={building.get('maskDistancePixels')} segments="
                    f"{','.join(segment['tile'] for segment in building.get('nearestRoadSegments', [])[:4])}"
                    for building in failures
                )
                raise AssertionError(f"Opaque building pixels lack a full grass gap: {details}")
            require(all(request["method"] == "GET" and not request["has_body"] for request in bridge.requests), "Bridge was not GET-only")
            actionable_messages, ignored_messages = actionable_console(audit.console)
            result.console = actionable_messages
            result.ignored_driver_console = ignored_messages
            require(not actionable_messages, f"Actionable console warnings/errors: {actionable_messages}")
            require(not audit.page_errors, f"Page errors: {audit.page_errors}")
            require(not audit.failed_responses, f"Failed HTTP responses: {audit.failed_responses}")
        except Exception as error:
            result.status = "FAIL"
            result.error = f"{type(error).__name__}: {error}"
            result.traceback = traceback.format_exc(limit=10)
        finally:
            result.bridge_requests = list(bridge.requests)
            result.console, result.ignored_driver_console = actionable_console(audit.console)
            result.page_errors = list(audit.page_errors)
            result.failed_responses = list(audit.failed_responses)
            bridge.close()
            context.close()
            browser.close()

    payload = {
        "schema": "syka.world.visual-road-clearance.v1",
        "status": result.status,
        "durationSeconds": round(time.time() - started, 3),
        "alphaThreshold": ALPHA_THRESHOLD,
        "requiredMaskDistance": REQUIRED_MASK_DISTANCE,
        "groundContactBand": GROUND_CONTACT_BAND,
        "groundEnvelopeThickness": GROUND_ENVELOPE_THICKNESS,
        "groundComponentBottomTolerance": GROUND_COMPONENT_BOTTOM_TOLERANCE,
        **result.__dict__,
    }
    REPORT_JSON.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    REPORT_MD.write_text(render_markdown(payload), encoding="utf-8")
    print(json.dumps({
        "status": result.status,
        "worstBuilding": result.worst_building_id,
        "error": result.error,
        "report": str(REPORT_JSON),
    }, indent=2, ensure_ascii=False))
    return 0 if result.status == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
