import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuth = async () => {
      try {
        // REQUIRED for Google OAuth
        await supabase.auth.exchangeCodeForSession();

        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          navigate("/login/student", { replace: true });
          return;
        }

        // Check onboarding status
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", user.id)
          .single();

        if (!profile?.onboarding_completed) {
          navigate("/onboarding", { replace: true });
        } else {
          navigate("/chat", { replace: true });
        }

      } catch (err) {
        console.error("OAuth callback error:", err);
        navigate("/login/student", { replace: true });
      }
    };

    handleAuth();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Signing you in…</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Preparing your account.
        </p>
      </div>
    </div>
  );
};

export default AuthCallback;
