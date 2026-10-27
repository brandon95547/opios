// The frame around every page once signed in: the menu, and who is signed in.
import { useEffect, useState } from 'react';
import { NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router-dom';
import { House, LayoutTemplate, LogOut, Mail, Menu, Settings, Users, X } from 'lucide-react';
import { useAuth } from './auth.jsx';

const NAV = [
  { to: '/', label: 'Overview', icon: House, end: true },
  { to: '/messages', label: 'Messages', icon: Mail },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/templates', label: 'Templates', icon: LayoutTemplate },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Layout() {
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setMenuOpen(false), [location.pathname]);

  return (
    <div className="app">
      <aside className={menuOpen ? 'sidebar sidebar-open' : 'sidebar'}>
        <div className="sidebar-top">
          <NavLink to="/" className="brand">
            <span className="brand-mark" aria-hidden="true"><Mail size={18} strokeWidth={2.25} /></span>
            Opios
          </NavLink>
          <button type="button" className="icon-button menu-button" aria-expanded={menuOpen} aria-controls="main-menu" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen((o) => !o)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        <nav id="main-menu" className="nav" aria-label="Main">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="nav-link">
              <Icon size={18} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
          <div className="nav-user">
            <span className="nav-username" title={user?.username}>{user?.username}</span>
            <button type="button" className="nav-link nav-signout" onClick={signOut}>
              <LogOut size={18} aria-hidden="true" />
              Sign out
            </button>
          </div>
        </nav>
      </aside>
      <main className="main">
        <Outlet />
      </main>
      <ScrollRestoration />
    </div>
  );
}
