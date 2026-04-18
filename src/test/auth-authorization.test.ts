import { describe, expect, it } from "vitest";
import { getAuthorizedHomePath, requiresCoachProfileAccess, requiresFirstAccess, resolveAuthorizedRole } from "@/auth/authorization";
import type { AuthUser } from "@/auth/types";
import type { DatabaseUserProfile } from "@/types/profile";

function createUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "user-1",
    role: "coach",
    accountStatus: "active",
    mustChangePassword: false,
    fullName: "Jeff",
    birthDate: "1990-01-01",
    email: "jeff@example.com",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function createProfile(overrides: Partial<DatabaseUserProfile> = {}): DatabaseUserProfile {
  return {
    id: "user-1",
    email: "jeff@example.com",
    fullName: "Jeff",
    avatarUrl: null,
    cpf: null,
    birthDate: "1990-01-01",
    phone: null,
    notes: null,
    role: "professor",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("authorization", () => {
  it("prefers the Supabase profile role when resolving authorization", () => {
    const resolvedRole = resolveAuthorizedRole({
      user: createUser({ role: "student" }),
      profile: createProfile({ role: "professor" }),
    });

    expect(resolvedRole).toBe("coach");
  });

  it("forces student first access before the regular dashboard", () => {
    const subject = {
      user: createUser({ role: "student", mustChangePassword: true }),
      profile: createProfile({ role: "aluno" }),
    };

    expect(requiresFirstAccess(subject)).toBe(true);
    expect(getAuthorizedHomePath(subject)).toBe("/primeiro-acesso");
  });

  it("forces blocked coach accounts back to profile", () => {
    const subject = {
      user: createUser({ teacherHasActiveAccess: false }),
      profile: createProfile({ role: "professor" }),
    };

    expect(requiresCoachProfileAccess(subject)).toBe(true);
    expect(getAuthorizedHomePath(subject)).toBe("/perfil");
  });
});
