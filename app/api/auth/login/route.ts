import { NextRequest, NextResponse } from "next/server";
import DatabaseService from "@/lib/database";

interface LoginRequest {
  email: string;
  password: string;
}

export async function POST(request: NextRequest) {
  try {
    const db = DatabaseService.getInstance();
    const body: LoginRequest = await request.json();

    // Validate required fields
    if (!body.email || !body.password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Get user with password for authentication
    const user = db.getUserByEmailWithPassword(body.email);

    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Check if user is active
    if (user.status !== "active") {
      return NextResponse.json(
        { error: "Account is inactive" },
        { status: 401 }
      );
    }

    // Check password (simple string comparison for now)
    if (user.password !== body.password) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Update last login
    db.updateUser(user.id, { last_login: new Date().toISOString() });

    // Return user data without password
    const userResponse = {
      id: user.id,
      name: user.name,
      email: user.email,
      department: user.department,
      status: user.status,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at,
      last_login: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      message: "Login successful",
      data: userResponse,
    });
  } catch (error) {
    console.error("Error during login:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}