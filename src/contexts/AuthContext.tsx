"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useUser } from '@auth0/nextjs-auth0';

export interface User {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  createdAt: string;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
  refreshToken: () => Promise<void>;
  checkAuth: () => Promise<void>;
  getToken: () => Promise<string | null>;
  syncComplete: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user: auth0User, isLoading } = useUser();

  // Store full DB user so UI reflects DB values, not just Auth0 token values
  const [dbUser, setDbUser] = useState<User | null>(null);
  const [syncComplete, setSyncComplete] = useState(false);

  const tokenCacheRef = useRef<{ token: string; fetchedAt: number } | null>(null);
  const tokenFetchInFlightRef = useRef<Promise<string | null> | null>(null);

  const getToken = useCallback(async (): Promise<string | null> => {
    if (tokenCacheRef.current && Date.now() - tokenCacheRef.current.fetchedAt < 5000) {
      return tokenCacheRef.current.token;
    }
    if (tokenFetchInFlightRef.current) {
      return tokenFetchInFlightRef.current;
    }
    const fetchPromise = (async () => {
      try {
        const response = await fetch('/auth/access-token');
        if (!response.ok) {
          window.location.href = '/auth/login';
          return null;
        }
        const data = await response.json();
        const token = data.token ?? null;
        if (token) tokenCacheRef.current = { token, fetchedAt: Date.now() };
        return token;
      } catch {
        window.location.href = '/auth/login';
        return null;
      } finally {
        tokenFetchInFlightRef.current = null;
      }
    })();
    tokenFetchInFlightRef.current = fetchPromise;
    return fetchPromise;
  }, []);

  // Sync Auth0 user to DB on every login — store full DB user in state
  useEffect(() => {
    if (auth0User && !isLoading) {
      getToken().then(accessToken => {
        if (!accessToken) return;
        fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/sync-user`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            auth0_id: auth0User.sub,
            email: auth0User.email ?? '',
            first_name: auth0User.given_name ?? '',
            last_name: auth0User.family_name ?? '',
            role: (auth0User['role'] as string) ?? 'professor',
            email_verified: auth0User.email_verified ?? false, 
          }),
        })
        .then(res => res.json())
        .then(data => {
          if (data?.id) {
            setSyncComplete(true);
            setDbUser({
              id: String(data.id),
              username: data.username ?? '',
              email: data.email ?? auth0User.email ?? '',
              firstName: data.firstName ?? '',
              lastName: data.lastName ?? '',
              role: data.role ?? 'professor',
              createdAt: data.createdAt ?? new Date().toISOString(),
            });
        
            const currentPath = window.location.pathname;
        
            // ── Not verified yet → show "check your email" page
            if (!data.email_verified) {
              if (currentPath !== '/verify-email-pending') {
                window.location.href = '/verify-email-pending';
              }
              return;
            }
        
            // ── Verified professor waiting for approval
            // if (!data.is_approved && data.role === 'professor') {
            //   if (currentPath !== '/pending-approval') {
            //     window.location.href = '/pending-approval';
            //   }
            //   return;
            // }
        
            // ── Verified but profile incomplete → complete profile
            const isNewUser = data.firstName === 'User' && /\d{6}$/.test(data.username ?? '');
            const alreadyRedirected = sessionStorage.getItem('profile_completed');
            if (isNewUser && !alreadyRedirected && currentPath !== '/complete-profile') {
              sessionStorage.setItem('profile_completed', 'pending');
              window.location.href = '/complete-profile';
              return;
            }
          }
        })
        // .then(data => {
        //   if (data?.id) {
        //     // Store full DB user — this is what the UI should use
        //     setDbUser({
        //       id: String(data.id),
        //       username: data.username ?? '',
        //       email: data.email ?? auth0User.email ?? '',
        //       firstName: data.firstName ?? '',
        //       lastName: data.lastName ?? '',
        //       role: data.role ?? 'professor',
        //       createdAt: data.createdAt ?? new Date().toISOString(),
        //     });

        //     // Redirect new users (placeholder firstName) to complete profile
        //     // Only fires once per registration via sessionStorage flag
        //     const isNewUser = data.firstName === 'User' && /\d{6}$/.test(data.username ?? '');
        //     const alreadyRedirected = sessionStorage.getItem('profile_completed');
        //     if (isNewUser && !alreadyRedirected && window.location.pathname !== '/complete-profile') {
        //       sessionStorage.setItem('profile_completed', 'pending');
        //       window.location.href = '/complete-profile';
        //     }
        //   }
        // })
          
        .catch(err => console.error('sync-user failed:', err));
      });
    }
  }, [auth0User, isLoading, getToken]);

  // Use DB user if available, fall back to Auth0 user shape during loading
  const user: User | null = dbUser ?? (auth0User ? {
    id: auth0User.sub ?? '',
    username: auth0User.nickname ?? auth0User.email ?? '',
    email: auth0User.email ?? '',
    firstName: auth0User.given_name ?? '',
    lastName: auth0User.family_name ?? '',
    role: (auth0User['role'] as string) ?? 'professor',
    createdAt: auth0User.updated_at ?? new Date().toISOString(),
  } : null);

  const isAuthenticated = !!auth0User;

  const login = () => { window.location.href = '/auth/login'; };
  const logout = () => { 
    sessionStorage.removeItem('profile_completed');
    window.location.href = '/auth/logout'; 
  };
  const refreshToken = async () => {};
  const checkAuth = async () => {};

  return (
    <AuthContext.Provider value={{
      user, token: null, isAuthenticated, isLoading,
      login, logout, refreshToken, checkAuth, getToken,
      syncComplete,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
