import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { CRMProvider } from '@/context/CRMContext';
import { ToastProvider } from '@/context/ToastContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import { QueryProvider } from '@/lib/query';
import Layout from '@/components/Layout';
import { PageLoader } from '@/components/PageLoader';
import { DefaultRoute } from '@/components/DefaultRoute';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import JoinPage from '@/pages/JoinPage';
import SetupWizard from '@/pages/SetupWizard';

// Lazy load all pages for code splitting
const Dashboard = lazy(() => import('@/features/dashboard/DashboardPage'));
const BoardsPage = lazy(() =>
  import('@/features/boards/BoardsPage').then(m => ({ default: m.BoardsPage }))
);
const ContactsPage = lazy(() =>
  import('@/features/contacts/ContactsPage').then(m => ({ default: m.ContactsPage }))
);
const Settings = lazy(() => import('@/features/settings/SettingsPage'));
const InboxPage = lazy(() =>
  import('@/features/inbox/InboxPage').then(m => ({ default: m.InboxPage }))
);
const ActivitiesPage = lazy(() =>
  import('@/features/activities/ActivitiesPage').then(m => ({ default: m.ActivitiesPage }))
);
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage'));
const AIHubPage = lazy(() =>
  import('@/features/ai-hub/AIHubPage').then(m => ({ default: m.AIHubPage }))
);
const DecisionQueuePage = lazy(() =>
  import('@/features/decisions/DecisionQueuePage').then(m => ({ default: m.DecisionQueuePage }))
);
const ProfilePage = lazy(() =>
  import('@/features/profile/ProfilePage').then(m => ({ default: m.ProfilePage }))
);

// Layout wrapper for protected routes with persisted Suspense
const ProtectedLayout: React.FC = () => (
  <ProtectedRoute>
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </Layout>
  </ProtectedRoute>
);

import { AIProvider } from '@/context/AIContext';

const App: React.FC = () => {
  return (
    <QueryProvider>
      <ToastProvider>
        <ThemeProvider>
          <AuthProvider>
            <CRMProvider>
              <HashRouter>
                <AIProvider>
                  <Routes>
                    {/* Public routes */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/join" element={<JoinPage />} />
                    <Route path="/setup" element={<SetupWizard />} />

                    {/* Protected routes with Layout */}
                    <Route element={<ProtectedLayout />}>
                      <Route index element={<DefaultRoute />} />
                      <Route path="dashboard" element={<Dashboard />} />
                      <Route path="inbox" element={<InboxPage />} />
                      <Route path="boards" element={<BoardsPage />} />
                      <Route path="pipeline" element={<BoardsPage />} />
                      <Route path="contacts" element={<ContactsPage />} />
                      <Route path="settings/*" element={<Settings />} />
                      <Route path="activities" element={<ActivitiesPage />} />
                      <Route path="reports" element={<ReportsPage />} />
                      <Route path="profile" element={<ProfilePage />} />
                      <Route path="ai" element={<AIHubPage />} />
                      <Route path="decisions" element={<DecisionQueuePage />} />
                    </Route>

                    {/* Catch-all redirect */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </AIProvider>
              </HashRouter>
            </CRMProvider>
          </AuthProvider>
        </ThemeProvider>
      </ToastProvider>
    </QueryProvider>
  );
};

export default App;
