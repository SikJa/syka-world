"""Focused diagnostic for the café DOM click; run only through with_server.py."""

from __future__ import annotations

import json
from pathlib import Path

from playwright.sync_api import sync_playwright

from alpha_v1_e2e import BASE_URL, ControlledBridge, qa_call, snapshot, wait_ready


TARGET = Path(__file__).resolve().parents[3] / "reports" / "e2e" / "alpha-v1" / "cafe-click-debug.json"


def main() -> None:
    evidence: dict[str, object] = {}
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        bridge = ControlledBridge()
        context.route("**/bridge/api/world/**", bridge.handler)
        page = context.new_page()
        page_errors: list[str] = []
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        wait_ready(page, f"{BASE_URL}?qa=1")
        box = page.locator("canvas").bounding_box()
        assert box is not None
        x = box["x"] + box["width"] * 0.52
        y = box["y"] + box["height"] * 0.52
        page.mouse.move(x, y)
        page.mouse.down()
        page.mouse.move(x + 110, y + 55, steps=8)
        page.mouse.up()
        page.mouse.move(x, y)
        page.mouse.wheel(0, -500)
        page.get_by_role("button", name="Pausar el tiempo").click()
        for period in ("day", "twilight", "night"):
            qa_call(page, "setPeriod", period)
            page.screenshot(path=str(TARGET.with_name(f"debug-{period}.png")), full_page=True)
        cafe = next(item for item in snapshot(page)["game"]["buildings"] if item["kind"] == "cafe")
        evidence["select"] = qa_call(page, "selectBuilding", cafe["id"])
        button = page.get_by_role("button", name="Entrar al Café Biblioteca")
        button.wait_for()
        evidence["before"] = snapshot(page)["game"]["camera"]
        evidence["dom"] = button.evaluate(
            """el => {
                const r = el.getBoundingClientRect();
                const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
                return {
                    connected: el.isConnected,
                    disabled: el.disabled,
                    pointerEvents: getComputedStyle(el).pointerEvents,
                    rect: {x:r.x,y:r.y,width:r.width,height:r.height},
                    hitTag: hit?.tagName,
                    hitClass: hit?.className,
                    hitText: hit?.textContent?.replace(/\\s+/g, ' ').trim()
                };
            }"""
        )
        button.click()
        page.wait_for_timeout(1_000)
        evidence["after_playwright_click"] = snapshot(page)["game"]["camera"]
        evidence["toasts_after_playwright"] = page.locator(".alpha-toast").all_inner_texts()
        evidence["button_count_after"] = button.count()
        evidence["inspector_after"] = page.locator(".alpha-inspector__content").inner_text()
        evidence["body_scene_flags"] = page.evaluate(
            """() => ({
                qaScene: window.__SYKA_ALPHA_QA__.getSnapshot().game.camera.scene,
                interiorApi: Boolean(window.__SYKA_INTERIOR__),
                loadingHidden: document.querySelector('#loading-card')?.classList.contains('is-hidden')
            })"""
        )
        evidence["page_errors"] = page_errors
        bridge.close()
        context.close()
        browser.close()
    TARGET.write_text(json.dumps(evidence, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
