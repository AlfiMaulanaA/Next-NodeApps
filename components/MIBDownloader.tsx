"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Download,
  FileText,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  RefreshCw,
  FileDown,
} from "lucide-react";
import { toast } from "sonner";

interface MIBDownloadStatus {
  status: "idle" | "downloading" | "success" | "error";
  message?: string;
  fileName?: string;
  fileSize?: string;
  timestamp?: string;
}

export function MIBDownloader() {
  const [downloadStatus, setDownloadStatus] = useState<MIBDownloadStatus>({
    status: "idle",
  });

  // Handle MIB File Download
  const handleDownloadMIB = async () => {
    try {
      setDownloadStatus({
        status: "downloading",
        message: "Initiating MIB file download...",
      });

      toast.loading("Preparing MIB file download...", {
        id: "mib-download",
        duration: 2000,
      });

      // Check if file exists first
      const response = await fetch("/files/GSPE_SHOTO_MIB_v1_1.mib", {
        method: "HEAD",
      });

      if (!response.ok) {
        throw new Error(
          `File not found: GSPE_SHOTO_MIB_v1_1.mib (${response.status})`
        );
      }

      // Get file size from headers
      const contentLength = response.headers.get("content-length");
      const fileSize = contentLength
        ? `${Math.round(parseInt(contentLength) / 1024)} KB`
        : "Unknown size";

      // Create download link
      const link = document.createElement("a");
      link.href = "/files/GSPE_SHOTO_MIB_v1_1.mib";
      link.download = "GSPE_SHOTO_MIB_v1_1.mib";
      link.style.display = "none";

      // Add to DOM, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Set success status
      setDownloadStatus({
        status: "success",
        message: "GSPE_SHOTO_MIB_v1_1.mib MIB file downloaded successfully",
        fileName: "GSPE_SHOTO_MIB_v1_1.mib",
        fileSize: fileSize,
        timestamp: new Date().toLocaleString(),
      });

      // Dismiss loading toast and show success
      toast.dismiss("mib-download");
      toast.success("SHOTO MIB file downloaded successfully!", {
        duration: 4000,
        position: "top-right",
      });
    } catch (error) {
      console.error("Error downloading MIB file:", error);

      const errorMessage =
        error instanceof Error ? error.message : "Failed to download MIB file";

      setDownloadStatus({
        status: "error",
        message: errorMessage,
        timestamp: new Date().toLocaleString(),
      });

      toast.dismiss("mib-download");
      toast.error(`Download Error: ${errorMessage}`, {
        duration: 5000,
        position: "top-right",
      });
    }
  };

  // Reset download status
  const resetStatus = () => {
    setDownloadStatus({ status: "idle" });
  };

  // Get status icon and color
  const getStatusDisplay = () => {
    switch (downloadStatus.status) {
      case "downloading":
        return {
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          color: "bg-blue-100 text-blue-800",
          label: "Downloading",
        };
      case "success":
        return {
          icon: <CheckCircle className="h-4 w-4" />,
          color: "bg-green-100 text-green-800",
          label: "Success",
        };
      case "error":
        return {
          icon: <XCircle className="h-4 w-4" />,
          color: "bg-red-100 text-red-800",
          label: "Error",
        };
      default:
        return {
          icon: <FileText className="h-4 w-4" />,
          color: "bg-gray-100 text-gray-800",
          label: "Ready",
        };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <FileDown className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <CardTitle className="text-lg">SNMP MIB Downloader</CardTitle>
              <CardDescription>
                Download SHOTO Management Information Base (MIB) file for SNMP
                configuration
              </CardDescription>
            </div>
          </div>
          <Badge className={statusDisplay.color}>
            {statusDisplay.icon}
            <span className="ml-1">{statusDisplay.label}</span>
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* File Information */}
        <Alert className="border-blue-200 bg-blue-50">
          <FileText className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <p>
                <strong>File:</strong> GSPE_SHOTO_MIB_v1_1.mib
              </p>
              <p>
                <strong>Location:</strong> /public/files/GSPE_SHOTO_MIB_v1_1.mib
              </p>
              <p>
                <strong>Description:</strong> SHOTO device MIB definitions for
                SNMP monitoring
              </p>
            </div>
          </AlertDescription>
        </Alert>

        {/* Download Status */}
        {downloadStatus.status !== "idle" && (
          <Alert
            className={
              downloadStatus.status === "success"
                ? "border-green-200 bg-green-50"
                : downloadStatus.status === "error"
                ? "border-red-200 bg-red-50"
                : "border-blue-200 bg-blue-50"
            }
          >
            <div className="flex items-start gap-3">
              {statusDisplay.icon}
              <div className="flex-1">
                <p className="font-medium">{downloadStatus.message}</p>
                {downloadStatus.fileName && (
                  <p className="text-sm text-muted-foreground">
                    File: {downloadStatus.fileName}
                  </p>
                )}
                {downloadStatus.fileSize && (
                  <p className="text-sm text-muted-foreground">
                    Size: {downloadStatus.fileSize}
                  </p>
                )}
                {downloadStatus.timestamp && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {downloadStatus.timestamp}
                  </p>
                )}
              </div>
            </div>
          </Alert>
        )}

        {/* Download Actions */}
        <div className="flex gap-3">
          <Button
            onClick={handleDownloadMIB}
            disabled={downloadStatus.status === "downloading"}
            className="flex-1"
          >
            {downloadStatus.status === "downloading" ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Download SHOTO MIB File
              </>
            )}
          </Button>

          {downloadStatus.status === "success" && (
            <Button variant="outline" onClick={handleDownloadMIB}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Re-download
            </Button>
          )}

          {downloadStatus.status !== "idle" && (
            <Button variant="outline" onClick={resetStatus} size="icon">
              <XCircle className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Technical Info */}
        <div className="pt-4 border-t text-sm text-muted-foreground space-y-1">
          <p>
            <strong>Download Method:</strong> Direct file access
          </p>
          <p>
            <strong>File Format:</strong> MIB (Management Information Base)
          </p>
          <p>
            <strong>Compatible with:</strong> SNMP v1, v2c, v3
          </p>
          <p>
            <strong>Usage:</strong> Import into SNMP management tools
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
