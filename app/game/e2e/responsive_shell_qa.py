from __future__ import annotations

import json
from pathlib import Path

from playwright.sync_api import sync_playwright


PROJECT_ROOT = Path(__file__).resolve().parents[3]
OUTPUT = PROJECT_ROOT / "reports" / "e2e" / "ui-shell-v2"
OUTPUT.mkdir(parents=True, exist_ok=True)

VIEWPORTS = (
    (1008, 548, 828, "compact"),
    (1440, 900, 720, "standard"),
    (2560, 1080, 1066, "ultrawide"),
)


def intersects(left: dict[str, float] | None, right: dict[str, float] | None) -> bool:
    if not left or not right:
        return False
    return not (
        left["x"] + left["width"] <= right["x"]
        or right["x"] + right["width"] <= left["x"]
        or left["y"] + left["height"] <= right["y"]
        or right["y"] + right["height"] <= left["y"]
    )


def inside(box: dict[str, float] | None, width: int, height: int) -> bool:
    if not box:
        return False
    tolerance = 1.5
    return (
        box["x"] >= -tolerance
        and box["y"] >= -tolerance
        and box["x"] + box["width"] <= width + tolerance
        and box["y"] + box["height"] <= height + tolerance
    )


def main() -> None:
    results: list[dict[str, object]] = []
    failures: list[str] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        for width, height, expected_logical_width, label in VIEWPORTS:
            page = browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=1)
            console_errors: list[str] = []
            page_errors: list[str] = []
            page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
            page.on("pageerror", lambda error: page_errors.append(str(error)))
            page.goto("http://127.0.0.1:5173/", wait_until="domcontentloaded")
            try:
                page.wait_for_load_state("networkidle", timeout=3_000)
            except Exception:
                # The bridge intentionally keeps a GET long-poll open.
                pass
            page.wait_for_selector(".syka-alpha-ui", state="visible")
            page.wait_for_function("document.querySelector('#loading-card')?.classList.contains('is-hidden')")
            page.wait_for_timeout(600)

            selectors = {
                "canvas": "#game-canvas canvas",
                "topbar": ".alpha-topbar",
                "palette": ".alpha-palette",
                "inspector": ".alpha-inspector",
                "agents": ".alpha-agent-strip",
                "actions": ".alpha-action-rail",
            }
            boxes = {name: page.locator(selector).bounding_box() for name, selector in selectors.items()}
            canvas_attributes = page.locator(selectors["canvas"]).evaluate(
                "element => ({ width: element.width, height: element.height })"
            )
            canvas = boxes["canvas"]
            canvas_fills_viewport = bool(
                canvas
                and abs(canvas["x"]) <= 1.5
                and abs(canvas["y"]) <= 1.5
                and abs(canvas["width"] - width) <= 2
                and abs(canvas["height"] - height) <= 2
            )
            all_ui_inside = all(inside(boxes[name], width, height) for name in ("topbar", "palette", "inspector", "agents", "actions"))
            collision_free = not any(
                (
                    intersects(boxes["topbar"], boxes["palette"]),
                    intersects(boxes["topbar"], boxes["inspector"]),
                    intersects(boxes["agents"], boxes["actions"]),
                    intersects(boxes["palette"], boxes["agents"]),
                    intersects(boxes["inspector"], boxes["actions"]),
                )
            )
            logical_size_ok = canvas_attributes == {"width": expected_logical_width, "height": 450}
            passed = all(
                (
                    canvas_fills_viewport,
                    all_ui_inside,
                    collision_free,
                    logical_size_ok,
                    not page_errors,
                    not console_errors,
                )
            )
            screenshot = OUTPUT / f"shell-{label}-{width}x{height}.png"
            page.screenshot(path=str(screenshot), full_page=True)

            page.locator(".alpha-agent-card").first.click()
            page.wait_for_selector(".alpha-agent-detail__phase", state="visible")
            selected_inspector = page.locator(".alpha-inspector").bounding_box()
            selected_inside = inside(selected_inspector, width, height)
            selected_collision_free = not intersects(selected_inspector, boxes["actions"])
            selected_screenshot = OUTPUT / f"shell-{label}-{width}x{height}-agent-selected.png"
            page.screenshot(path=str(selected_screenshot), full_page=True)
            passed = passed and selected_inside and selected_collision_free
            result = {
                "label": label,
                "viewport": {"width": width, "height": height},
                "logical_canvas": canvas_attributes,
                "expected_logical_width": expected_logical_width,
                "canvas_fills_viewport": canvas_fills_viewport,
                "all_ui_inside": all_ui_inside,
                "collision_free": collision_free,
                "page_errors": page_errors,
                "console_errors": console_errors,
                "boxes": boxes,
                "screenshot": str(screenshot.relative_to(PROJECT_ROOT)).replace("\\", "/"),
                "selected_agent_inspector": {
                    "inside": selected_inside,
                    "collision_free": selected_collision_free,
                    "box": selected_inspector,
                    "screenshot": str(selected_screenshot.relative_to(PROJECT_ROOT)).replace("\\", "/"),
                },
                "status": "PASS" if passed else "FAIL",
            }
            results.append(result)
            if not passed:
                failures.append(label)
            page.close()
        browser.close()

    report = {"status": "PASS" if not failures else "FAIL", "failures": failures, "viewports": results}
    (OUTPUT / "responsive-shell-qa.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
