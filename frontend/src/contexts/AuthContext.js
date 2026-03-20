import { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AuthContext = createContext({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  activeClubId: null,
  clubs: [],
  login: async () => {},
  register: async () => {},
  logout: () => {},
  updateClubName: async () => {},
  switchClub: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeClubId, setActiveClubId] = useState(null);
  const [clubs, setClubs] = useState([]);

  // Set X-Club-Id header whenever activeClubId changes
  useEffect(() => {
    if (activeClubId) {
      axios.defaults.headers.common["X-Club-Id"] = activeClubId;
      localStorage.setItem("kpi-active-club", activeClubId);
    }
  }, [activeClubId]);

  // Load clubs for the user
  const loadClubs = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/clubs`);
      setClubs(res.data);
    } catch {
      setClubs([]);
    }
  }, []);

  // Load token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("kpi-token");
    if (savedToken) {
      setToken(savedToken);
      axios.defaults.headers.common["Authorization"] = `Bearer ${savedToken}`;

      // Restore active club from localStorage
      const savedClub = localStorage.getItem("kpi-active-club");
      if (savedClub) {
        setActiveClubId(savedClub);
        axios.defaults.headers.common["X-Club-Id"] = savedClub;
      }

      // Verify token
      axios.get(`${API}/auth/me`)
        .then((res) => {
          setUser(res.data);
          const clubId = savedClub || res.data.active_club_id;
          if (clubId) {
            setActiveClubId(clubId);
            axios.defaults.headers.common["X-Club-Id"] = clubId;
          }
          // Load clubs list
          loadClubs();
        })
        .catch(() => {
          localStorage.removeItem("kpi-token");
          localStorage.removeItem("kpi-active-club");
          setToken(null);
          delete axios.defaults.headers.common["Authorization"];
          delete axios.defaults.headers.common["X-Club-Id"];
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [loadClubs]);

  const login = useCallback(async (email, password) => {
    const res = await axios.post(`${API}/auth/login`, { email, password });
    const { access_token, user: userData } = res.data;

    localStorage.setItem("kpi-token", access_token);
    axios.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
    setToken(access_token);
    setUser(userData);

    // Set active club
    const clubId = userData.active_club_id;
    if (clubId) {
      setActiveClubId(clubId);
      axios.defaults.headers.common["X-Club-Id"] = clubId;
      localStorage.setItem("kpi-active-club", clubId);
    }

    // Load clubs
    setTimeout(() => loadClubs(), 100);

    return userData;
  }, [loadClubs]);

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

    const clubId = userData.active_club_id;
    if (clubId) {
      setActiveClubId(clubId);
      axios.defaults.headers.common["X-Club-Id"] = clubId;
      localStorage.setItem("kpi-active-club", clubId);
    }

    return userData;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("kpi-token");
    localStorage.removeItem("kpi-active-club");
    delete axios.defaults.headers.common["Authorization"];
    delete axios.defaults.headers.common["X-Club-Id"];
    setToken(null);
    setUser(null);
    setActiveClubId(null);
    setClubs([]);
  }, []);

  const updateClubName = useCallback(async (newName) => {
    await axios.put(`${API}/auth/club-name`, { club_name: newName });
    setUser((prev) => ({ ...prev, club_name: newName }));
  }, []);

  const switchClub = useCallback(async (clubId) => {
    try {
      const res = await axios.put(`${API}/clubs/switch`, { club_id: clubId });
      setActiveClubId(clubId);
      axios.defaults.headers.common["X-Club-Id"] = clubId;
      localStorage.setItem("kpi-active-club", clubId);

      // Update user's club_name
      const clubName = res.data.club_name;
      setUser((prev) => ({ ...prev, active_club_id: clubId, club_name: clubName }));

      // Force page reload to refresh all data for new club
      window.location.reload();
    } catch (err) {
      console.error("Failed to switch club:", err);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        activeClubId,
        clubs,
        login,
        register,
        logout,
        updateClubName,
        switchClub,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
