"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, RefreshCw, AlertCircle, CheckCircle, Download, History, Settings } from 'lucide-react';
import { useMQTT } from '@/hooks/useMQTT';
import { toast } from 'sonner';
import MQTTConnectionBadge from '@/components/mqtt-status';
import {
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface UpdateStatus {
  status: 'idle' | 'validating' | 'uploading' | 'extracting' | 'success' | 'error';
  progress: number;
  message: string;
  version?: string;
}

interface BackupVersion {
  id: string;
  timestamp: string;
  description: string;
  size_mb: number | string;
  status: string;
}

interface SystemStatus {
  current_version: string;
  ui_root_path: string;
  backup_count: number;
  config_valid: boolean;
  last_update: string | null;
  service_uptime: number;
}

export default function UiUpdatePage() {
  const { publishMessage, addMessageHandler, isConnected, isOnline, connectionStatus } = useMQTT({
    topics: ["status/ui-update/progress", "response/ui-update", "response/ui-status", "response/ui-history"],
    autoSubscribe: true,
    enableLogging: true,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // States
  const [file, setFile] = useState<File | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    status: 'idle',
    progress: 0,
    message: ''
  });
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [backupVersions, setBackupVersions] = useState<BackupVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [updateStartTime, setUpdateStartTime] = useState<Date | null>(null);
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(null);

  // MQTT message handlers
  const handleStatusUpdate = useCallback((topic: string, message: Buffer) => {
    try {
      const data = JSON.parse(message.toString());
      if (topic === 'status/ui-update/progress') {
        const now = new Date();
        const progress = data.progress || 0;

        // Track start time when progress begins
        if (progress > 0 && !updateStartTime) {
          setUpdateStartTime(now);
        }

        // Calculate estimated remaining time
        if (updateStartTime && progress > 0) {
          const elapsed = now.getTime() - updateStartTime.getTime();
          const totalEstimated = elapsed / (progress / 100);
          const remaining = totalEstimated - elapsed;
          setEstimatedDuration(remaining);
        }

        // Reset on completion or error
        if (data.type === 'completed' || !data.success) {
          setUpdateStartTime(null);
          setEstimatedDuration(null);
        }

        setUpdateStatus({
          status: data.type === 'completed' ? 'success' :
                  data.type === 'validating' ? 'validating' :
                  data.type === 'backup' ? 'uploading' :
                  data.type === 'extracting' ? 'extracting' : 'idle',
          progress: progress,
          message: getStatusMessage(data.type),
          version: data.version
        });
      }
    } catch (e) {
      console.error('Error parsing status update:', e);
    }
  }, [updateStartTime]);

  const handleResponse = useCallback((topic: string, message: Buffer) => {
    try {
      const data = JSON.parse(message.toString());
      if (topic === 'response/ui-update') {
        if (data.status === 'success') {
          setUpdateStatus(prev => ({ ...prev, status: 'success', message: data.message, version: data.version }));
          toast.success('UI updated successfully!');
          // Refresh status after successful update
          requestSystemStatus();
        } else {
          setUpdateStatus(prev => ({ ...prev, status: 'error', message: data.message }));
          toast.error(`Update failed: ${data.message}`);
        }
      } else if (topic === 'response/ui-status') {
        setSystemStatus(data);
      } else if (topic === 'response/ui-history') {
        setBackupVersions(data.backup_versions || []);
      }
    } catch (e) {
      console.error('Error parsing response:', e);
    }
  }, []);

  useEffect(() => {
    // Setup message handlers only if online
    if (isOnline) {
      addMessageHandler('status/ui-update/progress', handleStatusUpdate);
      addMessageHandler('response/ui-update', handleResponse);
      addMessageHandler('response/ui-status', handleResponse);
      addMessageHandler('response/ui-history', handleResponse);

      // Request initial status
      requestSystemStatus();
    }
  }, [addMessageHandler, isOnline, handleStatusUpdate, handleResponse]);

  const getStatusMessage = (statusType: string): string => {
    const messages = {
      validating: 'Validating file...',
      backup: 'Creating backup...',
      extracting: 'Extracting files...',
      completed: 'Update completed successfully!',
      online: 'Service online'
    };
    return messages[statusType as keyof typeof messages] || statusType;
  };

  const requestSystemStatus = () => {
    if (isConnected) {
      publishMessage('command/ui-status', { command: 'get_status' });
      publishMessage('command/ui-history', { command: 'get_history' });
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setUpdateStatus({ status: 'idle', progress: 0, message: '' });
    }
  };

  const handleUpload = async () => {
    if (!file || !isConnected) {
      toast.error('No file selected or MQTT not connected');
      return;
    }

    setUpdateStatus({ status: 'uploading', progress: 0, message: 'Reading file...' });

    try {
      // Read file as base64
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result?.toString().split(',')[1];
          if (base64) resolve(base64);
          else reject(new Error('Failed to read file'));
        };
        reader.readAsDataURL(file);
      });

      setUpdateStatus(prev => ({ ...prev, progress: 10 }));

      // Send via MQTT
      publishMessage('command/ui-update', {
        command: 'upload',
        content: content,
        filename: file.name,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      setUpdateStatus({
        status: 'error',
        progress: 0,
        message: `Upload failed: ${error}`
      });
      toast.error(`Upload failed: ${error}`);
    }
  };

  const handleRollback = (versionId: string) => {
    if (!isConnected) {
      toast.error('MQTT not connected');
      return;
    }

    publishMessage('command/ui-rollback', {
      command: 'rollback',
      version_id: versionId
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('id-ID');
  };

  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink href="/settings/setting">
                Settings
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbPage>UI Update Manager</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="space-y-6">
          <div className="flex items-center space-x-2">
            <Upload className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">UI Update Manager</h1>
              <p className="text-muted-foreground">Over-the-air UI updates for IoT interface</p>
            </div>
          </div>

      <Tabs defaultValue="upload" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload">Upload & Update</TabsTrigger>
          <TabsTrigger value="status">System Status</TabsTrigger>
          <TabsTrigger value="history">Backup History</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Upload className="h-5 w-5" />
                <span>Upload New UI</span>
              </CardTitle>
              <CardDescription>
                Upload a .zip file containing your web application build (usually from npm run build)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                file
                  ? 'border-green-300 bg-green-50 dark:bg-green-950/20'
                  : 'border-gray-300 hover:border-gray-400'
              }`}>
                <input
                  type="file"
                  accept=".zip"
                  onChange={handleFileSelect}
                  ref={fileInputRef}
                  className="hidden"
                />
                {file ? (
                  <>
                    <div className="flex items-center justify-center mb-2">
                      <div className="p-2 bg-green-100 dark:bg-green-900 rounded-full">
                        <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm font-medium text-green-800 dark:text-green-200">
                          File Selected
                        </p>
                        <p className="text-sm text-green-600 dark:text-green-400 font-mono">
                          {file.name}
                        </p>
                        <p className="text-xs text-green-500 dark:text-green-500">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                      <div className="flex gap-2 justify-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={updateStatus.status === 'uploading'}
                          className="border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-300 dark:hover:bg-green-950"
                        >
                          Change File
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setFile(null);
                            setUpdateStatus({ status: 'idle', progress: 0, message: '' });
                          }}
                          disabled={updateStatus.status === 'uploading'}
                          className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="mt-4">
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={updateStatus.status === 'uploading'}
                      >
                        Choose .zip file
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2">
                        Select a zip file containing your web application build
                      </p>
                    </div>
                  </>
                )}
              </div>

              {(updateStatus.status !== 'idle') && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Progress value={updateStatus.progress} className="w-full flex-1 mr-4" />
                    <span className="text-sm font-medium text-muted-foreground">
                      {Math.round(updateStatus.progress)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    {updateStatus.status === 'uploading' && <RefreshCw className="h-4 w-4 animate-spin" />}
                    {updateStatus.status === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                    {updateStatus.status === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}
                    <span className="text-sm">{updateStatus.message}</span>
                  </div>

                  {/* Time Estimation */}
                  {updateStatus.status === 'uploading' && updateStartTime && estimatedDuration && (
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">
                        Estimated time remaining: ~
                        {estimatedDuration > 60000 ? `${Math.round(estimatedDuration / 60000)}m` :
                          estimatedDuration > 1000 ? `${Math.round(estimatedDuration / 1000)}s` : 'a few seconds'}
                      </p>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 mt-2">
                        <div
                          className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(100, (updateStatus.progress / 100) * 100)}%`
                          }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Button
                onClick={handleUpload}
                disabled={!file || updateStatus.status === 'uploading'}
                className="w-full"
                size="lg"
              >
                {updateStatus.status === 'uploading' ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Updating UI...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload & Update UI
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>System Status</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {systemStatus ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Current Version:</span>
                      <Badge variant="secondary">{systemStatus.current_version}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">UI Path:</span>
                      <span className="text-sm text-muted-foreground">{systemStatus.ui_root_path}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Available Backups:</span>
                      <span className="text-sm">{systemStatus.backup_count}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Configuration Valid:</span>
                      <Badge variant={systemStatus.config_valid ? "default" : "destructive"}>
                        {systemStatus.config_valid ? "Valid" : "Invalid"}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Last Update:</span>
                      <span className="text-sm text-muted-foreground">
                        {systemStatus.last_update ? formatDate(systemStatus.last_update) : "Never"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Service Uptime:</span>
                      <span className="text-sm">{Math.floor(systemStatus.service_uptime / 60)}m</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <RefreshCw className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">Loading system status...</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <History className="h-5 w-5" />
                <span>Backup History</span>
              </CardTitle>
              <CardDescription>Previous UI versions available for rollback</CardDescription>
            </CardHeader>
            <CardContent>
              {backupVersions.length > 0 ? (
                <div className="space-y-2">
                  {backupVersions.map((version, index) => (
                    <div key={version.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{version.id}</span>
                          <Badge variant="outline">{version.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatDate(version.timestamp)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {version.description}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-muted-foreground">
                          {typeof version.size_mb === 'number' ? `${version.size_mb} MB` : version.size_mb}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRollback(version.id)}
                          disabled={!isConnected}
                        >
                          Rollback
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <History className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">No backup history available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Connection Status */}
      <div className="fixed bottom-4 right-4">
        <MQTTConnectionBadge />
      </div>
        </div>
      </div>
    </SidebarInset>
  );
}
