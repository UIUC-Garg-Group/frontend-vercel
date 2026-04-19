import React from 'react';
import { X, Clock, User, Calendar, Hash, FlaskConical, Thermometer, Download } from 'lucide-react';
import { CSVLink } from 'react-csv';
import useModalClose from '../../hooks/useModalClose';

export default function TestDetailsModal({ isOpen, onClose, run }) {
  const { handleBackdropClick } = useModalClose({ isOpen, onClose });

  if (!isOpen || !run) return null;

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const generateTestId = (run) => {
    if (run.test_id) return run.test_id;
    
    const date = new Date(run.timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const id = String(run.trial_id || '001').padStart(3, '0');
    
    return `UR2_${year}${month}${day}_${id}`;
  };

  const calculateEndTime = (startTime, duration) => {
    if (!duration) return 'N/A';
    
    const start = new Date(startTime);
    // Assume duration is in minutes if it's a number, otherwise parse
    const durationMs = typeof duration === 'number' ? duration * 60000 : 5 * 60000; // Default 5 minutes
    const end = new Date(start.getTime() + durationMs);
    
    return formatDate(end);
  };

  // Normalize results: handle both { aluminum: [], silicon: [], dissolution: [] } object format
  // and legacy flat array format
  const normalizeResults = () => {
    const raw = run?.results;
    if (!raw) return { alResults: [], siResults: [], dissolutionResults: [] };

    // Object format (from DB save)
    if (raw.aluminum || raw.silicon || raw.dissolution) {
      return {
        alResults: raw.aluminum || [],
        siResults: raw.silicon || [],
        dissolutionResults: raw.dissolution || [],
      };
    }

    // Legacy flat array format
    if (Array.isArray(raw)) {
      return {
        alResults: raw.filter(r => r.solution_type === 'al'),
        siResults: raw.filter(r => r.solution_type === 'si'),
        dissolutionResults: [],
      };
    }

    return { alResults: [], siResults: [], dissolutionResults: [] };
  };

  const { alResults, siResults, dissolutionResults } = normalizeResults();

  // Build per-cycle raw data rows combining Al, Si, and dissolution
  const buildCycleRows = () => {
    const cycles = new Map();
    alResults.forEach(r => {
      const c = r.cycle ?? 1;
      if (!cycles.has(c)) cycles.set(c, {});
      cycles.get(c).al = r;
    });
    siResults.forEach(r => {
      const c = r.cycle ?? 1;
      if (!cycles.has(c)) cycles.set(c, {});
      cycles.get(c).si = r;
    });
    dissolutionResults.forEach(r => {
      const c = r.cycle ?? 1;
      if (!cycles.has(c)) cycles.set(c, {});
      cycles.get(c).dissolution = r;
    });
    return [...cycles.entries()].sort((a, b) => a[0] - b[0]).map(([cycle, data]) => ({ cycle, ...data }));
  };

  const cycleRows = buildCycleRows();

  // Prepare CSV data with real results
  const prepareCsvData = () => {
    const rows = [
      ['Category', 'Value'],
      ['Test ID', generateTestId(run)],
      ['Operator', run.trial_operator],
      ['Start Time', formatDate(run.timestamp)],
      ['End Time', calculateEndTime(run.timestamp, run.trial_duration)],
      ['Sample ID', run.trial_name],
      ['Test Temperature', '90 °C'],
      ['NaOH Concentration', '4 M'],
      ['Solid-to-liquid ratio', '0.5 g/L'],
      [],
      ['Sample Results'],
      ['Cycle', 'Al Concentration', 'Al RGB_R', 'Al RGB_G', 'Al RGB_B', 'Si Concentration', 'Si RGB_R', 'Si RGB_G', 'Si RGB_B', 'Dissolution Index']
    ];
    if (cycleRows.length > 0) {
      cycleRows.forEach(row => {
        rows.push([
          row.cycle,
          row.al?.concentration ?? '',
          row.al?.rgb ? row.al.rgb[0] : '',
          row.al?.rgb ? row.al.rgb[1] : '',
          row.al?.rgb ? row.al.rgb[2] : '',
          row.si?.concentration ?? '',
          row.si?.rgb ? row.si.rgb[0] : '',
          row.si?.rgb ? row.si.rgb[1] : '',
          row.si?.rgb ? row.si.rgb[2] : '',
          row.dissolution?.dissolution_index ?? '',
        ]);
      });
    } else {
      rows.push(['No results', '', '', '', '', '', '', '', '', '']);
    }
    return rows;
  };

  const csvData = prepareCsvData();
  const csvFilename = `UR2_Test_${generateTestId(run)}_${new Date().toISOString().split('T')[0]}.csv`;

  // Compute summary results
  const computeResults = () => {
    const avgAl = alResults.length > 0
      ? alResults.reduce((sum, r) => sum + (r.concentration || 0), 0) / alResults.length
      : 0;
    const avgSi = siResults.length > 0
      ? siResults.reduce((sum, r) => sum + (r.concentration || 0), 0) / siResults.length
      : 0;

    // Use stored dissolution index if available, otherwise compute
    const dissolutionIndex = dissolutionResults.length > 0
      ? dissolutionResults.reduce((sum, r) => sum + (r.dissolution_index || 0), 0) / dissolutionResults.length
      : 1.54 * avgAl + avgSi;
    const siAlRatio = avgAl > 0 ? avgSi / avgAl : 0;

    return {
      dissolutionIndex,
      aluminum: avgAl,
      silicon: avgSi,
      siAlRatio,
      hasResults: alResults.length > 0 || siResults.length > 0
    };
  };

  const computedResults = computeResults();

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Test Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Test Overview */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Test Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center text-sm">
                <Hash className="w-4 h-4 mr-2 text-gray-400" />
                <div>
                  <span className="text-gray-500">Test ID:</span>
                  <span className="ml-2 font-medium">{generateTestId(run)}</span>
                </div>
              </div>
              <div className="flex items-center text-sm">
                <User className="w-4 h-4 mr-2 text-gray-400" />
                <div>
                  <span className="text-gray-500">Operator:</span>
                  <span className="ml-2 font-medium">{run.trial_operator}</span>
                </div>
              </div>
              <div className="flex items-center text-sm">
                <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                <div>
                  <span className="text-gray-500">Start Time:</span>
                  <span className="ml-2 font-medium">{formatDate(run.timestamp)}</span>
                </div>
              </div>
              <div className="flex items-center text-sm">
                <Clock className="w-4 h-4 mr-2 text-gray-400" />
                <div>
                  <span className="text-gray-500">End Time:</span>
                  <span className="ml-2 font-medium">{calculateEndTime(run.timestamp, run.trial_duration)}</span>
                </div>
              </div>
              <div className="flex items-center text-sm md:col-span-2">
                <FlaskConical className="w-4 h-4 mr-2 text-gray-400" />
                <div>
                  <span className="text-gray-500">Sample ID:</span>
                  <span className="ml-2 font-medium">{run.trial_name}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Core UR2 Results */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">1. Test Results</h3>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-2">Dissolution Index (UR2 Index):</div>
              <div className="text-lg font-semibold text-blue-800">
                1.54 × [Al] + [Si] = {computedResults.hasResults ? computedResults.dissolutionIndex.toFixed(4) : 'N/A'} 
              </div>
            </div>
          </div>

          {/* Raw Concentration Data */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">2. Raw Concentration Data</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Dissolved Aluminum (Al³⁺):</div>
                <div className="text-lg font-semibold text-gray-900">{computedResults.hasResults ? computedResults.aluminum.toFixed(4) : 'N/A'}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Dissolved Silicon (Si⁴⁺):</div>
                <div className="text-lg font-semibold text-gray-900">{computedResults.hasResults ? computedResults.silicon.toFixed(4) : 'N/A'}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 md:col-span-2">
                <div className="text-sm text-gray-600 mb-1">Si/Al Ratio:</div>
                <div className="text-lg font-semibold text-gray-900">{computedResults.hasResults ? computedResults.siAlRatio.toFixed(4) : 'N/A'}</div>
              </div>
            </div>
          </div>

          {/* Per-Cycle Raw Data Table */}
          {cycleRows.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Per-Cycle Data</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-600 font-medium">Cycle</th>
                      <th className="px-3 py-2 text-left text-gray-600 font-medium">Al RGB</th>
                      <th className="px-3 py-2 text-left text-gray-600 font-medium">Al Conc.</th>
                      <th className="px-3 py-2 text-left text-gray-600 font-medium">Si RGB</th>
                      <th className="px-3 py-2 text-left text-gray-600 font-medium">Si Conc.</th>
                      <th className="px-3 py-2 text-left text-gray-600 font-medium">Dissolution Index</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {cycleRows.map(row => (
                      <tr key={row.cycle}>
                        <td className="px-3 py-2 font-medium">{row.cycle}</td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {row.al?.rgb ? `(${row.al.rgb.map(v => typeof v === 'number' ? v.toFixed(1) : v).join(', ')})` : 'N/A'}
                        </td>
                        <td className="px-3 py-2">{row.al?.concentration != null ? row.al.concentration.toFixed(4) : 'N/A'}</td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {row.si?.rgb ? `(${row.si.rgb.map(v => typeof v === 'number' ? v.toFixed(1) : v).join(', ')})` : 'N/A'}
                        </td>
                        <td className="px-3 py-2">{row.si?.concentration != null ? row.si.concentration.toFixed(4) : 'N/A'}</td>
                        <td className="px-3 py-2">{row.dissolution?.dissolution_index != null ? row.dissolution.dissolution_index.toFixed(4) : 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Test Conditions */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">3. Test Conditions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center text-sm">
                <Clock className="w-4 h-4 mr-2 text-gray-400" />
                <div>
                  <span className="text-gray-500">Test Duration:</span>
                  <span className="ml-2 font-medium">5 minutes</span>
                </div>
              </div>
              <div className="flex items-center text-sm">
                <Thermometer className="w-4 h-4 mr-2 text-gray-400" />
                <div>
                  <span className="text-gray-500">Test Temperature:</span>
                  <span className="ml-2 font-medium">90°C</span>
                </div>
              </div>
              <div className="flex items-center text-sm">
                <FlaskConical className="w-4 h-4 mr-2 text-gray-400" />
                <div>
                  <span className="text-gray-500">NaOH Concentration:</span>
                  <span className="ml-2 font-medium">4 M</span>
                </div>
              </div>
              <div className="flex items-center text-sm">
                <Hash className="w-4 h-4 mr-2 text-gray-400" />
                <div>
                  <span className="text-gray-500">Solid-to-liquid ratio:</span>
                  <span className="ml-2 font-medium">0.5 g/L</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200">
          <CSVLink
            data={csvData}
            filename={csvFilename}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 flex items-center no-underline"
            target="_self"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </CSVLink>
        </div>
      </div>
    </div>
  );
}
