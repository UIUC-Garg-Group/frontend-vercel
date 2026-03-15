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
 * Crop a region from a source canvas using drawImage (preserves color pipeline).
 * Unlike getImageData→putImageData→toBlob which double-applies color management,
 * drawImage keeps the same single conversion as the original image.
 */
function cropToObjectUrl(sourceCanvas, sx, sy, sw, sh) {
  return new Promise((resolve) => {
    const crop = document.createElement('canvas');
    crop.width = sw;
    crop.height = sh;
    crop.getContext('2d').drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
    crop.toBlob((blob) => {
      resolve(URL.createObjectURL(blob));
    }, 'image/png');
  });
}

/**
 * Run the full image analysis pipeline in the browser.
 *
 * @param {File} file - uploaded image file
 * @param {'al'|'si'} solutionType
 * @param {object} [roiParams] - optional ROI overrides { x, y, w, h, cropFrac, yShiftFrac }
 * @returns {Promise<object>} analysis result
 */
export async function analyzeImage(file, solutionType = 'al', roiParams = {}) {
  // Load image bypassing browser color management (raw pixels, like PIL/OpenCV)
  const bitmap = await createImageBitmap(file, { colorSpaceConversion: 'none' });

  // Draw full image onto canvas
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);

  // Clamp ROI to image bounds
  const roi = clampRoi(
    roiParams.x ?? DEFAULT_ROI.x,
    roiParams.y ?? DEFAULT_ROI.y,
    roiParams.w ?? DEFAULT_ROI.w,
    roiParams.h ?? DEFAULT_ROI.h,
    canvas.width,
    canvas.height
  );

  // Compute inner crop coordinates (relative to ROI)
  const cropFrac = roiParams.cropFrac ?? DEFAULT_CROP_FRAC;
  const yShiftFrac = roiParams.yShiftFrac ?? DEFAULT_Y_SHIFT_FRAC;
  const inner = getInnerCropCoords(roi.w, roi.h, cropFrac, yShiftFrac);

  // Get raw pixel data for inner crop (for computation — uses getImageData)
  const innerData = ctx.getImageData(
    roi.x + inner.x0,
    roi.y + inner.y0,
    inner.side,
    inner.side
  );

  // Generate display URLs using drawImage (avoids double color management)
  const [outerCropUrl, innerCropUrl] = await Promise.all([
    cropToObjectUrl(canvas, roi.x, roi.y, roi.w, roi.h),
    cropToObjectUrl(canvas, roi.x + inner.x0, roi.y + inner.y0, inner.side, inner.side),
  ]);

  // Compute mean RGB from raw pixels
  const pixelCount = innerData.width * innerData.height;
  const rgb = meanRgbNormalized(innerData.data, pixelCount);

  // Debug: log values to compare with RPi output
  console.log(`[ImageAnalysis] ${solutionType.toUpperCase()} debug:`);
  console.log(`  Image: ${bitmap.width}x${bitmap.height}`);
  console.log(`  ROI: x=${roi.x}, y=${roi.y}, w=${roi.w}, h=${roi.h}`);
  console.log(`  Inner crop: x0=${inner.x0}, y0=${inner.y0}, side=${inner.side} (absolute: x=${roi.x + inner.x0}, y=${roi.y + inner.y0})`);
  console.log(`  Mean RGB (0-255): R=${(rgb[0]*255).toFixed(2)}, G=${(rgb[1]*255).toFixed(2)}, B=${(rgb[2]*255).toFixed(2)}`);
  console.log(`  Mean RGB (norm):  R=${rgb[0].toFixed(6)}, G=${rgb[1].toFixed(6)}, B=${rgb[2].toFixed(6)}`);

  // Compute concentration
  const conc = getConcentration(rgb, solutionType);

  return {
    solutionType,
    concentration: conc,
    rgb,
    outerCropUrl,
    innerCropUrl,
    timestamp: new Date().toISOString(),
    sourceImage: file.name,
    imageWidth: bitmap.width,
    imageHeight: bitmap.height,
  };
}
