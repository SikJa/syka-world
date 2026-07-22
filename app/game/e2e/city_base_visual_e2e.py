import json
from pathlib import Path

from playwright.sync_api import sync_playwright
from final_browser_e2e import instrument_document


OUTPUT = Path(__file__).resolve().parents[3] / "reports" / "e2e" / "city-base"
OUTPUT.mkdir(parents=True, exist_ok=True)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    results = []
    for width, height in ((1440, 900), (1008, 548), (640, 720)):
        context = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=1)
        instrument_document(context)
        page = context.new_page()
        errors: list[str] = []
        page.on("pageerror", lambda error, errors=errors: errors.append(str(error)))
        page.goto("http://127.0.0.1:5173?qa=1", wait_until="domcontentloaded")
        page.wait_for_function("() => Boolean(window.__SYKA_ALPHA_QA__ && window.__SYKA_E2E_GAME__)")
        transit = None
        npc_views = None
        if width == 1440:
            transit = page.evaluate(
                """() => {
                  const qa = window.__SYKA_ALPHA_QA__;
                  for (let minute = 0; minute < 400; minute += 1) {
                    const npc = qa.getSnapshot().game.npcs.find(
                      candidate => candidate.location.kind === 'transit' && candidate.location.path.length > 6,
                    );
                    if (npc) return {
                      id: npc.id,
                      name: npc.name,
                      direction: npc.location.direction,
                      tile: npc.location.tile,
                      destination: npc.location.destination,
                      pathLength: npc.location.path.length,
                      minuteOfDay: qa.getSnapshot().game.clock.minuteOfDay,
                    };
                    qa.advanceMinutes(1);
                  }
                  return null;
                }"""
            )
            if not transit:
                raise AssertionError("No cafe NPC entered a sufficiently long exterior transit route")
            page.wait_for_function(
                """npcId => {
                  const city = window.__SYKA_E2E_GAME__.scene.getScene('city');
                  return Boolean(city?.cafeNpcViews?.has(npcId));
                }""",
                arg=transit["id"],
            )
            page.evaluate("() => window.__SYKA_ALPHA_QA__.advanceMinutes(1)")
            page.wait_for_timeout(800)
            page.evaluate("() => window.__SYKA_ALPHA_QA__.advanceMinutes(1)")
            page.wait_for_timeout(350)
            npc_views = page.evaluate(
                """() => {
                  const city = window.__SYKA_E2E_GAME__.scene.getScene('city');
                  return [...city.cafeNpcViews.values()].map(view => ({
                    id: view.npcId,
                    x: Math.round(view.container.x * 100) / 100,
                    y: Math.round(view.container.y * 100) / 100,
                    targetX: view.targetX,
                    targetY: view.targetY,
                    alpha: Math.round(view.container.alpha * 100) / 100,
                    depth: view.container.depth,
                    frame: view.sprite.frame.name,
                    displayWidth: view.sprite.displayWidth,
                    displayHeight: view.sprite.displayHeight,
                  }));
                }"""
            )
            if not npc_views or not any(view["frame"].endswith("walking") for view in npc_views):
                raise AssertionError({"transit": transit, "views": npc_views})
        else:
            page.wait_for_timeout(1_000)
        screenshot = OUTPUT / f"city-base-{width}x{height}.png"
        page.screenshot(path=str(screenshot))
        result = {
            "viewport": f"{width}x{height}",
            "canvasCount": page.locator("canvas").count(),
            "pageErrors": errors,
            "screenshot": str(screenshot),
            "transit": transit,
            "npcViews": npc_views,
        }
        if result["canvasCount"] != 1 or errors:
            raise AssertionError(result)
        results.append(result)
        context.close()
    browser.close()

report = {"status": "PASS", "results": results}
(OUTPUT / "city-base-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report, indent=2))
