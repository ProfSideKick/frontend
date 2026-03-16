// import { useState, useEffect } from 'react';
// import { useAuth } from '@/contexts/AuthContext';

// export interface UserSession {
//   sessionId: string;
//   classDetails: {
//     className: string;
//     courseName: string;
//     courseCode: string;
//     description?: string;
//     duration: number;
//   };
//   status: string;
//   totalSlides: number;
//   createdAt: string;
//   updatedAt: string;
//   lastAccessedAt?: string;
//   runCount: number;
//   lastRunAt?: string;
// }

// export interface SessionsResponse {
//   sessions: UserSession[];
//   pagination: {
//     page: number;
//     limit: number;
//     total: number;
//     totalPages: number;
//   };
// }

// export interface UseUserSessionsOptions {
//   page?: number;
//   limit?: number;
//   status?: string;
//   sort?: string;
//   autoFetch?: boolean;
// }

// export function useUserSessions(options: UseUserSessionsOptions = {}) {
//   const { page = 1, limit = 10, status, sort = 'updated_desc', autoFetch = true } = options;
//   const { token } = useAuth();
  
//   const [data, setData] = useState<SessionsResponse | null>(null);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   const fetchSessions = async () => {
//     try {
//       setLoading(true);
//       setError(null);

//       if (!token) {
//         throw new Error('Not authenticated');
//       }

//       const searchParams = new URLSearchParams({
//         page: page.toString(),
//         limit: limit.toString(),
//         sort,
//       });

//       if (status) {
//         searchParams.append('status', status);
//       }

//       const response = await fetch(`/api/sessions?${searchParams.toString()}`, {
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//       });

//       if (!response.ok) {
//         const errorData = await response.json();
//         throw new Error(errorData.error || 'Failed to fetch sessions');
//       }

//       const sessionData = await response.json();
//       setData(sessionData);
//     } catch (err) {
//       const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
//       setError(errorMessage);
//       console.error('Error fetching user sessions:', err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     if (autoFetch) {
//       fetchSessions();
//     }
//   }, [page, limit, status, sort, autoFetch]);

//   return {
//     sessions: data?.sessions || [],
//     pagination: data?.pagination,
//     loading,
//     error,
//     refetch: fetchSessions,
//   };
// } 
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface UserSession {
  sessionId: string;
  classDetails: {
    className: string;
    courseName: string;
    courseCode: string;
    description?: string;
    duration: number;
  };
  status: string;
  totalSlides: number;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt?: string;
  runCount: number;
  lastRunAt?: string;
}

export interface SessionsResponse {
  sessions: UserSession[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface UseUserSessionsOptions {
  page?: number;
  limit?: number;
  status?: string;
  sort?: string;
  autoFetch?: boolean;
}

export function useUserSessions(options: UseUserSessionsOptions = {}) {
  const { page = 1, limit = 10, status, sort = 'updated_desc', autoFetch = true } = options;

  // ← KEY CHANGE
  const { getToken, isAuthenticated, isLoading } = useAuth();

  const [data, setData] = useState<SessionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = async () => {
    if (isLoading || !isAuthenticated) return;

    try {
      setLoading(true);
      setError(null);

      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const searchParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sort,
      });
      if (status) searchParams.append('status', status);

      const response = await fetch(`/api/sessions?${searchParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch sessions');
      }

      setData(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('Error fetching user sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoFetch && isAuthenticated && !isLoading) {
      fetchSessions();
    }
  }, [page, limit, status, sort, autoFetch, isAuthenticated, isLoading]);

  return {
    sessions: data?.sessions || [],
    pagination: data?.pagination,
    loading,
    error,
    refetch: fetchSessions,
  };
}