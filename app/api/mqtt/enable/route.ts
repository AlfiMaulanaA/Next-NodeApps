import { NextRequest, NextResponse } from "next/server";
import DatabaseService from "@/lib/database";
import { reconnectMQTT } from "@/lib/mqttClient";

// Force Node.js runtime to avoid static generation issues
export const runtime = "nodejs";

// POST /api/mqtt/enable - Enable MQTT configuration for application use
export async function POST(request: NextRequest) {
  try {
    const db = DatabaseService.getInstance();
    const body = await request.json();

    const { id } = body;

    if (!id || typeof id !== "number") {
      return NextResponse.json(
        { error: "Configuration ID is required" },
        { status: 400 }
      );
    }

    // Check if configuration exists
    const config = db.getMQTTConfigurationById(id);
    if (!config) {
      return NextResponse.json(
        { error: "Configuration not found" },
        { status: 404 }
      );
    }

    // Enable the configuration (this will disable all others)
    const updatedConfig = db.setEnabledMQTTConfiguration(id);

    if (!updatedConfig) {
      return NextResponse.json(
        { error: "Failed to enable configuration" },
        { status: 500 }
      );
    }

    // Check if MQTT connection mode is set to database
    // If so, reconnect to the newly enabled configuration
    try {
      // Since we're in server-side, we can't access localStorage directly
      // The MQTT client will handle this when it checks for enabled config
      console.log(`MQTT configuration '${updatedConfig.name}' enabled for application use`);

      // Note: The actual reconnection will happen on the client-side
      // when the MQTT client checks for enabled configuration
    } catch (reconnectError) {
      console.error("Note: MQTT reconnection should happen on client-side:", reconnectError);
    }

    return NextResponse.json({
      success: true,
      message: `Configuration '${updatedConfig.name}' has been enabled for application use`,
      data: updatedConfig,
    });
  } catch (error) {
    console.error("Error enabling MQTT configuration:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/mqtt/enable - Disable MQTT configuration
export async function DELETE(request: NextRequest) {
  try {
    const db = DatabaseService.getInstance();
    const body = await request.json();

    const { id } = body;

    if (!id || typeof id !== "number") {
      return NextResponse.json(
        { error: "Configuration ID is required" },
        { status: 400 }
      );
    }

    // Check if configuration exists
    const config = db.getMQTTConfigurationById(id);
    if (!config) {
      return NextResponse.json(
        { error: "Configuration not found" },
        { status: 404 }
      );
    }

    // Disable the configuration
    const updatedConfig = db.disableMQTTConfiguration(id);

    if (!updatedConfig) {
      return NextResponse.json(
        { error: "Failed to disable configuration" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Configuration '${updatedConfig.name}' has been disabled`,
      data: updatedConfig,
    });
  } catch (error) {
    console.error("Error disabling MQTT configuration:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}