import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import ProtectedRoute from "@/components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Index from "./pages/Index";
import Annual from "./pages/Annual";
import CustomerJourney from "./pages/CustomerJourney";
import KPIClient from "./pages/KPIClient";
import CourseKPI from "./pages/CourseKPI";
import Accounting from "./pages/Accounting";
import Tutorial from "./pages/Tutorial";
import ExpiringSubscriptions from "./pages/ExpiringSubscriptions";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedLayout = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-10 flex h-12 sm:h-14 items-center gap-2 sm:gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-2 sm:px-4">
            <SidebarTrigger />
          </header>
          <main className="flex-1 overflow-x-hidden">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
            <Route path="/kpi-revenue" element={<ProtectedLayout><Index /></ProtectedLayout>} />
            <Route path="/annual" element={<ProtectedLayout><Annual /></ProtectedLayout>} />
            <Route path="/course-kpi" element={<ProtectedLayout><CourseKPI /></ProtectedLayout>} />
            <Route path="/accounting" element={<ProtectedLayout><Accounting /></ProtectedLayout>} />
            <Route path="/customer-journey" element={<ProtectedLayout><CustomerJourney /></ProtectedLayout>} />
            <Route path="/kpi-client" element={<ProtectedLayout><KPIClient /></ProtectedLayout>} />
            <Route path="/expiring-subscriptions" element={<ProtectedLayout><ExpiringSubscriptions /></ProtectedLayout>} />
            <Route path="/tutorial" element={<ProtectedLayout><Tutorial /></ProtectedLayout>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;