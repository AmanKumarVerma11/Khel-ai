'use client'

import { useState, useEffect } from 'react'

export default function ScoreDisplay({ currentScore, connectionStatus }) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Handle loading state based on connection status
  useEffect(() => {
    if (connectionStatus === 'connected') {
      setIsLoading(false)
      setError(null)
    } else if (connectionStatus === 'disconnected') {
      setError('Connection lost. Attempting to reconnect...')
      setIsLoading(false)
    } else if (connectionStatus === 'connecting') {
      setIsLoading(true)
      setError(null)
    }
  }, [connectionStatus])

  // Format the score display according to requirements: "Team: X/Y in Z.B overs"
  const formatScore = () => {
    if (!currentScore) {
      return 'Team: 0/0 in 0.0 overs'
    }
    
    const { runs = 0, wickets = 0, overs = '0.0' } = currentScore
    return `Team: ${runs}/${wickets} in ${overs} overs`
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-semibold mb-4 text-cricket-dark">Current Score</h2>
      
      <div className="text-center">
        {/* Main score display */}
        <div className="text-4xl font-bold text-cricket-green mb-2">
          {formatScore()}
        </div>
        
        {/* Status indicators */}
        <div className="text-sm text-gray-600 mb-4">
          {isLoading && (
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-cricket-green"></div>
              <span>Loading score data....</span>
            </div>
          )}
          
          {error && (
            <div className="text-red-600 bg-red-50 px-3 py-2 rounded-md">
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            </div>
          )}
          
          {!isLoading && !error && connectionStatus === 'connected' && (
            <div className="text-green-600 bg-green-50 px-3 py-2 rounded-md">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span>Live updates active</span>
              </div>
            </div>
          )}
        </div>
        
        {/* Additional score breakdown */}
        {currentScore && !isLoading && (
          <div className="grid grid-cols-3 gap-4 text-center border-t pt-4">
            <div>
              <div className="text-2xl font-bold text-cricket-dark">{currentScore.runs || 0}</div>
              <div className="text-sm text-gray-600">Runs</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-cricket-dark">{currentScore.wickets || 0}</div>
              <div className="text-sm text-gray-600">Wickets</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-cricket-dark">{currentScore.overs || '0.0'}</div>
              <div className="text-sm text-gray-600">Overs</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}