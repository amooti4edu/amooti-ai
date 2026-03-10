import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";

const AuthCallback = () => {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    if (session) {
      navigate("/chat", { replace: true });
      return;
    }

    navigate("/login/student", { replace: true });
  }, [loading, session, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Signing you in…</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Preparing your onboarding flow.
        </p>
      </div>
    </div>
  );
};

export default AuthCallback;
