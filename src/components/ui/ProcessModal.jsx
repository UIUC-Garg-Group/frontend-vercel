import React, { useEffect, useState } from 'react';
import mqttService from '../../mqtt/mqttservice';
import { X, Check, Loader2, XCircle } from 'lucide-react';
import useModalClose from '../../hooks/useModalClose';


const IMAGE_TOPIC = 'ur2/test/image';
const IMAGE_RAW_TOPIC = 'ur2/test/image/raw';

// Add isInterrupted prop to control UI when process is stopped by user
const ProcessModal = ({ isOpen, onClose, currentStage, stages, currentCycle = 1, title = "Process Running", isInterrupted = false }) => {
  const [imageUrl, setImageUrl] = useState(null);
  const [latestImageMeta, setLatestImageMeta] = useState(null);

  useEffect(() => { 
    if (!isOpen || !mqttService.isConnected || !mqttService.client) return;

    // Handler for image metadata
    const handleImageMeta = (topic, message) => {
      if (topic === IMAGE_TOPIC) {
        try {
          const meta = JSON.parse(message.toString());
          setLatestImageMeta(meta);
        } catch (e) {
          // ignore
        }
      }
    };

    // Handler for image raw bytes
    const handleImageRaw = (topic, message) => {
      if (topic === IMAGE_RAW_TOPIC && latestImageMeta) {
        // Convert bytes to blob and object URL
        const blob = new Blob([message], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        setImageUrl(url);
      }
    };

    // Subscribe to image topics
    mqttService.client.subscribe(IMAGE_TOPIC);
    mqttService.client.subscribe(IMAGE_RAW_TOPIC);
    mqttService.client.on('message', handleImageMeta);
    mqttService.client.on('message', handleImageRaw);

    return () => {
      mqttService.client.removeListener('message', handleImageMeta);
      mqttService.client.removeListener('message', handleImageRaw);
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mqttService.isConnected, latestImageMeta]);
  const { handleBackdropClick } = useModalClose({ isOpen, onClose });

  if (!isOpen) return null;


  // Updated for 5 stages, with interruption support
  const getStageIcon = (stageIndex, currentStageIndex, currentCycle, interruptedIdx = null) => {
    if (interruptedIdx !== null && stageIndex > interruptedIdx) {
      // Show cross tick for all after last successful
      return <XCircle className="w-4 h-4 text-red-500" />;
    }
    if (stageIndex === 0 && (currentStageIndex >= 1)) {
      return <Check className="w-4 h-4 text-green-600" />;
    }
    else if (stageIndex > 0 && stageIndex < 5 && (stageIndex < currentStageIndex || currentStageIndex >= 5)) {
      return <Check className="w-4 h-4 text-green-600" />;
    }
    else if (stageIndex === 4 && currentStageIndex >= 5) {
      return <Check className="w-4 h-4 text-green-600" />;
    }
    else if (stageIndex === currentStageIndex && currentStageIndex < 5) {
      return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />;
    } else {
      return <div className="w-4 h-4 rounded-full border-2 border-gray-300"></div>;
    }
  };

  const getStageStatus = (stageIndex, currentStageIndex, currentCycle, interruptedIdx = null) => {
    if (interruptedIdx !== null && stageIndex > interruptedIdx) {
      return 'failed';
    }
    if (stageIndex === 0 && (currentStageIndex >= 1)) {
      return 'completed';
    }
    else if (stageIndex > 0 && stageIndex < 5 && (stageIndex < currentStageIndex || currentStageIndex >= 5)) {
      return 'completed';
    }
    else if (stageIndex === 4 && currentStageIndex >= 5) {
      return 'completed';
    }
    else if (stageIndex === currentStageIndex && currentStageIndex < 5) {
      return 'running';
    } else {
      return 'pending';
    }
  };

  const getConnectorStyles = (stageIndex, currentStageIndex, currentCycle) => {
    const status = getStageStatus(stageIndex, currentStageIndex, currentCycle);
    if (status === 'completed') {
      return 'bg-green-400';
    } else {
      return 'bg-gray-300';
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-screen overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
            {currentCycle > 0 && (
              <p className="text-sm text-gray-600 mt-1">Sample {currentCycle} of 5</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Process Steps - Horizontal Layout */}
        <div className="p-6">
          {/* Latest Image from RPI */}
          <div className="mb-6 flex flex-col items-center">
            <div className="mb-2 text-sm text-gray-600">Latest Image from RPI</div>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Latest from RPI"
                className="max-h-64 rounded shadow border"
                onError={e => {
                  e.target.onerror = null;
                  e.target.src = "data:image/svg+xml,%3Csvg width='160' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='100%25' height='100%25' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-size='16'%3ENo Image%3C/text%3E%3C/svg%3E";
                }}
              />
            ) : (
              <div className="flex items-center justify-center max-h-64 h-40 w-64 bg-gray-100 border rounded">
                <span className="text-gray-400">No Image Available</span>
              </div>
            )}
          </div>
          {/* Completion Message */}
          {currentStage >= stages.length && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center">
                <Check className="w-5 h-5 text-green-600 mr-2" />
                <span className="text-green-800 font-medium">Process completed successfully!</span>
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-center mb-8 overflow-x-auto">
            <div className="flex items-center space-x-4">
              {/* Determine interruption index if interrupted */}
              {(() => {
                let interruptedIdx = null;
                if (isInterrupted) {
                  // Last completed stage index
                  interruptedIdx = -1;
                  for (let i = 0; i < stages.length; i++) {
                    const status = getStageStatus(i, currentStage, currentCycle, null);
                    if (status === 'completed') interruptedIdx = i;
                  }
                }
                return stages.map((stage, index) => {
                  const status = getStageStatus(index, currentStage, currentCycle, interruptedIdx);
                  const isLast = index === stages.length - 1;
                  return (
                    <div key={index} className="flex items-center">
                      {/* Stage Item */}
                      <div className="flex flex-col items-center text-center">
                        {/* Icon Container */}
                        <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                          status === 'completed' ? 'bg-green-100 border-green-500' :
                          status === 'running' ? 'bg-blue-100 border-blue-500' :
                          status === 'failed' ? 'bg-red-100 border-red-500' :
                          'bg-gray-100 border-gray-300'
                        }`}>
                          {getStageIcon(index, currentStage, currentCycle, interruptedIdx)}
                        </div>
                        {/* Stage Info */}
                        <div className="mt-2 w-20">
                          <div className={`text-xs font-medium ${
                            status === 'completed' ? 'text-green-600' :
                            status === 'running' ? 'text-blue-600' :
                            status === 'failed' ? 'text-red-600' :
                            'text-gray-500'
                          }`}>
                            Stage {index + 1}
                          </div>
                          <div className={`text-xs capitalize mt-1 leading-tight ${
                            status === 'completed' ? 'text-green-600' :
                            status === 'running' ? 'text-blue-600' :
                            status === 'failed' ? 'text-red-600' :
                            'text-gray-500'
                          }`}>
                            {stage}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {status === 'completed' && 'Done'}
                            {status === 'running' && 'Active'}
                            {status === 'pending' && 'Waiting'}
                            {status === 'failed' && 'Stopped'}
                          </div>
                        </div>
                      </div>
                      {/* Connector Line */}
                      {!isLast && (
                        <div className="w-12 h-0.5 mx-3">
                          <div className={`w-full h-full transition-all duration-300 ${getConnectorStyles(index, currentStage, currentCycle)}`}></div>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Progress</span>
              <span>{Math.round((currentStage / stages.length) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${(currentStage / stages.length) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProcessModal;
