'use client'

import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import ScoreDisplay from '../components/ScoreDisplay'
import UpdateLog from '../components/UpdateLog'
import UndoRedoPanel from '../components/UndoRedoPanel'

export default function Home() {
  // State for current score display
  const [currentScore, setCurrentScore] = useState({
    runs: 0,
    wickets: 0,
    overs: '0.0'
  })

  // State for form inputs
  const [formData, setFormData] = useState({
    over: '',
    ball: '',
    runs: '',
    wicket: false,
    matchId: 'default'
  })

  // State for form validation errors
  const [formErrors, setFormErrors] = useState({})

  // State for form submission status
  const [isSubmitting, setIsSubmitting] = useState(false)

  // State for simulation status
  const [simulationStatus, setSimulationStatus] = useState({
    isRunning: false,
    progress: '',
    error: null
  })

  // State for update log (last 20 entries)
  const [updateLog, setUpdateLog] = useState([])

  // State for connection status
  const [connectionStatus, setConnectionStatus] = useState('disconnected')

  // Socket.io client reference
  const socketRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)

  // Function to refresh score (used by UndoRedoPanel)
  const refreshScore = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/score?matchId=${formData.matchId}`)
      const data = await response.json()
      
      if (data.success) {
        setCurrentScore({
          runs: data.data.runs || 0,
          wickets: data.data.wickets || 0,
          overs: data.data.overs || '0.0'
        })
      }
    } catch (error) {
      console.error('Error refreshing score:', error)
    }
  }

  // Make refreshScore available globally for UndoRedoPanel
  useEffect(() => {
    window.refreshScore = refreshScore
    return () => {
      delete window.refreshScore
    }
  }, [formData.matchId])

  // Socket.io connection setup
  useEffect(() => {
    const connectSocket = () => {
      // Clear any existing connection
      if (socketRef.current) {
        socketRef.current.disconnect()
      }

      setConnectionStatus('connecting')

      // Create new socket connection to backend on port 5000
      socketRef.current = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000', {
        transports: ['websocket', 'polling'],
        timeout: 5000,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        maxReconnectionAttempts: 5
      })

      // Handle connection events
      socketRef.current.on('connect', () => {
        console.log('Connected to server')
        setConnectionStatus('connected')
        
        // Join the match room
        socketRef.current.emit('join-match', formData.matchId)
        
        // Clear any reconnection timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
          reconnectTimeoutRef.current = null
        }
      })

      socketRef.current.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason)
        setConnectionStatus('disconnected')
        
        // Attempt to reconnect after a delay if not a manual disconnect
        if (reason !== 'io client disconnect') {
          reconnectTimeoutRef.current = setTimeout(() => {
            setConnectionStatus('connecting')
          }, 2000)
        }
      })

      socketRef.current.on('connect_error', (error) => {
        console.error('Connection error:', error)
        setConnectionStatus('disconnected')
      })

      // Handle score updates from server
      socketRef.current.on('score-update', (data) => {
        console.log('Score update received:', data)
        
        // Update current score
        if (data.score) {
          setCurrentScore({
            runs: data.score.runs || 0,
            wickets: data.score.wickets || 0,
            overs: data.score.overs || '0.0'
          })
        }

        // Add to update log if there's event data
        if (data.lastEvent) {
          const newLogEntry = {
            over: data.lastEvent.over,
            ball: data.lastEvent.ball,
            runs: data.lastEvent.runs,
            wicket: data.lastEvent.wicket,
            isCorrection: data.lastEvent.isCorrection || false,
            previousData: data.lastEvent.previousData || null,
            timestamp: data.timestamp || new Date().toISOString()
          }

          setUpdateLog(prevLog => {
            const updatedLog = [newLogEntry, ...prevLog]
            // Keep only the last 20 entries
            return updatedLog.slice(0, 20)
          })
        }
      })

      // Handle room join confirmation
      socketRef.current.on('match-joined', (data) => {
        console.log('Joined match room:', data.matchId, 'with', data.clientCount, 'clients')
      })
    }

    // Initial connection
    connectSocket()

    // Cleanup on component unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, []) // Empty dependency array for initial setup

  // Handle match ID changes - rejoin room when match ID changes
  useEffect(() => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('join-match', formData.matchId)
    }
  }, [formData.matchId])

  // Validate individual form field
  const validateField = (name, value) => {
    const errors = {}
    
    switch (name) {
      case 'over':
        if (!value || value === '') {
          errors.over = 'Over is required'
        } else if (parseInt(value) < 1) {
          errors.over = 'Over must be a positive number'
        }
        break
      case 'ball':
        if (!value || value === '') {
          errors.ball = 'Ball is required'
        } else if (parseInt(value) < 1 || parseInt(value) > 6) {
          errors.ball = 'Ball must be between 1 and 6'
        }
        break
      case 'runs':
        if (value === '') {
          errors.runs = 'Runs is required'
        } else if (parseInt(value) < 0 || parseInt(value) > 6) {
          errors.runs = 'Runs must be between 0 and 6'
        }
        break
      case 'matchId':
        if (!value || value.trim() === '') {
          errors.matchId = 'Match ID is required'
        }
        break
    }
    
    return errors
  }

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    const newValue = type === 'checkbox' ? checked : value
    
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }))

    // Clear existing error for this field and validate
    if (type !== 'checkbox') {
      const fieldErrors = validateField(name, newValue)
      setFormErrors(prev => ({
        ...prev,
        [name]: fieldErrors[name] || null
      }))
    }
  }

  // Validate entire form
  const validateForm = () => {
    const errors = {}
    
    // Validate all fields
    Object.keys(formData).forEach(field => {
      if (field !== 'wicket') { // Skip checkbox validation
        const fieldErrors = validateField(field, formData[field])
        if (fieldErrors[field]) {
          errors[field] = fieldErrors[field]
        }
      }
    })
    
    return errors
  }

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (connectionStatus !== 'connected') {
      alert('Not connected to server. Please wait for connection.')
      return
    }

    // Validate form before submission
    const errors = validateForm()
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setIsSubmitting(true)
    setFormErrors({})

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          over: parseInt(formData.over),
          ball: parseInt(formData.ball),
          runs: parseInt(formData.runs),
          wicket: formData.wicket,
          matchId: formData.matchId || 'default'
        })
      })

      const result = await response.json()

      if (result.success) {
        // Reset form after successful submission
        setFormData(prev => ({
          ...prev,
          over: '',
          ball: '',
          runs: '',
          wicket: false
        }))
        setFormErrors({})
        console.log('Score submitted successfully:', result)
      } else {
        alert(`Error: ${result.error?.message || 'Failed to submit score'}`)
      }
    } catch (error) {
      console.error('Error submitting score:', error)
      alert('Failed to submit score. Please check your connection.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle simulation trigger
  const handleSimulation = async () => {
    if (connectionStatus !== 'connected') {
      setSimulationStatus({
        isRunning: false,
        progress: '',
        error: 'Not connected to server. Please wait for connection.'
      })
      return
    }

    // Reset simulation status
    setSimulationStatus({
      isRunning: true,
      progress: 'Starting simulation...',
      error: null
    })

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/simulate`, {
        method: 'GET'
      })

      const result = await response.json()

      if (result.success) {
        console.log('Simulation started successfully:', result)
        setSimulationStatus({
          isRunning: true,
          progress: 'Simulation running... Watch the scores update in real-time.',
          error: null
        })
        
        // Simulate completion after expected duration (simulation runs for about 20-30 seconds)
        setTimeout(() => {
          setSimulationStatus({
            isRunning: false,
            progress: 'Simulation completed successfully!',
            error: null
          })
          
          // Clear status after a few seconds
          setTimeout(() => {
            setSimulationStatus({
              isRunning: false,
              progress: '',
              error: null
            })
          }, 5000)
        }, 30000) // 30 seconds estimated duration
        
      } else {
        setSimulationStatus({
          isRunning: false,
          progress: '',
          error: result.error?.message || 'Failed to start simulation'
        })
      }
    } catch (error) {
      console.error('Error starting simulation:', error)
      setSimulationStatus({
        isRunning: false,
        progress: '',
        error: 'Failed to start simulation. Please check your connection.'
      })
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-700 to-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-white text-center mb-8">
          Live Cricket Score Tracker
        </h1>
        
        {/* Connection Status Indicator */}
        <div className="text-center mb-4">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            connectionStatus === 'connected' 
              ? 'bg-green-100 text-green-800' 
              : connectionStatus === 'connecting'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-red-100 text-red-800'
          }`}>
            <span className={`w-2 h-2 rounded-full mr-2 ${
              connectionStatus === 'connected' 
                ? 'bg-green-400' 
                : connectionStatus === 'connecting'
                ? 'bg-yellow-400'
                : 'bg-red-400'
            }`}></span>
            {connectionStatus === 'connected' ? 'Connected' : 
             connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
          </span>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Score Display Section */}
          <ScoreDisplay 
            currentScore={currentScore} 
            connectionStatus={connectionStatus} 
          />

          {/* Score Entry Form Section */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold mb-4 text-cricket-dark">Enter Score</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Over *
                  </label>
                  <input
                    type="number"
                    name="over"
                    min="1"
                    value={formData.over}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-gray-900 bg-white ${
                      formErrors.over 
                        ? 'border-red-300 focus:ring-red-500' 
                        : 'border-gray-300 focus:ring-cricket-green'
                    }`}
                    placeholder="1"
                    required
                  />
                  {formErrors.over && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.over}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ball *
                  </label>
                  <input
                    type="number"
                    name="ball"
                    min="1"
                    max="6"
                    value={formData.ball}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-gray-900 bg-white ${
                      formErrors.ball 
                        ? 'border-red-300 focus:ring-red-500' 
                        : 'border-gray-300 focus:ring-cricket-green'
                    }`}
                    placeholder="1"
                    required
                  />
                  {formErrors.ball && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.ball}</p>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Runs *
                  </label>
                  <input
                    type="number"
                    name="runs"
                    min="0"
                    max="6"
                    value={formData.runs}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-gray-900 bg-white ${
                      formErrors.runs 
                        ? 'border-red-300 focus:ring-red-500' 
                        : 'border-gray-300 focus:ring-cricket-green'
                    }`}
                    placeholder="0"
                    required
                  />
                  {formErrors.runs && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.runs}</p>
                  )}
                </div>
                <div className="flex items-end">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      name="wicket"
                      checked={formData.wicket}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-cricket-green border-gray-300 rounded focus:ring-cricket-green"
                    />
                    <span className="text-sm font-medium text-gray-700">Wicket</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Match ID *
                </label>
                <input
                  type="text"
                  name="matchId"
                  value={formData.matchId}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-gray-900 bg-white ${
                    formErrors.matchId 
                      ? 'border-red-300 focus:ring-red-500' 
                      : 'border-gray-300 focus:ring-cricket-green'
                  }`}
                  placeholder="default"
                  required
                />
                {formErrors.matchId && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.matchId}</p>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-cricket-green text-white py-2 px-4 rounded-md hover:bg-cricket-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                disabled={connectionStatus !== 'connected' || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Submitting...
                  </>
                ) : (
                  'Submit Score'
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Undo/Redo Panel */}
        <div className="mt-8">
          <UndoRedoPanel matchId={formData.matchId} />
        </div>

        {/* Update Log Section */}
        <div className="mt-8">
          <UpdateLog updateLog={updateLog} />
        </div>

        {/* Simulation Controls */}
        <div className="mt-8">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold mb-4 text-cricket-dark">Simulation Controls</h2>
            
            <div className="text-center">
              <button 
                onClick={handleSimulation}
                className="bg-blue-600 text-white py-3 px-8 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mx-auto"
                disabled={connectionStatus !== 'connected' || simulationStatus.isRunning}
              >
                {simulationStatus.isRunning ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Running Simulation...
                  </>
                ) : (
                  'Start Simulation'
                )}
              </button>
              
              {/* Simulation Status Display */}
              {(simulationStatus.progress || simulationStatus.error) && (
                <div className="mt-4">
                  {simulationStatus.progress && (
                    <div className="flex items-center justify-center text-blue-600 mb-2">
                      {simulationStatus.isRunning && (
                        <svg className="animate-pulse w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <circle cx="10" cy="10" r="3"/>
                        </svg>
                      )}
                      <span className="text-sm font-medium">{simulationStatus.progress}</span>
                    </div>
                  )}
                  
                  {simulationStatus.error && (
                    <div className="flex items-center justify-center text-red-600">
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                      </svg>
                      <span className="text-sm font-medium">{simulationStatus.error}</span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Simulation Description */}
              <div className="mt-4 text-sm text-gray-600 max-w-2xl mx-auto">
                <p className="mb-2">
                  <strong>Simulation Details:</strong> This will generate a predefined cricket score sequence from over 4.1 to 5.1.
                </p>
                <p className="mb-2">
                  The simulation includes a deliberate error on ball 4.2 (6 runs instead of 0) which will be corrected after ball 4.5 to demonstrate the correction handling system.
                </p>
                <p>
                  Each event is sent with 2-3 second delays to mimic real-time score entry. Watch the scores and update log for real-time changes!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}