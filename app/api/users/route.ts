import { NextRequest, NextResponse } from "next/server";
import DatabaseService from "@/lib/database";
import { CreateUserData, UpdateUserData } from "@/lib/database";

// GET /api/users - Get all users
export async function GET(request: NextRequest) {
  try {
    const db = DatabaseService.getInstance();

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const role = searchParams.get("role");
    const search = searchParams.get("search");

    let users = db.getAllUsers();

    // Apply filters
    if (status) {
      users = users.filter((user) => user.status === status);
    }

    if (role) {
      users = users.filter((user) => user.role === role);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      users = users.filter(
        (user) =>
          user.name.toLowerCase().includes(searchLower) ||
          user.email.toLowerCase().includes(searchLower) ||
          user.department.toLowerCase().includes(searchLower)
      );
    }

    return NextResponse.json({
      success: true,
      data: users,
      count: users.length,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/users - Create new user
export async function POST(request: NextRequest) {
  try {
    const db = DatabaseService.getInstance();
    const body: CreateUserData = await request.json();

    // Validate required fields
    if (!body.name || !body.email || !body.department || !body.password) {
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

    // Check if email already exists
    const existingUser = db.getUserByEmail(body.email);
    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 }
      );
    }

    // Create user
    const user = db.createUser(body);

    return NextResponse.json(
      {
        success: true,
        message: "User created successfully",
        data: user,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/users - Update user
export async function PUT(request: NextRequest) {
  try {
    const db = DatabaseService.getInstance();
    const body: UpdateUserData & { id: number } = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Check if user exists
    const existingUser = db.getUserById(body.id);
    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Validate email format if email is being updated
    if (body.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        return NextResponse.json(
          { error: "Invalid email format" },
          { status: 400 }
        );
      }

      // Check email uniqueness if email is being updated
      if (body.email !== existingUser.email) {
        const emailExists = db.getUserByEmail(body.email);
        if (emailExists) {
          return NextResponse.json(
            { error: "User with this email already exists" },
            { status: 409 }
          );
        }
      }
    }

    // Remove id from update data
    const { id, ...updateData } = body;

    // Update user
    const user = db.updateUser(id, updateData);
    if (!user) {
      return NextResponse.json(
        { error: "Failed to update user" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "User updated successfully",
      data: user,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/users - Delete user
export async function DELETE(request: NextRequest) {
  try {
    const db = DatabaseService.getInstance();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const userId = parseInt(id);
    if (isNaN(userId)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    // Check if user exists
    const user = db.getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Delete user
    const deleted = db.deleteUser(userId);
    if (!deleted) {
      return NextResponse.json(
        { error: "Failed to delete user" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
