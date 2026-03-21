import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function useMonthlyKPIData() {
  const [kpis, setKpis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { activeClubId, isAuthenticated } = useAuth();

  const fetchKpis = useCallback(async () => {
    if (!isAuthenticated || !activeClubId) {
      setKpis([]);
      setLoading(false);
      return;
    }
    try {
      const res = await axios.get(`${API}/monthly-kpis`);
      setKpis(res.data);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, activeClubId]);

  useEffect(() => {
    fetchKpis();
    const interval = setInterval(fetchKpis, 30000);
    return () => clearInterval(interval);
  }, [fetchKpis]);

  const getKpiByMonth = (month) => kpis.find((k) => k.month === month) || null;

  const getPreviousKpi = (month) => {
    const idx = kpis.findIndex((k) => k.month === month);
    return idx > 0 ? kpis[idx - 1] : null;
  };

  return { kpis, loading, error, refetch: fetchKpis, getKpiByMonth, getPreviousKpi };
}
