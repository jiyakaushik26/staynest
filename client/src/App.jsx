import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Home from './pages/Home.jsx';
import ListingDetail from './pages/ListingDetail.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Trips from './pages/Trips.jsx';
import Wishlist from './pages/Wishlist.jsx';
import HostDashboard from './pages/host/HostDashboard.jsx';
import ListingForm from './pages/host/ListingForm.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <>
      <Navbar />
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/stays/:id" element={<ListingDetail />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/trips" element={<Trips />} />
          </Route>
          <Route element={<ProtectedRoute hostOnly />}>
            <Route path="/host" element={<HostDashboard />} />
            <Route path="/host/listings/new" element={<ListingForm />} />
            <Route path="/host/listings/:id/edit" element={<ListingForm />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="footer">© {new Date().getFullYear()} StayNest · Open-source student project</footer>
    </>
  );
}
