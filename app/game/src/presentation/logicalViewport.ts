export interface LogicalViewport {
  readonly width: number;
  readonly height: number;
}

export const LOGICAL_VIEWPORT_HEIGHT = 450;
export const MIN_LOGICAL_VIEWPORT_WIDTH = 720;
export const MAX_LOGICAL_VIEWPORT_WIDTH = 1080;

export function logicalViewportForSize(availableWidth: number, availableHeight: number): LogicalViewport {
  if (!Number.isFinite(availableWidth) || !Number.isFinite(availableHeight) || availableWidth <= 0 || availableHeight <= 0) {
    return { width: MIN_LOGICAL_VIEWPORT_WIDTH, height: LOGICAL_VIEWPORT_HEIGHT };
  }
  const minimumAspect = MIN_LOGICAL_VIEWPORT_WIDTH / LOGICAL_VIEWPORT_HEIGHT;
  const maximumAspect = MAX_LOGICAL_VIEWPORT_WIDTH / LOGICAL_VIEWPORT_HEIGHT;
  const aspect = Math.min(maximumAspect, Math.max(minimumAspect, availableWidth / availableHeight));
  const evenWidth = Math.round((LOGICAL_VIEWPORT_HEIGHT * aspect) / 2) * 2;
  return {
    width: Math.min(MAX_LOGICAL_VIEWPORT_WIDTH, Math.max(MIN_LOGICAL_VIEWPORT_WIDTH, evenWidth)),
    height: LOGICAL_VIEWPORT_HEIGHT,
  };
}
