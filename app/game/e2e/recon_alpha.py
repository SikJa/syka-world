"""One-pass browser reconnaissance for the Syka World alpha.

Run through the webapp-testing `with_server.py` helper; this file intentionally
contains only Playwright browser logic.
"""

from __future__ import annotations

import json
from pathlib import Path

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:5173/?qa=1"
REPORT_DIR = Path(__file__).resolve().parents[3] / "reports" / "e2e" / "recon"


def main() -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    console_messages: list[dict[str, str]] = []
    page_errors: list[str] = []
    requests: list[dict[str, str]] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        page.on(
            "console",
            lambda message: console_messages.append(
                {"type": message.type, "text": message.text}
            ),
        )
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        page.on(
            "request",
            lambda request: requests.append(
                {"method": request.method, "url": request.url, "resource": request.resource_type}
            ),
        )

        response = page.goto(BASE_URL, wait_until="domcontentloaded", timeout=60_000)
        # The bridge intentionally keeps a long-poll GET open. We still attempt
        # the skill-prescribed network-idle wait, then fall back to product-ready
        # signals when the only blocker is that live read-only connection.
        try:
            page.wait_for_load_state("networkidle", timeout=2_000)
        except PlaywrightTimeoutError:
            pass
        page.wait_for_selector(".syka-alpha-ui", state="visible", timeout=30_000)
        page.wait_for_function("() => Boolean(window.__SYKA_ALPHA_QA__)", timeout=30_000)
        page.wait_for_selector("#loading-card.is-hidden", timeout=30_000)
        page.wait_for_timeout(1_500)
        page.screenshot(path=str(REPORT_DIR / "recon-alpha.png"), full_page=True)

        buttons = page.locator("button").evaluate_all(
            """els => els.map((el, index) => ({
                index,
                text: el.textContent?.replace(/\\s+/g, ' ').trim(),
                aria: el.getAttribute('aria-label'),
                title: el.getAttribute('title'),
                disabled: el.disabled,
                data: {...el.dataset},
                rect: (() => { const r = el.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; })()
            }))"""
        )
        summary = {
            "status": response.status if response else None,
            "title": page.title(),
            "url": page.url,
            "body_text": page.locator("body").inner_text(),
            "canvas": page.locator("canvas").evaluate(
                "el => { const r = el.getBoundingClientRect(); return {width:el.width,height:el.height,x:r.x,y:r.y,cssWidth:r.width,cssHeight:r.height}; }"
            ),
            "buttons": buttons,
            "selects": page.locator("select").evaluate_all(
                "els => els.map(el => ({aria: el.getAttribute('aria-label'), value:el.value, options:[...el.options].map(o => ({value:o.value,text:o.text}))}))"
            ),
            "globals": page.evaluate(
                """() => ({
                    Phaser: typeof window.Phaser,
                    games: window.Phaser?.GAMES?.length ?? null,
                    qa: Object.keys(window).filter(key => key.startsWith('__SYKA')),
                    storage: Object.keys(localStorage)
                })"""
            ),
            "console": console_messages,
            "page_errors": page_errors,
            "requests": requests,
        }
        (REPORT_DIR / "recon-alpha.json").write_text(
            json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        context.close()
        browser.close()


if __name__ == "__main__":
    main()
