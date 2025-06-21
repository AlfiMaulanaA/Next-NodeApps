import { type NextRequest, NextResponse } from "next/server";
import DatabaseService from "@/lib/database";
import { FaceApiService } from "@/services/face-api.service";

// GET /api/users - Get all users
export async function GET() {
  try {
    const db = DatabaseService.getInstance();
    const users = db.getAllUsers();
    const stats = db.getUserStats();

    return NextResponse.json({
      success: true,
      data: users,
      stats,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch users",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// POST /api/users - Create new user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, department, status } = body;

    // Validation
    if (!name || !email || !department) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: name, email, department",
        },
        { status: 400 }
      );
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid email format",
        },
        { status: 400 }
      );
    }

    const db = DatabaseService.getInstance();

    // Check if email already exists
    const existingUser = db.getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: "Email already exists",
        },
        { status: 409 }
      );
    }

    // Create user in local database first
    const newUser = db.createUser({
      name,
      email,
      department,
      status: status || "active",
    });

    // Register user to Face API
    let faceApiId: number | null = null;
    try {
      const faceApiService = FaceApiService.getInstance();
      const personnelResult = await faceApiService.createPersonnel({
        name: name,
        department: department,
        entity: "Company", // Default entity
        authorized: true,
      });

      if (personnelResult.success && personnelResult.id) {
        faceApiId = personnelResult.id;

        // Update user with Face API ID
        const updatedUser = db.updateUserFaceApiId(newUser.id, faceApiId);
        console.log(
          `✅ User ${newUser.id} registered to Face API with ID: ${faceApiId}`
        );

        return NextResponse.json(
          {
            success: true,
            message: "User created and registered to Face API successfully",
            data: updatedUser,
            faceApiId: faceApiId,
          },
          { status: 201 }
        );
      }
    } catch (faceApiError) {
      console.error("⚠️ Face API registration failed:", faceApiError);
      // Continue with local user creation even if Face API fails
    }

    return NextResponse.json(
      {
        success: true,
        message: "User created successfully (Face API registration failed)",
        data: newUser,
        faceApiId: null,
        warning: "Face API registration failed - user created locally only",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create user",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
