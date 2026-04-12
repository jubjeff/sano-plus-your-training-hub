import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import type { AuthRole } from "@/types/auth";

export default function RoleRoute({ role, children }: { role: AuthRole; children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (user.role === "student" && user.mustChangePassword) {
    return <Navigate to="/primeiro-acesso" replace />;
  }

  if (user.role !== role) {
    return <Navigate to={user.role === "student" ? "/aluno/dashboard" : "/dashboard"} replace />;
  }

  return <>{children}</>;
}
