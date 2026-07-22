from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
SCREENSHOT = ROOT / ".runtime" / "visual-lab-qa.png"


def main() -> int:
    errors: list[str] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, channel="msedge")
        page = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
        page.on("console", lambda message: errors.append(f"console:{message.type}:{message.text}") if message.type == "error" else None)
        page.on("pageerror", lambda error: errors.append(f"page:{error}"))
        page.goto("http://127.0.0.1:5173", wait_until="networkidle", timeout=30_000)
        page.wait_for_selector("#world")
        page.wait_for_timeout(1800)

        assert page.locator("#world").bounding_box()["width"] == 1440
        assert page.get_by_role("heading", name="Syka World").is_visible()
        assert page.locator("#inspector").evaluate("node => node.classList.contains('open')")
        perf_text = page.locator("#perf").text_content() or ""
        assert "fps" in perf_text.lower()

        page.locator("#sequence-button").click()
        page.wait_for_timeout(350)
        page.locator('[data-agent="elen"]').click()
        assert page.locator("#inspect-name").inner_text() == "Elen"
        assert page.locator("#inspect-state").inner_text() == "Pensando"

        represented = page.evaluate(
            """
            () => window.__sykaVisualLab.stateNames.map((state) => {
              window.__sykaVisualLab.setAgentState('elen', state);
              return {state, label: document.querySelector('#inspect-state').textContent};
            })
            """
        )
        assert [item["state"] for item in represented] == [
            "idle", "thinking", "using-tool", "waiting", "done", "interrupted", "error", "offline"
        ]
        assert all(item["label"] for item in represented)

        if os.environ.get("SYKA_QA_BRIDGE") == "1":
            page.locator("#data-button").click()
            page.wait_for_function(
                "document.querySelector('#data-label').textContent === 'Bridge'", timeout=5_000
            )
            assert "lectura" in page.locator("#toast").inner_text().lower()
            page.locator("#data-button").click()
            page.wait_for_function(
                "document.querySelector('#data-label').textContent === 'Simulado'", timeout=5_000
            )

        page.locator("#time-toggle").click()
        paused_clock = page.locator("#clock").inner_text()
        page.wait_for_timeout(500)
        assert page.locator("#clock").inner_text() == paused_clock
        page.locator("#time-toggle").click()

        page.locator("#reset-button").click()
        assert page.locator("#toast").inner_text() == "Vista centrada"
        SCREENSHOT.parent.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(SCREENSHOT), full_page=True)

        metrics = page.evaluate(
            """
            () => ({
              resources: performance.getEntriesByType('resource').length,
              domNodes: document.querySelectorAll('*').length,
              canvas: { width: world.width, height: world.height },
              perfLabel: document.querySelector('#perf').textContent,
              clock: document.querySelector('#clock').textContent,
              representedStates: window.__sykaVisualLab.stateNames,
              loadMs: Math.round(performance.getEntriesByType('navigation')[0]?.loadEventEnd || 0),
              jsHeapMiB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576 * 10) / 10 : null,
            })
            """
        )
        browser.close()

    result = {"ok": not errors, "errors": errors, "metrics": metrics, "screenshot": str(SCREENSHOT)}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
