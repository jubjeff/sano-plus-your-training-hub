import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/auth/provider";
import AppLayout from "@/components/AppLayout";
import FirstAccessRoute from "@/guards/first-access-route";
import ProtectedRoute from "@/guards/protected-route";
import PublicOnlyRoute from "@/guards/public-only-route";
import RoleRoute from "@/guards/role-route";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/Dashboard";
import AuthCallback from "@/pages/AuthCallback";
import FirstAccessPassword from "@/pages/FirstAccessPassword";
import ForgotPassword from "@/pages/ForgotPassword";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import Profile from "@/pages/Profile";
import Register from "@/pages/Register";
import ResetPassword from "@/pages/ResetPassword";
import StudentPortal from "@/pages/StudentPortal";
import StudentProfile from "@/pages/StudentProfile";
import Students from "@/pages/Students";
import VerifyEmail from "@/pages/VerifyEmail";
import WorkoutEditor from "@/pages/WorkoutEditor";
import WorkoutLibrary from "@/pages/WorkoutLibrary";

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
          <Route path="/criar-conta" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
          <Route path="/verifique-email" element={<PublicOnlyRoute><VerifyEmail /></PublicOnlyRoute>} />
          <Route path="/esqueci-senha" element={<PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute>} />
          <Route path="/forgot-password" element={<Navigate to="/esqueci-senha" replace />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/redefinir-senha" element={<ResetPassword />} />
          <Route path="/reset-password" element={<Navigate to="/redefinir-senha" replace />} />
          <Route path="/update-password" element={<Navigate to="/redefinir-senha" replace />} />
          <Route path="/primeiro-acesso" element={<ProtectedRoute><FirstAccessRoute><FirstAccessPassword /></FirstAccessRoute></ProtectedRoute>} />
          <Route
            path="/dashboard"
            element={<ProtectedRoute><RoleRoute role="coach"><AppLayout><Dashboard /></AppLayout></RoleRoute></ProtectedRoute>}
          />
          <Route
            path="/perfil"
            element={<ProtectedRoute><AppLayout><Profile /></AppLayout></ProtectedRoute>}
          />
          <Route
            path="/aluno/dashboard"
            element={<ProtectedRoute><RoleRoute role="student"><AppLayout><StudentPortal /></AppLayout></RoleRoute></ProtectedRoute>}
          />
          <Route path="/area-do-aluno" element={<Navigate to="/aluno/dashboard" replace />} />
          <Route
            path="/alunos"
            element={<ProtectedRoute><RoleRoute role="coach"><AppLayout><Students /></AppLayout></RoleRoute></ProtectedRoute>}
          />
          <Route
            path="/alunos/:id"
            element={<ProtectedRoute><RoleRoute role="coach"><AppLayout><StudentProfile /></AppLayout></RoleRoute></ProtectedRoute>}
          />
          <Route
            path="/biblioteca"
            element={<ProtectedRoute><RoleRoute role="coach"><AppLayout><WorkoutLibrary /></AppLayout></RoleRoute></ProtectedRoute>}
          />
          <Route
            path="/biblioteca/:id/editar"
            element={<ProtectedRoute><RoleRoute role="coach"><AppLayout><WorkoutEditor /></AppLayout></RoleRoute></ProtectedRoute>}
          />
          <Route path="/home" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </TooltipProvider>
);

export default App;
