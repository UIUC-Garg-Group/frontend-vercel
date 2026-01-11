import React, { useState, useEffect } from 'react';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

// Helper to get auth headers
const getAuthHeaders = () => {
    const token = localStorage.getItem('ur2_token');
    return {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };
};

const MQTTSettings = () => {
    const [config, setConfig] = useState({
        broker: '',
        username: '',
        password: '',
        port: 8883,
        useTLS: true
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        loadCurrentConfig();
    }, []);

    const loadCurrentConfig = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/config/mqtt`, {
                headers: getAuthHeaders()
            });
            if (response.ok) {
                const mqttConfig = await response.json();
                setConfig(mqttConfig);
            } else if (response.status === 401) {
                setMessage('⚠️ Unauthorized - Please login again');
            } else {
                setMessage('Could not load current configuration');
            }
        } catch (error) {
            setMessage('Error loading configuration: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage('');

        try {
            const response = await fetch(`${API_BASE_URL}/config/mqtt`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(config),
            });

            if (response.ok) {
                await response.json();
                setMessage('✅ MQTT configuration updated successfully! Please refresh the page for changes to take effect.');
            } else {
                const error = await response.json();
                setMessage('❌ Error: ' + error.error);
            }
        } catch (error) {
            setMessage('❌ Network error: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleInputChange = (field, value) => {
        setConfig(prev => ({
            ...prev,
            [field]: value
        }));
    };

    if (loading) {
        return <div className="p-6">Loading configuration...</div>;
    }

    return (
        <div className="max-w-2xl mx-auto p-6">
            <h2 className="text-2xl font-bold mb-6">MQTT Configuration</h2>
            
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                <div className="flex">
                    <div className="flex-shrink-0">⚠️</div>
                    <div className="ml-3">
                        <p className="text-sm text-yellow-700">
                            <strong>Admin Only:</strong> Changing these settings will affect all users. 
                            Make sure to test the connection before saving.
                        </p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        MQTT Broker URL
                    </label>
                    <input
                        type="text"
                        value={config.broker}
                        onChange={(e) => handleInputChange('broker', e.target.value)}
                        placeholder="04e8fe793a8947ad8eda947204522088.s1.eu.hivemq.cloud"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Username
                        </label>
                        <input
                            type="text"
                            value={config.username}
                            onChange={(e) => handleInputChange('username', e.target.value)}
                            placeholder="ur2gglab"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Password
                        </label>
                        <input
                            type="password"
                            value={config.password}
                            onChange={(e) => handleInputChange('password', e.target.value)}
                            placeholder="Ur2gglab"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Port
                        </label>
                        <input
                            type="number"
                            value={config.port}
                            onChange={(e) => handleInputChange('port', parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Use TLS/SSL
                        </label>
                        <select
                            value={config.useTLS ? 'true' : 'false'}
                            onChange={(e) => handleInputChange('useTLS', e.target.value === 'true')}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="true">Yes (Recommended)</option>
                            <option value="false">No</option>
                        </select>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-4">
                    <button
                        type="button"
                        onClick={loadCurrentConfig}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                        Reset to Current
                    </button>
                    
                    <button
                        type="submit"
                        disabled={saving}
                        className={`px-6 py-2 rounded-md text-white font-medium ${
                            saving 
                                ? 'bg-gray-400 cursor-not-allowed' 
                                : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                    >
                        {saving ? 'Saving...' : 'Save Configuration'}
                    </button>
                </div>
            </form>

            {message && (
                <div className={`mt-4 p-4 rounded-md ${
                    message.includes('✅') 
                        ? 'bg-green-50 text-green-800 border border-green-200' 
                        : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                    {message}
                </div>
            )}

            <div className="mt-8 p-4 bg-gray-50 rounded-md">
                <h3 className="font-medium text-gray-900 mb-2">Testing Connection</h3>
                <p className="text-sm text-gray-600">
                    After saving new settings, you can test the connection by:
                </p>
                <ul className="text-sm text-gray-600 mt-2 list-disc list-inside space-y-1">
                    <li>Refreshing the page to reload the MQTT service</li>
                    <li>Creating a new test to verify Pi communication</li>
                    <li>Checking the browser console for connection messages</li>
                </ul>
            </div>
        </div>
    );
};

export default MQTTSettings;