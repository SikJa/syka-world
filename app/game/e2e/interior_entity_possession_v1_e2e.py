"""Physical browser QA for the spatial entity and possession pass v1."""

from __future__ import annotations

import json
import re
import time
from pathlib import Path
from typing import Any
from urllib.request import urlopen

from playwright.sync_api import BrowserContext, Page, Route, sync_playwright

from alpha_v1_e2e import BrowserAudit, ControlledBridge, qa_call, require, snapshot


BASE_URL = "http://127.0.0.1:5188/"
REPO_ROOT = Path(__file__).resolve().parents[3]
REPORT_DIR = REPO_ROOT / "reports" / "interior-entity-possession-v1"
SCREENSHOT_DIR = REPORT_DIR / "screenshots"
REPORT_JSON = REPORT_DIR / "physical-e2e.json"


def instrument_document(context: BrowserContext, url: str) -> None:
    """Expose the real Phaser game only inside this QA browser context."""
    transformed = urlopen(f"{BASE_URL}src/presentation/createSykaGame.ts", timeout=5).read().decode("utf-8")
    match = re.search(r"/node_modules/\.vite/deps/phaser\.js\?v=([a-zA-Z0-9_-]+)", transformed)
    require(match is not None, "Could not resolve the live Phaser dependency URL")
    browser_hash = match.group(1)

    def handler(route: Route) -> None:
        response = route.fetch()
        body = response.text()
        entrypoint = re.compile(r'<script\s+type="module"\s+src="/src/main\.ts(?:\?[^\"]*)?"></script>')
        replacement = f"""<script type="module">
          import * as Phaser from '/node_modules/.vite/deps/phaser.js?v={browser_hash}';
          const originalBoot = Phaser.Game.prototype.boot;
          Phaser.Game.prototype.boot = function (...args) {{
            window.__SYKA_E2E_GAME__ = this;
            return originalBoot.apply(this, args);
          }};
          await import('/src/main.ts');
        </script>"""
        require(entrypoint.search(body) is not None, "Could not instrument the app entrypoint")
        route.fulfill(response=response, body=entrypoint.sub(replacement, body, count=1))

    context.route(url, handler)


def wait_ready(page: Page, url: str) -> None:
    page.goto(url, wait_until="domcontentloaded", timeout=60_000)
    page.wait_for_selector(".syka-alpha-ui", state="visible", timeout=30_000)
    page.wait_for_function(
        "() => Boolean(window.__SYKA_ALPHA_QA__ && window.__SYKA_E2E_GAME__)",
        timeout=30_000,
    )
    page.wait_for_selector("#loading-card.is-hidden", timeout=30_000)
    page.wait_for_function("() => window.__SYKA_ALPHA_QA__.getSnapshot().control.configured", timeout=10_000)
    page.wait_for_timeout(350)


def control_actor(page: Page, profile_id: str = "default") -> dict[str, Any]:
    actor = page.evaluate(
        """profileId => window.__SYKA_ALPHA_QA__.getSnapshot().control.actors
          .find(actor => actor.profileId === profileId) ?? null""",
        profile_id,
    )
    require(isinstance(actor, dict), f"Control actor {profile_id} is missing")
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


def city_client_point(page: Page, cell: dict[str, int]) -> dict[str, float]:
    point = page.evaluate(
        """cell => {
          const game = window.__SYKA_E2E_GAME__;
          const scene = game.scene.getScene('city');
          const camera = scene.cameras.main;
          const worldX = 900 + (cell.x - cell.y) * 16;
          const worldY = 126 + (cell.x + cell.y) * 8 + 8;
          const screen = camera.matrixCombined.transformPoint(worldX, worldY);
          const rect = game.canvas.getBoundingClientRect();
          return {
            x: rect.left + screen.x * rect.width / game.scale.width,
            y: rect.top + screen.y * rect.height / game.scale.height,
            screenX: screen.x,
            screenY: screen.y,
          };
        }""",
        cell,
    )
    require(isinstance(point, dict), "Could not project city cell")
    return point


def cafe_client_point(page: Page, cell: dict[str, int]) -> dict[str, float]:
    point = page.evaluate(
        """cell => {
          const game = window.__SYKA_E2E_GAME__;
          const scene = game.scene.getScene('cafe-interior');
          const camera = scene.cameras.main;
          const normalized = window.__SYKA_INTERIOR__.spatial.cellToNormalized(cell);
          const bounds = scene.roomBounds;
          const worldX = bounds.x + normalized[0] * bounds.width;
          const worldY = bounds.y + normalized[1] * bounds.height;
          const screen = camera.matrixCombined.transformPoint(worldX, worldY);
          const rect = game.canvas.getBoundingClientRect();
          return {
            x: rect.left + screen.x * rect.width / game.scale.width,
            y: rect.top + screen.y * rect.height / game.scale.height,
            normalized,
          };
        }""",
        cell,
    )
    require(isinstance(point, dict), "Could not project interior cell")
    return point


def physical_city_click(page: Page, cell: dict[str, int]) -> None:
    point = city_client_point(page, cell)
    page.mouse.click(point["x"], point["y"])


def physical_cafe_click(page: Page, cell: dict[str, int]) -> None:
    point = cafe_client_point(page, cell)
    page.mouse.click(point["x"], point["y"])


def choose_cafe_floor_target(page: Page, minimum_distance: int = 3) -> dict[str, int]:
    candidates = page.evaluate(
        """minimumDistance => {
          const snapshot = window.__SYKA_ALPHA_QA__.getSnapshot();
          const actor = snapshot.control.actors.find(candidate => candidate.profileId === 'default');
          const occupied = new Set(snapshot.control.actors.map(item => `${item.cell.x},${item.cell.y}`));
          const result = [];
          for (let y = 0; y < 18; y += 1) for (let x = 0; x < 32; x += 1) {
            const cell = {x, y};
            const distance = Math.abs(x - actor.cell.x) + Math.abs(y - actor.cell.y);
            if (distance < minimumDistance || occupied.has(`${x},${y}`)) continue;
            if (!window.__SYKA_INTERIOR__.spatial.isWalkable(cell)) continue;
            result.push({...cell, distance});
          }
          return result.sort((left, right) => left.distance - right.distance || left.y - right.y || left.x - right.x);
        }""",
        minimum_distance,
    )
    require(isinstance(candidates, list) and len(candidates) > 0, "No café floor target was available")
    for target in candidates:
        point = cafe_client_point(page, target)
        page.mouse.move(point["x"], point["y"])
        hits = page.evaluate(
            """() => window.__SYKA_E2E_GAME__.scene.getScene('cafe-interior').input
              .hitTestPointer(window.__SYKA_E2E_GAME__.scene.getScene('cafe-interior').input.activePointer).length"""
        )
        if hits == 0:
            return {"x": target["x"], "y": target["y"]}
    raise AssertionError("Every reachable café floor candidate was covered by an object hotspot")


def choose_city_road_target(page: Page, minimum_distance: int = 3) -> dict[str, int]:
    candidates = page.evaluate(
        """minimumDistance => {
          const snapshot = window.__SYKA_ALPHA_QA__.getSnapshot();
          const actor = snapshot.control.actors.find(candidate => candidate.profileId === 'default');
          const occupied = new Set(snapshot.control.actors.map(item => `${item.cell.x},${item.cell.y}`));
          const game = window.__SYKA_E2E_GAME__;
          const camera = game.scene.getScene('city').cameras.main;
          const rect = game.canvas.getBoundingClientRect();
          const candidates = snapshot.game.map.tiles
            .filter(tile => tile.terrain === 'road' && !tile.buildingId)
            .map(tile => tile.position)
            .filter(cell => !occupied.has(`${cell.x},${cell.y}`))
            .map(cell => ({...cell, distance: Math.abs(cell.x - actor.cell.x) + Math.abs(cell.y - actor.cell.y)}))
            .filter(cell => cell.distance >= minimumDistance && cell.distance <= 40)
            .map(cell => {
              const worldX = 900 + (cell.x - cell.y) * 16;
              const worldY = 126 + (cell.x + cell.y) * 8 + 8;
              const screen = camera.matrixCombined.transformPoint(worldX, worldY);
              const x = rect.left + screen.x * rect.width / game.scale.width;
              const y = rect.top + screen.y * rect.height / game.scale.height;
              return {cellX: cell.x, cellY: cell.y, distance: cell.distance, x, y};
            })
            .filter(cell => cell.x > rect.left + 280 && cell.x < rect.right - 280 && cell.y > rect.top + 230 && cell.y < rect.bottom - 125)
            .sort((left, right) => left.distance - right.distance || left.y - right.y || left.x - right.x);
          return candidates.slice(0, 80).map(candidate => ({x: candidate.cellX, y: candidate.cellY}));
        }""",
        minimum_distance,
    )
    require(isinstance(candidates, list) and len(candidates) > 0, "No visible road destination was available")
    for target in candidates:
        point = city_client_point(page, target)
        page.mouse.move(point["x"], point["y"])
        hits = page.evaluate(
            """() => window.__SYKA_E2E_GAME__.scene.getScene('city').input
              .hitTestPointer(window.__SYKA_E2E_GAME__.scene.getScene('city').input.activePointer).length"""
        )
        if hits == 0:
            return target
    raise AssertionError("Every visible road destination was covered by an interactive sprite hit area")


def valid_wasd_step(page: Page) -> tuple[str, dict[str, int]]:
    result = page.evaluate(
        """() => {
          const snapshot = window.__SYKA_ALPHA_QA__.getSnapshot();
          const actor = snapshot.control.actors.find(candidate => candidate.profileId === 'default');
          const roads = new Set(snapshot.game.map.tiles
            .filter(tile => tile.terrain === 'road' && !tile.buildingId)
            .map(tile => `${tile.position.x},${tile.position.y}`));
          const occupied = new Set(snapshot.control.actors
            .filter(item => item.actorId !== actor.actorId)
            .map(item => `${item.cell.x},${item.cell.y}`));
          const options = [['w', 0, -1], ['a', -1, 0], ['s', 0, 1], ['d', 1, 0]];
          for (const [key, dx, dy] of options) {
            const cell = {x: actor.cell.x + dx, y: actor.cell.y + dy};
            const id = `${cell.x},${cell.y}`;
            if (roads.has(id) && !occupied.has(id)) return {key, cell};
          }
          return null;
        }"""
    )
    require(isinstance(result, dict), "No valid WASD neighbour was available")
    return result["key"], result["cell"]


def move_to_blocked_edge(page: Page) -> tuple[str, dict[str, int]]:
    setup = page.evaluate(
        """() => {
          const snapshot = window.__SYKA_ALPHA_QA__.getSnapshot();
          const roads = new Set(snapshot.game.map.tiles
            .filter(tile => tile.terrain === 'road' && !tile.buildingId)
            .map(tile => `${tile.position.x},${tile.position.y}`));
          const occupied = new Set(snapshot.control.actors
            .filter(item => item.profileId !== 'default')
            .map(item => `${item.cell.x},${item.cell.y}`));
          const actor = snapshot.control.actors.find(item => item.profileId === 'default');
          const options = [['w', 0, -1], ['a', -1, 0], ['s', 0, 1], ['d', 1, 0]];
          const cells = [...roads].map(value => {
            const [x, y] = value.split(',').map(Number);
            return {x, y, distance: Math.abs(x - actor.cell.x) + Math.abs(y - actor.cell.y)};
          }).sort((left, right) => left.distance - right.distance || left.y - right.y || left.x - right.x);
          for (const cell of cells) {
            if (occupied.has(`${cell.x},${cell.y}`)) continue;
            for (const [key, dx, dy] of options) {
              const blocked = {x: cell.x + dx, y: cell.y + dy};
              if (!roads.has(`${blocked.x},${blocked.y}`)) {
                return {cell: {x: cell.x, y: cell.y}, key, blocked};
              }
            }
          }
          return null;
        }"""
    )
    require(isinstance(setup, dict), "No road edge suitable for collision QA was found")
    moved = qa_call(page, "clickMove", "city", setup["cell"]["x"], setup["cell"]["y"])
    require(moved.get("ok") is True, f"Could not prepare collision edge: {moved}")
    wait_actor_at(page, setup["cell"], timeout=30_000)
    return setup["key"], setup["cell"]


def assert_unique_actor_cells(page: Page) -> dict[str, Any]:
    actors = snapshot(page)["control"]["actors"]
    cells = [f"{actor['cell']['x']},{actor['cell']['y']}" for actor in actors]
    require(len(cells) == len(set(cells)), f"Spatial actors overlap: {cells}")
    return {"actors": len(actors), "unique_cells": len(set(cells))}


def screenshot(page: Page, name: str) -> str:
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    target = SCREENSHOT_DIR / name
    page.screenshot(path=str(target), full_page=True)
    return str(target.relative_to(REPO_ROOT)).replace("\\", "/")


def main() -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    results: list[dict[str, Any]] = []
    started = time.time()
    audit = BrowserAudit("physical-spatial-control")
    bridge = ControlledBridge()
    app_url = f"{BASE_URL}?qa=1&mode=showcase"

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        instrument_document(context, app_url)
        context.route("**/bridge/api/world/**", bridge.handler)
        page = context.new_page()
        audit.attach(page)
        try:
            wait_ready(page, app_url)
            require(qa_call(page, "reset", "showcase").get("ok") is True, "Showcase reset failed")
            page.wait_for_function("() => window.__SYKA_ALPHA_QA__.getSnapshot().control.sceneId === 'city'")

            page.locator('.alpha-agent-card[data-profile-id="default"]').click()
            page.wait_for_function(
                "() => window.__SYKA_ALPHA_QA__.getSnapshot().control.selectedProfileId === 'default'"
            )
            results.append({"step": "select-agent", "status": "PASS"})

            target = choose_city_road_target(page)
            physical_city_click(page, target)
            wait_actor_at(page, target)
            results.append({"step": "physical-click-city", "status": "PASS", "target": target})

            before_blocked = control_actor(page)["cell"]
            building = next(item for item in snapshot(page)["game"]["buildings"] if item["status"] == "complete")
            physical_city_click(page, building["origin"])
            page.wait_for_timeout(500)
            require(control_actor(page)["cell"] == before_blocked, "Clicking a building moved the selected agent")
            results.append({"step": "building-click-not-ground", "status": "PASS"})

            page.locator('[data-agent-action="possess"]').click()
            page.wait_for_function(
                "() => window.__SYKA_ALPHA_QA__.getSnapshot().control.possessedProfileId === 'default'"
            )
            key, expected = valid_wasd_step(page)
            page.keyboard.press(key.upper())
            wait_actor_at(page, expected)
            results.append({"step": "possess-and-wasd", "status": "PASS", "key": key, "cell": expected})
            city_shot = screenshot(page, "01-city-possession-1440x900.png")

            page.keyboard.press("P")
            page.wait_for_function(
                "() => !window.__SYKA_ALPHA_QA__.getSnapshot().control.possessedProfileId"
            )
            blocked_key, edge_cell = move_to_blocked_edge(page)
            page.keyboard.press("P")
            page.wait_for_function(
                "() => window.__SYKA_ALPHA_QA__.getSnapshot().control.possessedProfileId === 'default'"
            )
            for _ in range(8):
                page.keyboard.press(blocked_key.upper())
            page.wait_for_timeout(450)
            require(control_actor(page)["cell"] == edge_cell, "Repeated WASD crossed a blocked city edge")
            results.append({"step": "city-collision-key-repeat", "status": "PASS", "key": blocked_key})

            page.keyboard.press("Escape")
            require(snapshot(page)["game"]["camera"]["scene"] == "city", "Esc released and exited in one press")
            cafe = next(
                item for item in snapshot(page)["game"]["buildings"]
                if item["kind"] == "cafe" and item["status"] == "complete"
            )
            qa_call(page, "focusGrid", cafe["accessTile"]["x"], cafe["accessTile"]["y"])
            page.wait_for_timeout(450)
            approached = {"ok": False, "error": "NOT_ATTEMPTED"}
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
                page.wait_for_timeout(1_000)
            require(approached.get("ok") is True, f"Could not route to the cafe portal: {approached}")
            wait_actor_at(page, cafe["accessTile"], timeout=30_000)
            page.keyboard.press("P")
            page.keyboard.press("F")
            page.wait_for_function(
                "() => window.__SYKA_ALPHA_QA__.getSnapshot().game.camera.scene === 'interior'",
                timeout=10_000,
            )
            page.wait_for_function("() => Boolean(window.__SYKA_INTERIOR__)", timeout=10_000)
            page.wait_for_function(
                "() => window.__SYKA_ALPHA_QA__.getSnapshot().control.sceneId.startsWith('cafe:')",
                timeout=10_000,
            )
            require(snapshot(page)["control"]["possessedProfileId"] == "default", "F did not preserve possession")
            coexistence = assert_unique_actor_cells(page)
            results.append({"step": "portal-f-city-to-cafe", "status": "PASS", **coexistence})

            page.keyboard.press("Escape")
            require(snapshot(page)["game"]["camera"]["scene"] == "interior", "First interior Esc exited the scene")
            page.wait_for_function(
                "() => !window.__SYKA_ALPHA_QA__.getSnapshot().control.possessedProfileId"
            )
            floor_target = choose_cafe_floor_target(page)
            physical_cafe_click(page, floor_target)
            wait_actor_at(page, floor_target, timeout=20_000)
            results.append({"step": "physical-click-cafe-floor", "status": "PASS", "target": floor_target})
            seat = {"x": 22, "y": 11}
            seated_route = qa_call(page, "clickMove", "cafe:cafe-main", seat["x"], seat["y"])
            require(seated_route.get("ok") is True, f"Could not route to the seating anchor: {seated_route}")
            wait_actor_at(page, seat, timeout=20_000)
            page.keyboard.press("E")
            page.wait_for_function(
                """() => window.__SYKA_ALPHA_QA__.getSnapshot().game.agents
                  .find(agent => agent.profileId === 'default')?.location?.action === 'sit'""",
                timeout=5_000,
            )
            results.append({"step": "physical-click-cafe-and-e", "status": "PASS", "anchor": "table-seat-3"})

            coffee_station = {"x": 10, "y": 9}
            coffee_route = qa_call(
                page,
                "clickMove",
                snapshot(page)["control"]["sceneId"],
                coffee_station["x"],
                coffee_station["y"],
            )
            require(coffee_route.get("ok") is True, f"Could not route to the coffee station: {coffee_route}")
            wait_actor_at(page, coffee_station, timeout=20_000)
            page.keyboard.press("E")
            page.wait_for_function(
                """() => window.__SYKA_ALPHA_QA__.getSnapshot().game.agents
                  .find(agent => agent.profileId === 'default')?.location?.action === 'serve-coffee'""",
                timeout=5_000,
            )
            results.append({"step": "cafe-e-coffee-station", "status": "PASS", "anchor": "counter"})

            page.keyboard.press("P")
            interior_actor = control_actor(page)
            blocked_options = page.evaluate(
                """cell => [['w',0,-1],['a',-1,0],['s',0,1],['d',1,0]]
                  .filter(([,dx,dy]) => !window.__SYKA_INTERIOR__.spatial.isWalkable({x:cell.x+dx,y:cell.y+dy}))
                  .map(([key]) => key)""",
                interior_actor["cell"],
            )
            require(len(blocked_options) > 0, "The café interaction anchor had no adjacent obstacle to test")
            for _ in range(8):
                page.keyboard.press(blocked_options[0].upper())
            page.wait_for_timeout(400)
            require(control_actor(page)["cell"] == interior_actor["cell"], "Actor crossed café furniture")
            cafe_shot = screenshot(page, "02-cafe-interaction-1440x900.png")
            results.append({"step": "cafe-collision-and-depth-frame", "status": "PASS", "key": blocked_options[0]})

            input_state = snapshot(page)["control"].copy()
            page.evaluate(
                """() => {
                  const input = document.createElement('input');
                  input.id = 'qa-control-focus';
                  document.body.append(input);
                  input.focus();
                }"""
            )
            for key_name in ("P", "W", "E", "F", "Escape"):
                page.keyboard.press(key_name)
            page.wait_for_timeout(300)
            focused_state = snapshot(page)["control"]
            require(
                focused_state["possessedProfileId"] == input_state["possessedProfileId"]
                and focused_state["sceneId"] == input_state["sceneId"]
                and control_actor(page)["cell"] == next(
                    actor["cell"] for actor in input_state["actors"] if actor.get("profileId") == "default"
                ),
                "Focused input did not suppress game controls",
            )
            page.evaluate("() => document.querySelector('#qa-control-focus').remove()")
            results.append({"step": "typing-focus-guard", "status": "PASS"})

            require(
                snapshot(page)["control"].get("possessedProfileId") == "default",
                "Save/reload QA expected possession to be active before saving",
            )
            saved_cell = control_actor(page)["cell"]
            require(qa_call(page, "save").get("ok") is True, "Save failed")
            page.reload(wait_until="domcontentloaded", timeout=60_000)
            page.wait_for_function(
                "() => Boolean(window.__SYKA_ALPHA_QA__ && window.__SYKA_E2E_GAME__ && window.__SYKA_INTERIOR__)",
                timeout=30_000,
            )
            page.wait_for_function("() => window.__SYKA_ALPHA_QA__.getSnapshot().control.configured", timeout=10_000)
            restored = snapshot(page)
            require(not restored["control"].get("possessedProfileId"), "Possession survived reload")
            require(control_actor(page)["cell"] == saved_cell, "Interior spatial tile did not survive reload")
            results.append({"step": "save-reload-position-no-possession", "status": "PASS", "cell": saved_cell})

            require(qa_call(page, "selectAgent", "default").get("ok") is True, "Could not reselect after reload")
            entry = {"x": 16, "y": 17}
            physical_cafe_click(page, entry)
            wait_actor_at(page, entry, timeout=20_000)
            page.keyboard.press("F")
            page.wait_for_function(
                "() => window.__SYKA_ALPHA_QA__.getSnapshot().game.camera.scene === 'city'",
                timeout=10_000,
            )
            require(control_actor(page)["sceneId"] == "city", "F exit did not restore city spatial control")
            results.append({"step": "portal-f-cafe-to-city", "status": "PASS"})

            metrics = page.evaluate("() => window.__SYKA_ALPHA_QA__.metrics()")
            require(len(audit.page_errors) == 0, f"Page errors: {audit.page_errors}")
            ignored_console_fragments = (
                "favicon",
                "gl driver message",
                "gpu stall due to readpixels",
            )
            unexpected_console = [
                item for item in audit.console
                if not any(fragment in item["text"].lower() for fragment in ignored_console_fragments)
            ]
            require(len(unexpected_console) == 0, f"Console warnings/errors: {unexpected_console}")
            require(all(item["method"] == "GET" and not item["has_body"] for item in bridge.requests), "Bridge write/body detected")
            results.append({"step": "runtime-and-bridge-audit", "status": "PASS", "metrics": metrics})

            payload = {
                "status": "PASS",
                "generated_at_epoch": time.time(),
                "duration_seconds": round(time.time() - started, 3),
                "viewport": {"width": 1440, "height": 900},
                "steps": results,
                "screenshots": [city_shot, cafe_shot],
                "bridge_requests": bridge.requests,
                "page_errors": audit.page_errors,
                "console": audit.console,
            }
            REPORT_JSON.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
        except Exception as error:
            screenshot(page, "FAILED-physical-e2e.png")
            payload = {
                "status": "FAIL",
                "error": f"{type(error).__name__}: {error}",
                "duration_seconds": round(time.time() - started, 3),
                "steps": results,
                "last_snapshot": snapshot(page),
                "bridge_requests": bridge.requests,
                "page_errors": audit.page_errors,
                "console": audit.console,
            }
            REPORT_JSON.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
            raise
        finally:
            bridge.close()
            page.close()
            context.close()
            browser.close()

    print(f"PASS: {REPORT_JSON}")


if __name__ == "__main__":
    main()
