/**
 * Canvas-based image analysis runner.
 * This is the ONLY file that touches the browser Canvas API.
 *
 * TO MIGRATE TO BACKEND: Replace this file's implementation with fetch() calls
 * to your API endpoint. The UI (ImageAnalysis.jsx) and math (imageAnalysis.js)
 * stay untouched.
 *
 * Example backend replacement:
 *   export async function analyzeImage(file, solutionType) {
 *     const form = new FormData();
 *     form.append('image', file);
 *     form.append('solutionType', solutionType);
 *     const res = await fetch('/api/analyze-image', { method: 'POST', body: form });
 *     return res.json();
 *   }
 */

import {
  clampRoi,
  getInnerCropCoords,
  meanRgbNormalized,
  getConcentration,
  DEFAULT_ROI,
  DEFAULT_CROP_FRAC,
  DEFAULT_Y_SHIFT_FRAC,
} from './imageAnalysis';

/**
 * Convert an ImageData object to an object URL (for displaying in <img>).
 */
function imageDataToObjectUrl(imageData) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    canvas.getContext('2d').putImageData(imageData, 0, 0);
    canvas.toBlob((blob) => {
      resolve(URL.createObjectURL(blob));
    }, 'image/png');
  });
}

/**
 * Load a File into an HTMLImageElement.
 */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

/**
 * Run the full image analysis pipeline in the browser.
 *
 * @param {File} file - uploaded image file
 * @param {'al'|'si'|'both'} solutionType
 * @param {object} [roiParams] - optional ROI overrides { x, y, w, h, cropFrac, yShiftFrac }
 * @returns {Promise<object>} analysis result
 */
export async function analyzeImage(file, solutionType = 'both', roiParams = {}) {
  const img = await loadImage(file);

  // Draw full image onto canvas
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  // Clamp ROI to image bounds
  const roi = clampRoi(
    roiParams.x ?? DEFAULT_ROI.x,
    roiParams.y ?? DEFAULT_ROI.y,
    roiParams.w ?? DEFAULT_ROI.w,
    roiParams.h ?? DEFAULT_ROI.h,
    canvas.width,
    canvas.height
  );

  // Extract outer ROI
  const outerData = ctx.getImageData(roi.x, roi.y, roi.w, roi.h);

  // Draw outer ROI onto temp canvas for inner crop extraction
  const roiCanvas = document.createElement('canvas');
  roiCanvas.width = roi.w;
  roiCanvas.height = roi.h;
  const roiCtx = roiCanvas.getContext('2d');
  roiCtx.putImageData(outerData, 0, 0);

  // Compute inner crop coordinates
  const cropFrac = roiParams.cropFrac ?? DEFAULT_CROP_FRAC;
  const yShiftFrac = roiParams.yShiftFrac ?? DEFAULT_Y_SHIFT_FRAC;
  const inner = getInnerCropCoords(roi.w, roi.h, cropFrac, yShiftFrac);

  // Extract inner crop pixel data
  const innerData = roiCtx.getImageData(inner.x0, inner.y0, inner.side, inner.side);

  // Generate display URLs for both crops
  const [outerCropUrl, innerCropUrl] = await Promise.all([
    imageDataToObjectUrl(outerData),
    imageDataToObjectUrl(innerData),
  ]);

  // Compute mean RGB
  const pixelCount = innerData.width * innerData.height;
  const rgb = meanRgbNormalized(innerData.data, pixelCount);

  // Compute concentrations
  const timestamp = new Date().toISOString();
  const result = {
    rgb,
    outerCropUrl,
    innerCropUrl,
    timestamp,
    sourceImage: file.name,
    imageWidth: img.naturalWidth,
    imageHeight: img.naturalHeight,
  };

  const conc = getConcentration(rgb, solutionType);
  result.solutionType = solutionType;
  result.concentration = conc;

  return result;
}
