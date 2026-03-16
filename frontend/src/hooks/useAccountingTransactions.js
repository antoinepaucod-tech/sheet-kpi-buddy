import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function useAccountingTransactions(month = null) {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [excluded, setExcluded] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = month ? { params: { month } } : {};
      const [txRes, catRes, exclRes] = await Promise.all([
        axios.get(`${API}/transactions`, params),
        axios.get(`${API}/categories`),
        axios.get(`${API}/excluded`),
      ]);
      setTransactions(txRes.data);
      setCategories(catRes.data);
      setExcluded(exclRes.data);
    } catch (e) {
      console.error("Error fetching transactions", e);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const addTransaction = async (data) => {
    const res = await axios.post(`${API}/transactions`, data);
    await fetchAll();
    return res.data;
  };

  const updateTransaction = async (id, data) => {
    const res = await axios.put(`${API}/transactions/${id}`, data);
    await fetchAll();
    return res.data;
  };

  const deleteTransaction = async (id) => {
    await axios.delete(`${API}/transactions/${id}`);
    await fetchAll();
  };

  const removeFromExclusions = async (id) => {
    await axios.delete(`${API}/excluded/${id}`);
    await fetchAll();
  };

  return {
    transactions,
    categories,
    excluded,
    loading,
    refetch: fetchAll,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    removeFromExclusions,
  };
}
