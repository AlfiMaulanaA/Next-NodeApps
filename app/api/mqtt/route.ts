import { NextRequest, NextResponse } from "next/server";
import DatabaseService from "@/lib/database";
import { CreateMQTTConfigData, UpdateMQTTConfigData } from "@/lib/database";

// Force Node.js runtime to avoid static generation issues
export const runtime = "nodejs";

// GET /api/mqtt - Get all MQTT configurations
export async function GET(request: NextRequest) {
  try {
    const db = DatabaseService.getInstance();

    // Get query parameters without using request.url to avoid static generation issues
    const url = request.nextUrl || new URL(request.url);
    const activeOnly = url.searchParams.get("active") === "true";
    const enabledOnly = url.searchParams.get("enabled") === "true";
    const id = url.searchParams.get("id");

    let configurations;

    if (id) {
      // Get specific configuration by ID
      const configId = parseInt(id);
      if (isNaN(configId)) {
        return NextResponse.json(
          { error: "Invalid configuration ID" },
          { status: 400 }
        );
      }
      const config = db.getMQTTConfigurationById(configId);
      if (!config) {
        return NextResponse.json(
          { error: "Configuration not found" },
          { status: 404 }
        );
      }
      configurations = [config];
    } else if (activeOnly) {
      // Get only active configuration
      const activeConfig = db.getActiveMQTTConfiguration();
      configurations = activeConfig ? [activeConfig] : [];
    } else if (enabledOnly) {
      // Get only enabled configuration
      const enabledConfig = db.getEnabledMQTTConfiguration();
      configurations = enabledConfig ? [enabledConfig] : [];
    } else {
      // Get all configurations
      configurations = db.getAllMQTTConfigurations();
    }

    return NextResponse.json({
      success: true,
      data: configurations,
      count: configurations.length,
    });
  } catch (error) {
    console.error("Error fetching MQTT configurations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/mqtt - Create new MQTT configuration
export async function POST(request: NextRequest) {
  try {
    const db = DatabaseService.getInstance();
    const body: CreateMQTTConfigData = await request.json();

    // Validate required fields
    if (!body.name || !body.broker_url || !body.broker_port) {
      return NextResponse.json(
        { error: "Missing required fields: name, broker_url, broker_port" },
        { status: 400 }
      );
    }

    // Validate broker URL format
    try {
      const url = new URL(body.broker_url);
      if (!["mqtt:", "mqtts:", "ws:", "wss:"].includes(url.protocol)) {
        return NextResponse.json(
          {
            error:
              "Invalid broker URL protocol. Must be mqtt, mqtts, ws, or wss",
          },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid broker URL format" },
        { status: 400 }
      );
    }

    // Validate port range
    if (body.broker_port < 1 || body.broker_port > 65535) {
      return NextResponse.json(
        { error: "Invalid port number. Must be between 1 and 65535" },
        { status: 400 }
      );
    }

    // Check if name already exists
    const existingConfig = db.getMQTTConfigurationByName(body.name);
    if (existingConfig) {
      return NextResponse.json(
        { error: "Configuration with this name already exists" },
        { status: 409 }
      );
    }

    // Create configuration
    const configuration = db.createMQTTConfiguration(body);

    return NextResponse.json(
      {
        success: true,
        message: "MQTT configuration created successfully",
        data: configuration,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating MQTT configuration:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/mqtt - Update MQTT configuration
export async function PUT(request: NextRequest) {
  try {
    const db = DatabaseService.getInstance();
    const body: UpdateMQTTConfigData & { id: number } = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: "Configuration ID is required" },
        { status: 400 }
      );
    }

    // Check if configuration exists
    const existingConfig = db.getMQTTConfigurationById(body.id);
    if (!existingConfig) {
      return NextResponse.json(
        { error: "Configuration not found" },
        { status: 404 }
      );
    }

    // Validate broker URL if provided
    if (body.broker_url) {
      try {
        const url = new URL(body.broker_url);
        if (!["mqtt:", "mqtts:", "ws:", "wss:"].includes(url.protocol)) {
          return NextResponse.json(
            {
              error:
                "Invalid broker URL protocol. Must be mqtt, mqtts, ws, or wss",
            },
            { status: 400 }
          );
        }
      } catch {
        return NextResponse.json(
          { error: "Invalid broker URL format" },
          { status: 400 }
        );
      }
    }

    // Validate port if provided
    if (
      body.broker_port !== undefined &&
      (body.broker_port < 1 || body.broker_port > 65535)
    ) {
      return NextResponse.json(
        { error: "Invalid port number. Must be between 1 and 65535" },
        { status: 400 }
      );
    }

    // Check name uniqueness if name is being updated
    if (body.name && body.name !== existingConfig.name) {
      const nameExists = db.getMQTTConfigurationByName(body.name);
      if (nameExists) {
        return NextResponse.json(
          { error: "Configuration with this name already exists" },
          { status: 409 }
        );
      }
    }

    // Remove id from update data
    const { id, ...updateData } = body;

    // Update configuration
    const configuration = db.updateMQTTConfiguration(id, updateData);
    if (!configuration) {
      return NextResponse.json(
        { error: "Failed to update configuration" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "MQTT configuration updated successfully",
      data: configuration,
    });
  } catch (error) {
    console.error("Error updating MQTT configuration:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/mqtt - Delete MQTT configuration
export async function DELETE(request: NextRequest) {
  try {
    const db = DatabaseService.getInstance();
    const url = request.nextUrl || new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Configuration ID is required" },
        { status: 400 }
      );
    }

    const configId = parseInt(id);
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

    // Prevent deletion of active configuration
    if (config.is_active) {
      return NextResponse.json(
        {
          error:
            "Cannot delete active configuration. Set another configuration as active first.",
        },
        { status: 400 }
      );
    }

    // Delete configuration
    const deleted = db.deleteMQTTConfiguration(configId);
    if (!deleted) {
      return NextResponse.json(
        { error: "Failed to delete configuration" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "MQTT configuration deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting MQTT configuration:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
