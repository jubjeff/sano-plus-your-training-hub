import MyProfileCard from "@/components/MyProfileCard";
import { useAuth } from "@/auth/use-auth";

export default function Profile() {
  const { user } = useAuth();

  return (
    <div className="space-y-6 animate-fade-in">
      {user?.role === "coach" && user.teacherHasActiveAccess === false ? (
        <section className="section-shell border-warning/30 bg-warning/10 p-5">
          <p className="text-sm font-semibold text-foreground">Acesso principal bloqueado</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {user.teacherAccessMessage || "Seu periodo de teste expirou. Faca upgrade para o plano Pro para continuar."}
          </p>
        </section>
      ) : null}

      <section className="section-shell overflow-hidden">
        <div className="p-6 lg:p-8">
          <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
            Meu Perfil
          </span>
          <div className="mt-4">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">Gerencie seus dados pessoais</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Visualize e atualize as informacoes permitidas da sua conta com seguranca. Campos criticos, como documento e e-mail, permanecem protegidos quando existirem.
            </p>
          </div>
        </div>
      </section>

      <MyProfileCard showHeader={false} />
    </div>
  );
}
