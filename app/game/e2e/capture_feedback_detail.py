"""Capture a canvas-only zoom-2 detail of the user's street feedback area."""

from __future__ import annotations

import json
from pathlib import Path

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


TARGET_CENTER = {"x": 12, "y": 14}
SCREENSHOT_NAME = "feedback-crossing-lamp-bench-grass-z200.png"
METADATA = REPO_ROOT / "reports" / "e2e" / "alpha-v1" / "feedback-detail-metadata.json"


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

        centers: list[dict[str, int]] = []
        for _ in range(10):
            camera = snapshot(page)["game"]["camera"]
            current = camera["center"]
            centers.append(dict(current))
            if current == TARGET_CENTER:
                break
            dx = TARGET_CENTER["x"] - current["x"]
            dy = TARGET_CENTER["y"] - current["y"]
            world_dx = (dx - dy) * 160
            world_dy = (dx + dy) * 80
            browser_dx = -world_dx * 2
            browser_dy = -world_dy * 2
            scale = min(1.0, 130 / max(1, abs(browser_dx), abs(browser_dy)))
            browser_dx *= scale
            browser_dy *= scale
            page.mouse.move(600, 600)
            page.mouse.down()
            page.mouse.move(600 + browser_dx, 600 + browser_dy, steps=8)
            page.mouse.up()
            page.wait_for_timeout(180)

        box = page.locator("canvas").bounding_box()
        assert box is not None
        while snapshot(page)["game"]["camera"]["zoom"] < 2:
            page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
            page.mouse.wheel(0, -500)
            page.wait_for_timeout(180)
        page.wait_for_timeout(400)
        evidence = canvas_screenshot_without_ui(page, SCREENSHOT_NAME)
        final_camera = snapshot(page)["game"]["camera"]
        METADATA.write_text(
            json.dumps(
                {
                    "target_center": TARGET_CENTER,
                    "visited_centers": centers,
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
