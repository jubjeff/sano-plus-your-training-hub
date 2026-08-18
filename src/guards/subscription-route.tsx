import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getSupabaseClient } from "@/integrations/supabase";
import { useAuth } from "@/auth/use-auth";

export default function SubscriptionRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(true);

  useEffect(() => {
    if (isLoading) return;

    if (!user || user.role !== "student" || !user.linkedStudentId) {
      setChecking(false);
      return;
    }

    const studentId = user.linkedStudentId;
    const supabase = getSupabaseClient();

    supabase
      .from("assinaturas")
      .select("id,status")
      .eq("aluno_id", studentId)
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const active = data.some((a: { status: string }) => a.status === "ativo");
          setHasAccess(active);
        }
        setChecking(false);
      });
  }, [user, isLoading]);

  if (isLoading || checking) return null;
  if (!hasAccess) return <Navigate to="/planos" replace />;
  return <>{children}</>;
}
