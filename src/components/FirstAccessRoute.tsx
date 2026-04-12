import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

export default function FirstAccessRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/" replace />;
  }

  if (user.role !== "student") {
    return <Navigate to="/dashboard" replace />;
  }

  if (!user.mustChangePassword) {
    return <Navigate to="/aluno/dashboard" replace />;
  }

  return <>{children}</>;
}
