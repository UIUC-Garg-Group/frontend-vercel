/**
 * Pure math functions ported from ur2-common-code/rpi-to-ui/image_pipeline.py
 * No DOM, no Canvas, no browser APIs — just math.
 * If migrating to backend, this same logic lives in image_pipeline.py.
 */

// Default ROI coordinates matching the fixed cuvette position on the RPi camera
export const DEFAULT_ROI = { x: 2257, y: 959, w: 392, h: 1296 };
export const DEFAULT_CROP_FRAC = 0.25;
export const DEFAULT_Y_SHIFT_FRAC = 4.0;

/**
 * Clamp ROI rectangle to image bounds.
 * Port of _clamp_roi() in image_pipeline.py
 */
export function clampRoi(x, y, w, h, imgW, imgH) {
  x = Math.max(0, Math.min(Math.floor(x), imgW - 1));
  y = Math.max(0, Math.min(Math.floor(y), imgH - 1));
  w = Math.max(1, Math.min(Math.floor(w), imgW - x));
  h = Math.max(1, Math.min(Math.floor(h), imgH - y));
  return { x, y, w, h };
}

/**
 * Compute the inner crop coordinates (square, centered horizontally, shifted down).
 * Port of _bottom_shifted_crop() in image_pipeline.py
 *
 * @param {number} roiW - width of the outer ROI
 * @param {number} roiH - height of the outer ROI
 * @param {number} cropFrac - fraction of min(H,W) to keep
 * @param {number} yShiftFrac - downward shift relative to crop size
 * @returns {{ x0: number, y0: number, side: number }}
 */
export function getInnerCropCoords(roiW, roiH, cropFrac = DEFAULT_CROP_FRAC, yShiftFrac = DEFAULT_Y_SHIFT_FRAC) {
  const side = Math.max(1, Math.floor(Math.min(roiH, roiW) * cropFrac));
  const x0 = Math.max(0, Math.min(roiW - side, Math.floor(roiW / 2) - Math.floor(side / 2)));
  const yCenter = Math.floor(roiH / 2) + Math.floor(side * yShiftFrac);
  const y0 = Math.max(0, Math.min(roiH - side, yCenter - Math.floor(side / 2)));
  return { x0, y0, side };
}

/**
 * Compute mean RGB normalized to 0..1 from a flat RGBA pixel array.
 * Port of _mean_rgb(normalize=True) in image_pipeline.py
 *
 * @param {Uint8ClampedArray} pixelData - RGBA pixel data
 * @param {number} pixelCount - number of pixels (pixelData.length / 4)
 * @returns {[number, number, number]} [r, g, b] normalized 0..1
 */
export function meanRgbNormalized(pixelData, pixelCount) {
  let rSum = 0, gSum = 0, bSum = 0;
  for (let i = 0; i < pixelData.length; i += 4) {
    rSum += pixelData[i];
    gSum += pixelData[i + 1];
    bSum += pixelData[i + 2];
  }
  return [
    rSum / pixelCount / 255,
    gSum / pixelCount / 255,
    bSum / pixelCount / 255,
  ];
}

/**
 * Compute concentration from normalized RGB.
 * Port of _get_concentration() in image_pipeline.py
 *
 * @param {[number, number, number]} rgb - normalized [r, g, b]
 * @param {'al'|'si'} solutionType
 * @returns {number} concentration
 */
export function getConcentration(rgb, solutionType) {
  const [r, , b] = rgb;
  const st = (solutionType || '').toLowerCase();
  if (st === 'al') return 0.25 * (3 * r + b);
  if (st === 'si') return b;
  throw new Error("solutionType must be 'al' or 'si'");
}

/**
 * Compute dissolution index from aluminum and silicon concentrations.
 * Formula: 1.54 * [Al] + [Si]
 */
export function getDissolutionIndex(alConcentration, siConcentration) {
  return 1.54 * alConcentration + siConcentration;
}
