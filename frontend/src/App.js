import { useState, useEffect, useMemo } from "react";import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "./contexts/LanguageContext";
import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import TransactionsPage from "./pages/TransactionsPage";
import { useMonthlyKPIData } from "./hooks/useMonthlyKPIData";
import { formatMonthFull } from "./utils/format";
import { useTranslations } from "./hooks/useTranslations";
import axios from "axios";
import "@/App.css";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function AppInner() {
  const { t, lang } = useTranslations();
  const { kpis } = useMonthlyKPIData();
  const [selectedMonth, setSelectedMonth] = useState("");

  // Auto-seed if no data
  useEffect(() => {
    axios.get(`${API}/init`).then((res) => {
      if (!res.data.has_data) {
        axios.post(`${API}/seed`).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  // Set default month to latest
  useEffect(() => {
    if (kpis.length > 0 && !selectedMonth) {
      setSelectedMonth(kpis[kpis.length - 1].month);
    }
  }, [kpis, selectedMonth]);

  const availableMonths = useMemo(
    () =>
      kpis.map((k) => ({
        value: k.month,
        label: formatMonthFull(k.month, lang),
      })).reverse(),
    [kpis, lang]
  );

  return (
    <BrowserRouter>
      <Layout
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        availableMonths={availableMonths}
      >
        <Routes>
          <Route path="/" element={<Dashboard selectedMonth={selectedMonth} />} />
          <Route path="/transactions" element={<TransactionsPage selectedMonth={selectedMonth} />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <LanguageProvider>
      <AppInner />
    </LanguageProvider>
  );
}

export default App;
