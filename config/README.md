# Settings Buttons Configuration

## Overview

Konfigurasi untuk mengontrol visibilitas button-button di halaman **Settings** tanpa perlu mengubah kode atau membuat comment.

## File Structure

```
config/
└── settings-buttons.config.ts    # Main configuration file
```

## Usage

### 1. Show/Hide Buttons

Edit file `config/settings-buttons.config.ts`:

```typescript
export const settingsButtonsConfig = {
  configSection: {
    restartMQTT: {
      enabled: true,  // ✅ Button akan muncul
      label: "Restart MQTT + IP",
      // ...
    },
    resetEnergyCounters: {
      enabled: false, // ❌ Button akan disembunyikan
      label: "Reset Energy Counters",
      // ...
    },
  },
  systemSection: {
    rebootSystem: {
      enabled: true,  // ✅ Button akan muncul
      label: "Reboot System",
      // ...
    },
  },
};
```

### 2. Available Buttons

#### Config Section
- ✅ `restartMQTT` - Restart MQTT + IP configurations
- ✅ `restartDeviceModbus` - Restart Device Modbus configurations
- ❌ `resetEnergyCounters` - Reset battery energy counters (hidden by default)
- ❌ `resetCycleCounters` - Reset battery cycle counters (hidden by default)

#### System Section
- ✅ `resetSystem` - Reset system configuration to default
- ✅ `rebootSystem` - Reboot the system
- ✅ `shutdownSystem` - Shutdown the system

### 3. Customization Options

Setiap button dapat dikonfigurasi dengan properti berikut:

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `enabled` | `boolean` | Show/hide button | `true` / `false` |
| `label` | `string` | Button text | `"Restart MQTT + IP"` |
| `service` | `string[]` | Service names for systemd | `["Multiprocesing.service"]` |
| `action` | `string` | Action command | `"restart"`, `"sudo reboot"` |
| `confirmMessage` | `string` | Confirmation dialog text | `"Are you sure?"` |
| `variant` | `string` | Button style | `"secondary"`, `"destructive"` |
| `icon` | `string` | Icon name (Lucide) | `"Settings"`, `"Power"` |

### 4. Add New Button

Untuk menambahkan button baru:

**Step 1: Update Config Type**
```typescript
// config/settings-buttons.config.ts
export interface SettingsButtonsConfig {
  configSection: {
    // ... existing buttons
    myNewButton: ButtonConfig; // ← Add new button type
  };
}
```

**Step 2: Add Configuration**
```typescript
export const settingsButtonsConfig = {
  configSection: {
    // ... existing buttons
    myNewButton: {
      enabled: true,
      label: "My New Button",
      service: ["my.service"],
      action: "restart",
      confirmMessage: "Are you sure you want to restart?",
      variant: "secondary",
      icon: "Settings",
    },
  },
};
```

**Step 3: Update Component**
```tsx
// components/settings/ServiceManagementButtons.tsx
// Add new button rendering logic if needed
```

**Step 4: Add Icon (if new)**
```tsx
// components/settings/ServiceManagementButtons.tsx
import { MyNewIcon } from "lucide-react";

const iconMap = {
  Settings: Settings,
  MyNewIcon: MyNewIcon, // ← Add icon mapping
  // ...
};
```

## Examples

### Example 1: Enable Battery Management Buttons

```typescript
// config/settings-buttons.config.ts
configSection: {
  resetEnergyCounters: {
    enabled: true, // ← Change from false to true
    // ...
  },
  resetCycleCounters: {
    enabled: true, // ← Change from false to true
    // ...
  },
}
```

### Example 2: Hide Dangerous System Buttons

```typescript
// config/settings-buttons.config.ts
systemSection: {
  rebootSystem: {
    enabled: false, // ← Hide reboot button
    // ...
  },
  shutdownSystem: {
    enabled: false, // ← Hide shutdown button
    // ...
  },
}
```

### Example 3: Customize Button Label

```typescript
// config/settings-buttons.config.ts
configSection: {
  restartMQTT: {
    enabled: true,
    label: "Restart MQTT Service", // ← Custom label
    // ...
  },
}
```

## Benefits

✅ **No Code Changes** - Toggle buttons via config only
✅ **Type Safe** - Full TypeScript support
✅ **Easy Maintenance** - Centralized configuration
✅ **No Comments** - Clean code without commented blocks
✅ **Quick Toggle** - Enable/disable instantly
✅ **Scalable** - Easy to add new buttons

## Component Location

- **Config**: `config/settings-buttons.config.ts`
- **Component**: `components/settings/ServiceManagementButtons.tsx`
- **Usage**: `app/settings/setting/page.tsx`

## Notes

- Buttons akan otomatis disabled jika MQTT tidak terkoneksi
- Semua actions memiliki confirmation dialog untuk keamanan
- Icon menggunakan Lucide React icons
- Button variants mengikuti shadcn/ui design system
