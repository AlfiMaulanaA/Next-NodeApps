"use client";

import { Button } from "@/components/ui/button";
import {
  Settings,
  BatteryCharging,
  Terminal,
  RotateCw,
  Power,
} from "lucide-react";
import { settingsButtonsConfig } from "@/config/settings-buttons.config";
import type { MqttClient } from "mqtt";

interface ServiceManagementButtonsProps {
  sendCommand: (
    services: string[],
    action: string,
    confirmMessage?: string
  ) => Promise<void>;
  resetConfig: (confirmMessage?: string) => Promise<void>;
  resetEnergyCounters: () => Promise<void>;
  resetCycleCounters: () => Promise<void>;
  clientRef: React.RefObject<MqttClient | null>;
}

const iconMap = {
  Settings: Settings,
  BatteryCharging: BatteryCharging,
  Terminal: Terminal,
  RotateCw: RotateCw,
  Power: Power,
};

export default function ServiceManagementButtons({
  sendCommand,
  resetConfig,
  resetEnergyCounters,
  resetCycleCounters,
  clientRef,
}: ServiceManagementButtonsProps) {
  const config = settingsButtonsConfig;

  const getIcon = (iconName?: string) => {
    if (!iconName) return null;
    const Icon = iconMap[iconName as keyof typeof iconMap];
    return Icon ? <Icon className="h-4 w-4" /> : null;
  };

  const isConnected = clientRef.current && clientRef.current.connected;

  return (
    <div className="flex flex-col md:flex-row gap-4 justify-between w-full">
      {/* Config Section */}
      <div className="flex-1 min-w-[200px]">
        <h6 className="text-sm font-semibold mb-2">Config</h6>

        {/* Restart MQTT + IP */}
        {config.configSection.restartMQTT.enabled && (
          <Button
            onClick={() =>
              sendCommand(
                config.configSection.restartMQTT.service || [],
                config.configSection.restartMQTT.action || "",
                config.configSection.restartMQTT.confirmMessage
              )
            }
            className="w-full mb-2 flex justify-between items-center"
            variant={config.configSection.restartMQTT.variant}
            disabled={!isConnected}
          >
            <span className="flex items-center gap-2">
              {getIcon(config.configSection.restartMQTT.icon)}
              {config.configSection.restartMQTT.label}
            </span>
          </Button>
        )}

        {/* Restart Device Modbus */}
        {config.configSection.restartDeviceModbus.enabled && (
          <Button
            onClick={() =>
              sendCommand(
                config.configSection.restartDeviceModbus.service || [],
                config.configSection.restartDeviceModbus.action || "",
                config.configSection.restartDeviceModbus.confirmMessage
              )
            }
            className="w-full mb-2 flex justify-between items-center"
            variant={config.configSection.restartDeviceModbus.variant}
            disabled={!isConnected}
          >
            <span className="flex items-center gap-2">
              {getIcon(config.configSection.restartDeviceModbus.icon)}
              {config.configSection.restartDeviceModbus.label}
            </span>
          </Button>
        )}

        {/* Reset Energy Counters */}
        {config.configSection.resetEnergyCounters.enabled && (
          <Button
            onClick={resetEnergyCounters}
            className="w-full mb-2 flex justify-between items-center"
            variant={config.configSection.resetEnergyCounters.variant}
            disabled={!isConnected}
          >
            <span className="flex items-center gap-2">
              {getIcon(config.configSection.resetEnergyCounters.icon)}
              {config.configSection.resetEnergyCounters.label}
            </span>
          </Button>
        )}

        {/* Reset Cycle Counters */}
        {config.configSection.resetCycleCounters.enabled && (
          <Button
            onClick={resetCycleCounters}
            className="w-full mb-2 flex justify-between items-center"
            variant={config.configSection.resetCycleCounters.variant}
            disabled={!isConnected}
          >
            <span className="flex items-center gap-2">
              {getIcon(config.configSection.resetCycleCounters.icon)}
              {config.configSection.resetCycleCounters.label}
            </span>
          </Button>
        )}
      </div>

      {/* System Section */}
      <div className="flex-1 min-w-[200px]">
        <h6 className="text-sm font-semibold mb-2">System</h6>

        {/* Reset System to Default */}
        {config.systemSection.resetSystem.enabled && (
          <Button
            onClick={() =>
              resetConfig(config.systemSection.resetSystem.confirmMessage)
            }
            className="w-full mb-2 flex justify-between items-center"
            variant={config.systemSection.resetSystem.variant}
            disabled={!isConnected}
          >
            <span className="flex items-center gap-2">
              {getIcon(config.systemSection.resetSystem.icon)}
              {config.systemSection.resetSystem.label}
            </span>
          </Button>
        )}

        {/* Reboot System */}
        {config.systemSection.rebootSystem.enabled && (
          <Button
            onClick={() =>
              sendCommand(
                config.systemSection.rebootSystem.service || [],
                config.systemSection.rebootSystem.action || "",
                config.systemSection.rebootSystem.confirmMessage
              )
            }
            className="w-full mb-2 flex justify-between items-center"
            variant={config.systemSection.rebootSystem.variant}
            disabled={!isConnected}
          >
            <span className="flex items-center gap-2">
              {getIcon(config.systemSection.rebootSystem.icon)}
              {config.systemSection.rebootSystem.label}
            </span>
          </Button>
        )}

        {/* Shutdown System */}
        {config.systemSection.shutdownSystem.enabled && (
          <Button
            onClick={() =>
              sendCommand(
                config.systemSection.shutdownSystem.service || [],
                config.systemSection.shutdownSystem.action || "",
                config.systemSection.shutdownSystem.confirmMessage
              )
            }
            className="w-full flex justify-between items-center"
            variant={config.systemSection.shutdownSystem.variant}
            disabled={!isConnected}
          >
            <span className="flex items-center gap-2">
              {getIcon(config.systemSection.shutdownSystem.icon)}
              {config.systemSection.shutdownSystem.label}
            </span>
          </Button>
        )}
      </div>
    </div>
  );
}
