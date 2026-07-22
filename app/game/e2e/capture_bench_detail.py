"""Capture an isolated zoom-2 bench/grass detail using the QA camera hooks."""

from __future__ import annotations

import json

from playwright.sync_api import sync_playwright

from alpha_v1_e2e import (
    BASE_URL,
    REPO_ROOT,
    ControlledBridge,
    canvas_screenshot_without_ui,
    qa_call,
    snapshot,
    wait_ready,
)


SCREENSHOT_NAME = "feedback-bench-grass-z200.png"
METADATA = REPO_ROOT / "reports" / "e2e" / "alpha-v1" / "feedback-bench-metadata.json"


def main() -> None:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        bridge = ControlledBridge()
        context.route("**/bridge/api/world/**", bridge.handler)
        page = context.new_page()
        wait_ready(page, f"{BASE_URL}?qa=1")
        page.get_by_role("button", name="Pausar el tiempo").click()
        qa_call(page, "setPeriod", "twilight")

        bench = page.evaluate(
            """async () => {
                const module = await import('/src/presentation/city/decor.ts');
                const qa = window.__SYKA_ALPHA_QA__;
                const plan = module.createCityDecorPlan(qa.getSnapshot().game.map);
                const benches = plan.streetFurniture.filter(entry => entry.frame === 'bench');
                const size = qa.getSnapshot().game.map.size;
                const margin = entry => Math.min(
                    entry.hostTile.x,
                    entry.hostTile.y,
                    size.width - 1 - entry.hostTile.x,
                    size.height - 1 - entry.hostTile.y,
                );
                const item = [...benches].sort((left, right) => margin(right) - margin(left))[0];
                if (!item) throw new Error('No bench exists in the city decor plan');
                const focus = qa.focusGrid(item.hostTile.x, item.hostTile.y);
                const zoom = qa.setZoom(2);
                return { item, candidates: benches, mapSize: size, focus, zoom };
            }"""
        )
        page.wait_for_timeout(900)
        evidence = canvas_screenshot_without_ui(page, SCREENSHOT_NAME)
        final_camera = snapshot(page)["game"]["camera"]
        METADATA.write_text(
            json.dumps(
                {
                    "bench": bench,
                    "final_camera": final_camera,
                    "period": "twilight",
                    "evidence": evidence,
                },
                indent=2,
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
        bridge.close()
        context.close()
        browser.close()


if __name__ == "__main__":
    main()
