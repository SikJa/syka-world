"""Focused physical QA for Cafe protagonists, local NPCs and optional decor.

Run only through webapp-testing's ``with_server.py`` helper.
"""

from __future__ import annotations

import json
from pathlib import Path

from playwright.sync_api import sync_playwright

from alpha_v1_e2e import BASE_URL, BrowserAudit, ControlledBridge, require, wait_ready
from final_browser_e2e import actionable_console, instrument_document


REPO_ROOT = Path(__file__).resolve().parents[3]
REPORT_DIR = REPO_ROOT / "reports" / "e2e" / "cafe-actors"
SCREENSHOT = REPORT_DIR / "cafe-agent-npcs-1440x900.png"
REPORT = REPORT_DIR / "cafe-actor-runtime-report.json"


def main() -> int:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        context.add_init_script("localStorage.clear();")
        instrument_document(context)
        bridge = ControlledBridge()
        context.route("**/bridge/api/world/**", bridge.handler)
        page = context.new_page()
        audit = BrowserAudit("cafe-actors")
        audit.attach(page)
        wait_ready(page, f"{BASE_URL}?qa=1")
        page.wait_for_function("() => Boolean(window.__SYKA_E2E_GAME__)")

        for profile_id in ("default", "elen"):
            page.locator(f'.alpha-agent-card[data-profile-id="{profile_id}"]').click()
            page.locator('[data-agent-action="go-to-cafe"]').click()
        for _minute in range(120):
            page.evaluate("() => window.__SYKA_ALPHA_QA__.advanceMinutes(1)")
            locations = page.evaluate(
                """() => window.__SYKA_ALPHA_QA__.getSnapshot().game.agents
                  .filter(agent => ['syka', 'elen'].includes(agent.id))
                  .map(agent => ({ id: agent.id, location: agent.location }))"""
            )
            if all(item["location"]["kind"] == "interior" for item in locations):
                break
        require(all(item["location"]["kind"] == "interior" for item in locations), "Syka and Elen did not both enter the cafe")
        require(all(item["location"]["buildingId"] == "cafe-main" for item in locations), "An agent entered the wrong building")

        page.evaluate("() => window.__SYKA_ALPHA_QA__.enterCafe('cafe-main')")
        page.wait_for_function("() => window.__SYKA_ALPHA_QA__.metrics().activeScenes.includes('cafe-interior')")
        page.wait_for_timeout(350)

        page.evaluate("() => window.__SYKA_ALPHA_QA__.installFurniture('cafe-main', 'decor-window', 'fern')")
        page.evaluate("() => window.__SYKA_ALPHA_QA__.installFurniture('cafe-main', 'decor-books', 'fern')")
        page.wait_for_timeout(180)

        evidence = page.evaluate(
            """() => {
              const scene = window.__SYKA_E2E_GAME__.scene.getScene('cafe-interior');
              const agents = [...scene.agentViews.entries()].map(([id, view]) => ({
                id,
                height: view.sprite.displayHeight,
                width: view.sprite.displayWidth,
                x: view.container.x,
                y: view.container.y,
                frame: view.sprite.frame.name,
                visible: view.container.visible,
                hasContactShadow: Boolean(view.shadow && view.shadow.visible),
              }));
              const agent = scene.agentViews.get('syka');
              const npcs = [...scene.npcViews.entries()].map(([id, view]) => ({
                id,
                height: view.sprite.displayHeight,
                width: view.sprite.displayWidth,
                x: view.container.x,
                y: view.container.y,
                frame: view.sprite.frame.name,
                hasContactShadow: Boolean(view.shadow && view.shadow.visible),
              }));
              const decor = scene.optionalDecorLayer.list.map(image => ({
                furnitureId: image.getData('furnitureId'),
                slotId: image.getData('slotId'),
                surface: image.getData('surface'),
                x: image.x,
                y: image.y,
                width: image.displayWidth,
                height: image.displayHeight,
              }));
              return {
                room: { x: scene.roomBounds.x, y: scene.roomBounds.y, width: scene.roomBounds.width, height: scene.roomBounds.height },
                agent: agent ? {
                  height: agent.sprite.displayHeight,
                  width: agent.sprite.displayWidth,
                  x: agent.container.x,
                  y: agent.container.y,
                  frame: agent.sprite.frame.name,
                  hasContactShadow: Boolean(agent.shadow && agent.shadow.visible),
                } : null,
                agents,
                npcs,
                decor,
                foregroundOccluders: scene.actorForeground.length,
                snapshotNpcs: window.__SYKA_ALPHA_QA__.getSnapshot().game.npcs,
              };
            }"""
        )

        require(evidence["agent"] is not None, "Syka has no interior sprite")
        require(38 <= evidence["agent"]["height"] <= 48, f"Syka interior height is wrong: {evidence['agent']}")
        require(evidence["agent"]["hasContactShadow"], "Syka has no contact shadow")
        require(len(evidence["agents"]) >= 2, f"Expected two visible Hermes actors: {evidence['agents']}")
        require(all(agent["visible"] for agent in evidence["agents"]), "An interior Hermes actor is hidden")
        require(all("agent-" in str(agent["frame"]) for agent in evidence["agents"]), "An actor is not using the agent atlas")
        actor_positions = {(round(agent["x"]), round(agent["y"])) for agent in evidence["agents"]}
        require(len(actor_positions) == len(evidence["agents"]), f"Interior actors overlap exactly: {evidence['agents']}")
        require(1 <= len(evidence["npcs"]) <= 3, f"Unexpected active NPC count: {len(evidence['npcs'])}")
        require(
            all(34 <= npc["height"] <= 46 for npc in evidence["npcs"]),
            f"An NPC is outside the calibrated interior scale: {evidence['npcs']}",
        )
        require(all(npc["hasContactShadow"] for npc in evidence["npcs"]), "An NPC has no contact shadow")
        require(all("cafe-npc-" in str(npc["frame"]) for npc in evidence["npcs"]), "An NPC is not using the production atlas")
        require(evidence["foregroundOccluders"] == 5, "The cafe furniture foreground slices are missing")

        ferns = [item for item in evidence["decor"] if item["furnitureId"] == "fern"]
        require(len(ferns) == 2, f"Expected two installed ferns, found {len(ferns)}")
        require(all(item["surface"] == "floor" for item in ferns), "A fern is not mapped to a floor surface")
        room = evidence["room"]
        normalized = [
            {
                "slotId": item["slotId"],
                "x": round((item["x"] - room["x"]) / room["width"], 3),
                "y": round((item["y"] - room["y"]) / room["height"], 3),
            }
            for item in ferns
        ]
        require(all(item["y"] >= 0.76 for item in normalized), f"A fern still sits on a table: {normalized}")
        require(abs(normalized[0]["x"] - normalized[1]["x"]) > 0.2, f"Ferns overlap each other: {normalized}")

        page.screenshot(path=str(SCREENSHOT), full_page=True)
        page.keyboard.press("b")
        page.wait_for_function("() => window.__SYKA_ALPHA_QA__.metrics().activeScenes.includes('city')")
        require(not page.evaluate("() => window.__SYKA_ALPHA_QA__.metrics().activeScenes.includes('cafe-interior')"), "B did not exit the cafe")
        actionable, ignored = actionable_console(audit.console)
        require(not actionable, f"Actionable console messages: {actionable}")
        require(not audit.page_errors, f"Page errors: {audit.page_errors}")
        require(all(request["method"] == "GET" and not request["has_body"] for request in bridge.requests), "Bridge was not GET-only")

        payload = {
            "schema": "syka.world.cafe-actor-runtime-e2e.v2",
            "overall": "PASS",
            "agent": evidence["agent"],
            "agents": evidence["agents"],
            "npcs": evidence["npcs"],
            "activeNpcState": [npc for npc in evidence["snapshotNpcs"] if npc["location"]["kind"] == "interior"],
            "fernPositions": normalized,
            "bridgeRequests": bridge.requests,
            "ignoredDriverConsole": ignored,
            "screenshot": str(SCREENSHOT.relative_to(REPO_ROOT)).replace("\\", "/"),
        }
        REPORT.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
        print(json.dumps(payload, indent=2, ensure_ascii=False))
        bridge.connected = False
        page.wait_for_timeout(40)
        context.close()
        browser.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
