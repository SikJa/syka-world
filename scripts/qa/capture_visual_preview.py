import argparse
from pathlib import Path

from playwright.sync_api import sync_playwright


parser = argparse.ArgumentParser()
parser.add_argument("--hour", type=float, default=19.25)
args = parser.parse_args()

root = Path(__file__).resolve().parents[2]
suffix = "night" if args.hour >= 20 or args.hour < 6 else "twilight"
output = root / ".runtime" / f"visual-preview-{suffix}.png"
output.parent.mkdir(parents=True, exist_ok=True)

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto("http://127.0.0.1:5173", wait_until="networkidle")
    page.wait_for_function("document.documentElement.dataset.sykaReady === 'true'")
    page.evaluate("hour => window.__SYKA_QA__.setTime(hour)", args.hour)
    page.wait_for_timeout(500)
    page.screenshot(path=str(output))
    browser.close()
