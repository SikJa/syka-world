"""Independent physical and visual QA for Interior Entity & Possession Pass v1.

This is evidence tooling only. It exercises the product through real browser
mouse/keyboard input and uses the development QA surface only for deterministic
fixture preparation and state assertions.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path
from typing import Any

from playwright.sync_api import Browser, BrowserContext, Page, sync_playwright


REPO_ROOT = Path(__file__).resolve().parents[3]
E2E_ROOT = REPO_ROOT / "app" / "game" / "e2e"
sys.path.insert(0, str(E2E_ROOT))

from alpha_v1_e2e import BrowserAudit, ControlledBridge, qa_call, require, snapshot  # noqa: E402
from interior_entity_possession_v1_e2e import (  # noqa: E402
    cafe_client_point,
    choose_cafe_floor_target,
    choose_city_road_target,
    city_client_point,
    control_actor,
    instrument_document,
    move_to_blocked_edge,
    physical_cafe_click,
    physical_city_click,
    valid_wasd_step,
    wait_actor_at,
    wait_ready,
)


BASE_URL = "http://127.0.0.1:5188/"
APP_URL = f"{BASE_URL}?qa=1&mode=showcase"
OUT = REPO_ROOT / "reports" / "interior-entity-possession-v1" / "independent"
SCREENSHOTS = OUT / "screenshots"
REPORT_JSON = OUT / "independent-physical-qa.json"


def shot(page: Page, name: str) -> str:
    SCREENSHOTS.mkdir(parents=True, exist_ok=True)
    target = SCREENSHOTS / name
    page.screenshot(path=str(target), full_page=False)
    return str(target.relative_to(REPO_ROOT)).replace("\\", "/")


def unique_cells(page: Page) -> dict[str, Any]:
    actors = snapshot(page)["control"]["actors"]
    cells = [f"{actor['cell']['x']},{actor['cell']['y']}" for actor in actors]
    require(len(cells) == len(set(cells)), f"Actors overlap: {cells}")
    return {"actors": len(actors), "cells": cells}


def sample_metrics(page: Page, count: int = 8, pause_ms: int = 350) -> dict[str, Any]:
    samples: list[float] = []
    frame_ms: list[float] = []
    for _ in range(count):
        value = page.evaluate("() => window.__SYKA_ALPHA_QA__.metrics()")
        samples.append(float(value.get("actualFps", 0)))
        frame_ms.append(float(value.get("frameMilliseconds", 0)))
        page.wait_for_timeout(pause_ms)
    return {
        "samples": [round(value, 2) for value in samples],
        "averageFps": round(sum(samples) / len(samples), 2),
        "minimumFps": round(min(samples), 2),
        "averageFrameMilliseconds": round(sum(frame_ms) / len(frame_ms), 2),
    }


def choose_reachable_city_target(page: Page, minimum_distance: int = 5) -> dict[str, int]:
    """Choose a road cell in the actor's actual connected road component."""
    candidates = page.evaluate(
        """minimumDistance => {
          const snapshot = window.__SYKA_ALPHA_QA__.getSnapshot();
          const actor = snapshot.control.actors.find(candidate => candidate.profileId === 'default');
          const roads = new Set(snapshot.game.map.tiles
            .filter(tile => tile.terrain === 'road' && !tile.buildingId)
            .map(tile => `${tile.position.x},${tile.position.y}`));
          const occupied = new Set(snapshot.control.actors
            .filter(candidate => candidate.profileId !== 'default')
            .map(candidate => `${candidate.cell.x},${candidate.cell.y}`));
          const startId = `${actor.cell.x},${actor.cell.y}`;
          const queue = [{...actor.cell, distance: 0}];
          const seen = new Set([startId]);
          const result = [];
          for (let index = 0; index < queue.length; index += 1) {
            const current = queue[index];
            if (current.distance >= minimumDistance && !occupied.has(`${current.x},${current.y}`)) {
              result.push(current);
            }
            for (const [dx, dy] of [[0,-1],[-1,0],[0,1],[1,0]]) {
              const next = {x: current.x + dx, y: current.y + dy, distance: current.distance + 1};
              const id = `${next.x},${next.y}`;
              if (seen.has(id) || !roads.has(id) || occupied.has(id)) continue;
              seen.add(id);
              queue.push(next);
            }
          }
          return result.sort((left, right) => left.distance - right.distance || left.y - right.y || left.x - right.x)
            .slice(0, 100);
        }""",
        minimum_distance,
    )
    require(candidates, "No connected city road target was available")
    rect = page.evaluate(
        """() => {
          const value = window.__SYKA_E2E_GAME__.canvas.getBoundingClientRect();
          return {x: value.x, y: value.y, width: value.width, height: value.height};
        }"""
    )
    for target in candidates:
        point = city_client_point(page, target)
        if not (rect["x"] + 250 < point["x"] < rect["x"] + rect["width"] - 250):
            continue
        if not (rect["y"] + 180 < point["y"] < rect["y"] + rect["height"] - 110):
            continue
        page.mouse.move(point["x"], point["y"])
        hits = page.evaluate(
            """() => {
              const scene = window.__SYKA_E2E_GAME__.scene.getScene('city');
              return scene.input.hitTestPointer(scene.input.activePointer).length;
            }"""
        )
        if hits == 0:
            return {"x": target["x"], "y": target["y"]}
    raise AssertionError("No visible hit-free road target existed in the connected road component")


def unexpected_console(audit: BrowserAudit) -> list[dict[str, str]]:
    ignored = ("favicon", "gl driver message", "gpu stall due to readpixels")
    return [
        item
        for item in audit.console
        if not any(fragment in item["text"].lower() for fragment in ignored)
    ]


def unexpected_failed_requests(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Reload/navigation legitimately aborts the bridge's in-flight GET long-poll."""
    return [
        item
        for item in items
        if not (
            "/bridge/api/world/events?wait=15" in item["url"]
            and "ERR_ABORTED" in str(item.get("failure", ""))
        )
    ]


def open_context(browser: Browser, width: int, height: int, storage_state: dict[str, Any] | None = None):
    context = browser.new_context(
        viewport={"width": width, "height": height},
        device_scale_factor=1,
        storage_state=storage_state,
    )
    bridge = ControlledBridge()
    audit = BrowserAudit(f"independent-{width}x{height}")
    instrument_document(context, APP_URL)
    context.route("**/bridge/api/world/**", bridge.handler)
    page = context.new_page()
    audit.attach(page)
    failed_requests: list[dict[str, Any]] = []
    bad_responses: list[dict[str, Any]] = []
    page.on(
        "requestfailed",
        lambda request: failed_requests.append(
            {"url": request.url, "failure": request.failure, "resourceType": request.resource_type}
        ),
    )
    page.on(
        "response",
        lambda response: bad_responses.append(
            {"url": response.url, "status": response.status, "resourceType": response.request.resource_type}
        )
        if response.status >= 400
        else None,
    )
    wait_ready(page, APP_URL)
    return context, page, bridge, audit, failed_requests, bad_responses


def route_to_cafe_portal(page: Page) -> dict[str, Any]:
    game = snapshot(page)["game"]
    cafe = next(
        building
        for building in game["buildings"]
        if building["kind"] == "cafe" and building["status"] == "complete"
    )
    qa_call(page, "selectAgent", "default")
    qa_call(page, "focusGrid", cafe["accessTile"]["x"], cafe["accessTile"]["y"])
    page.wait_for_timeout(300)
    routed: dict[str, Any] = {"ok": False}
    for _ in range(20):
        routed = qa_call(page, "clickMove", "city", cafe["accessTile"]["x"], cafe["accessTile"]["y"])
        if routed.get("ok") is True:
            break
        page.wait_for_timeout(500)
    require(routed.get("ok") is True, f"Could not prepare café portal route: {routed}")
    wait_actor_at(page, cafe["accessTile"], timeout=30_000)
    return cafe


def exercise_main(browser: Browser) -> tuple[dict[str, Any], dict[str, Any], list[dict[str, Any]]]:
    context, page, bridge, audit, failed_requests, bad_responses = open_context(browser, 1440, 900)
    steps: list[dict[str, Any]] = []
    screenshots: list[str] = []
    responsive_state: dict[str, Any] | None = None
    try:
        require(qa_call(page, "reset", "showcase").get("ok") is True, "Showcase reset failed")
        page.wait_for_function("() => window.__SYKA_ALPHA_QA__.getSnapshot().control.sceneId === 'city'")
        city_performance = sample_metrics(page)

        # Physical selection and physical ground click.
        page.locator('.alpha-agent-card[data-profile-id="default"]').click()
        page.wait_for_function(
            "() => window.__SYKA_ALPHA_QA__.getSnapshot().control.selectedProfileId === 'default'"
        )
        target = choose_reachable_city_target(page, minimum_distance=5)
        physical_city_click(page, target)
        page.wait_for_timeout(160)
        route_state = control_actor(page)
        require(
            route_state["cell"] == target or len(route_state["path"]) > 1,
            "Physical city click did not begin a route",
        )
        screenshots.append(shot(page, "01-city-physical-click-route-1440x900.png"))
        wait_actor_at(page, target, timeout=30_000)
        hold_started = time.time()
        page.wait_for_function(
            "() => window.__SYKA_ALPHA_QA__.getSnapshot().control.notice?.code === 'CLICK_ORDER_COMPLETED'",
            timeout=6_000,
        )
        hold_seconds = round(time.time() - hold_started, 2)
        require(2.5 <= hold_seconds <= 5.5, f"Click arrival hold was not approximately three seconds: {hold_seconds}")
        steps.append(
            {
                "criterion": "physical-click-and-deterministic-hold",
                "status": "PASS",
                "target": target,
                "holdSecondsObserved": hold_seconds,
            }
        )

        # Button and P both toggle possession; WASD moves one cardinal cell.
        page.locator('.alpha-agent-card[data-profile-id="default"]').click()
        page.locator('[data-agent-action="possess"]').click()
        page.wait_for_function(
            "() => window.__SYKA_ALPHA_QA__.getSnapshot().control.possessedProfileId === 'default'"
        )
        require(page.locator(".alpha-possession-hud").is_visible(), "Possession HUD is not visible")
        page.keyboard.press("P")
        page.wait_for_function("() => !window.__SYKA_ALPHA_QA__.getSnapshot().control.possessedProfileId")
        page.keyboard.press("P")
        page.wait_for_function(
            "() => window.__SYKA_ALPHA_QA__.getSnapshot().control.possessedProfileId === 'default'"
        )
        key, expected = valid_wasd_step(page)
        page.keyboard.press(key.upper())
        wait_actor_at(page, expected)
        steps.append(
            {"criterion": "possess-button-p-and-wasd", "status": "PASS", "key": key, "cell": expected}
        )
        screenshots.append(shot(page, "02-city-possessed-1440x900.png"))

        # Aggressive physical key repeat cannot cross a blocked city edge.
        page.keyboard.press("P")
        blocked_key, edge_cell = move_to_blocked_edge(page)
        page.keyboard.press("P")
        for _ in range(14):
            page.keyboard.press(blocked_key.upper())
        page.wait_for_timeout(500)
        require(control_actor(page)["cell"] == edge_cell, "Repeated WASD crossed a city obstacle")
        steps.append(
            {"criterion": "city-key-repeat-collision", "status": "PASS", "key": blocked_key, "cell": edge_cell}
        )

        # Clicking a rendered building must not be confused with ground.
        page.keyboard.press("P")
        page.locator('.alpha-agent-card[data-profile-id="default"]').click()
        before_building_click = control_actor(page)["cell"]
        complete = next(building for building in snapshot(page)["game"]["buildings"] if building["status"] == "complete")
        point = city_client_point(page, complete["origin"])
        page.mouse.click(point["x"], point["y"])
        page.wait_for_timeout(500)
        require(control_actor(page)["cell"] == before_building_click, "Building click dispatched a ground move")
        steps.append({"criterion": "object-click-separated-from-ground", "status": "PASS"})

        # Physical F transition into the café.
        route_to_cafe_portal(page)
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
        require(snapshot(page)["control"]["possessedProfileId"] == "default", "F lost possession on entry")
        coexistence = unique_cells(page)
        require(
            all(
                page.evaluate("cell => window.__SYKA_INTERIOR__.spatial.isWalkable(cell)", actor["cell"])
                for actor in snapshot(page)["control"]["actors"]
            ),
            "An actor was seeded on blocked café furniture",
        )
        steps.append({"criterion": "f-portal-city-to-cafe", "status": "PASS", **coexistence})
        screenshots.append(shot(page, "03-cafe-entry-possessed-1440x900.png"))
        cafe_performance = sample_metrics(page)

        # First Escape releases but cannot exit the interior.
        page.keyboard.press("Escape")
        page.wait_for_function("() => !window.__SYKA_ALPHA_QA__.getSnapshot().control.possessedProfileId")
        require(snapshot(page)["game"]["camera"]["scene"] == "interior", "First Esc exited the café")
        steps.append({"criterion": "escape-releases-before-exit", "status": "PASS"})

        # Physical floor click and blocked-raster click.
        floor_target = choose_cafe_floor_target(page, minimum_distance=4)
        physical_cafe_click(page, floor_target)
        wait_actor_at(page, floor_target, timeout=20_000)
        before_blocked = control_actor(page)
        physical_cafe_click(page, {"x": 5, "y": 8})  # inside the authored bar footprint
        page.wait_for_timeout(500)
        require(control_actor(page)["cell"] == before_blocked["cell"], "Blocked café click moved the actor")
        steps.append(
            {"criterion": "cafe-click-valid-and-blocked", "status": "PASS", "validTarget": floor_target}
        )

        # E actions at three authored anchors: seating, coffee, and reading.
        interactions: list[dict[str, Any]] = []
        coffee_interaction_cell: dict[str, int] | None = None
        for name, candidate_cells, expected_action in (
            ("seat", ({"x": 22, "y": 11}, {"x": 19, "y": 9}, {"x": 12, "y": 10}), "sit"),
            ("coffee", ({"x": 5, "y": 6}, {"x": 10, "y": 9}), "serve-coffee"),
            ("read", ({"x": 18, "y": 1},), "read"),
        ):
            cell: dict[str, int] | None = None
            moved: dict[str, Any] = {"ok": False, "error": "NO_CANDIDATE"}
            for candidate in candidate_cells:
                moved = qa_call(page, "clickMove", "cafe:cafe-main", candidate["x"], candidate["y"])
                if moved.get("ok") is True:
                    cell = candidate
                    break
            require(cell is not None, f"Could not prepare {name} anchor: {moved}")
            wait_actor_at(page, cell, timeout=20_000)
            page.keyboard.press("E")
            page.wait_for_function(
                """expected => window.__SYKA_ALPHA_QA__.getSnapshot().game.agents
                  .find(agent => agent.profileId === 'default')?.location?.action === expected""",
                arg=expected_action,
                timeout=6_000,
            )
            interactions.append({"name": name, "cell": cell, "action": expected_action})
            if name == "coffee":
                coffee_interaction_cell = cell
        steps.append({"criterion": "physical-e-contextual-actions", "status": "PASS", "actions": interactions})

        # Depth frame behind the bar, then repeated-key collision from the usable coffee anchor.
        behind_bar_cell: dict[str, int] | None = None
        for candidate in ({"x": 8, "y": 6}, {"x": 6, "y": 6}, {"x": 4, "y": 6}, {"x": 10, "y": 6}):
            moved = qa_call(page, "clickMove", "cafe:cafe-main", candidate["x"], candidate["y"])
            if moved.get("ok") is True:
                behind_bar_cell = candidate
                break
        require(behind_bar_cell is not None, "No free behind-bar depth cell was available")
        wait_actor_at(page, behind_bar_cell, timeout=20_000)
        screenshots.append(shot(page, "04-cafe-behind-bar-depth-1440x900.png"))

        require(coffee_interaction_cell is not None, "Coffee anchor was not recorded")
        moved = qa_call(
            page,
            "clickMove",
            "cafe:cafe-main",
            coffee_interaction_cell["x"],
            coffee_interaction_cell["y"],
        )
        require(moved.get("ok") is True, f"Could not return to coffee collision cell: {moved}")
        coffee_cell = coffee_interaction_cell
        wait_actor_at(page, coffee_cell, timeout=20_000)
        page.keyboard.press("P")
        blocked_keys = page.evaluate(
            """cell => [['W',0,-1],['A',-1,0],['S',0,1],['D',1,0]]
              .filter(([,dx,dy]) => !window.__SYKA_INTERIOR__.spatial.isWalkable({x:cell.x+dx,y:cell.y+dy}))
              .map(([key]) => key)""",
            coffee_cell,
        )
        require(blocked_keys, f"Coffee anchor has no adjacent blocked furniture: {coffee_cell}")
        for _ in range(14):
            page.keyboard.press(blocked_keys[0])
        page.wait_for_timeout(500)
        require(control_actor(page)["cell"] == coffee_cell, "Repeated S crossed the café bar")
        page.keyboard.press("P")
        front_cell = {"x": 6, "y": 13}
        moved = qa_call(page, "clickMove", "cafe:cafe-main", front_cell["x"], front_cell["y"])
        require(moved.get("ok") is True, f"Could not reach front-of-bar cell: {moved}")
        wait_actor_at(page, front_cell, timeout=20_000)
        screenshots.append(shot(page, "05-cafe-in-front-of-bar-depth-1440x900.png"))
        steps.append({"criterion": "cafe-key-repeat-and-depth-pair", "status": "PASS"})

        # Occupied actor cells are rejected by the common occupancy contract.
        actors = snapshot(page)["control"]["actors"]
        other = next((actor for actor in actors if actor.get("profileId") != "default"), None)
        require(other is not None, "No NPC/other actor was available for occupancy QA")
        qa_call(page, "selectAgent", "default")
        occupied_result = qa_call(page, "clickMove", "cafe:cafe-main", other["cell"]["x"], other["cell"]["y"])
        require(occupied_result.get("ok") is not True, "Occupied actor cell accepted a second actor")
        coexistence_after = unique_cells(page)
        steps.append(
            {
                "criterion": "shared-occupancy-rejects-overlap",
                "status": "PASS",
                "rejection": occupied_result,
                **coexistence_after,
            }
        )

        # Editable focus suppresses P/W/E/F/Escape game controls.
        page.keyboard.press("P")
        control_before_focus = snapshot(page)["control"]
        actor_before_focus = control_actor(page)["cell"]
        page.evaluate(
            """() => {
              const input = document.createElement('input');
              input.id = 'independent-control-focus';
              input.setAttribute('aria-label', 'Independent control focus');
              document.body.append(input);
            }"""
        )
        page.locator("#independent-control-focus").click()
        for key_name in ("P", "W", "E", "F", "Escape"):
            page.keyboard.press(key_name)
        page.wait_for_timeout(300)
        require(
            snapshot(page)["control"]["possessedProfileId"] == control_before_focus["possessedProfileId"]
            and snapshot(page)["control"]["sceneId"] == control_before_focus["sceneId"]
            and control_actor(page)["cell"] == actor_before_focus,
            "Focused input leaked keyboard controls into the game",
        )
        page.evaluate("() => document.querySelector('#independent-control-focus').remove()")
        steps.append({"criterion": "editable-focus-guard", "status": "PASS"})

        # Save/reload persists the cell but never active possession.
        saved_cell = control_actor(page)["cell"]
        require(snapshot(page)["control"]["possessedProfileId"] == "default", "Expected active possession before save")
        require(qa_call(page, "save").get("ok") is True, "Save failed")
        responsive_state = context.storage_state()
        page.reload(wait_until="domcontentloaded", timeout=60_000)
        page.wait_for_function(
            "() => Boolean(window.__SYKA_ALPHA_QA__ && window.__SYKA_E2E_GAME__ && window.__SYKA_INTERIOR__)",
            timeout=30_000,
        )
        page.wait_for_function("() => window.__SYKA_ALPHA_QA__.getSnapshot().control.configured", timeout=10_000)
        require(not snapshot(page)["control"].get("possessedProfileId"), "Possession survived reload")
        require(control_actor(page)["cell"] == saved_cell, "Saved café cell was not restored")
        steps.append({"criterion": "save-load-position-no-possession", "status": "PASS", "cell": saved_cell})

        # First Esc after possession only releases; second Esc exits.
        page.locator('.alpha-agent-card[data-profile-id="default"]').click()
        page.keyboard.press("P")
        page.wait_for_function(
            "() => window.__SYKA_ALPHA_QA__.getSnapshot().control.possessedProfileId === 'default'"
        )
        page.keyboard.press("Escape")
        page.wait_for_function("() => !window.__SYKA_ALPHA_QA__.getSnapshot().control.possessedProfileId")
        require(snapshot(page)["game"]["camera"]["scene"] == "interior", "First Esc exited after reload")
        page.keyboard.press("Escape")
        page.wait_for_function(
            "() => window.__SYKA_ALPHA_QA__.getSnapshot().game.camera.scene === 'city'",
            timeout=8_000,
        )
        steps.append({"criterion": "two-stage-escape", "status": "PASS"})

        # Re-enter and physically leave with F so both portal directions are independently exercised.
        route_to_cafe_portal(page)
        page.keyboard.press("P")
        page.keyboard.press("F")
        page.wait_for_function(
            "() => window.__SYKA_ALPHA_QA__.getSnapshot().game.camera.scene === 'interior'",
            timeout=10_000,
        )
        page.wait_for_function("() => Boolean(window.__SYKA_INTERIOR__)", timeout=10_000)
        page.keyboard.press("P")  # release while standing at the entry portal
        page.keyboard.press("F")
        page.wait_for_function(
            "() => window.__SYKA_ALPHA_QA__.getSnapshot().game.camera.scene === 'city'",
            timeout=10_000,
        )
        steps.append({"criterion": "physical-f-roundtrip", "status": "PASS"})

        require(not unexpected_failed_requests(failed_requests), f"Failed requests: {failed_requests}")
        require(not bad_responses, f"HTTP errors: {bad_responses}")
        require(not audit.page_errors, f"Page errors: {audit.page_errors}")
        require(not unexpected_console(audit), f"Unexpected console: {unexpected_console(audit)}")
        require(
            bridge.requests and all(item["method"] == "GET" and not item["has_body"] for item in bridge.requests),
            f"Bridge was not strictly GET/no-body: {bridge.requests}",
        )
        steps.append({"criterion": "console-assets-and-bridge", "status": "PASS"})

        result = {
            "status": "PASS",
            "viewport": "1440x900",
            "steps": steps,
            "screenshots": screenshots,
            "performance": {"city": city_performance, "cafe": cafe_performance},
            "bridgeRequests": bridge.requests,
            "pageErrors": audit.page_errors,
            "console": audit.console,
            "failedRequests": failed_requests,
            "badResponses": bad_responses,
        }
        require(responsive_state is not None, "Responsive storage fixture was not captured")
        return result, responsive_state, bridge.requests
    finally:
        bridge.close()
        page.close()
        context.close()


def layout_metrics(page: Page, width: int, height: int) -> dict[str, Any]:
    return page.evaluate(
        """([width, height]) => {
          const canvas = window.__SYKA_E2E_GAME__.canvas;
          const canvasRect = canvas.getBoundingClientRect();
          const selectors = ['.alpha-topbar', '.alpha-agent-dock', '.alpha-panel', '.alpha-world-tools', '.alpha-possession-hud'];
          const visible = selectors.flatMap(selector => [...document.querySelectorAll(selector)])
            .filter(element => {
              const style = getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
            })
            .map(element => {
              const rect = element.getBoundingClientRect();
              return {
                className: element.className,
                x: Math.round(rect.x * 10) / 10,
                y: Math.round(rect.y * 10) / 10,
                width: Math.round(rect.width * 10) / 10,
                height: Math.round(rect.height * 10) / 10,
                intersectsViewport: rect.right > 0 && rect.bottom > 0 && rect.left < width && rect.top < height,
              };
            });
          return {
            viewport: {width, height},
            bodyScrollWidth: document.documentElement.scrollWidth,
            bodyScrollHeight: document.documentElement.scrollHeight,
            horizontalOverflow: document.documentElement.scrollWidth > width + 1,
            canvas: {
              x: canvasRect.x,
              y: canvasRect.y,
              width: canvasRect.width,
              height: canvasRect.height,
              imageRendering: getComputedStyle(canvas).imageRendering,
            },
            visibleUi: visible,
            everyVisibleUiIntersectsViewport: visible.every(item => item.intersectsViewport),
          };
        }""",
        [width, height],
    )


def exercise_responsive(
    browser: Browser,
    width: int,
    height: int,
    storage_state: dict[str, Any],
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    context, page, bridge, audit, failed_requests, bad_responses = open_context(
        browser, width, height, storage_state=storage_state
    )
    label = f"{width}x{height}"
    try:
        page.wait_for_function("() => window.__SYKA_ALPHA_QA__.getSnapshot().game.camera.scene === 'interior'", timeout=15_000)
        page.wait_for_function("() => Boolean(window.__SYKA_INTERIOR__)", timeout=15_000)
        cafe_metrics = layout_metrics(page, width, height)
        require(not cafe_metrics["horizontalOverflow"], f"Horizontal overflow in café at {label}")
        require(cafe_metrics["everyVisibleUiIntersectsViewport"], f"UI fully offscreen in café at {label}")
        cafe_shot = shot(page, f"responsive-cafe-{label}.png")
        qa_call(page, "exitCafe")
        page.wait_for_function("() => window.__SYKA_ALPHA_QA__.getSnapshot().game.camera.scene === 'city'", timeout=10_000)
        city_metrics = layout_metrics(page, width, height)
        require(not city_metrics["horizontalOverflow"], f"Horizontal overflow in city at {label}")
        require(city_metrics["everyVisibleUiIntersectsViewport"], f"UI fully offscreen in city at {label}")
        city_shot = shot(page, f"responsive-city-{label}.png")
        require(
            not unexpected_failed_requests(failed_requests),
            f"Failed requests at {label}: {failed_requests}",
        )
        require(not bad_responses, f"HTTP errors at {label}: {bad_responses}")
        require(not audit.page_errors, f"Page errors at {label}: {audit.page_errors}")
        require(not unexpected_console(audit), f"Console errors at {label}: {unexpected_console(audit)}")
        require(
            bridge.requests and all(item["method"] == "GET" and not item["has_body"] for item in bridge.requests),
            f"Bridge method/body failure at {label}: {bridge.requests}",
        )
        return (
            {
                "status": "PASS",
                "viewport": label,
                "cafe": cafe_metrics,
                "city": city_metrics,
                "screenshots": [cafe_shot, city_shot],
                "console": audit.console,
                "bridgeRequests": bridge.requests,
            },
            bridge.requests,
        )
    finally:
        bridge.close()
        page.close()
        context.close()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    started = time.time()
    payload: dict[str, Any] = {
        "status": "FAIL",
        "generatedAtEpoch": started,
        "baseUrl": BASE_URL,
        "serverStartedByAudit": False,
        "main": None,
        "responsive": [],
    }
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            main_result, storage_state, bridge_main = exercise_main(browser)
            payload["main"] = main_result
            all_bridge = list(bridge_main)
            for width, height in ((1008, 548), (2560, 1080), (640, 720)):
                result, requests = exercise_responsive(browser, width, height, storage_state)
                payload["responsive"].append(result)
                all_bridge.extend(requests)
            payload["bridgeAudit"] = {
                "count": len(all_bridge),
                "allGetWithoutBody": bool(all_bridge)
                and all(item["method"] == "GET" and not item["has_body"] for item in all_bridge),
                "requests": all_bridge,
            }
            payload["status"] = "PASS"
        except Exception as error:
            payload["error"] = f"{type(error).__name__}: {error}"
            raise
        finally:
            payload["durationSeconds"] = round(time.time() - started, 3)
            REPORT_JSON.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
            browser.close()
    print(f"PASS: {REPORT_JSON}")


if __name__ == "__main__":
    main()
