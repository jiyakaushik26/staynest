import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { user, logout, isHost } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="navbar">
      <Link to="/" className="brand">
        Stay<span>Nest</span>
      </Link>
      <nav className="nav-links">
        <NavLink to="/" end>Explore</NavLink>
        {user && <NavLink to="/trips">My Trips</NavLink>}
        {user && <NavLink to="/wishlist">Wishlist</NavLink>}
        {isHost && <NavLink to="/host">Host Dashboard</NavLink>}
        {user ? (
          <>
            <span className="muted">Hi, {user.name.split(' ')[0]}</span>
            <button className="btn btn-ghost" onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <NavLink to="/login" className="btn">Login</NavLink>
        )}
      </nav>
    </header>
  );
}
