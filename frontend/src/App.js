import { useState, useEffect, useMemo } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import MembersPage from "./pages/MembersPage";
import ChallengePage from "./pages/ChallengePage";
import CoursesPage from "./pages/CoursesPage";
import ClientKPIPage from "./pages/ClientKPIPage";
import PaymentsPage from "./pages/PaymentsPage";
import OnboardingPage from "./pages/OnboardingPage";
import AnnualReviewsPage from "./pages/AnnualReviewsPage";
import SettingsTypesPage from "./pages/SettingsTypesPage";
import CoachesPage from "./pages/CoachesPage";
import AttendancePage from "./pages/AttendancePage";
import NotificationsPage from "./pages/NotificationsPage";
import MonthlyBudgetPage from "./pages/MonthlyBudgetPage";
import FranchiseDashboard from "./pages/FranchiseDashboard";
import MetaHelpPage from "./pages/MetaHelpPage";
import ArchivesPage from "./pages/ArchivesPage";
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
      axios.get(`${API}/init`).catch(() => {});
    }
  }, [isAuthenticated]);

  const currentMonth = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    if (kpis.length > 0 && !selectedMonth) {
      setSelectedMonth(currentMonth);
    } else if (kpis.length === 0 && !selectedMonth) {
      setSelectedMonth(currentMonth);
    }
  }, [kpis, selectedMonth, currentMonth]);

  const availableMonths = useMemo(() => {
    // Collect DB months
    const dbMonths = new Set(kpis.map((k) => k.month));

    // Generate months: from earliest DB month (or 12 months ago) to 12 months in the future
    const now = new Date();
    const futureLimit = new Date(now.getFullYear() + 1, now.getMonth(), 1);

    let startDate;
    if (kpis.length > 0) {
      const earliest = kpis[0].month;
      const [y, m] = earliest.split("-").map(Number);
      startDate = new Date(y, m - 1, 1);
    } else {
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    }

    const months = [];
    const d = new Date(startDate);
    while (d <= futureLimit) {
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({ value: val, label: formatMonthFull(val, lang) });
      d.setMonth(d.getMonth() + 1);
    }

    return months.reverse();
  }, [kpis, lang]);

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
                  <Route path="/members" element={<MembersPage />} />
                  <Route path="/challenge" element={<ChallengePage />} />
                  <Route path="/courses" element={<CoursesPage />} />
                  <Route path="/clients" element={<ClientKPIPage />} />
                  <Route path="/attendance" element={<AttendancePage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/payments" element={<PaymentsPage />} />
                  <Route path="/onboarding" element={<OnboardingPage />} />
                  <Route path="/annual-reviews" element={<AnnualReviewsPage />} />
                  <Route path="/categories" element={<CategoriesPage />} />
                  <Route path="/budget" element={<MonthlyBudgetPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/settings/types" element={<SettingsTypesPage />} />
                  <Route path="/coaches" element={<CoachesPage />} />
                  <Route path="/franchise" element={<FranchiseDashboard />} />
                  <Route path="/meta-help" element={<MetaHelpPage />} />
                  <Route path="/archives" element={<ArchivesPage />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

// Create QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LanguageProvider>
          <AppInner />
        </LanguageProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
