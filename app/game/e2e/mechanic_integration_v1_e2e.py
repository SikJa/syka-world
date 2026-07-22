"""Physical browser E2E for Syka World's Mechanic Integration Pass v1.

Run this file through ``webapp-testing/scripts/with_server.py``.  The runner
uses the QA surface only to control time and grant local test currency.  Every
gameplay placement (Café and Exterior objects) is performed with a real click
on a visible UI card followed by a real pointer click on the Phaser canvas.
"""

from __future__ import annotations

import json
import os
import re
import time
import traceback
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Callable
from urllib.parse import parse_qs, urlparse
from urllib.request import urlopen

from playwright.sync_api import (
    Browser,
    BrowserContext,
    Page,
    Request,
    Route,
    TimeoutError as PlaywrightTimeoutError,
    sync_playwright,
)


BASE_URL = os.environ.get("SYKA_E2E_BASE_URL", "http://127.0.0.1:5187/")
if not BASE_URL.endswith("/"):
    BASE_URL += "/"

REPO_ROOT = Path(__file__).resolve().parents[3]
GAME_ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = REPO_ROOT / "reports" / "e2e" / "mechanic-integration-v1"
SCREENSHOT_DIR = REPORT_DIR / "screenshots"
REPORT_JSON = REPORT_DIR / "mechanic-integration-e2e.json"
REPORT_MD = REPORT_DIR / "MECHANIC_INTEGRATION_E2E.md"
PRIMARY_VIEWPORT = (1440, 900)
RESPONSIVE_VIEWPORTS = ((1008, 548), (2560, 1080))


class VerificationError(AssertionError):
    """A product requirement failed during the physical browser journey."""


def require(condition: bool, message: str) -> None:
    if not condition:
        raise VerificationError(message)


@dataclass
class BrowserAudit:
    label: str
    console: list[dict[str, str]] = field(default_factory=list)
    page_errors: list[str] = field(default_factory=list)
    bridge_requests: list[dict[str, Any]] = field(default_factory=list)
    failed_responses: list[dict[str, Any]] = field(default_factory=list)

    def attach(self, page: Page) -> None:
        page.on("console", self._console)
        page.on("pageerror", lambda error: self.page_errors.append(str(error)))
        page.on("request", self._request)
        page.on("response", self._response)

    def _console(self, message: Any) -> None:
        if message.type in {"warning", "error"}:
            self.console.append({"type": message.type, "text": message.text})

    def _request(self, request: Request) -> None:
        if "/bridge/" not in request.url:
            return
        self.bridge_requests.append(
            {
                "method": request.method,
                "url": request.url,
                "hasBody": request.post_data is not None,
            }
        )

    def _response(self, response: Any) -> None:
        if response.status >= 400:
            self.failed_responses.append(
                {
                    "status": response.status,
                    "method": response.request.method,
                    "url": response.url,
                }
            )

    def actionable_console(self) -> list[dict[str, str]]:
        return [
            item
            for item in self.console
            if not (
                "GL Driver Message" in item["text"]
                and "GPU stall due to ReadPixels" in item["text"]
            )
        ]

    def assert_clean(self) -> None:
        require(not self.actionable_console(), f"Console warnings/errors: {self.actionable_console()}")
        require(not self.page_errors, f"Page errors: {self.page_errors}")
        require(not self.failed_responses, f"Failed HTTP responses: {self.failed_responses}")
        require(len(self.bridge_requests) >= 2, "Bridge state/events reads were not observed")
        require(
            all(item["method"] == "GET" and not item["hasBody"] for item in self.bridge_requests),
            f"Bridge was not GET-only: {self.bridge_requests}",
        )
        require(
            all("/commands" not in item["url"] and "/tasks" not in item["url"] for item in self.bridge_requests),
            "A command/task bridge endpoint was requested",
        )


class ControlledBridge:
    """Same-origin bridge fixture that rejects every non-GET request."""

    def __init__(self) -> None:
        self.requests: list[dict[str, Any]] = []
        self.pending_route: Route | None = None

    def handler(self, route: Route, request: Request) -> None:
        self.requests.append(
            {"method": request.method, "url": request.url, "hasBody": request.post_data is not None}
        )
        if request.method != "GET":
            route.fulfill(status=405, content_type="application/json", body='{"error":"GET only"}')
            return
        parsed = urlparse(request.url)
        if parsed.path.endswith("/api/world/state"):
            route.fulfill(status=200, content_type="application/json", body=json.dumps(self.state_payload()))
            return
        if parsed.path.endswith("/api/world/events"):
            query = parse_qs(parsed.query)
            if query.get("wait") == ["0"]:
                route.fulfill(
                    status=200,
                    content_type="application/json",
                    body='{"schema":"syka.world.events.v1","events":[]}',
                )
                return
            if self.pending_route is not None:
                stale, self.pending_route = self.pending_route, None
                stale.fulfill(
                    status=200,
                    content_type="application/json",
                    body='{"schema":"syka.world.events.v1","events":[]}',
                )
            self.pending_route = route
            return
        route.fulfill(status=404, content_type="application/json", body='{"error":"unknown route"}')

    def close(self) -> None:
        if self.pending_route is None:
            return
        route, self.pending_route = self.pending_route, None
        try:
            route.abort("aborted")
        except Exception:
            pass

    @staticmethod
    def state_payload() -> dict[str, Any]:
        characters = []
        names = {"default": "Syka", "elen": "Elen", "astrelis": "Astrelis", "zerny": "Zerny"}
        for profile_id, display_name in names.items():
            characters.append(
                {
                    "profile_id": profile_id,
                    "character_id": profile_id,
                    "display_name": display_name,
                    "home": f"{profile_id}-home",
                    "workplace": f"{profile_id}-workplace",
                    "status": "idle",
                    "activity": "roaming",
                    "destination": "town",
                    "animation": "walk",
                    "task_summary": None,
                    "presence": "online",
                    "active_session_count": 0,
                    "dominant_session_id": None,
                    "last_event_id": None,
                    "updated_at": "2026-07-16T12:00:00Z",
                }
            )
        return {
            "schema": "syka.world.state.v1",
            "generated_at": "2026-07-16T12:00:00Z",
            "characters": characters,
        }


@dataclass
class JourneyResult:
    status: str = "PASS"
    durationSeconds: float = 0
    readySeconds: float | None = None
    flows: list[dict[str, Any]] = field(default_factory=list)
    screenshots: list[str] = field(default_factory=list)
    physicalPlacements: list[dict[str, Any]] = field(default_factory=list)
    bridgeRequests: list[dict[str, Any]] = field(default_factory=list)
    console: list[dict[str, str]] = field(default_factory=list)
    pageErrors: list[str] = field(default_factory=list)
    failedResponses: list[dict[str, Any]] = field(default_factory=list)
    error: str | None = None
    traceback: str | None = None


@dataclass
class ResponsiveResult:
    viewport: str
    status: str = "PASS"
    canvas: dict[str, Any] = field(default_factory=dict)
    mode: str | None = None
    buildings: int = 0
    agents: int = 0
    screenshots: list[str] = field(default_factory=list)
    bridgeRequests: list[dict[str, Any]] = field(default_factory=list)
    console: list[dict[str, str]] = field(default_factory=list)
    pageErrors: list[str] = field(default_factory=list)
    failedResponses: list[dict[str, Any]] = field(default_factory=list)
    error: str | None = None
    traceback: str | None = None


def report_flow(result: JourneyResult, flow_id: str, title: str, action: Callable[[], dict[str, Any]]) -> dict[str, Any]:
    started = time.perf_counter()
    details = action()
    entry = {
        "id": flow_id,
        "title": title,
        "status": "PASS",
        "durationSeconds": round(time.perf_counter() - started, 3),
        "details": details,
    }
    result.flows.append(entry)
    return details


def screenshot(page: Page, result: JourneyResult | ResponsiveResult, name: str) -> str:
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    target = SCREENSHOT_DIR / name
    # Chromium/WebGL occasionally returns a frame with large zero-filled
    # polygons on this Windows GPU.  Capture several composited frames and
    # retain the least compressible one; a zero-filled artifact is always
    # materially smaller than a complete pixel-art frame of the same state.
    candidates: list[bytes] = []
    for _ in range(5):
        page.evaluate(
            "() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))"
        )
        page.wait_for_timeout(100)
        candidates.append(page.screenshot(full_page=True))
    target.write_bytes(max(candidates, key=len))
    relative = str(target.relative_to(REPO_ROOT)).replace("\\", "/")
    result.screenshots.append(relative)
    return relative


def element_screenshot(page: Page, selector: str, result: JourneyResult | ResponsiveResult, name: str) -> str:
    """Capture a DOM panel without forcing a WebGL canvas readback beneath it."""

    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    target = SCREENSHOT_DIR / name
    locator = page.locator(selector)
    require(locator.count() == 1 and locator.is_visible(), f"Evidence element is not visible: {selector}")
    target.write_bytes(locator.screenshot())
    relative = str(target.relative_to(REPO_ROOT)).replace("\\", "/")
    result.screenshots.append(relative)
    return relative


def instrument_document(context: BrowserContext, document_url: str) -> None:
    """Expose the Phaser game read-only without adding a production QA API."""

    with urlopen(f"{BASE_URL}src/presentation/createSykaGame.ts", timeout=10) as response:
        transformed = response.read().decode("utf-8")
    match = re.search(r"(/node_modules/\.vite/deps/phaser\.js\?v=[a-zA-Z0-9_-]+)", transformed)
    require(match is not None, "Could not discover the live Vite Phaser module URL")
    phaser_url = match.group(1)

    def handler(route: Route) -> None:
        if route.request.resource_type != "document":
            route.continue_()
            return
        response = route.fetch()
        body = response.text()
        script_pattern = re.compile(
            r'<script\s+type=["\']module["\']\s+src=["\']/src/main\.ts(?:\?[^"\']*)?["\']\s*>\s*</script>'
        )
        replacement = f"""<script type=\"module\">
          import * as Phaser from '{phaser_url}';
          const originalBoot = Phaser.Game.prototype.boot;
          Phaser.Game.prototype.boot = function (...args) {{
            window.__SYKA_E2E_GAME__ = this;
            return originalBoot.apply(this, args);
          }};
          await import('/src/main.ts');
        </script>"""
        require(script_pattern.search(body) is not None, f"Could not install E2E-only Phaser instrumentation for {route.request.url}")
        route.fulfill(response=response, body=script_pattern.sub(replacement, body, count=1))

    context.route(re.compile(f"^{re.escape(document_url)}$"), handler)


def prepare_context(browser: Browser, width: int, height: int, document_url: str) -> tuple[BrowserContext, ControlledBridge]:
    context = browser.new_context(viewport={"width": width, "height": height})
    # Clear only on the first document of this tab. Reload must retain the save.
    context.add_init_script(
        """(() => {
          if (!sessionStorage.getItem('__syka_mechanics_e2e_initialized')) {
            localStorage.clear();
            sessionStorage.setItem('__syka_mechanics_e2e_initialized', '1');
          }
        })();"""
    )
    instrument_document(context, document_url)
    bridge = ControlledBridge()
    context.route("**/bridge/api/world/**", bridge.handler)
    return context, bridge


def wait_ready(page: Page, url: str) -> float:
    started = time.perf_counter()
    page.goto(url, wait_until="domcontentloaded", timeout=60_000)
    # The bridge has a legitimate long poll. Try networkidle, then use product signals.
    try:
        page.wait_for_load_state("networkidle", timeout=2_000)
    except PlaywrightTimeoutError:
        pass
    page.wait_for_selector(".syka-alpha-ui", state="visible", timeout=30_000)
    page.wait_for_selector("#loading-card.is-hidden", timeout=30_000)
    page.wait_for_function("() => Boolean(window.__SYKA_ALPHA_QA__ && window.__SYKA_E2E_GAME__)", timeout=30_000)
    page.wait_for_timeout(350)
    return round(time.perf_counter() - started, 3)


def snapshot(page: Page) -> dict[str, Any]:
    value = page.evaluate("() => window.__SYKA_ALPHA_QA__.getSnapshot()")
    require(isinstance(value, dict), "QA snapshot is unavailable")
    return value


def qa_time(page: Page, method: str, *args: Any) -> dict[str, Any]:
    """Use only the goal-authorized time/balance QA helpers."""

    require(method in {"setPeriod", "advanceMinutes", "addLumenes"}, f"Forbidden QA mutation: {method}")
    value = page.evaluate(
        """({method, args}) => window.__SYKA_ALPHA_QA__[method](...args)""",
        {"method": method, "args": list(args)},
    )
    require(isinstance(value, dict) and value.get("ok") is True, f"QA support action {method} failed: {value}")
    return value


def wait_snapshot(page: Page, expression: str, arg: Any = None, timeout: int = 10_000) -> None:
    page.wait_for_function(
        f"arg => {{ const s = window.__SYKA_ALPHA_QA__?.getSnapshot(); return Boolean(s && ({expression})); }}",
        arg=arg,
        timeout=timeout,
    )


def click_button(page: Page, selector: str, fallback_name: str | re.Pattern[str], timeout: int = 6_000) -> None:
    locator = page.locator(selector)
    if locator.count() > 0 and locator.first.is_visible():
        locator.first.click(timeout=timeout)
        return
    page.get_by_role("button", name=fallback_name).first.click(timeout=timeout)


def open_building_tool(page: Page, kind: str) -> None:
    click_button(page, ".alpha-action--build", re.compile("constru", re.IGNORECASE))
    page.get_by_role("tab", name="Edificios").click()
    card = page.locator(f'button.alpha-build-card[data-kind="{kind}"]')
    require(card.count() == 1, f"Expected one building card for {kind}")
    require(card.is_enabled(), f"Building card {kind} is disabled")
    card.click()


def open_exterior_tool(page: Page, definition_id: str) -> None:
    click_button(page, ".alpha-action--build", re.compile("constru", re.IGNORECASE))
    page.get_by_role("tab", name="Exterior").click()
    card = page.locator(f'button[data-exterior-id="{definition_id}"]')
    require(card.count() == 1, f"Expected one Exterior card for {definition_id}")
    require(card.is_enabled(), f"Exterior card {definition_id} is disabled")
    card.click()


def cancel_tool(page: Page) -> None:
    click_button(page, "button[aria-label='Cancelar construcción']", re.compile("cancelar", re.IGNORECASE))
    page.wait_for_timeout(100)


def discover_cafe_candidate(page: Page) -> dict[str, Any]:
    value = page.evaluate(
        """async () => {
          const { createPlacementPreview } = await import('/src/presentation/city/placement.ts');
          const { projectGridCenter } = await import('/src/presentation/city/projection.ts');
          const state = window.__SYKA_ALPHA_QA__.getSnapshot().game;
          const game = window.__SYKA_E2E_GAME__;
          const city = game.scene.getScene('city');
          const camera = city.cameras.main;
          const canvas = game.canvas;
          const rect = canvas.getBoundingClientRect();
          const objectById = new Map(state.worldObjects.map(object => [object.instanceId, object]));
          const toScreen = world => ({
            x: rect.x + ((world.x - camera.worldView.x) * camera.zoom + camera.x) * rect.width / canvas.width,
            y: rect.y + ((world.y - camera.worldView.y) * camera.zoom + camera.y) * rect.height / canvas.height,
          });
          const candidates = [];
          for (let y = 0; y < state.map.size.height; y += 1) {
            for (let x = 0; x < state.map.size.width; x += 1) {
              const preview = createPlacementPreview(state, 'cafe-library', {x, y}, 'north');
              if (!preview.valid || preview.roadTiles.length < 1) continue;
              const removed = preview.removedObjectIds.map(id => objectById.get(id)).filter(Boolean);
              const removedTrees = removed.filter(object => object.definitionId.startsWith('tree-'));
              const screen = toScreen(projectGridCenter(x, y));
              const hit = document.elementFromPoint(screen.x, screen.y);
              const safe = hit?.tagName === 'CANVAS' && screen.x > 72 && screen.x < innerWidth - 72
                && screen.y > 92 && screen.y < innerHeight - 118;
              if (!safe) continue;
              candidates.push({
                origin: {x, y}, screen, preview,
                removedDefinitions: removed.map(object => object.definitionId),
                removedTreeCount: removedTrees.length,
                distanceToCenter: Math.abs(screen.x - innerWidth / 2) + Math.abs(screen.y - innerHeight / 2),
              });
            }
          }
          candidates.sort((a, b) =>
            (b.removedTreeCount - a.removedTreeCount)
            || (b.preview.removedObjectIds.length - a.preview.removedObjectIds.length)
            || (a.preview.roadTiles.length - b.preview.roadTiles.length)
            || (a.distanceToCenter - b.distanceToCenter)
            || (a.origin.y - b.origin.y)
            || (a.origin.x - b.origin.x)
          );
          return candidates[0] ?? null;
        }"""
    )
    require(isinstance(value, dict), "No visible valid Café placement with an automatic road was found")
    require(value["preview"]["roadTiles"], "Chosen Café candidate has no automatic road")
    require(value["removedTreeCount"] >= 1, "No Café candidate demonstrates explicit tree removal")
    return value


def discover_exterior_candidate(page: Page, definition_id: str) -> dict[str, Any]:
    value = page.evaluate(
        """async definitionId => {
          const { validateWorldObjectPlacement } = await import('/src/core/worldObjects.ts');
          const { projectGridCenter } = await import('/src/presentation/city/projection.ts');
          const state = window.__SYKA_ALPHA_QA__.getSnapshot().game;
          const game = window.__SYKA_E2E_GAME__;
          const city = game.scene.getScene('city');
          const camera = city.cameras.main;
          const canvas = game.canvas;
          const rect = canvas.getBoundingClientRect();
          const toScreen = world => ({
            x: rect.x + ((world.x - camera.worldView.x) * camera.zoom + camera.x) * rect.width / canvas.width,
            y: rect.y + ((world.y - camera.worldView.y) * camera.zoom + camera.y) * rect.height / canvas.height,
          });
          const blockers = [
            ...state.worldObjects.map(object => object.hostTile),
            ...state.map.tiles.filter(tile => tile.buildingId).map(tile => tile.position),
          ];
          const candidates = [];
          for (let y = 0; y < state.map.size.height; y += 1) {
            for (let x = 0; x < state.map.size.width; x += 1) {
              const plan = validateWorldObjectPlacement(state, {definitionId, hostTile: {x, y}});
              if (!plan.ok) continue;
              const screen = toScreen(projectGridCenter(x, y));
              const hit = document.elementFromPoint(screen.x, screen.y);
              const safe = hit?.tagName === 'CANVAS' && screen.x > 60 && screen.x < innerWidth - 60
                && screen.y > 94 && screen.y < innerHeight - 118;
              if (!safe) continue;
              const clearance = blockers.length === 0
                ? 99
                : Math.min(...blockers.map(point => Math.max(Math.abs(point.x - x), Math.abs(point.y - y))));
              candidates.push({
                hostTile: {x, y},
                screen,
                orientation: plan.value.orientation,
                cost: plan.value.cost,
                clearance,
                distanceToCenter: Math.abs(screen.x - innerWidth / 2) + Math.abs(screen.y - innerHeight / 2),
              });
            }
          }
          candidates.sort((a, b) =>
            (b.clearance - a.clearance)
            || (a.distanceToCenter - b.distanceToCenter)
            || (a.hostTile.y - b.hostTile.y)
            || (a.hostTile.x - b.hostTile.x)
          );
          return candidates[0] ?? null;
        }""",
        definition_id,
    )
    require(isinstance(value, dict), f"No visible valid tile for Exterior object {definition_id}")
    return value


def click_grid_point(page: Page, screen: dict[str, Any]) -> None:
    x, y = float(screen["x"]), float(screen["y"])
    hit = page.evaluate(
        """({x,y}) => {
          const element = document.elementFromPoint(x, y);
          const info = node => {
            if (!node) return null;
            const rect = node.getBoundingClientRect();
            return {
              tag: node.tagName,
              id: node.id || null,
              classes: node.className || null,
              pointerEvents: getComputedStyle(node).pointerEvents,
              rect: {x: rect.x, y: rect.y, width: rect.width, height: rect.height},
            };
          };
          return {
            hit: info(element),
            receipt: info(document.querySelector('.alpha-placement-receipt')),
            toast: info(document.querySelector('.alpha-toast:last-child')),
            topbar: info(document.querySelector('.alpha-topbar')),
            development: info(document.querySelector('.alpha-development')),
          };
        }""",
        {"x": x, "y": y},
    )
    require(hit.get("hit", {}).get("tag") == "CANVAS", f"Physical placement point is covered at ({x:.1f}, {y:.1f}): {hit}")
    page.mouse.move(x, y)
    page.wait_for_timeout(120)
    page.mouse.click(x, y)


def game_object_screen_point(page: Page, kind: str, object_id: str) -> dict[str, float]:
    value = page.evaluate(
        """({kind, id}) => {
          const game = window.__SYKA_E2E_GAME__;
          const scene = game.scene.getScene(kind === 'interior-agent' ? 'cafe-interior' : 'city');
          let object;
          if (kind === 'building') object = scene.buildingViews?.get(id)?.sprite;
          else if (kind === 'world-object') object = scene.decorObjects?.find(item => item.getData?.('worldObjectId') === id);
          else if (kind === 'interior-agent') object = scene.agentViews?.get(id)?.container;
          if (!object) return null;
          const bounds = object.getBounds();
          const world = {x: bounds.centerX, y: bounds.centerY};
          const camera = scene.cameras.main;
          const canvas = game.canvas;
          const rect = canvas.getBoundingClientRect();
          return {
            x: rect.x + ((world.x - camera.worldView.x) * camera.zoom + camera.x) * rect.width / canvas.width,
            y: rect.y + ((world.y - camera.worldView.y) * camera.zoom + camera.y) * rect.height / canvas.height,
          };
        }""",
        {"kind": kind, "id": object_id},
    )
    require(isinstance(value, dict), f"Rendered {kind} {object_id} was not found")
    return {"x": float(value["x"]), "y": float(value["y"])}


def click_game_object(page: Page, kind: str, object_id: str) -> dict[str, float]:
    point = game_object_screen_point(page, kind, object_id)
    page.mouse.move(point["x"], point["y"])
    page.wait_for_timeout(60)
    page.mouse.click(point["x"], point["y"])
    page.wait_for_timeout(160)
    return point


def click_world_object_by_title(page: Page, object_id: str, expected_title: str) -> dict[str, Any]:
    """Physically select a small prop even when a taller neighbour overlaps it."""

    bounds = page.evaluate(
        """id => {
          const game = window.__SYKA_E2E_GAME__;
          const scene = game.scene.getScene('city');
          const object = scene.decorObjects?.find(item => item.getData?.('worldObjectId') === id);
          if (!object) return null;
          const world = object.getBounds();
          const camera = scene.cameras.main;
          const canvas = game.canvas;
          const rect = canvas.getBoundingClientRect();
          const sx = rect.width / canvas.width;
          const sy = rect.height / canvas.height;
          const project = (x, y) => ({
            x: rect.x + ((x - camera.worldView.x) * camera.zoom + camera.x) * sx,
            y: rect.y + ((y - camera.worldView.y) * camera.zoom + camera.y) * sy,
          });
          const topLeft = project(world.x, world.y);
          const bottomRight = project(world.right, world.bottom);
          return {left: topLeft.x, top: topLeft.y, right: bottomRight.x, bottom: bottomRight.y};
        }""",
        object_id,
    )
    require(isinstance(bounds, dict), f"Rendered world object {object_id} was not found")
    attempts: list[dict[str, Any]] = []
    # Start on the left/lower footprint.  It is normally exposed when an
    # adjacent tree canopy overlaps the prop's visual center.
    for fx, fy in (
        (0.14, 0.72),
        (0.14, 0.48),
        (0.30, 0.82),
        (0.30, 0.58),
        (0.50, 0.82),
        (0.50, 0.50),
        (0.72, 0.78),
        (0.82, 0.42),
        (0.18, 0.22),
    ):
        x = float(bounds["left"] + (bounds["right"] - bounds["left"]) * fx)
        y = float(bounds["top"] + (bounds["bottom"] - bounds["top"]) * fy)
        element = page.evaluate(
            "({x, y}) => document.elementFromPoint(x, y)?.tagName ?? null",
            {"x": x, "y": y},
        )
        if element != "CANVAS":
            attempts.append({"x": x, "y": y, "element": element})
            continue
        page.mouse.move(x, y)
        page.wait_for_timeout(40)
        page.mouse.click(x, y)
        page.wait_for_timeout(120)
        title_locator = page.locator(".alpha-inspector-title")
        title = title_locator.inner_text() if title_locator.count() and title_locator.is_visible() else None
        attempts.append({"x": round(x, 2), "y": round(y, 2), "title": title})
        if title == expected_title:
            return {"x": x, "y": y, "attempts": attempts}
    raise VerificationError(f"Could not physically select {expected_title}: bounds={bounds}, attempts={attempts}")


def interior_agent_hit_diagnostics(page: Page, agent_id: str, point: dict[str, float]) -> dict[str, Any]:
    return page.evaluate(
        """({id, point}) => {
          const game = window.__SYKA_E2E_GAME__;
          const scene = game.scene.getScene('cafe-interior');
          const view = scene.agentViews?.get(id);
          const container = view?.container;
          const bounds = container?.getBounds();
          const input = container?.input;
          const pointer = scene.input.activePointer;
          const hits = (typeof scene.input.hitTestPointer === 'function' ? scene.input.hitTestPointer(pointer) : []).map(object => ({
            type: object.constructor?.name ?? 'unknown',
            depth: object.depth,
            x: object.x,
            y: object.y,
            width: object.width,
            height: object.height,
          }));
          const element = document.elementFromPoint(point.x, point.y);
          return {
            eventDetails: window.__SYKA_INTERIOR_SELECTION_EVENTS__ ?? [],
            selectedCard: document.querySelector('button[data-profile-id="default"]')?.classList.contains('is-selected') ?? false,
            elementAtPoint: {tag: element?.tagName ?? null, classes: element?.className ?? null},
            pointer: {x: pointer.x, y: pointer.y, worldX: pointer.worldX, worldY: pointer.worldY},
            container: container ? {
              x: container.x, y: container.y, depth: container.depth,
              active: container.active, visible: container.visible, alpha: container.alpha,
              bounds: bounds ? {x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height} : null,
              inputEnabled: input?.enabled ?? null,
              hitArea: input?.hitArea ? {x: input.hitArea.x, y: input.hitArea.y, width: input.hitArea.width, height: input.hitArea.height} : null,
            } : null,
            hits,
          };
        }""",
        {"id": agent_id, "point": point},
    )


def hotspot_screen_point(page: Page, hotspot_id: str) -> dict[str, float]:
    value = page.evaluate(
        """async id => {
          const { CAFE_HOTSPOTS } = await import('/src/presentation/interior/interiorModel.ts');
          const scene = window.__SYKA_E2E_GAME__.scene.getScene('cafe-interior');
          const hotspot = CAFE_HOTSPOTS.find(candidate => candidate.id === id);
          if (!hotspot) return null;
          const [x, y, width, height] = hotspot.normalizedRect;
          const world = {
            x: scene.roomBounds.x + (x + width / 2) * scene.roomBounds.width,
            y: scene.roomBounds.y + (y + height / 2) * scene.roomBounds.height,
          };
          const camera = scene.cameras.main;
          const canvas = window.__SYKA_E2E_GAME__.canvas;
          const rect = canvas.getBoundingClientRect();
          return {
            x: rect.x + ((world.x - camera.worldView.x) * camera.zoom + camera.x) * rect.width / canvas.width,
            y: rect.y + ((world.y - camera.worldView.y) * camera.zoom + camera.y) * rect.height / canvas.height,
          };
        }""",
        hotspot_id,
    )
    require(isinstance(value, dict), f"Interior hotspot {hotspot_id} was not found")
    return {"x": float(value["x"]), "y": float(value["y"])}


def player_object_ids(state: dict[str, Any]) -> set[str]:
    return {item["instanceId"] for item in state["worldObjects"] if item.get("provenance") == "player"}


def building_by_id(state: dict[str, Any], building_id: str) -> dict[str, Any]:
    value = next((building for building in state["buildings"] if building["id"] == building_id), None)
    require(isinstance(value, dict), f"Building {building_id} is missing")
    return value


def agent_by_profile(state: dict[str, Any], profile_id: str) -> dict[str, Any]:
    value = next((agent for agent in state["agents"] if agent["profileId"] == profile_id), None)
    require(isinstance(value, dict), f"Agent {profile_id} is missing")
    return value


def game_signature(state: dict[str, Any], cafe_id: str) -> dict[str, Any]:
    cafe = building_by_id(state, cafe_id)
    road_tiles = sorted(
        f"{tile['position']['x']},{tile['position']['y']}"
        for tile in state["map"]["tiles"]
        if tile["terrain"] == "road"
    )
    objects = sorted(
        (
            item["instanceId"],
            item["definitionId"],
            item["hostTile"]["x"],
            item["hostTile"]["y"],
            item["provenance"],
        )
        for item in state["worldObjects"]
    )
    agents = sorted(
        (agent["profileId"], json.dumps(agent["location"], sort_keys=True), agent.get("destinationBuildingId", ""))
        for agent in state["agents"]
    )
    return {
        "cafe": {
            "id": cafe["id"],
            "status": cafe["status"],
            "level": cafe["level"],
            "visualVariant": cafe["visualVariant"],
            "installedUpgrades": cafe["installedUpgrades"],
        },
        "roads": road_tiles,
        "objects": objects,
        "agents": agents,
        "balance": state["economy"]["balance"],
        "townXp": state["progression"]["townXp"],
        "townLevel": state["progression"]["townLevel"],
    }


def render_metrics(page: Page, cafe_id: str | None = None) -> dict[str, Any]:
    return page.evaluate(
        """cafeId => {
          const game = window.__SYKA_E2E_GAME__;
          const city = game.scene.getScene('city');
          const light = item => ({
            alpha: item.sprite.alpha,
            width: item.sprite.displayWidth,
            height: item.sprite.displayHeight,
            x: item.sprite.x,
            y: item.sprite.y,
            family: item.family,
          });
          return {
            streetLights: (city.streetLights ?? []).map(light),
            buildingLights: (city.buildingLights ?? []).map(light),
            cafeObjectCount: cafeId ? (city.buildingViews?.get(cafeId)?.objects?.length ?? 0) : 0,
            ambientDetailCount: city.ambientDetailViews?.length ?? city.ambientDetails?.length ?? 0,
          };
        }""",
        cafe_id,
    )


def canvas_metrics(page: Page, width: int, height: int) -> dict[str, Any]:
    value = page.locator("canvas").evaluate(
        """canvas => {
          const rect = canvas.getBoundingClientRect();
          return {
            logicalWidth: canvas.width,
            logicalHeight: canvas.height,
            cssWidth: rect.width,
            cssHeight: rect.height,
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            scaleX: rect.width / canvas.width,
            scaleY: rect.height / canvas.height,
            imageRendering: getComputedStyle(canvas).imageRendering,
            bodyScrollWidth: document.body.scrollWidth,
            bodyScrollHeight: document.body.scrollHeight,
          };
        }"""
    )
    coverage = value["cssWidth"] * value["cssHeight"] / (width * height)
    value["viewportCoverage"] = round(coverage, 6)
    require(abs(value["scaleX"] - value["scaleY"]) <= 0.001, f"Canvas is stretched: {value}")
    # FIT can leave a sub-two-pixel gutter when a wide logical width is rounded
    # to an integer. Uniform scale plus >=99.8% coverage is the actual responsive gate.
    require(coverage >= 0.998, f"Canvas does not materially cover viewport: {value}")
    require(value["bodyScrollWidth"] <= width + 1 and value["bodyScrollHeight"] <= height + 1, f"Unexpected document overflow: {value}")
    require(value["imageRendering"] in {"pixelated", "crisp-edges"}, "Pixel rendering CSS is inactive")
    return value


def run_primary(browser: Browser) -> JourneyResult:
    result = JourneyResult()
    started = time.time()
    url = f"{BASE_URL}?qa=1&mode=progressive"
    context, bridge = prepare_context(browser, *PRIMARY_VIEWPORT, url)
    audit = BrowserAudit("primary-1440x900")
    page: Page | None = None
    try:
        page = context.new_page()
        audit.attach(page)
        handled_dialogs: list[dict[str, str]] = []

        def accept_dialog(dialog: Any) -> None:
            handled_dialogs.append({"type": dialog.type, "message": dialog.message})
            dialog.accept()

        page.on("dialog", accept_dialog)
        result.readySeconds = wait_ready(page, url)

        def initial_flow() -> dict[str, Any]:
            state = snapshot(page)["game"]
            require(state["mode"] == "progressive", "Expected a clean Nueva partida")
            require(len(state["agents"]) == 4, "Nueva partida must have four agents")
            tracks: dict[str, set[tuple[int, int]]] = {
                agent["profileId"]: {(agent["position"]["x"], agent["position"]["y"])}
                for agent in state["agents"]
            }
            for _ in range(15):
                qa_time(page, "advanceMinutes", 3)
                sampled = snapshot(page)["game"]
                for agent in sampled["agents"]:
                    tracks[agent["profileId"]].add((agent["position"]["x"], agent["position"]["y"]))
            moved = snapshot(page)["game"]
            require(
                any(after["position"] != before["position"] for before, after in zip(state["agents"], moved["agents"])),
                "No agent moved during the initial ambient window",
            )
            require(
                all(len(track) >= 2 for track in tracks.values()),
                f"At least one agent remained fixed through the ambient window: {tracks}",
            )
            evidence = screenshot(page, result, "01-nueva-partida-agentes-1440x900.png")
            return {"distinctPositionsByAgent": {profile: len(track) for profile, track in tracks.items()}, "evidence": evidence}

        report_flow(result, "01", "Nueva partida con vida ambiental", initial_flow)

        def preview_flow() -> dict[str, Any]:
            before = snapshot(page)["game"]
            open_building_tool(page, "cafe")
            candidate = discover_cafe_candidate(page)
            page.mouse.move(candidate["screen"]["x"], candidate["screen"]["y"])
            page.wait_for_selector(".alpha-placement-receipt:not([hidden])", state="visible", timeout=5_000)
            page.wait_for_timeout(120)
            receipt = page.locator(".alpha-placement-receipt").inner_text()
            require(str(len(candidate["preview"]["roadTiles"])) in receipt, f"Road count absent from preview: {receipt}")
            require(str(len(candidate["preview"]["removedObjectIds"])) in receipt, f"Cleanup count absent from preview: {receipt}")
            require("Camino" in receipt and "Retiro" in receipt, f"Cost breakdown absent from preview: {receipt}")
            evidence = screenshot(page, result, "02-preview-arbol-y-conector-1440x900.png")
            cancel_tool(page)
            after = snapshot(page)["game"]
            require(before["economy"]["balance"] == after["economy"]["balance"], "Cancel changed balance")
            require(before["worldObjects"] == after["worldObjects"], "Cancel removed vegetation")
            require(before["map"] == after["map"], "Cancel painted a road")
            result.physicalPlacements.append(
                {
                    "kind": "preview-only",
                    "definitionId": "cafe-library",
                    "origin": candidate["origin"],
                    "input": "UI card + canvas hover + Cancel button",
                }
            )
            return {"candidate": candidate, "receipt": receipt, "evidence": evidence}

        preview = report_flow(result, "02", "Preview explica árbol, limpieza y conector", preview_flow)
        candidate = preview["candidate"]

        def place_cafe_flow() -> dict[str, Any]:
            before = snapshot(page)["game"]
            old_ids = {building["id"] for building in before["buildings"]}
            open_building_tool(page, "cafe")
            click_grid_point(page, candidate["screen"])
            page.wait_for_function(
                "count => window.__SYKA_ALPHA_QA__.getSnapshot().game.buildings.length === count + 1",
                arg=len(before["buildings"]),
                timeout=5_000,
            )
            after = snapshot(page)["game"]
            cafe = next(building for building in after["buildings"] if building["id"] not in old_ids)
            require(cafe["id"].startswith("building-"), f"Player Café does not use a generated ID: {cafe['id']}")
            require(cafe["kind"] == "cafe" and cafe["status"] != "complete", "Café did not start construction")
            for road in candidate["preview"]["roadTiles"]:
                tile = next(tile for tile in after["map"]["tiles"] if tile["position"] == road)
                require(tile["terrain"] == "road", f"Preview road was not committed at {road}")
            remaining_ids = {item["instanceId"] for item in after["worldObjects"]}
            require(
                all(item not in remaining_ids for item in candidate["preview"]["removedObjectIds"]),
                "Previewed vegetation was not atomically removed",
            )
            require(
                after["economy"]["balance"] == before["economy"]["balance"] - candidate["preview"]["costs"]["total"],
                "Committed placement did not charge the previewed total",
            )
            evidence = screenshot(page, result, "03-cafe-en-obra-con-camino-1440x900.png")
            result.physicalPlacements.append(
                {
                    "kind": "building",
                    "definitionId": "cafe-library",
                    "instanceId": cafe["id"],
                    "origin": candidate["origin"],
                    "input": "UI card click + canvas click",
                }
            )
            cancel_tool(page)
            return {"cafeId": cafe["id"], "status": cafe["status"], "evidence": evidence}

        cafe_placed = report_flow(result, "03", "Colocación física y carretera automática", place_cafe_flow)
        cafe_id = cafe_placed["cafeId"]

        def acceleration_flow() -> dict[str, Any]:
            qa_time(page, "addLumenes", 1_000)
            click_game_object(page, "building", cafe_id)
            page.get_by_role("heading", name="Café Biblioteca").wait_for(timeout=5_000)
            before = building_by_id(snapshot(page)["game"], cafe_id)
            balance_before = snapshot(page)["game"]["economy"]["balance"]
            click_button(page, '[data-construction-action="one-hour"]', re.compile("Acelerar 1 hora", re.IGNORECASE))
            page.wait_for_timeout(120)
            after_hour_state = snapshot(page)["game"]
            after_hour = building_by_id(after_hour_state, cafe_id)
            require(
                after_hour["construction"]["elapsedMinutes"] > before["construction"]["elapsedMinutes"],
                "Acelerar 1 hora did not advance construction",
            )
            require(after_hour_state["economy"]["balance"] < balance_before, "Acelerar 1 hora did not charge Lúmenes")
            click_button(page, '[data-construction-action="finish-now"]', re.compile("Terminar ahora", re.IGNORECASE))
            page.wait_for_function(
                "id => window.__SYKA_ALPHA_QA__.getSnapshot().game.buildings.find(b => b.id === id)?.status === 'complete'",
                arg=cafe_id,
                timeout=5_000,
            )
            completed = snapshot(page)["game"]
            cafe = building_by_id(completed, cafe_id)
            require(all(agent["bindings"]["cafeBuildingId"] == cafe_id for agent in completed["agents"]), "Generated Café was not bound by function")
            require(completed["progression"]["townXp"] > 0, "Café completion awarded no city XP")
            level1_objects = render_metrics(page, cafe_id)["cafeObjectCount"]
            evidence = screenshot(page, result, "04-cafe-completo-nivel-1-1440x900.png")
            return {
                "status": cafe["status"],
                "townXp": completed["progression"]["townXp"],
                "level1RenderObjects": level1_objects,
                "evidence": evidence,
            }

        completed = report_flow(result, "04", "Aceleración real y binding dinámico", acceleration_flow)

        def agent_flow() -> dict[str, Any]:
            page.locator('button[data-profile-id="default"]').click()
            click_button(page, '[data-agent-action="go-to-cafe"]', re.compile("Ir al Café", re.IGNORECASE))
            ordered = agent_by_profile(snapshot(page)["game"], "default")
            require(ordered.get("localOrder", {}).get("targetBuildingId") == cafe_id, "Local order did not target generated Café")
            require(len(ordered["path"]) >= 2, "Local order did not create a walkable route")
            samples: list[dict[str, Any]] = []
            for _ in range(180):
                current = agent_by_profile(snapshot(page)["game"], "default")
                samples.append({"position": current["position"], "location": current["location"], "pathLength": len(current["path"])})
                if current["location"]["kind"] == "interior" and current.get("localOrder", {}).get("phase") in {"acting", "staying"}:
                    break
                qa_time(page, "advanceMinutes", 1)
            arrived = agent_by_profile(snapshot(page)["game"], "default")
            require(arrived["location"]["kind"] == "interior", f"Syka never entered the Café: {arrived}")
            require(arrived["location"]["buildingId"] == cafe_id, "Syka entered the wrong building")
            exterior_positions = {
                (sample["position"]["x"], sample["position"]["y"])
                for sample in samples
                if sample["location"]["kind"] in {"exterior", "transit"}
            }
            require(len(exterior_positions) >= 2, "Syka appears to have teleported instead of walking")
            return {
                "routeSamples": len(samples),
                "distinctExteriorPositions": len(exterior_positions),
                "arrival": arrived["location"],
            }

        report_flow(result, "05", "Orden local Ir al Café y entrada sin teletransporte", agent_flow)

        def interior_flow() -> dict[str, Any]:
            click_game_object(page, "building", cafe_id)
            click_button(page, ".alpha-inspector-actions button.alpha-button--primary", re.compile("Entrar al Café Biblioteca", re.IGNORECASE))
            page.wait_for_function("() => window.__SYKA_E2E_GAME__.scene.isActive('cafe-interior')", timeout=5_000)
            page.wait_for_timeout(260)
            page.evaluate(
                """() => {
                  window.__SYKA_INTERIOR_SELECTION_EVENTS__ = [];
                  window.__SYKA_E2E_GAME__.events.on('syka:interior-agent-selection', detail => {
                    window.__SYKA_INTERIOR_SELECTION_EVENTS__.push(detail);
                  });
                }"""
            )
            agent_point = click_game_object(page, "interior-agent", "syka")
            hit_diagnostics = interior_agent_hit_diagnostics(page, "syka", agent_point)
            require(hit_diagnostics["selectedCard"], f"Physical interior agent click did not select Syka: {hit_diagnostics}")
            hotspot = hotspot_screen_point(page, "library")
            page.mouse.move(hotspot["x"], hotspot["y"])
            page.wait_for_timeout(100)
            page.mouse.click(hotspot["x"], hotspot["y"])
            click_button(page, '[data-interior-action="read"]', re.compile("Leer", re.IGNORECASE))
            page.wait_for_timeout(160)
            state = snapshot(page)["game"]
            syka = agent_by_profile(state, "default")
            toasts = page.locator(".alpha-toast").all_inner_texts()
            require(syka["location"].get("action") == "read", f"Leer did not mutate Syka after physical hotspot action: location={syka['location']}, toasts={toasts}")
            require(syka["location"]["anchorId"] == "library-chair", f"Read action used wrong anchor: {syka['location']}")
            permanent_labels = page.locator("text=Zona de mesas").count()
            require(permanent_labels == 0, "Debug-like permanent interior label is still visible")
            evidence = screenshot(page, result, "05-agente-leyendo-interior-1440x900.png")
            click_button(page, ".alpha-interior-actions + .alpha-button--secondary", re.compile("Ver decoración", re.IGNORECASE))
            # Re-select through the visible card after closing the hotspot
            # inspector; this avoids racing its synchronous panel replacement.
            page.locator('button[data-profile-id="default"]').click()
            page.wait_for_selector('[data-agent-action="return-to-city"]', state="visible", timeout=5_000)
            click_button(page, '[data-agent-action="return-to-city"]', re.compile("Salir a la ciudad", re.IGNORECASE))
            page.wait_for_function(
                "() => window.__SYKA_ALPHA_QA__.getSnapshot().game.agents.find(a => a.profileId === 'default')?.location?.kind === 'exterior'",
                timeout=5_000,
            )
            returned = agent_by_profile(snapshot(page)["game"], "default")
            cafe = building_by_id(snapshot(page)["game"], cafe_id)
            require(returned["location"]["tile"] == cafe["accessTile"], f"Syka returned to wrong exterior tile: {returned['location']}")
            page.keyboard.press("Escape")
            page.wait_for_function("() => window.__SYKA_ALPHA_QA__.getSnapshot().game.camera.scene === 'city'", timeout=5_000)
            return {"interiorLocation": syka["location"], "returnedLocation": returned["location"], "evidence": evidence}

        report_flow(result, "06", "Agente visible, anchor y acción interior", interior_flow)

        def exterior_flow() -> dict[str, Any]:
            qa_time(page, "addLumenes", 2_000)
            placed: list[dict[str, Any]] = []
            for definition_id in ("wildflowers", "shrub-round", "tree-round", "bench", "streetlamp"):
                before = snapshot(page)["game"]
                before_ids = player_object_ids(before)
                before_balance = before["economy"]["balance"]
                open_exterior_tool(page, definition_id)
                candidate = discover_exterior_candidate(page, definition_id)
                click_grid_point(page, candidate["screen"])
                page.wait_for_function(
                    "count => window.__SYKA_ALPHA_QA__.getSnapshot().game.worldObjects.filter(o => o.provenance === 'player').length === count + 1",
                    arg=len(before_ids),
                    timeout=5_000,
                )
                after = snapshot(page)["game"]
                created = next(item for item in after["worldObjects"] if item["instanceId"] not in before_ids and item["provenance"] == "player")
                require(created["definitionId"] == definition_id, f"Placed wrong Exterior object: {created}")
                require(after["economy"]["balance"] == before_balance - candidate["cost"], f"Wrong price for {definition_id}")
                placed.append({"definitionId": definition_id, "instanceId": created["instanceId"], "hostTile": candidate["hostTile"]})
                result.physicalPlacements.append(
                    {
                        "kind": "exterior",
                        "definitionId": definition_id,
                        "instanceId": created["instanceId"],
                        "hostTile": candidate["hostTile"],
                        "input": "Exterior UI card click + canvas click",
                    }
                )
                cancel_tool(page)
            placed_evidence = screenshot(page, result, "07-catalogo-exterior-colocado-1440x900.png")
            click_button(page, ".alpha-action--build", re.compile("constru", re.IGNORECASE))
            page.get_by_role("tab", name="Exterior").click()
            cards = page.locator("button[data-exterior-id]")
            require(cards.count() >= 9, f"Exterior drawer exposes only {cards.count()} items")
            page.wait_for_selector("button[data-exterior-id='streetlamp']", state="visible", timeout=5_000)
            drawer_evidence = element_screenshot(
                page,
                ".alpha-palette",
                result,
                "07b-catalogo-exterior-abierto-precios-1440x900.png",
            )
            page.get_by_role("button", name="Cerrar catálogo de construcción").click()
            return {"placed": placed, "evidence": [placed_evidence, drawer_evidence]}

        exterior = report_flow(result, "07", "Catálogo Exterior: cinco compras físicas", exterior_flow)

        def lighting_flow() -> dict[str, Any]:
            captures: dict[str, str] = {}
            metrics: dict[str, Any] = {}
            page.get_by_role("button", name="Pausar el tiempo").click()
            wait_snapshot(page, "s.game.clock.speed === 0", timeout=5_000)
            for period, target_minute, label, filename in (
                ("day", 12 * 60, "12:00", "08-farola-dia-1200-1440x900.png"),
                ("twilight", 18 * 60 + 30, "18:30", "09-farola-atardecer-1830-1440x900.png"),
                ("night", 22 * 60, "22:00", "10-farola-noche-2200-1440x900.png"),
            ):
                qa_time(page, "setPeriod", period)
                current_minute = snapshot(page)["game"]["clock"]["minuteOfDay"]
                delta = (target_minute - current_minute + 1_440) % 1_440
                if delta:
                    qa_time(page, "advanceMinutes", delta)
                wait_snapshot(page, f"s.game.clock.minuteOfDay === {target_minute}", timeout=5_000)
                daytime_text = page.locator(".alpha-daytime").inner_text()
                require(label in daytime_text, f"Visible clock is not exact for {period}: {daytime_text}")
                page.wait_for_timeout(180)
                metrics[period] = render_metrics(page, cafe_id)
                captures[period] = screenshot(page, result, filename)
            day_alphas = [light["alpha"] for light in metrics["day"]["streetLights"]]
            twilight_alphas = [light["alpha"] for light in metrics["twilight"]["streetLights"]]
            night_alphas = [light["alpha"] for light in metrics["night"]["streetLights"]]
            require(day_alphas and max(day_alphas) <= 0.001, f"Streetlamp pool is visible by day: {day_alphas}")
            require(max(twilight_alphas) > 0.05, "Streetlamps did not warm up at twilight")
            require(max(night_alphas) >= max(twilight_alphas), "Night streetlamps are weaker than twilight")
            maximum_pool = max(
                max(light["width"], light["height"])
                for phase in metrics.values()
                for light in phase["streetLights"]
            )
            require(maximum_pool <= 64, f"A streetlamp still uses an oversized light pool: {maximum_pool}")
            return {"maxAlpha": {key: max(item["alpha"] for item in value["streetLights"]) for key, value in metrics.items()}, "maxPoolPixels": maximum_pool, "evidence": captures}

        report_flow(result, "08", "Iluminación por familia: día, tarde y noche", lighting_flow)

        def upgrade_flow() -> dict[str, Any]:
            qa_time(page, "addLumenes", 1_000)
            qa_time(page, "setPeriod", "twilight")
            click_game_object(page, "building", cafe_id)
            before_state = snapshot(page)["game"]
            before_cafe = building_by_id(before_state, cafe_id)
            before_render = render_metrics(page, cafe_id)["cafeObjectCount"]
            before_evidence = screenshot(page, result, "11-cafe-nivel-1-antes-upgrade-1440x900.png")
            page.get_by_role("button", name=re.compile(r"(?:Rincón|Altillo) de lectura", re.IGNORECASE)).click()
            page.wait_for_function(
                "id => Boolean(window.__SYKA_ALPHA_QA__.getSnapshot().game.buildings.find(b => b.id === id)?.activeUpgrade)",
                arg=cafe_id,
                timeout=5_000,
            )
            click_button(page, '[data-construction-action="finish-now"]', re.compile("Terminar ahora", re.IGNORECASE))
            page.wait_for_function(
                "id => window.__SYKA_ALPHA_QA__.getSnapshot().game.buildings.find(b => b.id === id)?.level === 2",
                arg=cafe_id,
                timeout=5_000,
            )
            after_state = snapshot(page)["game"]
            after_cafe = building_by_id(after_state, cafe_id)
            page.wait_for_timeout(160)
            after_render = render_metrics(page, cafe_id)["cafeObjectCount"]
            require(after_cafe["visualVariant"] != before_cafe["visualVariant"], "Upgrade did not change visualVariant")
            require(after_render >= before_render + 2, f"Upgrade added no legible exterior composition: {before_render} -> {after_render}")
            after_evidence = screenshot(page, result, "12-cafe-nivel-2-despues-upgrade-1440x900.png")
            return {
                "beforeVariant": before_cafe["visualVariant"],
                "afterVariant": after_cafe["visualVariant"],
                "renderObjects": {"before": before_render, "after": after_render},
                "evidence": [before_evidence, after_evidence],
            }

        report_flow(result, "09", "Mejora del Café con cambio visual real", upgrade_flow)

        def remove_flow() -> dict[str, Any]:
            target = next(item for item in exterior["placed"] if item["definitionId"] == "streetlamp")
            before = snapshot(page)["game"]
            balance_before = before["economy"]["balance"]
            selection = click_game_object(page, "world-object", target["instanceId"])
            page.wait_for_selector(".alpha-inspector-title", state="visible", timeout=5_000)
            selected_title = page.locator(".alpha-inspector-title").inner_text()
            selected_id = page.evaluate(
                "() => window.__SYKA_E2E_GAME__.scene.getScene('city').selectedWorldObjectId ?? null"
            )
            require(selected_id == target["instanceId"], f"Physical click selected the wrong exterior id: {selected_id}")
            require(selected_title == "Farola", f"Physical click selected the wrong exterior object: {selected_title}")
            dialog_count_before = len(handled_dialogs)
            click_button(page, '[data-world-object-action="remove"]', re.compile("Retirar", re.IGNORECASE))
            page.wait_for_function(
                "id => !window.__SYKA_ALPHA_QA__.getSnapshot().game.worldObjects.some(o => o.instanceId === id)",
                arg=target["instanceId"],
                timeout=5_000,
            )
            require(len(handled_dialogs) == dialog_count_before + 1, "Removal did not request one native confirmation")
            dialog_details = handled_dialogs[-1]
            require(dialog_details.get("type") == "confirm", f"Removal used an unexpected dialog: {dialog_details}")
            after = snapshot(page)["game"]
            require(after["economy"]["balance"] == balance_before + 12, "Streetlamp removal did not refund 50% exactly once")
            page.wait_for_timeout(500)
            idempotence = snapshot(page)["game"]
            require(
                idempotence["economy"]["balance"] == balance_before + 12,
                "Streetlamp removal credited the refund more than once",
            )
            require(
                sum(item["instanceId"] == target["instanceId"] for item in idempotence["worldObjects"]) == 0,
                "Removed streetlamp reappeared after the confirmed action",
            )
            return {
                "removed": target,
                "refund": 12,
                "idempotentBalance": idempotence["economy"]["balance"],
                "physicalSelection": selection,
            }

        report_flow(result, "10", "Retiro de Exterior y reembolso", remove_flow)

        def persistence_flow() -> dict[str, Any]:
            # Re-enter once more so the final save proves that interior anchor
            # and local action survive a full browser reload.
            page.locator('button[data-profile-id="default"]').click()
            click_button(page, '[data-agent-action="go-to-cafe"]', re.compile("Ir al Café", re.IGNORECASE))
            for _ in range(180):
                syka = agent_by_profile(snapshot(page)["game"], "default")
                if syka["location"]["kind"] == "interior" and syka["location"].get("action"):
                    break
                qa_time(page, "advanceMinutes", 1)
            syka_before_save = agent_by_profile(snapshot(page)["game"], "default")
            require(
                syka_before_save["location"]["kind"] == "interior" and syka_before_save["location"].get("action"),
                f"Could not prepare a persistent interior action: {syka_before_save['location']}",
            )
            # Pause through the real UI so the signature does not drift during reload.
            page.get_by_role("button", name="Pausar el tiempo").click()
            page.get_by_role("button", name="Guardar partida").click()
            page.wait_for_timeout(160)
            before = game_signature(snapshot(page)["game"], cafe_id)
            saved_text = page.evaluate("() => localStorage.getItem('syka-world.alpha-v1.save')")
            require(isinstance(saved_text, str) and '"schema":"syka.world.save.v1"' in saved_text, "Versioned save is absent")
            page.reload(wait_until="domcontentloaded", timeout=60_000)
            try:
                page.wait_for_load_state("networkidle", timeout=2_000)
            except PlaywrightTimeoutError:
                pass
            page.wait_for_selector("#loading-card.is-hidden", timeout=30_000)
            page.wait_for_function("() => Boolean(window.__SYKA_ALPHA_QA__ && window.__SYKA_E2E_GAME__)", timeout=30_000)
            page.wait_for_timeout(250)
            after = game_signature(snapshot(page)["game"], cafe_id)
            require(before == after, f"Save/reload changed the integrated state:\nBEFORE={before}\nAFTER={after}")
            syka_after_reload = agent_by_profile(snapshot(page)["game"], "default")
            require(syka_after_reload["location"] == syka_before_save["location"], "Interior anchor/action did not survive reload")
            evidence = screenshot(page, result, "13-save-reload-restaurado-1440x900.png")
            return {"signature": after, "interiorLocation": syka_after_reload["location"], "evidence": evidence}

        report_flow(result, "11", "Guardar y recargar el circuito completo", persistence_flow)
        audit.assert_clean()
    except Exception as error:
        result.status = "FAIL"
        result.error = f"{type(error).__name__}: {error}"
        result.traceback = traceback.format_exc(limit=14)
        if page is not None:
            try:
                screenshot(page, result, "failure-primary-1440x900.png")
            except Exception:
                pass
    finally:
        result.durationSeconds = round(time.time() - started, 3)
        result.bridgeRequests = list(bridge.requests)
        result.console = audit.actionable_console()
        result.pageErrors = list(audit.page_errors)
        result.failedResponses = list(audit.failed_responses)
        bridge.close()
        context.close()
    return result


def run_responsive_smoke(browser: Browser, width: int, height: int) -> ResponsiveResult:
    label = f"{width}x{height}"
    result = ResponsiveResult(viewport=label)
    url = f"{BASE_URL}?qa=1"
    context, bridge = prepare_context(browser, width, height, url)
    audit = BrowserAudit(f"responsive-{label}")
    page: Page | None = None
    try:
        page = context.new_page()
        audit.attach(page)
        wait_ready(page, url)
        state = snapshot(page)["game"]
        result.mode = state["mode"]
        result.buildings = len(state["buildings"])
        result.agents = len(state["agents"])
        require(state["mode"] == "showcase", f"Expected Muestra in {label}")
        require(result.buildings >= 9 and result.agents == 4, f"Incomplete Muestra in {label}")
        result.canvas = canvas_metrics(page, width, height)
        screenshot(page, result, f"14-muestra-responsive-{label}.png")
        audit.assert_clean()
    except Exception as error:
        result.status = "FAIL"
        result.error = f"{type(error).__name__}: {error}"
        result.traceback = traceback.format_exc(limit=10)
        if page is not None:
            try:
                screenshot(page, result, f"failure-responsive-{label}.png")
            except Exception:
                pass
    finally:
        result.bridgeRequests = list(bridge.requests)
        result.console = audit.actionable_console()
        result.pageErrors = list(audit.page_errors)
        result.failedResponses = list(audit.failed_responses)
        bridge.close()
        context.close()
    return result


def render_markdown(payload: dict[str, Any]) -> str:
    primary = payload["primary"]
    lines = [
        "# Syka World — Mechanic Integration Pass v1 — E2E",
        "",
        f"**Resultado:** {payload['overall']}",
        "",
        "Método: Chromium headless con Python Playwright; servidor temporal gestionado por `with_server.py`; bridge controlado y estrictamente GET-only.",
        "",
        "La API QA se usó únicamente para controlar hora y otorgar Lúmenes locales. La cafetería y los objetos Exterior se colocaron mediante clicks físicos sobre tarjetas visibles y canvas.",
        "",
        f"## Recorrido principal 1440×900 — {primary['status']}",
        "",
    ]
    for flow in primary["flows"]:
        lines.append(f"- **{flow['id']}. {flow['title']} — {flow['status']}** ({flow['durationSeconds']} s)")
    if primary.get("error"):
        lines.extend(["", f"Error: `{primary['error']}`"])
    lines.extend(
        [
            "",
            f"- Colocaciones físicas registradas: {len(primary['physicalPlacements'])}.",
            f"- Requests bridge: {len(primary['bridgeRequests'])}; sólo GET: {all(item['method'] == 'GET' for item in primary['bridgeRequests'])}.",
            f"- Console warnings/errors accionables: {len(primary['console'])}; page errors: {len(primary['pageErrors'])}; HTTP fallidas: {len(primary['failedResponses'])}.",
            f"- Evidencias: {', '.join(primary['screenshots']) if primary['screenshots'] else 'ninguna'}.",
            "",
            "## Responsive y smoke de Muestra",
            "",
        ]
    )
    for item in payload["responsive"]:
        lines.append(
            f"- **{item['viewport']} — {item['status']}**: {item['buildings']} edificios, {item['agents']} agentes, "
            f"error de escala {abs(item.get('canvas', {}).get('scaleX', 0) - item.get('canvas', {}).get('scaleY', 0)):.6f}."
        )
        if item.get("error"):
            lines.append(f"  - Error: `{item['error']}`")
    lines.extend(
        [
            "",
            "## Garde-fous verificados",
            "",
            "- Ninguna colocación utilizó `QA.placeBuilding` ni una mutación directa del core.",
            "- El bridge sólo recibió GET sin body y nunca endpoints de comandos o tareas.",
            "- El recorrido cubre cancelación atómica, conector vial, aceleración paga, binding `building-N`, entrada/acción interior, Exterior, luz, upgrade y save/reload.",
            "- Los tres viewports obligatorios quedaron representados: 1008×548, 1440×900 y 2560×1080.",
            "",
        ]
    )
    return "\n".join(lines)


def write_report(primary: JourneyResult, responsive: list[ResponsiveResult], started: float) -> dict[str, Any]:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    overall = "PASS" if primary.status == "PASS" and all(item.status == "PASS" for item in responsive) else "FAIL"
    payload = {
        "schema": "syka.world.mechanic-integration-e2e.v1",
        "overall": overall,
        "durationSeconds": round(time.time() - started, 3),
        "baseUrl": BASE_URL,
        "constraints": {
            "placementsViaPhysicalUiAndCanvas": True,
            "qaMethodsAllowed": ["setPeriod", "advanceMinutes", "addLumenes"],
            "bridgePolicy": "GET-only; no commands/tasks",
        },
        "primary": asdict(primary),
        "responsive": [asdict(item) for item in responsive],
    }
    REPORT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    REPORT_MD.write_text(render_markdown(payload), encoding="utf-8")
    return payload


def main() -> int:
    started = time.time()
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        primary = run_primary(browser)
        responsive = [run_responsive_smoke(browser, width, height) for width, height in RESPONSIVE_VIEWPORTS]
        browser.close()
    payload = write_report(primary, responsive, started)
    print(
        json.dumps(
            {
                "overall": payload["overall"],
                "durationSeconds": payload["durationSeconds"],
                "primary": primary.status,
                "responsive": [{"viewport": item.viewport, "status": item.status} for item in responsive],
                "report": str(REPORT_JSON),
            },
            indent=2,
            ensure_ascii=False,
        )
    )
    return 0 if payload["overall"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
