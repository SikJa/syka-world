import type {
  AgentId,
  BuildingKind,
  BuildingStatus,
  CardinalDirection,
  ExteriorObjectCategory,
} from "../../core";
import type { CityPlacementPreview } from "./placement";

export interface CitySceneSelection {
  readonly buildingId: string;
  readonly definitionId: string;
  readonly kind: BuildingKind;
  readonly name: string;
  readonly status: BuildingStatus;
  readonly level: number;
  readonly interiorId: string;
}

export interface CitySceneErrorPayload {
  readonly code: string;
  readonly message: string;
}

export interface CityWorldObjectSelection {
  readonly instanceId: string;
  readonly definitionId: string;
  readonly name: string;
  readonly category: ExteriorObjectCategory;
  readonly removable: boolean;
}

export interface CityInteriorRequestPayload {
  readonly buildingId: string;
  readonly kind: BuildingKind;
  readonly interiorId: string;
}

export interface CitySceneEventMap {
  readonly "selection-change": CitySceneSelection | null;
  readonly "agent-selection": AgentId;
  readonly "interaction-error": CitySceneErrorPayload;
  readonly "interior-request": CityInteriorRequestPayload;
  readonly "placement-preview": CityPlacementPreview | null;
  readonly "world-object-selection": CityWorldObjectSelection | null;
}

export interface CityBuildToolState {
  readonly definitionId: string;
  readonly orientation: CardinalDirection;
}

export const CITY_SCENE_EVENTS = Object.freeze({
  selection: "selection-change",
  agentSelection: "agent-selection",
  error: "interaction-error",
  interior: "interior-request",
  placementPreview: "placement-preview",
  worldObjectSelection: "world-object-selection",
});
