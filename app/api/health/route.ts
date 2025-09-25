import { NextRequest, NextResponse } from "next/server";
import DatabaseService from "@/lib/database";
import {
  connectMQTT,
  isClientConnected,
  getConnectionState,
} from "@/lib/mqttClient";

// Health check response interface
interface HealthCheckResponse {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  response_time: number;
  services: {
    database: {
      status: "healthy" | "degraded" | "unhealthy" | "unknown";
      response_time: number;
      tables: Array<{ name: string; count: number }>;
      error: string | null;
    };
    mqtt: {
      status: "healthy" | "degraded" | "unhealthy" | "unknown";
      connection_state: string;
      is_connected: boolean;
      active_config: {
        id: number;
        name: string;
        broker_url: string;
        connection_status: string;
      } | null;
      error: string | null;
    };
  };
  error?: string;
}

// GET /api/health - Comprehensive system health check
export async function GET() {
  const startTime = Date.now();
  const health: HealthCheckResponse = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    response_time: 0,
    services: {
      database: {
        status: "unknown",
        response_time: 0,
        tables: [],
        error: null,
      },
      mqtt: {
        status: "unknown",
        connection_state: "unknown",
        is_connected: false,
        active_config: null,
        error: null,
      },
    },
  };

  try {
    // Database Health Check
    const dbStartTime = Date.now();
    try {
      const db = DatabaseService.getInstance();

      // Test basic database operations
      const userCount = db.getAllUsers().length;
      const mqttConfigs = db.getAllMQTTConfigurations();
      const activeConfig = db.getActiveMQTTConfiguration();

      health.services.database = {
        status: "healthy",
        response_time: Date.now() - dbStartTime,
        tables: [
          { name: "users", count: userCount },
          { name: "mqtt_configurations", count: mqttConfigs.length },
        ],
        error: null,
      };
    } catch (dbError) {
      health.services.database = {
        status: "unhealthy",
        response_time: Date.now() - dbStartTime,
        tables: [],
        error:
          dbError instanceof Error
            ? dbError.message
            : "Database connection failed",
      };
      health.status = "degraded";
    }

    // MQTT Health Check (with timeout)
    const mqttStartTime = Date.now();
    try {
      // Use Promise.race to timeout MQTT check after 1 second
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            status: "degraded",
            connection_state: "timeout",
            is_connected: false,
            active_config: null,
            error: "MQTT health check timeout (1s)",
          });
        }, 1000);
      });

      const mqttCheckPromise = new Promise(async (resolve) => {
        // Use setImmediate to make it non-blocking
        setImmediate(async () => {
          try {
            const connectionState = getConnectionState();
            const isConnected = isClientConnected();

            // Get actual MQTT configuration based on current mode
            let activeConfig = null;

            try {
              // Check current MQTT mode from localStorage (simulate client-side check)
              // Since this is server-side, we'll check both possible configurations
              const db = DatabaseService.getInstance();

              // First try to get enabled configuration (database mode)
              const enabledConfigs = db
                .getAllMQTTConfigurations()
                .filter((c) => c.enabled);
              if (enabledConfigs.length > 0) {
                const config = enabledConfigs[0];
                activeConfig = {
                  id: config.id,
                  name: config.name,
                  broker_url: config.broker_url,
                  connection_status: connectionState,
                };
              } else {
                // Fall back to active configuration
                const activeDbConfig = db.getActiveMQTTConfiguration();
                if (activeDbConfig) {
                  activeConfig = {
                    id: activeDbConfig.id,
                    name: activeDbConfig.name,
                    broker_url: activeDbConfig.broker_url,
                    connection_status: connectionState,
                  };
                } else {
                  // Fall back to ENV configuration
                  const { getEnvMQTTBrokerUrl } = await import("@/lib/config");
                  activeConfig = {
                    id: 0,
                    name: "Environment Configuration",
                    broker_url: getEnvMQTTBrokerUrl(),
                    connection_status: connectionState,
                  };
                }
              }
            } catch (configError) {
              // If database check fails, fall back to ENV
              try {
                const { getEnvMQTTBrokerUrl } = await import("@/lib/config");
                activeConfig = {
                  id: 0,
                  name: "Environment Configuration",
                  broker_url: getEnvMQTTBrokerUrl(),
                  connection_status: connectionState,
                };
              } catch (envError) {
                activeConfig = {
                  id: 0,
                  name: "Configuration Error",
                  broker_url: "Unknown",
                  connection_status: connectionState,
                };
              }
            }

            resolve({
              status: isConnected ? "healthy" : "degraded",
              connection_state: connectionState,
              is_connected: isConnected,
              active_config: activeConfig,
              error: null,
            });
          } catch (error) {
            resolve({
              status: "unhealthy",
              connection_state: "error",
              is_connected: false,
              active_config: null,
              error:
                error instanceof Error ? error.message : "MQTT check failed",
            });
          }
        });
      });

      const mqttResultPromise = Promise.race([
        timeoutPromise,
        mqttCheckPromise,
      ]);

      const mqttResult = (await mqttResultPromise) as any;
      health.services.mqtt = mqttResult;

      if (mqttResult.status !== "healthy") {
        health.status = "degraded";
      }
    } catch (mqttError) {
      health.services.mqtt = {
        status: "unhealthy",
        connection_state: "error",
        is_connected: false,
        active_config: null,
        error:
          mqttError instanceof Error
            ? mqttError.message
            : "MQTT connection failed",
      };
      health.status = "unhealthy";
    }

    // Calculate total response time
    health.response_time = Date.now() - startTime;

    // Determine overall status
    if (
      health.services.database.status === "unhealthy" ||
      health.services.mqtt.status === "unhealthy"
    ) {
      health.status = "unhealthy";
    } else if (
      health.services.database.status === "degraded" ||
      health.services.mqtt.status === "degraded"
    ) {
      health.status = "degraded";
    }

    const statusCode =
      health.status === "healthy"
        ? 200
        : health.status === "degraded"
        ? 200
        : 503;

    return NextResponse.json(health, { status: statusCode });
  } catch (error) {
    health.status = "unhealthy";
    health.response_time = Date.now() - startTime;

    return NextResponse.json(
      {
        ...health,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 503 }
    );
  }
}

// POST /api/health/database - Test database connection specifically
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { test_type } = body;

    const db = DatabaseService.getInstance();
    const startTime = Date.now();

    let result = {
      success: false,
      message: "",
      response_time: 0,
      details: {},
    };

    switch (test_type) {
      case "basic":
        // Basic connection test
        const userCount = db.getAllUsers().length;
        result = {
          success: true,
          message: "Database connection successful",
          response_time: Date.now() - startTime,
          details: { user_count: userCount },
        };
        break;

      case "mqtt_configs":
        // Test MQTT configurations table
        const configs = db.getAllMQTTConfigurations();
        const enabledConfig = db.getEnabledMQTTConfiguration();
        const activeConfig = enabledConfig || db.getActiveMQTTConfiguration();
        result = {
          success: true,
          message: "MQTT configurations accessible",
          response_time: Date.now() - startTime,
          details: {
            total_configs: configs.length,
            active_config: activeConfig?.name || null,
          },
        };
        break;

      case "stats":
        // Test statistics queries
        const userStats = db.getUserStats();
        const mqttStats = db.getMQTTStats();
        result = {
          success: true,
          message: "Statistics queries successful",
          response_time: Date.now() - startTime,
          details: { userStats, mqttStats },
        };
        break;

      default:
        result = {
          success: false,
          message: "Invalid test type",
          response_time: Date.now() - startTime,
          details: {},
        };
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Database test failed",
        response_time: Date.now() - (Date.now() - 1000), // Approximate
        details: {},
      },
      { status: 500 }
    );
  }
}
