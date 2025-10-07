"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useMQTT } from "@/hooks/useMQTT";
import { Clock, RefreshCw, Wifi, Monitor, Globe, Computer, Calendar, Settings } from "lucide-react";

// RTC DS3231 Configuration
const RTC_CONFIG = {
  bus: 2,
  address: 0x68
};

export default function RTCSyncPage() {
  const { publishMessage, connectionStatus, isOnline } = useMQTT();

  const [rtcStatus, setRTCStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [localTime, setLocalTime] = useState(new Date());
  const [rtcTime, setRTCTime] = useState<Date | null>(null);
  const [timezones] = useState(['WIB', 'WITA', 'WIT']);
  const [selectedTimezone, setSelectedTimezone] = useState('WIB');

  // Simulate getting RTC time (in real app, this would come via MQTT)
  const fetchRTCTime = async () => {
    // Mock RTC time - in real implementation, subscribe to RTC response topic
    setRTCTime(new Date(Date.now() - 30000)); // Mock: 30 seconds behind
  };

  // Sync with Internet Time
  const syncWithInternetTime = async () => {
    setRTCStatus('syncing');

    try {
      const currentTime = new Date();
      const unixtime = Math.floor(currentTime.getTime() / 1000);

      const message = {
        command: "rtc_sync",
        source: "internet",
        timestamp: unixtime,
        timezone: selectedTimezone,
        config: RTC_CONFIG
      };

      const success = publishMessage("rtc/sync", message, { qos: 1 });

      if (success) {
        setRTCStatus('success');
        setRTCTime(currentTime);
        toast.success(`RTC sync with ${selectedTimezone} timezone sent via MQTT!`);
      } else {
        throw new Error("Failed to publish MQTT message");
      }
    } catch (error) {
      setRTCStatus('error');
      toast.error("Failed to sync RTC: " + (error as Error).message);
    } finally {
      setTimeout(() => setRTCStatus('idle'), 3000);
    }
  };

  // Sync with Local Time
  const syncWithLocalTime = async () => {
    setRTCStatus('syncing');

    try {
      const currentTime = new Date();
      const unixtime = Math.floor(currentTime.getTime() / 1000);

      const message = {
        command: "rtc_sync",
        source: "local",
        timestamp: unixtime,
        timezone: selectedTimezone,
        config: RTC_CONFIG
      };

      const success = publishMessage("rtc/sync", message, { qos: 1 });

      if (success) {
        setRTCStatus('success');
        setRTCTime(currentTime);
        toast.success(`RTC local sync with ${selectedTimezone} timezone sent via MQTT!`);
      } else {
        throw new Error("Failed to publish MQTT message");
      }
    } catch (error) {
      setRTCStatus('error');
      toast.error("Failed to sync RTC with local time: " + (error as Error).message);
    } finally {
      setTimeout(() => setRTCStatus('idle'), 3000);
    }
  };

  return (
    <SidebarInset>
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Clock className="h-5 w-5" />
          <h1 className="text-lg font-semibold">RTC DS3231 Synchronization</h1>
        </div>
      </header>

      <div className="p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Clock className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">RTC DS3231 Synchronization</h1>
        </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            MQTT Status
          </CardTitle>
          <CardDescription>MQTT connection status for RTC commands</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Badge variant={isOnline ? "default" : "destructive"}>
              {connectionStatus}
            </Badge>
            {!isOnline && (
              <span className="text-sm text-muted-foreground">
                Ensure MQTT broker is running for RTC commands.
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* RTC Configuration & Timezone */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              RTC Configuration
            </CardTitle>
            <CardDescription>DS3231 module settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label>I2C Bus</Label>
                <p className="text-lg font-mono">{RTC_CONFIG.bus}</p>
              </div>
              <div>
                <Label>Address</Label>
                <p className="text-lg font-mono">0x{RTC_CONFIG.address.toString(16)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Timezone Settings
            </CardTitle>
            <CardDescription>Select Indonesian timezone for time synchronization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="timezone-select">Current Timezone</Label>
                <Select value={selectedTimezone} onValueChange={setSelectedTimezone}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WIB">
                      <div className="flex items-center gap-2">
                        <span>WIB</span>
                        <span className="text-sm text-muted-foreground">(UTC+7)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="WITA">
                      <div className="flex items-center gap-2">
                        <span>WITA</span>
                        <span className="text-sm text-muted-foreground">(UTC+8)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="WIT">
                      <div className="flex items-center gap-2">
                        <span>WIT</span>
                        <span className="text-sm text-muted-foreground">(UTC+9)</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">
                Timezone will be included in sync commands sent to the middleware.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Time Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Local System Time</CardTitle>
            <CardDescription>Current time from the system</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-mono">
              {localTime.toLocaleString()}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocalTime(new Date())}
              className="mt-2"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Local Time
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>RTC Time</CardTitle>
            <CardDescription>Current time from DS3231 module</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-mono">
              {rtcTime ? rtcTime.toLocaleString() : "Not synced"}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchRTCTime}
              className="mt-2"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Fetch RTC Time
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Sync Controls */}
      <Card>
        <CardHeader>
          <CardTitle>RTC Synchronization</CardTitle>
          <CardDescription>Sync RTC module with time sources</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={syncWithInternetTime}
              disabled={rtcStatus === 'syncing' || !isOnline}
              className="flex-1"
            >
              {rtcStatus === 'syncing' ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Syncing with Internet...
                </>
              ) : (
                <>
                  <Globe className="h-4 w-4 mr-2" />
                  Sync with Internet Time
                </>
              )}
            </Button>

            <Button
              onClick={syncWithLocalTime}
              disabled={rtcStatus === 'syncing' || !isOnline}
              className="flex-1"
              variant="outline"
            >
              {rtcStatus === 'syncing' ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Syncing with Local...
                </>
              ) : (
                <>
                  <Computer className="h-4 w-4 mr-2" />
                  Sync with Local Time
                </>
              )}
            </Button>
          </div>

          <div className="text-sm text-muted-foreground">
            Note: In real implementation, the user would need to ensure internet connectivity for internet time sync,
            and the middleware would handle the actual I2C communication to set the DS3231 time.
          </div>
        </CardContent>
      </Card>
      </div>
    </SidebarInset>
  );
}
