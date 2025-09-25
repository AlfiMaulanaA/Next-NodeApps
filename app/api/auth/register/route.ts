import { NextRequest, NextResponse } from "next/server";
import DatabaseService from "@/lib/database";
import { CreateUserData } from "@/lib/database";

interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  department: string;
  role?: "admin" | "user" | "operator" | "developer";
}

export async function POST(request: NextRequest) {
  try {
    const db = DatabaseService.getInstance();
    const body: RegisterRequest = await request.json();

    // Validate required fields
    if (!body.name || !body.email || !body.password || !body.department) {
      return NextResponse.json(
        { error: "Missing required fields: name, email, password, department" },
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

    // Validate password length
    if (body.password.length < 3) {
      return NextResponse.json(
        { error: "Password must be at least 3 characters long" },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = db.getUserByEmail(body.email);
    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 }
      );
    }

    // Create user data
    const userData: CreateUserData = {
      name: body.name,
      email: body.email,
      password: body.password,
      department: body.department,
      status: "active",
      role: body.role || "user",
    };

    // Create user
    const user = db.createUser(userData);

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
      last_login: user.last_login,
    };

    return NextResponse.json(
      {
        success: true,
        message: "User registered successfully",
        data: userResponse,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error during registration:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}