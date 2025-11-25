const EventProcessor = require('./services/eventProcessor');
const UndoRedoManager = require('./services/undoRedoManager');
const ScoreComputer = require('./services/scoreComputer');

/**
 * Test script for undo/redo functionality
 * Demonstrates undoing a range of events and redoing them
 */
async function testUndoRedo() {
  console.log('=== Testing Undo/Redo Functionality ===\n');

  try {
    const matchId = 'test-undo-redo';

    // Step 1: Create some test events
    console.log('1. Creating test events...');
    const testEvents = [
      { over: 1, ball: 1, runs: 1, wicket: false },
      { over: 1, ball: 2, runs: 4, wicket: false },
      { over: 1, ball: 3, runs: 0, wicket: true },
      { over: 1, ball: 4, runs: 2, wicket: false },
      { over: 1, ball: 5, runs: 6, wicket: false },
      { over: 1, ball: 6, runs: 1, wicket: false },
      { over: 2, ball: 1, runs: 0, wicket: false },
      { over: 2, ball: 2, runs: 3, wicket: false }
    ];

    for (const eventData of testEvents) {
      const result = await EventProcessor.processEvent({
        ...eventData,
        matchId,
        enteredBy: 'test-user'
      });
      
      if (result.success) {
        console.log(`   ✓ Event ${result.data.event.key}: ${result.data.event.runs} runs${result.data.event.wicket ? ' + wicket' : ''}`);
      } else {
        console.log(`   ✗ Failed to create event: ${result.error.message}`);
      }
    }

    // Step 2: Get initial score
    console.log('\n2. Initial score:');
    const initialScore = await ScoreComputer.computeScore(matchId);
    console.log(`   Runs: ${initialScore.runs}, Wickets: ${initialScore.wickets}, Overs: ${initialScore.overs}`);

    // Step 3: Preview range to undo (over 1.2 to 1.5)
    console.log('\n3. Previewing range 1.2 to 1.5:');
    const rangeEvents = await UndoRedoManager.getEventsInRange(matchId, '1.2', '1.5');
    console.log(`   Events in range: ${rangeEvents.length}`);
    rangeEvents.forEach(event => {
      console.log(`   - ${event.key}: ${event.runs} runs${event.wicket ? ' + wicket' : ''}`);
    });

    const runsToRemove = rangeEvents.reduce((sum, event) => sum + event.runs, 0);
    const wicketsToRemove = rangeEvents.filter(event => event.wicket).length;
    console.log(`   Impact: -${runsToRemove} runs, -${wicketsToRemove} wickets`);

    // Step 4: Undo the range
    console.log('\n4. Undoing range 1.2 to 1.5...');
    const undoResult = await UndoRedoManager.undoRange(
      matchId, 
      '1.2', 
      '1.5', 
      'test-user', 
      'Testing undo functionality'
    );

    if (undoResult.success) {
      console.log(`   ✓ Undo successful! Operation ID: ${undoResult.data.operationId}`);
      console.log(`   Events undone: ${undoResult.data.eventsUndone}`);
      console.log(`   New score: ${undoResult.data.newScore.runs} runs, ${undoResult.data.newScore.wickets} wickets, ${undoResult.data.newScore.overs} overs`);
    } else {
      console.log(`   ✗ Undo failed: ${undoResult.error.message}`);
      return;
    }

    // Step 5: Verify score after undo
    console.log('\n5. Score after undo:');
    const scoreAfterUndo = await ScoreComputer.computeScore(matchId);
    console.log(`   Runs: ${scoreAfterUndo.runs}, Wickets: ${scoreAfterUndo.wickets}, Overs: ${scoreAfterUndo.overs}`);

    // Step 6: Get active events
    console.log('\n6. Active events after undo:');
    const activeEvents = await UndoRedoManager.getActiveEvents(matchId);
    console.log(`   Active events: ${activeEvents.length}`);
    activeEvents.forEach(event => {
      console.log(`   - ${event.key}: ${event.runs} runs${event.wicket ? ' + wicket' : ''}`);
    });

    // Step 7: Get undo history
    console.log('\n7. Undo/Redo history:');
    const history = await UndoRedoManager.getUndoRedoHistory(matchId);
    console.log(`   Total operations: ${history.length}`);
    history.forEach(op => {
      console.log(`   - ${op.operationId}: ${op.range.from}-${op.range.to} (${op.eventsCount} events) - Can redo: ${op.canRedo}`);
    });

    // Step 8: Redo the operation
    console.log('\n8. Redoing the operation...');
    const redoResult = await UndoRedoManager.redoOperation(undoResult.data.operationId, 'test-user');

    if (redoResult.success) {
      console.log(`   ✓ Redo successful!`);
      console.log(`   Events restored: ${redoResult.data.eventsRestored}`);
      console.log(`   New score: ${redoResult.data.newScore.runs} runs, ${redoResult.data.newScore.wickets} wickets, ${redoResult.data.newScore.overs} overs`);
    } else {
      console.log(`   ✗ Redo failed: ${redoResult.error.message}`);
      return;
    }

    // Step 9: Final score verification
    console.log('\n9. Final score after redo:');
    const finalScore = await ScoreComputer.computeScore(matchId);
    console.log(`   Runs: ${finalScore.runs}, Wickets: ${finalScore.wickets}, Overs: ${finalScore.overs}`);

    // Step 10: Verify we're back to original state
    console.log('\n10. Verification:');
    const scoresMatch = (
      initialScore.runs === finalScore.runs &&
      initialScore.wickets === finalScore.wickets &&
      initialScore.overs === finalScore.overs
    );
    
    if (scoresMatch) {
      console.log('   ✓ SUCCESS: Score restored to original state after undo/redo cycle!');
    } else {
      console.log('   ✗ ERROR: Score does not match original state');
      console.log(`   Original: ${initialScore.runs}/${initialScore.wickets} in ${initialScore.overs}`);
      console.log(`   Final: ${finalScore.runs}/${finalScore.wickets} in ${finalScore.overs}`);
    }

    console.log('\n=== Test Complete ===');

  } catch (error) {
    console.error('Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testUndoRedo().then(() => {
    console.log('Test execution completed');
    process.exit(0);
  }).catch(error => {
    console.error('Test execution failed:', error.message);
    process.exit(1);
  });
}

module.exports = { testUndoRedo };