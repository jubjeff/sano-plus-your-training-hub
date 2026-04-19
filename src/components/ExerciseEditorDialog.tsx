import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { AlertCircle, Trash2, Upload } from "lucide-react";
import { ExerciseLibraryItem } from "@/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import ExerciseMediaPreview from "@/components/ExerciseMediaPreview";
import {
  EXERCISE_BODY_REGION_OPTIONS,
  EXERCISE_CATEGORIES,
  EXERCISE_DIFFICULTY_OPTIONS,
  EXERCISE_EQUIPMENT_SUGGESTIONS,
  EXERCISE_MOVEMENT_OPTIONS,
  EXERCISE_TYPE_OPTIONS,
  MUSCLE_CATEGORIES,
  MUSCLE_GROUP_OPTIONS,
} from "@/lib/exercise-options";
import { MAX_EXERCISE_VIDEO_DURATION_SECONDS, MAX_EXERCISE_VIDEO_SIZE_MB, createVideoPreviewUrl, validateExerciseVideoFile } from "@/lib/exercise-media";
import { createEmptyExerciseLibraryItem, stampExerciseLibraryUpdate } from "@/lib/exercise-utils";

interface SavePayload {
  exercise: ExerciseLibraryItem;
  videoFile?: File | null;
  removeVideo?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: SavePayload) => Promise<void> | void;
  exercise?: ExerciseLibraryItem;
}

export default function ExerciseEditorDialog({ open, onOpenChange, onSave, exercise }: Props) {
  const [form, setForm] = useState<ExerciseLibraryItem>(createEmptyExerciseLibraryItem());
  const [errors, setErrors] = useState<string[]>([]);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [generatedPreviewUrl, setGeneratedPreviewUrl] = useState<string | null>(null);
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [removeVideo, setRemoveVideo] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors([]);
    setVideoError(null);
    setSelectedVideoFile(null);
    setRemoveVideo(false);
    setSubmitting(false);
    setForm(
      exercise
        ? { ...exercise, muscleGroupsSecondary: [...(exercise.muscleGroupsSecondary ?? [])] }
        : createEmptyExerciseLibraryItem(),
    );
  }, [exercise, open]);

  useEffect(() => {
    return () => {
      if (generatedPreviewUrl) {
        URL.revokeObjectURL(generatedPreviewUrl);
      }
    };
  }, [generatedPreviewUrl]);

  const selectedSecondaryGroups = useMemo(() => new Set(form.muscleGroupsSecondary ?? []), [form.muscleGroupsSecondary]);

  const updateForm = (data: Partial<ExerciseLibraryItem>) => {
    setForm((current) => ({ ...current, ...data }));
  };

  const handleVideoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = await validateExerciseVideoFile(file);
    if (validation) {
      setVideoError(validation);
      event.target.value = "";
      return;
    }

    if (generatedPreviewUrl) {
      URL.revokeObjectURL(generatedPreviewUrl);
    }

    const previewUrl = createVideoPreviewUrl(file);
    setGeneratedPreviewUrl(previewUrl);
    setSelectedVideoFile(file);
    setRemoveVideo(false);
    setVideoError(null);
    updateForm({ videoUrl: previewUrl });
  };

  const handleRemoveVideo = () => {
    if (generatedPreviewUrl) {
      URL.revokeObjectURL(generatedPreviewUrl);
      setGeneratedPreviewUrl(null);
    }

    setSelectedVideoFile(null);
    setRemoveVideo(true);
    updateForm({ videoUrl: null, videoStoragePath: null });
    setVideoError(null);
  };

  const toggleSecondaryGroup = (group: string, checked: boolean) => {
    const current = new Set(form.muscleGroupsSecondary ?? []);
    if (checked) current.add(group);
    else current.delete(group);
    updateForm({ muscleGroupsSecondary: Array.from(current) });
  };

  const handleSave = async () => {
    const nextErrors: string[] = [];

    if (!form.name.trim()) nextErrors.push("Informe o nome do exercício.");
    if (!form.category) nextErrors.push("Selecione a categoria.");
    if (form.category !== "Cardio" && !form.muscleGroupPrimary) nextErrors.push("Selecione o grupo muscular principal.");
    if (videoError) nextErrors.push("Corrija o vídeo antes de salvar.");

    if (nextErrors.length > 0) {
      setErrors(nextErrors);
      return;
    }

    const nextExercise = stampExerciseLibraryUpdate({
      ...form,
      name: form.name.trim(),
      description: form.description.trim(),
      executionInstructions: form.executionInstructions.trim(),
      breathingTips: form.breathingTips.trim(),
      postureTips: form.postureTips.trim(),
      contraindications: form.contraindications.trim(),
      commonMistakes: form.commonMistakes.trim(),
      equipment: form.equipment?.trim() ?? "",
      muscleGroupsSecondary: (form.muscleGroupsSecondary ?? []).filter((item) => item !== form.muscleGroupPrimary),
      durationLimitSeconds: MAX_EXERCISE_VIDEO_DURATION_SECONDS,
    });

    try {
      setSubmitting(true);
      await onSave({
        exercise: nextExercise,
        videoFile: selectedVideoFile,
        removeVideo,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="font-display">{exercise ? "Editar exercício da biblioteca" : "Novo exercício da biblioteca"}</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-6">
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Revise os campos obrigatórios</AlertTitle>
              <AlertDescription>{errors.join(" ")}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="exercise-name">Nome do exercício</Label>
              <Input id="exercise-name" value={form.name} onChange={(event) => updateForm({ name: event.target.value })} placeholder="Ex.: Supino inclinado com halteres" />
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(value) => updateForm({ category: value as ExerciseLibraryItem["category"] })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {EXERCISE_CATEGORIES.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Categoria muscular</Label>
              <Select value={form.muscleCategory ?? ""} onValueChange={(value) => updateForm({ muscleCategory: value })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {MUSCLE_CATEGORIES.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Grupo muscular principal</Label>
              <Select
                value={form.muscleGroupPrimary ?? ""}
                onValueChange={(value) =>
                  updateForm({
                    muscleGroupPrimary: value,
                    muscleGroupsSecondary: (form.muscleGroupsSecondary ?? []).filter((item) => item !== value),
                  })
                }
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {MUSCLE_GROUP_OPTIONS.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de movimento</Label>
              <Select value={form.movementType ?? ""} onValueChange={(value) => updateForm({ movementType: value as ExerciseLibraryItem["movementType"] })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {EXERCISE_MOVEMENT_OPTIONS.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Região corporal</Label>
              <Select value={form.bodyRegion ?? ""} onValueChange={(value) => updateForm({ bodyRegion: value as ExerciseLibraryItem["bodyRegion"] })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {EXERCISE_BODY_REGION_OPTIONS.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Equipamento</Label>
              <Input
                list="exercise-equipment-options"
                value={form.equipment ?? ""}
                onChange={(event) => updateForm({ equipment: event.target.value })}
                placeholder="Ex.: Halteres"
              />
              <datalist id="exercise-equipment-options">
                {EXERCISE_EQUIPMENT_SUGGESTIONS.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </div>

            <div className="space-y-2">
              <Label>Nível de dificuldade</Label>
              <Select value={form.difficultyLevel ?? ""} onValueChange={(value) => updateForm({ difficultyLevel: value as ExerciseLibraryItem["difficultyLevel"] })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {EXERCISE_DIFFICULTY_OPTIONS.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de exercício</Label>
              <Select value={form.exerciseType ?? ""} onValueChange={(value) => updateForm({ exerciseType: value as ExerciseLibraryItem["exerciseType"] })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {EXERCISE_TYPE_OPTIONS.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Descrição</Label>
              <Textarea rows={3} value={form.description} onChange={(event) => updateForm({ description: event.target.value })} placeholder="Resumo técnico e objetivo principal do exercício." />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Instruções de execução</Label>
              <Textarea rows={4} value={form.executionInstructions} onChange={(event) => updateForm({ executionInstructions: event.target.value })} placeholder="Explique a execução em passos claros." />
            </div>

            <div className="space-y-2">
              <Label>Dicas de respiração</Label>
              <Textarea rows={3} value={form.breathingTips} onChange={(event) => updateForm({ breathingTips: event.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Dicas de postura</Label>
              <Textarea rows={3} value={form.postureTips} onChange={(event) => updateForm({ postureTips: event.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Erros comuns</Label>
              <Textarea rows={3} value={form.commonMistakes} onChange={(event) => updateForm({ commonMistakes: event.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Contraindicações</Label>
              <Textarea rows={3} value={form.contraindications} onChange={(event) => updateForm({ contraindications: event.target.value })} />
            </div>
          </div>

          <section className="space-y-3 rounded-[24px] border border-border/60 bg-background/60 p-5">
            <div>
              <h3 className="font-display text-lg font-semibold">Grupos musculares secundários</h3>
              <p className="text-sm text-muted-foreground">Selecione quantos fizerem sentido. O principal fica destacado separadamente.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {MUSCLE_GROUP_OPTIONS.map((group) => {
                const disabled = group === form.muscleGroupPrimary;
                return (
                  <label key={group} className={`flex items-center gap-3 rounded-2xl border px-3 py-2 text-sm ${disabled ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 bg-card/60"}`}>
                    <Checkbox
                      checked={disabled || selectedSecondaryGroups.has(group)}
                      disabled={disabled}
                      onCheckedChange={(checked) => toggleSecondaryGroup(group, checked === true)}
                    />
                    <span>{group}</span>
                    {disabled && <Badge variant="secondary" className="ml-auto bg-primary/10 text-primary">Principal</Badge>}
                  </label>
                );
              })}
            </div>
          </section>

          <section className="space-y-4 rounded-[24px] border border-border/60 bg-background/60 p-5">
            <div>
              <h3 className="font-display text-lg font-semibold">Vídeo demonstrativo</h3>
              <p className="text-sm text-muted-foreground">
                Aceita apenas `.mp4`, com até {MAX_EXERCISE_VIDEO_DURATION_SECONDS} segundos e {MAX_EXERCISE_VIDEO_SIZE_MB} MB.
              </p>
            </div>

            <div className="rounded-[20px] border border-border/60 bg-card/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Upload de vídeo MP4</p>
                  <p className="text-xs text-muted-foreground">O exercício continua utilizável mesmo sem mídia.</p>
                </div>
                {(form.videoUrl || form.videoStoragePath) && (
                  <Button type="button" variant="ghost" size="sm" onClick={handleRemoveVideo} className="text-destructive hover:text-destructive">
                    <Trash2 className="mr-1 h-4 w-4" />
                    Remover
                  </Button>
                )}
              </div>

              <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-border/70 bg-background/70 px-4 py-6 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
                <Upload className="h-4 w-4" />
                Selecionar vídeo
                <input type="file" accept="video/mp4,.mp4" className="hidden" onChange={handleVideoChange} />
              </label>

              {videoError && <p className="mt-3 text-sm text-destructive">{videoError}</p>}
            </div>

            <ExerciseMediaPreview exercise={{ name: form.name, videoUrl: form.videoUrl, videoStoragePath: form.videoStoragePath, thumbnailUrl: form.thumbnailUrl }} />
          </section>
        </DialogBody>

        <DialogFooter className="border-t border-border/60 bg-background/95">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={submitting}>
            {submitting ? "Salvando..." : exercise ? "Salvar exercício" : "Cadastrar exercício"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
