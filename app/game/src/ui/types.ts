import type { AlphaRuntime } from "../application/AlphaRuntime";
import type {
  BuildingKind,
  BuildingStatus,
  CardinalDirection,
  ConstructionAccelerationMode,
  ExteriorObjectCategory,
  ProfileId,
} from "../core";
import type { BridgeConnectionMode, BridgePresence } from "../integrations";
import type { CityPlacementPreview } from "../presentation/city/placement";

export type ToastTone = "warm" | "success" | "warning";

export interface InteriorActionUiModel {
  readonly id: string;
  readonly label: string;
  readonly agentAction: boolean;
}

export interface InteriorHotspotUiModel {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly actions: readonly InteriorActionUiModel[];
}

export interface AlphaSceneCallbacks {
  /** Enables or clears the ghost footprint owned by the city scene. */
  readonly setBuildTool: (definitionId: string | null, orientation: CardinalDirection) => void;
  readonly rotateBuildTool: (orientation: CardinalDirection) => void;
  readonly cancelBuildTool: () => void;
  readonly enterCafe: (buildingId: string) => void;
  readonly exitCafe?: () => void;
  readonly focusAgent: (profileId: ProfileId) => void;
  readonly focusBuilding?: (buildingId: string) => void;
  readonly resetWorld?: (mode: "showcase" | "progressive") => void;
  readonly runInteriorAction: (profileId: ProfileId, hotspotId: string, actionId: string) => boolean;
  /** Executes the nearest E interaction through the active spatial context. */
  readonly interactContext?: () => boolean;
  /** Traverses the F portal through the active spatial context. */
  readonly usePortal?: () => boolean;
  readonly setExteriorTool: (definitionId: string | null) => boolean;
  readonly selectWorldObject: (instanceId: string | null) => boolean;
  readonly syncSceneFromState: () => void;
}

export interface AlphaUiOptions {
  readonly root: HTMLElement;
  readonly runtime: AlphaRuntime;
  readonly scene: AlphaSceneCallbacks;
  readonly confirmReset?: (message: string) => boolean;
  readonly confirmAction?: (message: string) => boolean;
}

export interface AlphaUiHandle {
  readonly setSelectedBuilding: (buildingId: string | null) => void;
  readonly setSelectedAgent: (profileId: ProfileId | null) => void;
  readonly setSelectedWorldObject: (instanceId: string | null) => void;
  readonly setInteriorHotspot: (hotspot: InteriorHotspotUiModel | null) => void;
  readonly setPlacementPreview: (preview: CityPlacementPreview | null) => void;
  readonly setBuildOrientation: (orientation: CardinalDirection) => void;
  readonly showToast: (message: string, tone?: ToastTone) => void;
  readonly render: () => void;
  readonly destroy: () => void;
}

export interface BuildingPaletteItemModel {
  readonly id: string;
  readonly name: string;
  readonly kind: BuildingKind;
  readonly icon: string;
  readonly cost: number;
  readonly unlocked: boolean;
  readonly affordable: boolean;
  readonly requiredTownLevel: number;
  readonly disabledReason: string | null;
}

export interface ExteriorPaletteItemModel {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: ExteriorObjectCategory;
  readonly icon: string;
  readonly cost: number;
  readonly affordable: boolean;
  readonly placementHint: string;
}

export interface AgentStripItemModel {
  readonly profileId: ProfileId;
  readonly name: string;
  readonly initials: string;
  readonly activityLabel: string;
  readonly phaseLabel: string;
  readonly destinationLabel: string;
  readonly locationLabel: string;
  readonly traveling: boolean;
  readonly pathRemaining: number;
  readonly presence: BridgePresence;
  readonly presenceLabel: string;
  readonly summary: string | null;
  readonly activeSessionCount: number;
}

export interface SelectedAgentModel extends AgentStripItemModel {
  readonly role: string;
  readonly canGoToCafe: boolean;
  readonly canReturnToCity: boolean;
  readonly localOrderLabel: string | null;
  readonly interiorActionLabel: string | null;
}

export interface SelectedWorldObjectModel {
  readonly instanceId: string;
  readonly name: string;
  readonly description: string;
  readonly category: ExteriorObjectCategory;
  readonly placementLabel: string;
  readonly removable: boolean;
  readonly refund: number;
  readonly provenanceLabel: string;
}

export interface ConstructionAccelerationModel {
  readonly mode: ConstructionAccelerationMode;
  readonly cost: number;
  readonly affordable: boolean;
  readonly advancedMinutes: number;
  readonly remainingMinutes: number;
}

export interface BuildingOccupantModel {
  readonly profileId: ProfileId;
  readonly name: string;
  readonly activityLabel: string;
}

export interface SelectedBuildingModel {
  readonly id: string;
  readonly name: string;
  readonly kind: BuildingKind;
  readonly description: string;
  readonly status: BuildingStatus;
  readonly statusLabel: string;
  readonly level: number;
  readonly progress: number;
  readonly progressLabel: string;
  readonly canEnterCafe: boolean;
  readonly upgradeId: string | null;
  readonly upgradeName: string | null;
  readonly upgradeCost: number | null;
  readonly upgradeAvailable: boolean;
  readonly upgradeInProgress: boolean;
  readonly acceleration: readonly ConstructionAccelerationModel[];
  readonly occupants: readonly BuildingOccupantModel[];
  readonly occupancyLabel: string;
}

export interface LockedSectorModel {
  readonly id: string;
  readonly name: string;
  readonly cost: number;
  readonly affordable: boolean;
  readonly stateLabel: string;
}

export interface InteriorFurnitureOptionModel {
  readonly slotId: string;
  readonly slotLabel: string;
  readonly furnitureId: string;
  readonly name: string;
  readonly price: number;
  readonly installed: boolean;
  readonly affordable: boolean;
}

export interface InteriorShopModel {
  readonly buildingId: string;
  readonly name: string;
  readonly options: readonly InteriorFurnitureOptionModel[];
}

export interface AlphaUiViewModel {
  readonly mode: "showcase" | "progressive";
  readonly modeLabel: string;
  readonly balanceLabel: string;
  readonly dayTimeLabel: string;
  readonly speed: 0 | 1 | 2 | 4;
  readonly bridgeMode: BridgeConnectionMode;
  readonly bridgeLabel: string;
  readonly bridgeHint: string;
  readonly townLevel: number;
  readonly agentsVisible: boolean;
  readonly scene: "city" | "interior";
  readonly palette: readonly BuildingPaletteItemModel[];
  readonly exteriorPalette: readonly ExteriorPaletteItemModel[];
  readonly agents: readonly AgentStripItemModel[];
  readonly selectedBuilding: SelectedBuildingModel | null;
  readonly selectedAgent: SelectedAgentModel | null;
  readonly selectedWorldObject: SelectedWorldObjectModel | null;
  readonly lockedSector: LockedSectorModel | null;
  readonly interiorShop: InteriorShopModel | null;
}
