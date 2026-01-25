// App.jsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/dashboard/Sidebar';
import MainView from './components/dashboard/MainView';
import Console from './components/dashboard/Console';
import Login from './components/auth/Login';
import AuthCallback from './components/auth/AuthCallback';
import mqttService from './mqtt/mqttservice'; // Import the service

function Dashboard({ user, onLogout, activePage, setActivePage, logs, addLog, mqttConnected, onConnectMqtt, onDisconnectMqtt, mqttConnecting }) {
  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 flex overflow-hidden">
        <Navbar 
          activePage={activePage}
          setActivePage={setActivePage}
          user={user}
          onLogout={onLogout}
          mqttConnected={mqttConnected}
          mqttConnecting={mqttConnecting}
          onConnectMqtt={onConnectMqtt}
          onDisconnectMqtt={onDisconnectMqtt}
        />
        
        <div className="flex-1 flex flex-col min-w-0">
          <header className="px-6 py-4">
            <div className="max-w-7xl mx-auto">
              <h1 className="text-2xl font-bold text-gray-900">
                UR2 Device Interface
              </h1>
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
    </div>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState('home'); 
  const [logs, setLogs] = useState([]);
  const [mqttConnected, setMqttConnected] = useState(false);
  const [mqttConnecting, setMqttConnecting] = useState(false);
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
              />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}