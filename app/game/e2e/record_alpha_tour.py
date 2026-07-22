"""Record a short, deterministic Alpha v1 city/interior tour."""

from __future__ import annotations

import os
from pathlib import Path

from playwright.sync_api import sync_playwright

from alpha_v1_e2e import (
    BASE_URL,
    REPO_ROOT,
    ControlledBridge,
    qa_call,
    snapshot,
    wait_ready,
)


VIDEO_TARGET = REPO_ROOT / "reports" / "e2e" / "alpha-v1" / "syka-world-alpha-tour.webm"


def main() -> None:
    base_url = os.environ.get("SYKA_E2E_BASE_URL", BASE_URL)
    VIDEO_TARGET.parent.mkdir(parents=True, exist_ok=True)
    recording_dir = VIDEO_TARGET.parent / ".recording"
    recording_dir.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            record_video_dir=str(recording_dir),
            record_video_size={"width": 1440, "height": 900},
        )
        bridge = ControlledBridge()
        context.route("**/bridge/api/world/**", bridge.handler)
        page = context.new_page()
        wait_ready(page, f"{base_url}?qa=1")

        page.get_by_role("button", name="Pause time").click()
        page.wait_for_function("() => window.__SYKA_ALPHA_QA__.getSnapshot().game.clock.speed === 0")
        qa_call(page, "setPeriod", "twilight")
        page.wait_for_timeout(1_500)

        canvas = page.locator("canvas")
        box = canvas.bounding_box()
        if box is None:
            raise RuntimeError("Canvas unavailable")
        center_x = box["x"] + box["width"] * 0.52
        center_y = box["y"] + box["height"] * 0.52
        page.mouse.move(center_x, center_y)
        page.mouse.down()
        page.mouse.move(center_x + 95, center_y + 45, steps=24)
        page.mouse.up()
        page.wait_for_timeout(700)
        page.mouse.move(center_x, center_y)
        page.mouse.wheel(0, -500)
        page.wait_for_timeout(1_600)

        cafe = next(
            building
            for building in snapshot(page)["game"]["buildings"]
            if building["kind"] == "cafe" and building["status"] == "complete"
        )
        qa_call(page, "selectBuilding", cafe["id"])
        page.get_by_role("button", name="Enter Cafe Library").wait_for(timeout=5_000)
        page.wait_for_timeout(1_000)
        page.get_by_role("button", name="Enter Cafe Library").click()
        page.wait_for_function(
            "() => window.__SYKA_ALPHA_QA__.getSnapshot().game.camera.scene === 'interior'",
            timeout=10_000,
        )
        page.wait_for_function("() => Boolean(window.__SYKA_INTERIOR__)", timeout=10_000)
        page.wait_for_timeout(2_000)

        optional_decor = page.locator("button.alpha-furniture-card:not([disabled])").first
        if optional_decor.count() > 0 and optional_decor.is_visible():
            optional_decor.click()
            page.wait_for_timeout(1_600)

        page.get_by_role("button", name="Back to town").first.click()
        page.wait_for_function(
            "() => window.__SYKA_ALPHA_QA__.getSnapshot().game.camera.scene === 'city'",
            timeout=10_000,
        )
        page.wait_for_timeout(1_800)

        video = page.video
        page.close()
        context.close()
        if video is None:
            raise RuntimeError("Playwright did not create a video")
        video.save_as(str(VIDEO_TARGET))
        bridge.close()
        browser.close()

    for artifact in recording_dir.glob("*"):
        artifact.unlink(missing_ok=True)
    recording_dir.rmdir()
    if not VIDEO_TARGET.exists() or VIDEO_TARGET.stat().st_size == 0:
        raise RuntimeError("Recorded video is empty")
    print(f"Recorded {VIDEO_TARGET} ({VIDEO_TARGET.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
