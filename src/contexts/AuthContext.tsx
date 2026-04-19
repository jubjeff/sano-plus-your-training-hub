import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { authService } from "@/lib/auth-service";
import { getSupabaseClient, hasSupabaseRuntimeConfig } from "@/integrations/supabase/client";
import type { StudentTemporaryAccessResult } from "@/integrations/supabase/function-contracts";
import type { AuthUser, CompleteFirstAccessInput, ForgotPasswordInput, LoginInput, RegisterInput, ResolvedAuthSession, ResetPasswordInput, UpdateProfileInput } from "@/types/auth";
import type { DatabaseUserProfile } from "@/types/profile";

type AuthContextValue = {
  session: ResolvedAuthSession | null;
  user: AuthUser | null;
  profile: DatabaseUserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isProfileLoading: boolean;
  login: (input: LoginInput) => Promise<AuthUser | null>;
  register: (input: RegisterInput) => Promise<AuthUser | null>;
  logout: () => Promise<void>;
  requestPasswordReset: (input: ForgotPasswordInput) => Promise<{ token: string; message: string }>;
  resetPassword: (input: ResetPasswordInput) => Promise<AuthUser | null>;
  issueStudentTemporaryAccess: (studentId: string) => Promise<StudentTemporaryAccessResult>;
  completeFirstAccess: (input: CompleteFirstAccessInput) => Promise<AuthUser | null>;
  updateProfile: (input: UpdateProfileInput) => Promise<AuthUser | null>;
  refreshUser: () => Promise<void>;
  touchSessionActivity: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ResolvedAuthSession | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<DatabaseUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    setIsProfileLoading(true);
    try {
      const snapshot = await authService.getAuthSnapshot();
      setSession(snapshot.session);
      setUser(snapshot.user);
      setProfile(snapshot.profile);
    } finally {
      setIsProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const supabase = hasSupabaseRuntimeConfig() ? getSupabaseClient() : null;

    const bootstrap = async () => {
      try {
        const snapshot = await authService.getAuthSnapshot();
        if (active) {
          setSession(snapshot.session);
          setUser(snapshot.user);
          setProfile(snapshot.profile);
        }
      } catch {
        if (active) {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (active) {
          setIsLoading(false);
          setIsProfileLoading(false);
        }
      }
    };

    bootstrap();

    const subscription = supabase?.auth.onAuthStateChange(() => {
      if (!active) {
        return;
      }

      void (async () => {
        try {
          const snapshot = await authService.getAuthSnapshot();
          if (active) {
            setSession(snapshot.session);
            setUser(snapshot.user);
            setProfile(snapshot.profile);
          }
        } catch {
          if (active) {
            setSession(null);
            setUser(null);
            setProfile(null);
          }
        } finally {
          if (active) {
            setIsLoading(false);
            setIsProfileLoading(false);
          }
        }
      })();
    });

    return () => {
      active = false;
      subscription?.data.subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const currentUser = await authService.login(input);
    const snapshot = await authService.getAuthSnapshot();
    let nextSession = snapshot.session;

    if (!nextSession && hasSupabaseRuntimeConfig()) {
      const {
        data: { session: liveSession },
      } = await getSupabaseClient().auth.getSession();

      if (liveSession) {
        nextSession = {
          userId: liveSession.user.id,
          email: liveSession.user.email ?? null,
          emailVerifiedAt: liveSession.user.email_confirmed_at ?? null,
          provider: "supabase",
          createdAt: liveSession.user.created_at ?? new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
        };
      }
    }

    setSession(nextSession);
    setUser(snapshot.user ?? currentUser);
    setProfile(snapshot.profile);
    return currentUser;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const currentUser = await authService.register(input);
    const snapshot = await authService.getAuthSnapshot();
    setSession(snapshot.session);
    setUser(snapshot.user ?? currentUser);
    setProfile(snapshot.profile);
    return currentUser;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setSession(null);
    setUser(null);
    setProfile(null);
  }, []);

  const requestPasswordReset = useCallback(async (input: ForgotPasswordInput) => {
    return authService.requestPasswordReset(input);
  }, []);

  const resetPassword = useCallback(async (input: ResetPasswordInput) => {
    const currentUser = await authService.resetPassword(input);
    const snapshot = await authService.getAuthSnapshot();
    setSession(snapshot.session);
    setUser(snapshot.user ?? currentUser);
    setProfile(snapshot.profile);
    return currentUser;
  }, []);

  const issueStudentTemporaryAccess = useCallback(async (studentId: string) => {
    return authService.issueStudentTemporaryAccess(studentId);
  }, []);

  const completeFirstAccess = useCallback(async (input: CompleteFirstAccessInput) => {
    const currentUser = await authService.completeFirstAccess(input);
    const snapshot = await authService.getAuthSnapshot();
    setSession(snapshot.session);
    setUser(snapshot.user ?? currentUser);
    setProfile(snapshot.profile);
    return currentUser;
  }, []);

  const updateProfile = useCallback(async (input: UpdateProfileInput) => {
    const currentUser = await authService.updateProfile(input);
    const snapshot = await authService.getAuthSnapshot();
    setSession(snapshot.session);
    setUser(snapshot.user ?? currentUser);
    setProfile(snapshot.profile);
    return currentUser;
  }, []);

  const touchSessionActivity = useCallback(async () => {
    await authService.updateSessionActivity();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile,
      isAuthenticated: Boolean(session && user),
      isLoading,
      isProfileLoading,
      login,
      register,
      logout,
      requestPasswordReset,
      resetPassword,
      issueStudentTemporaryAccess,
      completeFirstAccess,
      updateProfile,
      refreshUser,
      touchSessionActivity,
    }),
    [session, user, profile, isLoading, isProfileLoading, login, register, logout, requestPasswordReset, resetPassword, issueStudentTemporaryAccess, completeFirstAccess, updateProfile, refreshUser, touchSessionActivity],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
