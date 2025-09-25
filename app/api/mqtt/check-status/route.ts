import { NextRequest, NextResponse } from "next/server";
import DatabaseService from "@/lib/database";
import mqtt from "mqtt";

// POST /api/mqtt/check-status - Check all MQTT configurations status
export async function POST(request: NextRequest) {
  try {
    const db = DatabaseService.getInstance();
    const configurations = db.getAllMQTTConfigurations();

    if (configurations.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No MQTT configurations found",
        data: [],
      });
    }

    // Test each configuration
    const checkPromises = configurations.map(async (config) => {
      try {
        const result = await testMQTTConnection(config);

        // Update connection status in database
        const updatedStatus = result.success ? "connected" : "error";
        const errorMessage = result.success ? undefined : result.message;

        db.updateMQTTConnectionStatus(
          config.id,
          updatedStatus,
          errorMessage
        );

        return {
          id: config.id,
          name: config.name,
          status: updatedStatus,
          error: errorMessage,
          latency: result.latency,
        };
      } catch (error) {
        db.updateMQTTConnectionStatus(
          config.id,
          "error",
          error instanceof Error ? error.message : "Unknown error"
        );

        return {
          id: config.id,
          name: config.name,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    });

    const results = await Promise.allSettled(checkPromises);
    const statusResults = results.map((result, index) => {
      if (result.status === "fulfilled") {
        return result.value;
      } else {
        const config = configurations[index];
        return {
          id: config.id,
          name: config.name,
          status: "error",
          error: "Failed to test connection",
        };
      }
    });

    return NextResponse.json({
      success: true,
      message: `Checked ${configurations.length} MQTT configurations`,
      data: statusResults,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error checking MQTT status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper function to test MQTT connection
async function testMQTTConnection(config: any): Promise<{
  success: boolean;
  message: string;
  latency?: number;
}> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let resolved = false;

    // For WebSocket connections, ensure proper URL format
    let brokerUrl = config.broker_url;
    if (brokerUrl.startsWith('ws://') || brokerUrl.startsWith('wss://')) {
      try {
        const url = new URL(brokerUrl);
        if (!url.pathname || url.pathname === '/') {
          url.pathname = '/mqtt';
          brokerUrl = url.toString();
        }
      } catch (e) {
        // Keep original URL if parsing fails
      }
    }

    const client = mqtt.connect(brokerUrl, {
      port: config.broker_port,
      username: config.username || undefined,
      password: config.password || undefined,
      clientId: config.client_id || `status-check-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      keepalive: Math.min(config.keepalive, 30), // Shorter keepalive for status check
      clean: config.clean_session,
      reconnectPeriod: 0, // Disable auto-reconnect for test
      connectTimeout: Math.min(config.connect_timeout, 8000), // Max 8 seconds for status check
      protocolVersion: 4,
      rejectUnauthorized: false,
    });

    // Set timeout for connection attempt (shorter for status check)
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        client.end(true);
        resolve({
          success: false,
          message: "Connection timeout (8s)",
        });
      }
    }, 8000);

    client.on("connect", () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        const latency = Date.now() - startTime;
        client.end(true);
        resolve({
          success: true,
          message: "Connected",
          latency,
        });
      }
    });

    client.on("error", (error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        client.end(true);
        resolve({
          success: false,
          message: error.message || "Connection error",
        });
      }
    });

    client.on("close", () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve({
          success: false,
          message: "Connection closed",
        });
      }
    });
  });
}