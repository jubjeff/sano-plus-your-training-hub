import { authService } from "@/services/auth.service";
import type { ResolvedAuthSession } from "@/auth/types";
import type { DatabaseUserProfile } from "@/types/profile";

export const sessionService = {
  async getCurrentSession(): Promise<ResolvedAuthSession | null> {
    return authService.getCurrentSession();
  },

  async getCurrentProfile(): Promise<DatabaseUserProfile | null> {
    return authService.getCurrentProfile();
  },

  async getAuthSnapshot() {
    return authService.getAuthSnapshot();
  },
};
