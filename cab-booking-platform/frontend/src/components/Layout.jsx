import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">🚖 Cab Platform</Link>
        <nav className="nav">
          <NavLink to="/bookings"      className="nav-link">Bookings</NavLink>
          <NavLink to="/payments"      className="nav-link">Payments</NavLink>
          <NavLink to="/favourites"    className="nav-link">Favourites</NavLink>
          <NavLink to="/notifications" className="nav-link">Inbox</NavLink>
        </nav>
        <div className="user-area">
          {user && <span className="user-email">{user.email}</span>}
          <button className="btn-link" onClick={handleLogout}>Log out</button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
