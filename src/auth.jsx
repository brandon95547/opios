// Who is signed in, for every page.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, onSignedOut } from './api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, user: null, needsSetup: false, setup: null });

  const refresh = useCallback(() => api.get('/api/auth/state')
    .then((s) => setState({ loading: false, user: s.user, needsSetup: s.needsSetup, setup: s.setup }))
    .catch(() => setState({ loading: false, user: null, needsSetup: false, setup: null })), []);

  useEffect(() => {
    refresh();
    // A session that ran out while a page was open: back to the sign-in page.
    onSignedOut(() => setState((s) => ({ ...s, user: null })));
  }, [refresh]);

  const value = {
    ...state,
    async signIn(username, password) {
      const { user } = await api.post('/api/auth/login', { username, password });
      setState({ loading: false, user, needsSetup: false, setup: null });
    },
    async setUp(username, password, setupCode) {
      const { user } = await api.post('/api/auth/setup', { username, password, setupCode });
      setState({ loading: false, user, needsSetup: false, setup: null });
    },
    async signOut() {
      await api.post('/api/auth/logout').catch(() => {});
      setState({ loading: false, user: null, needsSetup: false, setup: null });
    },
    setUser: (user) => setState((s) => ({ ...s, user })),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
