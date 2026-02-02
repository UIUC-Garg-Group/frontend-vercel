import React from 'react';
import { Play, Eye, Clock, User, Calendar, Activity, Trash2 } from 'lucide-react';

export default function TestRunCard({ run, onView, onRerun, onStatus, onDelete, isActive, currentStage }) {
  const getStatusDisplay = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'Completed';
      case 'failed':
      case 'error':
        return 'Failed';
      case 'running':
        return 'Running';
      case 'pending':
        return 'Pending';
      default:
        return status || 'Unknown';
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'running':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow duration-200 ${
      isActive ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
    }`}>
      {/* Active Stage Indicator - Top */}
      {/* {isActive && (
        <div className="p-4 pb-0">
          <div className="flex items-center text-xs text-blue-600">
            <div className="w-2 h-2 bg-blue-500 rounded-full mr-1 animate-pulse"></div>
            Stage {currentStage}
          </div>
        </div>
      )} */}

      {/* Card Content */}
      <div className="p-4 pt-2">
        {/* Run ID and Status Badge */}
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <div className="text-sm text-gray-500">Trial_id: {run.trial_id}</div>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(run.run_status)}`}>
              {getStatusDisplay(run.run_status)}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 leading-tight">{run.trial_name}</h3>
        </div>

        {/* Run Details */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center text-sm text-gray-600">
            <User className="w-4 h-4 mr-2 text-gray-400" />
            <span>{run.trial_operator}</span>
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <Calendar className="w-4 h-4 mr-2 text-gray-400" />
            <span>{formatDate(run.timestamp)}</span>
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <Clock className="w-4 h-4 mr-2 text-gray-400" />
            <span>{run.trial_duration || 'N/A'}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <button
            onClick={() => onView(run)}
            className="flex-1 bg-[#F1F5F9] border-2 border-[#BFC7D2] text-[#4B5563] hover:bg-[#E2E8F0] text-sm font-semibold py-2 px-3 rounded-md transition-colors duration-200 flex items-center justify-center"
          >
            <Eye className="w-4 h-4 mr-1" />
            View
          </button>
          <button
            onClick={() => onStatus(run)}
            className="flex-1 bg-[#F1F5F9] border-2 border-[#BFC7D2] text-[#4B5563] hover:bg-[#E2E8F0] text-sm font-semibold py-2 px-3 rounded-md transition-colors duration-200 flex items-center justify-center"
          >
            <Activity className="w-4 h-4 mr-1" />
            Status
          </button>
          <button
            onClick={() => onRerun(run)}
            className="flex-1 bg-[#F1F5F9] border-2 border-[#BFC7D2] text-[#4B5563] hover:bg-[#E2E8F0] text-sm font-semibold py-2 px-3 rounded-md transition-colors duration-200 flex items-center justify-center"
          >
            <Play className="w-4 h-4 mr-1" />
            Rerun
          </button>
          <button
            onClick={() => onDelete(run)}
            className="text-[#DC2626] hover:text-[#B91C1C] text-sm font-semibold py-2 px-3 rounded-md transition-colors duration-200 flex items-center justify-center"
            title="Delete test"
          >
            <Trash2 className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
