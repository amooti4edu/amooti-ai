import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const AuthCallback = () => {

  const navigate = useNavigate();

  useEffect(() => {

    const finishOAuth = async () => {

      try {

        await supabase.auth.exchangeCodeForSession();

        navigate("/chat", { replace: true });

      } catch (err) {

        console.error("OAuth error", err);
        navigate("/login/student", { replace: true });

      }

    };

    finishOAuth();

  }, [navigate]);

  return (

    <div className="flex min-h-screen items-center justify-center">

      <div className="text-center">

        <h1 className="text-2xl font-semibold">Signing you in…</h1>

        <p className="text-sm text-muted-foreground mt-2">
          Preparing your account.
        </p>

      </div>

    </div>

  );

};

export default AuthCallback;
