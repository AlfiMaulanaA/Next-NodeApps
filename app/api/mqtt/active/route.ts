import { NextRequest, NextResponse } from "next/server";
import DatabaseService from "@/lib/database";

// PUT /api/mqtt/active - Set active MQTT configuration
export async function PUT(request: NextRequest) {
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

    // Check if configuration exists
    const config = db.getMQTTConfigurationById(configId);
    if (!config) {
      return NextResponse.json(
        { error: "Configuration not found" },
        { status: 404 }
      );
    }

    // Set as active
    const success = db.setActiveMQTTConfiguration(configId);
    if (!success) {
      return NextResponse.json(
        { error: "Failed to set active configuration" },
        { status: 500 }
      );
    }

    // Get updated configuration
    const updatedConfig = db.getMQTTConfigurationById(configId);

    return NextResponse.json({
      success: true,
      message: "Active MQTT configuration updated successfully",
      data: updatedConfig,
    });
  } catch (error) {
    console.error("Error setting active MQTT configuration:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/mqtt/active - Get active MQTT configuration
export async function GET() {
  try {
    const db = DatabaseService.getInstance();
    const activeConfig = db.getActiveMQTTConfiguration();

    if (!activeConfig) {
      return NextResponse.json(
        { error: "No active MQTT configuration found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: activeConfig,
    });
  } catch (error) {
    console.error("Error fetching active MQTT configuration:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
