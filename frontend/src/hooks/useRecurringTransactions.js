import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function useRecurringTransactions() {
  const [recurring, setRecurring] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRecurring = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/recurring-transactions/all`);
      setRecurring(res.data);
    } catch (e) {
      console.error("Error fetching recurring transactions", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecurring();
  }, [fetchRecurring]);

  const addRecurring = async (data) => {
    const res = await axios.post(`${API}/recurring-transactions`, data);
    await fetchRecurring();
    return res.data;
  };

  const updateRecurring = async (id, data) => {
    const res = await axios.put(`${API}/recurring-transactions/${id}`, data);
    await fetchRecurring();
    return res.data;
  };

  const deleteRecurring = async (id) => {
    await axios.delete(`${API}/recurring-transactions/${id}`);
    await fetchRecurring();
  };

  const generateMonthly = async (year, month) => {
    const res = await axios.post(`${API}/recurring-transactions/generate/${year}/${month}`);
    return res.data;
  };

  return {
    recurring,
    loading,
    refetch: fetchRecurring,
    addRecurring,
    updateRecurring,
    deleteRecurring,
    generateMonthly,
  };
}
