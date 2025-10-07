import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Battery,
  Zap,
  Thermometer,
  AlertTriangle,
  Activity,
  ShieldAlert,
  Info,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Gauge,
  Layers,
} from "lucide-react";

interface DeviceDataDisplayProps {
  topicData: any;
  deviceName: string;
}

  interface PanasonicBatteryData {
    charge_operation_mode?: string;
    discharge_operation_mode?: string;
    status?: string;
    warning?: string;
    alarm?: string;
    error?: string;
    fw_update_status?: number;
    charging_voltage?: number | string;
    charging_current?: number | string;
    discharge_current_limit?: number | string;
    end_of_discharge_voltage?: number | string;
    dc?: number | string;
    fcc?: number | string;
    rc?: number | string;
    soc?: number | string;
    soh?: number | string;
    cycle_count?: number | string;
    voltage?: number | string;
    max_cell_voltage?: number | string;
    min_cell_voltage?: number | string;
    current?: number | string;
    max_cell_temperature?: number | string;
    min_cell_temperature?: number | string;
    max_fet_temperature?: number | string;
    max_pcb_temperature?: number | string;
    battery_cell_temp_0?: number | string;
    battery_cell_temp_1?: number | string;
    battery_cell_temp_2?: number | string;
    fet_temperature?: number | string;
    pcb_temperature?: number | string;
    cell_1_voltage?: number | string;
    cell_2_voltage?: number | string;
    cell_3_voltage?: number | string;
    cell_4_voltage?: number | string;
    cell_5_voltage?: number | string;
    cell_6_voltage?: number | string;
    cell_7_voltage?: number | string;
    cell_8_voltage?: number | string;
    cell_9_voltage?: number | string;
    cell_10_voltage?: number | string;
    cell_11_voltage?: number | string;
    cell_12_voltage?: number | string;
    cell_13_voltage?: number | string;
    manufacture_name?: string;
    device_name?: string;
    manufacture_date?: number | string;
    serial_number?: number | string;
    program_version?: number | string;
    data_version?: number | string;
    barcode?: string;
    PollingDuration?: number | string;
  }

export default function DeviceDataDisplay({
  topicData,
  deviceName,
}: DeviceDataDisplayProps) {
  // Utility function to safely convert value to number
  const toNumber = (value: number | string | undefined): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseFloat(value) || 0;
    return 0;
  };

  // Utility function to safely format number with toFixed
  const formatDecimal = (value: number | string | undefined, decimals: number = 2): string => {
    return toNumber(value).toFixed(decimals);
  };
  if (!topicData) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center space-y-2">
          <Activity className="h-8 w-8 mx-auto animate-pulse" />
          <p>Waiting for battery data...</p>
        </div>
      </div>
    );
  }

  const getSystemHealth = (data: PanasonicBatteryData) => {
    if (data.error && data.error !== "") {
      return {
        level: "critical",
        label: "CRITICAL",
        color: "red",
        icon: XCircle,
      };
    }
    if (data.alarm && data.alarm !== "") {
      return {
        level: "alarm",
        label: "ALARM",
        color: "orange",
        icon: AlertTriangle,
      };
    }
    if (data.warning && data.warning !== "") {
      return {
        level: "warning",
        label: "WARNING",
        color: "yellow",
        icon: Info,
      };
    }
    if (
      data.charge_operation_mode === "PROTECTION" ||
      data.discharge_operation_mode === "PROTECTION"
    ) {
      return {
        level: "caution",
        label: "PROTECTED",
        color: "blue",
        icon: ShieldAlert,
      };
    }
    return {
      level: "normal",
      label: "NORMAL",
      color: "green",
      icon: CheckCircle2,
    };
  };

  try {
    const fullData = topicData;
    const batteryData: PanasonicBatteryData = fullData.value
      ? JSON.parse(fullData.value)
      : {};

    const systemHealth = getSystemHealth(batteryData);
    const HealthIcon = systemHealth.icon;

    // Calculations
    const cellVoltages = useMemo(() => {
      const voltages: number[] = [];
      for (let i = 1; i <= 13; i++) {
        const cellKey = `cell_${i}_voltage` as keyof PanasonicBatteryData;
        if (batteryData[cellKey]) {
          voltages.push(batteryData[cellKey] as number);
        }
      }
      return voltages;
    }, [batteryData]);

    const cellDelta =
      batteryData.max_cell_voltage && batteryData.min_cell_voltage
        ? toNumber(batteryData.max_cell_voltage) - toNumber(batteryData.min_cell_voltage)
        : 0;

    const avgCellVoltage =
      cellVoltages.length > 0
        ? cellVoltages.reduce((a, b) => a + b, 0) / cellVoltages.length
        : 0;

    const powerWatts = toNumber(batteryData.voltage) * toNumber(batteryData.current);

    return (
      <div className="space-y-4">
        {/* ==================== CRITICAL ALERTS (Top Priority) ==================== */}
        {systemHealth.level !== "normal" && (
          <Alert
            variant={
              systemHealth.level === "critical" ||
              systemHealth.level === "alarm"
                ? "destructive"
                : "default"
            }
            className={`border-l-4 ${
              systemHealth.color === "red"
                ? "border-l-red-600 bg-red-50 dark:bg-red-950"
                : systemHealth.color === "orange"
                ? "border-l-orange-600 bg-orange-50 dark:bg-orange-950"
                : systemHealth.color === "yellow"
                ? "border-l-yellow-600 bg-yellow-50 dark:bg-yellow-950"
                : "border-l-blue-600 bg-blue-50 dark:bg-blue-950"
            }`}
          >
            <HealthIcon className="h-5 w-5" />
            <AlertTitle className="font-bold text-lg flex items-center gap-2">
              {systemHealth.label}
              <Badge variant="outline" className="ml-auto">
                {fullData.modbus_address
                  ? `Addr: ${fullData.modbus_address}`
                  : ""}
              </Badge>
            </AlertTitle>
            <AlertDescription className="mt-2">
              {systemHealth.level === "critical" && (
                <div className="space-y-2">
                  <p className="font-semibold text-red-900 dark:text-red-100">
                    Hardware Error - Battery Unusable
                  </p>
                  <p className="text-red-800 dark:text-red-200 bg-red-100 dark:bg-red-900 p-2 rounded">
                    {batteryData.error}
                  </p>
                  <p className="text-sm font-medium">
                    → Immediate service required. Do not charge or discharge.
                  </p>
                </div>
              )}
              {systemHealth.level === "alarm" && (
                <div className="space-y-2">
                  <p className="font-semibold text-orange-900 dark:text-orange-100">
                    Protection Active - Limited Operation
                  </p>
                  <p className="text-orange-800 dark:text-orange-200 bg-orange-100 dark:bg-orange-900 p-2 rounded">
                    {batteryData.alarm}
                  </p>
                  <p className="text-sm font-medium">
                    → Battery operation restricted for safety. Check parameters.
                  </p>
                </div>
              )}
              {systemHealth.level === "warning" && (
                <div className="space-y-2">
                  <p className="font-semibold text-yellow-900 dark:text-yellow-100">
                    Warning Condition Detected
                  </p>
                  <p className="text-yellow-800 dark:text-yellow-200 bg-yellow-100 dark:bg-yellow-900 p-2 rounded">
                    {batteryData.warning}
                  </p>
                  <p className="text-sm font-medium">
                    → Monitor battery closely. Condition may worsen.
                  </p>
                </div>
              )}
              {systemHealth.level === "caution" && (
                <div className="space-y-2">
                  <p className="font-semibold text-blue-900 dark:text-blue-100">
                    Protection Mode Active
                  </p>
                  <div className="flex gap-4 text-sm">
                    <div>
                      <span className="font-medium">Charge:</span>{" "}
                      <Badge variant="outline" className="ml-1">
                        {batteryData.charge_operation_mode}
                      </Badge>
                    </div>
                    <div>
                      <span className="font-medium">Discharge:</span>{" "}
                      <Badge variant="outline" className="ml-1">
                        {batteryData.discharge_operation_mode}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* ==================== HEADER: Device Info ==================== */}
        <Card className="border-2">
          <CardHeader className="pb-4 bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-950">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-xl flex items-center gap-3">
                  <Battery className="h-6 w-6 text-primary" />
                  <span>
                    {batteryData.manufacture_name?.trim() || "Panasonic"}{" "}
                    {batteryData.device_name?.trim() || "DCB105ZK"}
                  </span>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  13S Lithium-ion Battery Management System
                </p>
              </div>
              <Badge
                className={`text-base px-4 py-2 ${
                  systemHealth.color === "green"
                    ? "bg-green-600 hover:bg-green-700"
                    : systemHealth.color === "blue"
                    ? "bg-blue-600 hover:bg-blue-700"
                    : systemHealth.color === "yellow"
                    ? "bg-yellow-600 hover:bg-yellow-700"
                    : systemHealth.color === "orange"
                    ? "bg-orange-600 hover:bg-orange-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                <HealthIcon className="h-4 w-4 mr-2" />
                {systemHealth.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">
                  Protocol
                </p>
                <p className="font-semibold">{fullData.protocol_type}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">
                  Port
                </p>
                <p className="font-mono text-xs">{fullData.comport}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">
                  Address
                </p>
                <Badge variant="outline">{fullData.modbus_address}</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">
                  Serial No.
                </p>
                <p className="font-mono">
                  {batteryData.serial_number || "N/A"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">
                  Firmware
                </p>
                <p className="font-mono text-xs">
                  v{batteryData.program_version} / d{batteryData.data_version}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ==================== PRIMARY METRICS (Hero Section) ==================== */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* SOC - Most Important */}
          <Card className="border-2 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                    <Gauge className="h-4 w-4" />
                    State of Charge
                  </span>
                </div>
                <div
                  className={`text-4xl font-bold tracking-tight ${
                    toNumber(batteryData.soc) >= 80
                      ? "text-green-600 dark:text-green-400"
                      : toNumber(batteryData.soc) >= 50
                      ? "text-blue-600 dark:text-blue-400"
                      : toNumber(batteryData.soc) >= 20
                      ? "text-orange-600 dark:text-orange-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {formatDecimal(batteryData.soc, 1)}%
                </div>
                <Progress value={toNumber(batteryData.soc)} className="h-3" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatDecimal(batteryData.rc, 2)} Ah</span>
                  <span>of {formatDecimal(batteryData.fcc, 2)} Ah</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Voltage */}
          <Card className="border-2 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Pack Voltage
                  </span>
                </div>
                <div className="text-4xl font-bold tracking-tight">
                  {formatDecimal(batteryData.voltage, 2)}V
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Charge limit:</span>
                    <span className="font-semibold">
                      {formatDecimal(batteryData.charging_voltage, 1)}V
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Cutoff:</span>
                    <span className="font-semibold">
                      {formatDecimal(batteryData.end_of_discharge_voltage, 1)}V
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current & Power */}
          <Card className="border-2 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Current Flow
                  </span>
                </div>
                <div className="text-4xl font-bold tracking-tight">
                  {formatDecimal(batteryData.current, 2)}A
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Power:</span>
                    <span className="font-semibold">
                      {Math.abs(powerWatts).toFixed(1)}W
                    </span>
                  </div>
                  <Badge
                    variant={batteryData.current === 0 ? "outline" : "default"}
                    className="w-full justify-center"
                  >
                    {batteryData.current === 0
                      ? "Idle"
                      : (batteryData.current || 0) > 0
                      ? "Charging"
                      : "Discharging"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SOH */}
          <Card className="border-2 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    State of Health
                  </span>
                </div>
                <div
                  className={`text-4xl font-bold tracking-tight ${
                    toNumber(batteryData.soh) >= 90
                      ? "text-green-600 dark:text-green-400"
                      : toNumber(batteryData.soh) >= 80
                      ? "text-yellow-600 dark:text-yellow-400"
                      : "text-orange-600 dark:text-orange-400"
                  }`}
                >
                  {formatDecimal(batteryData.soh, 1)}%
                </div>
                <Progress value={toNumber(batteryData.soh)} className="h-3" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Cycles:</span>
                  <span className="font-semibold">
                    {batteryData.cycle_count}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ==================== CELL VOLTAGES (Enhanced Visualization) ==================== */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Cell Voltage Distribution (13S)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Cell Stats Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-xs text-green-700 dark:text-green-300 font-medium mb-1">
                  Highest Cell
                </p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {formatDecimal(batteryData.max_cell_voltage, 3)}V
                </p>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 p-4 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-xs text-red-700 dark:text-red-300 font-medium mb-1">
                  Lowest Cell
                </p>
                <p className="text-2xl font-bold text-red-900 dark:text-red-100">
                  {formatDecimal(batteryData.min_cell_voltage, 3)}V
                </p>
              </div>
              <div
                className={`p-4 rounded-lg border-2 ${
                  cellDelta > 0.1
                    ? "bg-red-50 dark:bg-red-950 border-red-500"
                    : cellDelta > 0.05
                    ? "bg-yellow-50 dark:bg-yellow-950 border-yellow-500"
                    : "bg-green-50 dark:bg-green-950 border-green-500"
                }`}
              >
                <p className="text-xs font-medium mb-1">Cell Delta</p>
                <p
                  className={`text-2xl font-bold ${
                    cellDelta > 0.1
                      ? "text-red-900 dark:text-red-100"
                      : cellDelta > 0.05
                      ? "text-yellow-900 dark:text-yellow-100"
                      : "text-green-900 dark:text-green-100"
                  }`}
                >
                  {Math.round(cellDelta * 1000)}mV
                </p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-1">
                  Average Cell
                </p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {formatDecimal(avgCellVoltage, 3)}V
                </p>
              </div>
            </div>

            {/* Individual Cells Grid */}
            <div className="grid grid-cols-7 md:grid-cols-13 gap-2">
              {cellVoltages.map((voltage, index) => {
                const isMax = voltage === toNumber(batteryData.max_cell_voltage);
                const isMin = voltage === toNumber(batteryData.min_cell_voltage);
                const deviation = Math.abs(voltage - avgCellVoltage);

                return (
                  <TooltipProvider key={index}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={`relative p-3 rounded-lg border-2 cursor-help transition-all hover:scale-105 ${
                            isMax
                              ? "border-green-500 bg-green-100 dark:bg-green-900 shadow-lg"
                              : isMin
                              ? "border-red-500 bg-red-100 dark:bg-red-900 shadow-lg"
                              : deviation > 0.02
                              ? "border-yellow-400 bg-yellow-50 dark:bg-yellow-950"
                              : "border-gray-300 dark:border-gray-700 bg-card hover:bg-accent"
                          }`}
                        >
                          {isMax && (
                            <div className="absolute -top-2 -right-2 bg-green-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                              ↑
                            </div>
                          )}
                          {isMin && (
                            <div className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                              ↓
                            </div>
                          )}
                          <div className="text-center space-y-1">
                            <div className="text-xs font-bold text-muted-foreground">
                              {index + 1}
                            </div>
                            <div className="font-bold text-sm">
                              {formatDecimal(voltage, 3)}
                            </div>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="font-mono">
                        <div className="space-y-1">
                          <p className="font-bold">Cell {index + 1}</p>
                          <p>{formatDecimal(voltage, 3)}V</p>
                          <p className="text-xs text-muted-foreground">
                            Δ {voltage - avgCellVoltage > 0 ? "+" : ""}
                            {formatDecimal((voltage - avgCellVoltage) * 1000, 1)}mV
                            from avg
                          </p>
                          {isMax && (
                            <p className="text-green-600 font-bold text-xs">
                              HIGHEST
                            </p>
                          )}
                          {isMin && (
                            <p className="text-red-600 font-bold text-xs">
                              LOWEST
                            </p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ==================== TEMPERATURE MONITORING ==================== */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Thermometer className="h-5 w-5" />
              Temperature Sensors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div
                className={`p-4 rounded-lg border-2 text-center ${
                  toNumber(batteryData.max_cell_temperature) > 50
                    ? "border-red-500 bg-red-50 dark:bg-red-950"
                    : toNumber(batteryData.max_cell_temperature) > 40
                    ? "border-orange-500 bg-orange-50 dark:bg-orange-950"
                    : "border-green-500 bg-green-50 dark:bg-green-950"
                }`}
              >
                <p className="text-xs font-medium mb-2">Max Cell</p>
                <p
                  className={`text-3xl font-bold ${
                    toNumber(batteryData.max_cell_temperature) > 50
                      ? "text-red-600"
                      : toNumber(batteryData.max_cell_temperature) > 40
                      ? "text-orange-600"
                      : "text-green-600"
                  }`}
                >
                  {formatDecimal(batteryData.max_cell_temperature, 1)}°
                </p>
              </div>
              <div className="p-4 rounded-lg border-2 border-blue-200 bg-blue-50 dark:bg-blue-950 text-center">
                <p className="text-xs font-medium mb-2">Min Cell</p>
                <p className="text-3xl font-bold text-blue-600">
                  {formatDecimal(batteryData.min_cell_temperature, 1)}°
                </p>
              </div>
              <div className="p-4 rounded-lg border-2 border-purple-200 bg-purple-50 dark:bg-purple-950 text-center">
                <p className="text-xs font-medium mb-2">FET</p>
                <p className="text-3xl font-bold text-purple-600">
                  {formatDecimal(batteryData.fet_temperature, 1)}°
                </p>
              </div>
              <div className="p-4 rounded-lg border-2 border-indigo-200 bg-indigo-50 dark:bg-indigo-950 text-center">
                <p className="text-xs font-medium mb-2">Max FET</p>
                <p className="text-3xl font-bold text-indigo-600">
                  {formatDecimal(batteryData.max_fet_temperature, 1)}°
                </p>
              </div>
              <div className="p-4 rounded-lg border-2 border-cyan-200 bg-cyan-50 dark:bg-cyan-950 text-center">
                <p className="text-xs font-medium mb-2">PCB</p>
                <p className="text-3xl font-bold text-cyan-600">
                  {formatDecimal(batteryData.pcb_temperature, 1)}°
                </p>
              </div>
            </div>

            {/* Cell Temperature Details */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="p-3 border rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">
                    Cell Sensor {i}
                  </p>
                  <p className="text-xl font-bold">
                    {formatDecimal(batteryData[
                      `battery_cell_temp_${i}` as keyof PanasonicBatteryData
                    ] as number | string | undefined, 1)}
                    °C
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ==================== BMS STATUS FLAGS ==================== */}
        <Card>
          <CardHeader>
            <CardTitle>BMS Protection Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: "Status",
                  value: batteryData.status,
                  icon: Info,
                  okColor: "green",
                },
                {
                  label: "Warning",
                  value: batteryData.warning,
                  icon: AlertTriangle,
                  okColor: "yellow",
                },
                {
                  label: "Alarm",
                  value: batteryData.alarm,
                  icon: XCircle,
                  okColor: "orange",
                },
                {
                  label: "Error",
                  value: batteryData.error,
                  icon: XCircle,
                  okColor: "red",
                },
              ].map((item) => {
                const isOk =
                  !item.value || item.value === "" || item.value === "Normal";
                const Icon = isOk ? CheckCircle2 : item.icon;

                return (
                  <div
                    key={item.label}
                    className={`p-4 rounded-lg border-2 ${
                      isOk
                        ? "border-green-200 bg-green-50 dark:bg-green-950"
                        : `border-${item.okColor}-500 bg-${item.okColor}-50 dark:bg-${item.okColor}-950`
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold">
                        {item.label}
                      </span>
                      <Icon
                        className={`h-5 w-5 ${
                          isOk ? "text-green-600" : `text-${item.okColor}-600`
                        }`}
                      />
                    </div>
                    <Badge
                      variant={isOk ? "outline" : "default"}
                      className={`w-full justify-center text-xs ${
                        !isOk ? `bg-${item.okColor}-600` : ""
                      }`}
                    >
                      {isOk
                        ? "Normal"
                        : item.value?.substring(0, 20) || "Active"}
                    </Badge>
                  </div>
                );
              })}
            </div>

            {/* Detailed Messages if Active */}
            {(batteryData.warning !== "" ||
              batteryData.alarm !== "" ||
              batteryData.error !== "") && (
              <div className="mt-4 space-y-2">
                {batteryData.warning !== "" && (
                  <Alert className="border-l-4 border-l-yellow-500">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="text-yellow-800 dark:text-yellow-200">
                      Warning Details
                    </AlertTitle>
                    <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                      {batteryData.warning}
                    </AlertDescription>
                  </Alert>
                )}
                {batteryData.alarm !== "" && (
                  <Alert className="border-l-4 border-l-orange-500">
                    <XCircle className="h-4 w-4" />
                    <AlertTitle className="text-orange-800 dark:text-orange-200">
                      Alarm Details
                    </AlertTitle>
                    <AlertDescription className="text-orange-700 dark:text-orange-300">
                      {batteryData.alarm}
                    </AlertDescription>
                  </Alert>
                )}
                {batteryData.error !== "" && (
                  <Alert
                    variant="destructive"
                    className="border-l-4 border-l-red-600"
                  >
                    <XCircle className="h-4 w-4" />
                    <AlertTitle>Error Details</AlertTitle>
                    <AlertDescription>{batteryData.error}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ==================== OPERATION MODES & LIMITS ==================== */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Charge Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Operation Mode</span>
                <Badge
                  className={`${
                    batteryData.charge_operation_mode === "ENABLE"
                      ? "bg-green-600"
                      : batteryData.charge_operation_mode === "DISABLE"
                      ? "bg-gray-600"
                      : "bg-red-600"
                  }`}
                >
                  {batteryData.charge_operation_mode}
                </Badge>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between p-2 bg-muted rounded">
                  <span className="text-muted-foreground">
                    Constant Voltage:
                  </span>
                  <span className="font-semibold">
                    {formatDecimal(batteryData.charging_voltage, 1)}V
                  </span>
                </div>
                <div className="flex justify-between p-2 bg-muted rounded">
                  <span className="text-muted-foreground">
                    Constant Current:
                  </span>
                  <span className="font-semibold">
                    {formatDecimal(batteryData.charging_current, 1)}A
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Discharge Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Operation Mode</span>
                <Badge
                  className={`${
                    batteryData.discharge_operation_mode === "ENABLE"
                      ? "bg-green-600"
                      : batteryData.discharge_operation_mode === "DISABLE"
                      ? "bg-gray-600"
                      : "bg-red-600"
                  }`}
                >
                  {batteryData.discharge_operation_mode}
                </Badge>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between p-2 bg-muted rounded">
                  <span className="text-muted-foreground">Current Limit:</span>
                  <span className="font-semibold">
                    {formatDecimal(batteryData.discharge_current_limit, 1)}A
                  </span>
                </div>
                <div className="flex justify-between p-2 bg-muted rounded">
                  <span className="text-muted-foreground">End Voltage:</span>
                  <span className="font-semibold">
                    {formatDecimal(batteryData.end_of_discharge_voltage, 1)}V
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ==================== CAPACITY INFO ==================== */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Capacity Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Design Capacity</p>
                <p className="text-2xl font-bold">
                  {formatDecimal(batteryData.dc, 2)}
                </p>
                <p className="text-xs text-muted-foreground">Ah (nominal)</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  Full Charge Cap.
                </p>
                <p className="text-2xl font-bold">
                  {formatDecimal(batteryData.fcc, 2)}
                </p>
                <p className="text-xs text-muted-foreground">Ah (actual)</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Remaining Cap.</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatDecimal(batteryData.rc, 2)}
                </p>
                <p className="text-xs text-muted-foreground">Ah (current)</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Cycle Count</p>
                <p className="text-2xl font-bold text-purple-600">
                  {batteryData.cycle_count || "N/A"}
                </p>
                <p className="text-xs text-muted-foreground">charge cycles</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ==================== METADATA FOOTER ==================== */}
        <Card className="bg-muted/50">
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-muted-foreground">
              <div>
                <span className="font-medium">Manufacture Date:</span>{" "}
                {batteryData.manufacture_date || "N/A"}
              </div>
              <div>
                <span className="font-medium">Barcode:</span>{" "}
                {batteryData.barcode?.trim() || "N/A"}
              </div>
              <div>
                <span className="font-medium">FW Update:</span>{" "}
                {batteryData.fw_update_status === 0
                  ? "Not Required"
                  : "Available"}
              </div>
              <div>
                <span className="font-medium">Polling Duration:</span>{" "}
                {batteryData.PollingDuration || "N/A"}ms
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  } catch (error) {
    console.error("Error parsing Panasonic battery data:", error);
    return (
      <Alert variant="destructive" className="m-4">
        <AlertTriangle className="h-5 w-5" />
        <AlertTitle className="font-bold">Data Parse Error</AlertTitle>
        <AlertDescription>
          <p className="mb-2">
            Failed to parse battery data from MQTT payload.
          </p>
          <details className="text-xs mt-2 p-2 bg-destructive/10 rounded">
            <summary className="cursor-pointer font-semibold">
              Error Details
            </summary>
            <pre className="mt-2 overflow-auto">
              {error instanceof Error ? error.message : String(error)}
            </pre>
          </details>
        </AlertDescription>
      </Alert>
    );
  }
}
