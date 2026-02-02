import React, { useState, useEffect } from 'react';
import { User, FileText, Hash, RotateCcw, Send, X } from 'lucide-react';
import mqttService from '../../mqtt/mqttservice';
import { useUser } from '../../context/UserContext';
import useModalClose from '../../hooks/useModalClose';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

export default function CreateTestModal({ isOpen, onClose, addLog, setActivePage, mqttConnected: mqttConnectedProp }) {
  const { userId, teamId } = useUser();
  const [formData, setFormData] = useState({
    trialName: '',
    userName: '',
    sampleSize: '',
    cementAdded: false,
    syringeFiltersSwapped: false,
    debugMode: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [mqttConnected, setMqttConnected] = useState(mqttConnectedProp || false);

  // Update MQTT connection status when prop changes
  useEffect(() => {
    setMqttConnected(mqttConnectedProp || false);
  }, [mqttConnectedProp]);

  // Check connection status periodically (as backup)
  useEffect(() => {
    const checkConnection = () => {
      setMqttConnected(mqttService.isConnected);
    };
    const interval = setInterval(checkConnection, 1000);
    
    return () => {
      clearInterval(interval);
    };
  }, []);

  const { handleBackdropClick } = useModalClose({ isOpen, onClose });

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.trialName.trim()) {
      newErrors.trialName = 'Trial name is required';
    }
    
    if (!formData.userName.trim()) {
      newErrors.userName = 'Your name is required';
    }
    
    if (!formData.sampleSize.trim()) {
      newErrors.sampleSize = 'Sample size is required';
    } else if (isNaN(formData.sampleSize) || parseFloat(formData.sampleSize) <= 0) {
      newErrors.sampleSize = 'Sample size must be a positive number';
    }
    
    if (!formData.cementAdded) {
      newErrors.cementAdded = 'Please confirm if cement was added';
    }
    
    if (!formData.syringeFiltersSwapped) {
      newErrors.syringeFiltersSwapped = 'Please confirm if syringe filters were swapped';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      addLog && addLog('Form validation failed. Please check the required fields.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/runs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          trial_name: formData.trialName,
          trial_operator: formData.userName,
          sample_size: parseInt(formData.sampleSize),
          user_id: userId || null,
          team_id: teamId || null
        })
      });

      if (response.ok) {
        const result = await response.json();
        addLog && addLog(`Test created successfully: ${formData.trialName} (ID: ${result.trial_id || 'N/A'})`);
        
        // Send start command via MQTT if connected
        if (mqttConnected && result.trial_id) {
          const success = mqttService.sendStartCommand(result.trial_id, formData.debugMode);
          if (success) {
            addLog && addLog(`Sent start command to RPI for test: ${result.trial_id}${formData.debugMode ? ' (DEBUG MODE)' : ''}`);
            
            // Navigate to dashboard and show process modal
            setActivePage && setActivePage('home');
            addLog && addLog('Redirected to Dashboard with active test process.');
            
            // Pass the test info to dashboard via a global state
            window.activeTestInfo = {
              testId: result.trial_id,
              trialName: formData.trialName,
              showProcessModal: true,
              debugMode: formData.debugMode
            };
          } else {
            addLog && addLog(`Failed to send start command`);
          }
        } else if (!mqttConnected) {
          addLog && addLog(`Cannot start test - MQTT not connected`);
          // Still navigate to dashboard even if MQTT is not connected
          setActivePage && setActivePage('home');
          addLog && addLog('Redirected to Dashboard.');
        }
        
        // Reset form and close modal
        handleReset();
        onClose();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create test');
      }
    } catch (error) {
      console.error('Error submitting test:', error);
      addLog && addLog(`Error creating test: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({
      trialName: '',
      userName: '',
      sampleSize: '',
      cementAdded: false,
      syringeFiltersSwapped: false,
      debugMode: false
    });
    setErrors({});
    addLog && addLog('Form reset successfully');
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Create New Test</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isSubmitting}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-6">
            {/* Trial Name */}
            <div>
              <label htmlFor="trialName" className="block text-sm font-medium text-gray-700 mb-2">
                <FileText className="w-4 h-4 inline mr-1" />
                Trial Name
              </label>
              <input
                id="trialName"
                type="text"
                placeholder="Enter trial name"
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.trialName ? 'border-red-300' : 'border-gray-300'
                }`}
                value={formData.trialName}
                onChange={(e) => handleInputChange('trialName', e.target.value)}
                disabled={isSubmitting}
              />
              {errors.trialName && (
                <p className="mt-1 text-sm text-red-600">{errors.trialName}</p>
              )}
            </div>

            {/* User Name */}
            <div>
              <label htmlFor="userName" className="block text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-1" />
                Your Name
              </label>
              <input
                id="userName"
                type="text"
                placeholder="Enter your name or email"
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.userName ? 'border-red-300' : 'border-gray-300'
                }`}
                value={formData.userName}
                onChange={(e) => handleInputChange('userName', e.target.value)}
                disabled={isSubmitting}
              />
              {errors.userName && (
                <p className="mt-1 text-sm text-red-600">{errors.userName}</p>
              )}
            </div>

            {/* Sample Size */}
            <div>
              <label htmlFor="sampleSize" className="block text-sm font-medium text-gray-700 mb-2">
                <Hash className="w-4 h-4 inline mr-1" />
                Sample Size (grams)
              </label>
              <input
                id="sampleSize"
                type="number"
                step="0.001"
                placeholder="Enter sample size (e.g., 0.025)"
                min="0.001"
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.sampleSize ? 'border-red-300' : 'border-gray-300'
                }`}
                value={formData.sampleSize}
                onChange={(e) => handleInputChange('sampleSize', e.target.value)}
                disabled={isSubmitting}
              />
              {errors.sampleSize && (
                <p className="mt-1 text-sm text-red-600">{errors.sampleSize}</p>
              )}
            </div>

            {/* Cement Added Checkbox */}
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.cementAdded}
                  onChange={(e) => handleInputChange('cementAdded', e.target.checked)}
                  disabled={isSubmitting}
                  className={`h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded ${
                    errors.cementAdded ? 'border-red-300' : ''
                  }`}
                />
                <span className="ml-2 text-sm font-medium text-gray-700">Sample added? *</span>
              </label>
              {errors.cementAdded && (
                <p className="mt-1 text-sm text-red-600">{errors.cementAdded}</p>
              )}
            </div>

            {/* Syringe Filters Swapped Checkbox */}
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.syringeFiltersSwapped}
                  onChange={(e) => handleInputChange('syringeFiltersSwapped', e.target.checked)}
                  disabled={isSubmitting}
                  className={`h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded ${
                    errors.syringeFiltersSwapped ? 'border-red-300' : ''
                  }`}
                />
                <span className="ml-2 text-sm font-medium text-gray-700">Syringe filters swapped *</span>
              </label>
              {errors.syringeFiltersSwapped && (
                <p className="mt-1 text-sm text-red-600">{errors.syringeFiltersSwapped}</p>
              )}
            </div>

            {/* Debug Mode Checkbox */}
            <div className="border-t pt-4">
              <label className="flex items-start">
                <input
                  type="checkbox"
                  checked={formData.debugMode}
                  onChange={(e) => handleInputChange('debugMode', e.target.checked)}
                  disabled={isSubmitting}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
                />
                <div className="ml-2">
                  <span className="text-sm font-medium text-gray-700">Debug Mode (Testing Only)</span>
                  <p className="text-xs text-gray-500 mt-1">
                    Enable this to run a simulated test using pre-captured images. 
                    The system will automatically continue through all cycles without real hardware.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Run Test
                </>
              )}
            </button>
            
            <button
              type="button"
              onClick={handleReset}
              disabled={isSubmitting}
              className="flex-1 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded-md transition-colors duration-200 flex items-center justify-center"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
