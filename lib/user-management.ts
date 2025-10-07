// Dynamic User Management - Clean Implementation
// This system allows dynamic user management without APIs

export interface User {
  id: string;
  username: string;
  password: string | null; // null for password-less users or external auth
  role: 'admin' | 'operator' | 'viewer' | 'user' | 'developer';
  name: string;
  email: string;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  isActive: boolean;
  metadata?: {
    department?: string;
    phone?: string;
    notes?: string;
    avatar?: string;
  };
}

export interface UserSession {
  userId: string;
  token: string;
  loginAt: string;
  expiresAt: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface UserManagementConfig {
  defaultRoles: string[];
  sessionTimeoutMinutes: number;
  maxLoginAttempts: number;
  passwordMinLength: number;
  requireStrongPassword: boolean;
  allowRegistration: boolean;
  adminOnlyRegistration: boolean;
}

// =============================================================================
// CORE USER MANAGEMENT CLASS
// =============================================================================

export class UserManager {
  private static STORAGE_KEY_USERS = 'dynamic_users_db';
  private static STORAGE_KEY_SESSIONS = 'active_sessions';
  private static STORAGE_KEY_CONFIG = 'user_config';

  private static DEFAULT_CONFIG: UserManagementConfig = {
    defaultRoles: ['user'],
    sessionTimeoutMinutes: 480, // 8 hours
    maxLoginAttempts: 5,
    passwordMinLength: 6,
    requireStrongPassword: false,
    allowRegistration: true,
    adminOnlyRegistration: false,
  };

  // =============================================================================
  // CONFIGURATION MANAGEMENT
  // =============================================================================

  static getConfig(): UserManagementConfig {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY_CONFIG);
      if (stored) {
        return { ...this.DEFAULT_CONFIG, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
    return { ...this.DEFAULT_CONFIG };
  }

  static updateConfig(config: Partial<UserManagementConfig>): void {
    try {
      const current = this.getConfig();
      const updated = { ...current, ...config };
      localStorage.setItem(this.STORAGE_KEY_CONFIG, JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving config:', error);
    }
  }

  // =============================================================================
  // USER STORAGE MANAGEMENT
  // =============================================================================

  private static getUsers(): User[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY_USERS);
      if (stored) {
        const users = JSON.parse(stored);
        // Migrate old users if needed
        return this.migrateUsers(users);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }

    // Return default admin user if no users exist
    const defaultUsers = this.getDefaultUsers();
    this.saveUsers(defaultUsers);
    return defaultUsers;
  }

  private static saveUsers(users: User[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY_USERS, JSON.stringify(users));
    } catch (error) {
      console.error('Error saving users:', error);
    }
  }

  private static migrateUsers(users: any[]): User[] {
    return users.map(user => ({
      id: user.id || this.generateId(),
      username: user.username,
      password: user.password || '',
      role: user.role || 'user',
      name: user.name || user.username,
      email: user.email || '',
      permissions: user.permissions || this.getPermissionsForRole(user.role || 'user'),
      createdAt: user.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLoginAt: user.lastLoginAt,
      isActive: user.isActive !== false,
      metadata: user.metadata || {},
    }));
  }

  private static getDefaultUsers(): User[] {
    const now = new Date().toISOString();

    return [
      {
        id: 'admin-default',
        username: 'admin',
        password: this.hashPassword('admin123'),
        role: 'admin',
        name: 'System Administrator',
        email: 'admin@gmail.com',
        permissions: ['all', 'admin', 'manage_users', 'system_config'],
        createdAt: now,
        updatedAt: now,
        isActive: true,
        metadata: {
          department: 'IT',
          notes: 'Default admin user',
        },
      },
      {
        id: 'operator-default',
        username: 'operator',
        password: this.hashPassword('op123'),
        role: 'operator',
        name: 'Operator',
        email: 'operator@gmail.com',
        permissions: ['read', 'control', 'monitor'],
        createdAt: now,
        updatedAt: now,
        isActive: true,
        metadata: {
          department: 'Operations',
          notes: 'Default operator user',
        },
      },
      {
        id: 'developer-default',
        username: 'developer',
        password: this.hashPassword('dev123'),
        role: 'developer' as const,
        name: 'Developer',
        email: 'developer@gmail.com',
        permissions: ['read', 'control', 'monitor', 'admin', 'all'],
        createdAt: now,
        updatedAt: now,
        isActive: true,
        metadata: {
          department: 'Development',
          notes: 'Default developer user',
        },
      },
    ];
  }

  // =============================================================================
  // USER CRUD OPERATIONS
  // =============================================================================

  static async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; user?: Omit<User, 'password'>; message?: string }> {
    try {
      const config = this.getConfig();

      // Validation
      if (!this.isValidUsername(userData.username)) {
        return { success: false, message: 'Invalid username format' };
      }

      if (!userData.password || userData.password.length < config.passwordMinLength) {
        return { success: false, message: `Password must be at least ${config.passwordMinLength} characters` };
      }

      if (config.requireStrongPassword && !this.isStrongPassword(userData.password)) {
        return { success: false, message: 'Password must contain uppercase, lowercase, and numbers' };
      }

      const users = this.getUsers();

      // Check if username exists
      if (users.some(u => u.username.toLowerCase() === userData.username.toLowerCase())) {
        return { success: false, message: 'Username already exists' };
      }

      // Set permissions based on role if not provided
      const permissions = userData.permissions || this.getPermissionsForRole(userData.role);

      const newUser: User = {
        ...userData,
        id: this.generateId(),
        password: this.hashPassword(userData.password),
        permissions,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
      };

      users.push(newUser);
      this.saveUsers(users);

      // Return user without password
      const { password: _, ...userWithoutPassword } = newUser;
      return { success: true, user: userWithoutPassword };

    } catch (error) {
      console.error('Error creating user:', error);
      return { success: false, message: 'Failed to create user' };
    }
  }

  static async updateUser(userId: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>, currentUser?: User): Promise<{ success: boolean; user?: Omit<User, 'password'>; message?: string }> {
    try {
      const users = this.getUsers();
      const userIndex = users.findIndex(u => u.id === userId);

      if (userIndex === -1) {
        return { success: false, message: 'User not found' };
      }

      const user = users[userIndex];

      // Prevent users from demoting themselves unless they're admin
      if (currentUser && userId === currentUser.id) {
        if (updates.role && updates.role !== user.role && currentUser.role !== 'admin') {
          return { success: false, message: 'Cannot change your own role' };
        }
        if (updates.isActive === false && currentUser.role !== 'admin') {
          return { success: false, message: 'Cannot deactivate your own account' };
        }
      }

      // Hash password if provided
      const updateData: Partial<User> = {
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      if (updates.password) {
        const config = this.getConfig();
        if (updates.password.length < config.passwordMinLength) {
          return { success: false, message: `Password must be at least ${config.passwordMinLength} characters` };
        }
        if (config.requireStrongPassword && !this.isStrongPassword(updates.password)) {
          return { success: false, message: 'Password must contain uppercase, lowercase, and numbers' };
        }
        updateData.password = this.hashPassword(updates.password);
      }

      // Update user
      users[userIndex] = { ...users[userIndex], ...updateData };
      this.saveUsers(users);

      // Return updated user without password
      const updatedUser = users[userIndex];
      const { password, ...userWithoutPassword } = updatedUser;
      return { success: true, user: userWithoutPassword };

    } catch (error) {
      console.error('Error updating user:', error);
      return { success: false, message: 'Failed to update user' };
    }
  }

  static async deleteUser(userId: string, currentUser?: User): Promise<{ success: boolean; message?: string }> {
    try {
      const users = this.getUsers();
      const userIndex = users.findIndex(u => u.id === userId);

      if (userIndex === -1) {
        return { success: false, message: 'User not found' };
      }

      const user = users[userIndex];

      // Prevent deleting self
      if (currentUser && userId === currentUser.id) {
        return { success: false, message: 'Cannot delete your own account' };
      }

      // Prevent deleting last admin
      const adminUsers = users.filter(u => u.role === 'admin' && u.id !== userId);
      if (user.role === 'admin' && adminUsers.length === 0) {
        return { success: false, message: 'Cannot delete the last admin user' };
      }

      users.splice(userIndex, 1);
      this.saveUsers(users);

      // Logout deleted user from all sessions
      this.logoutUser(userId);

      return { success: true };

    } catch (error) {
      console.error('Error deleting user:', error);
      return { success: false, message: 'Failed to delete user' };
    }
  }

  static getUserById(userId: string): User | null {
    const users = this.getUsers();
    return users.find(u => u.id === userId) || null;
  }

  static getUserByUsername(username: string): User | null {
    const users = this.getUsers();
    return users.find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
  }

  static getUserByEmail(email: string): User | null {
    const users = this.getUsers();
    return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  static getAllUsers(): Omit<User, 'password'>[] {
    const users = this.getUsers();
    return users.map(({ password, ...user }) => user);
  }

  // =============================================================================
  // AUTHENTICATION METHODS
  // =============================================================================

  static async authenticateUser(identifier: string, password: string): Promise<{ success: boolean; user?: Omit<User, 'password'>; message?: string }> {
    try {
      // Try to find user by email first, then by username for backward compatibility
      let user = this.getUserByEmail(identifier);
      if (!user) {
        user = this.getUserByUsername(identifier);
      }

      if (!user) {
        return { success: false, message: 'User not found' };
      }

      if (!user.isActive) {
        return { success: false, message: 'Account is deactivated' };
      }

      // Check password
      if (!user.password || !this.verifyPassword(password, user.password)) {
        return { success: false, message: 'Invalid password' };
      }

      // Update last login
      await this.updateUser(user.id, { lastLoginAt: new Date().toISOString() });

      // Create session
      const sessionToken = this.createSession(user.id);

      const { password: _, ...userWithoutPassword } = user;
      return {
        success: true,
        user: userWithoutPassword
      };

    } catch (error) {
      console.error('Authentication error:', error);
      return { success: false, message: 'Authentication failed' };
    }
  }

  static logoutUser(userId?: string): void {
    try {
      if (userId) {
        // Logout specific user from all sessions
        const sessions = this.getSessions();
        const updatedSessions = sessions.filter(s => s.userId !== userId);
        this.saveSessions(updatedSessions);
      } else {
        // Logout current user (if any)
        const currentSession = this.getCurrentSession();
        if (currentSession) {
          this.logoutUser(currentSession.userId);
        }
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  static isUserAuthenticated(userId: string): boolean {
    const sessions = this.getSessions();
    const userSession = sessions.find(s => s.userId === userId);

    if (!userSession) return false;

    // Check expiration
    const now = new Date();
    const expiresAt = new Date(userSession.expiresAt);

    if (now > expiresAt) {
      this.logoutUser(userId);
      return false;
    }

    return true;
  }

  static getCurrentAuthenticatedUser(): Omit<User, 'password'> | null {
    const session = this.getCurrentSession();
    if (!session) return null;

    const user = this.getUserById(session.userId);
    if (!user || !user.isActive) return null;

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // =============================================================================
  // PERMISSIONS & ROLES
  // =============================================================================

  static hasPermission(userId: string, permission: string): boolean {
    const user = this.getUserById(userId);
    if (!user || !user.isActive) return false;

    return user.permissions.includes('all') || user.permissions.includes(permission);
  }

  static getPermissionsForRole(role: string): string[] {
    const rolePermissions: { [key: string]: string[] } = {
      admin: ['all', 'admin', 'manage_users', 'system_config'],
      developer: ['read', 'control', 'monitor', 'admin', 'all'], // Similar to admin but for development
      operator: ['read', 'control', 'monitor'],
      viewer: ['read', 'view'],
      user: ['read'],
    };

    return rolePermissions[role] || ['read'];
  }

  static canUserManageRole(managerRole: string, targetRole: string): boolean {
    const roleHierarchy: { [key: string]: string[] } = {
      admin: ['admin', 'operator', 'viewer', 'user'],
      operator: ['operator', 'viewer', 'user'],
      viewer: ['viewer', 'user'],
      user: ['user'],
    };

    return roleHierarchy[managerRole]?.includes(targetRole) || false;
  }

  // =============================================================================
  // SESSION MANAGEMENT
  // =============================================================================

  private static createSession(userId: string): string {
    const config = this.getConfig();
    const token = this.generateToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + config.sessionTimeoutMinutes * 60 * 1000);

    const session: UserSession = {
      userId,
      token,
      loginAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    const sessions = this.getSessions();
    sessions.push(session);
    this.saveSessions(sessions);

    return token;
  }

  private static getSessions(): UserSession[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY_SESSIONS);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private static saveSessions(sessions: UserSession[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
    } catch (error) {
      console.error('Error saving sessions:', error);
    }
  }

  private static getCurrentSession(): UserSession | null {
    const sessions = this.getSessions();
    // Return the most recent session (in a real app, you'd store current session ID)
    return sessions.sort((a, b) => new Date(b.loginAt).getTime() - new Date(a.loginAt).getTime())[0] || null;
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  private static generateId(): string {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private static generateToken(): string {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 16);
  }

  private static hashPassword(password: string): string {
    // Simple hash for demo - use proper hashing in production
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  private static verifyPassword(password: string, hash: string): boolean {
    return this.hashPassword(password) === hash;
  }

  private static isValidUsername(username: string): boolean {
    // Basic validation
    return username.length >= 3 && /^[a-zA-Z0-9_.-]+$/.test(username);
  }

  private static isStrongPassword(password: string): boolean {
    // At least 8 chars with uppercase, lowercase, and number
    return password.length >= 8 &&
           /[a-z]/.test(password) &&
           /[A-Z]/.test(password) &&
           /[0-9]/.test(password);
  }

  // =============================================================================
  // EXPORT/IMPORT FUNCTIONALITY
  // =============================================================================

  static exportUsers(): string {
    const users = this.getAllUsers();
    return JSON.stringify(users, null, 2);
  }

  static exportConfig(): string {
    const config = this.getConfig();
    return JSON.stringify(config, null, 2);
  }

  static exportSystemData(): string {
    const data = {
      users: this.getAllUsers(),
      config: this.getConfig(),
      exportDate: new Date().toISOString(),
    };
    return JSON.stringify(data, null, 2);
  }

  static async importUsers(jsonData: string, currentUserId?: string): Promise<{ success: boolean; message?: string }> {
    try {
      const importedUsers = JSON.parse(jsonData);

      if (!Array.isArray(importedUsers)) {
        return { success: false, message: 'Invalid user data format' };
      }

      // Get current user from ID if provided
      const currentUser = currentUserId ? this.getUserById(currentUserId) : null;

      // Validate and sanitize imported users
      const validatedUsers = importedUsers
        .filter(u => u.username && u.name)
        .map(u => ({
          id: u.id || this.generateId(),
          username: u.username,
          password: u.password || null,
          role: u.role || 'user',
          name: u.name,
          email: u.email || '',
          permissions: u.permissions || this.getPermissionsForRole(u.role || 'user'),
          createdAt: u.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLoginAt: u.lastLoginAt,
          isActive: u.isActive !== false,
          metadata: u.metadata || {},
        }));

      // Check if current user has permission to import (only admins can import admin users)
      if (currentUser && currentUser.role !== 'admin') {
        const hasAdminUsers = validatedUsers.some(u => u.role === 'admin');
        if (hasAdminUsers) {
          return { success: false, message: 'Only administrators can import admin users' };
        }
      }

      // Merge with existing users (avoid duplicates by username)
      const existingUsers = this.getUsers();
      const existingUsernames = new Set(existingUsers.map(u => u.username.toLowerCase()));

      const newUsers: User[] = [];
      for (const u of validatedUsers.filter(u =>
        !existingUsernames.has(u.username.toLowerCase())
      )) {
        const hashedPassword = u.password ? this.hashPassword(typeof u.password === 'string' ? u.password : u.password.toString()) : this.hashPassword('default123');
        const user: User = {
          id: u.id,
          username: u.username,
          password: hashedPassword,
          role: u.role as User['role'],
          name: u.name,
          email: u.email,
          permissions: u.permissions,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
          lastLoginAt: u.lastLoginAt,
          isActive: u.isActive,
          metadata: u.metadata,
        };
        newUsers.push(user);
      }

      if (newUsers.length === 0) {
        return { success: false, message: 'All users already exist or invalid data' };
      }

      const updatedUsers = [...existingUsers, ...newUsers];
      this.saveUsers(updatedUsers);

      return { success: true, message: `Imported ${newUsers.length} users successfully` };

    } catch (error) {
      console.error('Import error:', error);
      return { success: false, message: 'Failed to import users: Invalid JSON format' };
    }
  }

  static async importSystemData(jsonData: string, currentUserId?: string): Promise<{ success: boolean; message?: string }> {
    try {
      const data = JSON.parse(jsonData);

      if (!data.users || !Array.isArray(data.users)) {
        return { success: false, message: 'Invalid system data format' };
      }

      // Import users first
      const userImport = await this.importUsers(JSON.stringify(data.users), currentUserId);
      if (!userImport.success) {
        return userImport;
      }

      // Import config if present
      if (data.config) {
        this.updateConfig(data.config);
      }

      return { success: true, message: 'System data imported successfully' };

    } catch (error) {
      console.error('Import error:', error);
      return { success: false, message: 'Failed to import system data: Invalid JSON format' };
    }
  }

  // =============================================================================
  // STATISTICS & MONITORING
  // =============================================================================

  static getUserStatistics() {
    const users = this.getUsers();
    const sessions = this.getSessions();

    return {
      totalUsers: users.length,
      activeUsers: users.filter(u => u.isActive).length,
      inactiveUsers: users.filter(u => !u.isActive).length,
      adminUsers: users.filter(u => u.role === 'admin' && u.isActive).length,
      operatorUsers: users.filter(u => u.role === 'operator' && u.isActive).length,
      viewerUsers: users.filter(u => u.role === 'viewer' && u.isActive).length,
      activeSessions: sessions.filter(s => new Date(s.expiresAt) > new Date()).length,
      totalSessions: sessions.length,
    };
  }

  static clearExpiredSessions(): number {
    const sessions = this.getSessions();
    const now = new Date();
    const validSessions = sessions.filter(s => new Date(s.expiresAt) > now);

    const clearedCount = sessions.length - validSessions.length;
    if (clearedCount > 0) {
      this.saveSessions(validSessions);
    }

    return clearedCount;
  }

  static clearAllSessions(): void {
    this.saveSessions([]);
  }

  // =============================================================================
  // INITIALIZATION
  // =============================================================================

  static initialize(): void {
    // Create default users if none exist
    if (this.getUsers().length === 0) {
      const defaultUsers = this.getDefaultUsers();
      this.saveUsers(defaultUsers);
    }

    // Clean up expired sessions
    this.clearExpiredSessions();
  }
}

// Initialize on module load
if (typeof window !== 'undefined') {
  UserManager.initialize();
}

export default UserManager;
