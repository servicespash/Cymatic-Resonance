# Notification & Call Alert System

## Overview

The notification system ensures users are alerted to incoming calls and call state changes even when:
- The app is backgrounded on mobile
- The browser tab is not in focus
- The phone is locked or set aside
- The app is completely closed (push notifications)

## Architecture

### Service Worker (`public/service-worker.js`)
- Runs in the background, independent of the app
- Receives push notifications from the server
- Shows native OS notifications
- Handles notification interactions (accept/decline)
- Can play ringtone via message passing to the app
- Survives app crashes and browser restarts

### Notification Manager (`src/engine/notification-manager.ts`)
- Registers and manages the service worker
- Detects when the app is backgrounded using visibility API
- Shows Web Notifications API notifications
- Manages ringtone playback through the audio pipeline
- Tracks notification permissions

### Wake Lock Manager (`src/engine/wake-lock-manager.ts`)
- Acquires screen wake lock when a call is active
- Keeps the device screen on during calls on mobile
- Automatically releases lock when page becomes hidden
- Re-acquires lock if page becomes visible again

### Background Listener (`src/engine/background-listener.ts`)
- Listens for messages from the service worker
- Triggers call acceptance/decline from notifications
- Coordinates with the call engine for state transitions

### Call Engine Integration
- Integrates all notification components
- Orchestrates state transitions with notifications
- Manages wake locks during active calls
- Maintains notification consistency

## User Flows

### Incoming Call (App in Foreground)
1. Call server sends message to backend
2. Backend triggers notification event
3. Engine emits `call-incoming` event
4. NotificationManager shows native notification + ringtone
5. User clicks notification or app button to accept/decline
6. Engine updates state and connects peers

### Incoming Call (App Backgrounded/Closed)
1. Call server sends push notification to service worker
2. Service worker shows native OS notification
3. User clicks notification
4. Service worker opens app with `/?callId=X` or posts message to existing window
5. App receives callId and auto-accepts (if enabled via feature flag)
6. Call connects with audio/video

### Incoming Call (App Closed, Browser Closed)
1. **Requires**: Push notification server setup with Firebase Cloud Messaging (FCM) or Apple Push Notification (APN)
2. Service worker is activated by OS push notification (if app is re-opened)
3. Process same as "App Backgrounded" flow

## Implementation Details

### Ringtone Pipeline
```
CallEngine → NotificationManager
           → AudioPipeline (centralized audio context)
           → Multiple sources with volume ducking:
             - Ringtone (incoming call)
             - Call audio (during call)
             - Other notifications (during call - ducked)
```

### Screen Wake Lock
- Acquired: `acceptCall()` is called
- Released: `endCall()` is called
- Auto-release: When page becomes hidden (browser handles this)
- Re-acquire: When page becomes visible again

### Notification Permission
- Auto-requested when NotificationManager is initialized
- Gracefully degrades if permission denied
- Falls back to in-app notifications only

### Service Worker Message Protocol

**From Service Worker to App:**
```javascript
{
  type: "ACCEPT_CALL",
  payload: { callId, senderId, kind: "audio" | "video" }
}
// OR
{
  type: "DECLINE_CALL",
  payload: { callId }
}
// OR
{
  type: "PLAY_RINGTONE",
  payload: {}
}
```

**From App to Service Worker:**
```javascript
// Via fetch to API endpoints
POST /api/calls/decline
{
  callId: "..."
}
```

## Configuration

### Feature Flags
```typescript
// src/config/feature-flags.ts
FEATURES = {
  // Auto-accept calls from notifications
  AUTO_ACCEPT_FROM_NOTIFICATION: env === "mobile",
  
  // Play ringtone during call (with ducking)
  RINGTONE_WITH_DUCKING: true,
  
  // Keep screen on during calls
  ENABLE_WAKE_LOCK: true,
  
  // Show native notifications
  ENABLE_NOTIFICATIONS: true,
}
```

### Audio Pipeline Settings
```typescript
// src/audio/audio-pipeline.ts
{
  // Notification volume during call
  NOTIFICATION_DUCKING_RATIO: 0.3, // 30% of normal volume
  
  // Master volume
  MASTER_VOLUME: 1.0,
  
  // Ringtone volume
  RINGTONE_VOLUME: 0.5,
}
```

## Mobile Optimization

### iOS Considerations
- Push notifications require Apple Push Notification (APN) setup
- Service Worker only partially supported on iOS Safari
- Use native iOS app container for full push support
- Ringtone must use Web Audio API (no file playback)

### Android Considerations
- Firebase Cloud Messaging (FCM) for push notifications
- Service Worker fully supported
- Web Notifications API fully supported
- Ringtone plays through Web Audio API
- Wake lock fully supported

## Testing

### Manual Testing
1. **Foreground notification**: Open app, make a call
2. **Background notification**: Minimize app, call from another device
3. **Closed app notification**: Close app entirely, call from another device
4. **Wake lock**: Make a call, screen should stay on
5. **Ringtone with ducking**: Make a call, start playing background audio

### Automated Testing
```typescript
// src/engine/__tests__/notification-manager.test.ts
- Service Worker registration
- Notification display
- Ringtone playback
- Wake lock acquisition/release
- Background listener message handling
```

## Deployment

### Prerequisites
1. Service worker at `public/service-worker.js` (✓ included)
2. Notification icons at `public/icon-192x192.png` and `public/badge-72x72.png`
3. (Optional) Push notification server setup (FCM/APN)
4. (Optional) API endpoints for call state management:
   - `POST /api/calls/decline`
   - `POST /api/calls/accept`
   - `POST /api/calls/log`

### Browser Support
- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Limited (no push, no Service Worker on iOS)
- IE11: Not supported

## Troubleshooting

### Notifications not showing
1. Check notification permission: `Notification.permission`
2. Verify service worker is registered: DevTools → Application → Service Workers
3. Check browser console for errors
4. Ensure `ENABLE_NOTIFICATIONS` feature flag is true

### Ringtone not playing
1. Check audio context state: `AudioContext.state`
2. Verify audio pipeline is initialized
3. Check browser audio permissions
4. Try unmuting browser tab (Chrome requires this)

### Wake lock not working
1. Verify `ENABLE_WAKE_LOCK` feature flag is true
2. Check browser support (Chrome 84+, Firefox 119+)
3. Screen may not lock during debugging (browser dependent)
4. Verify `acceptCall()` is actually called

### Service Worker not working
1. HTTPS required (except localhost)
2. Check Service Worker scope matches routes
3. Verify Service Worker file syntax (no JS errors)
4. Clear old cache: DevTools → Application → Clear storage

## Future Enhancements

1. **Push Notification Server**: Firebase Cloud Messaging integration
2. **Multiple Ringtones**: Custom ringtone selection per caller
3. **Caller ID**: Show caller name/photo in notification
4. **Do Not Disturb**: Notification scheduling and quiet hours
5. **Accessibility**: Haptic feedback + screen reader support
6. **Analytics**: Track notification delivery and click-through rates
