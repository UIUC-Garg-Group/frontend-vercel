// App.jsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/dashboard/Sidebar';
import MainView from './components/dashboard/MainView';
import Console from './components/dashboard/Console';
import Login from './components/auth/Login';
import AuthCallback from './components/auth/AuthCallback';
import { UserProvider } from './context/UserContext';
import mqttService from './mqtt/mqttservice'; // Import the service
import CreateTestModal from './components/ui/CreateTestModal';

function Dashboard({ user, onLogout, activePage, setActivePage, logs, addLog, mqttConnected, onConnectMqtt, onDisconnectMqtt, mqttConnecting, showCreateModal, setShowCreateModal }) {
  const handleCreateClick = () => {
    if (!mqttConnected) {
      alert('Please connect with the device first');
      addLog && addLog('Cannot create test - MQTT not connected');
      return;
    }
    setShowCreateModal(true);
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 flex overflow-hidden">
        <Navbar 
          activePage={activePage}
          setActivePage={setActivePage}
          user={user}
          onLogout={onLogout}
        />
        
        <div className="flex-1 flex flex-col min-w-0">
          <header className="px-6 py-4 border-b border-gray-200">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900">
                UR2 Management Dashboard
              </h1>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCreateClick}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#334155] bg-[#F1F5F9] border border-[#CBD5E1] hover:bg-[#E2E8F0] rounded-md transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create
                </button>
                <button
                  onClick={() => {
                    if (!mqttConnected) {
                      alert('Please connect with the device first');
                      addLog && addLog('Cannot run image analysis - MQTT not connected');
                      return;
                    }
                    const analysisId = `img-analysis-${Date.now()}`;
                    mqttService.sendImageAnalysisCommand(analysisId);
                    addLog && addLog(`Starting image analysis: ${analysisId}`);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#334155] bg-[#F1F5F9] border border-[#CBD5E1] hover:bg-[#E2E8F0] rounded-md transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Image Analysis
                </button>
                {mqttConnected ? (
                  <button
                    onClick={onDisconnectMqtt}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#334155] bg-[#F1F5F9] border border-[#CBD5E1] hover:bg-[#E2E8F0] rounded-md transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                    </svg>
                    Connected
                  </button>
                ) : (
                  <button
                    onClick={onConnectMqtt}
                    disabled={mqttConnecting}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {mqttConnecting ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3" />
                      </svg>
                    )}
                    {mqttConnecting ? 'Connecting...' : 'Connect'}
                  </button>
                )}
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-auto bg-gray-50">
            <MainView 
              activePage={activePage}
              setActivePage={setActivePage}
              addLog={addLog}
              mqttConnected={mqttConnected}
            />
          </div>
          
          <Console 
            logs={logs}
            addLog={addLog}
          />
        </div>
      </div>

      {/* Create Test Modal */}
      <CreateTestModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        addLog={addLog}
        setActivePage={setActivePage}
        mqttConnected={mqttConnected}
      />
    </div>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState('home'); 
  const [logs, setLogs] = useState([]);
  const [mqttConnected, setMqttConnected] = useState(false);
  const [mqttConnecting, setMqttConnecting] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('ur2_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('ur2_token'));

  const addLog = (log) => setLogs((prev) => [...prev, log]);

  const handleLogin = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('ur2_user', JSON.stringify(userData));
    if (authToken) {
      localStorage.setItem('ur2_token', authToken);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('ur2_user');
    localStorage.removeItem('ur2_token');
    setActivePage('home');
  };

  // Manual MQTT connection handlers
  const handleConnectMqtt = async () => {
    if (!user || !token) {
      addLog('Please login first');
      return;
    }
    setMqttConnecting(true);
    try {
      await mqttService.connect();
      addLog('Connected to backend - MQTT relay active');
    } catch (error) {
      addLog(`Connection failed: ${error.message}`);
    } finally {
      setMqttConnecting(false);
    }
  };

  const handleDisconnectMqtt = () => {
    mqttService.disconnect();
    setMqttConnected(false);
    setMqttConnecting(false);
    addLog('MQTT disconnected');
  };

  // Check MQTT connection status periodically
  useEffect(() => {
    const checkConnection = () => {
      setMqttConnected(mqttService.isConnected);
    };
    
    const interval = setInterval(checkConnection, 1000);
    
    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <UserProvider>
      <BrowserRouter>
        <Routes>
          <Route 
            path="/login" 
            element={user ? <Navigate to="/" replace /> : <Login />} 
          />
          <Route 
            path="/auth/callback" 
            element={<AuthCallback onLogin={handleLogin} />} 
          />
          <Route 
            path="/*" 
            element={
              user ? (
                <Dashboard
                  user={user}
                  onLogout={handleLogout}
                  activePage={activePage}
                  setActivePage={setActivePage}
                  logs={logs}
                  addLog={addLog}
                  mqttConnected={mqttConnected}
                  mqttConnecting={mqttConnecting}
                  onConnectMqtt={handleConnectMqtt}
                  onDisconnectMqtt={handleDisconnectMqtt}
                  showCreateModal={showCreateModal}
                  setShowCreateModal={setShowCreateModal}
                />
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
        </Routes>
      </BrowserRouter>
    </UserProvider>
  );
}