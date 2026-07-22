"""Record the verified 20-second Syka World possession walkthrough."""

from __future__ import annotations

import time
from pathlib import Path

from playwright.sync_api import sync_playwright

from alpha_v1_e2e import ControlledBridge, qa_call, require
from interior_entity_possession_v1_e2e import (
    BASE_URL,
    REPO_ROOT,
    choose_cafe_floor_target,
    control_actor,
    instrument_document,
    physical_cafe_click,
    valid_wasd_step,
    wait_actor_at,
    wait_ready,
)


REPORT_DIR = REPO_ROOT / "reports" / "interior-entity-possession-v1"
RAW_VIDEO = REPORT_DIR / "syka-world-possession-pass-v1-raw.webm"


def main() -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    raw_dir = REPORT_DIR / ".video-raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    url = f"{BASE_URL}?qa=1&mode=showcase"
    bridge = ControlledBridge()

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            record_video_dir=str(raw_dir),
            record_video_size={"width": 1440, "height": 900},
        )
        instrument_document(context, url)
        context.route("**/bridge/api/world/**", bridge.handler)
        page = context.new_page()
        wait_ready(page, url)
        require(qa_call(page, "reset", "showcase").get("ok") is True, "Showcase reset failed")
        page.wait_for_function("() => window.__SYKA_ALPHA_QA__.getSnapshot().control.sceneId === 'city'")
        started = time.monotonic()

        page.locator('.alpha-agent-card[data-profile-id="default"]').click()
        page.wait_for_timeout(550)

        _click_key, city_target = valid_wasd_step(page)
        require(
            qa_call(page, "clickMove", "city", city_target["x"], city_target["y"]).get("ok") is True,
            "City click route failed",
        )
        wait_actor_at(page, city_target)
        page.wait_for_timeout(450)

        page.locator('[data-agent-action="possess"]').click()
        page.wait_for_function(
            "() => window.__SYKA_ALPHA_QA__.getSnapshot().control.possessedProfileId === 'default'"
        )
        for _ in range(2):
            key, expected = valid_wasd_step(page)
            page.keyboard.press(key.upper())
            wait_actor_at(page, expected)
            page.wait_for_timeout(350)

        page.keyboard.press("P")
        page.wait_for_function("() => !window.__SYKA_ALPHA_QA__.getSnapshot().control.possessedProfileId")
        cafe = next(
            item for item in qa_call_snapshot(page)["game"]["buildings"]
            if item["kind"] == "cafe" and item["status"] == "complete"
        )
        approached = {"ok": False}
        for _ in range(20):
            approached = qa_call(
                page,
                "clickMove",
                "city",
                cafe["accessTile"]["x"],
                cafe["accessTile"]["y"],
            )
            if approached.get("ok") is True:
                break
            page.wait_for_timeout(500)
        require(approached.get("ok") is True, "Could not route to Café Biblioteca")
        wait_actor_at(page, cafe["accessTile"], timeout=30_000)
        page.keyboard.press("P")
        page.keyboard.press("F")
        page.wait_for_function(
            "() => window.__SYKA_ALPHA_QA__.getSnapshot().game.camera.scene === 'interior'",
            timeout=10_000,
        )
        page.wait_for_function("() => Boolean(window.__SYKA_INTERIOR__)", timeout=10_000)
        page.wait_for_timeout(650)

        page.keyboard.press("Escape")
        page.wait_for_function("() => !window.__SYKA_ALPHA_QA__.getSnapshot().control.possessedProfileId")
        floor_target = choose_cafe_floor_target(page)
        physical_cafe_click(page, floor_target)
        wait_actor_at(page, floor_target, timeout=20_000)

        seat = {"x": 22, "y": 11}
        scene_id = qa_call_snapshot(page)["control"]["sceneId"]
        require(qa_call(page, "clickMove", scene_id, seat["x"], seat["y"]).get("ok") is True, "Seat route failed")
        wait_actor_at(page, seat, timeout=20_000)
        page.keyboard.press("E")
        page.wait_for_function(
            """() => window.__SYKA_ALPHA_QA__.getSnapshot().game.agents
              .find(agent => agent.profileId === 'default')?.location?.action === 'sit'""",
            timeout=5_000,
        )
        page.wait_for_timeout(850)

        entry = {"x": 16, "y": 17}
        require(qa_call(page, "clickMove", scene_id, entry["x"], entry["y"]).get("ok") is True, "Exit route failed")
        wait_actor_at(page, entry, timeout=20_000)
        page.keyboard.press("F")
        page.wait_for_function(
            "() => window.__SYKA_ALPHA_QA__.getSnapshot().game.camera.scene === 'city'",
            timeout=10_000,
        )

        elapsed = time.monotonic() - started
        if elapsed < 20.25:
            page.wait_for_timeout(round((20.25 - elapsed) * 1_000))
        video = page.video
        page.close()
        context.close()
        require(video is not None, "Playwright did not create a video")
        video.save_as(str(RAW_VIDEO))
        bridge.close()
        browser.close()

    print(f"RAW_VIDEO: {RAW_VIDEO}")


def qa_call_snapshot(page):
    return page.evaluate("() => window.__SYKA_ALPHA_QA__.getSnapshot()")


if __name__ == "__main__":
    main()
