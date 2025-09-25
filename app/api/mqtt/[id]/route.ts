import { NextRequest, NextResponse } from "next/server";
import DatabaseService from "@/lib/database";

// Force Node.js runtime to avoid static generation issues
export const runtime = "nodejs";

// GET /api/mqtt/[id] - Get MQTT configuration by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = DatabaseService.getInstance();
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid configuration ID" },
        { status: 400 }
      );
    }

    const config = db.getMQTTConfigurationById(id);
    if (!config) {
      return NextResponse.json(
        { error: "Configuration not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error("Error fetching MQTT configuration:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/mqtt/[id] - Update MQTT configuration
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = DatabaseService.getInstance();
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid configuration ID" },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Check if configuration exists
    const existingConfig = db.getMQTTConfigurationById(id);
    if (!existingConfig) {
      return NextResponse.json(
        { error: "Configuration not found" },
        { status: 404 }
      );
    }

    // Update the configuration
    const updatedConfig = db.updateMQTTConfiguration(id, body);

    if (!updatedConfig) {
      return NextResponse.json(
        { error: "Failed to update configuration" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Configuration updated successfully",
      data: updatedConfig,
    });
  } catch (error) {
    console.error("Error updating MQTT configuration:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/mqtt/[id] - Delete MQTT configuration
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = DatabaseService.getInstance();
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid configuration ID" },
        { status: 400 }
      );
    }

    // Check if configuration exists
    const existingConfig = db.getMQTTConfigurationById(id);
    if (!existingConfig) {
      return NextResponse.json(
        { error: "Configuration not found" },
        { status: 404 }
      );
    }

    // Delete the configuration
    const success = db.deleteMQTTConfiguration(id);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to delete configuration" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Configuration deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting MQTT configuration:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}