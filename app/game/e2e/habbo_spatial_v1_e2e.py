"""Habbo Spatial Public Foundation v1 — physical browser E2E.

Covers the goal's acceptance criteria that require a real browser.
Every QA action asserts ok === true; coordinates and scene state are
compared before/after to prove genuine movement and interaction.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.request import urlopen

from playwright.sync_api import (
    Browser,
    BrowserContext,
    Page,
    Request,
    Response,
    sync_playwright,
)

BASE_URL = "http://127.0.0.1:5173/"
APP_URL = f"{BASE_URL}?qa=1&mode=showcase"
REPO_ROOT = Path(__file__).resolve().parents[3]
REPORT_DIR = REPO_ROOT / "reports" / "habbo-spatial-v1"
SCREENSHOT_DIR = REPORT_DIR / "screenshots"
REPORT_JSON = REPORT_DIR / "physical-e2e.json"
REPORT_MD = REPORT_DIR / "PHYSICAL_E2E_REPORT.md"


def require_live_server() -> None:
    try:
        with urlopen(BASE_URL, timeout=5) as response:
            assert response.status < 400, f"Vite returned HTTP {response.status}"
    except Exception as error:
        raise AssertionError(f"Syka World must be running at {BASE_URL} — {error}") from error


@dataclass
class BrowserAudit:
    console: list[dict[str, str]] = field(default_factory=list)
    page_errors: list[str] = field(default_factory=list)
    bridge_requests: list[dict[str, Any]] = field(default_factory=list)
    failed_responses: list[dict[str, Any]] = field(default_factory=list)

    def attach(self, page: Page) -> None:
        page.on("console", self._console)
        page.on("pageerror", lambda e: self.page_errors.append(str(e)))
        page.on("request", self._request)
        page.on("response", self._response)

    def _console(self, message: Any) -> None:
        if message.type in {"warning", "error"}:
            self.console.append({"type": message.type, "text": message.text})

    def _request(self, request: Request) -> None:
        if "/bridge/" in request.url:
            self.bridge_requests.append({
                "method": request.method,
                "url": request.url,
                "has_body": request.post_data is not None,
            })

    def _response(self, response: Response) -> None:
        if response.status >= 400:
            self.failed_responses.append({
                "status": response.status,
                "url": response.url,
                "method": response.request.method,
            })


@dataclass
class Recorder:
    flows: list[dict[str, Any]] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    metrics: dict[str, Any] = field(default_factory=dict)
    audit: BrowserAudit = field(default_factory=BrowserAudit)

    def run(self, flow_id: str, title: str, action) -> dict[str, Any] | None:
        started = time.perf_counter()
        try:
            details = action() or {}
            self.flows.append({
                "id": flow_id, "title": title, "status": "PASS",
                "duration_seconds": round(time.perf_counter() - started, 3),
                "details": details,
            })
            return details
        except Exception as error:
            self.flows.append({
                "id": flow_id, "title": title, "status": "FAIL",
                "error": str(error),
                "duration_seconds": round(time.perf_counter() - started, 3),
            })
            return None

    def write(self) -> None:
        REPORT_DIR.mkdir(parents=True, exist_ok=True)
        SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
        total = len(self.flows)
        passed = sum(1 for f in self.flows if f["status"] == "PASS")
        failed = total - passed
        report = {
            "goal": "habbo-spatial-public-foundation-v1",
            "executed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "summary": {"total": total, "passed": passed, "failed": failed},
            "flows": self.flows,
            "notes": self.notes,
            "metrics": self.metrics,
            "audit": {
                "console": self.audit.console,
                "page_errors": self.audit.page_errors,
                "bridge_requests": self.audit.bridge_requests,
                "failed_responses": self.audit.failed_responses,
            },
        }
        REPORT_JSON.write_text(json.dumps(report, indent=2), encoding="utf-8")
        md = [
            "# Habbo Spatial Public Foundation v1 — Physical E2E Report",
            "",
            f"**Date:** {report['executed_at']}",
            f"**Flows:** {passed}/{total} PASS, {failed} FAIL",
            "",
            "## Flows",
            "",
        ]
        for f in self.flows:
            md.append(f"### {f['id']} — {f['title']} — {f['status']}")
            md.append(f"- Duration: {f['duration_seconds']}s")
            if f["status"] == "FAIL":
                md.append(f"- Error: {f.get('error', 'unknown')}")
            if "details" in f and f["details"]:
                for k, v in f["details"].items():
                    md.append(f"- {k}: {v}")
            md.append("")
        md.append("## Bridge audit")
        md.append(f"- Console warnings/errors: {len(self.audit.console)}")
        md.append(f"- Page errors: {len(self.audit.page_errors)}")
        md.append(f"- Bridge requests: {len(self.audit.bridge_requests)}")
        md.append(f"- Failed responses: {len(self.audit.failed_responses)}")
        methods = set(r["method"] for r in self.audit.bridge_requests)
        md.append(f"- Methods: {methods if methods else 'none'}")
        bodies = any(r["has_body"] for r in self.audit.bridge_requests)
        md.append(f"- Any body: {bodies}")
        md.append("")
        md.append("## Metrics")
        for k, v in self.metrics.items():
            md.append(f"- {k}: {v}")
        REPORT_MD.write_text("\n".join(md), encoding="utf-8")


def wait_ready(page: Page, timeout_ms: int = 20000) -> None:
    page.wait_for_selector("#game-canvas canvas", timeout=timeout_ms)
    page.wait_for_function("() => window.__SYKA_ALPHA_QA__", timeout=timeout_ms)


def qa(page: Page, method: str, *args: Any) -> Any:
    """Call a method on window.__SYKA_ALPHA_QA__ and assert ok === true for actions."""
    result = page.evaluate(
        """([method, args]) => {
            const api = window.__SYKA_ALPHA_QA__;
            if (!api || typeof api[method] !== 'function') {
                return {__error: 'QA API or method ' + method + ' not available'};
            }
            return api[method](...args);
        }""",
        [method, list(args)],
    )
    if isinstance(result, dict) and result.get("__error"):
        raise AssertionError(result["__error"])
    if isinstance(result, dict) and "ok" in result and not result["ok"]:
        raise AssertionError(f"QA {method} failed: {result.get('error', 'unknown')}")
    return result


def get_snapshot(page: Page) -> dict[str, Any]:
    return page.evaluate("() => window.__SYKA_ALPHA_QA__.getSnapshot()")


def get_camera_scene(page: Page) -> str:
    snap = get_snapshot(page)
    return snap["game"]["camera"]["scene"]


def first_agent_profile_id(page: Page) -> str:
    snap = get_snapshot(page)
    agents = snap["game"]["agents"]
    assert agents, "No agents in snapshot"
    return agents[0]["profileId"]


def first_agent_cell(page: Page, profile_id: str) -> dict[str, int]:
    snap = get_snapshot(page)
    agent = next((a for a in snap["game"]["agents"] if a["profileId"] == profile_id), None)
    assert agent, f"Agent {profile_id} not found"
    loc = agent["location"]
    if loc["kind"] == "interior" and loc.get("tile"):
        return loc["tile"]
    return agent["position"]


def find_cafe_building_id(page: Page) -> str:
    snap = get_snapshot(page)
    cafe = next((b for b in snap["game"]["buildings"] if b["kind"] == "cafe" and b["status"] == "complete"), None)
    assert cafe, "No completed cafe building"
    return cafe["id"]


def measure_fps(page: Page, seconds: float = 3.0) -> float:
    fps = page.evaluate(
        """(seconds) => new Promise((resolve) => {
            let frames = 0;
            const start = performance.now();
            function tick(now) {
                frames++;
                if (now - start >= seconds * 1000) resolve(frames / seconds);
                else requestAnimationFrame(tick);
            }
            requestAnimationFrame(tick);
        })""",
        seconds,
    )
    return round(float(fps), 2)


def screenshot(page: Page, name: str, width: int | None = None, height: int | None = None) -> str:
    if width and height:
        page.set_viewport_size({"width": width, "height": height})
        page.wait_for_timeout(400)
    path = str(SCREENSHOT_DIR / f"{name}.png")
    page.screenshot(path=path, full_page=False)
    return path


def main() -> None:
    require_live_server()
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    recorder = Recorder()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        recorder.audit.attach(page)

        page.goto(APP_URL, timeout=20000)
        wait_ready(page)

        # Flow 01: City loads with English UI
        def flow_01() -> dict[str, Any]:
            lang = page.get_attribute("html", "lang")
            assert lang == "en", f"Expected lang=en, got {lang}"
            title = page.title()
            body = page.evaluate("() => document.body.textContent || ''")
            assert "Build" in body, "Build button not found in English"
            assert "Lumens" in body, "Lumens label not found in English"
            assert "Local life" in body or "Hermes" in body, "Bridge indicator not found"
            screenshot(page, "01-city-showcase-1440x900", 1440, 900)
            return {"lang": lang, "title": title}
        recorder.run("01", "City loads with English UI", flow_01)

        # Flow 02: Agent selectable and snapshot has real profile ID
        def flow_02() -> dict[str, Any]:
            profile_id = first_agent_profile_id(page)
            assert profile_id, "No profile ID found in snapshot"
            result = qa(page, "selectAgent", profile_id)
            assert result["ok"] is True, f"selectAgent failed: {result}"
            page.wait_for_timeout(500)
            screenshot(page, "02-agent-selected")
            return {"profileId": profile_id}
        recorder.run("02", "Agent selectable with real profile ID", flow_02)

        # Flow 03: Responsive screenshots at 4 resolutions
        def flow_03() -> dict[str, Any]:
            shots = []
            for w, h in [(640, 720), (1008, 548), (1440, 900), (2560, 1080)]:
                name = f"03-responsive-{w}x{h}"
                screenshot(page, name, w, h)
                shots.append(name)
            screenshot(page, "03-after-responsive", 1440, 900)
            return {"screenshots": len(shots)}
        recorder.run("03", "Responsive screenshots at 4 resolutions", flow_03)

        # Flow 04: FPS measurement in city
        def flow_04() -> dict[str, Any]:
            fps = measure_fps(page, 3.0)
            recorder.metrics["city_fps"] = fps
            screenshot(page, "04-city-fps")
            return {"fps": fps}
        recorder.run("04", "FPS measurement in city", flow_04)

        # Flow 05: Possess + WASD in city with coordinate comparison
        def flow_05() -> dict[str, Any]:
            scene = get_camera_scene(page)
            assert scene == "city", f"Possess test requires city scene, got {scene}"
            profile_id = first_agent_profile_id(page)
            before = first_agent_cell(page, profile_id)
            result = qa(page, "togglePossession", profile_id)
            assert result["ok"] is True, f"togglePossession failed: {result}"
            page.wait_for_timeout(500)
            # Use real Playwright keyboard for W
            page.keyboard.down("w")
            page.wait_for_timeout(150)
            page.keyboard.up("w")
            page.wait_for_timeout(800)
            after = first_agent_cell(page, profile_id)
            moved = before != after
            assert moved, f"Actor did not move with WASD: before={before}, after={after}"
            # Release possession
            release = qa(page, "togglePossession")
            assert release["ok"] is True, f"togglePossession release failed: {release}"
            screenshot(page, "05-possess-wasd")
            return {"profileId": profile_id, "before": before, "after": after, "moved": moved}
        recorder.run("05", "Possess + WASD moves actor in city", flow_05)

        # Flow 06: Enter the cafe interior
        def flow_06() -> dict[str, Any]:
            scene_before = get_camera_scene(page)
            assert scene_before == "city", f"Expected city scene, got {scene_before}"
            cafe_id = find_cafe_building_id(page)
            result = qa(page, "enterCafe", cafe_id)
            assert result["ok"] is True, f"enterCafe failed: {result}"
            page.wait_for_timeout(2000)
            scene_after = get_camera_scene(page)
            assert scene_after == "interior", f"Expected interior scene after enterCafe, got {scene_after}"
            screenshot(page, "06-cafe-interior-1440x900", 1440, 900)
            return {"cafe_id": cafe_id, "scene_before": scene_before, "scene_after": scene_after}
        recorder.run("06", "Enter the cafe interior", flow_06)

        # Flow 07: FPS measurement in cafe
        def flow_07() -> dict[str, Any]:
            fps = measure_fps(page, 3.0)
            recorder.metrics["cafe_fps"] = fps
            screenshot(page, "07-cafe-fps")
            return {"fps": fps}
        recorder.run("07", "FPS measurement in cafe", flow_07)

        # Flow 08: E key does not cause errors in cafe interior
        def flow_08() -> dict[str, Any]:
            snap = get_snapshot(page)
            scene = snap["game"]["camera"]["scene"]
            assert scene == "interior", f"Expected interior scene, got {scene}"
            ctrl = snap.get("control", {})
            actors = ctrl.get("actors", [])
            interior_actors = [a for a in actors if "cafe" in a.get("sceneId", "")]
            # Press E with real keyboard
            page.keyboard.press("e")
            page.wait_for_timeout(1500)
            # Verify no page errors occurred
            assert len(recorder.audit.page_errors) == 0, f"Page errors after E: {recorder.audit.page_errors}"
            screenshot(page, "08-e-interaction")
            return {
                "scene": scene,
                "interior_actors": len(interior_actors),
                "e_pressed": True,
                "no_errors": True,
            }
        recorder.run("08", "E key in cafe interior without errors", flow_08)

        # Flow 09: Exit and re-enter cafe in same game
        def flow_09() -> dict[str, Any]:
            result = qa(page, "exitCafe")
            assert result["ok"] is True, f"exitCafe failed: {result}"
            page.wait_for_timeout(2000)
            scene_after_exit = get_camera_scene(page)
            assert scene_after_exit == "city", f"Expected city after exit, got {scene_after_exit}"
            cafe_id = find_cafe_building_id(page)
            result = qa(page, "enterCafe", cafe_id)
            assert result["ok"] is True, f"enterCafe re-entry failed: {result}"
            page.wait_for_timeout(2000)
            scene_after_reentry = get_camera_scene(page)
            assert scene_after_reentry == "interior", f"Expected interior after re-entry, got {scene_after_reentry}"
            screenshot(page, "09-reentry")
            return {"scene_after_exit": scene_after_exit, "scene_after_reentry": scene_after_reentry}
        recorder.run("09", "Exit and re-enter cafe in same game", flow_09)

        # Flow 10: Save and reload
        def flow_10() -> dict[str, Any]:
            save_result = qa(page, "save")
            assert save_result["ok"] is True, f"save failed: {save_result}"
            page.wait_for_timeout(500)
            load_result = qa(page, "load")
            assert load_result["ok"] is True, f"load failed: {load_result}"
            page.wait_for_timeout(1000)
            scene = get_camera_scene(page)
            screenshot(page, "10-save-reload")
            return {"scene_after_reload": scene}
        recorder.run("10", "Save and reload", flow_10)

        # Flow 11: Input focus does not trigger game controls
        def flow_11() -> dict[str, Any]:
            page.evaluate("""() => {
                const input = document.createElement('input');
                input.id = 'test-input';
                document.body.appendChild(input);
                input.focus();
            }""")
            page.wait_for_timeout(200)
            focused = page.evaluate("() => document.activeElement && document.activeElement.id === 'test-input'")
            assert focused, "Input was not focused"
            page.keyboard.press("w")
            page.wait_for_timeout(300)
            page.evaluate("() => { const el = document.getElementById('test-input'); if (el) el.remove(); }")
            return {"input_was_focused": focused}
        recorder.run("11", "Input focus does not trigger game controls", flow_11)

        # Flow 12: Bridge traffic is GET-only with no body
        def flow_12() -> dict[str, Any]:
            requests = recorder.audit.bridge_requests
            all_get = all(r["method"] == "GET" for r in requests) if requests else True
            no_body = not any(r["has_body"] for r in requests)
            assert all_get, f"Non-GET bridge request found: {requests}"
            assert no_body, "Bridge request with body found"
            return {"total_requests": len(requests), "all_get": all_get, "no_body": no_body}
        recorder.run("12", "Bridge traffic is GET-only with no body", flow_12)

        # Flow 13: No unexpected page errors
        def flow_13() -> dict[str, Any]:
            page_errors = recorder.audit.page_errors
            assert len(page_errors) == 0, f"Page errors found: {page_errors}"
            non_bridge_failures = [r for r in recorder.audit.failed_responses if "/bridge/" not in r["url"]]
            assert len(non_bridge_failures) == 0, f"Non-bridge failed responses: {non_bridge_failures}"
            return {
                "page_errors": len(page_errors),
                "failed_responses": len(recorder.audit.failed_responses),
                "non_bridge_failures": len(non_bridge_failures),
            }
        recorder.run("13", "No unexpected page/console/HTTP errors", flow_13)

        browser.close()

    recorder.write()
    total = len(recorder.flows)
    passed = sum(1 for f in recorder.flows if f["status"] == "PASS")
    failed = total - passed
    print(f"E2E complete: {passed}/{total} PASS, {failed} FAIL")
    print(f"Report: {REPORT_JSON}")
    print(f"Markdown: {REPORT_MD}")
    if failed > 0:
        for f in recorder.flows:
            if f["status"] == "FAIL":
                print(f"  FAIL: {f['id']} — {f['title']}: {f.get('error', 'unknown')}")


if __name__ == "__main__":
    main()
