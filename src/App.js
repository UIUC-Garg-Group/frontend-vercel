// App.jsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/dashboard/Sidebar';
import MainView from './components/dashboard/MainView';
import Console from './components/dashboard/Console';
import Login from './components/auth/Login';
import AuthCallback from './components/auth/AuthCallback';
import mqttService from './mqtt/mqttservice'; // Import the service

function Dashboard({ user, onLogout, activePage, setActivePage, logs, addLog, mqttConnected }) {
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

  // Initialize MQTT connection once at app level - only after login
  useEffect(() => {
    if (!user || !token) {
      // Not logged in, don't connect to MQTT
      return;
    }

    const initializeMQTT = async () => {
      try {
        // Reload config with auth token, then connect
        await mqttService.loadConfiguration();
        await mqttService.connect();
        addLog('MQTT connection established');
      } catch (error) {
        addLog(`MQTT connection failed: ${error.message}`);
      }
    };

    initializeMQTT();

    // Check connection status periodically
    const checkConnection = () => {
      setMqttConnected(mqttService.isConnected);
    };
    
    const interval = setInterval(checkConnection, 1000);
    
    return () => {
      clearInterval(interval);
      // Don't disconnect here - let it persist
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