import React, { useEffect, useState, useRef, useCallback } from 'react';
import mqttService from '../../mqtt/mqttservice';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import UR2Stepper from './UR2Stepper';
import useModalClose from '../../hooks/useModalClose';

const IMAGE_TOPIC = 'ur2/test/image';
const IMAGE_RAW_TOPIC = 'ur2/test/image/raw';
const CAMERA_TRIGGER_TOPIC = 'ur2/camera/trigger';
const CAMERA_READY_TOPIC = 'ur2/camera/ready';
const CAMERA_PREVIEW_CONFIRM_TOPIC = 'ur2/camera/preview_confirmed';

// Add isInterrupted prop to control UI when process is stopped by user
const ProcessModal = ({
  isOpen,
  onClose,
  currentStage,
  stages,
  currentCycle = 1,
  title = "Process Running",
  isInterrupted = false,
  waitingCameraPreview = false,
  activeTestId = null,
  onResultsUpdate = null,  // Callback to pass results to parent
  onEmergencyStop = null   // Emergency stop callback
}) => {
  const [aluminumImageUrl, setAluminumImageUrl] = useState(null);
  const [siliconImageUrl, setSiliconImageUrl] = useState(null);
  const [latestImageMeta, setLatestImageMeta] = useState(null);
  const [aluminumResults, setAluminumResults] = useState([]);
  const [siliconResults, setSiliconResults] = useState([]);
  const [viewingStage, setViewingStage] = useState(currentStage); // For navigation
  const [heatConfirmed, setHeatConfirmed] = useState(false);
  const [stirringConfirmed, setStirringConfirmed] = useState(false);
  const [waitStartTime, setWaitStartTime] = useState(null);
  const [remainingTime, setRemainingTime] = useState(330); // 5.5 minutes in seconds
  const [waitSkipped, setWaitSkipped] = useState(false);
  const [filtrationConfirmed, setFiltrationConfirmed] = useState(false);
  const [dissolutionResults, setDissolutionResults] = useState([]);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [currentCameraCapture, setCurrentCameraCapture] = useState(null);
  const [selectedSampleType, setSelectedSampleType] = useState('al'); // 'al' or 'si'
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Handle camera preview confirmation (user clicks confirm after selecting sample type)
  const handlePreviewConfirmed = () => {
    if (mqttService?.client?.connected && activeTestId) {
      mqttService.client.publish(CAMERA_PREVIEW_CONFIRM_TOPIC, JSON.stringify({
        testId: activeTestId,
        cycle: currentCycle,
        sampleType: selectedSampleType, // 'al' or 'si'
        timestamp: new Date().toISOString()
      }));
      console.log(`📸 Camera preview confirmed - ${selectedSampleType} sample - sent to RPI`);
    }
  };

  // Handle heating confirmation
  const handleHeatConfirmed = () => {
    setHeatConfirmed(true);
    // Send MQTT message to backend/fake RPI
    if (mqttService?.client?.connected) {
      mqttService.client.publish('ur2/manual/heat_confirmed', JSON.stringify({
        timestamp: new Date().toISOString(),
        temperature: 90
      }));
    }
  };

  // Handle stirring confirmation
  const handleStirringConfirmed = () => {
    setStirringConfirmed(true);
    setWaitStartTime(Date.now());
    setWaitSkipped(false); // Reset skip flag
    // Send MQTT message to backend/fake RPI
    if (mqttService?.client?.connected) {
      mqttService.client.publish('ur2/manual/stirring_confirmed', JSON.stringify({
        timestamp: new Date().toISOString(),
        rpm: 0.56,
        wait_minutes: 10
      }));
    }
  };

  // Handle skip wait (debug feature)
  const handleSkipWait = () => {
    setWaitSkipped(true);
    setRemainingTime(0);
    setWaitStartTime(null); // Stop the countdown
    // Notify backend to skip wait
    if (mqttService?.client?.connected) {
      mqttService.client.publish('ur2/manual/wait_complete', JSON.stringify({
        timestamp: new Date().toISOString(),
        skipped: true
      }));
    }
  };

  // Handle filtration confirmation
  const handleFiltrationConfirmed = () => {
    setFiltrationConfirmed(true);
    if (mqttService?.client?.connected) {
      mqttService.client.publish('ur2/manual/filtration_confirmed', JSON.stringify({
        timestamp: new Date().toISOString()
      }));
    }
  };

  // Handle camera capture
  const handleCameraCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } // Use back camera on mobile
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Could not access camera. Please check permissions.');
    }
  };

  const closeCameraModal = useCallback(() => {
    const stream = videoRef.current?.srcObject;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setShowCameraModal(false);
    setCurrentCameraCapture(null);
  }, []);

  const capturePicture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw video frame to canvas
      context.drawImage(video, 0, 0);
      
      // Convert canvas to blob and send via MQTT
      canvas.toBlob((blob) => {
        if (blob && currentCameraCapture) {
          const reader = new FileReader();
          reader.onload = () => {
            const arrayBuffer = reader.result;
            const uint8Array = new Uint8Array(arrayBuffer);
            
            // Send image metadata
            mqttService.client.publish(IMAGE_TOPIC, JSON.stringify({
              testId: currentCameraCapture.testId,
              cycle: currentCameraCapture.cycle,
              timestamp: new Date().toISOString(),
              source: 'camera'
            }));
            
            // Send image data
            mqttService.client.publish(IMAGE_RAW_TOPIC, uint8Array);
            
            // Confirm capture complete
            mqttService.client.publish(CAMERA_READY_TOPIC, JSON.stringify({
              testId: currentCameraCapture.testId,
              cycle: currentCameraCapture.cycle,
              timestamp: new Date().toISOString()
            }));
          };
          reader.readAsArrayBuffer(blob);
        }
        
        // Stop video stream
        const stream = videoRef.current?.srcObject;
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        
        // Close modal
        setShowCameraModal(false);
        setCurrentCameraCapture(null);
      }, 'image/png');
    }
  };

  // Listen for camera trigger from backend
  useEffect(() => {
    if (!isOpen || !mqttService?.isConnected || !mqttService?.client) return;

    const handleCameraTrigger = (topic, message) => {
      if (topic === CAMERA_TRIGGER_TOPIC) {
        try {
          const data = JSON.parse(message.toString());
          setCurrentCameraCapture({
            testId: data.testId,
            cycle: data.cycle
          });
          setShowCameraModal(true);
          // Delay to let modal render before starting camera
          setTimeout(() => handleCameraCapture(), 100);
        } catch (error) {
          console.error('Error handling camera trigger:', error);
        }
      }
    };

    mqttService.client.subscribe(CAMERA_TRIGGER_TOPIC);
    mqttService.client.on('message', handleCameraTrigger);

    return () => {
      mqttService.client.removeListener('message', handleCameraTrigger);
    };
  }, [isOpen]);

  // Countdown timer for 5.5-minute wait
  useEffect(() => {
    if (!waitStartTime || waitSkipped) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - waitStartTime) / 1000);
      const remaining = Math.max(0, 330 - elapsed);
      setRemainingTime(remaining);

      if (remaining === 0) {
        clearInterval(interval);
        setWaitStartTime(null);
        // Optionally notify backend that wait is complete
        if (mqttService?.client?.connected) {
          mqttService.client.publish('ur2/manual/wait_complete', JSON.stringify({
            timestamp: new Date().toISOString()
          }));
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [waitStartTime, waitSkipped]);

  // Update viewing stage when current stage changes
  useEffect(() => {
    setViewingStage(currentStage);
  }, [currentStage]);

  // keep a ref so we don't re-subscribe on every meta change
  const latestImageMetaRef = useRef(null);
  useEffect(() => {
    latestImageMetaRef.current = latestImageMeta;
  }, [latestImageMeta]);

  useEffect(() => { 
    if (!isOpen || !mqttService?.isConnected || !mqttService?.client) return;

    const handleMessage = (topic, message) => {
      try {
        if (topic === IMAGE_TOPIC) {
          const meta = JSON.parse(message.toString());
          setLatestImageMeta(meta);
          latestImageMetaRef.current = meta;  // Update ref immediately for raw image handler
          
          // Handle dissolution_index message (sent after both AL + SI are done)
          if (meta.dissolution_index != null) {
            setDissolutionResults(prevResults => {
              const newResults = [...prevResults, meta];
              return newResults;
            });
            console.log('📷 Received dissolution index:', meta.dissolution_index);
            return; // dissolution_index messages don't have images
          }
          
          // Append data to appropriate result array based on solution_type
          // Only add to results if it has concentration data (skip camera preview messages)
          if (meta.concentration != null) {
            if (meta.solution_type === 'al') {
              setAluminumResults(prevResults => {
                const newResults = [...prevResults, meta];
                if (onResultsUpdate) {
                  onResultsUpdate({ aluminum: newResults, silicon: siliconResults });
                }
                return newResults;
              });
            } else if (meta.solution_type === 'si') {
              setSiliconResults(prevResults => {
                const newResults = [...prevResults, meta];
                if (onResultsUpdate) {
                  onResultsUpdate({ aluminum: aluminumResults, silicon: newResults });
                }
                return newResults;
              });
            }
          }
          
          console.log('📷 Received image metadata:', meta);
        } else if (topic === IMAGE_RAW_TOPIC && latestImageMetaRef.current) {
          console.log('📷 Received raw image, solution_type:', latestImageMetaRef.current.solution_type);
          const blob = new Blob([message], { type: 'image/png' });
          const url = URL.createObjectURL(blob);
          
          // Determine which image box to update based on solution_type
          const solution_type = latestImageMetaRef.current.solution_type;
          if (solution_type === 'al') {
            setAluminumImageUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return url;
            });
          } else if (solution_type === 'si') {
            setSiliconImageUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return url;
            });
          } else {
            // If solution_type is not specified or unknown, clean up the URL
            URL.revokeObjectURL(url);
          }
        }
      } catch {
        // ignore parsing errors
      }
    };

    mqttService.client.subscribe(IMAGE_TOPIC);
    mqttService.client.subscribe(IMAGE_RAW_TOPIC);
    mqttService.client.on('message', handleMessage);

    return () => {
      try {
        mqttService.client.removeListener('message', handleMessage);
      } catch {}
      setLatestImageMeta(null);
      if (aluminumImageUrl) URL.revokeObjectURL(aluminumImageUrl);
      if (siliconImageUrl) URL.revokeObjectURL(siliconImageUrl);
    };
    // only resub when modal opens/closes or connection changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, aluminumImageUrl, siliconImageUrl]);

  const { handleBackdropClick } = useModalClose({ isOpen, onClose });
  const { handleBackdropClick: handleCameraBackdropClick } = useModalClose({
    isOpen: showCameraModal,
    onClose: closeCameraModal
  });

  if (!isOpen) return null;

  // Format concentration values
  const formatConcentration = (value) => {
    return value != null ? parseFloat(value).toFixed(3) : 'N/A';
  };

  // Progress (clamped)
  const total = Math.max(1, stages?.length ?? 1);
  const rawPct = (currentStage / total) * 100;
  const isComplete = currentStage >= total;
  const pct = Math.max(0, Math.min(100, Math.round(isComplete ? 100 : rawPct)));

  // Check if current stage (not viewing stage) is Preparation (manual heat/stir/wait)
  const currentStageName = stages?.[currentStage] || '';
  const isPreparationStage = currentStageName === 'Preparation';
  const isTransferStage = currentStageName === 'Transfer';
  
  // Get viewing stage name for display
  const viewingStageName = stages?.[viewingStage] || '';
  
  // Navigation handlers
  const canGoBack = viewingStage > 0;
  const canGoForward = viewingStage < currentStage;
  
  const handlePrevStage = () => {
    if (canGoBack) {
      setViewingStage(prev => prev - 1);
    }
  };
  
  const handleNextStage = () => {
    if (canGoForward) {
      setViewingStage(prev => prev + 1);
    }
  };
  
  const handleGoToCurrentStage = () => {
    setViewingStage(currentStage);
  };

  // Export results as JSON
  const handleExportJSON = () => {
    const exportData = {
      testId: activeTestId,
      exportedAt: new Date().toISOString(),
      totalSamples: Math.max(aluminumResults.length, siliconResults.length),
      results: Array.from({ length: Math.max(aluminumResults.length, siliconResults.length) }, (_, index) => ({
        sample: index + 1,
        aluminum: aluminumResults[index] || null,
        silicon: siliconResults[index] || null,
        dissolution_index: dissolutionResults[index]?.dissolution_index ?? null,
      })),
      summary: {
        aluminum: {
          count: aluminumResults.length,
          concentrations: aluminumResults.map(r => r?.concentration).filter(c => c != null),
          average: aluminumResults.length > 0 
            ? aluminumResults.reduce((sum, r) => sum + (r?.concentration || 0), 0) / aluminumResults.length 
            : null,
        },
        silicon: {
          count: siliconResults.length,
          concentrations: siliconResults.map(r => r?.concentration).filter(c => c != null),
          average: siliconResults.length > 0 
            ? siliconResults.reduce((sum, r) => sum + (r?.concentration || 0), 0) / siliconResults.length 
            : null,
        }
      }
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ur2-results-${activeTestId || 'test'}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };



  return (
    <div
      className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-0 md:p-4 bg-black bg-opacity-50 overflow-y-auto"
      onClick={handleBackdropClick}
    >
      <div className="flex flex-col w-full min-h-full md:min-h-0 md:max-h-[90vh] max-w-full md:max-w-4xl lg:max-w-6xl xl:max-w-7xl bg-white md:rounded-lg shadow-xl md:my-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0 p-4 md:p-6 border-b border-gray-200">
          <div className="flex items-center gap-3 md:gap-4 flex-wrap">
            <div className="flex items-center gap-3 md:gap-4">
              <h2 className="text-lg md:text-xl font-semibold text-gray-900">{title}</h2>
              {currentCycle > 0 && (
                <p className="text-sm text-gray-600">Sample {currentCycle}</p>
              )}
            </div>
            {viewingStage !== currentStage && (
              <button
                onClick={handleGoToCurrentStage}
                className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
              >
                Go to Current Stage
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Emergency Stop Button */}
            {!isComplete && !isInterrupted && onEmergencyStop && (
              <button
                onClick={() => {
                  if (window.confirm('EMERGENCY STOP\n\nThis will immediately halt ALL running processes on the RPI.\n\nAre you sure?')) {
                    onEmergencyStop();
                  }
                }}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded transition-colors"
              >
                STOP
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Stage Navigation */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3 bg-gray-50 border-b border-gray-200">
          <button
            onClick={handlePrevStage}
            disabled={!canGoBack}
            className={`flex items-center gap-1 px-3 py-1 rounded-md transition-colors ${
              canGoBack 
                ? 'text-blue-600 hover:bg-blue-50' 
                : 'text-gray-300 cursor-not-allowed'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-sm">Previous</span>
          </button>
          
          <div className="text-sm text-gray-600">
            Viewing: <span className="font-semibold">{viewingStageName || 'N/A'}</span>
            {viewingStage !== currentStage && (
              <span className="ml-2 text-xs text-blue-600">(History)</span>
            )}
          </div>
          
          <button
            onClick={handleNextStage}
            disabled={!canGoForward}
            className={`flex items-center gap-1 px-3 py-1 rounded-md transition-colors ${
              canGoForward 
                ? 'text-blue-600 hover:bg-blue-50' 
                : 'text-gray-300 cursor-not-allowed'
            }`}
          >
            <span className="text-sm">Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile Progress Bar - Shows only on mobile */}
        <div className="md:hidden p-3">
          <div className="flex justify-between text-xs text-gray-600 mb-2">
            <span>Progress</span>
            <span>{pct}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Notification Boxes - Manual Instructions & Camera Preview */}
        {/* Manual Instructions for Preparation Stage */}
        {isPreparationStage && !isComplete && (
          <div className="p-4 md:p-6 mb-4 p-3 bg-blue-50 border border-blue-300 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    ⚠️
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-blue-900 mb-2">Manual Instructions Required</h4>
                  
                  {!heatConfirmed && (
                    <div className="space-y-2">
                      <p className="text-xs text-blue-800">
                        <strong>Step 1:</strong> Heat NaOH solution to <strong>90°C</strong>
                      </p>
                      <button
                        onClick={handleHeatConfirmed}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-xs font-medium transition-colors"
                      >
                        ✓ Is Heating Complete ?
                      </button>
                    </div>
                  )}
                  
                  {heatConfirmed && !stirringConfirmed && (
                    <div className="space-y-2">
                      <p className="text-xs text-blue-800">
                        <strong>Step 2:</strong> Add <strong>0.02g cement</strong> to heated solution
                      </p>
                      <p className="text-xs text-blue-800">
                        <strong>Step 3:</strong> Start stirring to <strong>0.56 rpm</strong>
                      </p>
                      <p className="text-xs text-amber-700">⏱️ System will wait 5.5 minutes after confirmation</p>
                      <button
                        onClick={handleStirringConfirmed}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-xs font-medium transition-colors"
                      >
                        ✓ Cement Added & Stirring Started
                      </button>
                    </div>
                  )}
                  
                  {heatConfirmed && stirringConfirmed && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-green-700">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-700"></div>
                        <span className="text-xs font-medium">{waitSkipped ? 'Wait skipped!' : 'Waiting for dissolution...'}</span>
                      </div>
                      {!waitSkipped && (
                        <div className="flex items-center justify-between">
                          <div className="text-2xl font-bold text-green-800 tabular-nums">
                            {Math.floor(remainingTime / 60)}:{String(remainingTime % 60).padStart(2, '0')}
                          </div>
                          {remainingTime > 0 && (
                            <button
                              onClick={handleSkipWait}
                              className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded transition-colors"
                            >
                              ⚡ Skip
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Manual Filtration Confirmation for Transfer Stage */}
          {isTransferStage && !isComplete && !filtrationConfirmed && (
            <div className="p-4 md:p-6 mb-4 p-3 bg-amber-50 border border-amber-300 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  <div className="w-8 h-8 bg-amber-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    🔬
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-amber-900 mb-2">Manual Filtration Required</h4>
                  <p className="text-xs text-amber-800 mb-3">
                    Please complete the filtration process and click confirm when ready to proceed.
                  </p>
                  <button
                    onClick={handleFiltrationConfirmed}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded text-xs font-medium transition-colors"
                  >
                    ✓ Filtration Complete
                  </button>
                </div>
              </div>
            </div>
          )}

        {/* Scrollable Content - Stepper + Results + Images */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          
          {/* Stepper Section */}
          <div className="flex justify-center mb-6">
            <div className="w-full max-w-4xl">
              <UR2Stepper
                stages={stages}
                currentStage={currentStage}
                isInterrupted={isInterrupted}
              />
            </div>
          </div>
          
          {/* Camera Preview Confirmation - Shows when RPI is displaying camera preview */}
          {waitingCameraPreview && !isComplete && (
            <div className="mb-4 p-4 bg-purple-50 border border-purple-300 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white text-lg">
                    📷
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-purple-900 mb-2">Camera Preview Active</h4>
                  <p className="text-sm text-purple-800 mb-3">
                    The camera preview is now displaying on the Raspberry Pi screen. 
                    Select the sample type and click confirm when the preview looks good.
                  </p>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="animate-pulse w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-purple-700">Preview is live on RPI display...</span>
                  </div>
                  
                  {/* Sample Type Toggle */}
                  <div className="mb-4 p-3 bg-white rounded-lg border border-purple-200">
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Sample Type:</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedSampleType('al')}
                        className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                          selectedSampleType === 'al'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <span>🔵</span>
                        <span>Aluminum</span>
                      </button>
                      <button
                        onClick={() => setSelectedSampleType('si')}
                        className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                          selectedSampleType === 'si'
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <span>🟢</span>
                        <span>Silicon</span>
                      </button>
                    </div>
                  </div>
                  
                  {/* Confirm Button */}
                  <button
                    onClick={handlePreviewConfirmed}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <span>✓</span>
                    <span>Preview Looks Good - Capture {selectedSampleType === 'al' ? 'Aluminum' : 'Silicon'} Image</span>
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Results and Images Container */}
          <div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:h-full md:overflow-hidden">
            
            {/* Concentration Results - Left Side */}
            <div className="flex flex-col md:min-h-0 md:h-full">
              <div className="flex items-center justify-end flex-shrink-0 mb-3 md:mb-4">
                {(aluminumResults.length > 0 || siliconResults.length > 0) && (
                  <button
                    onClick={handleExportJSON}
                    className="flex items-center gap-1 px-3 py-1 text-sm text-white bg-green-500 rounded hover:bg-green-600 transition-colors"
                    title="Export results as JSON"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export JSON
                  </button>
                )}
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto border border-gray-200 rounded-lg">
                {Math.max(aluminumResults.length, siliconResults.length) === 0 ? (
                  <div className="text-gray-400 text-sm py-8 text-center">
                    No results yet...
                  </div>
                ) : (
                  <div className="overflow-y-auto h-full">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white">
                        <tr className="border-b-2 border-gray-200">
                          <th className="py-3 px-3 md:px-4 text-left font-semibold text-gray-700">Sample</th>
                          <th className="py-3 px-3 md:px-4 text-left font-semibold text-gray-700">Aluminum (μM)</th>
                          <th className="py-3 px-3 md:px-4 text-left font-semibold text-gray-700">Silicon (μM)</th>
                          <th className="py-3 px-3 md:px-4 text-left font-semibold text-gray-700">RGB</th>
                          <th className="py-3 px-3 md:px-4 text-left font-semibold text-gray-700">Dissolution Index</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: Math.max(aluminumResults.length, siliconResults.length) }, (_, index) => {
                          const alData = aluminumResults[index];
                          const siData = siliconResults[index];
                          const diData = dissolutionResults[index];
                          const sampleNumber = index + 1;
                          return (
                            <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-3 px-3 md:px-4 text-gray-700 font-medium">{sampleNumber}</td>
                              <td className="py-3 px-3 md:px-4 text-gray-600">{formatConcentration(alData?.concentration)}</td>
                              <td className="py-3 px-3 md:px-4 text-gray-600">{formatConcentration(siData?.concentration)}</td>
                              <td className="py-3 px-3 md:px-4 text-gray-600 text-xs font-mono">
                                {(() => {
                                  const rgb = alData?.rgb || siData?.rgb;
                                  if (!rgb) return 'N/A';
                                  const [r, g, b] = rgb;
                                  return `(${r.toFixed(3)}, ${g.toFixed(3)}, ${b.toFixed(3)})`;
                                })()}
                              </td>
                              <td className="py-3 px-3 md:px-4 text-gray-600 font-semibold">{diData?.dissolution_index != null ? diData.dissolution_index : 'N/A'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
            
            {/* Images - Right Side */}
            <div className="flex flex-col items-center justify-center">
              <div className="grid grid-cols-2 gap-6 w-full max-w-md">
                  
                  {/* Aluminum Image */}
                  <div className="flex flex-col items-center">
                    <div className="mb-3 text-sm font-medium text-gray-600">Aluminum</div>
                    {aluminumImageUrl ? (
                      <img
                        src={aluminumImageUrl}
                        alt="Aluminum Analysis"
                        className="w-full max-w-32 object-contain"
                        style={{ height: 'auto', maxHeight: '200px' }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      className="flex flex-col items-center justify-center w-32 h-40 text-xs text-center text-gray-400 bg-gray-50 border border-dashed border-gray-300 rounded"
                      style={{ display: aluminumImageUrl ? 'none' : 'flex' }}
                    >
                      
                      <div className="text-sm text-center">
                        {aluminumImageUrl ? 'Image N/A' : 'Waiting for Image...'}
                      </div>
                    </div>
                  </div>

                  {/* Silicon Image */}
                  <div className="flex flex-col items-center">
                    <div className="mb-3 text-sm font-medium text-gray-600">Silicon</div>
                    {siliconImageUrl ? (
                      <img
                        src={siliconImageUrl}
                        alt="Silicon Analysis"
                        className="w-full max-w-32 object-contain"
                        style={{ height: 'auto', maxHeight: '200px' }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      className="flex flex-col items-center justify-center w-32 h-40 text-xs text-center text-gray-400 bg-gray-50 border border-dashed border-gray-300 rounded"
                      style={{ display: siliconImageUrl ? 'none' : 'flex' }}
                    >
                      <div className="text-sm text-center">
                        {siliconImageUrl ? 'Image N/A' : 'Waiting for Image...'}
                      </div>
                    </div>
                  </div>
                  
                </div>
            </div>
          </div>
        </div>

        {/* Footer - Progress Bar (Desktop only) */}
        <div className="hidden md:block p-3 md:p-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Progress</span>
            <span>{pct}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

      </div>

      {/* Camera Capture Modal */}
      {showCameraModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
          onClick={handleCameraBackdropClick}
        >
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">Capture Image - Sample {currentCameraCapture?.cycle}</h3>
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full rounded-lg mb-4"
                style={{ maxHeight: '60vh' }}
              />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>
            <div className="flex gap-4 justify-end">
              <button
                onClick={closeCameraModal}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={capturePicture}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
              >
                📸 Capture
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessModal;
