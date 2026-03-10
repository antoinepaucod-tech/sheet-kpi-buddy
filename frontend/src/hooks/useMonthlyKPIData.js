import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function useMonthlyKPIData() {
  const [kpis, setKpis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchKpis = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/monthly-kpis`);
      setKpis(res.data);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

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
