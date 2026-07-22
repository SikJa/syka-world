"""Stable compositor-based recapture for WebGL evidence files."""

from __future__ import annotations

from pathlib import Path

from playwright.sync_api import sync_playwright

from alpha_v1_e2e import (
    BASE_URL,
    REPO_ROOT,
    SCREENSHOT_DIR,
    ControlledBridge,
    canvas_screenshot_without_ui,
    qa_call,
    snapshot,
    wait_ready,
)


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
        box = page.locator("canvas").bounding_box()
        assert box is not None
        px = box["x"] + box["width"] / 2
        py = box["y"] + box["height"] / 2

        for target, suffix in ((1, "100"), (1.5, "150"), (2, "200")):
            while snapshot(page)["game"]["camera"]["zoom"] != target:
                current = snapshot(page)["game"]["camera"]["zoom"]
                page.mouse.move(px, py)
                page.mouse.wheel(0, -500 if current < target else 500)
                page.wait_for_timeout(250)
            canvas_screenshot_without_ui(page, f"03-city-twilight-z{suffix}-agents-visible.png")

        page.get_by_role("button", name="Ocultar habitantes").click()
        page.wait_for_function("() => window.__SYKA_ALPHA_QA__.getSnapshot().game.agentsVisible === false")
        page.wait_for_timeout(1_000)
        canvas_screenshot_without_ui(page, "03-city-twilight-z200-agents-hidden.png")
        canvas_screenshot_without_ui(page, "03-city-twilight-z200-agents-hidden-retry.png")
        page.get_by_role("button", name="Mostrar habitantes").click()

        cafe = next(item for item in snapshot(page)["game"]["buildings"] if item["kind"] == "cafe")
        result = qa_call(page, "enterCafe", cafe["id"])
        assert result["ok"] is True
        page.wait_for_function("() => Boolean(window.__SYKA_INTERIOR__)")
        page.wait_for_function("() => window.__SYKA_ALPHA_QA__.metrics().activeScenes.includes('cafe-interior')")
        option = page.locator("button.alpha-furniture-card:not([disabled])").first
        option.click()
        page.wait_for_timeout(1_000)
        SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(SCREENSHOT_DIR / "06-cafe-decor-installed.png"), full_page=True)
        page.wait_for_timeout(500)
        page.screenshot(path=str(SCREENSHOT_DIR / "06-cafe-decor-installed-retry.png"), full_page=True)

        bridge.close()
        context.close()
        browser.close()


if __name__ == "__main__":
    main()
