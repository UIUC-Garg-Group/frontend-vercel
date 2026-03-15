/**
 * Pure math functions ported from ur2-common-code/rpi-to-ui/image_pipeline.py
 * No DOM, no Canvas, no browser APIs — just math.
 * If migrating to backend, this same logic lives in image_pipeline.py.
 */

// Default ROI coordinates matching the fixed cuvette position on the RPi camera
export const DEFAULT_ROI = { x: 2149, y: 959, w: 392, h: 1296 };
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

// Calibration constants from deployment_rpi.py
// calibration curve - AI: SR images 03012026 | Si: SR images 03082026 | camera based analysis
export const CALIBRATION_AL = { slope: 793.61, intercept: -1069.3 };
export const CALIBRATION_SI = { slope: 7593, intercept: -1714.5 };

/**
 * Compute Aluminum Color Index from normalized RGB.
 * Port of calculate_ai_ci() in camera_index.py
 * Formula: log((3*R + B) / G)
 */
export function calculateAlCi(r, g, b) {
  if (g <= 0) throw new Error('g_norm must be > 0 for AI CI calculation');
  return Math.log((3.0 * r + b) / g);
}

/**
 * Compute Silicon Color Index from normalized RGB.
 * Port of calculate_si_ci() in camera_index.py
 * Formula: 1 - (0.299*R + 0.587*G + 0.114*B)
 */
export function calculateSiCi(r, g, b) {
  return 1.0 - (0.299 * r + 0.587 * g + 0.114 * b);
}

/**
 * Apply calibration: CI * slope + intercept
 * Port of apply_calibration() in camera_index.py
 */
export function applyCalibration(ciValue, calibration) {
  return ciValue * calibration.slope + calibration.intercept;
}

/**
 * Compute concentration from normalized RGB using color index + calibration.
 * Matches the full RPi pipeline: camera_index.py formulas + deployment_rpi.py calibration constants.
 *
 * @param {[number, number, number]} rgb - normalized [r, g, b]
 * @param {'al'|'si'} solutionType
 * @returns {number} concentration in μM
 */
export function getConcentration(rgb, solutionType) {
  const [r, g, b] = rgb;
  const st = (solutionType || '').toLowerCase();
  if (st === 'al') {
    const ci = calculateAlCi(r, g, b);
    return applyCalibration(ci, CALIBRATION_AL);
  }
  if (st === 'si') {
    const ci = calculateSiCi(r, g, b);
    return applyCalibration(ci, CALIBRATION_SI);
  }
  throw new Error("solutionType must be 'al' or 'si'");
}

/**
 * Compute dissolution index from aluminum and silicon concentrations.
 * Port of calculate_dissolution_index() in camera_index.py
 * Formula: round(1.54 * [Al] + [Si])
 */
export function getDissolutionIndex(alConcentration, siConcentration) {
  return Math.round(1.54 * alConcentration + siConcentration);
}
