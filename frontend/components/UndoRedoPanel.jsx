'use client';

import { useState, useEffect } from 'react';

/**
 * UndoRedoPanel Component
 * Provides UI for undoing/redoing score ranges
 */
export default function UndoRedoPanel({ matchId = 'default' }) {
  const [fromKey, setFromKey] = useState('');
  const [toKey, setToKey] = useState('');
  const [rangePreview, setRangePreview] = useState(null);
  const [undoHistory, setUndoHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success', 'error', 'info'

  // Fetch undo history on component mount
  useEffect(() => {
    fetchUndoHistory();
  }, [matchId]);

  /**
   * Fetch undo/redo history
   */
  const fetchUndoHistory = async () => {
    try {
      const response = await fetch(`/api/undo-history?matchId=${matchId}`);
      const data = await response.json();
      
      if (data.success) {
        setUndoHistory(data.data.history);
      } else {
        showMessage('Failed to fetch undo history', 'error');
      }
    } catch (error) {
      console.error('Error fetching undo history:', error);
      showMessage('Error fetching undo history', 'error');
    }
  };

  /**
   * Preview events in the specified range
   */
  const previewRange = async () => {
    if (!fromKey || !toKey) {
      showMessage('Please enter both from and to keys', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/range-preview?matchId=${matchId}&fromKey=${fromKey}&toKey=${toKey}`);
      const data = await response.json();
      
      if (data.success) {
        setRangePreview(data.data);
        showMessage(`Found ${data.data.eventCount} events in range`, 'info');
      } else {
        setRangePreview(null);
        showMessage(data.error.message || 'Failed to preview range', 'error');
      }
    } catch (error) {
      console.error('Error previewing range:', error);
      showMessage('Error previewing range', 'error');
      setRangePreview(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Undo the specified range
   */
  const undoRange = async () => {
    if (!rangePreview) {
      showMessage('Please preview the range first', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/undo-range', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          matchId,
          fromKey,
          toKey,
          undoneBy: 'user',
          reason: `Undo range ${fromKey} to ${toKey}`
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        showMessage(`Successfully undone ${data.data.eventsUndone} events`, 'success');
        setRangePreview(null);
        setFromKey('');
        setToKey('');
        fetchUndoHistory();
        
        // Trigger score refresh (if parent component provides callback)
        if (window.refreshScore) {
          window.refreshScore();
        }
      } else {
        showMessage(data.error.message || 'Failed to undo range', 'error');
      }
    } catch (error) {
      console.error('Error undoing range:', error);
      showMessage('Error undoing range', 'error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Redo an operation
   */
  const redoOperation = async (operationId) => {
    setLoading(true);
    try {
      const response = await fetch('/api/redo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operationId,
          redoneBy: 'user'
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        showMessage(`Successfully redone ${data.data.eventsRestored} events`, 'success');
        fetchUndoHistory();
        
        // Trigger score refresh
        if (window.refreshScore) {
          window.refreshScore();
        }
      } else {
        showMessage(data.error.message || 'Failed to redo operation', 'error');
      }
    } catch (error) {
      console.error('Error redoing operation:', error);
      showMessage('Error redoing operation', 'error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Show message to user
   */
  const showMessage = (msg, type) => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 5000);
  };

  /**
   * Format timestamp for display
   */
  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Undo/Redo Score Range</h2>
      
      {/* Message Display */}
      {message && (
        <div className={`mb-4 p-3 rounded ${
          messageType === 'success' ? 'bg-green-100 text-green-700 border border-green-300' :
          messageType === 'error' ? 'bg-red-100 text-red-700 border border-red-300' :
          'bg-blue-100 text-blue-700 border border-blue-300'
        }`}>
          {message}
        </div>
      )}

      {/* Range Input Section */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3 text-gray-700">Undo Range</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">From (Over.Ball)</label>
            <input
              type="text"
              value={fromKey}
              onChange={(e) => setFromKey(e.target.value)}
              placeholder="e.g., 1.2"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">To (Over.Ball)</label>
            <input
              type="text"
              value={toKey}
              onChange={(e) => setToKey(e.target.value)}
              placeholder="e.g., 1.5"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={previewRange}
              disabled={loading || !fromKey || !toKey}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : 'Preview'}
            </button>
          </div>
          <div className="flex items-end">
            <button
              onClick={undoRange}
              disabled={loading || !rangePreview}
              className="w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Undo Range'}
            </button>
          </div>
        </div>
      </div>

      {/* Range Preview */}
      {rangePreview && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <h4 className="font-semibold text-yellow-800 mb-2">
            Range Preview: {rangePreview.range.from} to {rangePreview.range.to}
          </h4>
          <div className="text-sm text-yellow-700 mb-3">
            <strong>Impact:</strong> -{rangePreview.impact.runsToRemove} runs, -{rangePreview.impact.wicketsToRemove} wickets
          </div>
          <div className="max-h-32 overflow-y-auto">
            <div className="text-xs text-yellow-600">Events to be undone:</div>
            {rangePreview.events.map((event, index) => (
              <div key={index} className="text-xs text-yellow-700">
                {event.key}: {event.runs} runs{event.wicket ? ' + wicket' : ''}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Undo History */}
      <div>
        <h3 className="text-lg font-semibold mb-3 text-gray-700">Undo/Redo History</h3>
        {undoHistory.length === 0 ? (
          <p className="text-gray-500 text-sm">No undo operations yet</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {undoHistory.map((operation, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-800">
                    Range: {operation.range.from} - {operation.range.to}
                  </div>
                  <div className="text-xs text-gray-600">
                    {operation.eventsCount} events • {formatTimestamp(operation.timestamp)}
                    {operation.reason && ` • ${operation.reason}`}
                  </div>
                  {operation.redoneAt && (
                    <div className="text-xs text-green-600">
                      Redone at {formatTimestamp(operation.redoneAt)}
                    </div>
                  )}
                </div>
                <div className="ml-4">
                  {operation.canRedo ? (
                    <button
                      onClick={() => redoOperation(operation.operationId)}
                      disabled={loading}
                      className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300"
                    >
                      Redo
                    </button>
                  ) : (
                    <span className="px-3 py-1 text-xs bg-gray-200 text-gray-500 rounded">
                      Already Redone
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}