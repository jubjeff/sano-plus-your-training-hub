import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { AlertCircle, Link as LinkIcon, Trash2, Upload } from "lucide-react";
import { Exercise } from "@/types";
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
import { EXERCISE_EQUIPMENT_SUGGESTIONS, MUSCLE_CATEGORIES, MUSCLE_GROUP_OPTIONS } from "@/lib/exercise-options";
import {
  createVideoPreviewUrl,
  getYoutubeEmbedUrl,
  normalizeYoutubeUrl,
  persistExerciseVideoFile,
  removePersistedExerciseVideo,
  validateExerciseVideoFile,
} from "@/lib/exercise-media";
import { createEmptyExercise, stampExerciseUpdate } from "@/lib/exercise-utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (exercise: Exercise) => void;
  exercise?: Exercise;
}

export default function ExerciseEditorDialog({ open, onOpenChange, onSave, exercise }: Props) {
  const [form, setForm] = useState<Exercise>(createEmptyExercise());
  const [errors, setErrors] = useState<string[]>([]);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [generatedPreviewUrl, setGeneratedPreviewUrl] = useState<string | null>(null);
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [savingVideo, setSavingVideo] = useState(false);
  const [initialVideoStorageKey, setInitialVideoStorageKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrors([]);
    setVideoError(null);
    setYoutubeError(null);
    setSelectedVideoFile(null);
    setSavingVideo(false);
    setInitialVideoStorageKey(exercise?.videoStorageKey ?? null);
    setForm(exercise ? { ...exercise, muscleGroupsSecondary: [...(exercise.muscleGroupsSecondary ?? [])] } : createEmptyExercise());
  }, [exercise, open]);

  useEffect(() => {
    return () => {
      if (generatedPreviewUrl) {
        URL.revokeObjectURL(generatedPreviewUrl);
      }
    };
  }, [generatedPreviewUrl]);

  const selectedSecondaryGroups = useMemo(() => new Set(form.muscleGroupsSecondary ?? []), [form.muscleGroupsSecondary]);

  const updateForm = (data: Partial<Exercise>) => {
    setForm((current) => ({ ...current, ...data }));
  };

  const handleVideoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = validateExerciseVideoFile(file);
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
    setVideoError(null);
    updateForm({ videoFileUrl: previewUrl });
  };

  const handleRemoveVideo = () => {
    if (generatedPreviewUrl) {
      URL.revokeObjectURL(generatedPreviewUrl);
      setGeneratedPreviewUrl(null);
    }

    setSelectedVideoFile(null);
    updateForm({ videoFileUrl: null, videoStorageKey: null });
    setVideoError(null);
  };

  const handleYoutubeChange = (value: string) => {
    const normalizedValue = value.trim();
    if (!normalizedValue) {
      updateForm({ youtubeUrl: "", youtubeEmbedUrl: null });
      setYoutubeError(null);
      return;
    }

    const normalizedUrl = normalizeYoutubeUrl(normalizedValue);
    const embedUrl = getYoutubeEmbedUrl(normalizedValue);

    if (!normalizedUrl || !embedUrl) {
      updateForm({ youtubeUrl: normalizedValue, youtubeEmbedUrl: null });
      setYoutubeError("Use um link valido do YouTube.");
      return;
    }

    updateForm({ youtubeUrl: normalizedUrl, youtubeEmbedUrl: embedUrl });
    setYoutubeError(null);
  };

  const toggleSecondaryGroup = (group: string, checked: boolean) => {
    const current = new Set(form.muscleGroupsSecondary ?? []);
    if (checked) current.add(group);
    else current.delete(group);
    updateForm({ muscleGroupsSecondary: Array.from(current) });
  };

  const handleSave = async () => {
    const nextErrors: string[] = [];

    if (!form.name.trim()) nextErrors.push("Informe o nome do exercicio.");
    if (!form.muscleCategory) nextErrors.push("Selecione a categoria muscular.");
    if (!form.muscleGroupPrimary) nextErrors.push("Selecione a musculatura principal.");
    if (youtubeError) nextErrors.push("Corrija o link do YouTube antes de salvar.");
    if (videoError) nextErrors.push("Corrija o upload do video antes de salvar.");

    if (nextErrors.length > 0) {
      setErrors(nextErrors);
      return;
    }

    let nextForm: Exercise = {
      ...form,
      name: form.name.trim(),
      description: form.description?.trim() ?? "",
      equipment: form.equipment?.trim() ?? "",
      notes: form.notes.trim(),
      muscleGroupsSecondary: (form.muscleGroupsSecondary ?? []).filter((item) => item !== form.muscleGroupPrimary),
    };

    if (selectedVideoFile) {
      try {
        setSavingVideo(true);
        const storageKey = await persistExerciseVideoFile(selectedVideoFile, form.videoStorageKey);
        nextForm = {
          ...nextForm,
          videoStorageKey: storageKey,
          // Persist only the storage key. Preview blob URLs are session-local.
          videoFileUrl: null,
        };

        if (initialVideoStorageKey && initialVideoStorageKey !== storageKey) {
          await removePersistedExerciseVideo(initialVideoStorageKey).catch(() => undefined);
        }
      } catch {
        setErrors(["Nao foi possivel salvar o video localmente. Tente novamente."]);
        setSavingVideo(false);
        return;
      } finally {
        setSavingVideo(false);
      }
    } else if (!nextForm.videoFileUrl && initialVideoStorageKey) {
      await removePersistedExerciseVideo(initialVideoStorageKey).catch(() => undefined);
      nextForm = { ...nextForm, videoStorageKey: null };
    }

    onSave(stampExerciseUpdate(nextForm));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="font-display">{exercise ? "Editar exercicio" : "Novo exercicio"}</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-6">
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Revise os campos obrigatorios</AlertTitle>
              <AlertDescription>{errors.join(" ")}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="exercise-name">Nome do exercicio</Label>
              <Input id="exercise-name" value={form.name} onChange={(event) => updateForm({ name: event.target.value })} placeholder="Ex: Supino inclinado com halteres" />
            </div>

            <div className="space-y-2">
              <Label>Categoria geral</Label>
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
              <Label>Musculatura principal</Label>
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
              <Label htmlFor="exercise-equipment">Equipamento</Label>
              <Input
                id="exercise-equipment"
                list="exercise-equipment-options"
                value={form.equipment ?? ""}
                onChange={(event) => updateForm({ equipment: event.target.value })}
                placeholder="Ex: Halteres"
              />
              <datalist id="exercise-equipment-options">
                {EXERCISE_EQUIPMENT_SUGGESTIONS.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <Label>Series</Label>
                <Input type="number" value={form.sets} onChange={(event) => updateForm({ sets: Number(event.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Repeticoes</Label>
                <Input value={form.reps} onChange={(event) => updateForm({ reps: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Carga</Label>
                <Input value={form.load} onChange={(event) => updateForm({ load: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Descanso</Label>
                <Input value={form.rest} onChange={(event) => updateForm({ rest: event.target.value })} />
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="exercise-description">Descricao / instrucoes</Label>
              <Textarea
                id="exercise-description"
                rows={4}
                value={form.description ?? ""}
                onChange={(event) => updateForm({ description: event.target.value })}
                placeholder="Explique a execucao, pontos de atencao e ritmo."
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="exercise-notes">Observacoes do professor</Label>
              <Textarea
                id="exercise-notes"
                rows={3}
                value={form.notes}
                onChange={(event) => updateForm({ notes: event.target.value })}
                placeholder="Adaptacoes, restricoes ou observacoes importantes."
              />
            </div>
          </div>

          <section className="space-y-3 rounded-[24px] border border-border/60 bg-background/60 p-5">
            <div>
              <h3 className="font-display text-lg font-semibold">Musculaturas secundarias</h3>
              <p className="text-sm text-muted-foreground">Selecione quantas fizerem sentido. A musculatura principal fica destacada separadamente.</p>
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
              <h3 className="font-display text-lg font-semibold">Midia do exercicio</h3>
              <p className="text-sm text-muted-foreground">Voce pode enviar um video MP4, colar um link do YouTube, usar os dois ou deixar para depois.</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded-[20px] border border-border/60 bg-card/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Upload de video MP4</p>
                    <p className="text-xs text-muted-foreground">Aceita apenas `.mp4` com ate {50} MB.</p>
                  </div>
                  {(form.videoFileUrl || form.videoStorageKey) && (
                    <Button type="button" variant="ghost" size="sm" onClick={handleRemoveVideo} className="text-destructive hover:text-destructive">
                      <Trash2 className="mr-1 h-4 w-4" />
                      Remover
                    </Button>
                  )}
                </div>

                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-border/70 bg-background/70 px-4 py-6 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
                  <Upload className="h-4 w-4" />
                  Selecionar video
                  <input type="file" accept="video/mp4,.mp4" className="hidden" onChange={handleVideoChange} />
                </label>

                {videoError && <p className="text-sm text-destructive">{videoError}</p>}
              </div>

              <div className="space-y-3 rounded-[20px] border border-border/60 bg-card/60 p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <LinkIcon className="h-4 w-4 text-primary" />
                  Link do YouTube
                </div>
                <Input
                  value={form.youtubeUrl ?? ""}
                  onChange={(event) => handleYoutubeChange(event.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
                {youtubeError && <p className="text-sm text-destructive">{youtubeError}</p>}
                {!youtubeError && form.youtubeEmbedUrl && <p className="text-xs text-muted-foreground">Preview pronto para incorporacao.</p>}
              </div>
            </div>

            <ExerciseMediaPreview exercise={form} />
          </section>

        </DialogBody>

          <DialogFooter className="border-t border-border/60 bg-background/95">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave} disabled={savingVideo}>
              {savingVideo ? "Salvando video..." : exercise ? "Salvar exercicio" : "Adicionar exercicio"}
            </Button>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
