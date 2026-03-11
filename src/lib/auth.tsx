import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  display_name: string | null;
  role: string;
  tier: string;
  subject: string | null;
  class: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, role: "student" | "school", displayName?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  refreshProfile: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, role, tier, subject, class")
      .eq("id", userId)
      .single();
    if (data) setProfile(data as unknown as Profile);
  };

  const refreshProfile = () => {
    if (user) fetchProfile(user.id);
  };

  useEffect(() => {
    // onAuthStateChange fires for INITIAL_SESSION, SIGNED_IN, SIGNED_OUT, etc.
    // It also handles hash-based tokens from OAuth redirects (e.g. Google),
    // so we do NOT need a separate getSession() call — that caused a race condition
    // where loading was set to false before the hash token was processed, making
    // Chat.tsx redirect OAuth users back to "/" before their session was ready.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // setTimeout(0) defers the Supabase query so it does not block the
          // auth state update itself (avoids potential deadlock in Supabase JS client).
          setTimeout(() => fetchProfile(session.user.id), 0);
        } else {
          setProfile(null);
        }
        // Only mark loading as done AFTER auth state is known.
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, role: "student" | "school", displayName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { role, display_name: displayName || email },
      },
    });
    if (error) throw error;
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Redirect to "/" (landing page), not "/chat".
        // Index.tsx already redirects authenticated users to /chat automatically.
        // Pointing directly to /chat was broken for new OAuth users: Chat.tsx would
        // see loading=false + session=null and navigate back to "/" before
        // onAuthStateChange had a chance to process the hash token.
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signUp, signIn, signOut, signInWithGoogle, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
