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

// MQTT Configuration interfaces
export interface MQTTConfiguration {
  id: number;
  name: string;
  broker_url: string;
  broker_port: number;
  username?: string;
  password?: string;
  client_id?: string;
  keepalive: number;
  qos: 0 | 1 | 2;
  retain: boolean;
  clean_session: boolean;
  reconnect_period: number;
  connect_timeout: number;
  protocol: "mqtt" | "mqtts" | "ws" | "wss";
  is_active: boolean;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  last_connected?: string;
  connection_status: "connected" | "disconnected" | "connecting" | "error";
  error_message?: string;
}

export interface CreateMQTTConfigData {
  name: string;
  broker_url: string;
  broker_port: number;
  username?: string;
  password?: string;
  client_id?: string;
  keepalive?: number;
  qos?: 0 | 1 | 2;
  retain?: boolean;
  clean_session?: boolean;
  reconnect_period?: number;
  connect_timeout?: number;
  protocol?: "mqtt" | "mqtts" | "ws" | "wss";
  is_active?: boolean;
  enabled?: boolean;
}

export interface UpdateMQTTConfigData {
  name?: string;
  broker_url?: string;
  broker_port?: number;
  username?: string;
  password?: string;
  client_id?: string;
  keepalive?: number;
  qos?: 0 | 1 | 2;
  retain?: boolean;
  clean_session?: boolean;
  reconnect_period?: number;
  connect_timeout?: number;
  protocol?: "mqtt" | "mqtts" | "ws" | "wss";
  is_active?: boolean;
  enabled?: boolean;
  connection_status?: "connected" | "disconnected" | "connecting" | "error";
  error_message?: string;
  last_connected?: string;
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

      // Create MQTT Configurations table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS mqtt_configurations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          broker_url TEXT NOT NULL,
          broker_port INTEGER NOT NULL DEFAULT 1883,
          username TEXT,
          password TEXT,
          client_id TEXT,
          keepalive INTEGER DEFAULT 60,
          qos INTEGER DEFAULT 0 CHECK (qos IN (0, 1, 2)),
          retain INTEGER DEFAULT 0,
          clean_session INTEGER DEFAULT 1,
          reconnect_period INTEGER DEFAULT 3000,
          connect_timeout INTEGER DEFAULT 5000,
          protocol TEXT DEFAULT 'mqtt' CHECK (protocol IN ('mqtt', 'mqtts', 'ws', 'wss')),
          is_active INTEGER DEFAULT 0,
          enabled INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_connected DATETIME,
          connection_status TEXT DEFAULT 'disconnected' CHECK (connection_status IN ('connected', 'disconnected', 'connecting', 'error')),
          error_message TEXT
        )
      `);

      // Create default MQTT configuration if none exists
      const countStmt = this.db.prepare(
        "SELECT COUNT(*) as count FROM mqtt_configurations"
      );
      const result = countStmt.get() as any;

      if (!result || result.count === 0) {
        const mqttInsertStmt = this.db.prepare(`
          INSERT INTO mqtt_configurations (
            name, broker_url, broker_port, protocol, is_active, enabled, connection_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        mqttInsertStmt.run(
          "Default MQTT",
          "ws://localhost:9000",
          9000,
          "ws",
          1,
          0,
          "disconnected"
        );
      }

      // Migration: Add enabled column if it doesn't exist in existing databases
      try {
        // Check if enabled column exists
        const tableInfo = this.db
          .prepare("PRAGMA table_info(mqtt_configurations)")
          .all() as any[];
        const enabledColumnExists = tableInfo.some(
          (column: any) => column.name === "enabled"
        );

        if (!enabledColumnExists) {
          this.db.exec(
            `ALTER TABLE mqtt_configurations ADD COLUMN enabled INTEGER DEFAULT 0`
          );
          console.log("✅ Added enabled column to mqtt_configurations table");
        }
      } catch (err) {
        console.error("Error adding enabled column:", err);
      }

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
        role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user', 'operator')),
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

    // Create MQTT Configurations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mqtt_configurations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        broker_url TEXT NOT NULL,
        broker_port INTEGER NOT NULL DEFAULT 1883,
        username TEXT,
        password TEXT,
        client_id TEXT,
        keepalive INTEGER DEFAULT 60,
        qos INTEGER DEFAULT 0 CHECK (qos IN (0, 1, 2)),
        retain INTEGER DEFAULT 0,
        clean_session INTEGER DEFAULT 1,
        reconnect_period INTEGER DEFAULT 3000,
        connect_timeout INTEGER DEFAULT 5000,
        protocol TEXT DEFAULT 'mqtt' CHECK (protocol IN ('mqtt', 'mqtts', 'ws', 'wss')),
        is_active INTEGER DEFAULT 0,
        enabled INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_connected DATETIME,
        connection_status TEXT DEFAULT 'disconnected' CHECK (connection_status IN ('connected', 'disconnected', 'connecting', 'error')),
        error_message TEXT
      )
    `);

    // Create indexes for MQTT configurations
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_mqtt_name ON mqtt_configurations(name);
      CREATE INDEX IF NOT EXISTS idx_mqtt_active ON mqtt_configurations(is_active);
      CREATE INDEX IF NOT EXISTS idx_mqtt_enabled ON mqtt_configurations(enabled);
      CREATE INDEX IF NOT EXISTS idx_mqtt_status ON mqtt_configurations(connection_status);
    `);

    // Create default MQTT configuration if none exists (better-sqlite3 is synchronous)
    try {
      const row = this.db
        .prepare("SELECT COUNT(*) as count FROM mqtt_configurations")
        .get() as any;

      if (!row || row.count === 0) {
        const insertStmt = this.db.prepare(`
          INSERT INTO mqtt_configurations (
            name, broker_url, broker_port, protocol, is_active, connection_status
          ) VALUES (?, ?, ?, ?, ?, ?)
        `);

        insertStmt.run(
          "Default MQTT",
          "ws://localhost:9000",
          9000,
          "ws",
          1,
          "disconnected"
        );
        console.log("✅ Created default MQTT configuration");
      }
    } catch (err) {
      console.error("Error checking/creating MQTT configurations:", err);
    }

    // Migration: Add enabled column if it doesn't exist
    try {
      // Check if enabled column exists
      const tableInfo = this.db
        .prepare("PRAGMA table_info(mqtt_configurations)")
        .all() as any[];
      const enabledColumnExists = tableInfo.some(
        (column: any) => column.name === "enabled"
      );

      if (!enabledColumnExists) {
        this.db.exec(
          `ALTER TABLE mqtt_configurations ADD COLUMN enabled INTEGER DEFAULT 0`
        );
        console.log("✅ Added enabled column to mqtt_configurations table");
      }
    } catch (err) {
      console.error("Error adding enabled column:", err);
    }

    // NO DEFAULT ADMIN USER - Clean database
    console.log("✅ Database initialized with clean user table");
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

  // MQTT Configuration CRUD operations
  public getAllMQTTConfigurations(): MQTTConfiguration[] {
    try {
      // Ensure enabled column exists first
      this.ensureEnabledColumnExists();

      const stmt = this.db.prepare(`
        SELECT * FROM mqtt_configurations
        ORDER BY created_at DESC
      `);
      const rows = stmt.all() as any[];

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        broker_url: row.broker_url,
        broker_port: row.broker_port,
        username: row.username,
        password: row.password,
        client_id: row.client_id,
        keepalive: row.keepalive,
        qos: row.qos,
        retain: Boolean(row.retain),
        clean_session: Boolean(row.clean_session),
        reconnect_period: row.reconnect_period,
        connect_timeout: row.connect_timeout,
        protocol: row.protocol,
        is_active: Boolean(row.is_active),
        enabled: Boolean(row.enabled ?? false), // Safe fallback for missing column
        created_at: row.created_at,
        updated_at: row.updated_at,
        last_connected: row.last_connected,
        connection_status: row.connection_status || "disconnected",
        error_message: row.error_message,
      }));
    } catch (error) {
      console.error("Error fetching MQTT configurations:", error);
      // Return default configuration if database doesn't exist yet
      return [
        {
          id: 1,
          name: "Default MQTT",
          broker_url: "ws://localhost:9000",
          broker_port: 9000,
          username: undefined,
          password: undefined,
          client_id: undefined,
          keepalive: 60,
          qos: 0,
          retain: false,
          clean_session: true,
          reconnect_period: 3000,
          connect_timeout: 5000,
          protocol: "ws",
          is_active: true,
          enabled: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_connected: undefined,
          connection_status: "disconnected",
          error_message: undefined,
        },
      ];
    }
  }

  public getMQTTConfigurationById(id: number): MQTTConfiguration | null {
    const configs = this.getAllMQTTConfigurations();
    return configs.find((config) => config.id === id) || null;
  }

  public getMQTTConfigurationByName(name: string): MQTTConfiguration | null {
    const configs = this.getAllMQTTConfigurations();
    return configs.find((config) => config.name === name) || null;
  }

  public getActiveMQTTConfiguration(): MQTTConfiguration | null {
    const configs = this.getAllMQTTConfigurations();
    return configs.find((config) => config.is_active) || null;
  }

  public getEnabledMQTTConfiguration(): MQTTConfiguration | null {
    try {
      // Ensure enabled column exists first
      this.ensureEnabledColumnExists();

      const configs = this.getAllMQTTConfigurations();
      return configs.find((config) => config.enabled) || null;
    } catch (error) {
      console.error("Error getting enabled MQTT configuration:", error);
      return null;
    }
  }

  public createMQTTConfiguration(
    configData: CreateMQTTConfigData
  ): MQTTConfiguration {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO mqtt_configurations (
          name, broker_url, broker_port, username, password, client_id,
          keepalive, qos, retain, clean_session, reconnect_period, connect_timeout,
          protocol, is_active, enabled, created_at, updated_at, connection_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), 'disconnected')
      `);

      const info = stmt.run(
        configData.name,
        configData.broker_url,
        configData.broker_port,
        configData.username,
        configData.password,
        configData.client_id,
        configData.keepalive || 60,
        configData.qos || 0,
        configData.retain ? 1 : 0,
        configData.clean_session !== false ? 1 : 0,
        configData.reconnect_period || 3000,
        configData.connect_timeout || 5000,
        configData.protocol || "mqtt",
        configData.is_active ? 1 : 0,
        configData.enabled ? 1 : 0
      );

      const newConfig: MQTTConfiguration = {
        id: info.lastInsertRowid as number,
        name: configData.name,
        broker_url: configData.broker_url,
        broker_port: configData.broker_port,
        username: configData.username,
        password: configData.password,
        client_id: configData.client_id,
        keepalive: configData.keepalive || 60,
        qos: configData.qos || 0,
        retain: configData.retain || false,
        clean_session: configData.clean_session !== false,
        reconnect_period: configData.reconnect_period || 3000,
        connect_timeout: configData.connect_timeout || 5000,
        protocol: configData.protocol || "mqtt",
        is_active: configData.is_active || false,
        enabled: configData.enabled || false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_connected: undefined,
        connection_status: "disconnected",
        error_message: undefined,
      };

      return newConfig;
    } catch (error) {
      console.error("Error creating MQTT configuration:", error);
      throw new Error("Failed to create MQTT configuration");
    }
  }

  public updateMQTTConfiguration(
    id: number,
    configData: UpdateMQTTConfigData
  ): MQTTConfiguration | null {
    try {
      const config = this.getMQTTConfigurationById(id);
      if (!config) return null;

      // Build dynamic update query
      const fields = [];
      const values = [];

      if (configData.name !== undefined) {
        fields.push("name = ?");
        values.push(configData.name);
      }
      if (configData.broker_url !== undefined) {
        fields.push("broker_url = ?");
        values.push(configData.broker_url);
      }
      if (configData.broker_port !== undefined) {
        fields.push("broker_port = ?");
        values.push(configData.broker_port);
      }
      if (configData.username !== undefined) {
        fields.push("username = ?");
        values.push(configData.username);
      }
      if (configData.password !== undefined) {
        fields.push("password = ?");
        values.push(configData.password);
      }
      if (configData.client_id !== undefined) {
        fields.push("client_id = ?");
        values.push(configData.client_id);
      }
      if (configData.keepalive !== undefined) {
        fields.push("keepalive = ?");
        values.push(configData.keepalive);
      }
      if (configData.qos !== undefined) {
        fields.push("qos = ?");
        values.push(configData.qos);
      }
      if (configData.retain !== undefined) {
        fields.push("retain = ?");
        values.push(configData.retain ? 1 : 0);
      }
      if (configData.clean_session !== undefined) {
        fields.push("clean_session = ?");
        values.push(configData.clean_session ? 1 : 0);
      }
      if (configData.reconnect_period !== undefined) {
        fields.push("reconnect_period = ?");
        values.push(configData.reconnect_period);
      }
      if (configData.connect_timeout !== undefined) {
        fields.push("connect_timeout = ?");
        values.push(configData.connect_timeout);
      }
      if (configData.protocol !== undefined) {
        fields.push("protocol = ?");
        values.push(configData.protocol);
      }
      if (configData.is_active !== undefined) {
        fields.push("is_active = ?");
        values.push(configData.is_active ? 1 : 0);
      }
      if (configData.enabled !== undefined) {
        fields.push("enabled = ?");
        values.push(configData.enabled ? 1 : 0);
      }

      // Always update updated_at
      fields.push("updated_at = datetime('now')");
      values.push(id); // Add id for WHERE clause

      const stmt = this.db.prepare(`
        UPDATE mqtt_configurations
        SET ${fields.join(", ")}
        WHERE id = ?
      `);

      const info = stmt.run(...values);

      if (info.changes === 0) {
        return null;
      }

      // Return updated configuration
      return this.getMQTTConfigurationById(id);
    } catch (error) {
      console.error("Error updating MQTT configuration:", error);
      return null;
    }
  }

  public deleteMQTTConfiguration(id: number): boolean {
    try {
      // Check if configuration exists
      const config = this.getMQTTConfigurationById(id);
      if (!config) return false;

      // Delete configuration from database
      const stmt = this.db.prepare(
        "DELETE FROM mqtt_configurations WHERE id = ?"
      );
      const info = stmt.run(id);

      return info.changes > 0;
    } catch (error) {
      console.error("Error deleting MQTT configuration:", error);
      return false;
    }
  }

  public setActiveMQTTConfiguration(id: number): boolean {
    // Mock implementation - always return true
    return true;
  }

  public updateMQTTConnectionStatus(
    id: number,
    status: "connected" | "disconnected" | "connecting" | "error",
    errorMessage?: string
  ): MQTTConfiguration | null {
    const config = this.getMQTTConfigurationById(id);
    if (!config) return null;

    const now = new Date().toISOString();
    const lastConnected = status === "connected" ? now : config.last_connected;

    // Actually update the database
    const updateStmt = this.db.prepare(`
      UPDATE mqtt_configurations
      SET
        connection_status = ?,
        error_message = ?,
        last_connected = ?,
        updated_at = ?
      WHERE id = ?
    `);

    updateStmt.run(status, errorMessage || null, lastConnected, now, id);

    // Return updated configuration
    return {
      ...config,
      connection_status: status,
      error_message: errorMessage || undefined,
      last_connected: lastConnected,
      updated_at: now,
    };
  }

  // Enable/Disable MQTT Configuration for use as application broker
  public setEnabledMQTTConfiguration(id: number): MQTTConfiguration | null {
    try {
      // Ensure enabled column exists first
      this.ensureEnabledColumnExists();

      // First, disable all configurations
      this.db.exec(`UPDATE mqtt_configurations SET enabled = 0`);

      // Then enable the selected one
      const updateStmt = this.db.prepare(`
        UPDATE mqtt_configurations
        SET enabled = 1, updated_at = datetime('now')
        WHERE id = ?
      `);

      const result = updateStmt.run(id);

      if (result.changes === 0) {
        return null;
      }

      return this.getMQTTConfigurationById(id);
    } catch (error) {
      console.error("Error setting enabled MQTT configuration:", error);
      return null;
    }
  }

  public disableMQTTConfiguration(id: number): MQTTConfiguration | null {
    try {
      // Ensure enabled column exists first
      this.ensureEnabledColumnExists();

      const updateStmt = this.db.prepare(`
        UPDATE mqtt_configurations
        SET enabled = 0, updated_at = datetime('now')
        WHERE id = ?
      `);

      const result = updateStmt.run(id);

      if (result.changes === 0) {
        return null;
      }

      return this.getMQTTConfigurationById(id);
    } catch (error) {
      console.error("Error disabling MQTT configuration:", error);
      return null;
    }
  }

  // Helper method to ensure enabled column exists
  private ensureEnabledColumnExists(): void {
    try {
      // Check if enabled column exists
      const tableInfo = this.db
        .prepare("PRAGMA table_info(mqtt_configurations)")
        .all() as any[];
      const enabledColumnExists = tableInfo.some(
        (column: any) => column.name === "enabled"
      );

      if (!enabledColumnExists) {
        console.log("Adding enabled column to mqtt_configurations table...");
        this.db.exec(
          `ALTER TABLE mqtt_configurations ADD COLUMN enabled INTEGER DEFAULT 0`
        );
        console.log("✅ Added enabled column to mqtt_configurations table");
      }
    } catch (err) {
      console.error("Error ensuring enabled column exists:", err);
      throw err;
    }
  }

  // MQTT Configuration Statistics - Mock data
  public getMQTTStats() {
    const configs = this.getAllMQTTConfigurations();
    return {
      total: configs.length,
      active: configs.filter((c) => c.is_active).length,
      connected: configs.filter((c) => c.connection_status === "connected")
        .length,
      errors: configs.filter((c) => c.connection_status === "error").length,
    };
  }

  public close() {
    this.db.close();
  }
}

export default DatabaseService;
