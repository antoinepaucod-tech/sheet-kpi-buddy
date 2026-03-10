import { useState, useEffect, useMemo } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "./contexts/LanguageContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import TransactionsPage from "./pages/TransactionsPage";
import CategoriesPage from "./pages/CategoriesPage";
import SettingsPage from "./pages/SettingsPage";
import RecurringPage from "./pages/RecurringPage";
import ComparePage from "./pages/ComparePage";
import AuthPage from "./pages/AuthPage";
import { useMonthlyKPIData } from "./hooks/useMonthlyKPIData";
import { formatMonthFull } from "./utils/format";
import { useTranslations } from "./hooks/useTranslations";
import { Loader2 } from "lucide-react";
import axios from "axios";
import "@/App.css";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Protected Route wrapper
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#09090B] flex items-center justify-center">
        <Loader2 className="animate-spin text-rose-500" size={32} />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }
  
  return children;
}

function AppInner() {
  const { lang } = useTranslations();
  const { isAuthenticated, isLoading, user } = useAuth();
  const { kpis } = useMonthlyKPIData();
  const [selectedMonth, setSelectedMonth] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      axios.get(`${API}/init`).then((res) => {
        if (!res.data.has_data) {
          axios.post(`${API}/seed`).catch(() => {});
        }
      }).catch(() => {});
    }
  }, [isAuthenticated]);

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#09090B] flex items-center justify-center">
        <Loader2 className="animate-spin text-rose-500" size={32} />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/auth" 
          element={isAuthenticated ? <Navigate to="/" replace /> : <AuthPage />} 
        />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout
                selectedMonth={selectedMonth}
                setSelectedMonth={setSelectedMonth}
                availableMonths={availableMonths}
              >
                <Routes>
                  <Route path="/" element={<Dashboard selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />} />
                  <Route path="/transactions" element={<TransactionsPage selectedMonth={selectedMonth} />} />
                  <Route path="/recurring" element={<RecurringPage />} />
                  <Route path="/compare" element={<ComparePage />} />
                  <Route path="/categories" element={<CategoriesPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <AuthProvider>
      <LanguageProvider>
        <AppInner />
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;
