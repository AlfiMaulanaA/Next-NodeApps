import { NextResponse } from "next/server";
import DatabaseService from "@/lib/database";

// GET /api/mqtt/stats - Get MQTT configuration statistics
export async function GET() {
  try {
    const db = DatabaseService.getInstance();
    const stats = db.getMQTTStats();

    // Get additional statistics
    const configurations = db.getAllMQTTConfigurations();

    // Calculate additional metrics
    const totalConfigurations = configurations.length;
    const activeConfig = configurations.find((config) => config.is_active);
    const recentlyConnected = configurations.filter(
      (config) =>
        config.last_connected &&
        new Date(config.last_connected) >
          new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
    ).length;

    const protocolStats = configurations.reduce((acc, config) => {
      acc[config.protocol] = (acc[config.protocol] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const qosStats = configurations.reduce((acc, config) => {
      acc[config.qos] = (acc[config.qos] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    return NextResponse.json({
      success: true,
      data: {
        ...stats,
        totalConfigurations,
        activeConfiguration: activeConfig
          ? {
              id: activeConfig.id,
              name: activeConfig.name,
              broker_url: activeConfig.broker_url,
              connection_status: activeConfig.connection_status,
              last_connected: activeConfig.last_connected,
            }
          : null,
        recentlyConnected,
        protocolDistribution: protocolStats,
        qosDistribution: qosStats,
        configurationsByStatus: {
          connected: configurations.filter(
            (c) => c.connection_status === "connected"
          ).length,
          disconnected: configurations.filter(
            (c) => c.connection_status === "disconnected"
          ).length,
          connecting: configurations.filter(
            (c) => c.connection_status === "connecting"
          ).length,
          error: configurations.filter((c) => c.connection_status === "error")
            .length,
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching MQTT statistics:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
