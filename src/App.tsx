import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { Sidebar, MobileNav, MobileTopBar } from '@/components/Navigation';
import { ReportIncidentModal } from '@/components/ReportIncidentModal';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { IncidentsPage } from '@/pages/IncidentsPage';
import { IncidentDetailPage } from '@/pages/IncidentDetailPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { UsersPage } from '@/pages/UsersPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { Loader2 } from 'lucide-react';

function AppShell() {
  const { profile, loading } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-50">
        <Loader2 className="w-6 h-6 animate-spin text-ink-400" />
      </div>
    );
  }

  if (!profile) {
    return <LoginPage />;
  }

  const openReport = () => setReportOpen(true);

  return (
    <div className="min-h-screen bg-ink-50">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col">
        <Sidebar />
      </div>

      {/* Mobile top bar */}
      <MobileTopBar onMenu={() => setMobileNavOpen(true)} />

      {/* Mobile nav drawer */}
      <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      {/* Main content */}
      <div className="lg:pl-64">
        <main className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
          <Routes>
            <Route path="/" element={<DashboardPage onReport={openReport} />} />
            <Route path="/incidents" element={<IncidentsPage onReport={openReport} />} />
            <Route path="/incidents/:id" element={<IncidentDetailPage />} />
            <Route path="/my-incidents" element={<IncidentsPage initialView="mine" onReport={openReport} />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      {/* Floating report button on mobile */}
      <button
        onClick={openReport}
        className="lg:hidden fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-brand-600 text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        aria-label="Report incident"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      <ReportIncidentModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onCreated={() => setReportOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppShell />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
