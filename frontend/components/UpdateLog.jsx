'use client'

import { useMemo } from 'react'

export default function UpdateLog({ updateLog }) {
  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    try {
      const date = new Date(timestamp)
      return date.toLocaleTimeString('en-US', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    } catch (error) {
      return 'Invalid time'
    }
  }

  // Format the event description
  const formatEventDescription = (update) => {
    const { over, ball, runs, wicket, isCorrection, previousData } = update
    let description = `${over}.${ball}: ${runs} run${runs !== 1 ? 's' : ''}`
    
    if (wicket) {
      description += ' + Wicket'
    }
    
    // For corrections, show the change from previous to new values
    if (isCorrection && previousData) {
      const prevRuns = previousData.runs || 0
      const prevWicket = previousData.wicket || false
      
      description = `${over}.${ball}: ${prevRuns} → ${runs} run${runs !== 1 ? 's' : ''}`
      
      if (prevWicket !== wicket) {
        if (wicket && !prevWicket) {
          description += ' + Wicket added'
        } else if (!wicket && prevWicket) {
          description += ' - Wicket removed'
        }
      } else if (wicket) {
        description += ' + Wicket'
      }
    }
    
    return description
  }

  // Memoize the sorted and limited log entries (last 20)
  const displayLog = useMemo(() => {
    if (!updateLog || !Array.isArray(updateLog)) {
      return []
    }
    
    // Ensure we only show the last 20 entries, already sorted by most recent first
    return updateLog.slice(0, 20)
  }, [updateLog])

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-semibold mb-4 text-cricket-dark">Recent Updates</h2>
      
      {displayLog.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <div className="mb-2">
            <svg className="w-12 h-12 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p>No updates yet.</p>
          <p className="text-sm">Start entering scores to see the log.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {displayLog.map((update, index) => (
            <div 
              key={`${update.timestamp}-${index}`}
              className={`p-3 rounded-md border-l-4 transition-all duration-200 ${
                update.isCorrection 
                  ? 'bg-yellow-50 border-yellow-400 shadow-sm' 
                  : 'bg-green-50 border-green-400'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  {/* Event description */}
                  <div className="font-medium text-gray-900">
                    {formatEventDescription(update)}
                  </div>
                  
                  {/* Correction indicator with enhanced styling and details */}
                  {update.isCorrection && (
                    <div className="mt-1">
                      <span className="inline-flex items-center text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full font-medium">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        CORRECTION
                      </span>
                      {/* Show previous values for corrections */}
                      {update.previousData && (
                        <div className="mt-1 text-xs text-yellow-700 bg-yellow-100 px-2 py-1 rounded">
                          Previous: {update.previousData.runs || 0} run{(update.previousData.runs || 0) !== 1 ? 's' : ''}
                          {update.previousData.wicket && ' + Wicket'}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Additional event details */}
                  <div className="mt-1 text-xs text-gray-600">
                    Over {update.over}, Ball {update.ball}
                    {update.wicket && (
                      <span className="ml-2 inline-flex items-center text-red-600">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        Wicket
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Timestamp */}
                <div className="text-xs text-gray-500 ml-4 flex-shrink-0">
                  <div className="text-right">
                    {formatTimestamp(update.timestamp)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Footer with entry count */}
      {displayLog.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="text-xs text-gray-500 text-center">
            Showing {displayLog.length} of last 20 updates
            {updateLog && updateLog.length > 20 && (
              <span className="ml-1">({updateLog.length - 20} older entries hidden)</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}