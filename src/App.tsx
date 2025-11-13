import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import Dashboard from "./pages/Dashboard";
import Index from "./pages/Index";
import Annual from "./pages/Annual";
import CustomerJourney from "./pages/CustomerJourney";
import KPIClient from "./pages/KPIClient";
import CourseKPI from "./pages/CourseKPI";
import Accounting from "./pages/Accounting";
import Tutorial from "./pages/Tutorial";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <SidebarProvider>
            <div className="flex min-h-screen w-full">
              <AppSidebar />
              <div className="flex-1 flex flex-col min-w-0">
                <header className="sticky top-0 z-10 flex h-12 sm:h-14 items-center gap-2 sm:gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-2 sm:px-4">
                  <SidebarTrigger />
                </header>
                <main className="flex-1 overflow-x-hidden">
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/kpi-revenue" element={<Index />} />
                    <Route path="/annual" element={<Annual />} />
                    <Route path="/course-kpi" element={<CourseKPI />} />
                    <Route path="/accounting" element={<Accounting />} />
                    <Route path="/customer-journey" element={<CustomerJourney />} />
                    <Route path="/kpi-client" element={<KPIClient />} />
                    <Route path="/tutorial" element={<Tutorial />} />
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </main>
              </div>
            </div>
          </SidebarProvider>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
