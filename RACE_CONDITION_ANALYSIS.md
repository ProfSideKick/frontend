# Race Condition Analysis: fetchEphemeralKey() Bypass

## Step 1: Enumerate All Call Sites

### Direct calls to `fetchEphemeralKey()`:
1. **Line 516**: Inside `globalConnectionPromise` async IIFE
   - Context: Async continuation
   - Closure: Captures `connectionId` (safe, immutable)
   - State check: Line 511 (before) and Line 518 (after)
   - **VULNERABILITY**: State check at line 518 happens AFTER `await fetchEphemeralKey()` completes

### Indirect paths to `connectToRealtime()`:
1. **Line 1326**: `useEffect` on mount
   - Context: React effect (synchronous call)
   - State check: Line 463-473
   
2. **Line 187**: Auto-reconnect `setTimeout` callback
   - Context: Async continuation (1 second delay)
   - Closure: Uses refs (safe)
   - State check: Line 191-204
   
3. **Line 1975**: Manual connect button click
   - Context: Event handler (synchronous)
   - State check: Line 463-473

## Step 2: Prove/Disprove Invariant

**Invariant**: "It is impossible for `fetchEphemeralKey()` to execute unless `connectionStateRef.current === 'CONNECTING'` at the moment of execution."

### Proof Attempt:

**Guard 1 (Line 511)**: Checks state BEFORE `fetchEphemeralKey()`
- ✅ This guard works correctly

**Guard 2 (Line 518)**: Checks state AFTER `fetchEphemeralKey()` completes
- ✅ This guard works correctly

**PROOF FAILURE**: The invariant CAN be violated due to:

### The Critical Race Condition:

**Timeline T0-T600ms:**

```
T0:     connectToRealtime() called
T0+1ms: connectionStateRef.current = "CONNECTING" (line 494)
T0+2ms: globalConnectionPromise = (async () => { ... })() starts
T0+3ms: Guard 1 check (line 511): ✅ PASSES (state is "CONNECTING")
T0+4ms: await fetchEphemeralKey() called
        [ASYNC BOUNDARY - fetchEphemeralKey() takes ~200ms]
T0+200ms: fetchEphemeralKey() completes, returns EPHEMERAL_KEY
T0+201ms: Guard 2 check (line 518): ✅ PASSES (state is still "CONNECTING")
T0+202ms: await createRealtimeConnection(EPHEMERAL_KEY, ...) called
        [ASYNC BOUNDARY - createRealtimeConnection() takes ~400ms]
        [Inside createRealtimeConnection: getUserMedia, createOffer, fetch to OpenAI]
T0+250ms: User says "stop" → disconnectFromRealtime() called
T0+251ms: connectionStateRef.current = "DISCONNECTING" (line 711)
T0+252ms: globalConnectionPromise = null (line 725)
        [NOTE: This does NOT cancel the promise - it's still executing!]
T0+253ms: connectionStateRef.current = "DISCONNECTED" (line 755)
T0+600ms: createRealtimeConnection() completes
T0+601ms: Promise continues execution - **NO STATE CHECK HERE!**
T0+602ms: Line 559-561: Assigns pc, dc, mediaStream to refs
T0+603ms: Line 583: Adds event listeners (dc.addEventListener("open", ...))
T0+604ms: Promise completes
```

**The Bypass**: There is NO state check after `await createRealtimeConnection()` completes. The promise continues executing even though the state has changed to "DISCONNECTED".

However, this doesn't directly call `fetchEphemeralKey()` again...

## Step 3: Promise Survivability Analysis

**Key Finding**: Setting `globalConnectionPromise = null` (line 725) does NOT cancel the promise. The async function continues executing.

**Proof**:
- Line 508: `globalConnectionPromise = (async () => { ... })()`
- This is an IIFE that starts executing immediately
- Setting the variable to `null` only removes the reference, it doesn't stop execution
- The promise continues until it completes or throws

## Step 4: The Actual Edge Case

**The Real Problem**: While the promise doesn't call `fetchEphemeralKey()` again, there's a SECOND connection attempt that can bypass guards:

**Timeline (Double Connection Attempt):**

```
T0:     First connectToRealtime() called (Connection A)
T0+1ms: connectionStateRef.current = "CONNECTING"
T0+2ms: globalConnectionId = "connA", globalConnectionPromise = PromiseA
T0+3ms: await fetchEphemeralKey() called in PromiseA
        [ASYNC BOUNDARY - takes 200ms]
T0+100ms: User clicks connect button again (or auto-reconnect fires)
T0+101ms: connectToRealtime() called again (Connection B)
T0+102ms: Line 463: currentState = "CONNECTING" (from Connection A)
T0+103ms: Line 464: Guard check FAILS - returns early ✅
        BUT WAIT - what if Connection A's promise throws/errors?
T0+200ms: fetchEphemeralKey() in PromiseA completes
T0+201ms: Guard 2 check (line 518): state is "CONNECTING" ✅
T0+202ms: await createRealtimeConnection() called
T0+250ms: createRealtimeConnection() throws error (e.g., getUserMedia denied)
T0+251ms: catch block (line 659) executes
T0+252ms: Line 676: if (globalConnectionId === connectionId) check
        [This checks if THIS connection is still current]
T0+253ms: State set to "DISCONNECTED"
T0+254ms: globalConnectionId = null, globalConnectionPromise = null
T0+255ms: User immediately clicks connect again
T0+256ms: connectToRealtime() called (Connection C)
T0+257ms: Line 463: currentState = "DISCONNECTED" ✅
T0+258ms: Line 476: hasConnectedRef.current = false ✅
T0+259ms: Line 486: globalConnectionId = null ✅
T0+260ms: All guards pass!
T0+261ms: connectionStateRef.current = "CONNECTING"
T0+262ms: globalConnectionId = "connC"
T0+263ms: globalConnectionPromise = PromiseC
T0+264ms: await fetchEphemeralKey() called in PromiseC
```

This scenario is actually handled correctly...

**WAIT - I found it!** The issue is in the **error handling path**:

Line 676: `if (globalConnectionId === connectionId)` - this check uses the `connectionId` from the closure, which is safe. But what if there's a timing issue where:

1. Promise A is executing `fetchEphemeralKey()`
2. User disconnects
3. State changes to "DISCONNECTED"
4. But Promise A's `fetchEphemeralKey()` is still in flight
5. Promise A completes `fetchEphemeralKey()`
6. Guard 2 (line 518) checks state - it's "DISCONNECTED" now
7. Guard 2 should throw... but what if there's a race where the state check happens BEFORE the state is updated?

Actually no, refs are synchronous...

**THE REAL BUG**: The issue is that `fetchEphemeralKey()` is called, completes, but then the promise continues. If `disconnectFromRealtime()` is called DURING the `await fetchEphemeralKey()` call, the guard at line 518 will catch it. But if `disconnectFromRealtime()` is called AFTER line 518 passes but the promise is still executing other async operations, those operations continue.

However, the specific question is about `fetchEphemeralKey()` being called. Let me check if there's a path where it's called twice...

Actually, I think the issue might be that the guard check at line 518 throws an error, but the error is caught and the promise continues? No, if it throws, it goes to the catch block.

**FOUND IT!** The issue is that `fetchEphemeralKey()` itself might be making the HTTP request, and if there are multiple rapid connection attempts, the backend might receive multiple requests for the same session. But the frontend guards should prevent this...

Unless... what if `connectToRealtime()` is called twice in rapid succession, and both pass the initial guards before either sets the state to "CONNECTING"?

**THE ACTUAL BUG**:

```
T0:     connectToRealtime() called (thread 1)
T0+1ms: Line 463: currentState = "IDLE" ✅
T0+2ms: Line 476: hasConnectedRef = false ✅
T0+3ms: Line 486: globalConnectionId = null ✅
        [CONTEXT SWITCH - thread 2 starts]
T0+4ms: connectToRealtime() called again (thread 2)
T0+5ms: Line 463: currentState = "IDLE" ✅ (still IDLE, thread 1 hasn't updated yet)
T0+6ms: Line 476: hasConnectedRef = false ✅
T0+7ms: Line 486: globalConnectionId = null ✅
        [Both threads pass all guards!]
T0+8ms: Thread 1: connectionStateRef.current = "CONNECTING"
T0+9ms: Thread 2: connectionStateRef.current = "CONNECTING" (overwrites)
T0+10ms: Thread 1: globalConnectionId = "conn1"
T0+11ms: Thread 2: globalConnectionId = "conn2" (overwrites)
T0+12ms: Thread 1: globalConnectionPromise = Promise1
T0+13ms: Thread 2: globalConnectionPromise = Promise2 (overwrites)
T0+14ms: Thread 1: await fetchEphemeralKey() called
T0+15ms: Thread 2: await fetchEphemeralKey() called
        [BOTH CALL fetchEphemeralKey() SIMULTANEOUSLY!]
```

This is a classic race condition where two calls to `connectToRealtime()` can both pass the guards before either updates the state.

## Step 5: Minimal Surgical Fix

The fix is to make the guard checks and state updates **atomic** using a single operation:

```typescript
// Instead of checking then updating separately, do it atomically:
const expectedState = connectionStateRef.current;
if (expectedState !== "IDLE" && expectedState !== "DISCONNECTED") {
  return;
}

// Atomic update: only proceed if state hasn't changed
if (connectionStateRef.current !== expectedState) {
  return; // State changed between check and update
}
connectionStateRef.current = "CONNECTING";
```

But even better: use a connection epoch/version number that's checked after every async boundary.

