import React, { useState, useCallback, useEffect } from 'react';
import { Upload, FlaskConical, Loader2, Download, Trash2 } from 'lucide-react';
import { analyzeImage } from '../../utils/imageAnalysisRunner';
import { getDissolutionIndex } from '../../utils/imageAnalysis';

export default function ImageAnalysisPage() {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [solutionType, setSolutionType] = useState('al');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [alResult, setAlResult] = useState(null);
  const [siResult, setSiResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  // Compute dissolution index when both results exist
  const dissolutionIndex = (alResult && siResult)
    ? getDissolutionIndex(alResult.concentration, siResult.concentration)
    : null;

  // Latest result for image display
  const latestResult = solutionType === 'al' ? alResult : siResult;

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      [alResult, siResult].forEach((r) => {
        if (r?.outerCropUrl) URL.revokeObjectURL(r.outerCropUrl);
        if (r?.innerCropUrl) URL.revokeObjectURL(r.innerCropUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileSelect = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setUploadedFile(file);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setError(null);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  }, [handleFileSelect]);

  const handleAnalyze = useCallback(async () => {
    if (!uploadedFile) return;
    setAnalyzing(true);
    setError(null);
    try {
      const result = await analyzeImage(uploadedFile, solutionType);
      if (solutionType === 'al') {
        setAlResult((prev) => {
          if (prev?.outerCropUrl) URL.revokeObjectURL(prev.outerCropUrl);
          if (prev?.innerCropUrl) URL.revokeObjectURL(prev.innerCropUrl);
          return result;
        });
      } else {
        setSiResult((prev) => {
          if (prev?.outerCropUrl) URL.revokeObjectURL(prev.outerCropUrl);
          if (prev?.innerCropUrl) URL.revokeObjectURL(prev.innerCropUrl);
          return result;
        });
      }
    } catch (err) {
      setError(err.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }, [uploadedFile, solutionType]);

  const handleClearResults = useCallback(() => {
    [alResult, siResult].forEach((r) => {
      if (r?.outerCropUrl) URL.revokeObjectURL(r.outerCropUrl);
      if (r?.innerCropUrl) URL.revokeObjectURL(r.innerCropUrl);
    });
    setAlResult(null);
    setSiResult(null);
  }, [alResult, siResult]);

  const handleExportJSON = useCallback(() => {
    const exportData = {
      source: 'manual_upload',
      exportedAt: new Date().toISOString(),
      aluminum: alResult ? { concentration: alResult.concentration, rgb: alResult.rgb, sourceImage: alResult.sourceImage, timestamp: alResult.timestamp } : null,
      silicon: siResult ? { concentration: siResult.concentration, rgb: siResult.rgb, sourceImage: siResult.sourceImage, timestamp: siResult.timestamp } : null,
      dissolution_index: dissolutionIndex,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ur2-manual-analysis-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [alResult, siResult, dissolutionIndex]);

  const formatConcentration = (value) => {
    return value != null ? parseFloat(value).toFixed(3) : 'N/A';
  };

  const hasResults = alResult || siResult;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Image Analysis</h1>
      <p className="text-sm text-gray-500">Upload an image to run the same ROI and concentration analysis that runs on the Raspberry Pi. Analyze Aluminum and Silicon separately, then dissolution index is calculated automatically.</p>

      {/* Upload + Controls Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Upload Zone */}
        <div className="md:col-span-2">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer ${
              dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
            }`}
            onClick={() => document.getElementById('image-upload-input').click()}
          >
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="max-h-48 object-contain rounded" />
            ) : (
              <>
                <Upload className="w-10 h-10 text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">Drop an image here or click to select</p>
              </>
            )}
            <input
              id="image-upload-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files[0])}
            />
            {uploadedFile && (
              <p className="mt-2 text-xs text-gray-400">{uploadedFile.name}</p>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-3">
          {/* Solution Type */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Solution Type</label>
            <div className="flex gap-1">
              <button
                onClick={() => setSolutionType('al')}
                className={`flex-1 py-2 px-2 rounded-lg text-sm font-medium transition-colors ${
                  solutionType === 'al' ? 'text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                style={solutionType === 'al' ? { backgroundColor: '#2563eb' } : {}}
              >
                Aluminum
              </button>
              <button
                onClick={() => setSolutionType('si')}
                className={`flex-1 py-2 px-2 rounded-lg text-sm font-medium transition-colors ${
                  solutionType === 'si' ? 'text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                style={solutionType === 'si' ? { backgroundColor: '#16a34a' } : {}}
              >
                Silicon
              </button>
            </div>
          </div>

          {/* Status indicators */}
          <div className="text-xs text-gray-500 space-y-1">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${alResult ? 'bg-blue-500' : 'bg-gray-300'}`} />
              Aluminum: {alResult ? formatConcentration(alResult.concentration) : 'Not analyzed'}
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${siResult ? 'bg-green-500' : 'bg-gray-300'}`} />
              Silicon: {siResult ? formatConcentration(siResult.concentration) : 'Not analyzed'}
            </div>
          </div>

          {/* Analyze Button */}
          <button
            onClick={handleAnalyze}
            disabled={!uploadedFile || analyzing}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            {analyzing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <FlaskConical className="w-5 h-5" />
            )}
            {analyzing ? 'Analyzing...' : `Analyze ${solutionType === 'al' ? 'Aluminum' : 'Silicon'}`}
          </button>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>
          )}
        </div>
      </div>

      {/* Results Section */}
      {hasResults && (
        <div className="flex flex-col gap-6 md:grid md:grid-cols-2">
          {/* Results Table — Left Side */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Results</h2>
              <div className="flex gap-2">
                <button
                  onClick={handleExportJSON}
                  className="flex items-center gap-1 px-3 py-1 text-sm text-white bg-green-500 rounded hover:bg-green-600 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export JSON
                </button>
                <button
                  onClick={handleClearResults}
                  className="flex items-center gap-1 px-3 py-1 text-sm text-white bg-red-500 rounded hover:bg-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear
                </button>
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg overflow-y-auto" style={{ maxHeight: '400px' }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b-2 border-gray-200">
                    <th className="py-3 px-3 md:px-4 text-left font-semibold text-gray-700">Type</th>
                    <th className="py-3 px-3 md:px-4 text-left font-semibold text-gray-700">Concentration</th>
                    <th className="py-3 px-3 md:px-4 text-left font-semibold text-gray-700">RGB</th>
                  </tr>
                </thead>
                <tbody>
                  {alResult && (
                    <tr className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-3 md:px-4 text-gray-700 font-medium">Aluminum</td>
                      <td className="py-3 px-3 md:px-4 text-gray-600">{formatConcentration(alResult.concentration)}</td>
                      <td className="py-3 px-3 md:px-4 text-gray-600 text-xs font-mono">
                        ({alResult.rgb[0].toFixed(3)}, {alResult.rgb[1].toFixed(3)}, {alResult.rgb[2].toFixed(3)})
                      </td>
                    </tr>
                  )}
                  {siResult && (
                    <tr className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-3 md:px-4 text-gray-700 font-medium">Silicon</td>
                      <td className="py-3 px-3 md:px-4 text-gray-600">{formatConcentration(siResult.concentration)}</td>
                      <td className="py-3 px-3 md:px-4 text-gray-600 text-xs font-mono">
                        ({siResult.rgb[0].toFixed(3)}, {siResult.rgb[1].toFixed(3)}, {siResult.rgb[2].toFixed(3)})
                      </td>
                    </tr>
                  )}
                  {dissolutionIndex != null && (
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <td className="py-3 px-3 md:px-4 text-gray-700 font-semibold">Dissolution Index</td>
                      <td className="py-3 px-3 md:px-4 text-gray-700 font-semibold">{dissolutionIndex}</td>
                      <td className="py-3 px-3 md:px-4 text-gray-400 text-xs">—</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cropped Images — Right Side */}
          {latestResult && (
            <div className="flex flex-col items-center justify-center">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Cropped Regions</h2>
              <div className="grid grid-cols-2 gap-6 w-full max-w-md">
                {/* Outer ROI (Cuvette) */}
                <div className="flex flex-col items-center">
                  <div className="mb-3 text-sm font-medium text-gray-600">Cuvette ROI</div>
                  {latestResult.outerCropUrl ? (
                    <img
                      src={latestResult.outerCropUrl}
                      alt="Outer ROI"
                      className="w-full max-w-32 object-contain border border-gray-200 rounded"
                      style={{ height: 'auto', maxHeight: '200px' }}
                    />
                  ) : (
                    <div className="flex items-center justify-center w-32 h-40 text-xs text-gray-400 bg-gray-50 border border-dashed border-gray-300 rounded">
                      No image
                    </div>
                  )}
                </div>

                {/* Inner Analysis Region */}
                <div className="flex flex-col items-center">
                  <div className="mb-3 text-sm font-medium text-gray-600">Analysis Region</div>
                  {latestResult.innerCropUrl ? (
                    <img
                      src={latestResult.innerCropUrl}
                      alt="Inner Analysis Region"
                      className="w-full max-w-32 object-contain border border-gray-200 rounded"
                      style={{ height: 'auto', maxHeight: '200px' }}
                    />
                  ) : (
                    <div className="flex items-center justify-center w-32 h-40 text-xs text-gray-400 bg-gray-50 border border-dashed border-gray-300 rounded">
                      No image
                    </div>
                  )}
                </div>
              </div>
              {latestResult.imageWidth && (
                <p className="mt-3 text-xs text-gray-400">
                  Source: {latestResult.sourceImage} ({latestResult.imageWidth}×{latestResult.imageHeight})
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
