from __future__ import annotations

import json
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / ".runtime" / "visual-tour"


def capture(page, name: str) -> str:
    path = OUTPUT / name
    # Force a complete WebGL redraw. Without it, headless Edge can capture
    # stale compositor tiles as black rectangles after the first screenshot.
    page.set_viewport_size({"width": 1439, "height": 900})
    page.wait_for_timeout(120)
    page.set_viewport_size({"width": 1440, "height": 900})
    page.wait_for_timeout(700)
    page.screenshot(path=str(path), full_page=True)
    return str(path)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []
    captures: list[str] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, channel="msedge")
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.on(
            "console",
            lambda message: errors.append(f"console:{message.type}:{message.text}")
            if message.type == "error"
            else None,
        )
        page.on("pageerror", lambda error: errors.append(f"page:{error}"))
        page.goto("http://127.0.0.1:5173", wait_until="networkidle", timeout=30_000)
        page.wait_for_selector("#world")
        page.wait_for_timeout(1200)

        page.evaluate("window.__sykaVisualLab.setWorldMinutes(9 * 60 + 20)")
        captures.append(capture(page, "01-vista-general-dia.png"))

        page.evaluate(
            """
            window.__sykaVisualLab.setAgentState('syka', 'thinking');
            window.__sykaVisualLab.setAgentState('elen', 'using-tool');
            window.__sykaVisualLab.setAgentState('astrelis', 'waiting');
            window.__sykaVisualLab.setAgentState('zerny', 'done');
            window.__sykaVisualLab.inspectAgent('elen');
            """
        )
        captures.append(capture(page, "02-agentes-trabajando.png"))

        page.evaluate(
            """
            window.__sykaVisualLab.setWorldMinutes(21 * 60 + 15);
            window.__sykaVisualLab.setAgentState('elen', 'idle');
            window.__sykaVisualLab.inspectAgent('zerny');
            """
        )
        captures.append(capture(page, "03-ciudad-de-noche.png"))

        page.evaluate(
            """
            window.__sykaVisualLab.setWorldMinutes(15 * 60);
            window.__sykaVisualLab.inspectBuilding('marketing-studio');
            window.__sykaVisualLab.setCamera([22, 24, 18], [13, 2, -10], 1.35);
            """
        )
        captures.append(capture(page, "04-interior-estudio-elen.png"))
        browser.close()

    print(json.dumps({"ok": not errors, "errors": errors, "captures": captures}, ensure_ascii=False, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
