# Testing the Notification & Stability System

## Quick Start Testing

### 1. Service Worker Registration

**Test in Browser DevTools:**
```
1. Open app in browser
2. Press F12 → Application tab
3. Check "Service Workers" in left sidebar
4. Verify status shows: "activated and running"
5. URL should be: /service-worker.js
```

**What's working?**
- ✓ Service Worker registered
- ✓ Can receive background notifications
- ✓ Can handle user actions from notifications

### 2. Notification Permission

**Test in Browser:**
```
1. Open app
2. Should see notification permission request
3. Click "Allow"
4. Check DevTools → Application → Manifest
5. Verify "Display" and "Notification" settings
```

**What's working?**
- ✓ NotificationManager requests permission on load
- ✓ User can allow/deny
- ✓ App gracefully handles denial

### 3. Incoming Call (Foreground Test)

**Prerequisites:**
- App open in browser
- Permission granted for notifications
- Audio enabled and unmuted

**Test Steps:**
```
1. User A opens app at tab/window 1
2. User B initiates call to User A
3. Observe:
   ✓ Notification appears at top of screen
   ✓ Sound plays (check volume)
   ✓ Vibration pattern (if on mobile)
   ✓ Accept/Decline buttons visible
   ✓ Clicking Accept triggers call connection
```

**What's working?**
- ✓ NotificationManager.showIncomingCall()
- ✓ AudioPipeline.startRingtone()
- ✓ BackgroundListener receives accept action
- ✓ CallEngine.acceptCall() triggered

### 4. Incoming Call (Background Test)

**Prerequisites:**
- App tab is open but browser hidden
- Permission granted for notifications

**Test Steps:**
```
1. User A has app open
2. Click browser minimize or switch to another window
3. User B initiates call to User A
4. Observe (depends on OS):
   ✓ Native OS notification appears
   ✓ Sound plays (Windows/Android)
   ✓ Vibration (mobile)
   ✓ Badge on app icon
5. Click notification
6. Observe:
   ✓ App opens/comes to foreground
   ✓ Call screen appears
   ✓ Can accept/decline
```

**What's working?**
- ✓ Service Worker receives notification
- ✓ SW shows native OS notification
- ✓ SW opens app on notification click
- ✓ BackgroundListener processes message

### 5. Screen Wake Lock Test (Mobile)

**Prerequisites:**
- Mobile device (iOS or Android)
- App installed as PWA or in mobile browser
- Permission granted (auto-requested)

**Test Steps:**
```
1. Start a call (accept incoming call)
2. Place phone on desk
3. Wait 30 seconds (device would normally lock)
4. Observe:
   ✓ Screen remains ON during call
   ✓ No screen timeout
5. End call
6. Observe:
   ✓ Screen can lock again immediately
```

**Debugging:**
```javascript
// In console during call:
engine.wakeLock.isAcquired()  // Should return true

// Check DevTools → Application → Service Workers:
// Wake Lock status visible in debug info
```

**What's working?**
- ✓ WakeLockManager.acquire() on acceptCall
- ✓ WakeLockManager.release() on endCall
- ✓ Auto-release on page hide
- ✓ Auto-reacquire on page show

### 6. Audio Ducking Test

**Prerequisites:**
- App open with active call
- Notification enabled
- Audio/headphones connected

**Test Steps:**
```
1. Start a call with User B
2. Call audio is playing normally
3. Have User C trigger incoming call notification to User A
4. Observe:
   ✓ Ringtone plays (doesn't replace call audio)
   ✓ Call audio volume decreases (ducked)
   ✓ Ringtone is clearly audible
   ✓ Can still hear call audio underneath
5. Accept/decline the incoming call
6. Observe:
   ✓ Ringtone stops
   ✓ Call audio returns to normal volume
```

**Volume Check (in code):**
```javascript
// In console during call:
const pipeline = getAudioPipeline();
pipeline.getMasterGain().gain.value     // 1.0 (normal)
pipeline.getSourceGain("ringtone").gain.value   // 0.5
pipeline.getSourceGain("call").gain.value       // 0.3 (ducked)
```

**What's working?**
- ✓ AudioPipeline mixes multiple sources
- ✓ Volume ducking applied automatically
- ✓ Call audio still audible during notification
- ✓ Smooth transitions on play/stop

## Advanced Testing Scenarios

### Scenario A: App Crash During Call

**Test:**
```
1. Start a call
2. Simulate crash: Open DevTools, press pause (break all)
3. Send incoming call notification to User A
4. Observe:
   ✓ Service Worker still receives notification
   ✓ Native notification still shows
   ✓ Can still interact with notification
5. Resume execution (F8)
6. Observe:
   ✓ App recovers
   ✓ BackgroundListener receives message
   ✓ Call state is restored from engine
```

**What's working?**
- ✓ Service Worker is independent
- ✓ Survives app crashes
- ✓ Message queued for app recovery

### Scenario B: Network Glitch During Call

**Test:**
```
1. Start a call
2. Go offline: DevTools → Network → Offline
3. Incoming call comes in (or simulate via mock)
4. Observe:
   ✓ Notification still shows locally
   ✓ Audio still plays (already loaded)
5. Go back online
6. Observe:
   ✓ State syncs with server
   ✓ No duplicate notifications
```

**What's working?**
- ✓ Notifications are resilient to network
- ✓ Ringtone doesn't require network
- ✓ State machine handles offline state

### Scenario C: Multiple Calls

**Test:**
```
1. User A in call with User B
2. User C initiates call to User A
3. Observe:
   ✓ Notification appears for User C
   ✓ Audio ducking applies
   ✓ Both calls in state machine
4. User A can accept User C (conferences) or decline
5. Observe:
   ✓ Notification replaced with conference UI
   ✓ All participants in call
   ✓ Audio from all sources mixed
```

**What's working?**
- ✓ Multiple concurrent call support
- ✓ State machine handles participants list
- ✓ Audio pipeline mixes multiple peers

### Scenario D: Notification Permissions Denied

**Test:**
```
1. Clear notification permission
2. Reload app
3. Deny permission when prompted
4. Receive incoming call
5. Observe:
   ✓ In-app notification still shows
   ✓ Ringtone still plays
   ✓ No OS notification
   ✓ Can still accept/decline in app
```

**What's working?**
- ✓ NotificationManager gracefully degrades
- ✓ App works without notifications
- ✓ Fallback to in-app notifications

## DevTools Debugging

### Check Notification Events

```javascript
// In console:
navigator.serviceWorker.controller.postMessage({
  type: "DEBUG",
  payload: { action: "listNotifications" }
});

// Or check directly:
navigator.serviceWorker.ready.then(reg => {
  reg.getNotifications().then(notifications => {
    console.log("Active notifications:", notifications);
  });
});
```

### Monitor Audio Context

```javascript
// In console during call:
const pipeline = getAudioPipeline();
const ctx = pipeline.audioContext;

console.log("Context state:", ctx.state);           // "running" or "suspended"
console.log("Context time:", ctx.currentTime);      // Elapsed seconds
console.log("Sample rate:", ctx.sampleRate);        // 44100 or 48000
console.log("Channel count:", ctx.destination.maxChannelCount);
```

### Check Wake Lock Status

```javascript
// In console during call:
const engine = getCallEngine();
console.log("Wake lock acquired:", engine.wakeLock.isAcquired());

// Watch for changes:
engine.subscribe(event => {
  if (event.type === "call-state-changed") {
    console.log("Call state:", event.data.state);
    console.log("Wake lock:", engine.wakeLock.isAcquired());
  }
});
```

### Monitor Feature Flags

```javascript
// In console:
import { getFeatureFlags } from "@/config/feature-flags";
const flags = getFeatureFlags();

console.log("Auto-accept notifications:", flags.AUTO_ACCEPT_FROM_NOTIFICATION);
console.log("Ringtone ducking:", flags.RINGTONE_WITH_DUCKING);
console.log("Wake lock enabled:", flags.ENABLE_WAKE_LOCK);
```

## Performance Testing

### Notification Latency

**Measure time from call initiation to notification:**
```javascript
// In console:
const startTime = performance.now();
engine.subscribe(event => {
  if (event.type === "call-incoming") {
    const latency = performance.now() - startTime;
    console.log(`Notification latency: ${latency.toFixed(2)}ms`);
  }
});
```

**Target:** < 100ms from server event to notification

### Audio Latency

**Measure time from acceptCall to audio:**
```javascript
// In console:
const startTime = performance.now();
await engine.acceptCall(false);  // audio only
const latency = performance.now() - startTime;
console.log(`Call acceptance latency: ${latency.toFixed(2)}ms`);
```

**Target:** < 500ms from accept to audio connection

### Memory Usage

**Monitor memory during call:**
```javascript
// In console (Chrome only):
if (performance.memory) {
  setInterval(() => {
    console.log({
      used: `${(performance.memory.usedJSHeapSize / 1048576).toFixed(2)}MB`,
      limit: `${(performance.memory.jsHeapSizeLimit / 1048576).toFixed(2)}MB`,
      notification: `${engine.notificationManager ? "ready" : "not ready"}`,
    });
  }, 1000);
}
```

**Target:** < 50MB for active call

## Network Testing

### Simulate High Latency

```
DevTools → Network → Custom → Add custom profile:
- Download: 1000 kbps
- Upload: 1000 kbps  
- Latency: 500ms

Test with:
1. Incoming call
2. Observe notification still shows
3. Check if audio adapts
```

### Simulate Packet Loss

```
DevTools → Network → Conditions tab:
- Connection: Custom (add packet loss)

Test with:
1. Active call
2. Observe audio quality
3. Check if notification timeout increased
```

## Automated Test Script

```bash
#!/bin/bash
# Run full test suite

echo "Building..."
pnpm build

echo "Testing notification manager..."
pnpm test -- NotificationManager

echo "Testing wake lock manager..."
pnpm test -- WakeLockManager

echo "Testing background listener..."
pnpm test -- BackgroundListener

echo "Testing audio pipeline..."
pnpm test -- AudioPipeline

echo "Testing call engine integration..."
pnpm test -- CallEngine

echo "All tests passed!"
```

## Troubleshooting Issues

### Notification Not Showing

**Checklist:**
- [ ] Notification.permission === "granted"
- [ ] Service Worker status === "activated and running"
- [ ] ENABLE_NOTIFICATIONS feature flag === true
- [ ] No browser console errors
- [ ] Browser tab not playing audio from another source (browser mutes)
- [ ] macOS: Check System Settings → Notifications

**Debug:**
```javascript
// In console:
console.log("Permission:", Notification.permission);
navigator.serviceWorker.ready.then(reg => {
  console.log("SW ready:", !!reg);
  reg.getNotifications().then(n => console.log("Notifications:", n));
});
```

### Ringtone Not Playing

**Checklist:**
- [ ] Browser tab not muted (look for mute icon)
- [ ] Device volume > 0
- [ ] AudioContext.state === "running"
- [ ] No JavaScript errors in console
- [ ] ENABLE_NOTIFICATIONS feature flag === true

**Debug:**
```javascript
// In console:
const pipeline = getAudioPipeline();
console.log("AudioContext state:", pipeline.audioContext.state);
console.log("Ringtone gain:", pipeline.getSourceGain("ringtone").gain.value);
```

### Wake Lock Not Working

**Checklist:**
- [ ] Mobile device (desktop may not have wake lock)
- [ ] HTTPS connection (or localhost)
- [ ] ENABLE_WAKE_LOCK feature flag === true
- [ ] Call is actually accepted (state === "active")
- [ ] Browser is current/focused

**Debug:**
```javascript
// In console:
const engine = getCallEngine();
console.log("Wake lock:", engine.wakeLock.isAcquired());
console.log("Call state:", engine.getState().state);
```

## Success Criteria

Call the test complete when all of the following pass:

- [ ] Service Worker registers and activates
- [ ] Notifications show when permission granted
- [ ] Ringtone plays immediately on call
- [ ] Audio ducking works during call
- [ ] Wake lock acquired during call
- [ ] Background notifications work (minimize app, receive call)
- [ ] User can accept/decline from notification
- [ ] No JavaScript errors in console
- [ ] Performance metrics within targets
- [ ] Works on mobile (iOS/Android)
- [ ] Works offline (cached assets load)

**If all pass:** System is stable and ready for deployment! 🎉
