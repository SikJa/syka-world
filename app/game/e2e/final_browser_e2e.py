"""Final read-only browser verification for the current Syka World visual slice.

Run only through the webapp-testing skill's ``with_server.py`` helper. The
document instrumentation below is E2E-only: it captures the already-created
Phaser game so rendered bounds can be measured without adding a production QA
surface.
"""

from __future__ import annotations

import json
import re
import time
import traceback
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.request import urlopen

from playwright.sync_api import Browser, BrowserContext, Page, Route, sync_playwright

from alpha_v1_e2e import BASE_URL, BrowserAudit, ControlledBridge, qa_call, require, snapshot, wait_ready


REPO_ROOT = Path(__file__).resolve().parents[3]
GAME_ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = REPO_ROOT / "reports" / "e2e" / "final-browser"
SCREENSHOT_DIR = REPORT_DIR / "screenshots"
REPORT_JSON = REPORT_DIR / "final-browser-e2e-report.json"
REPORT_MD = REPORT_DIR / "FINAL_BROWSER_E2E_REPORT.md"
VIEWPORTS = ((1008, 548), (1440, 900))


class FinalVerificationError(AssertionError):
    pass


@dataclass
class ViewportResult:
    viewport: str
    status: str = "PASS"
    ready_seconds: float | None = None
    canvas: dict[str, Any] = field(default_factory=dict)
    syka: dict[str, Any] = field(default_factory=dict)
    buildings: list[dict[str, Any]] = field(default_factory=list)
    building_issues: list[str] = field(default_factory=list)
    framing: dict[str, Any] = field(default_factory=dict)
    interior: dict[str, Any] = field(default_factory=dict)
    performance: dict[str, Any] = field(default_factory=dict)
    requests: list[dict[str, Any]] = field(default_factory=list)
    console: list[dict[str, str]] = field(default_factory=list)
    ignored_driver_console: list[dict[str, str]] = field(default_factory=list)
    page_errors: list[str] = field(default_factory=list)
    failed_responses: list[dict[str, Any]] = field(default_factory=list)
    screenshots: list[str] = field(default_factory=list)
    error: str | None = None
    traceback: str | None = None


def instrument_document(context: BrowserContext) -> None:
    metadata = json.loads((GAME_ROOT / "node_modules" / ".vite" / "deps" / "_metadata.json").read_text(encoding="utf-8"))
    browser_hash = metadata["browserHash"]
    # Vite can invalidate its optimized dependency URL during server startup.
    # Read the exact URL currently emitted by the live transform, falling back
    # to metadata only when the server cannot provide it.
    try:
        with urlopen(f"{BASE_URL}src/presentation/createSykaGame.ts", timeout=5) as response:
            transformed = response.read().decode("utf-8")
        match = re.search(r"/node_modules/\.vite/deps/phaser\.js\?v=([a-zA-Z0-9_-]+)", transformed)
        if match:
            browser_hash = match.group(1)
    except OSError:
        pass

    def handler(route: Route) -> None:
        response = route.fetch()
        body = response.text()
        entrypoint = re.compile(
            r'<script\s+type="module"\s+src="/src/main\.ts(?:\?[^\"]*)?"></script>'
        )
        replacement = """<script type="module">
          import * as Phaser from '/node_modules/.vite/deps/phaser.js?v=__HASH__';
          const originalBoot = Phaser.Game.prototype.boot;
          Phaser.Game.prototype.boot = function (...args) {
            window.__SYKA_E2E_GAME__ = this;
            return originalBoot.apply(this, args);
          };
          await import('/src/main.ts');
        </script>""".replace("__HASH__", browser_hash)
        require(entrypoint.search(body) is not None, "Could not install E2E-only Phaser instrumentation")
        route.fulfill(response=response, body=entrypoint.sub(replacement, body, count=1))

    context.route(f"{BASE_URL}?qa=1", handler)


def canvas_metrics(page: Page, width: int, height: int) -> dict[str, Any]:
    metrics = page.locator("canvas").evaluate(
        """canvas => {
          const rect = canvas.getBoundingClientRect();
          return {
            logicalWidth: canvas.width,
            logicalHeight: canvas.height,
            css: { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
                   right: rect.right, bottom: rect.bottom },
            scaleX: rect.width / canvas.width,
            scaleY: rect.height / canvas.height,
            imageRendering: getComputedStyle(canvas).imageRendering,
          };
        }"""
    )
    expected_width = 828 if (width, height) == (1008, 548) else 720
    coverage = metrics["css"]["width"] * metrics["css"]["height"] / (width * height)
    scale_error = abs(metrics["scaleX"] - metrics["scaleY"])
    require(metrics["logicalWidth"] == expected_width, f"Unexpected logical width: {metrics['logicalWidth']}")
    require(metrics["logicalHeight"] == 450, f"Unexpected logical height: {metrics['logicalHeight']}")
    require(coverage >= 0.998, f"Canvas covers only {coverage:.4%} of the viewport")
    require(abs(metrics["css"]["x"]) <= 0.6 and abs(metrics["css"]["y"]) <= 0.6, "Canvas is not centered at the viewport origin")
    require(abs(metrics["css"]["right"] - width) <= 0.6, "Canvas does not reach the right viewport edge")
    require(abs(metrics["css"]["bottom"] - height) <= 0.6, "Canvas does not reach the bottom viewport edge")
    require(scale_error <= 0.001, f"Canvas is stretched (scale delta {scale_error:.6f})")
    require(metrics["imageRendering"] in {"pixelated", "crisp-edges"}, "Pixel rendering CSS is not active")
    metrics["viewportCoverage"] = round(coverage, 6)
    metrics["scaleError"] = round(scale_error, 6)
    return metrics


def select_syka_and_measure(page: Page) -> dict[str, Any]:
    page.wait_for_function(
        "() => window.__SYKA_ALPHA_QA__.getSnapshot().game.agents.find(a => a.id === 'syka')?.path.length >= 2",
        timeout=10_000,
    )
    page.locator('button[data-profile-id="default"]').click()
    page.wait_for_selector('.alpha-inspector-title:text-is("Syka")', timeout=5_000)
    page.wait_for_function("() => document.querySelector('.alpha-agent-detail__route')?.textContent?.includes('tramos hasta')")
    inspector = {
        "title": page.locator(".alpha-inspector-title").inner_text(),
        "phase": page.locator(".alpha-agent-detail__phase-label").inner_text(),
        "route": page.locator(".alpha-agent-detail__route").inner_text(),
        "summary": page.locator(".alpha-agent-detail__summary").inner_text(),
    }
    runtime = page.evaluate(
        """() => {
          const city = window.__SYKA_E2E_GAME__.scene.getScene('city');
          const syka = city.state.agents.find(agent => agent.id === 'syka');
          const graphics = city.agentPathGraphics;
          return {
            selectedAgentId: city.selectedAgentId,
            path: syka.path,
            destinationBuildingId: syka.destinationBuildingId,
            commandBufferLength: graphics?.commandBuffer?.length ?? 0,
            graphicsVisible: graphics?.visible === true,
            graphicsAlpha: graphics?.alpha ?? 0,
            renderFlags: graphics?.renderFlags ?? 0,
          };
        }"""
    )
    require(inspector["title"] == "Syka", "Syka inspector did not open")
    require(runtime["selectedAgentId"] == "syka", "City scene did not focus Syka")
    require(len(runtime["path"]) >= 2, "Syka has no visible route")
    require(runtime["destinationBuildingId"], "Syka route has no destination")
    require(runtime["graphicsVisible"] and runtime["graphicsAlpha"] > 0, "Syka route graphics are hidden")
    require(runtime["commandBufferLength"] > 0 and runtime["renderFlags"] != 0, "Syka route has no rendered geometry")
    return {"inspector": inspector, "renderedPath": runtime}


def measure_buildings(page: Page) -> list[dict[str, Any]]:
    buildings = page.evaluate(
        """async () => {
          const city = window.__SYKA_E2E_GAME__.scene.getScene('city');
          const camera = city.cameras.main;
          const { resolveBuildingVisual, resolveBuildingSpriteOffset } = await import('/src/presentation/city/assets.ts');
          const { buildingBasePoint, projectFootprint } = await import('/src/presentation/city/projection.ts');
          const tileByKey = new Map(city.state.map.tiles.map(tile => [`${tile.position.x},${tile.position.y}`, tile]));

          function plainRect(rect) {
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
                     right: rect.x + rect.width, bottom: rect.y + rect.height };
          }
          function insideConvex(point, polygon) {
            let positive = false;
            let negative = false;
            for (let index = 0; index < polygon.length; index += 1) {
              const left = polygon[index];
              const right = polygon[(index + 1) % polygon.length];
              const cross = (right.x - left.x) * (point.y - left.y) - (right.y - left.y) * (point.x - left.x);
              if (cross > 0.01) positive = true;
              if (cross < -0.01) negative = true;
            }
            return !(positive && negative);
          }

          return city.state.buildings.map(building => {
            const view = city.buildingViews.get(building.id);
            const xs = building.occupiedTiles.map(tile => tile.x);
            const ys = building.occupiedTiles.map(tile => tile.y);
            const minX = Math.min(...xs), maxX = Math.max(...xs);
            const minY = Math.min(...ys), maxY = Math.max(...ys);
            const footprint = { width: maxX - minX + 1, height: maxY - minY + 1 };
            const visual = resolveBuildingVisual(building.kind, city.alphaBuildingsAvailable);
            const expectedOffset = resolveBuildingSpriteOffset(visual, footprint);
            const base = buildingBasePoint({ x: minX, y: minY }, footprint);
            const diamond = projectFootprint({ x: minX, y: minY }, footprint.width, footprint.height);
            const occupied = new Set(building.occupiedTiles.map(tile => `${tile.x},${tile.y}`));
            const roadOverlaps = building.occupiedTiles.filter(tile => tileByKey.get(`${tile.x},${tile.y}`)?.terrain === 'road');
            const missingTiles = [];
            for (let y = minY; y <= maxY; y += 1) for (let x = minX; x <= maxX; x += 1) {
              if (!occupied.has(`${x},${y}`)) missingTiles.push({ x, y });
            }
            const access = tileByKey.get(`${building.accessTile.x},${building.accessTile.y}`);
            const sprite = view?.sprite;
            const bounds = sprite ? plainRect(sprite.getBounds()) : null;
            const screenBounds = bounds ? {
              x: (bounds.x - camera.worldView.x) * camera.zoom + camera.x,
              y: (bounds.y - camera.worldView.y) * camera.zoom + camera.y,
              width: bounds.width * camera.zoom,
              height: bounds.height * camera.zoom,
            } : null;
            const visibleWidth = screenBounds ? Math.max(0, Math.min(screenBounds.x + screenBounds.width, camera.x + camera.width) - Math.max(screenBounds.x, camera.x)) : 0;
            const visibleHeight = screenBounds ? Math.max(0, Math.min(screenBounds.y + screenBounds.height, camera.y + camera.height) - Math.max(screenBounds.y, camera.y)) : 0;
            const actualOffset = sprite ? [sprite.x - base.x, sprite.y - base.y] : [null, null];
            return {
              id: building.id,
              kind: building.kind,
              status: building.status,
              footprint,
              occupiedTileCount: building.occupiedTiles.length,
              calibrationFootprint: visual.contactFootprint,
              roadOverlapCount: roadOverlaps.length,
              missingTileCount: missingTiles.length,
              accessTileIsRoad: access?.terrain === 'road',
              spriteBounds: bounds,
              logicalScreenBounds: screenBounds,
              defaultViewportVisibleRatio: screenBounds ? visibleWidth * visibleHeight / (screenBounds.width * screenBounds.height) : 0,
              spriteAnchor: sprite ? { x: sprite.x, y: sprite.y } : null,
              expectedOffset,
              actualOffset,
              offsetError: sprite ? Math.hypot(actualOffset[0] - expectedOffset[0], actualOffset[1] - expectedOffset[1]) : null,
              bottomPivotError: sprite && bounds ? Math.abs(bounds.bottom - sprite.y) : null,
              anchorInsideFootprint: sprite ? insideConvex({ x: sprite.x, y: sprite.y }, diamond) : false,
              footprintDiamond: diamond,
            };
          });
        }"""
    )
    require(len(buildings) >= 9, f"Expected the showcase buildings, got {len(buildings)}")
    for building in buildings:
        require(building["spriteBounds"] is not None, f"{building['id']} has no rendered sprite")
        require(building["missingTileCount"] == 0, f"{building['id']} footprint is not a solid rectangle")
        require(building["accessTileIsRoad"], f"{building['id']} is not attached to a road")
        require(building["calibrationFootprint"] == [building["footprint"]["width"], building["footprint"]["height"]], f"{building['id']} calibration differs from its reserved footprint")
        require(building["offsetError"] <= 0.1, f"{building['id']} rendered anchor differs from calibration")
        require(building["bottomPivotError"] <= 0.1, f"{building['id']} does not use its audited bottom pivot")
        require(building["anchorInsideFootprint"], f"{building['id']} ground anchor leaves its footprint")
    return buildings


def enter_cafe(page: Page) -> None:
    state = snapshot(page)
    cafe = next(building for building in state["game"]["buildings"] if building["kind"] == "cafe" and building["status"] == "complete")
    result = qa_call(page, "selectBuilding", cafe["id"])
    require(result.get("ok") is True, "Could not select the completed cafe")
    page.get_by_role("button", name="Entrar al Café Biblioteca").click()
    page.wait_for_function("() => Boolean(window.__SYKA_INTERIOR__)", timeout=10_000)
    page.wait_for_function("() => window.__SYKA_ALPHA_QA__.metrics().activeScenes.includes('cafe-interior')", timeout=10_000)


def interior_geometry(page: Page) -> dict[str, Any]:
    geometry = page.evaluate(
        """async () => {
          const scene = window.__SYKA_E2E_GAME__.scene.getScene('cafe-interior');
          const { CAFE_HOTSPOTS } = await import('/src/presentation/interior/interiorModel.ts');
          const room = scene.roomBounds;
          const canvas = document.querySelector('canvas');
          const children = scene.hotspotLayer.list;
          const hotspots = CAFE_HOTSPOTS.map((hotspot, index) => {
            const zone = children[index * 2];
            const cue = children[index * 2 + 1];
            const cueBounds = cue.getBounds();
            const sampleFractions = {
              library: [0.5, 0.5], fireplace: [0.5, 0.15], counter: [0.5, 0.4], tables: [0.5, 0.65],
            };
            const sample = sampleFractions[hotspot.id];
            return {
              id: hotspot.id,
              label: hotspot.label,
              description: hotspot.description,
              zone: { x: zone.x, y: zone.y, width: zone.width, height: zone.height },
              sample: { x: zone.x + zone.width * sample[0], y: zone.y + zone.height * sample[1] },
              interactive: Boolean(zone.input?.enabled),
              cueAlpha: cue.alpha,
              cueBounds: { x: cueBounds.x, y: cueBounds.y, width: cueBounds.width, height: cueBounds.height },
              zoneAreaRatio: zone.width * zone.height / (room.width * room.height),
              cueAreaRatio: cueBounds.width * cueBounds.height / (room.width * room.height),
              insideRoom: zone.x >= room.x && zone.y >= room.y && zone.x + zone.width <= room.right + 0.01 && zone.y + zone.height <= room.bottom + 0.01,
            };
          });
          const roomBounds = scene.room.getBounds();
          const giantDomOverlays = [...document.querySelectorAll('#game-ui *')].flatMap(element => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            const areaRatio = rect.width * rect.height / (innerWidth * innerHeight);
            return style.visibility !== 'hidden' && style.display !== 'none' && style.pointerEvents !== 'none' && areaRatio > 0.5
              ? [{ tag: element.tagName, className: element.className, areaRatio }]
              : [];
          });
          return {
            logicalViewport: { width: scene.viewportWidth, height: scene.viewportHeight },
            canvasLogical: { width: canvas.width, height: canvas.height },
            room: { x: room.x, y: room.y, width: room.width, height: room.height, right: room.right, bottom: room.bottom },
            roomSprite: { x: roomBounds.x, y: roomBounds.y, width: roomBounds.width, height: roomBounds.height },
            roomCenteredXError: Math.abs(room.centerX - scene.viewportWidth / 2),
            roomInsideViewport: room.x >= 0 && room.y >= 0 && room.right <= scene.viewportWidth && room.bottom <= scene.viewportHeight,
            hotspots,
            giantDomOverlays,
          };
        }"""
    )
    require(geometry["logicalViewport"] == geometry["canvasLogical"], "Interior logical viewport differs from the canvas")
    require(geometry["roomInsideViewport"], "Interior room leaves the logical viewport")
    require(geometry["roomCenteredXError"] <= 1, "Interior room is not horizontally centered")
    room, sprite = geometry["room"], geometry["roomSprite"]
    for key in ("x", "y", "width", "height"):
        require(abs(room[key] - sprite[key]) <= 0.1, f"Interior room sprite differs from roomBounds at {key}")
    require(len(geometry["hotspots"]) == 4, "Expected four cafe hotspots")
    require(not geometry["giantDomOverlays"], f"Large pointer overlay found: {geometry['giantDomOverlays']}")
    for hotspot in geometry["hotspots"]:
        require(hotspot["interactive"], f"{hotspot['id']} is not interactive")
        require(hotspot["insideRoom"], f"{hotspot['id']} leaves the room")
        require(hotspot["zoneAreaRatio"] <= 0.30, f"{hotspot['id']} hotspot is a giant rectangle")
        require(hotspot["cueAreaRatio"] <= 0.02, f"{hotspot['id']} hover cue is a giant overlay")
        require(hotspot["cueAlpha"] == 0, f"{hotspot['id']} cue is visible before hover")
    return geometry


def exercise_hotspots(page: Page, geometry: dict[str, Any]) -> list[dict[str, Any]]:
    canvas = page.locator("canvas").bounding_box()
    require(canvas is not None, "Canvas disappeared inside the cafe")
    logical = geometry["canvasLogical"]
    scale_x = canvas["width"] / logical["width"]
    scale_y = canvas["height"] / logical["height"]
    evidence: list[dict[str, Any]] = []
    for index, hotspot in enumerate(geometry["hotspots"]):
        page.mouse.move(canvas["x"] + 5, canvas["y"] + canvas["height"] - 5)
        page.wait_for_timeout(40)
        sample = hotspot["sample"]
        screen_x = canvas["x"] + sample["x"] * scale_x
        screen_y = canvas["y"] + sample["y"] * scale_y
        page.mouse.move(screen_x, screen_y)
        page.wait_for_timeout(80)
        cue_state = page.evaluate(
            """index => {
              const scene = window.__SYKA_E2E_GAME__.scene.getScene('cafe-interior');
              const cues = scene.hotspotLayer.list.filter(child => child.constructor.name === 'Container');
              return { active: cues[index].alpha, visibleCount: cues.filter(cue => cue.alpha > 0).length };
            }""",
            index,
        )
        require(cue_state["active"] == 1, f"Hover cue did not activate for {hotspot['id']}")
        require(cue_state["visibleCount"] == 1, f"Hover activated multiple overlays for {hotspot['id']}")
        page.mouse.click(screen_x, screen_y)
        page.wait_for_function(
            "label => document.querySelector('.alpha-inspector-title')?.textContent?.includes(label)",
            arg=hotspot["label"],
            timeout=3_000,
        )
        feedback = page.locator(".alpha-inspector").inner_text()
        require(hotspot["description"] in feedback, f"Click feedback for {hotspot['id']} lost its description")
        evidence.append({"id": hotspot["id"], "sampleScreen": {"x": round(screen_x, 2), "y": round(screen_y, 2)}, "cue": cue_state, "inspector": feedback})
    return evidence


def save_screenshot(page: Page, name: str) -> str:
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    target = SCREENSHOT_DIR / name
    target.write_bytes(page.screenshot(full_page=True))
    return str(target.relative_to(REPO_ROOT)).replace("\\", "/")


def actionable_console(messages: list[dict[str, str]]) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    ignored = [
        message for message in messages
        if "GL Driver Message" in message["text"] and "GPU stall due to ReadPixels" in message["text"]
    ]
    actionable = [message for message in messages if message not in ignored]
    return actionable, ignored


def run_viewport(browser: Browser, width: int, height: int) -> ViewportResult:
    label = f"{width}x{height}"
    result = ViewportResult(viewport=label)
    context = browser.new_context(viewport={"width": width, "height": height})
    bridge = ControlledBridge()
    audit = BrowserAudit(label)
    try:
        instrument_document(context)
        context.route("**/bridge/api/world/**", bridge.handler)
        page = context.new_page()
        audit.attach(page)
        result.ready_seconds = wait_ready(page, f"{BASE_URL}?qa=1")
        page.wait_for_function("() => Boolean(window.__SYKA_E2E_GAME__)")
        result.canvas = canvas_metrics(page, width, height)
        initial_camera = snapshot(page)["game"]["camera"]["center"]
        initial_buildings = measure_buildings(page)
        result.syka = select_syka_and_measure(page)
        result.buildings = measure_buildings(page)
        selected_camera = snapshot(page)["game"]["camera"]["center"]
        result.framing = {
            "initialCameraCenter": initial_camera,
            "selectedCameraCenter": selected_camera,
            "cameraCenterUnchanged": initial_camera == selected_camera,
            "initialMinimumVisibleRatio": min(building["defaultViewportVisibleRatio"] for building in initial_buildings),
            "selectedMinimumVisibleRatio": min(building["defaultViewportVisibleRatio"] for building in result.buildings),
        }
        require(result.framing["cameraCenterUnchanged"], "Selecting visible Syka unexpectedly changed showcase framing")
        result.building_issues = [
            f"{building['id']} footprint overlaps {building['roadOverlapCount']} road tile(s)"
            for building in result.buildings
            if building["roadOverlapCount"] > 0
        ]
        if (width, height) == (1440, 900):
            result.building_issues.extend(
                f"{phase} {building['id']} is only {building['defaultViewportVisibleRatio']:.2%} visible in showcase framing"
                for phase, collection in (("initial", initial_buildings), ("after Syka selection", result.buildings))
                for building in collection
                if building["defaultViewportVisibleRatio"] < 0.995
            )
        result.screenshots.append(save_screenshot(page, f"city-syka-path-{label}.png"))
        city_metrics = page.evaluate("() => window.__SYKA_ALPHA_QA__.metrics()")

        enter_cafe(page)
        page.wait_for_timeout(300)
        geometry = interior_geometry(page)
        interactions = exercise_hotspots(page, geometry)
        result.interior = {**geometry, "interactions": interactions}
        result.screenshots.append(save_screenshot(page, f"cafe-interior-hotspot-{label}.png"))
        interior_metrics = page.evaluate("() => window.__SYKA_ALPHA_QA__.metrics()")
        result.performance = {"city": city_metrics, "interior": interior_metrics}
        require(city_metrics["actualFps"] >= 45, f"City FPS too low: {city_metrics['actualFps']}")
        require(interior_metrics["actualFps"] >= 45, f"Interior FPS too low: {interior_metrics['actualFps']}")

        result.requests = list(bridge.requests)
        require(len(result.requests) >= 2, "Bridge state/events GETs were not observed")
        require(all(request["method"] == "GET" for request in result.requests), "A non-GET bridge request was observed")
        require(all(not request["has_body"] for request in result.requests), "A bridge GET unexpectedly carried a body")
        require(all("/commands" not in request["url"] and "/tasks" not in request["url"] for request in result.requests), "A command/task bridge endpoint was called")
        actionable_messages, ignored_messages = actionable_console(audit.console)
        result.console = actionable_messages
        result.ignored_driver_console = ignored_messages
        require(not actionable_messages, f"Browser console warnings/errors: {actionable_messages}")
        require(not audit.page_errors, f"Browser page errors: {audit.page_errors}")
        require(not audit.failed_responses, f"Failed HTTP responses: {audit.failed_responses}")
        require(not result.building_issues, "; ".join(result.building_issues))
    except Exception as error:
        result.status = "FAIL"
        result.error = f"{type(error).__name__}: {error}"
        result.traceback = traceback.format_exc(limit=10)
        try:
            pages = context.pages
            if pages:
                result.screenshots.append(save_screenshot(pages[-1], f"failure-{label}.png"))
        except Exception:
            pass
    finally:
        result.requests = result.requests or list(bridge.requests)
        result.console, result.ignored_driver_console = actionable_console(audit.console)
        result.page_errors = list(audit.page_errors)
        result.failed_responses = list(audit.failed_responses)
        bridge.close()
        context.close()
    return result


def render_markdown(payload: dict[str, Any]) -> str:
    lines = [
        "# Syka World — verificación final de navegador",
        "",
        f"**Resultado:** {payload['overall']}",
        "",
        "Método: Chromium headless, Python Playwright, bridge controlado GET-only y servidor temporal gestionado por `with_server.py`.",
        "",
    ]
    for item in payload["viewports"]:
        lines.extend([
            f"## {item['viewport']} — {item['status']}",
            "",
            f"- Canvas: {item.get('canvas', {}).get('logicalWidth', 'n/a')}×{item.get('canvas', {}).get('logicalHeight', 'n/a')} lógico; cobertura {item.get('canvas', {}).get('viewportCoverage', 'n/a')}; error de escala {item.get('canvas', {}).get('scaleError', 'n/a')}.",
            f"- Syka: {len(item.get('syka', {}).get('renderedPath', {}).get('path', []))} nodos de ruta; {item.get('syka', {}).get('renderedPath', {}).get('commandBufferLength', 0)} comandos gráficos.",
            f"- Framing Muestra: cámara estable al seleccionar Syka = {item.get('framing', {}).get('cameraCenterUnchanged', False)}; visibilidad mínima de edificio = {item.get('framing', {}).get('selectedMinimumVisibleRatio', 'n/a')}.",
            f"- Edificios: {len(item.get('buildings', []))} sprites medidos contra sus huellas; solapamientos lógicos con carretera = {sum(building.get('roadOverlapCount', 0) for building in item.get('buildings', []))}.",
            f"- Interior: {len(item.get('interior', {}).get('hotspots', []))} hotspots medidos y {len(item.get('interior', {}).get('interactions', []))} hover/click físicos.",
            f"- Bridge: {len(item.get('requests', []))} requests observadas, sólo GET = {all(request.get('method') == 'GET' for request in item.get('requests', []))}.",
            f"- Consola: {len(item.get('console', []))} warnings/errors; page errors: {len(item.get('page_errors', []))}; respuestas HTTP fallidas: {len(item.get('failed_responses', []))}.",
            f"- Ruido del driver ignorado: {len(item.get('ignored_driver_console', []))} warnings WebGL ReadPixels provocadas por capturas.",
        ])
        if item.get("performance"):
            lines.append(f"- Rendimiento: ciudad {item['performance']['city']['actualFps']} FPS; interior {item['performance']['interior']['actualFps']} FPS.")
        if item.get("error"):
            lines.append(f"- Error: `{item['error']}`")
        if item.get("screenshots"):
            lines.append(f"- Evidencias: {', '.join(item['screenshots'])}")
        lines.append("")
    lines.extend([
        "## Criterios aplicados",
        "",
        "- El canvas debe cubrir el viewport y mantener el mismo factor de escala horizontal y vertical.",
        "- La selección de Syka debe abrir inspector, mostrar destino/tramos y producir geometría real de trayectoria.",
        "- Cada sprite debe respetar offset/pivote calibrado, huella sólida y acceso de carretera sin reservar tiles de carretera.",
        "- El Café debe adaptarse al viewport; sus hotspots deben quedar dentro de la habitación, responder a hover/click y no crear cues u overlays gigantes.",
        "- El bridge queda estrictamente pasivo: sólo lecturas GET sin body ni endpoints de comandos/tareas.",
        "",
    ])
    return "\n".join(lines)


def main() -> int:
    started = time.time()
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        results = [run_viewport(browser, width, height) for width, height in VIEWPORTS]
        browser.close()
    payload = {
        "schema": "syka.world.final-browser-e2e.v1",
        "overall": "PASS" if all(result.status == "PASS" for result in results) else "FAIL",
        "durationSeconds": round(time.time() - started, 3),
        "viewports": [result.__dict__ for result in results],
    }
    REPORT_JSON.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    REPORT_MD.write_text(render_markdown(payload), encoding="utf-8")
    print(json.dumps({
        "overall": payload["overall"],
        "durationSeconds": payload["durationSeconds"],
        "viewports": [{"viewport": result.viewport, "status": result.status, "error": result.error} for result in results],
        "report": str(REPORT_JSON),
    }, indent=2, ensure_ascii=False))
    return 0 if payload["overall"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
