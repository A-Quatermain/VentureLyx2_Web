import "./App.css";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AuthCallback from "./pages/AuthCallback";
import Onboarding from "./pages/Onboarding";
import AppLayout from "./components/AppLayout";
import CommandCenter from "./pages/CommandCenter";
import Operate from "./pages/Operate";
import ScaleSEO from "./pages/ScaleSEO";
import Reviews from "./pages/Reviews";
import Settings from "./pages/Settings";
import Billing from "./pages/Billing";
import LockedModule from "./pages/LockedModule";
import PaymentResult from "./pages/PaymentResult";

function Loader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

function Protected({ children, requireBusiness = true }) {
  const { user, business, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" replace />;
  if (requireBusiness && !business) return <Navigate to="/onboarding" replace />;
  return children;
}

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/onboarding" element={<Protected requireBusiness={false}><Onboarding /></Protected>} />
      <Route path="/payment/success" element={<PaymentResult />} />
      <Route path="/payment/cancel" element={<PaymentResult />} />
      <Route element={<Protected><AppLayout /></Protected>}>
        <Route path="/dashboard" element={<CommandCenter />} />
        <Route path="/operate" element={<Operate />} />
        <Route path="/scaleseo" element={<ScaleSEO />} />
        <Route path="/reviews" element={<Reviews />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/build" element={<LockedModule name="Build" />} />
        <Route path="/source" element={<LockedModule name="Source" />} />
        <Route path="/grow" element={<LockedModule name="Grow" />} />
        <Route path="/ai-team" element={<LockedModule name="AI Team" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App grain">
      <BrowserRouter>
        <AuthProvider>
          <Toaster theme="dark" position="top-right" richColors />
          <AppRouter />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
