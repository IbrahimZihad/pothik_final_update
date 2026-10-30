import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, refreshSession, setAccessToken, readData } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const profile = await readData(api.get('/auth/me'));
    setUser(profile);
    return profile;
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await refreshSession();
        const profile = await readData(api.get('/auth/me'));
        if (active) setUser(profile);
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(
    async (email, password) => {
      const data = await readData(api.post('/auth/login', { email, password }));
      setAccessToken(data.accessToken);
      setUser(data.user);
      return data.user;
    },
    []
  );

  const register = useCallback(async (payload) => {
    const data = await readData(api.post('/auth/register', payload));
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', {});
    } catch {
      /* the local session is cleared regardless */
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => loadUser(), [loadUser]);

  const value = useMemo(() => {
    const roles = user?.roles || [];
    return {
      user,
      roles,
      loading,
      login,
      register,
      logout,
      refreshUser,
      isAuthenticated: Boolean(user),
      hasRole: (...required) => required.some((role) => roles.includes(role)),
      isProvider: roles.some((role) => ['HOTEL_OWNER', 'TRANSPORT_PROVIDER', 'TOUR_GUIDE'].includes(role)),
      isAdmin: roles.includes('ADMIN'),
      providerType: user?.providerProfile?.type || null,
      providerStatus: user?.providerProfile?.status || null,
    };
  }, [user, loading, login, register, logout, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
