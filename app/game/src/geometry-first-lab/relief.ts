export interface ReliefOptions {
  readonly alphaThreshold?: number;
  readonly maximumInset?: number;
}

const DIAGONAL_DISTANCE = Math.SQRT2;

/**
 * Builds a shallow depth relief from an authored RGBA sprite mask.
 *
 * The visible pixels remain exactly the original artwork. This field only
 * describes how far each source pixel sits in front of, or behind, the
 * character origin so WebGL can compare it against real furniture geometry.
 */
export function buildAlphaRelief(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  options: ReliefOptions = {},
): Float32Array {
  if (width <= 0 || height <= 0 || alpha.length !== width * height) {
    throw new Error("The alpha mask dimensions do not match the supplied buffer.");
  }

  const alphaThreshold = options.alphaThreshold ?? 36;
  const maximumInset = Math.max(1, options.maximumInset ?? 11);
  const count = width * height;
  const distances = new Float32Array(count);
  const relief = new Float32Array(count);
  const opaque = new Uint8Array(count);
  const far = width + height;

  for (let index = 0; index < count; index += 1) {
    const isOpaque = (alpha[index] ?? 0) >= alphaThreshold;
    opaque[index] = isOpaque ? 1 : 0;
    distances[index] = isOpaque ? far : 0;
  }

  // Two chamfer passes approximate the distance to the nearest transparent
  // pixel. It keeps the relief tied to every authored strand, sleeve and bag
  // edge rather than replacing the sprite with a generic capsule.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (opaque[index] === 0) continue;
      let best = distances[index] ?? far;
      if (x > 0) best = Math.min(best, (distances[index - 1] ?? far) + 1);
      if (y > 0) best = Math.min(best, (distances[index - width] ?? far) + 1);
      if (x > 0 && y > 0) best = Math.min(best, (distances[index - width - 1] ?? far) + DIAGONAL_DISTANCE);
      if (x + 1 < width && y > 0) best = Math.min(best, (distances[index - width + 1] ?? far) + DIAGONAL_DISTANCE);
      distances[index] = best;
    }
  }

  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const index = y * width + x;
      if (opaque[index] === 0) continue;
      let best = distances[index] ?? far;
      if (x + 1 < width) best = Math.min(best, (distances[index + 1] ?? far) + 1);
      if (y + 1 < height) best = Math.min(best, (distances[index + width] ?? far) + 1);
      if (x + 1 < width && y + 1 < height) {
        best = Math.min(best, (distances[index + width + 1] ?? far) + DIAGONAL_DISTANCE);
      }
      if (x > 0 && y + 1 < height) {
        best = Math.min(best, (distances[index + width - 1] ?? far) + DIAGONAL_DISTANCE);
      }
      distances[index] = best;
    }
  }

  for (let y = 0; y < height; y += 1) {
    let rowMin = width;
    let rowMax = -1;
    for (let x = 0; x < width; x += 1) {
      if (opaque[y * width + x] === 0) continue;
      rowMin = Math.min(rowMin, x);
      rowMax = Math.max(rowMax, x);
    }

    const rowCenter = rowMax >= rowMin ? (rowMin + rowMax) * 0.5 : width * 0.5;
    const rowRadius = Math.max(1, (rowMax - rowMin + 1) * 0.5);
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (opaque[index] === 0) {
        relief[index] = 0;
        continue;
      }

      const inset = Math.min(1, (distances[index] ?? 0) / maximumInset);
      const normalizedX = Math.min(1, Math.abs(x - rowCenter) / rowRadius);
      const crossSection = Math.sqrt(Math.max(0, 1 - normalizedX * normalizedX));
      // The inset keeps fine silhouette details behind the torso while the
      // row curvature prevents the result from behaving as another flat card.
      relief[index] = Math.min(1, 0.12 + inset * 0.58 + crossSection * 0.30);
    }
  }

  return relief;
}

export function alphaChannelFromRgba(rgba: Uint8ClampedArray): Uint8ClampedArray {
  if (rgba.length % 4 !== 0) throw new Error("RGBA data must contain four channels per pixel.");
  const alpha = new Uint8ClampedArray(rgba.length / 4);
  for (let source = 3, target = 0; source < rgba.length; source += 4, target += 1) {
    alpha[target] = rgba[source] ?? 0;
  }
  return alpha;
}
