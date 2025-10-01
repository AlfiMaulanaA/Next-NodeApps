/**
 * Settings Buttons Configuration
 *
 * Control visibility of buttons in Settings page.
 * Set 'enabled: false' to hide any button without commenting code.
 */

export interface ButtonConfig {
  enabled: boolean;
  label: string;
  service?: string[];
  action?: string;
  confirmMessage?: string;
  variant?: "default" | "secondary" | "destructive" | "outline" | "ghost";
  icon?: string;
}

export interface SettingsButtonsConfig {
  configSection: {
    restartMQTT: ButtonConfig;
    restartDeviceModbus: ButtonConfig;
    resetEnergyCounters: ButtonConfig;
    resetCycleCounters: ButtonConfig;
  };
  systemSection: {
    resetSystem: ButtonConfig;
    rebootSystem: ButtonConfig;
    shutdownSystem: ButtonConfig;
  };
}

export const settingsButtonsConfig: SettingsButtonsConfig = {
  configSection: {
    restartMQTT: {
      enabled: true,
      label: "Restart MQTT + IP",
      service: ["Multiprocesing.service"],
      action: "restart",
      confirmMessage: "This will restart MQTT and IP configurations. Are you sure?",
      variant: "secondary",
      icon: "Settings",
    },
    restartDeviceModbus: {
      enabled: true,
      label: "Restart Device Modbus",
      service: ["Multiprocesing.service"],
      action: "restart",
      confirmMessage: "This will restart Device Modbus configurations. Are you sure?",
      variant: "secondary",
      icon: "Settings",
    },
    resetEnergyCounters: {
      enabled: false, // Hidden by default (was commented)
      label: "Reset Energy Counters",
      variant: "secondary",
      icon: "BatteryCharging",
    },
    resetCycleCounters: {
      enabled: false, // Hidden by default (was commented)
      label: "Reset Cycle Counters",
      variant: "secondary",
      icon: "BatteryCharging",
    },
  },
  systemSection: {
    resetSystem: {
      enabled: true,
      label: "Reset System to Default",
      confirmMessage:
        "This will reset specific configurations to their defaults. This action may cause a temporary service interruption. Are you sure?",
      variant: "destructive",
      icon: "Terminal",
    },
    rebootSystem: {
      enabled: true,
      label: "Reboot System",
      service: [],
      action: "sudo reboot",
      confirmMessage:
        "This will reboot the system. All current operations will be interrupted. Are you sure?",
      variant: "destructive",
      icon: "RotateCw",
    },
    shutdownSystem: {
      enabled: true,
      label: "Shutdown System",
      service: [],
      action: "sudo shutdown now",
      confirmMessage:
        "This will shut down the system. You will need physical access to power it back on. Are you sure?",
      variant: "destructive",
      icon: "Power",
    },
  },
};
