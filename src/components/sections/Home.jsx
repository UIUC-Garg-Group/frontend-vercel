import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, FileText, RefreshCw } from 'lucide-react';
import TestRunCard from '../ui/TestRunCard';
import TestDetailsModal from '../ui/TestDetailsModal';
import ConfirmationModal from '../ui/ConfirmationModal';
import mqttService from '../../mqtt/mqttservice';
import ProcessModalNew from '../ui/ProcessModalNew';
import { useUser } from '../../context/UserContext';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

export default function HomePage({ addLog, mqttConnected: mqttConnectedProp }) {
  const { userId, teamId, loading: userLoading, syncUser } = useUser();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRun, setSelectedRun] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [currentProcessStage, setCurrentProcessStage] = useState(0);  
  const [mqttConnected, setMqttConnected] = useState(mqttConnectedProp || false); // Use prop or default
  const [activeTests, setActiveTests] = useState(new Map()); // Track active tests and their current stages
  const hasFetchedRuns = useRef(false); // Track if runs have been fetched
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [confirmationData, setConfirmationData] = useState(null);
  const [activeTestId, setActiveTestId] = useState(null);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [waitingCameraPreview, setWaitingCameraPreview] = useState(false); // Track camera preview state
  const [waitingCleaning, setWaitingCleaning] = useState(false); // Track dilution container cleaning state
  const [testResults, setTestResults] = useState({ aluminum: [], silicon: [], dissolution: [] }); // Store real-time results

  // Refs to avoid stale closures in the MQTT callback
  const activeTestIdRef = useRef(activeTestId);
  const showProcessModalRef = useRef(showProcessModal);
  const testResultsRef = useRef(testResults);
  activeTestIdRef.current = activeTestId;
  showProcessModalRef.current = showProcessModal;
  testResultsRef.current = testResults;

  const [processStages] = useState([
    'NaOH Transfer',
    'Preparation',
    'Transfer',
    'Aluminum',
    'Silicon',
  ]);
  const totalCycles = 1;


  // Function to update run status in database
  const updateRunStatus = useCallback(async (testId, run_status, run_stage) => {
    try {
      const response = await fetch(`${API_BASE_URL}/runs/${testId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trial_id: testId, run_status: run_status, run_stage: parseInt(run_stage)}),
      });


      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      addLog && addLog(`Successfully updated run status for test ${testId} to: ${run_status}`);
      return true;
    } catch (error) {
      console.error('Error updating run status:', error);
      addLog && addLog(`Error updating run status for test ${testId}: ${error.message}`);
      return false;
    }
  }, [addLog]);

  // Function to save test results to database
  const saveResults = useCallback(async (testId, results) => {
    try {
      const response = await fetch(`${API_BASE_URL}/runs/${testId}/results`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results }),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      addLog && addLog(`Results saved for test ${testId}`);
      return true;
    } catch (error) {
      console.error('Error saving results:', error);
      addLog && addLog(`Error saving results for test ${testId}: ${error.message}`);
      return false;
    }
  }, [addLog]);

  ////////////////////////////////////////////////////////////////////////////////
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
  // Detect unmount
  useEffect(() => {
    return () => console.warn('[DEBUG] HomePage UNMOUNTED — all state lost');
  }, []);
////////////////////////////////////////////////////////////////////////////////
  // Separate useEffect for setting up stage update callback
  // Uses refs to avoid stale closures — this callback is registered ONCE
  useEffect(() => {
    // Set up stage update callback
    mqttService.setStageUpdateCallback(async (data) => {

      const testId = data.testId;
      const run_status = data.run_status;
      const run_stage = data.run_stage;
      const cycle = data.cycle;

      console.log(`[DEBUG] Stage callback: status=${run_status}, stage=${run_stage}, testId=${testId}, activeTestIdRef=${activeTestIdRef.current}, showModalRef=${showProcessModalRef.current}`);
      addLog(`Stage update received: Test ${testId}, Status ${run_status}, Stage ${run_stage}${cycle ? `, Cycle ${cycle}` : ''}`);

      // Handle different status types
      if (run_status === 'cycle_start') {
        // Reset progress for stages 3-5 when a new cycle starts
        if (activeTestIdRef.current === testId && showProcessModalRef.current) {
          setCurrentCycle(cycle);
          setCurrentProcessStage(2); // Keep stages 1-2 completed, reset to start of cycle (stage 3)
          addLog(`Starting cycle ${cycle}/${totalCycles} - Resetting progress for stages 3-5`);
        }
      }
      else if (run_status === 'completed') { //when test is fully completed
        setActiveTests(prev => {
          const newMap = new Map(prev);
          newMap.delete(testId);
          return newMap;
        });

        // Update run status in database
        await updateRunStatus(testId, run_status, run_stage);

        // Save results to database
        const currentResults = testResultsRef.current;
        if (currentResults.aluminum.length > 0 || currentResults.silicon.length > 0) {
          await saveResults(testId, currentResults);
        }

        // Update runs status
        setRuns(prevRuns =>
          prevRuns.map(run =>
            run.trial_id === testId
              ? { ...run, run_status: run_status, results: testResultsRef.current }
              : run
          )
        );

        // If this test is currently being viewed, update modal
        if (activeTestIdRef.current === testId && showProcessModalRef.current) {
          setCurrentProcessStage(processStages.length);
          setCurrentCycle(null);
        }
      }
      else if (run_status === 'failed' || run_status === 'error' || run_status === 'stopped') {
        setActiveTests(prev => {
          const newMap = new Map(prev);
          newMap.delete(testId);
          return newMap;
        });
        // Update run status in database
        await updateRunStatus(testId, run_status, run_stage);
        // Update runs status
        setRuns(prevRuns =>
          prevRuns.map(run =>
            run.trial_id === testId
              ? { ...run, run_status: run_status }
              : run
          )
        );
        // If this test is currently being viewed, close the modal and show message
        if (activeTestIdRef.current === testId && showProcessModalRef.current) {
          console.warn(`[DEBUG] Closing modal due to status: ${run_status}, message: ${data.message}`);
          setShowProcessModal(false);
          setActiveTestId(null);
          addLog(`Test ${testId} ${run_status}: ${data.message || 'Process ended'}`);
        }
      }
      else if (run_status === 'running') { // When a stage from current test is completed
        const stageNumber = parseInt(run_stage);

        // Clear camera preview state when moving to running
        setWaitingCameraPreview(false);

        // Handle cycle information if provided
        if (data.cycle) {
          setCurrentCycle(data.cycle);
        }

        setActiveTests(prev => {
          const newMap = new Map(prev);
          newMap.set(testId, {
            currentStage: stageNumber,
            cycle: data.cycle || 1,
            timestamp: new Date().toISOString()
          });
          return newMap;
        });

        console.log(`updating stage to ${run_stage} (cycle ${data.cycle || 1}) for test id =${testId}`)
        await updateRunStatus(testId, run_status, run_stage);

        // Update runs status to running
        setRuns(prevRuns =>
          prevRuns.map(run =>
            run.trial_id === testId
              ? { ...run, run_status: run_status, run_stage: stageNumber, cycle: data.cycle || 1 }
              : run
          )
        );

        // If this test is currently being viewed, update modal
        if (activeTestIdRef.current === testId && showProcessModalRef.current) {
          setCurrentProcessStage(stageNumber);
        }
      }
      else if (run_status === 'image_analysis_started') {
        // Standalone image analysis started — open the ProcessModal
        addLog(`Image analysis started: ${testId}`);
        setActiveTestId(testId);
        setCurrentProcessStage(0);
        setCurrentCycle(1);
        setShowProcessModal(true);
      }
      else if (run_status === 'waiting_camera_preview') {
        // Camera preview is active on RPI, waiting for user confirmation
        addLog(`Camera preview active for test ${testId} - waiting for confirmation`);
        // If modal isn't open yet (e.g. image analysis), open it
        if (!showProcessModalRef.current) {
          setActiveTestId(testId);
          setShowProcessModal(true);
        }
        if (activeTestIdRef.current === testId || !activeTestIdRef.current) {
          setActiveTestId(testId);
          setWaitingCameraPreview(true);
          if (data.cycle) {
            setCurrentCycle(data.cycle);
          }
        }
      }
      else if (run_status === 'waiting_cleaning') {
        // Dilution container cleaning wait started
        setWaitingCleaning(true);
        addLog(`Dilution container cleaning started for test ${testId}`);
      }
      else if (run_status === 'camera_capture') {
        // Camera captured successfully, clear preview state
        setWaitingCameraPreview(false);
        setWaitingCleaning(false);
        addLog(`Camera captured image for test ${testId}`);
      }
      else if (run_status === 'image_analysis_completed') {
        setWaitingCameraPreview(false);
        if (activeTestIdRef.current === testId && showProcessModalRef.current) {
          setCurrentProcessStage(processStages.length);
        }
        addLog(`Image analysis completed: ${testId} - ${data.message || ''}`);
      }
    });

    // Setup confirmation callback
    mqttService.setConfirmationCallback((result) => {
      const { testId, message, cycle } = result;
  setConfirmationData({ testId, message, cycle });
      setShowConfirmationModal(true);
      addLog(`Confirmation required for test ${testId}: ${message}`);
    });
  }, [addLog, updateRunStatus, saveResults, processStages.length]);

  // Handle confirmation response
  const handleConfirmation = (confirmed) => {
    if (confirmationData && confirmationData.testId) {
      mqttService.sendConfirmation(confirmationData.testId, confirmed);
      if (confirmed) {
  addLog && addLog(`Sent confirmation for test ${confirmationData.testId}: Continue to next cycle`);
      } else {
  addLog && addLog(`Sent confirmation for test ${confirmationData.testId}: Stop process - User declined to continue`);
      }
    }
    setShowConfirmationModal(false);
    setConfirmationData(null);
  };

  // Check for newly created test that should show process modal
  // Runs on an interval so it picks up window.activeTestInfo set by CreateTestModal
  useEffect(() => {
    const check = () => {
      if (window.activeTestInfo && window.activeTestInfo.showProcessModal) {
        setActiveTestId(window.activeTestInfo.testId);
        setShowProcessModal(true);
        setCurrentProcessStage(0);
        addLog && addLog(`Showing process modal for newly created test: ${window.activeTestInfo.testId}`);
        window.activeTestInfo = null;
      }
    };
    check(); // run immediately on mount
    const interval = setInterval(check, 200);
    return () => clearInterval(interval);
  }, [addLog]);


  const fetchRuns = useCallback(async () => {
    setError(null);
    
    try {
      // Build query params based on user's team status
      let url = `${API_BASE_URL}/runs`;
      const params = new URLSearchParams();
      
      if (teamId) {
        // User is in a team - fetch team's runs
        params.append('team_id', teamId);
      } else if (userId) {
        // User has no team - fetch only their own runs
        params.append('user_id', userId);
      }
      // If no user context, fetch all (backwards compatibility)
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setRuns(data);
      
    } catch (error) {
      console.error('Error fetching runs:', error);
      setError(error.message);
      // Use a ref or move addLog call outside the callback to avoid dependency
      if (addLog) {
        addLog(`Error fetching test runs: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, userId]); // Re-fetch when team changes

  useEffect(() => {
    // Sync user profile on mount
    if (!userLoading) {
      syncUser();
    }
  }, [userLoading, syncUser]);

  useEffect(() => {
    // Fetch runs when user/team data is available
    if (!userLoading) {
      fetchRuns();
      hasFetchedRuns.current = true;
    }
  }, [fetchRuns, userLoading]);

  const handleView = (run) => {
    addLog && addLog(`Viewing run: ${run.trial_name} (${run.trial_id})`);
    console.log('Selected run:', run);
    setSelectedRun(run);
    setShowDetailsModal(true);
  };

  // Updated handleRerun to send MQTT command
  const handleRerun = async (run) => {
    addLog && addLog(`Rerunning test: ${run.trial_name} (${run.trial_id})`);

    // // Immediately update UI state to show "started" status
    // setRuns(prevRuns => 
    //   prevRuns.map(prevRun => 
    //     prevRun.trial_id === run.trial_id 
    //       ? { ...prevRun, run_status: 'started' }
    //       : prevRun
    //   )
    // );s

    // // Update run status to 'started' in database (stage 0 = starting)
    // await updateRunStatus(run.trial_id, 'started', 0);
   
    if (mqttConnected) {
      const success = mqttService.sendStartCommand(run.trial_id);  // Send start command to RPI via MQTT
      if (success) {
        addLog && addLog(`Sent start command to RPI for test: ${run.trial_id}`);
      } else {
        addLog && addLog(`Failed to send start command`);
        
      }
    } else {
      addLog && addLog(`Cannot start test - MQTT not connected`);
      
    }
  };


  const handleStatus = (run) => {
    addLog && addLog(`Viewing status for: ${run.trial_name} (${run.trial_id})`);
    setSelectedRun(run);
    
    // Check if we have real-time data for this test
    const activeTestData = activeTests.get(run.trial_id);
    
    if (activeTestData) {
      // Use real-time stage data
      setCurrentProcessStage(activeTestData.currentStage);
    } else {
      // Simulate process stage based on run status
      switch (run.run_status?.toLowerCase()) {
        case 'completed':
          setCurrentProcessStage(processStages.length); // All stages completed
          break;
        case 'running':
          setCurrentProcessStage(2); // Currently processing sample
          break;
        case 'failed':
          setCurrentProcessStage(1); // Failed during sample preparation
          break;
        default:
          setCurrentProcessStage(0); // First stage is active
      }
    }
    
    setShowProcessModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailsModal(false);
    setSelectedRun(null);
  };

  const handleCloseProcessModal = () => {
    console.trace('[DEBUG] handleCloseProcessModal called');
    setShowProcessModal(false);
    setSelectedRun(null);
    setActiveTestId(null);
    setCurrentProcessStage(0);
  };

  const handleRefresh = () => {
    addLog && addLog('Refreshing test runs...');
    fetchRuns();
  };

  const handleDelete = async (run) => {
    if (!window.confirm(`Are you sure you want to delete "${run.trial_name}"? This cannot be undone.`)) {
      return;
    }

    addLog && addLog(`Deleting test: ${run.trial_name} (${run.trial_id})`);

    try {
      const response = await fetch(`${API_BASE_URL}/runs/${run.trial_id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      addLog && addLog(`Successfully deleted test: ${run.trial_name}`);
      
      // Remove from local state
      setRuns(prevRuns => prevRuns.filter(r => r.trial_id !== run.trial_id));
      
      // Remove from active tests if it was active
      setActiveTests(prev => {
        const newMap = new Map(prev);
        newMap.delete(run.trial_id);
        return newMap;
      });

    } catch (error) {
      console.error('Error deleting run:', error);
      addLog && addLog(`Error deleting test: ${error.message}`);
      alert(`Failed to delete test: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading test runs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-400 mb-4">
          <FileText className="w-16 h-16 mx-auto" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Test Runs</h3>
        <p className="text-gray-500 mb-4">{error}</p>
        <button
          onClick={handleRefresh}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors duration-200 flex items-center mx-auto"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* <div className="mb-6">
        <h1 className="text-gray-600 mb-2">View and manage your previous test runs</h1>
      </div> */}
      {activeTests.size > 0 && (
        <div className="mb-4 p-3 rounded-lg flex items-center bg-gray-50">
          <span className="text-sm text-blue-600">
            {activeTests.size} active test{activeTests.size > 1 ? 's' : ''}
          </span>
        </div>
      )}

      {runs.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Play className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No test runs yet</h3>
          <p className="text-gray-500">Create your first test run to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {runs.map((run) => (
            <TestRunCard
              key={run.trial_id}
              run={run}
              onView={handleView}
              onRerun={handleRerun}
              onStatus={handleStatus}
              onDelete={handleDelete}
              isActive={activeTests.has(run.trial_id)}
              currentStage={activeTests.get(run.trial_id)?.currentStage}
            />
          ))}
        </div>
      )}


      {/* Test Details Modal */}
      <TestDetailsModal
        isOpen={showDetailsModal}
        onClose={handleCloseModal}
        run={selectedRun ? { ...selectedRun, results: selectedRun.results || testResults } : null}
      />

      {/* Process Status Modal */}
      {/* <ProcessModal
        isOpen={showProcessModal}
        onClose={handleCloseProcessModal}
        currentStage={currentProcessStage}
        currentCycle={currentCycle}
        stages={processStages}
        title={selectedRun ? `Test Status - ${selectedRun.trial_name}` : activeTestId ? `Test Status - ${activeTestId}` : "Test Status"}
        isInterrupted={
          // Consider interrupted if selectedRun status is failed, error, or stopped
          selectedRun && ["failed", "error", "stopped"].includes((selectedRun.run_status || '').toLowerCase())
        }
      /> */}

      <ProcessModalNew
        isOpen={showProcessModal}
        onClose={handleCloseProcessModal}
        currentStage={currentProcessStage}
        currentCycle={currentCycle}
        stages={processStages}
        title={selectedRun ? `Test Status - ${selectedRun.trial_name}` : activeTestId ? `Test Status - ${activeTestId}` : "Test Status"}
        isInterrupted={
          // Consider interrupted if selectedRun status is failed, error, or stopped
          selectedRun && ["failed", "error", "stopped"].includes((selectedRun.run_status || '').toLowerCase())
        }
        waitingCameraPreview={waitingCameraPreview}
        waitingCleaning={waitingCleaning}
        activeTestId={activeTestId}
        onResultsUpdate={(results) => setTestResults(results)}
        onEmergencyStop={() => {
          if (activeTestId && mqttService?.client?.connected) {
            // Send stop command to RPI via MQTT
            mqttService.client.publish('ur2/test/init', JSON.stringify({
              command: 'stop',
              testId: activeTestId,
              timestamp: new Date().toISOString()
            }));
            addLog && addLog(`🛑 EMERGENCY STOP sent for test ${activeTestId}`);
            // Update local state
            setActiveTests(prev => {
              const next = new Map(prev);
              next.delete(activeTestId);
              return next;
            });
            updateRunStatus(activeTestId, 'stopped', currentProcessStage);
            handleCloseProcessModal();
          }
        }}
      />

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmationModal}
        onConfirm={() => handleConfirmation(true)}
        onCancel={() => handleConfirmation(false)}
        testId={confirmationData?.testId}
        message={confirmationData?.message}
        cycle={confirmationData?.cycle}
      />
    </div>
  );
}
