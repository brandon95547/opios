// Who is signed in, for every page.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, onSignedOut } from './api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, user: null, needsSetup: false });

  const refresh = useCallback(() => api.get('/api/auth/state')
    .then((s) => setState({ loading: false, user: s.user, needsSetup: s.needsSetup }))
    .catch(() => setState({ loading: false, user: null, needsSetup: false })), []);

  useEffect(() => {
    refresh();
    // A session that ran out while a page was open: back to the sign-in page.
    onSignedOut(() => setState((s) => ({ ...s, user: null })));
  }, [refresh]);

  const value = {
    ...state,
    async signIn(username, password) {
      const { user } = await api.post('/api/auth/login', { username, password });
      setState({ loading: false, user, needsSetup: false });
    },
    async setUp(username, password) {
      const { user } = await api.post('/api/auth/setup', { username, password });
      setState({ loading: false, user, needsSetup: false });
    },
    async signOut() {
      await api.post('/api/auth/logout').catch(() => {});
      setState({ loading: false, user: null, needsSetup: false });
    },
    setUser: (user) => setState((s) => ({ ...s, user })),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
