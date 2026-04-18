import { authService } from "@/services/auth.service";
import type { AuthUser, UpdateProfileInput } from "@/auth/types";
import type { DatabaseUserProfile } from "@/types/profile";

export const profileService = {
  async getCurrentProfile(): Promise<DatabaseUserProfile | null> {
    return authService.getCurrentProfile();
  },

  async updateCurrentProfile(input: UpdateProfileInput): Promise<AuthUser | null> {
    return authService.updateProfile(input);
  },
};
