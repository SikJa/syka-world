"""End-to-end browser verification for Syka World Isometric Alpha v1.

This script contains browser logic only. Start it through the webapp-testing
skill's ``with_server.py`` helper (see ``e2e/README.md``).
"""

from __future__ import annotations

import json
import sys
import time
import traceback
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import (
    Browser,
    BrowserContext,
    Page,
    Request,
    Route,
    TimeoutError as PlaywrightTimeoutError,
    sync_playwright,
)


BASE_URL = "http://127.0.0.1:5173/"
REPO_ROOT = Path(__file__).resolve().parents[3]
REPORT_DIR = REPO_ROOT / "reports" / "e2e" / "alpha-v1"
SCREENSHOT_DIR = REPORT_DIR / "screenshots"
REPORT_JSON = REPORT_DIR / "alpha-v1-e2e-report.json"
REPORT_MD = REPORT_DIR / "ALPHA_V1_E2E_REPORT.md"
FLOW_TITLES = {
    "01": "Abrir modo muestra",
    "02": "Pan y zoom sin rotación",
    "03": "Día, atardecer y noche",
    "04": "Seleccionar cafetería",
    "05": "Entrar al interior",
    "06": "Comprar decoración opcional",
    "07": "Volver conservando cámara",
    "08": "Iniciar nueva partida",
    "09": "Comprar y colocar cafetería",
    "10": "Construcción completa e interior",
    "11": "Guardar, recargar y conservar estado",
    "12": "Secuencia completa de estados",
    "13": "Bridge controlado: desconectar y reconectar",
    "14": "Bridge real GET-only",
}


class VerificationError(AssertionError):
    pass


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
        if "/bridge/" in request.url:
            self.bridge_requests.append(
                {
                    "method": request.method,
                    "url": request.url,
                    "has_body": request.post_data is not None,
                }
            )

    def _response(self, response: Any) -> None:
        if response.status >= 400:
            self.failed_responses.append(
                {"status": response.status, "method": response.request.method, "url": response.url}
            )


@dataclass
class Recorder:
    started_at: float = field(default_factory=time.time)
    flows: list[dict[str, Any]] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    metrics: dict[str, Any] = field(default_factory=dict)
    audits: dict[str, BrowserAudit] = field(default_factory=dict)
    quality_gates: list[dict[str, Any]] = field(default_factory=list)

    def run(self, flow_id: str, action: Callable[[], dict[str, Any]]) -> dict[str, Any] | None:
        started = time.perf_counter()
        try:
            details = action()
            self.flows.append(
                {
                    "id": flow_id,
                    "title": FLOW_TITLES[flow_id],
                    "status": "PASS",
                    "duration_seconds": round(time.perf_counter() - started, 3),
                    "details": details,
                }
            )
            return details
        except Exception as error:  # keep remaining independent checks running
            self.flows.append(
                {
                    "id": flow_id,
                    "title": FLOW_TITLES[flow_id],
                    "status": "FAIL",
                    "duration_seconds": round(time.perf_counter() - started, 3),
                    "error": f"{type(error).__name__}: {error}",
                    "traceback": traceback.format_exc(limit=8),
                }
            )
            return None

    def blocked(self, flow_id: str, reason: str) -> None:
        self.flows.append(
            {
                "id": flow_id,
                "title": FLOW_TITLES[flow_id],
                "status": "BLOCKED",
                "duration_seconds": 0,
                "reason": reason,
            }
        )

    def finalize_missing(self) -> None:
        recorded = {flow["id"] for flow in self.flows}
        for flow_id in FLOW_TITLES:
            if flow_id not in recorded:
                self.blocked(flow_id, "El recorrido anterior impidió alcanzar este punto.")
        self.flows.sort(key=lambda flow: flow["id"])

    def write(self) -> None:
        self.finalize_missing()
        REPORT_DIR.mkdir(parents=True, exist_ok=True)
        statuses = [flow["status"] for flow in self.flows]
        quality_failed = any(gate["status"] == "FAIL" for gate in self.quality_gates)
        overall = "FAIL" if "FAIL" in statuses or quality_failed else "PARTIAL" if "BLOCKED" in statuses else "PASS"
        payload = {
            "schema": "syka.world.e2e-report.v1",
            "overall": overall,
            "duration_seconds": round(time.time() - self.started_at, 3),
            "flows": self.flows,
            "metrics": self.metrics,
            "quality_gates": self.quality_gates,
            "notes": self.notes,
            "audits": {
                name: {
                    "console": audit.console,
                    "page_errors": audit.page_errors,
                    "bridge_requests": audit.bridge_requests,
                    "failed_responses": audit.failed_responses,
                }
                for name, audit in self.audits.items()
            },
        }
        REPORT_JSON.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
        REPORT_MD.write_text(render_markdown(payload), encoding="utf-8")


class ControlledBridge:
    """Same-origin route fixture for connection, event and method E2E checks."""

    def __init__(self) -> None:
        self._connected = True
        self.events: list[dict[str, Any]] = []
        self.requests: list[dict[str, Any]] = []
        self.counter = 0
        self.pending_route: Route | None = None

    @property
    def connected(self) -> bool:
        return self._connected

    @connected.setter
    def connected(self, value: bool) -> None:
        self._connected = value
        if not value and self.pending_route is not None:
            route, self.pending_route = self.pending_route, None
            route.fulfill(status=503, content_type="application/json", body='{"error":"controlled offline"}')

    def handler(self, route: Route, request: Request) -> None:
        self.requests.append(
            {"method": request.method, "url": request.url, "has_body": request.post_data is not None}
        )
        if request.method != "GET":
            route.fulfill(status=405, content_type="application/json", body='{"error":"GET only"}')
            return
        if not self.connected:
            route.fulfill(status=503, content_type="application/json", body='{"error":"controlled offline"}')
            return
        parsed = urlparse(request.url)
        if parsed.path.endswith("/api/world/state"):
            route.fulfill(status=200, content_type="application/json", body=json.dumps(self.state_payload()))
            return
        if parsed.path.endswith("/api/world/events"):
            query = parse_qs(parsed.query)
            if query.get("wait") == ["0"]:
                payload = {"schema": "syka.world.events.v1", "events": []}
            elif self.events:
                payload = {"schema": "syka.world.events.v1", "events": [self.events.pop(0)]}
            else:
                # Keep the controlled long-poll pending, just like the real
                # bridge. This avoids flooding Playwright's route dispatcher.
                if self.pending_route is not None:
                    stale, self.pending_route = self.pending_route, None
                    stale.fulfill(
                        status=200,
                        content_type="application/json",
                        body='{"schema":"syka.world.events.v1","events":[]}',
                    )
                self.pending_route = route
                return
            route.fulfill(status=200, content_type="application/json", body=json.dumps(payload))
            return
        route.fulfill(status=404, content_type="application/json", body='{"error":"unknown route"}')

    def queue_event(
        self,
        event_type: str,
        *,
        activity: str = "thinking",
        session_id: str = "qa-session",
        task_summary: str | None = None,
        tool_family: str | None = None,
        waiting_reason: str | None = None,
    ) -> str:
        self.counter += 1
        event_id = f"qa-event-{self.counter:03d}"
        event: dict[str, Any] = {
            "schema": "syka.world.event.v1",
            "event_id": event_id,
            "occurred_at": f"2026-07-16T12:00:{self.counter:02d}Z",
            "profile_id": "default",
            "session_id": session_id,
            "type": event_type,
            "source": "hermes-plugin",
            "activity": activity,
        }
        if task_summary is not None:
            event["task_summary"] = task_summary
        if tool_family is not None:
            event["tool_family"] = tool_family
        if waiting_reason is not None:
            event["waiting_reason"] = waiting_reason
        self.events.append(event)
        if self.pending_route is not None and self._connected:
            route, self.pending_route = self.pending_route, None
            queued = self.events.pop(0)
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({"schema": "syka.world.events.v1", "events": [queued]}),
            )
        return event_id

    def close(self) -> None:
        if self.pending_route is not None:
            route, self.pending_route = self.pending_route, None
            try:
                route.abort("aborted")
            except Exception:
                pass

    @staticmethod
    def state_payload() -> dict[str, Any]:
        characters = []
        for profile_id in ("default", "elen", "astrelis", "zerny"):
            characters.append(
                {
                    "profile_id": profile_id,
                    "character_id": profile_id,
                    "display_name": profile_id.title(),
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


def require(condition: bool, message: str) -> None:
    if not condition:
        raise VerificationError(message)


def wait_ready(page: Page, url: str) -> float:
    page.add_init_script(
        """(() => {
            window.__SYKA_E2E_READY_MS__ = null;
            const timer = setInterval(() => {
                const loading = document.querySelector('#loading-card');
                if (window.__SYKA_ALPHA_QA__ && loading?.classList.contains('is-hidden')) {
                    window.__SYKA_E2E_READY_MS__ = performance.now();
                    clearInterval(timer);
                }
            }, 10);
        })();"""
    )
    page.goto(url, wait_until="domcontentloaded", timeout=60_000)
    # Required by the webapp-testing skill. The bridge intentionally keeps a
    # long-poll open, so product-ready signals are authoritative after timeout.
    try:
        page.wait_for_load_state("networkidle", timeout=2_000)
    except PlaywrightTimeoutError:
        pass
    page.wait_for_selector(".syka-alpha-ui", state="visible", timeout=30_000)
    page.wait_for_function("() => Boolean(window.__SYKA_ALPHA_QA__)", timeout=30_000)
    page.wait_for_selector("#loading-card.is-hidden", timeout=30_000)
    page.wait_for_timeout(350)
    ready_milliseconds = page.evaluate("() => window.__SYKA_E2E_READY_MS__")
    require(isinstance(ready_milliseconds, (int, float)), "Product-ready timing was not captured")
    return round(ready_milliseconds / 1_000, 3)


def qa_call(page: Page, method: str, *args: Any) -> dict[str, Any]:
    result = page.evaluate(
        """({method, args}) => {
            const api = window.__SYKA_ALPHA_QA__;
            if (!api) throw new Error('QA API unavailable');
            return api[method](...args);
        }""",
        {"method": method, "args": list(args)},
    )
    require(isinstance(result, dict), f"{method} did not return an object")
    return result


def snapshot(page: Page) -> dict[str, Any]:
    return page.evaluate("() => window.__SYKA_ALPHA_QA__.getSnapshot()")


def wait_for_activity(page: Page, expected: str, timeout: int = 10_000) -> dict[str, Any]:
    page.wait_for_function(
        """expected => window.__SYKA_ALPHA_QA__?.getSnapshot().game.agents
            .find(agent => agent.id === 'syka')?.activity === expected""",
        arg=expected,
        timeout=timeout,
    )
    agent = next(agent for agent in snapshot(page)["game"]["agents"] if agent["id"] == "syka")
    return {
        "activity": agent["activity"],
        "presence": agent["presence"],
        "active_sessions": len(agent["activeSessions"]),
    }


def screenshot(page: Page, name: str) -> str:
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    target = SCREENSHOT_DIR / name
    # Returning bytes avoids an intermittent Playwright/Windows path writer
    # failure when refreshing an existing evidence image.
    target.write_bytes(page.screenshot(full_page=True))
    return str(target.relative_to(REPO_ROOT)).replace("\\", "/")


def canvas_screenshot_without_ui(page: Page, name: str) -> str:
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    target = SCREENSHOT_DIR / name
    page.evaluate("() => { document.querySelector('#game-ui').style.visibility = 'hidden'; }")
    try:
        page.wait_for_timeout(500)
        box = page.locator("canvas").bounding_box()
        require(box is not None, "Canvas unavailable for composited screenshot")
        # Page-level clipping uses Chromium's compositor. Direct canvas
        # readback intermittently produced black WebGL tiles on this machine.
        target.write_bytes(page.screenshot(clip=box))
    finally:
        page.evaluate("() => { document.querySelector('#game-ui').style.visibility = ''; }")
    return str(target.relative_to(REPO_ROOT)).replace("\\", "/")


def controlled_suite(browser: Browser, recorder: Recorder) -> tuple[ControlledBridge, BrowserAudit]:
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    bridge = ControlledBridge()
    context.route("**/bridge/api/world/**", bridge.handler)
    page = context.new_page()
    audit = BrowserAudit("controlled")
    audit.attach(page)
    recorder.audits["controlled"] = audit
    load_seconds = wait_ready(page, f"{BASE_URL}?qa=1")
    recorder.metrics["cold_ready_seconds_controlled"] = load_seconds

    shared: dict[str, Any] = {}

    def flow01() -> dict[str, Any]:
        state = snapshot(page)
        page.wait_for_function("() => window.__SYKA_ALPHA_QA__.getSnapshot().bridgeMode === 'online'")
        require(state["game"]["mode"] == "showcase", "Expected showcase mode")
        require(len(state["game"]["buildings"]) >= 9, "Showcase city does not contain the expected buildings")
        require(len(state["game"]["agents"]) == 4, "Expected four local agents")
        require(state["game"]["camera"]["scene"] == "city", "Expected exterior city scene")
        evidence = screenshot(page, "01-showcase-1440x900.png")
        return {
            "mode": state["game"]["mode"],
            "buildings": len(state["game"]["buildings"]),
            "agents": [agent["profileId"] for agent in state["game"]["agents"]],
            "bridge_mode": snapshot(page)["bridgeMode"],
            "evidence": evidence,
        }

    recorder.run("01", flow01)

    def flow02() -> dict[str, Any]:
        before = snapshot(page)["game"]["camera"]
        box = page.locator("canvas").bounding_box()
        require(box is not None, "Canvas has no visible bounding box")
        center_x = box["x"] + box["width"] * 0.52
        center_y = box["y"] + box["height"] * 0.52
        page.mouse.move(center_x, center_y)
        page.mouse.down()
        page.mouse.move(center_x + 110, center_y + 55, steps=8)
        page.mouse.up()
        page.wait_for_timeout(250)
        page.mouse.move(center_x, center_y)
        page.mouse.wheel(0, -500)
        page.wait_for_timeout(350)
        after = snapshot(page)["game"]["camera"]
        require(after["center"] != before["center"], f"Pan did not change camera center: {before} -> {after}")
        require(after["zoom"] != before["zoom"], f"Wheel did not change zoom: {before} -> {after}")
        require(after["zoom"] in (1, 1.5, 2), "Zoom escaped the approved fixed levels")
        require("rotation" not in after and set(after) <= {"center", "zoom", "scene", "interiorBuildingId", "cityViewBeforeInterior"}, "Camera exposes rotation")
        shared["exterior_camera"] = after
        return {"before": before, "after": after, "rotation_available": False}

    recorder.run("02", flow02)

    def flow03() -> dict[str, Any]:
        page.get_by_role("button", name="Pausar el tiempo").click()
        page.wait_for_function("() => window.__SYKA_ALPHA_QA__.getSnapshot().game.clock.speed === 0")
        targets = {"day": 600, "twilight": 1110, "night": 1320}
        periods: list[dict[str, Any]] = []
        for period, minute in targets.items():
            result = qa_call(page, "setPeriod", period)
            require(result.get("ok") is True, f"setPeriod({period}) failed: {result}")
            page.wait_for_timeout(250)
            current = snapshot(page)["game"]["clock"]["minuteOfDay"]
            require(current == minute, f"{period} expected minute {minute}, received {current}")
            periods.append(
                {
                    "period": period,
                    "minute": current,
                    "evidence": screenshot(page, f"03-{period}-1440x900.png"),
                }
            )
        # Explicit scale/toggle evidence and a clean street-furniture capture.
        require(qa_call(page, "setPeriod", "twilight").get("ok") is True, "Could not restore twilight for feedback evidence")
        box = page.locator("canvas").bounding_box()
        require(box is not None, "Canvas unavailable for feedback evidence")
        pointer_x = box["x"] + box["width"] / 2
        pointer_y = box["y"] + box["height"] / 2

        def set_zoom(target: float) -> None:
            for _ in range(4):
                current = snapshot(page)["game"]["camera"]["zoom"]
                if current == target:
                    return
                page.mouse.move(pointer_x, pointer_y)
                page.mouse.wheel(0, -500 if current < target else 500)
                page.wait_for_timeout(180)
            raise VerificationError(f"Could not reach zoom {target}")

        zoom_evidence: list[str] = []
        for target, suffix in ((1, "100"), (1.5, "150"), (2, "200")):
            set_zoom(target)
            page.wait_for_timeout(220)
            zoom_evidence.append(
                canvas_screenshot_without_ui(page, f"03-city-twilight-z{suffix}-agents-visible.png")
            )

        feedback_evidence = zoom_evidence[-1]
        page.get_by_role("button", name="Ocultar habitantes").click()
        page.wait_for_function("() => window.__SYKA_ALPHA_QA__.getSnapshot().game.agentsVisible === false")
        page.wait_for_timeout(250)
        agents_hidden_evidence = canvas_screenshot_without_ui(page, "03-city-twilight-z200-agents-hidden.png")
        page.get_by_role("button", name="Mostrar habitantes").click()
        page.wait_for_function("() => window.__SYKA_ALPHA_QA__.getSnapshot().game.agentsVisible === true")
        recorder.metrics["feedback_visual_evidence"] = feedback_evidence
        return {
            "periods": periods,
            "zoom_evidence": zoom_evidence,
            "agent_toggle_evidence": {
                "visible": feedback_evidence,
                "hidden": agents_hidden_evidence,
            },
            "evidence": [*zoom_evidence, agents_hidden_evidence],
        }

    recorder.run("03", flow03)

    def flow04() -> dict[str, Any]:
        state = snapshot(page)["game"]
        cafe = next(building for building in state["buildings"] if building["kind"] == "cafe" and building["status"] == "complete")
        result = qa_call(page, "selectBuilding", cafe["id"])
        require(result.get("ok") is True, f"Could not select cafe: {result}")
        page.get_by_role("heading", name="Café Biblioteca").wait_for(timeout=5_000)
        page.get_by_role("button", name="Entrar al Café Biblioteca").wait_for(timeout=5_000)
        shared["showcase_cafe_id"] = cafe["id"]
        shared["camera_before_interior"] = snapshot(page)["game"]["camera"]
        return {"building_id": cafe["id"], "status": cafe["status"], "inspector_visible": True}

    recorder.run("04", flow04)

    def flow05() -> dict[str, Any]:
        cafe_id = shared.get("showcase_cafe_id")
        if not cafe_id:
            cafe_id = next(building["id"] for building in snapshot(page)["game"]["buildings"] if building["kind"] == "cafe")
            require(qa_call(page, "selectBuilding", cafe_id).get("ok") is True, "Cafe selection fallback failed")
        page.get_by_role("button", name="Entrar al Café Biblioteca").click()
        page.wait_for_function("() => window.__SYKA_ALPHA_QA__.getSnapshot().game.camera.scene === 'interior'", timeout=10_000)
        page.wait_for_function("() => Boolean(window.__SYKA_INTERIOR__)", timeout=10_000)
        page.wait_for_function("() => window.__SYKA_ALPHA_QA__.metrics().activeScenes.includes('cafe-interior')", timeout=10_000)
        page.wait_for_timeout(350)
        state = snapshot(page)["game"]
        require(state["camera"].get("interiorBuildingId") == cafe_id, "Interior camera points to the wrong building")
        require(len(state["interiors"]) > 0, "Interior state is absent")
        return {
            "building_id": cafe_id,
            "camera": state["camera"],
            "evidence": screenshot(page, "05-cafe-interior-1440x900.png"),
        }

    recorder.run("05", flow05)

    def flow06() -> dict[str, Any]:
        if snapshot(page)["game"]["camera"]["scene"] != "interior":
            result = qa_call(page, "enterCafe", shared.get("showcase_cafe_id"))
            require(result.get("ok") is True, f"Could not enter cafe for decor check: {result}")
            page.wait_for_function("() => window.__SYKA_ALPHA_QA__.getSnapshot().game.camera.scene === 'interior'")
        option = page.locator("button.alpha-furniture-card:not([disabled])").first
        option.wait_for(timeout=5_000)
        slot_id = option.get_attribute("data-slot-id")
        furniture_id = option.get_attribute("data-furniture-id")
        require(bool(slot_id and furniture_id), "Optional furniture lacks stable data attributes")
        before = snapshot(page)["game"]
        option.click()
        page.wait_for_function(
            """({slotId, furnitureId}) => window.__SYKA_ALPHA_QA__.getSnapshot().game.interiors
                .some(interior => interior.furniture.some(item => item.slotId === slotId && item.furnitureId === furnitureId))""",
            arg={"slotId": slot_id, "furnitureId": furniture_id},
            timeout=5_000,
        )
        after = snapshot(page)["game"]
        require(after["economy"]["balance"] < before["economy"]["balance"], "Decoration purchase did not spend Lúmenes")
        page.wait_for_timeout(350)
        return {
            "slot_id": slot_id,
            "furniture_id": furniture_id,
            "balance_before": before["economy"]["balance"],
            "balance_after": after["economy"]["balance"],
            "evidence": screenshot(page, "06-cafe-decor-installed.png"),
        }

    recorder.run("06", flow06)

    def flow07() -> dict[str, Any]:
        if snapshot(page)["game"]["camera"]["scene"] != "interior":
            result = qa_call(page, "enterCafe", shared.get("showcase_cafe_id"))
            require(result.get("ok") is True, f"Interior setup failed: {result}")
        interior_camera = snapshot(page)["game"]["camera"]
        expected = interior_camera.get("cityViewBeforeInterior") or shared.get("camera_before_interior")
        page.get_by_role("button", name="Volver a la ciudad").first.click()
        page.wait_for_function("() => window.__SYKA_ALPHA_QA__.getSnapshot().game.camera.scene === 'city'", timeout=10_000)
        page.wait_for_function("() => window.__SYKA_ALPHA_QA__.metrics().activeScenes.includes('city')", timeout=10_000)
        page.wait_for_timeout(350)
        after = snapshot(page)["game"]["camera"]
        require(expected is not None, "No exterior camera was retained before interior transition")
        require(after["center"] == expected["center"], f"Camera center changed across interior: {expected} -> {after}")
        require(after["zoom"] == expected["zoom"], f"Camera zoom changed across interior: {expected} -> {after}")
        return {"before": expected, "after": after, "evidence": screenshot(page, "07-returned-city.png")}

    recorder.run("07", flow07)

    def flow08() -> dict[str, Any]:
        page.once("dialog", lambda dialog: dialog.accept())
        page.get_by_label("Tipo de partida").select_option("progressive")
        page.wait_for_function("() => window.__SYKA_ALPHA_QA__.getSnapshot().game.mode === 'progressive'", timeout=5_000)
        state = snapshot(page)["game"]
        require(len(state["buildings"]) == 1, f"Progressive start expected one building, got {len(state['buildings'])}")
        require(not any(building["kind"] == "cafe" for building in state["buildings"]), "New game already contains a cafe")
        require(state["economy"]["balance"] == 420, f"Unexpected starting balance: {state['economy']['balance']}")
        return {
            "mode": state["mode"],
            "balance": state["economy"]["balance"],
            "buildings": [building["id"] for building in state["buildings"]],
            "evidence": screenshot(page, "08-progressive-start.png"),
        }

    recorder.run("08", flow08)

    def flow09() -> dict[str, Any]:
        before = snapshot(page)["game"]
        result = qa_call(page, "placeBuilding", "cafe-library", 8, 4, "north")
        require(result.get("ok") is True, f"Cafe placement failed: {result}")
        after = snapshot(page)["game"]
        cafes = [building for building in after["buildings"] if building["kind"] == "cafe"]
        require(len(cafes) == 1, f"Expected one placed cafe, got {len(cafes)}")
        cafe = cafes[0]
        require(cafe["status"] == "foundation", f"New cafe should start at foundation, got {cafe['status']}")
        require(after["economy"]["balance"] == before["economy"]["balance"] - 240, "Cafe cost was not charged exactly once")
        shared["progressive_cafe_id"] = cafe["id"]
        return {
            "building_id": cafe["id"],
            "origin": cafe["origin"],
            "orientation": cafe["orientation"],
            "status": cafe["status"],
            "balance_before": before["economy"]["balance"],
            "balance_after": after["economy"]["balance"],
            "evidence": screenshot(page, "09-cafe-foundation.png"),
        }

    flow09_result = recorder.run("09", flow09)

    def flow10() -> dict[str, Any]:
        require(flow09_result is not None, "Placement did not succeed, so construction cannot be verified")
        cafe_id = shared["progressive_cafe_id"]
        step = qa_call(page, "advanceMinutes", 100)
        require(step.get("ok") is True, f"Construction advance failed: {step}")
        cafe = next(building for building in snapshot(page)["game"]["buildings"] if building["id"] == cafe_id)
        require(cafe["status"] == "framing", f"Expected framing after 100 minutes, got {cafe['status']}")
        page.wait_for_function("() => window.__SYKA_ALPHA_QA__.metrics().activeScenes.includes('city')", timeout=10_000)
        page.wait_for_timeout(500)
        framing_evidence = screenshot(page, "10-cafe-framing.png")
        finish = qa_call(page, "finishConstruction")
        require(finish.get("ok") is True, f"Finish construction failed: {finish}")
        state = snapshot(page)["game"]
        cafe = next(building for building in state["buildings"] if building["id"] == cafe_id)
        require(cafe["status"] == "complete", f"Cafe did not complete: {cafe['status']}")
        interior = next(item for item in state["interiors"] if item["buildingId"] == cafe_id)
        furniture = {item["furnitureId"] for item in interior["furniture"]}
        require({"bookcase", "fireplace", "cafe-counter"} <= furniture, f"Finished cafe is not fully furnished: {sorted(furniture)}")
        require(qa_call(page, "selectBuilding", cafe_id).get("ok") is True, "Could not select completed cafe")
        page.get_by_role("button", name="Entrar al Café Biblioteca").click()
        page.wait_for_function("() => window.__SYKA_ALPHA_QA__.getSnapshot().game.camera.scene === 'interior'", timeout=10_000)
        page.wait_for_function("() => Boolean(window.__SYKA_INTERIOR__)", timeout=10_000)
        page.wait_for_function("() => window.__SYKA_ALPHA_QA__.metrics().activeScenes.includes('cafe-interior')", timeout=10_000)
        page.wait_for_timeout(400)
        interior_evidence = screenshot(page, "10-completed-cafe-interior.png")
        page.get_by_role("button", name="Volver a la ciudad").first.click()
        page.wait_for_function("() => window.__SYKA_ALPHA_QA__.getSnapshot().game.camera.scene === 'city'", timeout=10_000)
        page.wait_for_function("() => window.__SYKA_ALPHA_QA__.metrics().activeScenes.includes('city')", timeout=10_000)
        page.wait_for_timeout(350)
        return {
            "building_id": cafe_id,
            "stages": ["foundation", "framing", "complete"],
            "default_furniture": sorted(furniture),
            "evidence": [framing_evidence, interior_evidence],
        }

    flow10_result = recorder.run("10", flow10)

    def flow11() -> dict[str, Any]:
        require(flow10_result is not None, "Completed progressive state is required for persistence check")
        # Persist a stable clock so the normal real-time simulation does not
        # legitimately advance a few minutes during the browser reload.
        page.get_by_role("button", name="Pausar el tiempo").click()
        page.wait_for_function("() => window.__SYKA_ALPHA_QA__.getSnapshot().game.clock.speed === 0")
        page.get_by_role("button", name="Guardar partida").click()
        page.wait_for_timeout(150)
        save_text = page.evaluate("() => localStorage.getItem('syka-world.alpha-v1.save')")
        require(isinstance(save_text, str) and '"schema":"syka.world.save.v1"' in save_text, "Versioned save is absent")
        before = snapshot(page)["game"]
        signature_before = state_signature(before)
        load_seconds = wait_ready(page, f"{BASE_URL}?qa=1")
        after = snapshot(page)["game"]
        signature_after = state_signature(after)
        recorder.metrics["warm_reload_ready_seconds"] = load_seconds
        # Isolate performance from screenshots, loading and transitions. Phaser
        # actualFps is an EMA, so sample only after a long idle stabilization.
        page.wait_for_timeout(8_000)
        performance_samples: list[dict[str, Any]] = []
        for _ in range(5):
            performance_samples.append(qa_call(page, "metrics"))
            page.wait_for_timeout(500)
        browser_raf_fps = page.evaluate(
            """() => new Promise(resolve => {
                let frames = 0;
                const start = performance.now();
                const tick = now => {
                    frames += 1;
                    if (now - start >= 2000) resolve(Math.round((frames * 100000) / (now - start)) / 100);
                    else requestAnimationFrame(tick);
                };
                requestAnimationFrame(tick);
            })"""
        )
        runtime_metrics = qa_call(page, "metrics")
        fps_values = sorted(float(item["actualFps"]) for item in performance_samples)
        frame_values = sorted(float(item["frameMilliseconds"]) for item in performance_samples)
        runtime_metrics["samples"] = performance_samples
        runtime_metrics["actualFpsMedian"] = fps_values[len(fps_values) // 2]
        runtime_metrics["actualFpsP10"] = fps_values[max(0, int((len(fps_values) - 1) * 0.1))]
        runtime_metrics["frameMillisecondsMedian"] = frame_values[len(frame_values) // 2]
        runtime_metrics["browserRafFps"] = browser_raf_fps
        recorder.metrics["runtime_after_reload"] = runtime_metrics
        require(signature_after == signature_before, f"State changed across reload: {signature_before} -> {signature_after}")
        return {
            "save_schema": "syka.world.save.v1",
            "signature_before": signature_before,
            "signature_after": signature_after,
            "ready_seconds": load_seconds,
            "evidence": screenshot(page, "11-after-reload.png"),
        }

    recorder.run("11", flow11)

    def flow12() -> dict[str, Any]:
        observed: list[dict[str, Any]] = []

        def emit(event_type: str, expected: str, **kwargs: Any) -> None:
            event_id = bridge.queue_event(event_type, **kwargs)
            state = wait_for_activity(page, expected)
            observed.append({"event_id": event_id, "event": event_type, "expected": expected, **state})

        balance_before = snapshot(page)["game"]["economy"]["balance"]
        emit("activity.started", "thinking", task_summary="Revisar tablero local")
        emit("tool.started", "using-tool", tool_family="code")
        emit("activity.waiting", "waiting", waiting_reason="approval")
        emit("activity.resumed", "using-tool")
        emit("tool.finished", "thinking")
        emit("activity.completed", "done")
        balance_after_completion = snapshot(page)["game"]["economy"]["balance"]
        require(balance_after_completion == balance_before + 5, "Hermes completion reward was not the expected moderate 5 L")
        emit("activity.settled", "idle")
        emit("activity.started", "thinking", session_id="qa-interrupted")
        emit("activity.interrupted", "interrupted", session_id="qa-interrupted")
        emit("activity.settled", "idle", session_id="qa-interrupted")
        emit("activity.started", "thinking", session_id="qa-failed")
        emit("activity.failed", "error", session_id="qa-failed")
        emit("activity.settled", "idle", session_id="qa-failed")
        emit("profile.offline", "offline", session_id="profile")
        emit("profile.online", "idle", session_id="profile")
        return {
            "observed": observed,
            "reward": balance_after_completion - balance_before,
            "network_methods": sorted({request["method"] for request in bridge.requests}),
        }

    recorder.run("12", flow12)

    def flow13() -> dict[str, Any]:
        bridge.connected = False
        page.wait_for_function("() => window.__SYKA_ALPHA_QA__.getSnapshot().bridgeMode === 'simulated'", timeout=10_000)
        disconnected = snapshot(page)["bridgeMode"]
        bridge.connected = True
        page.wait_for_function("() => window.__SYKA_ALPHA_QA__.getSnapshot().bridgeMode === 'online'", timeout=15_000)
        reconnected = snapshot(page)["bridgeMode"]
        methods = sorted({request["method"] for request in bridge.requests})
        bodies = [request for request in bridge.requests if request["has_body"]]
        require(methods == ["GET"], f"Controlled bridge used unsafe methods: {methods}")
        require(not bodies, "Controlled bridge GET carried a body")
        return {
            "connected_initial": "online",
            "disconnected_fallback": disconnected,
            "reconnected": reconnected,
            "request_count": len(bridge.requests),
            "methods": methods,
        }

    recorder.run("13", flow13)

    # This deliberately non-16:10 viewport reproduces the user's desktop shape.
    # The canvas must letterbox instead of stretching its fixed 720x450 world.
    page.set_viewport_size({"width": 1008, "height": 548})
    page.wait_for_timeout(200)
    canvas_box = page.locator("canvas").bounding_box()
    require(canvas_box is not None, "Responsive canvas has no visible bounding box")
    canvas_ratio = canvas_box["width"] / canvas_box["height"]
    require(abs(canvas_ratio - (720 / 450)) < 0.01, f"Canvas aspect ratio was distorted: {canvas_ratio}")
    recorder.metrics["small_viewport"] = {
        "width": 1008,
        "height": 548,
        "canvas_width": round(canvas_box["width"], 2),
        "canvas_height": round(canvas_box["height"], 2),
        "canvas_ratio": round(canvas_ratio, 4),
        "canvas_visible": page.locator("canvas").is_visible(),
        "ui_visible": page.locator(".syka-alpha-ui").is_visible(),
        "evidence": screenshot(page, "responsive-1008x548.png"),
    }
    bridge.close()
    context.close()
    return bridge, audit


def real_bridge_suite(browser: Browser, recorder: Recorder) -> None:
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    page = context.new_page()
    audit = BrowserAudit("real")
    audit.attach(page)
    recorder.audits["real"] = audit

    def flow14() -> dict[str, Any]:
        ready_seconds = wait_ready(page, f"{BASE_URL}?qa=1&bridge=real")
        try:
            page.wait_for_function(
                "() => ['online', 'degraded'].includes(window.__SYKA_ALPHA_QA__.getSnapshot().bridgeMode)",
                timeout=10_000,
            )
        except PlaywrightTimeoutError as error:
            raise VerificationError("El bridge real no respondió online/degraded durante la ventana de QA") from error
        state = snapshot(page)
        page.wait_for_timeout(500)
        requests = list(audit.bridge_requests)
        methods = sorted({request["method"] for request in requests})
        require(bool(requests), "No real bridge requests were observed")
        require(methods == ["GET"], f"Real bridge used non-read-only methods: {methods}")
        require(not any(request["has_body"] for request in requests), "A real bridge GET carried a body")
        # Privacy-safe evidence: never persist summaries or session identifiers.
        agents = [
            {
                "profile_id": agent["profileId"],
                "status": agent["status"],
                "presence": agent["presence"],
                "active_session_count": agent["activeSessionCount"],
            }
            for agent in state["bridge"]["agents"]
        ]
        return {
            "mode": state["bridgeMode"],
            "source": state["bridge"]["source"],
            "ready_seconds": ready_seconds,
            "methods": methods,
            "request_count": len(requests),
            "agents": agents,
            "tasks_started": 0,
        }

    recorder.run("14", flow14)
    context.close()


def state_signature(game: dict[str, Any]) -> dict[str, Any]:
    return {
        "mode": game["mode"],
        "balance": game["economy"]["balance"],
        "clock": {
            "day": game["clock"]["day"],
            "minuteOfDay": game["clock"]["minuteOfDay"],
            "totalMinutes": game["clock"]["totalMinutes"],
            "speed": game["clock"]["speed"],
        },
        "camera": game["camera"],
        "buildings": [
            {
                "id": item["id"],
                "definitionId": item["definitionId"],
                "status": item["status"],
                "level": item["level"],
                "origin": item["origin"],
                "orientation": item["orientation"],
            }
            for item in game["buildings"]
        ],
        "unlocked_sectors": sorted(sector["id"] for sector in game["map"]["sectors"] if sector["unlocked"]),
        "interiors": [
            {
                "buildingId": interior["buildingId"],
                "furniture": sorted(
                    (item["slotId"], item["furnitureId"]) for item in interior["furniture"]
                ),
            }
            for interior in game["interiors"]
        ],
    }


def render_markdown(report: dict[str, Any]) -> str:
    counts = {
        status: sum(flow["status"] == status for flow in report["flows"])
        for status in ("PASS", "FAIL", "BLOCKED")
    }
    lines = [
        "# Syka World Alpha v1 — informe E2E",
        "",
        f"Estado general: **{report['overall']}** — {counts['PASS']} PASS, {counts['FAIL']} FAIL, {counts['BLOCKED']} BLOCKED.",
        "",
        "Método: Chromium headless, Python Playwright y servidor temporal gestionado por `with_server.py`.",
        "El `networkidle` se intenta expresamente; la preparación final se determina por UI + API QA porque el bridge mantiene un GET long-poll abierto por diseño.",
        "",
        "## Flujos",
        "",
        "| # | Flujo | Estado | Evidencia / resultado |",
        "|---:|---|:---:|---|",
    ]
    for flow in report["flows"]:
        details = flow.get("details")
        if flow["status"] == "PASS":
            evidence = extract_evidence(details)
            result = evidence or concise_json(details)
        else:
            result = flow.get("error") or flow.get("reason") or "Sin detalle"
        lines.append(f"| {flow['id']} | {flow['title']} | **{flow['status']}** | {escape_cell(str(result))} |")

    lines.extend(["", "## Auditoría del bridge", ""])
    for name, audit in report["audits"].items():
        methods = sorted({request["method"] for request in audit["bridge_requests"]})
        bodies = sum(bool(request["has_body"]) for request in audit["bridge_requests"])
        lines.append(
            f"- `{name}`: {len(audit['bridge_requests'])} requests observadas; métodos `{methods}`; requests con body: `{bodies}`."
        )

    lines.extend(["", "## Gates adicionales", ""])
    for gate in report.get("quality_gates", []):
        lines.append(f"- **{gate['status']}** — {gate['name']}: {gate['details']}")

    lines.extend(["", "## Rendimiento observado", "", "```json", json.dumps(report["metrics"], indent=2, ensure_ascii=False), "```", ""])

    page_errors = [error for audit in report["audits"].values() for error in audit["page_errors"]]
    console_errors = [
        message
        for audit in report["audits"].values()
        for message in audit["console"]
        if message["type"] == "error"
        and "status of 503 (Service Unavailable)" not in message["text"]
    ]
    failed_responses = [
        response
        for name, audit in report["audits"].items()
        for response in audit["failed_responses"]
        if not (name == "controlled" and response["status"] == 503 and "/bridge/" in response["url"])
    ]
    lines.extend(
        [
            "## Higiene del navegador",
            "",
            f"- Page errors: `{len(page_errors)}`.",
            f"- Console errors: `{len(console_errors)}`.",
            f"- Respuestas HTTP fallidas: `{len(failed_responses)}`.",
            "- El 503 provocado deliberadamente para probar la desconexión controlada se conserva en el JSON pero no cuenta como error inesperado.",
            "- Las advertencias repetitivas del driver WebGL headless quedan conservadas en el JSON y no se reinterpretan como fallo funcional.",
            "",
            "## Límites",
            "",
            "- La prueba controlada intercepta únicamente `/bridge/api/world/*`; no representa una integración Hermes real.",
            "- La prueba real sólo observa estado/eventos mediante GET y nunca inicia tareas.",
            "- Los avatares siguen siendo placeholders provisionales según la definición de la alpha.",
            "",
        ]
    )
    return "\n".join(lines)


def extract_evidence(details: Any) -> str:
    if not isinstance(details, dict) or "evidence" not in details:
        return ""
    evidence = details["evidence"]
    if isinstance(evidence, list):
        return ", ".join(f"`{item}`" for item in evidence)
    return f"`{evidence}`"


def concise_json(value: Any) -> str:
    text = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return text if len(text) <= 180 else text[:177] + "..."


def escape_cell(value: str) -> str:
    return value.replace("|", "\\|").replace("\n", " ")


def add_hygiene_result(recorder: Recorder) -> None:
    page_errors = [error for audit in recorder.audits.values() for error in audit.page_errors]
    console_errors = [
        message
        for audit in recorder.audits.values()
        for message in audit.console
        if message["type"] == "error"
        and "status of 503 (Service Unavailable)" not in message["text"]
    ]
    failed_assets = [
        response
        for audit in recorder.audits.values()
        for response in audit.failed_responses
        if "/assets/" in response["url"]
    ]
    recorder.metrics["browser_hygiene"] = {
        "page_errors": page_errors,
        "console_errors": console_errors,
        "failed_asset_responses": failed_assets,
    }
    if page_errors or console_errors or failed_assets:
        recorder.notes.append(
            "La higiene del navegador no quedó limpia: revisar metrics.browser_hygiene; no se oculta como éxito."
        )
        recorder.quality_gates.append(
            {
                "name": "Higiene del navegador",
                "status": "FAIL",
                "details": f"{len(page_errors)} page errors, {len(console_errors)} console errors y {len(failed_assets)} assets HTTP fallidos.",
            }
        )
    else:
        recorder.quality_gates.append(
            {
                "name": "Higiene del navegador",
                "status": "PASS",
                "details": "Sin page errors, console errors inesperados ni assets HTTP fallidos.",
            }
        )


def add_performance_result(recorder: Recorder) -> None:
    runtime = recorder.metrics.get("runtime_after_reload")
    ready = recorder.metrics.get("warm_reload_ready_seconds")
    if not isinstance(runtime, dict) or not isinstance(ready, (int, float)):
        recorder.quality_gates.append(
            {
                "name": "Rendimiento alpha",
                "status": "BLOCKED",
                "details": "No hubo una medición completa después de recargar.",
            }
        )
        return
    fps = runtime.get("actualFpsMedian")
    fps_p10 = runtime.get("actualFpsP10")
    frame = runtime.get("frameMillisecondsMedian")
    raf_fps = runtime.get("browserRafFps")
    passed = (
        isinstance(fps, (int, float))
        and fps >= 55
        and isinstance(raf_fps, (int, float))
        and raf_fps >= 55
        and isinstance(frame, (int, float))
        and frame <= 20
        and ready < 3
    )
    recorder.quality_gates.append(
        {
            "name": "Rendimiento alpha",
            "status": "PASS" if passed else "FAIL",
            "details": f"mediana {fps} FPS Phaser, p10 {fps_p10}, {raf_fps} FPS RAF, mediana {frame} ms/frame y carga cálida product-ready en {ready} s.",
        }
    )


def main() -> int:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    recorder = Recorder()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            controlled_suite(browser, recorder)
            real_bridge_suite(browser, recorder)
        except Exception as error:
            recorder.notes.append(f"Fallo de infraestructura E2E: {type(error).__name__}: {error}")
            recorder.notes.append(traceback.format_exc(limit=10))
        finally:
            browser.close()
    add_hygiene_result(recorder)
    add_performance_result(recorder)
    recorder.write()
    report = json.loads(REPORT_JSON.read_text(encoding="utf-8"))
    print(json.dumps({"overall": report["overall"], "flows": report["flows"]}, ensure_ascii=False))
    return 1 if report["overall"] == "FAIL" else 0


if __name__ == "__main__":
    sys.exit(main())
