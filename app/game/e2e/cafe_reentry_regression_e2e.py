"""Regression for the same-runtime Café re-entry corruption.

The original browser coverage entered the Café only once per Phaser game. This
test intentionally enters, exits and enters again without reloading the page or
creating another browser context. Production is observed through a QA-only
Phaser handle installed by intercepting the document; no production API is
added for these assertions.

Precondition: the Syka World Vite server is already listening on 127.0.0.1:5173.
"""

from __future__ import annotations

import json
import re
import time
import traceback
from pathlib import Path
from typing import Any
from urllib.request import urlopen

from playwright.sync_api import BrowserContext, Page, Route, sync_playwright

from alpha_v1_e2e import (
    BASE_URL,
    BrowserAudit,
    ControlledBridge,
    qa_call,
    require,
    snapshot,
    wait_ready,
)


APP_URL = f"{BASE_URL}?qa=1&mode=showcase"
REPO_ROOT = Path(__file__).resolve().parents[3]
GAME_ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = REPO_ROOT / "reports" / "cafe-runtime-regression"
REPORT_JSON = REPORT_DIR / "cafe-reentry-regression-report.json"


def require_live_server() -> None:
    try:
        with urlopen(BASE_URL, timeout=3) as response:
            require(response.status < 400, f"Vite returned HTTP {response.status}")
    except OSError as error:
        raise AssertionError(
            "Syka World must already be running at http://127.0.0.1:5173/"
        ) from error


def instrument_document(context: BrowserContext) -> None:
    """Capture the real Phaser.Game only inside this browser context."""

    metadata = json.loads(
        (GAME_ROOT / "node_modules" / ".vite" / "deps" / "_metadata.json").read_text(
            encoding="utf-8"
        )
    )
    browser_hash = metadata["browserHash"]
    try:
        with urlopen(f"{BASE_URL}src/presentation/createSykaGame.ts", timeout=5) as response:
            transformed = response.read().decode("utf-8")
        match = re.search(
            r"/node_modules/\.vite/deps/phaser\.js\?v=([a-zA-Z0-9_-]+)",
            transformed,
        )
        if match:
            browser_hash = match.group(1)
    except OSError:
        pass

    def handler(route: Route) -> None:
        response = route.fetch()
        body = response.text()
        entrypoint = re.compile(
            r'<script\s+type="module"\s+src="/src/main\.ts(?:\?[^\"]*)?"></script>'
        )
        replacement = """<script type="module">
          import * as Phaser from '/node_modules/.vite/deps/phaser.js?v=__HASH__';
          const originalBoot = Phaser.Game.prototype.boot;
          Phaser.Game.prototype.boot = function (...args) {
            window.__SYKA_E2E_GAME__ = this;
            return originalBoot.apply(this, args);
          };
          await import('/src/main.ts');
        </script>""".replace("__HASH__", browser_hash)
        require(entrypoint.search(body) is not None, "Could not instrument the app entrypoint")
        route.fulfill(response=response, body=entrypoint.sub(replacement, body, count=1))

    context.route(APP_URL, handler)


def prepare_agent_and_npc_inside(page: Page) -> dict[str, Any]:
    """Use deterministic public QA actions to prepare the real runtime state."""

    page.locator('.alpha-agent-card[data-profile-id="default"]').click()
    page.locator('[data-agent-action="go-to-cafe"]').click()

    inside_agents: list[dict[str, Any]] = []
    inside_npcs: list[dict[str, Any]] = []
    for elapsed in range(181):
        state = snapshot(page)["game"]
        inside_agents = [
            agent
            for agent in state["agents"]
            if agent.get("profileId") == "default"
            and agent["location"]["kind"] == "interior"
            and agent["location"].get("buildingId") == "cafe-main"
        ]
        inside_npcs = [
            npc
            for npc in state["npcs"]
            if npc["location"]["kind"] == "interior"
            and npc["location"].get("buildingId") == "cafe-main"
        ]
        if inside_agents and inside_npcs:
            return {
                "advancedMinutes": elapsed,
                "agents": [agent["id"] for agent in inside_agents],
                "npcs": [npc["id"] for npc in inside_npcs],
            }
        require(qa_call(page, "advanceMinutes", 1).get("ok") is True, "Clock advance failed")

    raise AssertionError(
        f"Could not prepare an agent and an NPC inside the Café: "
        f"agents={inside_agents}, npcs={inside_npcs}"
    )


def enter_cafe_physically(page: Page) -> None:
    state = snapshot(page)
    cafe = next(
        building
        for building in state["game"]["buildings"]
        if building["id"] == "cafe-main" and building["status"] == "complete"
    )
    require(qa_call(page, "selectBuilding", cafe["id"]).get("ok") is True, "Café selection failed")
    page.get_by_role("button", name="Entrar al Café Biblioteca").click()
    page.wait_for_function("() => Boolean(window.__SYKA_INTERIOR__)", timeout=10_000)
    page.wait_for_function(
        "() => window.__SYKA_ALPHA_QA__.metrics().activeScenes.includes('cafe-interior')",
        timeout=10_000,
    )
    page.wait_for_function(
        "() => window.__SYKA_ALPHA_QA__.getSnapshot().control.sceneId === 'cafe:cafe-main'",
        timeout=10_000,
    )
    page.wait_for_timeout(400)


def exit_cafe_physically(page: Page) -> None:
    page.get_by_role("button", name="Volver a la ciudad").first.click()
    page.wait_for_function(
        "() => !window.__SYKA_ALPHA_QA__.metrics().activeScenes.includes('cafe-interior')",
        timeout=10_000,
    )
    page.wait_for_function(
        "() => window.__SYKA_ALPHA_QA__.getSnapshot().game.camera.scene === 'city'",
        timeout=10_000,
    )
    page.wait_for_function("() => !window.__SYKA_INTERIOR__", timeout=10_000)
    page.wait_for_timeout(250)


def scene_evidence(page: Page, entry: int) -> dict[str, Any]:
    evidence = page.evaluate(
        """entry => {
          const game = window.__SYKA_E2E_GAME__;
          const scene = game.scene.getScene('cafe-interior');
          const room = scene.room;
          const bounds = scene.roomBounds;
          const alive = view => ({
            containerActive: Boolean(view.container?.active),
            containerVisible: Boolean(view.container?.visible),
            containerAlpha: view.container?.alpha ?? null,
            spriteActive: Boolean(view.sprite?.active),
            spriteVisible: Boolean(view.sprite?.visible),
            inDisplayList: scene.children.list.includes(view.container),
            belongsToScene: view.container?.scene === scene,
            x: view.container?.x ?? null,
            y: view.container?.y ?? null,
            frame: view.sprite?.frame?.name ?? null,
          });
          const agents = [...scene.agentViews.entries()].map(([id, view]) => ({id, ...alive(view)}));
          const npcs = [...scene.npcViews.entries()].map(([id, view]) => ({id, ...alive(view)}));
          const roomData = {
            active: Boolean(room?.active),
            visible: Boolean(room?.visible),
            frame: room?.frame?.name ?? null,
            frameWidth: room?.frame?.cutWidth ?? null,
            frameHeight: room?.frame?.cutHeight ?? null,
            x: room?.x ?? null,
            y: room?.y ?? null,
            displayWidth: room?.displayWidth ?? null,
            displayHeight: room?.displayHeight ?? null,
            bounds: {
              x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
              centerX: bounds.centerX, centerY: bounds.centerY,
            },
          };
          const prior = window.__SYKA_REENTRY_FIRST__;
          const recreation = entry === 1 ? null : {
            samePhaserGame: prior?.game === game,
            roomRecreated: prior?.room !== room,
            sameAgentIds: agents.map(agent => agent.id).sort().join(',') === [...prior.agentViews.keys()].sort().join(','),
            sameNpcIds: npcs.map(npc => npc.id).sort().join(',') === [...prior.npcViews.keys()].sort().join(','),
            agentViewsRecreated: agents.every(agent => prior?.agentViews.get(agent.id)?.container !== scene.agentViews.get(agent.id)?.container),
            npcViewsRecreated: npcs.every(npc => prior?.npcViews.get(npc.id)?.container !== scene.npcViews.get(npc.id)?.container),
            priorRoomInactive: prior ? !prior.room.active : false,
          };
          if (entry === 1) {
            window.__SYKA_REENTRY_FIRST__ = {
              game,
              room,
              agentViews: new Map(scene.agentViews),
              npcViews: new Map(scene.npcViews),
            };
          }
          return { room: roomData, agents, npcs, recreation };
        }""",
        entry,
    )
    require(isinstance(evidence, dict), f"Entry {entry} did not expose scene evidence")
    room = evidence["room"]
    bounds = room["bounds"]
    require(room["frame"] == "__BASE", f"Entry {entry} uses corrupted room frame: {room}")
    require(room["active"] and room["visible"], f"Entry {entry} room is not alive: {room}")
    require(
        abs(room["displayWidth"] - bounds["width"]) <= 1
        and abs(room["displayHeight"] - bounds["height"]) <= 1,
        f"Entry {entry} room size differs from roomBounds: {room}",
    )
    require(
        abs(room["x"] - bounds["centerX"]) <= 1
        and abs(room["y"] - bounds["centerY"]) <= 1,
        f"Entry {entry} room is not centered on roomBounds: {room}",
    )
    require(room["frameWidth"] > 1_000 and room["frameHeight"] > 500, f"Entry {entry} is not using the full raster: {room}")
    require(len(evidence["agents"]) >= 1, f"Entry {entry} rendered no agent")
    require(len(evidence["npcs"]) >= 1, f"Entry {entry} rendered no NPC")
    for actor in [*evidence["agents"], *evidence["npcs"]]:
        require(
            actor["containerActive"]
            and actor["containerVisible"]
            and actor["containerAlpha"] > 0
            and actor["spriteActive"]
            and actor["spriteVisible"]
            and actor["inDisplayList"]
            and actor["belongsToScene"],
            f"Entry {entry} has a dead or hidden actor view: {actor}",
        )
    if entry == 2:
        recreation = evidence["recreation"]
        require(recreation["samePhaserGame"], f"Entry 2 booted another Phaser.Game: {recreation}")
        require(recreation["sameAgentIds"], f"Agent identities changed between entries: {recreation}")
        require(recreation["sameNpcIds"], f"NPC identities changed between entries: {recreation}")
        require(recreation["roomRecreated"], f"Entry 2 reused the destroyed room: {recreation}")
        require(recreation["agentViewsRecreated"], f"Entry 2 reused a destroyed agent view: {recreation}")
        require(recreation["npcViewsRecreated"], f"Entry 2 reused a destroyed NPC view: {recreation}")
        require(recreation["priorRoomInactive"], f"The first room was not stopped cleanly: {recreation}")
    return evidence


def control_actor(page: Page) -> dict[str, Any]:
    actor = next(
        (
            item
            for item in snapshot(page)["control"]["actors"]
            if item.get("profileId") == "default"
        ),
        None,
    )
    require(isinstance(actor, dict), "The default controlled actor is missing")
    return actor


def wait_actor_at(page: Page, cell: dict[str, int], timeout: int = 20_000) -> dict[str, Any]:
    page.wait_for_function(
        """target => {
          const actor = window.__SYKA_ALPHA_QA__.getSnapshot().control.actors
            .find(candidate => candidate.profileId === 'default');
          return actor && actor.cell.x === target.x && actor.cell.y === target.y && actor.path.length <= 1;
        }""",
        arg=cell,
        timeout=timeout,
    )
    return control_actor(page)


def movement_plans(page: Page) -> list[dict[str, Any]]:
    plans = page.evaluate(
        """() => {
          const api = window.__SYKA_INTERIOR__.spatial;
          const snapshot = window.__SYKA_ALPHA_QA__.getSnapshot();
          const actor = snapshot.control.actors.find(item => item.profileId === 'default');
          const occupied = new Set(snapshot.control.actors
            .filter(item => item.actorId !== actor.actorId)
            .map(item => `${item.cell.x},${item.cell.y}`));
          const options = [['w',0,-1],['a',-1,0],['s',0,1],['d',1,0]];
          const plans = [];
          for (let y = 0; y < api.grid.height; y += 1) for (let x = 0; x < api.grid.width; x += 1) {
            const start = {x, y};
            if (!api.isWalkable(start) || occupied.has(`${x},${y}`)) continue;
            for (const [moveKey, dx, dy] of options) {
              const moved = {x: x + dx, y: y + dy};
              if (!api.isWalkable(moved) || occupied.has(`${moved.x},${moved.y}`)) continue;
              const blocked = options.find(([,bx,by]) => !api.isWalkable({x:moved.x+bx,y:moved.y+by}));
              if (!blocked) continue;
              plans.push({
                start,
                moveKey,
                moved,
                blockedKey: blocked[0],
                blockedCell: {x:moved.x+blocked[1], y:moved.y+blocked[2]},
                distance: Math.abs(x - actor.cell.x) + Math.abs(y - actor.cell.y),
              });
            }
          }
          return plans.sort((left, right) => left.distance - right.distance || left.start.y - right.start.y || left.start.x - right.start.x);
        }"""
    )
    require(isinstance(plans, list) and plans, "No movement/collision plan exists in the Café grid")
    return plans


def verify_physical_movement_and_collision(page: Page) -> dict[str, Any]:
    require(qa_call(page, "selectAgent", "default").get("ok") is True, "Could not select Syka")
    selected = snapshot(page)["control"].get("selectedProfileId")
    require(selected == "default", f"Unexpected selected profile: {selected}")

    plan: dict[str, Any] | None = None
    for candidate in movement_plans(page)[:80]:
        result = qa_call(
            page,
            "clickMove",
            "cafe:cafe-main",
            candidate["start"]["x"],
            candidate["start"]["y"],
        )
        if result.get("ok") is True:
            wait_actor_at(page, candidate["start"], timeout=30_000)
            plan = candidate
            break
    require(plan is not None, "No reachable setup cell was available for physical movement QA")

    # Possession and movement are real DOM keyboard events, not QA API calls.
    page.keyboard.press("P")
    page.wait_for_function(
        "() => window.__SYKA_ALPHA_QA__.getSnapshot().control.possessedProfileId === 'default'",
        timeout=5_000,
    )
    page.keyboard.press(plan["moveKey"].upper())
    moved_actor = wait_actor_at(page, plan["moved"], timeout=5_000)

    before_blocked = dict(moved_actor["cell"])
    for _ in range(4):
        page.keyboard.press(plan["blockedKey"].upper())
    page.wait_for_timeout(500)
    after_blocked = control_actor(page)["cell"]
    require(after_blocked == before_blocked, f"WASD crossed Café furniture: {plan}, got {after_blocked}")

    return {
        "setupCell": plan["start"],
        "physicalMoveKey": plan["moveKey"],
        "movedCell": plan["moved"],
        "blockedKey": plan["blockedKey"],
        "blockedCell": plan["blockedCell"],
        "finalCell": after_blocked,
    }


def capture(page: Page, filename: str) -> str:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    target = REPORT_DIR / filename
    target.write_bytes(page.screenshot(full_page=True))
    return str(target.relative_to(REPO_ROOT)).replace("\\", "/")


def main() -> int:
    require_live_server()
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    started = time.time()
    audit = BrowserAudit("cafe-same-runtime-reentry")
    bridge = ControlledBridge()
    payload: dict[str, Any] = {
        "schema": "syka.world.cafe-reentry-regression.v1",
        "overall": "FAIL",
        "samePage": True,
        "sameContext": True,
        "viewport": {"width": 1008, "height": 548},
    }

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1008, "height": 548})
        context.add_init_script("localStorage.clear();")
        instrument_document(context)
        context.route("**/bridge/api/world/**", bridge.handler)
        page = context.new_page()
        audit.attach(page)
        try:
            wait_ready(page, APP_URL)
            page.wait_for_function(
                "() => Boolean(window.__SYKA_E2E_GAME__ && window.__SYKA_ALPHA_QA__)",
                timeout=30_000,
            )
            require(qa_call(page, "reset", "showcase").get("ok") is True, "Showcase reset failed")
            page.wait_for_function(
                "() => window.__SYKA_ALPHA_QA__.getSnapshot().control.sceneId === 'city'",
                timeout=10_000,
            )

            payload["preparedState"] = prepare_agent_and_npc_inside(page)

            enter_cafe_physically(page)
            payload["firstEntry"] = scene_evidence(page, 1)
            payload.setdefault("screenshots", []).append(capture(page, "01-first-entry-1008x548.png"))

            exit_cafe_physically(page)
            payload["afterExit"] = page.evaluate(
                """() => ({
                  activeScenes: window.__SYKA_ALPHA_QA__.metrics().activeScenes,
                  cameraScene: window.__SYKA_ALPHA_QA__.getSnapshot().game.camera.scene,
                  firstRoomActive: window.__SYKA_REENTRY_FIRST__.room.active,
                  firstAgentViewsActive: [...window.__SYKA_REENTRY_FIRST__.agentViews.values()].map(view => view.container.active),
                  firstNpcViewsActive: [...window.__SYKA_REENTRY_FIRST__.npcViews.values()].map(view => view.container.active),
                })"""
            )

            # Critical invariant: this is the same Page, context, Phaser.Game and game state.
            enter_cafe_physically(page)
            payload["secondEntry"] = scene_evidence(page, 2)
            payload.setdefault("screenshots", []).append(capture(page, "02-second-entry-1008x548.png"))

            payload["movement"] = verify_physical_movement_and_collision(page)
            payload.setdefault("screenshots", []).append(capture(page, "03-second-entry-movement-1008x548.png"))

            require(not audit.page_errors, f"Page errors: {audit.page_errors}")
            payload["overall"] = "PASS"
        except Exception as error:
            payload["error"] = f"{type(error).__name__}: {error}"
            payload["traceback"] = traceback.format_exc(limit=12)
            try:
                payload.setdefault("screenshots", []).append(capture(page, "failure-1008x548.png"))
            except Exception:
                pass
            raise
        finally:
            payload["durationSeconds"] = round(time.time() - started, 3)
            payload["pageErrors"] = audit.page_errors
            payload["console"] = audit.console
            payload["failedResponses"] = audit.failed_responses
            REPORT_JSON.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
            bridge.close()
            context.close()
            browser.close()

    print(json.dumps(payload, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
