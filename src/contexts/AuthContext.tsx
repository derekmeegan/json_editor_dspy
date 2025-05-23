import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { AuthState, ServiceAccount } from '../types';
import { initDriveClient } from '../services/driveService';

interface AuthContextProps {
  authState: AuthState;
  login: (serviceAccount: ServiceAccount) => Promise<void>;
  logout: () => void;
  getDriveClient: () => any;
}

// Starting with authenticated state by default
const initialState: AuthState = {
  isAuthenticated: true,
  serviceAccount: null,
  isLoading: false,
  error: null,
};

const AuthContext = createContext<AuthContextProps>({
  authState: initialState,
  login: async () => {},
  logout: () => {},
  getDriveClient: () => null,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>(initialState);
  // Create an empty service account object to satisfy TypeScript
  const emptyServiceAccount: ServiceAccount = {
    client_email: '',
    private_key: '',
    private_key_id: ''
  };
  const [driveClient, setDriveClient] = useState<any>(initDriveClient(emptyServiceAccount));

  // Simplified login function that works with our browser implementation
  const login = useCallback(async (serviceAccount: ServiceAccount) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Initialize our browser-compatible Drive client
      const client = initDriveClient(serviceAccount);
      
      // Test connection by listing files
      await client.files.list({ pageSize: 1 });
      
      setDriveClient(client);
      setAuthState({
        isAuthenticated: true,
        serviceAccount,
        isLoading: false,
        error: null,
      });
      
      console.log('Successfully initialized Drive client');
    } catch (error) {
      console.error('Authentication error:', error);
      setAuthState({
        isAuthenticated: false,
        serviceAccount: null,
        isLoading: false,
        error: 'Authentication failed. Please check your service account credentials.',
      });
    }
  }, []);

  const logout = useCallback(() => {
    setAuthState(initialState);
    setDriveClient(null);
    localStorage.removeItem('serviceAccount');
  }, []);

  const getDriveClient = useCallback(() => {
    return driveClient;
  }, [driveClient]);

  // No need for auto-login effect - we're already logged in by default
  useEffect(() => {
    console.log('Authentication context initialized');
  }, []);

  return (
    <AuthContext.Provider value={{ authState, login, logout, getDriveClient }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);