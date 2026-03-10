import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider, useAuth } from "@/lib/auth";

import Index from "./pages/Index";
import Login from "./pages/Login";
import Chat from "./pages/Chat";
import AuthCallback from "./pages/AuthCallback";

import Onboarding from "./components/onboarding/onboarding.tsx";

const queryClient = new QueryClient();

function ProtectedApp() {

  const { loading, user, profile } = useAuth();

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login/student" replace />;
  }

  if (!profile?.onboarding_completed) {
    return (
      <Onboarding
        onComplete={() => window.location.replace("/chat")}
      />
    );
  }

  return <Chat />;

}

export default function App() {

  return (

    <QueryClientProvider client={queryClient}>

      <TooltipProvider>

        <Toaster />

        <BrowserRouter>

          <AuthProvider>

            <Routes>

              <Route path="/" element={<Index />} />

              <Route path="/login/:role" element={<Login />} />

              <Route path="/auth/callback" element={<AuthCallback />} />

              <Route path="/chat" element={<ProtectedApp />} />

            </Routes>

          </AuthProvider>

        </BrowserRouter>

      </TooltipProvider>

    </QueryClientProvider>

  );

}
