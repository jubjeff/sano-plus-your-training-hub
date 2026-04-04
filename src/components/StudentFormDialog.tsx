import { useState, useEffect } from "react";
import { useStore } from "@/hooks/use-store";
import { Student } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student?: Student;
}

export default function StudentFormDialog({ open, onOpenChange, student }: Props) {
  const { addStudent, updateStudent } = useStore();
  const isEditing = !!student;

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    objective: "",
    notes: "",
    startDate: new Date().toISOString().split("T")[0],
    active: true,
  });

  useEffect(() => {
    if (student) {
      setForm({
        name: student.name,
        phone: student.phone,
        email: student.email,
        objective: student.objective,
        notes: student.notes,
        startDate: student.startDate,
        active: student.active,
      });
      return;
    }

    setForm({
      name: "",
      phone: "",
      email: "",
      objective: "",
      notes: "",
      startDate: new Date().toISOString().split("T")[0],
      active: true,
    });
  }, [student, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditing && student) {
      updateStudent(student.id, form);
    } else {
      addStudent(form);
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{isEditing ? "Editar aluno" : "Novo aluno"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome completo</Label>
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Objetivo</Label>
            <Input
              value={form.objective}
              onChange={(e) => setForm({ ...form, objective: e.target.value })}
              placeholder="Ex: Hipertrofia, emagrecimento..."
            />
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Data de início</Label>
            <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">{isEditing ? "Salvar" : "Cadastrar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
