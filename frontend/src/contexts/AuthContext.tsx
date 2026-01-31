import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

// User types matching backend
export interface User {
  id: number;
  email: string;
  display_name: string;
  avatar_url: string | null;
  role: 'user' | 'moderator' | 'admin' | 'government';
  reputation_score: number;
  created_at: number;
}

interface AuthContextType {
  // API Key auth (existing)
  apiKey: string | null;
  setApiKey: (key: string) => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  checkAdminStatus: (key: string) => Promise<boolean>;

  // User OAuth auth (new)
  user: User | null;
  sessionToken: string | null;
  isUserAuthenticated: boolean;
  isUserAdmin: boolean;
  isUserModerator: boolean;
  isGovernmentUser: boolean;
  loginWithGoogle: (code: string, redirectUri: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function AuthProvider({ children }: { children: ReactNode }) {
  // API Key auth state (existing)
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // User OAuth state (new)
  const [user, setUser] = useState<User | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load stored credentials on mount
  useEffect(() => {
    const loadStoredCredentials = async () => {
      // Load API key
      const storedApiKey = localStorage.getItem('govmonitor_api_key');
      if (storedApiKey) {
        setApiKeyState(storedApiKey);
        checkAdminStatus(storedApiKey);
      }

      // Load session token and fetch user
      const storedSessionToken = localStorage.getItem('govmonitor_session_token');
      if (storedSessionToken) {
        setSessionToken(storedSessionToken);
        try {
          const response = await fetch(`${API_URL}/auth/me`, {
            headers: {
              'Authorization': `Bearer ${storedSessionToken}`
            }
          });

          if (response.ok) {
            const data = await response.json();
            setUser(data.user);
          } else {
            // Session expired or invalid
            localStorage.removeItem('govmonitor_session_token');
            setSessionToken(null);
          }
        } catch (error) {
          console.error('Failed to fetch user:', error);
        }
      }

      setLoading(false);
    };

    loadStoredCredentials();
  }, []);

  // Check admin status for API key
  const checkAdminStatus = async (key: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/auth/keys`, {
        headers: {
          'Authorization': `Bearer ${key}`
        }
      });

      const isAdminUser = response.ok;
      setIsAdmin(isAdminUser);
      return isAdminUser;
    } catch (error) {
      console.error('Failed to check admin status:', error);
      setIsAdmin(false);
      return false;
    }
  };

  // Set API key (existing functionality)
  const setApiKey = async (key: string) => {
    localStorage.setItem('govmonitor_api_key', key);
    setApiKeyState(key);
    await checkAdminStatus(key);
  };

  // Login with Google OAuth
  const loginWithGoogle = useCallback(async (code: string, redirectUri: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code, redirect_uri: redirectUri })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Authentication failed');
      }

      const data = await response.json();

      // Store session token
      localStorage.setItem('govmonitor_session_token', data.session_token);
      setSessionToken(data.session_token);
      setUser(data.user);
    } catch (error) {
      console.error('Google login failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    if (!sessionToken) return;

    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        // Session expired
        logout();
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  }, [sessionToken]);

  // Logout (both API key and OAuth)
  const logout = useCallback(async () => {
    // Logout from OAuth session
    if (sessionToken) {
      try {
        await fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        });
      } catch (error) {
        console.error('Logout request failed:', error);
      }
    }

    // Clear all auth state
    localStorage.removeItem('govmonitor_api_key');
    localStorage.removeItem('govmonitor_session_token');
    setApiKeyState(null);
    setIsAdmin(false);
    setUser(null);
    setSessionToken(null);
  }, [sessionToken]);

  // Computed values for user roles
  const isUserAuthenticated = !!user && !!sessionToken;
  const isUserAdmin = user?.role === 'admin';
  const isUserModerator = user?.role === 'moderator' || user?.role === 'admin';
  const isGovernmentUser = user?.role === 'government';

  return (
    <AuthContext.Provider value={{
      // API Key auth
      apiKey,
      setApiKey,
      isAuthenticated: !!apiKey,
      isAdmin,
      checkAdminStatus,

      // User OAuth auth
      user,
      sessionToken,
      isUserAuthenticated,
      isUserAdmin,
      isUserModerator,
      isGovernmentUser,
      loginWithGoogle,
      logout,
      refreshUser,
      loading
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
