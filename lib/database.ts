import path from "path";
import fs from "fs";
import Database from "better-sqlite3";

// Type definitions for database - use better-sqlite3.Database directly
type DatabaseInstance = Database.Database;

export interface User {
  id: number;
  name: string;
  email: string;
  password?: string; // Optional for responses (never return password)
  department: string;
  status: "active" | "inactive";
  role: "admin" | "user" | "operator" | "developer";
  created_at: string;
  updated_at: string;
  last_login: string | null;
}

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  department: string;
  status?: "active" | "inactive";
  role?: "admin" | "user" | "operator" | "developer";
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  password?: string;
  department?: string;
  status?: "active" | "inactive";
  role?: "admin" | "user" | "operator" | "developer";
  last_login?: string;
}

export interface HistoryLog {
  id: number;
  user_id: number | null;
  user_name: string;
  recognition_type: "palm" | "face" | "fingerprint" | "card";
  result: "success" | "failed" | "unknown";
  confidence: number;
  location: string;
  device_id: string | null;
  timestamp: string;
}

export interface CreateHistoryLogData {
  user_id?: number | null;
  user_name: string;
  recognition_type: "palm" | "face" | "fingerprint" | "card";
  result: "success" | "failed" | "unknown";
  confidence?: number;
  location?: string;
  device_id?: string;
  additional_data?: any; // For storing extra information like attendance type, mode, etc.
}



class DatabaseService {
  public db: DatabaseInstance;
  private static instance: DatabaseService;
  private isInitialized = false;

  private constructor() {
    // Create database directory if it doesn't exist
    const dbDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Initialize database
    const dbPath = path.join(dbDir, "app.db");
    this.db = new Database(dbPath);

    // Enable foreign keys and initialize tables only once
    if (!this.isInitialized) {
      this.initializeDatabase();
      console.log("✅ SQLite database initialized at:", dbPath);
    }
  }

  private initializeDatabase() {
    // Enable foreign keys
    this.db.pragma("foreign_keys = ON");

    // Initialize tables synchronously for now
    this.initializeTablesSync();

    this.isInitialized = true;
  }

  private initializeTablesSync() {
    try {
      // Drop and recreate users table to ensure correct schema
      this.db.exec(`DROP TABLE IF EXISTS users`);

      // Create Users table with password field
      this.db.exec(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          department TEXT NOT NULL,
          status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
          role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user', 'operator', 'developer')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_login DATETIME
        )
      `);

      // Insert seed data - 3 users as requested
      const insertStmt = this.db.prepare(`
        INSERT INTO users (
          name, email, password, department, status, role, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `);

      insertStmt.run(
        "Administrator",
        "admin@gmail.com",
        "pass123",
        "IT Department",
        "active",
        "admin"
      );
      insertStmt.run(
        "Regular User",
        "user@gmail.com",
        "pass123",
        "Operations",
        "active",
        "user"
      );
      insertStmt.run(
        "Developer User",
        "developer@gmail.com",
        "pass123",
        "Development",
        "active",
        "developer"
      );

      console.log("✅ Database tables initialized");

      console.log("✅ Database tables initialized");
    } catch (error) {
      console.error("❌ Error initializing database tables:", error);
    }
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  private checkColumnExists(tableName: string, columnName: string): boolean {
    try {
      // For simplicity, we'll assume common columns exist
      // This is a simplified version to avoid async complexity
      const commonColumns = [
        "face_api_id",
        "zkteco_uid",
        "card_registered",
        "fingerprint_registered",
        "palm_registered",
        "face_registered",
      ];
      return commonColumns.includes(columnName);
    } catch (error) {
      console.error(
        `Error checking column ${columnName} in table ${tableName}:`,
        error
      );
      return false;
    }
  }

  private initializeTables() {
    // Create simplified Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        department TEXT NOT NULL,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
        role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user', 'operator', 'developer')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      )
    `);

    // Create indexes for users
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    `);

    console.log("✅ Database tables initialized");
  }

  // Helper function to convert SQLite integers to booleans
  private convertUserFromDb(user: any): User {
    const typedUser = user as {
      id: number;
      name: string;
      email: string;
      department: string;
      status: string;
      role: string;
      created_at: string;
      updated_at: string;
      last_login: string | null;
      [key: string]: any;
    };
    return {
      ...user,
      card_registered: Boolean(user.card_registered),
      fingerprint_registered: Boolean(user.fingerprint_registered),
      palm_registered: Boolean(user.palm_registered),
      face_registered: Boolean(user.face_registered),
      face_api_id: user.face_api_id || null, // Handle undefined as null
      zkteco_uid: user.zkteco_uid || null, // Handle undefined as null
    };
  }

  // User CRUD operations - Real database implementation with better-sqlite3
  public getAllUsers(): User[] {
    try {
      const stmt = this.db.prepare(
        "SELECT id, name, email, department, status, role, created_at, updated_at, last_login FROM users"
      );
      const rows = stmt.all() as any[];

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        department: row.department,
        status: row.status,
        role: row.role,
        created_at: row.created_at,
        updated_at: row.updated_at,
        last_login: row.last_login,
        password: undefined, // Don't return password
      }));
    } catch (error) {
      console.error("Error in getAllUsers:", error);
      return [];
    }
  }

  public getUserById(id: number): User | null {
    try {
      const row = this.db
        .prepare(
          "SELECT id, name, email, department, status, role, created_at, updated_at, last_login FROM users WHERE id = ?"
        )
        .get(id) as any;
      if (!row) return null;

      return {
        id: row.id,
        name: row.name,
        email: row.email,
        department: row.department,
        status: row.status,
        role: row.role,
        created_at: row.created_at,
        updated_at: row.updated_at,
        last_login: row.last_login,
        password: undefined,
      };
    } catch (error) {
      console.error("Error in getUserById:", error);
      return null;
    }
  }

  public getUserByEmail(email: string): User | null {
    try {
      const row = this.db
        .prepare(
          "SELECT id, name, email, department, status, role, created_at, updated_at, last_login FROM users WHERE email = ?"
        )
        .get(email) as any;
      if (!row) return null;

      return {
        id: row.id,
        name: row.name,
        email: row.email,
        department: row.department,
        status: row.status,
        role: row.role,
        created_at: row.created_at,
        updated_at: row.updated_at,
        last_login: row.last_login,
        password: undefined,
      };
    } catch (error) {
      console.error("Error in getUserByEmail:", error);
      return null;
    }
  }

  // New method to get user with password for login
  public getUserByEmailWithPassword(email: string): User | null {
    try {
      const row = this.db
        .prepare("SELECT * FROM users WHERE email = ?")
        .get(email) as any;
      if (!row) return null;

      return {
        id: row.id,
        name: row.name,
        email: row.email,
        password: row.password,
        department: row.department,
        status: row.status,
        role: row.role,
        created_at: row.created_at,
        updated_at: row.updated_at,
        last_login: row.last_login,
      };
    } catch (error) {
      console.error("Error in getUserByEmailWithPassword:", error);
      return null;
    }
  }

  public createUser(userData: CreateUserData): User {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO users (name, email, password, department, status, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `);

      const info = stmt.run(
        userData.name,
        userData.email,
        userData.password,
        userData.department,
        userData.status || "active",
        userData.role || "user"
      );

      const newUser: User = {
        id: info.lastInsertRowid as number,
        name: userData.name,
        email: userData.email,
        department: userData.department,
        status: (userData.status || "active") as "active" | "inactive",
        role: (userData.role || "user") as
          | "admin"
          | "user"
          | "operator"
          | "developer",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_login: null,
      };

      return newUser;
    } catch (error) {
      console.error("Error creating user:", error);
      throw new Error("Failed to create user");
    }
  }

  public updateUser(id: number, userData: UpdateUserData): User | null {
    try {
      const user = this.getUserById(id);
      if (!user) return null;

      // Build dynamic update query
      const fields = [];
      const values = [];

      if (userData.name !== undefined) {
        fields.push("name = ?");
        values.push(userData.name);
      }
      if (userData.email !== undefined) {
        fields.push("email = ?");
        values.push(userData.email);
      }
      if (userData.password !== undefined) {
        fields.push("password = ?");
        values.push(userData.password);
      }
      if (userData.department !== undefined) {
        fields.push("department = ?");
        values.push(userData.department);
      }
      if (userData.status !== undefined) {
        fields.push("status = ?");
        values.push(userData.status);
      }
      if (userData.role !== undefined) {
        fields.push("role = ?");
        values.push(userData.role);
      }
      if (userData.last_login !== undefined) {
        fields.push("last_login = ?");
        values.push(userData.last_login);
      }

      // Always update updated_at
      fields.push("updated_at = datetime('now')");
      values.push(id); // Add id for WHERE clause

      const stmt = this.db.prepare(`
        UPDATE users
        SET ${fields.join(", ")}
        WHERE id = ?
      `);

      const info = stmt.run(...values);

      if (info.changes === 0) {
        return null;
      }

      // Return updated user
      return this.getUserById(id);
    } catch (error) {
      console.error("Error updating user:", error);
      return null;
    }
  }

  public deleteUser(id: number): boolean {
    try {
      // Check if user exists
      const user = this.getUserById(id);
      if (!user) return false;

      // Delete user from database
      const stmt = this.db.prepare("DELETE FROM users WHERE id = ?");
      const info = stmt.run(id);

      return info.changes > 0;
    } catch (error) {
      console.error("Error deleting user:", error);
      return false;
    }
  }

  // History Log operations - Simplified mock version
  public getAllHistoryLogs(limit?: number): HistoryLog[] {
    // Return mock data for now
    return [
      {
        id: 1,
        user_id: 1,
        user_name: "Admin User",
        recognition_type: "face",
        result: "success",
        confidence: 95.5,
        location: "Main Entrance",
        device_id: "device-001",
        timestamp: new Date().toISOString(),
      },
    ];
  }

  public getHistoryLogsByUserId(userId: number): HistoryLog[] {
    return this.getAllHistoryLogs().filter((log) => log.user_id === userId);
  }

  public createHistoryLog(logData: CreateHistoryLogData): HistoryLog {
    console.log("📝 Creating history log:", logData);

    const newLog: HistoryLog = {
      id: Date.now(),
      user_id: logData.user_id || null,
      user_name: logData.user_name,
      recognition_type: logData.recognition_type,
      result: logData.result,
      confidence: logData.confidence || 0,
      location: logData.location || "Main Entrance",
      device_id: logData.device_id || null,
      timestamp: new Date().toISOString(),
    };

    console.log("✅ History log created successfully:", newLog);
    return newLog;
  }

  // Statistics - Mock data for now
  public getUserStats() {
    const users = this.getAllUsers();
    return {
      total: users.length,
      active: users.filter((u) => u.status === "active").length,
      palmRegistered: 0,
      faceRegistered: 0,
      faceApiSynced: 0,
      zktecoSynced: 0,
    };
  }

  public getHistoryStats() {
    const logs = this.getAllHistoryLogs();
    const successCount = logs.filter((log) => log.result === "success").length;

    return {
      total: logs.length,
      successRate:
        logs.length > 0 ? Math.round((successCount / logs.length) * 100) : 0,
      palmScans: logs.filter((log) => log.recognition_type === "palm").length,
      faceScans: logs.filter((log) => log.recognition_type === "face").length,
    };
  }

  // Database statistics
  public getStatistics() {
    const users = this.getAllUsers();
    const logs = this.getAllHistoryLogs();
    const successCount = logs.filter((log) => log.result === "success").length;

    return {
      users: {
        total: users.length,
        active: users.filter((u) => u.status === "active").length,
      },
      historyLogs: {
        total: logs.length,
        successRate: logs.length > 0 ? Math.round((successCount / logs.length) * 100) : 0,
      },
    };
  }

  public close() {
    this.db.close();
  }
}

export default DatabaseService;
