import { NextRequest, NextResponse } from "next/server";
import DatabaseService from "@/lib/database";
import mqtt from "mqtt";

// POST /api/mqtt/test - Test MQTT connection
export async function POST(request: NextRequest) {
  try {
    const db = DatabaseService.getInstance();
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: "Configuration ID is required" },
        { status: 400 }
      );
    }

    const configId = parseInt(body.id);
    if (isNaN(configId)) {
      return NextResponse.json(
        { error: "Invalid configuration ID" },
        { status: 400 }
      );
    }

    // Get configuration
    const config = db.getMQTTConfigurationById(configId);
    if (!config) {
      return NextResponse.json(
        { error: "Configuration not found" },
        { status: 404 }
      );
    }

    // Test connection with timeout
    const testConnection = async (): Promise<{
      success: boolean;
      message: string;
      latency?: number;
    }> => {
      return new Promise((resolve) => {
        const startTime = Date.now();
        let resolved = false;

        const client = mqtt.connect(config.broker_url, {
          port: config.broker_port,
          username: config.username || undefined,
          password: config.password || undefined,
          clientId: config.client_id || `test-client-${Date.now()}`,
          keepalive: config.keepalive,
          clean: config.clean_session,
          reconnectPeriod: 0, // Disable auto-reconnect for test
          connectTimeout: config.connect_timeout,
          protocolVersion: 4,
          rejectUnauthorized: false,
        });

        // Set timeout for connection attempt
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            client.end(true);
            resolve({
              success: false,
              message: "Connection timeout",
            });
          }
        }, 10000); // 10 second timeout

        client.on("connect", () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            const latency = Date.now() - startTime;
            client.end(true);
            resolve({
              success: true,
              message: "Connection successful",
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
              message: `Connection failed: ${error.message}`,
            });
          }
        });

        client.on("close", () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve({
              success: false,
              message: "Connection closed unexpectedly",
            });
          }
        });
      });
    };

    const result = await testConnection();

    // Update connection status in database
    db.updateMQTTConnectionStatus(
      configId,
      result.success ? "connected" : "error",
      result.success ? undefined : result.message
    );

    return NextResponse.json({
      success: result.success,
      message: result.message,
      latency: result.latency,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error testing MQTT connection:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
