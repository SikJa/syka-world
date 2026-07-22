import type { ControllerSnapshot } from "../application/AlphaRuntime";
import type { CardinalDirection } from "../core";
import type { CityPlacementPreview } from "../presentation/city/placement";
import { buildAlphaUiModel, formatLumenes, friendlyActionError } from "./model";
import type { AlphaUiHandle, AlphaUiOptions, InteriorHotspotUiModel, ToastTone } from "./types";

// The current authored building atlas has one true isometric view. Keeping a
// single orientation avoids fake rotations that would put doors and shadows
// on the wrong side of the road.
const ORIENTATIONS: readonly CardinalDirection[] = ["north"];

export function createAlphaUi(options: AlphaUiOptions): AlphaUiHandle {
  const { root, runtime, scene } = options;
  const document = root.ownerDocument;
  let selectedBuildingId: string | null = null;
  let selectedAgentProfileId: ControllerSnapshot["game"]["agents"][number]["profileId"] | null = null;
  let selectedWorldObjectId: string | null = null;
  let buildDefinitionId: string | null = null;
  let buildOrientation: CardinalDirection = "north";
  let paletteOpen = false;
  let catalogTab: "buildings" | "exterior" = "buildings";
  let exteriorDefinitionId: string | null = null;
  let selectedInteriorHotspot: InteriorHotspotUiModel | null = null;
  let placementPreview: CityPlacementPreview | null = null;
  let currentSnapshot = runtime.getSnapshot();
  let sectorRenderKey = "";
  let paletteRenderKey = "";
  let inspectorRenderKey = "";
  let agentsRenderKey = "";
  let lastControlNoticeRevision = -1;
  const toastTimers = new Set<number>();

  root.classList.add("syka-alpha-ui-host");
  const shell = node(document, "section", "syka-alpha-ui");
  shell.setAttribute("aria-label", "Syka World controls");
  const stopWorldInput = (event: Event): void => event.stopPropagation();
  const worldInputEvents = ["pointerdown", "pointerup", "pointermove", "pointercancel", "click", "dblclick", "wheel"] as const;
  for (const type of worldInputEvents) shell.addEventListener(type, stopWorldInput);

  const topbar = node(document, "header", "alpha-topbar");
  const brand = node(document, "div", "alpha-brand");
  brand.append(node(document, "span", "alpha-brand__spark", "✦"));
  const brandWords = node(document, "div", "alpha-brand__words");
  brandWords.append(node(document, "strong", "alpha-brand__title", "SYKA WORLD"));
  brandWords.append(node(document, "span", "alpha-brand__subtitle", "a small world in motion"));
  brand.append(brandWords);

  const balance = metric(document, "Lumens", "0 Lumens", "alpha-balance");
  const dayTime = metric(document, "Time", "Day 1 · 08:00", "alpha-daytime");

  const modeLabel = node(document, "label", "alpha-select-label");
  modeLabel.append(node(document, "span", "alpha-sr-only", "Game type"));
  const modeSelect = document.createElement("select");
  modeSelect.className = "alpha-select";
  modeSelect.setAttribute("aria-label", "Game type");
  modeSelect.append(option(document, "showcase", "Showcase town"), option(document, "progressive", "New game"));
  modeLabel.append(modeSelect);

  const bridgePill = node(document, "div", "alpha-bridge-pill");
  bridgePill.setAttribute("role", "status");
  bridgePill.setAttribute("aria-live", "polite");
  bridgePill.append(node(document, "span", "alpha-bridge-pill__dot"));
  const bridgeText = node(document, "span", "alpha-bridge-pill__text", "Local life");
  bridgePill.append(bridgeText);

  const speedGroup = node(document, "div", "alpha-speed-group");
  speedGroup.setAttribute("role", "group");
  speedGroup.setAttribute("aria-label", "Time speed");
  const speedButtons = new Map<0 | 1 | 2 | 4, HTMLButtonElement>();
  for (const [speed, label] of [[0, "Ⅱ"], [1, "1×"], [2, "2×"], [4, "4×"]] as const) {
    const control = button(document, `alpha-speed alpha-speed--${speed}`, label, () => runtime.actions.setClockSpeed(speed));
    control.title = speed === 0 ? "Pause" : `Speed ${speed}`;
    control.setAttribute("aria-label", speed === 0 ? "Pause time" : `Speed ${speed}`);
    speedButtons.set(speed, control);
    speedGroup.append(control);
  }

  const worldStatus = node(document, "div", "alpha-world-status");
  worldStatus.append(balance.wrapper, dayTime.wrapper);
  const sessionControls = node(document, "div", "alpha-session-controls");
  sessionControls.append(modeLabel, bridgePill, speedGroup);
  topbar.append(brand, worldStatus, sessionControls);

  const palettePanel = node(document, "aside", "alpha-panel alpha-palette");
  palettePanel.setAttribute("aria-label", "Places to build");
  palettePanel.hidden = true;
  const paletteHeader = node(document, "div", "alpha-palette__header");
  const paletteHeading = panelHeading(document, "Build", "Choose a place and mark its terrain");
  const paletteClose = button(document, "alpha-icon-button alpha-palette__close", "×", () => setPaletteOpen(false));
  paletteClose.setAttribute("aria-label", "Close build catalog");
  paletteHeader.append(paletteHeading, paletteClose);
  const paletteTabs = node(document, "div", "alpha-catalog-tabs");
  paletteTabs.setAttribute("role", "tablist");
  paletteTabs.setAttribute("aria-label", "Build categories");
  const buildingsTab = button(document, "alpha-catalog-tab", "Buildings", () => setCatalogTab("buildings"));
  buildingsTab.setAttribute("role", "tab");
  const exteriorTab = button(document, "alpha-catalog-tab", "Exterior", () => setCatalogTab("exterior"));
  exteriorTab.setAttribute("role", "tab");
  paletteTabs.append(buildingsTab, exteriorTab);
  const paletteList = node(document, "div", "alpha-palette__list");
  const sectorSlot = node(document, "div", "alpha-sector-slot");
  palettePanel.append(paletteHeader, paletteTabs, paletteList, sectorSlot);

  const inspectorPanel = node(document, "aside", "alpha-panel alpha-inspector");
  inspectorPanel.setAttribute("aria-label", "Place detail");
  const inspectorContent = node(document, "div", "alpha-inspector__content");
  inspectorPanel.append(inspectorContent);

  const agentStrip = node(document, "section", "alpha-agent-strip");
  agentStrip.setAttribute("aria-label", "Town inhabitants");
  const agentList = node(document, "div", "alpha-agent-strip__list");
  agentStrip.append(agentList);

  const possessionHud = node(document, "section", "alpha-possession-hud");
  possessionHud.setAttribute("aria-live", "polite");
  possessionHud.hidden = true;

  const controls = node(document, "nav", "alpha-action-rail");
  controls.setAttribute("aria-label", "World actions");
  const buildButton = actionButton(document, "Build", "B", "Open build catalog", runPrimaryWorldAction);
  buildButton.classList.add("alpha-action--build");
  buildButton.setAttribute("aria-expanded", "false");
  buildButton.dataset.action = "build-or-return";
  const referencesButton = button(document, "alpha-reference-trigger", "References", openReferenceGallery);
  referencesButton.setAttribute("aria-haspopup", "dialog");
  referencesButton.setAttribute("aria-controls", "alpha-reference-gallery");
  referencesButton.setAttribute("aria-expanded", "false");
  const exploreButton = actionButton(document, "Explore", "⌁", "Back to exploring", () => clearBuildTool(true));
  const rotateButton = actionButton(document, "Fixed view", "R", "Building perspective is fixed", rotateBuildTool);
  rotateButton.title = "Fixed isometric view: keeps doors, shadows and access points aligned.";
  const cancelButton = actionButton(document, "Cancel", "Esc", "Cancel construction", () => clearBuildTool(false));
  const agentsButton = actionButton(document, "Hide", "H", "Hide inhabitants", toggleAgents);
  const saveButton = actionButton(document, "Save", "⌘S", "Save game", saveGame);
  const loadButton = actionButton(document, "Load", "↻", "Load game", loadGame);
  const resetButton = actionButton(document, "Reset", "!", "Reset game", resetGame);
  controls.append(buildButton, referencesButton, exploreButton, rotateButton, cancelButton, agentsButton, saveButton, loadButton, resetButton);

  const referenceModal = node(document, "div", "alpha-reference-modal");
  referenceModal.id = "alpha-reference-gallery";
  referenceModal.hidden = true;
  referenceModal.setAttribute("role", "dialog");
  referenceModal.setAttribute("aria-modal", "true");
  referenceModal.setAttribute("aria-labelledby", "alpha-reference-gallery-title");
  const referenceDialog = node(document, "section", "alpha-reference-dialog");
  const referenceHeader = node(document, "header", "alpha-reference-dialog__header");
  const referenceHeading = node(document, "div", "alpha-reference-dialog__heading");
  const referenceKicker = node(document, "span", "alpha-kicker", "Approved visual direction");
  const referenceTitle = node(document, "h2", "alpha-reference-dialog__title", "Syka World maquettes");
  referenceTitle.id = "alpha-reference-gallery-title";
  referenceHeading.append(referenceKicker, referenceTitle);
  const referenceClose = button(document, "alpha-icon-button alpha-reference-dialog__close", "×", closeReferenceGallery);
  referenceClose.setAttribute("aria-label", "Close visual references");
  referenceHeader.append(referenceHeading, referenceClose);
  const referenceIntro = node(
    document,
    "p",
    "alpha-reference-dialog__intro",
    "These images guide detail, lighting and composition. They are not flat game backgrounds.",
  );
  const referenceGrid = node(document, "div", "alpha-reference-grid");
  const referenceImages = [
    ["city-layout-a-twilight.png", "Main town at twilight", "Exterior quality and warm lighting"],
    ["cafe-interior-library.png", "Reference Cafe Library", "Interior density, wood and books"],
    ["city-layout-b-main-street.png", "Town with main street", "Free layout with side plaza"],
    ["city-layout-c-green-districts.png", "Town of green districts", "Micro-districts, vegetation and paths"],
  ] as const;
  for (const [fileName, alt, caption] of referenceImages) {
    const figure = node(document, "figure", "alpha-reference-card");
    const image = document.createElement("img");
    image.className = "alpha-reference-card__image";
    image.src = `/assets/reference/${fileName}`;
    image.alt = alt;
    image.loading = "lazy";
    image.decoding = "async";
    figure.append(image, node(document, "figcaption", "alpha-reference-card__caption", caption));
    referenceGrid.append(figure);
  }
  const referenceFooter = node(document, "footer", "alpha-reference-dialog__footer");
  referenceFooter.append(node(document, "span", "alpha-reference-dialog__note", "The playable town remains open behind this gallery."));
  const historicalGateLink = document.createElement("a");
  historicalGateLink.className = "alpha-reference-dialog__gate";
  historicalGateLink.href = "?gate=1";
  historicalGateLink.target = "_blank";
  historicalGateLink.rel = "noopener noreferrer";
  historicalGateLink.textContent = "Open historical maquette ↗";
  referenceFooter.append(historicalGateLink);
  referenceDialog.append(referenceHeader, referenceIntro, referenceGrid, referenceFooter);
  referenceModal.append(referenceDialog);
  referenceModal.addEventListener("click", (event) => {
    if (event.target === referenceModal) closeReferenceGallery();
  });

  const toastRegion = node(document, "div", "alpha-toasts");
  toastRegion.setAttribute("aria-live", "polite");
  toastRegion.setAttribute("aria-atomic", "false");

  const placementReceipt = node(document, "aside", "alpha-placement-receipt");
  placementReceipt.setAttribute("aria-live", "polite");
  placementReceipt.hidden = true;

  const developmentPanel = runtime.development ? createDevelopmentPanel(document) : null;
  shell.append(topbar, palettePanel, inspectorPanel, placementReceipt, possessionHud, agentStrip, controls, referenceModal);
  if (developmentPanel) shell.append(developmentPanel);
  shell.append(toastRegion);
  root.append(shell);

  modeSelect.addEventListener("change", () => changeMode(modeSelect.value === "progressive" ? "progressive" : "showcase"));
  const keyListener = (event: KeyboardEvent) => handleKeyboard(event);
  document.addEventListener("keydown", keyListener);
  const unsubscribe = runtime.subscribe((snapshot) => {
    currentSnapshot = snapshot;
    renderSnapshot(snapshot);
  });

  function renderSnapshot(snapshot: ControllerSnapshot): void {
    const notice = snapshot.control.notice;
    if (notice && notice.revision > lastControlNoticeRevision) {
      lastControlNoticeRevision = notice.revision;
      showToast(notice.message, notice.tone === "info" ? "warm" : "warning");
    }
    const model = buildAlphaUiModel(snapshot, selectedBuildingId, selectedAgentProfileId, selectedWorldObjectId);
    const isInterior = model.scene === "interior";
    balance.value.textContent = model.balanceLabel;
    dayTime.value.textContent = model.dayTimeLabel;
    modeSelect.value = model.mode;
    bridgeText.textContent = model.bridgeLabel;
    bridgePill.dataset.mode = model.bridgeMode;
    bridgePill.title = model.bridgeHint;
    bridgePill.setAttribute("aria-label", `${model.bridgeLabel}. ${model.bridgeHint}`);
    for (const [speed, control] of speedButtons) {
      const active = speed === model.speed;
      control.classList.toggle("is-active", active);
      control.setAttribute("aria-pressed", String(active));
    }
    agentsButton.querySelector(".alpha-action__label")!.textContent = model.agentsVisible ? "Hide" : "Show";
    agentsButton.setAttribute("aria-label", model.agentsVisible ? "Hide inhabitants" : "Show inhabitants");
    rotateButton.disabled = true;
    cancelButton.disabled = buildDefinitionId === null && exteriorDefinitionId === null;
    if (isInterior) paletteOpen = false;
    const buildLabel = buildButton.querySelector<HTMLElement>(".alpha-action__label");
    const buildKey = buildButton.querySelector<HTMLElement>(".alpha-action__key");
    if (buildLabel) buildLabel.textContent = isInterior ? "Back to town" : "Build";
    if (buildKey) buildKey.textContent = isInterior ? "↩" : "B";
    buildButton.classList.toggle("alpha-action--return", isInterior);
    buildButton.classList.toggle("is-active", !isInterior && (paletteOpen || buildDefinitionId !== null || exteriorDefinitionId !== null));
    buildButton.setAttribute("aria-label", isInterior ? "Back to town" : "Open build catalog");
    buildButton.setAttribute("aria-expanded", String(!isInterior && paletteOpen));
    palettePanel.hidden = !paletteOpen || isInterior;
    renderPalette(model);
    renderSector(model);
    renderInspector(model);
    renderAgents(model);
    renderPossession(snapshot, model);
    renderPlacementReceipt(model);
  }

  function renderPossession(snapshot: ControllerSnapshot, model: ReturnType<typeof buildAlphaUiModel>): void {
    const profileId = snapshot.control.possessedProfileId;
    const actor = profileId ? model.agents.find((candidate) => candidate.profileId === profileId) : undefined;
    if (!profileId || !actor) {
      possessionHud.hidden = true;
      possessionHud.replaceChildren();
      return;
    }
    const heading = node(document, "span", "alpha-possession-hud__heading", "POSEYENDO");
    const name = node(document, "strong", "alpha-possession-hud__name", actor.name);
    const keys = node(document, "span", "alpha-possession-hud__keys");
    for (const [key, label] of [["WASD", "mover"], ["E", "usar"], ["F", "puerta"], ["Esc", "liberar"]] as const) {
      const item = node(document, "span", "alpha-possession-hud__key");
      item.append(node(document, "kbd", "", key), document.createTextNode(label));
      keys.append(item);
    }
    possessionHud.replaceChildren(heading, name, keys);
    possessionHud.hidden = false;
  }

  function renderPlacementReceipt(model: ReturnType<typeof buildAlphaUiModel>): void {
    const preview = placementPreview;
    if (!preview || model.scene === "interior") {
      placementReceipt.hidden = true;
      placementReceipt.replaceChildren();
      return;
    }
    const definition = model.palette.find((item) => item.id === preview.definitionId);
    const heading = node(document, "div", "alpha-placement-receipt__heading");
    heading.append(
      node(document, "span", "alpha-kicker", preview.valid ? "Plan listo" : "Revisá el terreno"),
      node(document, "strong", "alpha-placement-receipt__title", definition?.name ?? "Nueva construcción"),
    );
    const costs = node(document, "div", "alpha-placement-receipt__costs");
    const rows: Array<readonly [string, number]> = [
      ["Edificio", preview.costs.building],
      ["Camino", preview.costs.road],
      ["Retiro", preview.costs.cleanup],
    ];
    for (const [label, value] of rows) {
      if (value <= 0 && label !== "Edificio") continue;
      const row = node(document, "span", "alpha-placement-receipt__row");
      row.append(node(document, "span", "", label), node(document, "strong", "", formatLumenes(value)));
      costs.append(row);
    }
    const total = node(document, "span", "alpha-placement-receipt__total");
    total.append(node(document, "span", "", "Total"), node(document, "strong", "", formatLumenes(preview.costs.total)));
    costs.append(total);
    const detail = node(
      document,
      "p",
      "alpha-placement-receipt__detail",
      preview.valid
        ? `${preview.roadTiles.length} tramos de camino · ${preview.removedObjectIds.length} objetos a retirar · click para confirmar`
        : preview.errors.includes("INSUFFICIENT_FUNDS")
          ? `Faltan ${formatLumenes(Math.max(0, preview.costs.total - currentSnapshot.game.economy.balance))}`
          : preview.errors.map(placementErrorLabel).join(" "),
    );
    placementReceipt.dataset.valid = String(preview.valid);
    placementReceipt.replaceChildren(heading, costs, detail);
    placementReceipt.hidden = false;
  }

  function renderSector(model: ReturnType<typeof buildAlphaUiModel>): void {
    const renderKey = JSON.stringify(model.lockedSector);
    if (renderKey === sectorRenderKey) return;
    sectorRenderKey = renderKey;
    const sector = model.lockedSector;
    if (!sector) {
      const complete = node(document, "div", "alpha-sector-card alpha-sector-card--complete");
      complete.append(
        node(document, "span", "alpha-sector-card__icon", "✓"),
        node(document, "span", "alpha-sector-card__copy", "All visible sectors are open"),
      );
      sectorSlot.replaceChildren(complete);
      return;
    }
    const card = node(document, "div", "alpha-sector-card");
    const copy = node(document, "div", "alpha-sector-card__body");
    copy.append(
      node(document, "span", "alpha-kicker", "Nueva zona"),
      node(document, "strong", "alpha-sector-card__name", sector.name),
      node(document, "span", "alpha-sector-card__state", sector.stateLabel),
    );
    const unlock = button(
      document,
      "alpha-sector-card__button",
      `Abrir · ${formatLumenes(sector.cost)}`,
      () => unlockSector(sector.id, sector.name),
    );
    unlock.disabled = !sector.affordable;
    unlock.dataset.sectorId = sector.id;
    unlock.setAttribute("aria-label", `Desbloquear ${sector.name} por ${formatLumenes(sector.cost)}`);
    card.append(copy, unlock);
    sectorSlot.replaceChildren(card);
  }

  function renderPalette(model: ReturnType<typeof buildAlphaUiModel>): void {
    const renderKey = JSON.stringify([
      catalogTab,
      model.palette,
      model.exteriorPalette,
      buildDefinitionId,
      exteriorDefinitionId,
    ]);
    if (renderKey === paletteRenderKey) return;
    paletteRenderKey = renderKey;
    const buildingsSelected = catalogTab === "buildings";
    buildingsTab.classList.toggle("is-active", buildingsSelected);
    exteriorTab.classList.toggle("is-active", !buildingsSelected);
    buildingsTab.setAttribute("aria-selected", String(buildingsSelected));
    exteriorTab.setAttribute("aria-selected", String(!buildingsSelected));
    sectorSlot.hidden = !buildingsSelected;
    if (!buildingsSelected) {
      const items = model.exteriorPalette.map((item) => {
        const control = button(document, "alpha-build-card alpha-exterior-card", "", () => chooseExteriorTool(item.id));
        control.disabled = !item.affordable;
        control.dataset.exteriorId = item.id;
        control.dataset.category = item.category;
        control.classList.toggle("is-selected", exteriorDefinitionId === item.id);
        control.setAttribute("aria-pressed", String(exteriorDefinitionId === item.id));
        control.title = `${item.description} · ${item.placementHint}`;
        const icon = node(document, "span", "alpha-build-card__icon", item.icon);
        icon.setAttribute("aria-hidden", "true");
        const copy = node(document, "span", "alpha-build-card__copy");
        copy.append(
          node(document, "span", "alpha-build-card__name", item.name),
          node(document, "span", "alpha-build-card__cost", formatLumenes(item.cost)),
        );
        const hint = node(document, "span", "alpha-build-card__lock", item.placementHint === "Open grass" ? "·" : "⌁");
        hint.title = item.placementHint;
        control.append(icon, copy, hint);
        return control;
      });
      paletteList.replaceChildren(...items);
      return;
    }
    const items = model.palette.map((item) => {
      const control = button(document, "alpha-build-card", "", () => chooseBuildTool(item.id));
      control.disabled = !item.unlocked || !item.affordable;
      control.dataset.kind = item.kind;
      control.classList.toggle("is-selected", buildDefinitionId === item.id);
      control.setAttribute("aria-pressed", String(buildDefinitionId === item.id));
      const title = node(document, "span", "alpha-build-card__name", item.name);
      const icon = node(document, "span", "alpha-build-card__icon", item.icon);
      icon.setAttribute("aria-hidden", "true");
      const cost = node(document, "span", "alpha-build-card__cost", formatLumenes(item.cost));
      const copy = node(document, "span", "alpha-build-card__copy");
      copy.append(title, cost);
      control.append(icon, copy);
      if (item.disabledReason) {
        const lock = node(document, "span", "alpha-build-card__lock", item.unlocked ? "◌" : "◆");
        lock.title = item.disabledReason;
        lock.setAttribute("aria-label", item.disabledReason);
        control.append(lock);
        control.title = item.disabledReason;
      }
      return control;
    });
    paletteList.replaceChildren(...items);
  }

  function renderInspector(model: ReturnType<typeof buildAlphaUiModel>): void {
    const renderKey = JSON.stringify([
      model.scene,
      model.selectedBuilding,
      model.selectedAgent,
      model.selectedWorldObject,
      model.interiorShop,
      selectedInteriorHotspot,
      currentSnapshot.control.possessedProfileId ?? null,
    ]);
    if (renderKey === inspectorRenderKey) return;
    inspectorRenderKey = renderKey;
    if (model.interiorShop && selectedInteriorHotspot) {
      inspectorPanel.hidden = false;
      renderInteriorInteraction(model.interiorShop, selectedInteriorHotspot);
      return;
    }
    if (model.selectedAgent) {
      inspectorPanel.hidden = false;
      inspectorPanel.dataset.state = "agent";
      renderSelectedAgent(model.selectedAgent);
      return;
    }
    if (model.selectedWorldObject) {
      inspectorPanel.hidden = false;
      inspectorPanel.dataset.state = "world-object";
      renderSelectedWorldObject(model.selectedWorldObject);
      return;
    }
    if (model.interiorShop) {
      inspectorPanel.hidden = false;
      renderInteriorShop(model.interiorShop);
      return;
    }
    const selected = model.selectedBuilding;
    if (!selected) {
      inspectorPanel.hidden = model.scene !== "interior";
      const empty = node(document, "div", "alpha-inspector-empty");
      empty.append(
        node(document, "span", "alpha-inspector-empty__glyph", model.scene === "interior" ? "⌂" : "✦"),
        node(document, "h2", "alpha-inspector-empty__title", model.scene === "interior" ? "Inside the cafe" : "Take a closer look"),
        node(
          document,
          "p",
          "alpha-inspector-empty__copy",
          model.scene === "interior"
            ? "Furniture is already set up. Return to town whenever you want."
            : "Select a building or an inhabitant to see what is happening.",
        ),
      );
      if (model.scene === "interior") {
        empty.append(button(document, "alpha-button alpha-button--primary", "Back to town", exitInterior));
      }
      inspectorContent.replaceChildren(empty);
      return;
    }

    inspectorPanel.hidden = false;


    const heading = node(document, "div", "alpha-inspector-heading");
    const headingCopy = node(document, "div", "alpha-inspector-heading__copy");
    headingCopy.append(
      node(document, "span", "alpha-kicker", selected.statusLabel),
      node(document, "h2", "alpha-inspector-title", selected.name),
    );
    heading.append(headingCopy, node(document, "span", "alpha-level-badge", `Nv. ${selected.level}`));
    const description = node(document, "p", "alpha-inspector-description", selected.description);
    const progress = node(document, "div", "alpha-progress");
    progress.setAttribute("role", "progressbar");
    progress.setAttribute("aria-label", "Progreso de construcción");
    progress.setAttribute("aria-valuemin", "0");
    progress.setAttribute("aria-valuemax", "100");
    progress.setAttribute("aria-valuenow", String(Math.round(selected.progress * 100)));
    const progressFill = node(document, "span", "alpha-progress__fill");
    progressFill.style.setProperty("--progress", `${Math.round(selected.progress * 100)}%`);
    progress.append(progressFill);
    const progressLabel = node(document, "span", "alpha-progress-label", selected.progressLabel);
    const occupancy = node(document, "div", "alpha-occupancy");
    occupancy.append(node(document, "span", "alpha-kicker", "Ahora"));
    occupancy.append(node(document, "strong", "alpha-occupancy__label", selected.occupancyLabel));
    if (selected.occupants.length > 0) {
      const list = node(document, "div", "alpha-occupancy__list");
      for (const occupant of selected.occupants) {
        const item = node(document, "span", "alpha-occupancy__person");
        item.append(
          node(document, "strong", "alpha-occupancy__name", occupant.name),
          node(document, "span", "alpha-occupancy__activity", occupant.activityLabel),
        );
        list.append(item);
      }
      occupancy.append(list);
    }
    const actions = node(document, "div", "alpha-inspector-actions");
    if (selected.canEnterCafe) {
      actions.append(button(document, "alpha-button alpha-button--primary", "Enter Cafe Library", enterSelectedCafe));
    }
    if (selected.upgradeId && selected.upgradeName) {
      const upgrade = button(
        document,
        "alpha-button alpha-button--secondary",
        selected.upgradeInProgress
          ? "Mejora en marcha"
          : `${selected.upgradeName} · ${formatLumenes(selected.upgradeCost ?? 0)}`,
        upgradeSelectedBuilding,
      );
      upgrade.disabled = !selected.upgradeAvailable;
      actions.append(upgrade);
    }
    for (const acceleration of selected.acceleration) {
      const label = acceleration.mode === "one-hour"
        ? `${acceleration.advancedMinutes < 60 ? `Speed up ${acceleration.advancedMinutes} min` : "Speed up 1 hour"} · ${formatLumenes(acceleration.cost)}`
        : `Terminar ahora · ${formatLumenes(acceleration.cost)}`;
      const accelerate = button(
        document,
        acceleration.mode === "finish-now"
          ? "alpha-button alpha-button--primary"
          : "alpha-button alpha-button--secondary",
        label,
        () => accelerateSelectedBuilding(acceleration.mode),
      );
      accelerate.dataset.constructionAction = acceleration.mode;
      accelerate.disabled = !acceleration.affordable;
      actions.append(accelerate);
    }
    inspectorContent.replaceChildren(heading, description, progress, progressLabel, occupancy, actions);
  }

  function renderSelectedAgent(agent: NonNullable<ReturnType<typeof buildAlphaUiModel>["selectedAgent"]>): void {
    const heading = node(document, "div", "alpha-inspector-heading alpha-agent-detail__heading");
    const portrait = node(document, "span", "alpha-agent-detail__portrait", agent.initials);
    const copy = node(document, "div", "alpha-inspector-heading__copy");
    copy.append(
      node(document, "span", "alpha-kicker", agent.presenceLabel),
      node(document, "h2", "alpha-inspector-title", agent.name),
    );
    heading.append(portrait, copy);
    const role = node(document, "p", "alpha-inspector-description", agent.role);
    const phase = node(document, "div", "alpha-agent-detail__phase");
    phase.dataset.traveling = String(agent.traveling);
    phase.append(
      node(document, "span", "alpha-agent-detail__pulse"),
      node(document, "strong", "alpha-agent-detail__phase-label", agent.phaseLabel),
    );
    const route = node(
      document,
      "p",
      "alpha-agent-detail__route",
      agent.traveling
        ? `${agent.pathRemaining} tramos hasta ${agent.destinationLabel}`
        : agent.locationLabel,
    );
    const summary = node(
      document,
      "p",
      "alpha-agent-detail__summary",
      agent.summary ?? (agent.activeSessionCount > 0
        ? "Hay una tarea activa observada en Hermes."
        : agent.traveling
          ? "Following its routine around town."
          : "Sin una tarea activa de Hermes."),
    );
    const actions = node(document, "div", "alpha-inspector-actions");
    const possessed = currentSnapshot.control.possessedProfileId === agent.profileId;
    const possess = button(
      document,
      possessed ? "alpha-button alpha-button--possessed" : "alpha-button alpha-button--primary",
      possessed ? "Release" : "Possess",
      () => toggleLocalPossession(agent.profileId),
    );
    possess.dataset.agentAction = possessed ? "release-possession" : "possess";
    possess.setAttribute("aria-pressed", String(possessed));
    actions.append(possess);
    if (agent.canGoToCafe) {
      const goToCafe = button(document, "alpha-button alpha-button--primary", "Ir al Café", () => sendSelectedAgentToCafe(agent.profileId));
      goToCafe.dataset.agentAction = "go-to-cafe";
      actions.append(goToCafe);
    }
    if (agent.canReturnToCity) {
      const returnToCity = button(document, "alpha-button alpha-button--secondary", "Exit to town", () => returnSelectedAgentToCity(agent.profileId));
      returnToCity.dataset.agentAction = "return-to-city";
      actions.append(returnToCity);
    }
    if (agent.localOrderLabel || agent.interiorActionLabel) {
      const localState = node(
        document,
        "p",
        "alpha-agent-detail__local-order",
        agent.interiorActionLabel ?? agent.localOrderLabel ?? "",
      );
      inspectorContent.replaceChildren(heading, role, phase, route, localState, summary, actions);
      return;
    }
    inspectorContent.replaceChildren(heading, role, phase, route, summary, actions);
  }

  function renderSelectedWorldObject(
    object: NonNullable<ReturnType<typeof buildAlphaUiModel>["selectedWorldObject"]>,
  ): void {
    const heading = node(document, "div", "alpha-inspector-heading");
    const copy = node(document, "div", "alpha-inspector-heading__copy");
    copy.append(
      node(document, "span", "alpha-kicker", object.provenanceLabel),
      node(document, "h2", "alpha-inspector-title", object.name),
    );
    heading.append(copy, node(document, "span", "alpha-level-badge", "Exterior"));
    const description = node(document, "p", "alpha-inspector-description", object.description);
    const placement = node(document, "p", "alpha-agent-detail__route", object.placementLabel);
    const actions = node(document, "div", "alpha-inspector-actions");
    const label = object.refund > 0 ? `Retirar · +${formatLumenes(object.refund)}` : "Remove";
    const remove = button(document, "alpha-button alpha-button--secondary", label, () => removeSelectedWorldObject(object.instanceId));
    remove.dataset.worldObjectAction = "remove";
    remove.disabled = !object.removable;
    actions.append(remove);
    inspectorContent.replaceChildren(heading, description, placement, actions);
  }

  function renderInteriorShop(shop: NonNullable<ReturnType<typeof buildAlphaUiModel>["interiorShop"]>): void {
    const heading = node(document, "div", "alpha-inspector-heading");
    const headingCopy = node(document, "div", "alpha-inspector-heading__copy");
    headingCopy.append(
      node(document, "span", "alpha-kicker", "Interior amueblado"),
      node(document, "h2", "alpha-inspector-title", shop.name),
    );
    heading.append(headingCopy, node(document, "span", "alpha-level-badge", "Inside"));
    const description = node(
      document,
      "p",
      "alpha-inspector-description",
      "Todo lo esencial ya está listo. Estos rincones opcionales son sólo para darle tu toque.",
    );
    const optionsList = node(document, "div", "alpha-furniture-list");
    if (shop.options.length === 0) {
      optionsList.append(node(document, "p", "alpha-furniture-empty", "No optional corners in this place."));
    } else {
      for (const option of shop.options) {
        const control = button(
          document,
          "alpha-furniture-card",
          "",
          () => installFurniture(shop.buildingId, option.slotId, option.furnitureId, option.name),
        );
        control.dataset.slotId = option.slotId;
        control.dataset.furnitureId = option.furnitureId;
        control.disabled = option.installed || !option.affordable;
        const copy = node(document, "span", "alpha-furniture-card__copy");
        copy.append(
          node(document, "strong", "alpha-furniture-card__name", option.name),
          node(document, "span", "alpha-furniture-card__slot", option.slotLabel),
        );
        const state = node(
          document,
          "span",
          "alpha-furniture-card__price",
          option.installed ? "Instalado" : option.affordable ? formatLumenes(option.price) : "Sin saldo",
        );
        control.append(copy, state);
        optionsList.append(control);
      }
    }
    const back = button(document, "alpha-button alpha-button--secondary", "Back to town", exitInterior);
    inspectorContent.replaceChildren(heading, description, optionsList, back);
  }

  function renderInteriorInteraction(
    shop: NonNullable<ReturnType<typeof buildAlphaUiModel>["interiorShop"]>,
    hotspot: InteriorHotspotUiModel,
  ): void {
    const heading = node(document, "div", "alpha-inspector-heading");
    const headingCopy = node(document, "div", "alpha-inspector-heading__copy");
    headingCopy.append(
      node(document, "span", "alpha-kicker", shop.name),
      node(document, "h2", "alpha-inspector-title", hotspot.label),
    );
    heading.append(headingCopy, node(document, "span", "alpha-level-badge", "Acciones"));
    const description = node(document, "p", "alpha-inspector-description", hotspot.description);
    const actions = node(document, "div", "alpha-interior-actions");
    for (const action of hotspot.actions) {
      const control = button(document, "alpha-button alpha-button--primary", action.label, () => {
        const accepted = selectedAgentProfileId
          ? scene.runInteriorAction(selectedAgentProfileId, hotspot.id, action.id)
          : false;
        showToast(
          accepted ? `${action.label}: acción en marcha.` : "First select an inhabitant inside the cafe.",
          accepted ? "success" : "warning",
        );
      });
      control.dataset.interiorAction = action.id;
      actions.append(control);
    }
    const back = button(document, "alpha-button alpha-button--secondary", "Ver decoración", () => {
      selectedInteriorHotspot = null;
      inspectorRenderKey = "";
      renderSnapshot(currentSnapshot);
    });
    inspectorContent.replaceChildren(heading, description, actions, back);
  }

  function renderAgents(model: ReturnType<typeof buildAlphaUiModel>): void {
    const renderKey = JSON.stringify([
      model.agentsVisible,
      model.agents,
      model.selectedAgent?.profileId ?? null,
      currentSnapshot.control.possessedProfileId ?? null,
    ]);
    if (renderKey === agentsRenderKey) return;
    agentsRenderKey = renderKey;
    const cards = model.agents.map((agent) => {
      const control = button(document, "alpha-agent-card", "", () => {
        selectedAgentProfileId = agent.profileId;
        runtime.actions.selectProfile(agent.profileId);
        selectedBuildingId = null;
        scene.focusAgent(agent.profileId);
        renderSnapshot(currentSnapshot);
      });
      control.dataset.profileId = agent.profileId;
      control.dataset.presence = agent.presence;
      control.dataset.traveling = String(agent.traveling);
      control.classList.toggle("is-selected", selectedAgentProfileId === agent.profileId);
      control.classList.toggle("is-possessed", currentSnapshot.control.possessedProfileId === agent.profileId);
      control.dataset.possessed = String(currentSnapshot.control.possessedProfileId === agent.profileId);
      control.setAttribute("aria-label", `${agent.name}. ${agent.phaseLabel}. ${agent.presenceLabel}.`);
      const portrait = node(document, "span", "alpha-agent-card__portrait", agent.initials);
      portrait.setAttribute("aria-hidden", "true");
      const copy = node(document, "span", "alpha-agent-card__copy");
      const name = node(document, "strong", "alpha-agent-card__name", agent.name);
      const activity = node(document, "span", "alpha-agent-card__activity", agent.phaseLabel);
      const presence = node(document, "span", "alpha-agent-card__presence", agent.presenceLabel);
      copy.append(name, activity, presence);
      control.append(portrait, copy);
      if (agent.activeSessionCount > 1) {
        const count = node(document, "span", "alpha-agent-card__count", String(agent.activeSessionCount));
        count.setAttribute("aria-label", `${agent.activeSessionCount} tareas activas`);
        control.append(count);
      }
      if (agent.summary) {
        const summary = node(document, "span", "alpha-agent-card__summary", agent.summary);
        control.append(summary);
      }
      return control;
    });
    agentList.replaceChildren(...cards);
    agentStrip.hidden = !model.agentsVisible;
  }

  function chooseBuildTool(definitionId: string): void {
    buildDefinitionId = definitionId;
    exteriorDefinitionId = null;
    selectedAgentProfileId = null;
    selectedBuildingId = null;
    selectedWorldObjectId = null;
    scene.setExteriorTool(null);
    scene.selectWorldObject(null);
    scene.setBuildTool(definitionId, buildOrientation);
    setPaletteOpen(false);
    showToast("Choose a free tile near the road.", "warm");
    renderSnapshot(currentSnapshot);
  }

  function chooseExteriorTool(definitionId: string): void {
    buildDefinitionId = null;
    exteriorDefinitionId = definitionId;
    selectedAgentProfileId = null;
    selectedBuildingId = null;
    selectedWorldObjectId = null;
    scene.setBuildTool(null, buildOrientation);
    scene.selectWorldObject(null);
    const accepted = scene.setExteriorTool(definitionId);
    if (!accepted) {
      exteriorDefinitionId = null;
      showToast("El catálogo exterior todavía no está disponible.", "warning");
      return;
    }
    setPaletteOpen(false);
    showToast("Choose a grass tile to place it.", "warm");
    renderSnapshot(currentSnapshot);
  }

  function rotateBuildTool(): void {
    if (!buildDefinitionId) return;
    const current = ORIENTATIONS.indexOf(buildOrientation);
    buildOrientation = ORIENTATIONS[(current + 1) % ORIENTATIONS.length] ?? "south";
    scene.rotateBuildTool(buildOrientation);
    showToast(`Orientación: ${orientationLabel(buildOrientation)}.`, "warm");
  }

  function clearBuildTool(explore: boolean): void {
    buildDefinitionId = null;
    exteriorDefinitionId = null;
    setPaletteOpen(false);
    scene.setBuildTool(null, buildOrientation);
    scene.setExteriorTool(null);
    scene.cancelBuildTool();
    if (explore) showToast("Explore mode: the town is all yours.", "warm");
    renderSnapshot(currentSnapshot);
  }

  function runPrimaryWorldAction(): void {
    if (currentSnapshot.game.camera.scene === "interior") {
      if (currentSnapshot.control.possessedProfileId) {
        releaseLocalPossession("button");
        return;
      }
      exitInterior();
      return;
    }
    setPaletteOpen(!paletteOpen);
  }

  function setPaletteOpen(open: boolean): void {
    if (currentSnapshot.game.camera.scene === "interior") {
      paletteOpen = false;
      palettePanel.hidden = true;
      buildButton.setAttribute("aria-expanded", "false");
      return;
    }
    paletteOpen = open;
    palettePanel.hidden = !open;
    buildButton.classList.toggle("is-active", open || buildDefinitionId !== null || exteriorDefinitionId !== null);
    buildButton.setAttribute("aria-expanded", String(open));
  }

  function setCatalogTab(tab: "buildings" | "exterior"): void {
    catalogTab = tab;
    paletteRenderKey = "";
    renderSnapshot(currentSnapshot);
  }

  function toggleAgents(): void {
    runtime.actions.setAgentsVisible(!runtime.getSnapshot().game.agentsVisible);
  }

  function saveGame(): void {
    const result = runtime.actions.save();
    showToast(result.ok ? "The town was saved." : friendlyActionError(result.error.code), result.ok ? "success" : "warning");
  }

  function loadGame(): void {
    const result = runtime.actions.load();
    if (result.ok) {
      selectedBuildingId = null;
      selectedAgentProfileId = null;
      selectedWorldObjectId = null;
      buildDefinitionId = null;
      exteriorDefinitionId = null;
      scene.resetWorld?.(result.value.mode);
      scene.syncSceneFromState();
      showToast("Volvimos a tu último guardado.", "success");
    } else {
      showToast(friendlyActionError(result.error.code), "warning");
    }
  }

  function resetGame(): void {
    changeMode(runtime.getSnapshot().game.mode, true);
  }

  function changeMode(mode: "showcase" | "progressive", force = false): void {
    const message = mode === "showcase"
      ? "Open the showcase town? The current local game will be replaced."
      : "Start a new town? The current local game will be replaced.";
    const confirm = options.confirmReset ?? ((copy: string) => document.defaultView?.confirm(copy) ?? false);
    if (!force && mode === runtime.getSnapshot().game.mode) return;
    if (!confirm(message)) {
      modeSelect.value = runtime.getSnapshot().game.mode;
      return;
    }
    const result = runtime.actions.reset(mode);
    if (result.ok) {
      selectedBuildingId = null;
      selectedAgentProfileId = null;
      selectedWorldObjectId = null;
      buildDefinitionId = null;
      exteriorDefinitionId = null;
      scene.cancelBuildTool();
      scene.resetWorld?.(mode);
      scene.syncSceneFromState();
      showToast(mode === "showcase" ? "The showcase town is ready." : "Your new meadow is ready.", "success");
    } else {
      showToast(friendlyActionError(result.error.code), "warning");
    }
  }

  function enterSelectedCafe(): void {
    if (!selectedBuildingId) return;
    const result = runtime.actions.enterInterior(selectedBuildingId);
    if (result.ok) {
      selectedInteriorHotspot = null;
      scene.enterCafe(selectedBuildingId);
      showToast("Entraste al Café Biblioteca.", "warm");
    } else {
      showToast(friendlyActionError(result.error.code), "warning");
    }
  }

  function exitInterior(): void {
    const result = runtime.actions.exitInterior();
    if (result.ok) {
      selectedInteriorHotspot = null;
      scene.exitCafe?.();
      showToast("Back in town.", "warm");
    } else {
      showToast(friendlyActionError(result.error.code), "warning");
    }
  }

  let referenceReturnFocus: HTMLElement | null = null;

  function openReferenceGallery(): void {
    referenceReturnFocus = referencesButton;
    referenceModal.hidden = false;
    referencesButton.setAttribute("aria-expanded", "true");
    referenceClose.focus();
  }

  function closeReferenceGallery(): void {
    if (referenceModal.hidden) return;
    referenceModal.hidden = true;
    referencesButton.setAttribute("aria-expanded", "false");
    referenceReturnFocus?.focus();
    referenceReturnFocus = null;
  }

  function upgradeSelectedBuilding(): void {
    const selected = buildAlphaUiModel(runtime.getSnapshot(), selectedBuildingId, null, selectedWorldObjectId).selectedBuilding;
    if (!selected?.upgradeId) return;
    const result = runtime.actions.startUpgrade(selected.id, selected.upgradeId);
    showToast(
      result.ok ? `${selected.upgradeName ?? "La mejora"} ya está en marcha.` : friendlyActionError(result.error.code),
      result.ok ? "success" : "warning",
    );
  }

  function accelerateSelectedBuilding(mode: "one-hour" | "finish-now"): void {
    if (!selectedBuildingId) return;
    const result = runtime.actions.accelerateConstruction(selectedBuildingId, mode);
    showToast(
      result.ok
        ? mode === "one-hour"
          ? "La obra avanzó una hora."
          : "La obra quedó terminada."
        : friendlyActionError(result.error.code),
      result.ok ? "success" : "warning",
    );
  }

  function sendSelectedAgentToCafe(profileId: ControllerSnapshot["game"]["agents"][number]["profileId"]): void {
    const result = runtime.actions.issueGoToCafeOrder(profileId);
    showToast(
      result.ok ? "Camino al Café Biblioteca." : friendlyActionError(result.error.code),
      result.ok ? "success" : "warning",
    );
  }

  function returnSelectedAgentToCity(profileId: ControllerSnapshot["game"]["agents"][number]["profileId"]): void {
    const result = runtime.actions.returnAgentToCity(profileId);
    showToast(
      result.ok ? "The inhabitant went back out to town." : friendlyActionError(result.error.code),
      result.ok ? "success" : "warning",
    );
  }

  function toggleLocalPossession(profileId?: ControllerSnapshot["game"]["agents"][number]["profileId"]): boolean {
    const result = runtime.actions.togglePossession(profileId);
    showToast(
      result.ok
        ? result.value.possessedProfileId
          ? `Ahora controlás a ${modelAgentName(result.value.possessedProfileId)}.`
          : "Control directo liberado."
        : result.error.message,
      result.ok ? "success" : "warning",
    );
    return result.ok;
  }

  function releaseLocalPossession(_reason = "manual"): boolean {
    const result = runtime.actions.releaseLocalControl("manual");
    showToast(result.ok ? "Control directo liberado." : result.error.message, result.ok ? "warm" : "warning");
    return result.ok;
  }

  function modelAgentName(profileId: ControllerSnapshot["game"]["agents"][number]["profileId"]): string {
    return buildAlphaUiModel(currentSnapshot, null, profileId, null).selectedAgent?.name ?? profileId;
  }

  function removeSelectedWorldObject(instanceId: string): void {
    const confirm = options.confirmAction
      ?? options.confirmReset
      ?? ((message: string) => document.defaultView?.confirm(message) ?? false);
    if (!confirm("Remove this object from the terrain? This action cannot be undone.")) return;
    const result = runtime.actions.removeWorldObject(instanceId);
    if (result.ok) {
      selectedWorldObjectId = null;
      scene.selectWorldObject(null);
    }
    showToast(
      result.ok ? "El objeto se retiró del terreno." : friendlyActionError(result.error.code),
      result.ok ? "success" : "warning",
    );
  }

  function unlockSector(sectorId: string, sectorName: string): void {
    const result = runtime.actions.unlockSector(sectorId);
    showToast(
      result.ok ? `${sectorName} is now part of the town.` : friendlyActionError(result.error.code),
      result.ok ? "success" : "warning",
    );
  }

  function installFurniture(buildingId: string, slotId: string, furnitureId: string, name: string): void {
    const result = runtime.actions.installFurniture(buildingId, slotId, furnitureId);
    showToast(
      result.ok ? `${name} quedó instalado.` : friendlyActionError(result.error.code),
      result.ok ? "success" : "warning",
    );
  }

  function createDevelopmentPanel(owner: Document): HTMLElement {
    const panel = node(owner, "aside", "alpha-development");
    panel.setAttribute("aria-label", "Atajos locales de desarrollo");
    panel.append(
      node(owner, "strong", "alpha-development__title", "QA LOCAL"),
      node(owner, "span", "alpha-development__note", "Sólo pruebas · nunca Hermes"),
    );
    const actions = node(owner, "div", "alpha-development__actions");
    const advance = button(owner, "alpha-development__button", "+1 hora", () => runDevelopment("time"));
    advance.dataset.qaAction = "advance-time";
    const finish = button(owner, "alpha-development__button", "Terminar obras", () => runDevelopment("construction"));
    finish.dataset.qaAction = "finish-construction";
    const currency = button(owner, "alpha-development__button", "+500 L", () => runDevelopment("currency"));
    currency.dataset.qaAction = "add-lumenes";
    actions.append(advance, finish, currency);
    panel.append(actions);
    return panel;
  }

  function runDevelopment(action: "time" | "construction" | "currency"): void {
    const qa = runtime.development;
    if (!qa) return;
    const result = action === "time"
      ? qa.advanceMinutes(60)
      : action === "construction"
        ? qa.finishConstruction()
        : qa.addLumenes(500);
    const success = action === "time"
      ? "The town advanced one test hour."
      : action === "construction"
        ? "Las obras activas quedaron terminadas."
        : "Added 500 test Lumens.";
    showToast(result.ok ? success : friendlyActionError(result.error.code), result.ok ? "success" : "warning");
  }

  function handleKeyboard(event: KeyboardEvent): void {
    if (event.defaultPrevented || isTypingTarget(event.target)) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      saveGame();
      return;
    }
    if (event.key === "Escape" && !referenceModal.hidden) {
      closeReferenceGallery();
      return;
    }
    const key = event.key.toLowerCase();
    if (event.key === "Escape" && currentSnapshot.control.possessedProfileId) {
      event.preventDefault();
      releaseLocalPossession("escape");
      return;
    }
    if (key === "b" && currentSnapshot.game.camera.scene === "interior" && currentSnapshot.control.possessedProfileId) {
      event.preventDefault();
      releaseLocalPossession("build-key");
      return;
    }
    if (event.key === "Escape" && currentSnapshot.game.camera.scene === "interior") {
      event.preventDefault();
      exitInterior();
      return;
    }
    if (key === "p") {
      event.preventDefault();
      toggleLocalPossession(selectedAgentProfileId ?? undefined);
      return;
    }
    if (["w", "a", "s", "d"].includes(key) && currentSnapshot.control.possessedProfileId) {
      event.preventDefault();
      const result = runtime.actions.movePossessed(key as "w" | "a" | "s" | "d");
      if (!result.ok) showToast(result.error.message, "warning");
      return;
    }
    if (key === "e") {
      event.preventDefault();
      if (!scene.interactContext?.()) showToast("No valid interaction nearby.", "warning");
      return;
    }
    if (key === "f") {
      event.preventDefault();
      if (!scene.usePortal?.()) showToast("Acercate a una puerta y mirá hacia ella para usar F.", "warning");
      return;
    }
    if (event.key === "Escape") clearBuildTool(false);
    else if (key === "b") {
      if (currentSnapshot.game.camera.scene === "interior") exitInterior();
      else setPaletteOpen(!paletteOpen);
    }
    else if (event.key.toLowerCase() === "r") rotateBuildTool();
    else if (event.key.toLowerCase() === "h") toggleAgents();
  }

  function showToast(message: string, tone: ToastTone = "warm"): void {
    const safeMessage = message.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
    if (!safeMessage) return;
    for (const existing of Array.from(toastRegion.children)) {
      if (existing.textContent === safeMessage) existing.remove();
    }
    while (toastRegion.childElementCount >= 2) toastRegion.firstElementChild?.remove();
    const toast = node(document, `div`, `alpha-toast alpha-toast--${tone}`, safeMessage);
    toast.setAttribute("role", tone === "warning" ? "alert" : "status");
    toastRegion.append(toast);
    const view = document.defaultView;
    if (!view) return;
    const handle = view.setTimeout(() => {
      toast.classList.add("is-leaving");
      view.setTimeout(() => toast.remove(), 180);
      toastTimers.delete(handle);
    }, 3_200);
    toastTimers.add(handle);
  }

  function destroy(): void {
    unsubscribe();
    document.removeEventListener("keydown", keyListener);
    for (const type of worldInputEvents) shell.removeEventListener(type, stopWorldInput);
    for (const timer of toastTimers) document.defaultView?.clearTimeout(timer);
    toastTimers.clear();
    shell.remove();
    root.classList.remove("syka-alpha-ui-host");
  }

  renderSnapshot(currentSnapshot);

  return {
    setSelectedBuilding(buildingId): void {
      selectedBuildingId = buildingId;
      if (buildingId) {
        selectedAgentProfileId = null;
        selectedWorldObjectId = null;
      }
      renderSnapshot(currentSnapshot);
    },
    setSelectedAgent(profileId): void {
      selectedAgentProfileId = profileId;
      if (profileId) runtime.actions.selectProfile(profileId);
      else runtime.actions.clearProfileSelection();
      if (profileId) {
        selectedBuildingId = null;
        selectedWorldObjectId = null;
      }
      renderSnapshot(currentSnapshot);
    },
    setSelectedWorldObject(instanceId): void {
      selectedWorldObjectId = instanceId;
      if (instanceId) {
        selectedBuildingId = null;
        selectedAgentProfileId = null;
      }
      renderSnapshot(currentSnapshot);
    },
    setInteriorHotspot(hotspot): void {
      selectedInteriorHotspot = hotspot;
      inspectorRenderKey = "";
      renderSnapshot(currentSnapshot);
    },
    setPlacementPreview(preview): void {
      placementPreview = preview;
      renderPlacementReceipt(buildAlphaUiModel(currentSnapshot, selectedBuildingId, selectedAgentProfileId, selectedWorldObjectId));
    },
    setBuildOrientation(orientation): void {
      buildOrientation = orientation;
      if (buildDefinitionId) scene.rotateBuildTool(orientation);
    },
    showToast,
    render: () => renderSnapshot(runtime.getSnapshot()),
    destroy,
  };
}

function placementErrorLabel(code: CityPlacementPreview["errors"][number]): string {
  const labels: Readonly<Record<CityPlacementPreview["errors"][number], string>> = {
    UNKNOWN_DEFINITION: "Ese edificio ya no está en el catálogo.",
    CATALOG_LOCKED: "Ese edificio todavía está bloqueado.",
    INSUFFICIENT_FUNDS: "Not enough Lumens yet.",
    OUT_OF_BOUNDS: "Part of the building would be outside the map.",
    SECTOR_LOCKED: "Part of the terrain belongs to a locked sector.",
    TERRAIN_BLOCKED: "La huella pisa camino o terreno no edificable.",
    COLLISION: "Otro edificio ocupa parte de esa huella.",
    NO_ROAD_ACCESS: "La entrada no queda conectada al camino.",
    TOWN_LEVEL_LOCKED: "The town does not have the required level yet.",
    INVALID_ACCESS_TILE: "La entrada no tiene una salida libre.",
    NO_EXISTING_ROAD: "A road network is required first.",
    NO_ROAD_ROUTE: "No clear route to the existing road.",
    WORLD_OBJECT_BLOCKED: "Hay un objeto fijo que no puede retirarse.",
    INVALID_PLACEMENT: "Mové el plano hasta encontrar terreno conectado y libre.",
  };
  return labels[code];
}

function node<K extends keyof HTMLElementTagNameMap>(
  document: Document,
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function button(
  document: Document,
  className: string,
  label: string,
  action: () => void,
): HTMLButtonElement {
  const control = node(document, "button", className, label);
  control.type = "button";
  control.addEventListener("click", action);
  return control;
}

function option(document: Document, value: string, label: string): HTMLOptionElement {
  const item = document.createElement("option");
  item.value = value;
  item.textContent = label;
  return item;
}

function metric(document: Document, label: string, value: string, className: string) {
  const wrapper = node(document, "div", `alpha-metric ${className}`);
  wrapper.append(node(document, "span", "alpha-metric__label", label));
  const valueNode = node(document, "strong", "alpha-metric__value", value);
  wrapper.append(valueNode);
  return { wrapper, value: valueNode };
}

function panelHeading(document: Document, title: string, description: string): HTMLElement {
  const heading = node(document, "div", "alpha-panel-heading");
  heading.append(node(document, "h2", "alpha-panel-heading__title", title));
  heading.append(node(document, "p", "alpha-panel-heading__description", description));
  return heading;
}

function actionButton(
  document: Document,
  label: string,
  key: string,
  ariaLabel: string,
  action: () => void,
): HTMLButtonElement {
  const control = button(document, "alpha-action", "", action);
  control.setAttribute("aria-label", ariaLabel);
  control.append(node(document, "span", "alpha-action__key", key), node(document, "span", "alpha-action__label", label));
  return control;
}

function orientationLabel(direction: CardinalDirection): string {
  return { north: "norte", east: "este", south: "sur", west: "oeste" }[direction];
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.matches("input, textarea, select, [contenteditable='true']");
}
