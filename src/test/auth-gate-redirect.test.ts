import { describe, expect, it } from "vitest";
import { resolveGateRedirect } from "@/auth/authorization";
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

/** Aluno recém-criado pelo professor: senha temporária E avaliação pendentes. */
function alunoNovo() {
  return {
    user: createUser({ role: "student", mustChangePassword: true, requiresAnamnesis: true }),
    profile: createProfile({ role: "aluno" }),
  };
}

/** Aluno que já trocou a senha, mas ainda não preencheu a avaliação. */
function alunoSemAvaliacao() {
  return {
    user: createUser({ role: "student", mustChangePassword: false, requiresAnamnesis: true }),
    profile: createProfile({ role: "aluno" }),
  };
}

function alunoEmDia() {
  return {
    user: createUser({ role: "student", mustChangePassword: false, requiresAnamnesis: false }),
    profile: createProfile({ role: "aluno" }),
  };
}

describe("resolveGateRedirect", () => {
  // Regressão do bug que deixava a tela em branco: com os dois portões
  // pendentes, /primeiro-acesso mandava para /minha-avaliacao e /minha-avaliacao
  // mandava de volta, em loop infinito.
  it("nao entra em loop quando senha e avaliacao estao pendentes juntas", () => {
    const aluno = alunoNovo();

    // Chegando em qualquer rota, o destino é a troca de senha.
    expect(resolveGateRedirect(aluno, "/aluno/dashboard")).toBe("/primeiro-acesso");
    expect(resolveGateRedirect(aluno, "/minha-avaliacao")).toBe("/primeiro-acesso");

    // E, uma vez lá, ele fica — este era o passo que rebatia para a avaliação.
    expect(resolveGateRedirect(aluno, "/primeiro-acesso")).toBeNull();
  });

  it("so cobra a avaliacao depois que a senha foi trocada", () => {
    const aluno = alunoSemAvaliacao();

    expect(resolveGateRedirect(aluno, "/aluno/dashboard")).toBe("/minha-avaliacao");
    expect(resolveGateRedirect(aluno, "/minha-avaliacao")).toBeNull();
  });

  it("deixa passar o aluno sem pendencia", () => {
    const aluno = alunoEmDia();

    expect(resolveGateRedirect(aluno, "/aluno/dashboard")).toBeNull();
    expect(resolveGateRedirect(aluno, "/perfil")).toBeNull();
  });

  it("mantem o portao valendo em rota que nao e a do proprio portao", () => {
    // Sem isto o aluno digitava /aluno/dashboard e entrava sem preencher nada.
    expect(resolveGateRedirect(alunoNovo(), "/perfil")).toBe("/primeiro-acesso");
    expect(resolveGateRedirect(alunoSemAvaliacao(), "/perfil")).toBe("/minha-avaliacao");
  });

  it("professor sem acesso ativo vai para o perfil e fica", () => {
    const professor = {
      user: createUser({ teacherHasActiveAccess: false }),
      profile: createProfile({ role: "professor" }),
    };

    expect(resolveGateRedirect(professor, "/dashboard")).toBe("/perfil");
    expect(resolveGateRedirect(professor, "/perfil")).toBeNull();
  });

  it("professor em dia nao e redirecionado", () => {
    const professor = {
      user: createUser({ teacherHasActiveAccess: true }),
      profile: createProfile({ role: "professor" }),
    };

    expect(resolveGateRedirect(professor, "/dashboard")).toBeNull();
  });
});
