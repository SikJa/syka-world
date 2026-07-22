from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[2]
BASE_URL = "http://127.0.0.1:5173"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Capture the Syka World visual gate package.")
    parser.add_argument("--cycle", type=int, default=2)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output = ROOT / "reports" / "visual-qa" / "gate-v1" / f"cycle-{args.cycle:02d}"
    output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
        console_errors: list[str] = []
        page_errors: list[str] = []
        page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        page.goto(BASE_URL, wait_until="networkidle")
        try:
            page.wait_for_function(
                "document.documentElement.dataset.sykaReady === 'true'", timeout=10_000
            )
        except Exception:
            page.screenshot(path=str(output / "gate-startup-failure.png"))
            (output / "startup-errors.txt").write_text(
                f"console_errors={console_errors}\npage_errors={page_errors}\n",
                encoding="utf-8",
            )
            raise

        capture_states: list[dict[str, object]] = []
        for period, hour in (("twilight", 19.25), ("night", 22.0)):
            for label, zoom in (("z100", 1.0), ("z150", 1.5), ("z200", 2.0)):
                page.evaluate(
                    """([hour, zoom]) => {
                        window.__SYKA_QA__.resetCamera();
                        window.__SYKA_QA__.setTime(hour);
                        window.__SYKA_QA__.setZoom(zoom);
                    }""",
                    [hour, zoom],
                )
                page.wait_for_timeout(250)
                filename = f"{period}-{label}-1440x900.png"
                page.screenshot(path=str(output / filename))
                capture_states.append({"file": filename, **page.evaluate("window.__SYKA_QA__.getState()")})

        page.evaluate("window.__SYKA_QA__.resetCamera(); window.__SYKA_QA__.setTime(19.25)")
        page.evaluate("window.__SYKA_QA__.setZoom(1.5)")
        canvas = page.locator("#game-canvas canvas")
        box = canvas.bounding_box()
        if box is None:
            raise RuntimeError("game canvas has no bounding box")
        start_x = box["x"] + box["width"] * 0.55
        start_y = box["y"] + box["height"] * 0.55
        page.mouse.move(start_x, start_y)
        page.mouse.down()
        pan_dir = output / "motion-pan-z150-frames"
        pan_dir.mkdir(exist_ok=True)
        for frame in range(12):
            ratio = (frame + 1) / 12
            page.mouse.move(start_x + 96 * ratio, start_y + 48 * ratio)
            page.wait_for_timeout(45)
            page.screenshot(path=str(pan_dir / f"frame-{frame + 1:02d}.png"))
        page.mouse.up()
        page.wait_for_timeout(250)
        page.screenshot(path=str(output / "gate-pan-after.png"))

        state = page.evaluate("window.__SYKA_QA__.getState()")
        (output / "browser-state.txt").write_text(
            f"state={state}\nconsole_errors={console_errors}\npage_errors={page_errors}\n",
            encoding="utf-8",
        )
        metadata = {
            "capturedAt": datetime.now(timezone.utc).isoformat(),
            "url": BASE_URL,
            "browser": "chromium",
            "browserVersion": browser.version,
            "viewportCssPixels": {"width": 1440, "height": 900},
            "devicePixelRatio": page.evaluate("window.devicePixelRatio"),
            "canvasLogicalPixels": {"width": 720, "height": 450},
            "cycle": args.cycle,
            "captures": capture_states,
            "panFinalState": state,
        }
        (output / "capture-metadata.json").write_text(
            json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        browser.close()

    if console_errors or page_errors:
        raise RuntimeError(f"browser errors: console={console_errors}; page={page_errors}")


if __name__ == "__main__":
    main()
