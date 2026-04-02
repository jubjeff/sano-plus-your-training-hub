import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Students from "@/pages/Students";
import StudentProfile from "@/pages/StudentProfile";
import WorkoutLibrary from "@/pages/WorkoutLibrary";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route
            path="/dashboard"
            element={<AppLayout><Dashboard /></AppLayout>}
          />
          <Route
            path="/alunos"
            element={<AppLayout><Students /></AppLayout>}
          />
          <Route
            path="/alunos/:id"
            element={<AppLayout><StudentProfile /></AppLayout>}
          />
          <Route
            path="/biblioteca"
            element={<AppLayout><WorkoutLibrary /></AppLayout>}
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
