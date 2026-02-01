import React, { useState } from 'react';
import MQTTSettings from '../admin/MQTTSettings';
import TeamManagement from '../admin/TeamManagement';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('mqtt');

  const tabs = [
    { id: 'mqtt', label: 'MQTT Configuration', icon: '🔗' },
    { id: 'system', label: 'System Settings', icon: '⚙️' },
    { id: 'users', label: 'Team Management', icon: '👥' },
  ];

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
        <p className="text-gray-600 mt-2">
          Configure MQTT connections, system parameters, and user access.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {activeTab === 'mqtt' && <MQTTSettings />}
        
        {activeTab === 'system' && (
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">System Configuration</h3>
            <div className="text-gray-600">
              <p>System configuration options will be available here:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Backend API endpoint configuration</li>
                <li>Default test parameters</li>
                <li>Logging and monitoring settings</li>
                <li>Device timeout and retry settings</li>
              </ul>
            </div>
          </div>
        )}
        
        {activeTab === 'users' && <TeamManagement />}
      </div>
    </div>
  );
}