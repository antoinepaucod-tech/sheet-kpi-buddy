import { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AuthContext = createContext({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {},
  updateClubName: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("kpi-token");
    if (savedToken) {
      setToken(savedToken);
      axios.defaults.headers.common["Authorization"] = `Bearer ${savedToken}`;
      // Verify token
      axios.get(`${API}/auth/me`)
        .then((res) => {
          setUser(res.data);
        })
        .catch(() => {
          // Token invalid, clear it
          localStorage.removeItem("kpi-token");
          setToken(null);
          delete axios.defaults.headers.common["Authorization"];
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await axios.post(`${API}/auth/login`, { email, password });
    const { access_token, user: userData } = res.data;
    
    localStorage.setItem("kpi-token", access_token);
    axios.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
    setToken(access_token);
    setUser(userData);
    
    return userData;
  }, []);

  const register = useCallback(async (email, password, clubName) => {
    const res = await axios.post(`${API}/auth/register`, {
      email,
      password,
      club_name: clubName,
    });
    const { access_token, user: userData } = res.data;
    
    localStorage.setItem("kpi-token", access_token);
    axios.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
    setToken(access_token);
    setUser(userData);
    
    return userData;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("kpi-token");
    delete axios.defaults.headers.common["Authorization"];
    setToken(null);
    setUser(null);
  }, []);

  const updateClubName = useCallback(async (newName) => {
    await axios.put(`${API}/auth/club-name`, { club_name: newName });
    setUser((prev) => ({ ...prev, club_name: newName }));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        updateClubName,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
