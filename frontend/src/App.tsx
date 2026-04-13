import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { BarChart3, CircleDollarSign, HelpCircle } from 'lucide-react';
import Layout from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import Calls from './pages/Calls';
import Menu from './pages/Menu';
import Settings from './pages/Settings';
import Login from './pages/Login';
import { useAuth } from './lib/auth-context';
import { useRealtimeSync } from './lib/use-realtime';
import { AppLoadingSkeleton } from './components/skeletons';

const comingSoonPages: Record<string, { icon: React.ElementType; description: string }> = {
  Reports: {
    icon: BarChart3,
    description: 'Detailed analytics on call volume, order trends, and AI performance will appear here.',
  },
  Earnings: {
    icon: CircleDollarSign,
    description: 'Revenue breakdowns, payout history, and financial insights are on the way.',
  },
  Support: {
    icon: HelpCircle,
    description: 'Get help, submit tickets, and browse FAQs — all in one place.',
  },
};

function ComingSoon({ title }: { title: string }) {
  const page = comingSoonPages[title] ?? { icon: HelpCircle, description: '' };
  const Icon = page.icon;

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4 py-10 sm:px-6 sm:py-14 lg:p-8">
      <div className="glass-panel mx-auto w-full max-w-sm rounded-2xl p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Icon className="h-7 w-7 text-primary" />
        </div>
        <h2 className="mb-2 font-headline text-lg font-bold text-on-surface">
          {title}
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-on-surface-variant">
          {page.description}
        </p>
        <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
          Coming soon
        </span>
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return <AppLoadingSkeleton />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return <AppLoadingSkeleton />;
  }

  if (session) {
    return <Navigate to="/app/overview" replace />;
  }

  return <>{children}</>;
}

function App() {
  useRealtimeSync();

  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route
            path="/login"
            element={
              <RedirectIfAuthed>
                <Login />
              </RedirectIfAuthed>
            }
          />

          <Route
            path="/app"
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
            <Route path="calls" element={<ErrorBoundary><Calls /></ErrorBoundary>} />
            <Route path="menu" element={<ErrorBoundary><Menu /></ErrorBoundary>} />
            <Route path="reports" element={<ComingSoon title="Reports" />} />
            <Route path="earnings" element={<ComingSoon title="Earnings" />} />
            <Route path="settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
            <Route path="support" element={<ComingSoon title="Support" />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
