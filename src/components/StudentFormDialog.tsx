import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useStore } from "@/hooks/use-store";
import type { Student } from "@/types";
import StudentTemporaryPasswordDialog from "@/components/StudentTemporaryPasswordDialog";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ProfileImageField from "@/components/ProfileImageField";
import { toast } from "@/components/ui/sonner";
import { formatPhone, mapZodErrors } from "@/lib/auth-validators";
import { createProfilePreviewUrl, validateProfileImageFile } from "@/lib/profile-media";
import { normalizeStudentPayload, studentFormSchema } from "@/lib/student-access";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student?: Student;
}

export default function StudentFormDialog({ open, onOpenChange, student }: Props) {
  const { user, issueStudentTemporaryAccess } = useAuth();
  const { addStudent, updateStudent } = useStore();
  const isEditing = Boolean(student);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [temporaryAccess, setTemporaryAccess] = useState<{ studentName: string; email: string; temporaryPassword: string } | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    birthDate: "",
    goal: "",
    notes: "",
    startDate: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (student) {
      setForm({
        fullName: student.fullName,
        phone: formatPhone(student.phone),
        email: student.email,
        birthDate: student.birthDate,
        goal: student.goal,
        notes: student.notes,
        startDate: student.startDate,
      });
      setPhotoPreviewUrl(student.profilePhotoUrl || null);
      setPhotoFile(null);
      setRemovePhoto(false);
      setErrors({});
      return;
    }

    setForm({
      fullName: "",
      phone: "",
      email: "",
      birthDate: "",
      goal: "",
      notes: "",
      startDate: new Date().toISOString().split("T")[0],
    });
    setPhotoPreviewUrl(null);
    setPhotoFile(null);
    setRemovePhoto(false);
    setErrors({});
  }, [student, open]);

  const handlePhotoChange = (file: File | null) => {
    if (!file) {
      setPhotoFile(null);
      setPhotoPreviewUrl(null);
      setRemovePhoto(true);
      return;
    }

    const error = validateProfileImageFile(file);
    if (error) {
      setErrors((current) => ({ ...current, profilePhoto: error }));
      return;
    }

    setPhotoFile(file);
    setPhotoPreviewUrl(createProfilePreviewUrl(file));
    setRemovePhoto(false);
    setErrors((current) => {
      const next = { ...current };
      delete next.profilePhoto;
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = studentFormSchema.safeParse(form);

    if (!parsed.success) {
      setErrors(mapZodErrors(parsed.error));
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const payload = normalizeStudentPayload(parsed.data);
      if (isEditing && student) {
        await updateStudent(student.id, {
          fullName: payload.fullName,
          email: payload.email,
          phone: payload.phone,
          birthDate: payload.birthDate,
          goal: payload.goal,
          notes: payload.notes,
          startDate: form.startDate,
          profilePhotoFile: photoFile,
          removeProfilePhoto: removePhoto,
        });
        toast.success("Aluno atualizado com sucesso.");
      } else {
        const createdStudent = await addStudent({
          coachId: user?.id || "seed-coach",
          fullName: payload.fullName,
          email: payload.email,
          phone: payload.phone,
          birthDate: payload.birthDate,
          goal: payload.goal,
          notes: payload.notes,
          startDate: form.startDate,
          profilePhotoFile: photoFile,
        });
        const access = await issueStudentTemporaryAccess(createdStudent.id);
        setTemporaryAccess({
          studentName: access.studentName,
          email: access.email,
          temporaryPassword: access.temporaryPassword,
        });
        toast.success("Aluno criado com senha provisoria.");
      }

      onOpenChange(false);
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : "Nao foi possivel salvar o aluno." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">{isEditing ? "Editar aluno" : "Novo aluno"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
        <DialogBody className="space-y-4">
          <ProfileImageField
            previewUrl={photoPreviewUrl}
            onFileChange={handlePhotoChange}
            onRemove={() => handlePhotoChange(null)}
            error={errors.profilePhoto}
            disabled={isSubmitting}
            fullName={form.fullName}
          />

          <div className="space-y-2">
            <Label>Nome completo</Label>
            <Input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            {errors.fullName ? <p className="text-xs font-medium text-destructive">{errors.fullName}</p> : null}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              {errors.email ? <p className="text-xs font-medium text-destructive">{errors.email}</p> : null}
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })} />
              {errors.phone ? <p className="text-xs font-medium text-destructive">{errors.phone}</p> : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Data de nascimento</Label>
              <Input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
              {errors.birthDate ? <p className="text-xs font-medium text-destructive">{errors.birthDate}</p> : null}
            </div>
            <div className="space-y-2">
              <Label>Data de inicio</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Objetivo</Label>
            <Input
              value={form.goal}
              onChange={(e) => setForm({ ...form, goal: e.target.value })}
              placeholder="Ex: Hipertrofia, emagrecimento..."
            />
            {errors.goal ? <p className="text-xs font-medium text-destructive">{errors.goal}</p> : null}
          </div>

          <div className="space-y-2">
            <Label>Observacoes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
            {errors.notes ? <p className="text-xs font-medium text-destructive">{errors.notes}</p> : null}
          </div>

          {!isEditing ? (
            <div className="rounded-[22px] border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-muted-foreground">
              O aluno sera criado com <span className="font-semibold text-foreground">senha provisoria</span> e sera obrigado a definir uma nova senha no primeiro login antes de entrar na area do aluno.
            </div>
          ) : null}

          {errors.form ? <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{errors.form}</p> : null}

        </DialogBody>

          <DialogFooter className="border-t border-border/60 bg-background/95">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : isEditing ? "Salvar" : "Pre-cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <StudentTemporaryPasswordDialog
        open={temporaryAccess !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setTemporaryAccess(null);
        }}
        email={temporaryAccess?.email || ""}
        studentName={temporaryAccess?.studentName || ""}
        temporaryPassword={temporaryAccess?.temporaryPassword || ""}
      />
    </Dialog>
  );
}
