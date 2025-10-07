// Dynamic Authentication Components for Static Files
import React from 'react';
import UserManager, { type User } from '@/lib/user-management';

// Role-based authentication component
export const RoleGuard = ({
  children,
  allowedRoles,
  fallback = null
}: {
  children: React.ReactNode;
  allowedRoles: string[];
  fallback?: React.ReactNode;
}) => {
  const user = UserManager.getCurrentAuthenticatedUser();

  if (!user || !allowedRoles.includes(user.role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

// Permission-based component
export const PermissionGuard = ({
  children,
  permission,
  fallback = null
}: {
  children: React.ReactNode;
  permission: string;
  fallback?: React.ReactNode;
}) => {
  const user = UserManager.getCurrentAuthenticatedUser();

  if (!user || !UserManager.hasPermission(user.id, permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

// Auth status display component
export const AuthStatus = () => {
  const user = UserManager.getCurrentAuthenticatedUser();

  if (!user) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700">Not authenticated</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
      <p className="text-green-700">
        Logged in as: <strong>{user.name}</strong> ({user.role})
      </p>
      <div className="mt-2">
        <span className="text-sm text-gray-600">Permissions: </span>
        <div className="flex flex-wrap gap-1 mt-1">
          {user.permissions.map(perm => (
            <span key={perm} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
              {perm}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

// User menu component
export const UserMenu = () => {
  const handleLogout = () => {
    UserManager.logoutUser();
    window.location.href = '/auth/login';
  };

  return (
    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-50 border">
      <div className="py-1">
        <button
          onClick={handleLogout}
          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

// User badge component
export const UserBadge = () => {
  const user = UserManager.getCurrentAuthenticatedUser();

  if (!user) return null;

  return (
    <div className="flex items-center space-x-2">
      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
        <span className="text-white text-sm font-medium">
          {user.name.charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="text-left">
        <p className="text-sm font-medium">{user.name}</p>
        <p className="text-xs text-gray-500">{user.role}</p>
      </div>
    </div>
  );
};

// Login form component (using UserManager)
export const StaticLoginForm = ({
  onLogin,
  loading = false
}: {
  onLogin: (username: string, password: string) => void;
  loading?: boolean;
}) => {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const result = await UserManager.authenticateUser(username, password);

      if (result.success) {
        onLogin(username, password);
      } else {
        setError(result.message || 'Login failed');
      }
    } catch (err) {
      setError('An error occurred during login');
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter username"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter password"
            disabled={loading}
          />
        </div>

        {error && (
          <div className="text-red-600 text-sm text-center">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !username || !password}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-medium mb-2">Demo Accounts:</h3>
      <div className="space-y-1 text-xs">
        {UserManager.getAllUsers().slice(0, 3).map(user => (
          <p key={user.id}>
            <strong>{user.name.charAt(0).toUpperCase() + user.name.slice(1)}:</strong> {user.email} / {
              user.email.includes('admin') ? 'admin123' :
              user.email.includes('operator') ? 'op123' :
              user.email.includes('developer') ? 'dev123' : 'pass123'
            }
          </p>
        ))}
        </div>
      </div>
    </div>
  );
};
