import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { authService } from "@/lib/auth-service";
import { getSupabaseClient, hasSupabaseConfig } from "@/lib/supabase/client";
import type { AuthUser, CompleteFirstAccessInput, ForgotPasswordInput, LoginInput, RegisterInput, ResetPasswordInput, UpdateProfileInput } from "@/types/auth";

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<AuthUser | null>;
  register: (input: RegisterInput) => Promise<AuthUser | null>;
  logout: () => Promise<void>;
  requestPasswordReset: (input: ForgotPasswordInput) => Promise<{ token: string; message: string }>;
  resetPassword: (input: ResetPasswordInput) => Promise<AuthUser | null>;
  issueStudentTemporaryAccess: (studentId: string) => Promise<{ studentId: string; studentName: string; email: string; temporaryPassword: string; generatedAt: string }>;
  completeFirstAccess: (input: CompleteFirstAccessInput) => Promise<AuthUser | null>;
  updateProfile: (input: UpdateProfileInput) => Promise<AuthUser | null>;
  refreshUser: () => Promise<void>;
  touchSessionActivity: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const currentUser = await authService.getCurrentUser();
    setUser(currentUser);
  }, []);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        if (active) {
          setUser(currentUser);
        }
      } catch {
        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    bootstrap();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig()) return;

    let active = true;
    const supabase = getSupabaseClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_OUT") {
        if (active) {
          setUser(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        const currentUser = await authService.getCurrentUser();
        if (active) {
          setUser(currentUser);
          setIsLoading(false);
        }
      } catch {
        if (active) {
          setUser(null);
          setIsLoading(false);
        }
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const currentUser = await authService.login(input);
    setUser(currentUser);
    return currentUser;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const currentUser = await authService.register(input);
    setUser(currentUser);
    return currentUser;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  const requestPasswordReset = useCallback(async (input: ForgotPasswordInput) => {
    return authService.requestPasswordReset(input);
  }, []);

  const resetPassword = useCallback(async (input: ResetPasswordInput) => {
    const currentUser = await authService.resetPassword(input);
    setUser(currentUser);
    return currentUser;
  }, []);

  const issueStudentTemporaryAccess = useCallback(async (studentId: string) => {
    return authService.issueStudentTemporaryAccess(studentId);
  }, []);

  const completeFirstAccess = useCallback(async (input: CompleteFirstAccessInput) => {
    const currentUser = await authService.completeFirstAccess(input);
    setUser(currentUser);
    return currentUser;
  }, []);

  const updateProfile = useCallback(async (input: UpdateProfileInput) => {
    const currentUser = await authService.updateProfile(input);
    setUser(currentUser);
    return currentUser;
  }, []);

  const touchSessionActivity = useCallback(async () => {
    await authService.updateSessionActivity();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
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
    [user, isLoading, login, register, logout, requestPasswordReset, resetPassword, issueStudentTemporaryAccess, completeFirstAccess, updateProfile, refreshUser, touchSessionActivity],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
