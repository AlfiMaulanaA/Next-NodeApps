# MQTT Connection Modes

This document explains how to use the MQTT Connection Mode feature that allows switching between Environment Variables and Database configurations.

## Overview

The MQTT Connection Mode feature provides flexibility in how your application connects to MQTT brokers:

- **ENV Mode**: Uses environment variables and automatic host detection
- **Database Mode**: Uses MQTT configurations stored in the database

## How to Access

1. Navigate to **Settings → System Health**
2. Scroll down to the **"MQTT Connection Mode"** section
3. Select your preferred mode using the radio buttons

## Connection Modes

### Environment Variables Mode

When **Environment Variables** mode is selected:

#### Development Environment
- Uses `NEXT_PUBLIC_MQTT_BROKER_HOST=192.168.0.193`
- Uses `NEXT_PUBLIC_MQTT_BROKER_PORT=9000`
- Protocol: `ws://` (WebSocket)

#### Production Environment
- Uses `window.location.hostname` (current domain)
- Uses `NEXT_PUBLIC_MQTT_BROKER_PORT=9000`
- Protocol: Automatic (`ws://` for HTTP, `wss://` for HTTPS)

### Database Configuration Mode

When **Database Configuration** mode is selected:

- Uses the active MQTT configuration from **Settings → MQTT Configuration**
- Supports all protocols: `mqtt`, `mqtts`, `ws`, `wss`
- Falls back to ENV mode if no active configuration is found
- Allows user-defined broker settings

## Automatic Features

### Smart Reconnection
- Automatically reconnects when switching modes
- Detects configuration changes
- Maintains connection state

### Persistent Selection
- Your mode preference is saved in browser storage
- Restores your selection on page reload

### Fallback Protection
- If Database mode fails, automatically falls back to ENV mode
- Graceful error handling for network issues

## Environment Variables

Add these to your `.env` file:

```bash
# MQTT Configuration
NEXT_PUBLIC_MQTT_BROKER_HOST=192.168.0.193
NEXT_PUBLIC_MQTT_BROKER_PORT=9000
NODE_ENV=development  # or production
```

## Database Configuration

To use Database mode:

1. Go to **Settings → MQTT Configuration**
2. Create a new MQTT configuration
3. Set it as **Active**
4. Switch to **Database Configuration** mode in System Health

## Example Configurations

### Development (ENV Mode)
```
Protocol: ws
Host: 192.168.0.193
Port: 9000
URL: ws://192.168.0.193:9000
```

### Production (ENV Mode)
```
Protocol: ws (HTTP) or wss (HTTPS)
Host: your-domain.com
Port: 9000
URL: ws://your-domain.com:9000
```

### Database Mode
```
Protocol: User-defined (mqtt/mqtts/ws/wss)
Host: User-defined
Port: User-defined
URL: As configured in database
```

## Troubleshooting

### Mode Not Switching
- Check browser console for errors
- Ensure you have active MQTT configuration in database mode
- Verify environment variables are set correctly

### Connection Issues
- Verify MQTT broker is running
- Check firewall settings
- Ensure correct protocol (ws vs wss)

### Fallback to ENV Mode
- This is normal behavior when database configuration is unavailable
- Check that you have an active MQTT configuration in the database

## Technical Details

### Files Modified
- `contexts/MQTTModeContext.tsx` - Mode management
- `components/MQTTModeSelector.tsx` - UI component
- `lib/config.ts` - Configuration logic
- `lib/mqttClient.ts` - Dynamic connection handling
- `app/settings/system/page.tsx` - Integration point

### API Endpoints Used
- `GET /api/mqtt?active=true` - Fetch active MQTT configuration

### Storage
- Mode preference: `localStorage.mqtt_connection_mode`
- Values: `"env"` or `"database"`