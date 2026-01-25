import { io } from 'socket.io-client';

/**
 * MQTT Service - Connects to backend via WebSocket
 * Backend handles actual MQTT connection to HiveMQ for security
 * (credentials never exposed to browser)
 */
class MQTTService {
    constructor() {
        this.socket = null;
        this.isConnected = false;  // MQTT connected (via backend)
        this.isConnecting = false;
        this.socketConnected = false;  // WebSocket to backend
        
        // Callbacks for handling messages
        this.stageUpdateCallback = null;
        this.confirmationCallback = null;
        this.imageCallback = null;
        this.statusCallback = null;
    }

    async connect() {
        if (this.socketConnected && this.socket) {
            // Already connected to backend, just request MQTT connect
            this.socket.emit('mqtt:connect');
            return this.socket;
        }

        if (this.isConnecting) {
            console.log("🔄 Connection already in progress...");
            return;
        }

        this.isConnecting = true;
        
        const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
        
        return new Promise((resolve, reject) => {
            this.socket = io(API_BASE_URL, {
                transports: ['websocket', 'polling'],
                timeout: 10000,
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000
            });

            this.socket.on('connect', () => {
                console.log('✅ Connected to backend WebSocket');
                this.socketConnected = true;
                this.isConnecting = false;
            });

            this.socket.on('mqtt:status', (data) => {
                console.log('📡 MQTT Status:', data.connected ? 'Connected' : 'Disconnected');
                this.isConnected = data.connected;
                if (this.statusCallback) {
                    this.statusCallback(data);
                }
                if (data.connected && this.isConnecting) {
                    this.isConnecting = false;
                    resolve(this.socket);
                }
            });

            this.socket.on('mqtt:stage', (data) => {
                // Handle stage updates from RPI
                if (data.run_status === 'waiting_confirmation') {
                    if (this.confirmationCallback) {
                        this.confirmationCallback(data);
                    }
                } else {
                    if (this.stageUpdateCallback) {
                        this.stageUpdateCallback(data);
                    }
                }
            });

            this.socket.on('mqtt:image', (data) => {
                console.log('📷 Received image metadata:', data);
                if (this.imageCallback) {
                    this.imageCallback(data, null);
                }
            });

            this.socket.on('mqtt:image:raw', (base64Data) => {
                console.log('📷 Received raw image data');
                if (this.imageCallback) {
                    this.imageCallback(null, base64Data);
                }
            });

            this.socket.on('mqtt:error', (data) => {
                console.error('❌ MQTT Error:', data.error);
            });

            this.socket.on('mqtt:published', (data) => {
                console.log('📤 Message published to:', data.topic);
            });

            this.socket.on('connect_error', (error) => {
                console.error('❌ WebSocket connection error:', error.message);
                this.isConnecting = false;
                this.isConnected = false;
                this.socketConnected = false;
                reject(error);
            });

            this.socket.on('disconnect', (reason) => {
                console.log('🔌 WebSocket disconnected:', reason);
                this.isConnected = false;
                this.socketConnected = false;
            });

            // Request MQTT connection through backend
            this.socket.emit('mqtt:connect');
            
            // Timeout for initial connection
            setTimeout(() => {
                if (this.isConnecting) {
                    this.isConnecting = false;
                    resolve(this.socket); // Resolve anyway, MQTT might connect later
                }
            }, 15000);
        });
    }

    sendStartCommand(testId, debugMode = false) {
        if (!this.socket || !this.socketConnected) {
            console.error('Cannot send command, not connected to backend');
            return false;
        }
        
        this.socket.emit('mqtt:startTest', {
            testId: testId,
            debugMode: debugMode
        });
        
        console.log('📤 Sent start command for test:', testId);
        return true;
    }

    sendConfirmation(testId, confirmed) {
        if (!this.socket || !this.socketConnected) {
            console.error('Cannot send confirmation, not connected to backend');
            return false;
        }
        
        this.socket.emit('mqtt:confirm', {
            testId: testId,
            confirmed: confirmed
        });
        
        console.log('📤 Sent confirmation for test:', testId, 'confirmed:', confirmed);
        return true;
    }

    // Generic publish method (for backwards compatibility)
    publish(topic, message) {
        if (!this.socket || !this.socketConnected) {
            console.error('Cannot publish, not connected to backend');
            return false;
        }
        
        this.socket.emit('mqtt:publish', {
            topic: topic,
            message: typeof message === 'string' ? JSON.parse(message) : message
        });
        
        return true;
    }

    // Set callback for stage updates
    setStageUpdateCallback(callback) {
        this.stageUpdateCallback = callback;
    }

    // Set callback for confirmation requests
    setConfirmationCallback(callback) {
        this.confirmationCallback = callback;
    }

    // Set callback for image data
    setImageCallback(callback) {
        this.imageCallback = callback;
    }

    // Set callback for MQTT status changes
    setStatusCallback(callback) {
        this.statusCallback = callback;
    }

    disconnect() {
        if (this.socket) {
            // Request backend to disconnect from MQTT
            this.socket.emit('mqtt:disconnect');
            this.socket.disconnect();
            this.socket = null;
        }
        this.isConnected = false;
        this.isConnecting = false;
        this.socketConnected = false;
        console.log('🔌 Disconnected from backend');
    }

    // For backwards compatibility - loadConfiguration not needed anymore
    async loadConfiguration() {
        // No-op: Backend handles MQTT credentials now
        return true;
    }
}

export const mqttService = new MQTTService();
export default mqttService;