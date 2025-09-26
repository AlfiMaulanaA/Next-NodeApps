import { NextResponse } from "next/server";

// Simple endpoint to return mock status - actual status will be updated from client-side
let currentMQTTStatus = {
  is_connected: false,
  connection_state: "disconnected",
  broker_url: "",
  mode: "env",
  last_updated: new Date().toISOString()
};

// GET - Return current MQTT status
export async function GET() {
  return NextResponse.json({
    success: true,
    data: currentMQTTStatus
  });
}

// POST - Update MQTT status from client-side
export async function POST(request: Request) {
  try {
    const body = await request.json();

    currentMQTTStatus = {
      is_connected: body.is_connected || false,
      connection_state: body.connection_state || "disconnected",
      broker_url: body.broker_url || "",
      mode: body.mode || "env",
      last_updated: new Date().toISOString()
    };

    console.log("MQTT status updated from client:", currentMQTTStatus);

    return NextResponse.json({
      success: true,
      message: "MQTT status updated",
      data: currentMQTTStatus
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to update MQTT status",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}