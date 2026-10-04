import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/client.js';

const AuthContext = createContext(null);
const STORAGE_KEY = 'staynest_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  });

  const [wishlist, setWishlist] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed.wishlist) ? parsed.wishlist.map(String) : [];
    } catch {
      return [];
    }
  });

  const saveUser = (data) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setUser(data);
    if (Array.isArray(data.wishlist)) {
      setWishlist(data.wishlist.map(String));
    }
  };

  useEffect(() => {
    if (!user) {
      setWishlist([]);
      return;
    }
    api.get('/wishlist')
      .then(({ data }) => {
        if (Array.isArray(data)) {
          const ids = data.map((item) => (item._id || item).toString());
          setWishlist(ids);
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              parsed.wishlist = ids;
              localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
            } catch {}
          }
        }
      })
      .catch(() => {});
  }, [user?._id]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    saveUser(data);
    return data;
  };

  const register = async (name, email, password, role) => {
    const { data } = await api.post('/auth/register', { name, email, password, role });
    saveUser(data);
    return data;
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setWishlist([]);
  };

  const toggleWishlist = async (listingId) => {
    if (!user) return false;
    const { data } = await api.post(`/wishlist/${listingId}`);
    const updatedIds = (data.wishlist || []).map((id) => (id._id || id).toString());
    setWishlist(updatedIds);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        parsed.wishlist = updatedIds;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      } catch {}
    }
    return data.isWishlisted;
  };

  const isWishlisted = (listingId) => {
    if (!listingId) return false;
    return wishlist.includes(listingId.toString());
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        logout,
        isHost: user?.role === 'host',
        wishlist,
        toggleWishlist,
        isWishlisted,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
