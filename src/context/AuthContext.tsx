import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

interface AuthContextValue {
  profile: Profile | null;
  loading: boolean;
  deactivatedMessage: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [deactivatedMessage, setDeactivatedMessage] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    const fetched = data as Profile | null;
    if (fetched && !fetched.active) {
      setDeactivatedMessage('Your account has been deactivated. Contact an administrator.');
      await supabase.auth.signOut();
      setProfile(null);
      setLoading(false);
      return;
    }
    setProfile(fetched);
    setDeactivatedMessage(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProfile();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        if (event === 'SIGNED_OUT' || !session) {
          setProfile(null);
          setLoading(false);
          return;
        }
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await loadProfile();
        }
      })();
    });

    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  // Realtime: sign out immediately if an admin deactivates this user mid-session
  useEffect(() => {
    if (!profile?.id) return;
    const userId = profile.id;
    const channel = supabase
      .channel(`profile-${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        (payload) => {
          const updated = payload.new as Profile;
          if (updated && !updated.active) {
            setDeactivatedMessage('Your account has been deactivated. Contact an administrator.');
            supabase.auth.signOut();
            setProfile(null);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    await loadProfile();
  }, []);

  return (
    <AuthContext.Provider value={{ profile, loading, deactivatedMessage, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
