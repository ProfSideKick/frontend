// // // // "use client";

// // // // import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
// // // // import { config } from '@/lib/config';

// // // // export interface User {
// // // //   id: string;
// // // //   username: string;
// // // //   email?: string;
// // // //   firstName?: string;
// // // //   lastName?: string;
// // // //   role?: string;
// // // //   createdAt: string;
// // // // }

// // // // export interface AuthContextType {
// // // //   user: User | null;
// // // //   token: string | null;
// // // //   isAuthenticated: boolean;
// // // //   isLoading: boolean;
// // // //   login: (username: string, password: string) => Promise<void>;
// // // //   logout: () => void;
// // // //   refreshToken: () => Promise<void>;
// // // //   checkAuth: () => Promise<void>;
// // // // }

// // // // const AuthContext = createContext<AuthContextType | undefined>(undefined);

// // // // export const useAuth = () => {
// // // //   const context = useContext(AuthContext);
// // // //   if (context === undefined) {
// // // //     throw new Error('useAuth must be used within an AuthProvider');
// // // //   }
// // // //   return context;
// // // // };

// // // // interface AuthProviderProps {
// // // //   children: ReactNode;
// // // // }

// // // // export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
// // // //   const [user, setUser] = useState<User | null>(null);
// // // //   const [token, setToken] = useState<string | null>(null);
// // // //   const [isLoading, setIsLoading] = useState(true);

// // // //   const isAuthenticated = !!user && !!token;

// // // //   // Check for existing session on app start
// // // //   useEffect(() => {
// // // //     checkAuth();
// // // //   }, []);

// // // //   const checkAuth = async () => {
// // // //     try {
// // // //       setIsLoading(true);
// // // //       const storedToken = localStorage.getItem('auth_token');
// // // //       const storedUser = localStorage.getItem('auth_user');

// // // //       if (storedToken && storedUser) {
// // // //         // Verify token is still valid
// // // //         const response = await fetch(config.getApiUrl('/api/auth/verify'), {
// // // //           method: 'GET',
// // // //           headers: {
// // // //             'Authorization': `Bearer ${storedToken}`,
// // // //             'Content-Type': 'application/json',
// // // //           },
// // // //         });

// // // //         if (response.ok) {
// // // //           const userData = await response.json();
// // // //           setToken(storedToken);
// // // //           setUser(userData.user);
// // // //         } else {
// // // //           // Token invalid, clear storage
// // // //           localStorage.removeItem('auth_token');
// // // //           localStorage.removeItem('auth_user');
// // // //           setToken(null);
// // // //           setUser(null);
// // // //         }
// // // //       }
// // // //     } catch (error) {
// // // //       console.error('Auth check failed:', error);
// // // //       // Clear potentially corrupted auth data
// // // //       localStorage.removeItem('auth_token');
// // // //       localStorage.removeItem('auth_user');
// // // //       setToken(null);
// // // //       setUser(null);
// // // //     } finally {
// // // //       setIsLoading(false);
// // // //     }
// // // //   };

// // // //   const login = async (username: string, password: string) => {
// // // //     try {
// // // //       setIsLoading(true);
// // // //       const response = await fetch(config.getApiUrl('/api/auth/login'), {
// // // //         method: 'POST',
// // // //         headers: {
// // // //           'Content-Type': 'application/json',
// // // //         },
// // // //         body: JSON.stringify({ username, password }),
// // // //       });

// // // //       const data = await response.json();

// // // //       if (!response.ok) {
// // // //         throw new Error(data.message || 'Login failed');
// // // //       }

// // // //       // Store auth data
// // // //       const { user: userData, token: authToken } = data;
// // // //       setUser(userData);
// // // //       setToken(authToken);
// // // //       localStorage.setItem('auth_token', authToken);
// // // //       localStorage.setItem('auth_user', JSON.stringify(userData));
// // // //     } catch (error) {
// // // //       console.error('Login error:', error);
// // // //       throw error;
// // // //     } finally {
// // // //       setIsLoading(false);
// // // //     }
// // // //   };

// // // //   const logout = async () => {
// // // //     try {
// // // //       // Call logout endpoint to invalidate token on server
// // // //       if (token) {
// // // //         await fetch(config.getApiUrl('/api/auth/logout'), {
// // // //           method: 'POST',
// // // //           headers: {
// // // //             'Authorization': `Bearer ${token}`,
// // // //             'Content-Type': 'application/json',
// // // //           },
// // // //         });
// // // //       }
// // // //     } catch (error) {
// // // //       console.error('Logout error:', error);
// // // //     } finally {
// // // //       // Clear local state regardless of server response
// // // //       setUser(null);
// // // //       setToken(null);
// // // //       localStorage.removeItem('auth_token');
// // // //       localStorage.removeItem('auth_user');
// // // //     }
// // // //   };

// // // //   const refreshToken = async () => {
// // // //     try {
// // // //       if (!token) {
// // // //         throw new Error('No token to refresh');
// // // //       }

// // // //       const response = await fetch(config.getApiUrl('/api/auth/refresh'), {
// // // //         method: 'POST',
// // // //         headers: {
// // // //           'Authorization': `Bearer ${token}`,
// // // //           'Content-Type': 'application/json',
// // // //         },
// // // //       });

// // // //       const data = await response.json();

// // // //       if (!response.ok) {
// // // //         throw new Error(data.message || 'Token refresh failed');
// // // //       }

// // // //       const { token: newToken } = data;
// // // //       setToken(newToken);
// // // //       localStorage.setItem('auth_token', newToken);
// // // //     } catch (error) {
// // // //       console.error('Token refresh failed:', error);
// // // //       // If refresh fails, logout user
// // // //       logout();
// // // //       throw error;
// // // //     }
// // // //   };

// // // //   const value: AuthContextType = {
// // // //     user,
// // // //     token,
// // // //     isAuthenticated,
// // // //     isLoading,
// // // //     login,
// // // //     logout,
// // // //     refreshToken,
// // // //     checkAuth,
// // // //   };

// // // //   return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
// // // // }; 
// // // "use client";

// // // import React, { createContext, useContext, ReactNode } from 'react';
// // // import { useUser } from '@auth0/nextjs-auth0';

// // // export interface User {
// // //   id: string;
// // //   username: string;
// // //   email?: string;
// // //   firstName?: string;
// // //   lastName?: string;
// // //   role?: string;
// // //   createdAt: string;
// // // }

// // // export interface AuthContextType {
// // //   user: User | null;
// // //   token: string | null;
// // //   isAuthenticated: boolean;
// // //   isLoading: boolean;
// // //   login: () => void;
// // //   logout: () => void;
// // //   refreshToken: () => Promise<void>;
// // //   checkAuth: () => Promise<void>;
// // //   getToken: () => Promise<string | null>;
// // // }

// // // const AuthContext = createContext<AuthContextType | undefined>(undefined);

// // // export const useAuth = () => {
// // //   const context = useContext(AuthContext);
// // //   if (context === undefined) {
// // //     throw new Error('useAuth must be used within an AuthProvider');
// // //   }
// // //   return context;
// // // };

// // // export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
// // //   const { user: auth0User, isLoading } = useUser();

// // //   // Map Auth0 user shape to your existing User interface
// // //   const user: User | null = auth0User
// // //     ? {
// // //         id: auth0User.sub ?? '',
// // //         username: auth0User.nickname ?? auth0User.email ?? '',
// // //         email: auth0User.email ?? '',
// // //         firstName: auth0User.given_name ?? '',
// // //         lastName: auth0User.family_name ?? '',
// // //         role: (auth0User['role'] as string) ?? 'professor',
// // //         createdAt: auth0User.updated_at ?? new Date().toISOString(),
// // //       }
// // //     : null;

// // //   const isAuthenticated = !!auth0User;

// // //   // Login now just redirects to Auth0
// // //   const login = () => {
// // //     window.location.href = '/auth/login';
// // //   };

// // //   // Logout redirects to Auth0 logout
// // //   const logout = () => {
// // //     window.location.href = '/auth/logout';
// // //   };

// // //   // No-ops — Auth0 handles tokens and session checks automatically
// // //   const refreshToken = async () => {};
// // //   const checkAuth = async () => {};
// // //   const getToken = async (): Promise<string | null> => {
// // //     try {
// // //       const response = await fetch('/auth/token');
// // //       const data = await response.json();
// // //       return data.token ?? null;
// // //     } catch {
// // //       return null;
// // //     }
// // //   };

// // //   const value: AuthContextType = {
// // //     user,
// // //     token: null, // Auth0 manages tokens internally — no need to expose them
// // //     isAuthenticated,
// // //     isLoading,
// // //     login,
// // //     logout,
// // //     refreshToken,
// // //     checkAuth,
// // //     getToken,
// // //   };

// // //   return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
// // // };

// // "use client";

// // import React, { createContext, useContext, useEffect, ReactNode } from 'react';
// // import { useUser } from '@auth0/nextjs-auth0';

// // export interface User {
// //   id: string;
// //   username: string;
// //   email?: string;
// //   firstName?: string;
// //   lastName?: string;
// //   role?: string;
// //   createdAt: string;
// // }

// // export interface AuthContextType {
// //   user: User | null;
// //   token: string | null;
// //   isAuthenticated: boolean;
// //   isLoading: boolean;
// //   login: () => void;
// //   logout: () => void;
// //   refreshToken: () => Promise<void>;
// //   checkAuth: () => Promise<void>;
// //   getToken: () => Promise<string | null>;
// // }

// // const AuthContext = createContext<AuthContextType | undefined>(undefined);

// // export const useAuth = () => {
// //   const context = useContext(AuthContext);
// //   if (context === undefined) {
// //     throw new Error('useAuth must be used within an AuthProvider');
// //   }
// //   return context;
// // };

// // export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
// //   const { user: auth0User, isLoading } = useUser();

// //   const user: User | null = auth0User ? {
// //     id: auth0User.sub ?? '',
// //     username: auth0User.nickname ?? auth0User.email ?? '',
// //     email: auth0User.email ?? '',
// //     firstName: auth0User.given_name ?? '',
// //     lastName: auth0User.family_name ?? '',
// //     role: (auth0User['role'] as string) ?? 'professor',
// //     createdAt: auth0User.updated_at ?? new Date().toISOString(),
// //   } : null;

// //   const isAuthenticated = !!auth0User;

// //   const getToken = async (): Promise<string | null> => {
// //     try {
// //       const response = await fetch('/auth/access-token');
// //       if (!response.ok) {
// //         // Session gone — redirect to login like the old checkAuth did
// //         window.location.href = '/auth/login';
// //         return null;
// //       }
// //       const data = await response.json();
// //       return data.token ?? null;
// //     } catch {
// //       window.location.href = '/auth/login';
// //       return null;
// //     }
// //   };

// //   // Sync Auth0 user to your DB on every login
// //   useEffect(() => {
// //     if (auth0User && !isLoading) {
// //       getToken().then(accessToken => {
// //         if (!accessToken) return;
// //         fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/sync-user`, {
// //           method: 'POST',
// //           headers: {
// //             'Content-Type': 'application/json',
// //             'Authorization': `Bearer ${accessToken}`,
// //           },
// //           body: JSON.stringify({
// //             auth0_id: auth0User.sub,
// //             email: auth0User.email ?? '',
// //             first_name: auth0User.given_name ?? '',
// //             last_name: auth0User.family_name ?? '',
// //             role: (auth0User['role'] as string) ?? 'professor',
// //           }),
// //         }).catch(err => console.error('sync-user failed:', err));
// //       });
// //     }
// //   }, [auth0User, isLoading]);

// //   const login = () => { window.location.href = '/auth/login'; };
// //   const logout = () => { window.location.href = '/auth/logout'; };
// //   const refreshToken = async () => {};
// //   const checkAuth = async () => {};

// //   const value: AuthContextType = {
// //     user,
// //     token: null,
// //     isAuthenticated,
// //     isLoading,
// //     login,
// //     logout,
// //     refreshToken,
// //     checkAuth,
// //     getToken,
// //   };

// //   return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
// // };

// "use client";

// import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
// import { useUser } from '@auth0/nextjs-auth0';

// export interface User {
//   id: string;
//   username: string;
//   email?: string;
//   firstName?: string;
//   lastName?: string;
//   role?: string;
//   createdAt: string;
// }

// export interface AuthContextType {
//   user: User | null;
//   token: string | null;
//   isAuthenticated: boolean;
//   isLoading: boolean;
//   login: () => void;
//   logout: () => void;
//   refreshToken: () => Promise<void>;
//   checkAuth: () => Promise<void>;
//   getToken: () => Promise<string | null>;
// }

// const AuthContext = createContext<AuthContextType | undefined>(undefined);

// export const useAuth = () => {
//   const context = useContext(AuthContext);
//   if (context === undefined) {
//     throw new Error('useAuth must be used within an AuthProvider');
//   }
//   return context;
// };

// export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
//   const { user: auth0User, isLoading } = useUser();

//   // FIX 2: Store the real DB user ID from sync-user response.
//   // auth0User.sub is Auth0's internal ID (e.g. "auth0|abc123") — it will never
//   // match course.user_id which is your Postgres UUID/integer. We capture the
//   // real DB id here so isOwner checks work correctly everywhere.
//   const [dbUserId, setDbUserId] = useState<string | null>(null);

//   // FIX 1: Wrap getToken in useCallback with no dependencies.
//   // Without this, a new function reference is created on every render, which
//   // causes every useCallback/useEffect that depends on getToken to re-run
//   // on every render → infinite fetch loops → broken navigation.
//   // const getToken = useCallback(async (): Promise<string | null> => {
//   //   try {
//   //     const response = await fetch('/auth/access-token');
//   //     if (!response.ok) {
//   //       // Session gone — redirect to login like the old checkAuth did
//   //       window.location.href = '/auth/login';
//   //       return null;
//   //     }
//   //     const data = await response.json();
//   //     return data.token ?? null;
//   //   } catch {
//   //     window.location.href = '/auth/login';
//   //     return null;
//   //   }
//   // }, []); // stable — no deps needed, fetch is a global
//   const tokenCacheRef = React.useRef<{ token: string; fetchedAt: number } | null>(null);

//   const tokenFetchInFlightRef = React.useRef<Promise<string | null> | null>(null);

//   // const getToken = useCallback(async (): Promise<string | null> => {
//   //   // Return cached token if less than 30 seconds old
//   //   if (tokenCacheRef.current && Date.now() - tokenCacheRef.current.fetchedAt < 30000) {
//   //     return tokenCacheRef.current.token;
//   //   }
//   //   try {
//   //     const response = await fetch('/auth/access-token');
//   //     if (!response.ok) {
//   //       window.location.href = '/auth/login';
//   //       return null;
//   //     }
//   //     const data = await response.json();
//   //     const token = data.token ?? null;
//   //     if (token) {
//   //       tokenCacheRef.current = { token, fetchedAt: Date.now() };
//   //     }
//   //     return token;
//   //   } catch {
//   //     window.location.href = '/auth/login';
//   //     return null;
//   //   }
//   // }, []); // stable — no deps
//   const getToken = useCallback(async (): Promise<string | null> => {
//     // if (tokenCacheRef.current && Date.now() - tokenCacheRef.current.fetchedAt < 30000) {
//     //   return tokenCacheRef.current.token;
//     // }
//     // If a fetch is already in flight, return that same promise
//     if (tokenCacheRef.current && Date.now() - tokenCacheRef.current.fetchedAt < 5000) {
//       return tokenCacheRef.current.token;
//     }
//     if (tokenFetchInFlightRef.current) {
//       return tokenFetchInFlightRef.current;
//     }
//     const fetchPromise = (async () => {
//       try {
//         const response = await fetch('/auth/access-token');
//         if (!response.ok) {
//           window.location.href = '/auth/login';
//           return null;
//         }
//         const data = await response.json();
//         const token = data.token ?? null;
//         if (token) tokenCacheRef.current = { token, fetchedAt: Date.now() };
//         return token;
//       } catch {
//         window.location.href = '/auth/login';
//         return null;
//       } finally {
//         tokenFetchInFlightRef.current = null;
//       }
//     })();
//     tokenFetchInFlightRef.current = fetchPromise;
//     return fetchPromise;
//   }, []);

//   // Sync Auth0 user to your DB on every login and capture the DB user id
//   useEffect(() => {
//     if (auth0User && !isLoading) {
//       getToken().then(accessToken => {
//         if (!accessToken) return;
//         fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/sync-user`, {
//           method: 'POST',
//           headers: {
//             'Content-Type': 'application/json',
//             'Authorization': `Bearer ${accessToken}`,
//           },
//           body: JSON.stringify({
//             auth0_id: auth0User.sub,
//             email: auth0User.email ?? '',
//             first_name: auth0User.given_name ?? '',
//             last_name: auth0User.family_name ?? '',
//             role: (auth0User['role'] as string) ?? 'professor',
//           }),
//         })
//           .then(res => res.json())
//           .then(data => {
//             // sync-user returns user_to_response(user) → { id: '...', username: '...', ... }
//             if (data?.id) {
//               setDbUserId(String(data.id));
//             }
//           })
//           .catch(err => console.error('sync-user failed:', err));
//       });
//     }
//   }, [auth0User, isLoading, getToken]);

//   // FIX 2 cont: Use dbUserId as user.id so course.user_id === user.id works.
//   // Falls back to auth0User.sub only if DB sync hasn't completed yet.
//   const user: User | null = auth0User
//     ? {
//         id: dbUserId ?? auth0User.sub ?? '',
//         username: auth0User.nickname ?? auth0User.email ?? '',
//         email: auth0User.email ?? '',
//         firstName: auth0User.given_name ?? '',
//         lastName: auth0User.family_name ?? '',
//         role: (auth0User['role'] as string) ?? 'professor',
//         createdAt: auth0User.updated_at ?? new Date().toISOString(),
//       }
//     : null;

//   const isAuthenticated = !!auth0User;

//   const login = () => { window.location.href = '/auth/login'; };
//   const logout = () => { window.location.href = '/auth/logout'; };
//   const refreshToken = async () => {};
//   const checkAuth = async () => {};

//   const value: AuthContextType = {
//     user,
//     token: null,
//     isAuthenticated,
//     isLoading,
//     login,
//     logout,
//     refreshToken,
//     checkAuth,
//     getToken,
//   };

//   return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
// };
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
