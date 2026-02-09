import React from 'react';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import useModalClose from '../../hooks/useModalClose';

const ConfirmationModal = ({ isOpen, onConfirm, onCancel, testId, message, cycle }) => {
  const { handleBackdropClick } = useModalClose({ isOpen, onClose: onCancel });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center p-6 border-b border-gray-200">
          <AlertTriangle className="w-6 h-6 text-orange-500 mr-3" />
          <h2 className="text-xl font-semibold text-gray-900">
            {cycle ? `Cycle ${cycle}/5 Complete - Continue?` : 'User Confirmation Required'}
          </h2>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-4">
            <p className="text-gray-700 text-sm mb-2">Test ID: <span className="font-medium">{testId}</span></p>
            <p className="text-gray-800">Color agent addition - {message}. Continue with next cycle? Check if more NaOH is needed.</p>
          </div>
          
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-orange-600 mr-2 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-orange-800">
                <p className="font-medium">Please check:</p>
                <ul className="mt-1 list-disc list-inside space-y-1">
                  <li>Is there sufficient NaOH remaining?</li>
                  <li>Are all components functioning properly?</li>
                  <li>Do you want to continue with the next cycle?</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-start">
              <XCircle className="w-5 h-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-800">
                <p className="font-medium">Warning:</p>
                <p className="mt-1">Clicking "Stop Process" will terminate the test and mark it as stopped. This action cannot be undone.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={onCancel}
            className="flex items-center px-4 py-2 border border-red-300 rounded-md text-red-700 bg-red-50 hover:bg-red-100 transition-colors duration-200"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Stop Process
          </button>
          <button
            onClick={onConfirm}
            className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors duration-200"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;