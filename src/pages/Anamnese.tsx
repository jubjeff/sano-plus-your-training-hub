import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, CheckCircle2, ChevronLeft, ChevronRight, Moon, Sun, Upload, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTheme } from "@/hooks/use-theme";
import { EDGE_FUNCTION_NAMES, getSupabaseClient, invokeSupabaseEdgeFunction } from "@/integrations/supabase";

// ─── Constants ────────────────────────────────────────────────────────────────

const DRAFT_KEY = "sano-anamnese-draft";
const STEPS = ["Seus dados", "Objetivo e rotina", "Contexto físico", "Avaliação postural", "Testes funcionais"];
const PHOTO_BUCKET = "anamnesis-photos";
const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB
const VALID_PHOTO_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const VIDEO_BUCKET = "anamnesis-videos";
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB (limite do plano gratuito Supabase)
const VALID_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"];

// ─── Types ────────────────────────────────────────────────────────────────────

type AnamneseForm = {
  fullName: string; email: string; phone: string; age: string; weightKg: string;
  goal: "" | "hipertrofia" | "emagrecimento" | "condicionamento" | "recomposicao";
  experienceLevel: "" | "iniciante" | "intermediario" | "avancado";
  availableDaysPerWeek: string;
  sessionDuration: "" | "30min" | "45min" | "60min" | "90min";
  preferredTime: "" | "manha" | "tarde" | "noite";
  availableEquipment: string[]; injuryHistory: string;
  hasTrainedBefore: boolean; stoppedTrainingDuration: string;
  // FMS (saved to localStorage)
  fmsHurdleDir: string; fmsHurdleEsq: string; fmsHurdleObs: string;
  fmsLungeDir: string; fmsLungeEsq: string; fmsLungeObs: string;
};

type AnamneseForm = {
  fullName: string; email: string; phone: string; age: string; weightKg: string;
  goal: "" | "hipertrofia" | "emagrecimento" | "condicionamento" | "recomposicao";
  experienceLevel: "" | "iniciante" | "intermediario" | "avancado";
  availableDaysPerWeek: string;
  sessionDuration: "" | "30min" | "45min" | "60min" | "90min";
  preferredTime: "" | "manha" | "tarde" | "noite";
  availableEquipment: string[]; injuryHistory: string;
  hasTrainedBefore: boolean; stoppedTrainingDuration: string;
  // Deep Squat (saved to localStorage)
  deepSquatScore: string; deepSquatObs: string;
};

type PhotoSlot = "frontal" | "lateral" | "posterior";
type PhotoState = { file: File | null; preview: string | null };
type VideoSlot = "frontal" | "lateral" | "posterior";
type VideoState = { file: File | null; preview: string | null; sizeMb: string | null };

const INITIAL_FORM: AnamneseForm = {
  fullName: "", email: "", phone: "", age: "", weightKg: "",
  goal: "", experienceLevel: "", availableDaysPerWeek: "",
  sessionDuration: "", preferredTime: "", availableEquipment: [],
  injuryHistory: "", hasTrainedBefore: false, stoppedTrainingDuration: "",
  deepSquatScore: "", deepSquatObs: "",
};

// ─── Inline SVGs ──────────────────────────────────────────────────────────────

function SilhouetteFrontal() {
  return (
    <svg viewBox="0 0 80 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
      <circle cx="40" cy="14" r="10" fill="currentColor" opacity="0.25" />
      <rect x="34" y="23" width="12" height="7" rx="3" fill="currentColor" opacity="0.2" />
      <path d="M24 30 Q20 30 18 45 Q16 60 18 75 H62 Q64 60 62 45 Q60 30 56 30 Z" fill="currentColor" opacity="0.18" />
      <path d="M24 32 Q14 50 10 72" stroke="currentColor" strokeWidth="7" strokeLinecap="round" opacity="0.2" />
      <path d="M56 32 Q66 50 70 72" stroke="currentColor" strokeWidth="7" strokeLinecap="round" opacity="0.2" />
      <path d="M34 75 Q31 105 30 132" stroke="currentColor" strokeWidth="9" strokeLinecap="round" opacity="0.18" />
      <path d="M46 75 Q49 105 50 132" stroke="currentColor" strokeWidth="9" strokeLinecap="round" opacity="0.18" />
      <line x1="20" y1="138" x2="40" y2="138" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.2" />
      <line x1="40" y1="138" x2="60" y2="138" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.2" />
    </svg>
  );
}

function SilhouetteLateral() {
  return (
    <svg viewBox="0 0 80 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
      <circle cx="42" cy="14" r="10" fill="currentColor" opacity="0.25" />
      <rect x="36" y="23" width="10" height="7" rx="3" fill="currentColor" opacity="0.2" />
      <path d="M32 30 Q28 30 27 45 Q26 60 28 75 L50 75 Q52 60 50 45 Q48 30 44 30 Z" fill="currentColor" opacity="0.18" />
      <path d="M30 33 Q22 50 20 70" stroke="currentColor" strokeWidth="7" strokeLinecap="round" opacity="0.2" />
      <path d="M42 75 Q40 105 39 132" stroke="currentColor" strokeWidth="9" strokeLinecap="round" opacity="0.18" />
      <path d="M50 75 Q52 100 54 125 Q55 130 53 132" stroke="currentColor" strokeWidth="9" strokeLinecap="round" opacity="0.18" />
      <line x1="24" y1="138" x2="44" y2="138" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.2" />
      <line x1="38" y1="138" x2="58" y2="138" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.2" />
    </svg>
  );
}

function SilhouettePosterior() {
  return (
    <svg viewBox="0 0 80 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
      <circle cx="40" cy="14" r="10" fill="currentColor" opacity="0.25" />
      <rect x="34" y="23" width="12" height="7" rx="3" fill="currentColor" opacity="0.2" />
      <path d="M24 30 Q20 30 18 45 Q16 60 18 75 H62 Q64 60 62 45 Q60 30 56 30 Z" fill="currentColor" opacity="0.18" />
      <path d="M24 32 Q14 50 10 72" stroke="currentColor" strokeWidth="7" strokeLinecap="round" opacity="0.2" />
      <path d="M56 32 Q66 50 70 72" stroke="currentColor" strokeWidth="7" strokeLinecap="round" opacity="0.2" />
      <path d="M33 75 Q30 105 28 132" stroke="currentColor" strokeWidth="9" strokeLinecap="round" opacity="0.18" />
      <path d="M47 75 Q50 105 52 132" stroke="currentColor" strokeWidth="9" strokeLinecap="round" opacity="0.18" />
      <line x1="18" y1="138" x2="38" y2="138" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.2" />
      <line x1="42" y1="138" x2="62" y2="138" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.2" />
    </svg>
  );
}

function DeepSquatSVG() {
  return (
    <svg viewBox="0 0 140 185" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
      {/* Overhead bar */}
      <line x1="8" y1="18" x2="132" y2="18" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity="0.5" />
      <line x1="8" y1="11" x2="8" y2="25" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.4" />
      <line x1="132" y1="11" x2="132" y2="25" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.4" />
      {/* Left hand grip */}
      <circle cx="22" cy="18" r="5" fill="currentColor" opacity="0.35" />
      {/* Right hand grip */}
      <circle cx="118" cy="18" r="5" fill="currentColor" opacity="0.35" />
      {/* Left arm — shoulder to grip */}
      <line x1="44" y1="72" x2="22" y2="22" stroke="currentColor" strokeWidth="7" strokeLinecap="round" opacity="0.28" />
      {/* Right arm */}
      <line x1="96" y1="72" x2="118" y2="22" stroke="currentColor" strokeWidth="7" strokeLinecap="round" opacity="0.28" />
      {/* Head */}
      <circle cx="70" cy="58" r="13" fill="currentColor" opacity="0.28" />
      {/* Neck */}
      <line x1="70" y1="70" x2="70" y2="80" stroke="currentColor" strokeWidth="9" strokeLinecap="round" opacity="0.22" />
      {/* Torso — trapezoid (wider at shoulders) */}
      <path d="M44 78 L96 78 L84 114 L56 114 Z" fill="currentColor" opacity="0.18" />
      {/* Left thigh — hip outward down to knee (wide squat) */}
      <line x1="58" y1="112" x2="16" y2="136" stroke="currentColor" strokeWidth="10" strokeLinecap="round" opacity="0.22" />
      {/* Right thigh */}
      <line x1="82" y1="112" x2="124" y2="136" stroke="currentColor" strokeWidth="10" strokeLinecap="round" opacity="0.22" />
      {/* Left calf — knee to ankle (near-vertical in deep squat) */}
      <line x1="16" y1="136" x2="22" y2="168" stroke="currentColor" strokeWidth="9" strokeLinecap="round" opacity="0.2" />
      {/* Right calf */}
      <line x1="124" y1="136" x2="118" y2="168" stroke="currentColor" strokeWidth="9" strokeLinecap="round" opacity="0.2" />
      {/* Left foot (turned out) */}
      <path d="M6 170 Q18 165 34 170" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity="0.35" />
      {/* Right foot */}
      <path d="M106 170 Q122 165 134 170" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity="0.35" />
      {/* Ground */}
      <line x1="4" y1="173" x2="136" y2="173" stroke="currentColor" strokeWidth="1.5" opacity="0.12" />
      {/* Knee circles for clarity */}
      <circle cx="16" cy="136" r="5" fill="currentColor" opacity="0.18" />
      <circle cx="124" cy="136" r="5" fill="currentColor" opacity="0.18" />
    </svg>
  );
}

function InLineLungeSVG() {
  return (
    <svg viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
      {/* Ground line */}
      <line x1="10" y1="128" x2="130" y2="128" stroke="currentColor" strokeWidth="2" opacity="0.15" />
      {/* Alignment tape */}
      <line x1="55" y1="128" x2="95" y2="128" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.35" strokeDasharray="4 3" />
      {/* Back knee on ground */}
      <path d="M95 128 Q98 115 100 100" stroke="currentColor" strokeWidth="8" strokeLinecap="round" opacity="0.2" />
      {/* Front leg */}
      <path d="M55 128 Q52 112 52 95" stroke="currentColor" strokeWidth="8" strokeLinecap="round" opacity="0.2" />
      {/* Torso */}
      <line x1="65" y1="95" x2="68" y2="55" stroke="currentColor" strokeWidth="10" strokeLinecap="round" opacity="0.18" />
      {/* Head */}
      <circle cx="70" cy="44" r="10" fill="currentColor" opacity="0.22" />
      {/* Staff on back (vertical) */}
      <line x1="68" y1="128" x2="70" y2="30" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.3" strokeDasharray="5 3" />
      {/* Arms holding staff */}
      <line x1="68" y1="68" x2="58" y2="72" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity="0.18" />
      <line x1="68" y1="88" x2="60" y2="92" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity="0.18" />
    </svg>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function OptionCard({ selected, onClick, label, desc, disabled }: {
  selected: boolean; onClick: () => void; label: string; desc?: string; disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`w-full rounded-2xl border p-3 text-left transition-colors sm:p-4 ${selected ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "border-border bg-card hover:border-primary/40 hover:bg-card/80"} ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
      <p className={`text-sm font-semibold ${selected ? "text-primary" : "text-foreground"}`}>{label}</p>
      {desc && <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>}
    </button>
  );
}

function CheckCard({ checked, onClick, label, disabled }: {
  checked: boolean; onClick: () => void; label: string; disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors sm:p-4 ${checked ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "border-border bg-card hover:border-primary/40"} ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${checked ? "border-primary bg-primary" : "border-border"}`}>
        {checked && (
          <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

function ScoreSelector({ value, onChange, label, disabled }: {
  value: string; onChange: (v: string) => void; label: string; disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex gap-1.5">
        {["0", "1", "2", "3"].map((score) => (
          <button key={score} type="button" onClick={() => onChange(score)} disabled={disabled}
            className={`flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-bold transition-colors ${
              value === score ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary/50"
            } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}>
            {score}
          </button>
        ))}
      </div>
    </div>
  );
}

function PhotoUploadArea({ slot, label, silhouette, preview, onSelect, onRemove, error, disabled }: {
  slot: PhotoSlot; label: string; silhouette: React.ReactNode;
  preview: string | null; onSelect: (file: File) => void; onRemove: () => void;
  error?: string; disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onSelect(file);
    e.target.value = "";
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">{label}</Label>
        <span className="text-xs font-medium text-destructive">Obrigatório</span>
      </div>

      {preview ? (
        <div className="relative overflow-hidden rounded-2xl border border-border">
          <img src={preview} alt={label} className="h-48 w-full object-cover" />
          <button type="button" onClick={onRemove} disabled={disabled}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-background">
            <X className="h-4 w-4" />
          </button>
          <div className="absolute bottom-2 left-2 rounded-lg bg-primary/90 px-2 py-1 text-[11px] font-semibold text-white">
            ✓ {label}
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} disabled={disabled}
          className={`flex h-48 w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed transition-colors ${
            error ? "border-destructive bg-destructive/5" : "border-border bg-card/50 hover:border-primary/50 hover:bg-primary/5"
          } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
          <div className="flex h-20 w-14 items-center justify-center text-muted-foreground/50">
            {silhouette}
          </div>
          <div className="text-center">
            <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Upload className="h-4 w-4" /> Selecionar foto
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground/70">JPG, PNG ou WebP · máx. 10MB</p>
          </div>
        </button>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className={`rounded-xl border px-3 py-2 text-xs text-muted-foreground ${error ? "border-destructive/30" : "border-border/60"}`}>
        {slot === "frontal" && "De frente: braços levemente afastados, pés juntos, olhando para a câmera. Vista corpo inteiro, use roupas justas."}
        {slot === "lateral" && "De lado: postura natural, braços ao lado do corpo. Vista corpo inteiro, qualquer lado."}
        {slot === "posterior" && "De costas: braços levemente afastados, pés juntos. Vista corpo inteiro."}
      </div>

      <input ref={inputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden" onChange={handleChange} disabled={disabled} />
    </div>
  );
}

function FmsTestBlock({ title, description, steps, attentionPoints, svg, dirValue, esqValue,
  onDirChange, onEsqChange, obsValue, onObsChange, dirError, esqError, disabled }: {
  title: string; description: string; steps: string[]; attentionPoints: string[]; svg: React.ReactNode;
  dirValue: string; esqValue: string; onDirChange: (v: string) => void; onEsqChange: (v: string) => void;
  obsValue: string; onObsChange: (v: string) => void; dirError?: string; esqError?: string; disabled?: boolean;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card/40 p-4 sm:p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-24 w-20 shrink-0 items-center justify-center text-primary/60">
          {svg}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Passo a passo</p>
        <ol className="space-y-1">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-foreground">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
        <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Pontos de atenção</p>
        <ul className="space-y-0.5">
          {attentionPoints.map((p, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
              {p}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <ScoreSelector label="Pontuação — Lado Direito" value={dirValue} onChange={onDirChange} disabled={disabled} />
          {dirError && <p className="text-xs text-destructive">{dirError}</p>}
        </div>
        <div className="space-y-1.5">
          <ScoreSelector label="Pontuação — Lado Esquerdo" value={esqValue} onChange={onEsqChange} disabled={disabled} />
          {esqError && <p className="text-xs text-destructive">{esqError}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">Observações (opcional)</Label>
        <Textarea rows={2} placeholder="Dificuldades, dores ou compensações observadas durante o teste..."
          value={obsValue} onChange={(e) => onObsChange(e.target.value)} disabled={disabled}
          className="text-sm" />
      </div>
    </div>
  );
}

function VideoUploadArea({ slot, label, preview, sizeMb, onSelect, onRemove, error, disabled }: {
  slot: VideoSlot; label: string; preview: string | null; sizeMb: string | null;
  onSelect: (file: File) => void; onRemove: () => void; error?: string; disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onSelect(file);
    e.target.value = "";
  }

  const angleLabel = slot === "frontal" ? "de frente" : slot === "lateral" ? "de lado" : "de costas";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">{label}</Label>
        <span className="text-xs font-medium text-destructive">Obrigatório</span>
      </div>

      {preview ? (
        <div className="relative overflow-hidden rounded-2xl border border-border bg-black">
          <video src={preview} controls className="max-h-44 w-full object-contain" />
          <button type="button" onClick={onRemove} disabled={disabled}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-background">
            <X className="h-4 w-4" />
          </button>
          {sizeMb && (
            <div className="absolute bottom-2 left-2 rounded-lg bg-primary/90 px-2 py-1 text-[11px] font-semibold text-white">
              ✓ {label} · {sizeMb} MB
            </div>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} disabled={disabled}
          className={`flex h-36 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed transition-colors ${
            error ? "border-destructive bg-destructive/5" : "border-border bg-card/50 hover:border-primary/50 hover:bg-primary/5"
          } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
          <Video className={`h-8 w-8 ${error ? "text-destructive/50" : "text-muted-foreground/40"}`} />
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">Vídeo {angleLabel}</p>
            <p className="mt-0.5 text-xs text-muted-foreground/70">MP4, MOV ou WebM · máx. 50 MB</p>
          </div>
        </button>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <input ref={inputRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/x-msvideo"
        className="hidden" onChange={handleChange} disabled={disabled} />
    </div>
  );
}

// ─── Options data ─────────────────────────────────────────────────────────────

const DIFFICULTY_OPTIONS = [
  { score: "3", label: "Realizei corretamente", desc: "Posição adequada, sem dor ou dificuldade notável" },
  { score: "2", label: "Com algumas compensações", desc: "Completei mas com desvios ou ajustes" },
  { score: "1", label: "Muita dificuldade", desc: "Completei com grande esforço ou posição incorreta" },
  { score: "0", label: "Não consegui realizar", desc: "Não completei o movimento ou senti dor" },
] as const;

const GOAL_OPTIONS = [
  { value: "hipertrofia", label: "Hipertrofia", desc: "Ganho de massa muscular" },
  { value: "emagrecimento", label: "Emagrecimento", desc: "Redução de gordura corporal" },
  { value: "condicionamento", label: "Condicionamento", desc: "Resistência e disposição" },
  { value: "recomposicao", label: "Recomposição corporal", desc: "Perder gordura e ganhar músculo" },
] as const;

const EXPERIENCE_OPTIONS = [
  { value: "iniciante", label: "Iniciante", desc: "Menos de 6 meses" },
  { value: "intermediario", label: "Intermediário", desc: "6 meses a 2 anos" },
  { value: "avancado", label: "Avançado", desc: "Mais de 2 anos" },
] as const;

const DURATION_OPTIONS = ["30min", "45min", "60min", "90min"] as const;

const TIME_OPTIONS = [
  { value: "manha", label: "Manhã" },
  { value: "tarde", label: "Tarde" },
  { value: "noite", label: "Noite" },
] as const;

const EQUIPMENT_OPTIONS = [
  { value: "academia_completa", label: "Academia completa" },
  { value: "halteres_casa", label: "Halteres em casa" },
  { value: "elasticos", label: "Elásticos / Bandas" },
  { value: "sem_equipamento", label: "Sem equipamento (peso corporal)" },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPhone(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function clearError(key: string, setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>) {
  setErrors((p) => { const n = { ...p }; delete n[key]; return n; });
}

function validatePhoto(file: File): string | null {
  if (!VALID_PHOTO_TYPES.includes(file.type)) return "Formato inválido. Use JPG, PNG ou WebP.";
  if (file.size > MAX_PHOTO_BYTES) return "Foto muito grande. Máximo 10MB.";
  return null;
}

function validateVideo(file: File): string | null {
  if (!VALID_VIDEO_TYPES.includes(file.type)) return "Formato inválido. Use MP4, MOV ou WebM.";
  if (file.size > MAX_VIDEO_BYTES) return "Vídeo muito grande. Máximo 50MB.";
  return null;
}

async function uploadVideo(file: File, slot: VideoSlot): Promise<string> {
  const supabase = getSupabaseClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
  const path = `${crypto.randomUUID()}-deepsquat-${slot}.${ext}`;
  const { error } = await supabase.storage.from(VIDEO_BUCKET).upload(path, file, { contentType: file.type });
  if (error) throw new Error(`Falha ao enviar vídeo ${slot}: ${error.message}`);
  const { data } = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function uploadPhoto(file: File, slot: PhotoSlot): Promise<string> {
  const supabase = getSupabaseClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${crypto.randomUUID()}-${slot}.${ext}`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, { contentType: file.type });
  if (error) throw new Error(`Falha ao enviar foto ${slot}: ${error.message}`);
  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateFormStep(step: number, form: AnamneseForm): Record<string, string> {
  const errors: Record<string, string> = {};

  if (step === 1) {
    if (!form.fullName.trim() || form.fullName.trim().length < 3) errors.fullName = "Nome completo obrigatório (mínimo 3 caracteres).";
    if (!form.email.includes("@") || !form.email.includes(".")) errors.email = "Informe um e-mail válido.";
    const phoneDigits = form.phone.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 11) errors.phone = "Informe DDD + número (WhatsApp).";
    const age = Number(form.age);
    if (!form.age || isNaN(age) || age < 10 || age > 100) errors.age = "Idade deve ser entre 10 e 100 anos.";
    const weight = Number(form.weightKg);
    if (!form.weightKg || isNaN(weight) || weight <= 0 || weight >= 500) errors.weightKg = "Informe seu peso em kg (ex: 75.5).";
  }

  if (step === 2) {
    if (!form.goal) errors.goal = "Selecione seu objetivo principal.";
    if (!form.experienceLevel) errors.experienceLevel = "Selecione seu nível de experiência.";
    const days = Number(form.availableDaysPerWeek);
    if (!form.availableDaysPerWeek || isNaN(days) || days < 1 || days > 7) errors.availableDaysPerWeek = "Informe entre 1 e 7 dias.";
    if (!form.sessionDuration) errors.sessionDuration = "Selecione a duração do treino.";
    if (!form.preferredTime) errors.preferredTime = "Selecione o horário preferido.";
  }

  if (step === 3) {
    if (form.availableEquipment.length === 0) errors.availableEquipment = "Selecione ao menos uma opção de equipamento.";
    if (!form.injuryHistory.trim()) errors.injuryHistory = 'Informe lesões ou limitações (ou escreva "nenhuma").';
  }

  if (step === 5) {
    if (!["0", "1", "2", "3"].includes(form.deepSquatScore)) {
      errors.deepSquatScore = "Avalie sua dificuldade no Deep Squat.";
    }
  }

  return errors;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Anamnese() {
  const { theme, toggleTheme } = useTheme();
  const [step, setStep] = useState(1);

  // Captura o ID do professor do parâmetro ?t= da URL
  const teacherId = new URLSearchParams(window.location.search).get("t") ?? null;

  const [form, setForm] = useState<AnamneseForm>(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      return saved ? { ...INITIAL_FORM, ...JSON.parse(saved) } : INITIAL_FORM;
    } catch {
      return INITIAL_FORM;
    }
  });

  const [photos, setPhotos] = useState<Record<PhotoSlot, PhotoState>>({
    frontal: { file: null, preview: null },
    lateral: { file: null, preview: null },
    posterior: { file: null, preview: null },
  });

  const [deepSquatVideos, setDeepSquatVideos] = useState<Record<VideoSlot, VideoState>>({
    frontal: { file: null, preview: null, sizeMb: null },
    lateral: { file: null, preview: null, sizeMb: null },
    posterior: { file: null, preview: null, sizeMb: null },
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Save form (not photos) to localStorage
  useEffect(() => {
    if (!submitted) {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(form)); } catch { /* noop */ }
    }
  }, [form, submitted]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(photos).forEach(({ preview }) => {
        if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
      });
      Object.values(deepSquatVideos).forEach(({ preview }) => {
        if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function scrollTop() {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setField<K extends keyof AnamneseForm>(key: K, value: AnamneseForm[K]) {
    setForm((p) => ({ ...p, [key]: value }));
    clearError(key as string, setErrors);
  }

  function handlePhotoSelect(slot: PhotoSlot, file: File) {
    const err = validatePhoto(file);
    const errKey = `photo_${slot}`;
    if (err) { setErrors((p) => ({ ...p, [errKey]: err })); return; }
    const prevPreview = photos[slot].preview;
    if (prevPreview?.startsWith("blob:")) URL.revokeObjectURL(prevPreview);
    setPhotos((p) => ({ ...p, [slot]: { file, preview: URL.createObjectURL(file) } }));
    clearError(errKey, setErrors);
  }

  function handlePhotoRemove(slot: PhotoSlot) {
    const prevPreview = photos[slot].preview;
    if (prevPreview?.startsWith("blob:")) URL.revokeObjectURL(prevPreview);
    setPhotos((p) => ({ ...p, [slot]: { file: null, preview: null } }));
  }

  function handleVideoSelect(slot: VideoSlot, file: File) {
    const err = validateVideo(file);
    const errKey = `video_${slot}`;
    if (err) { setErrors((p) => ({ ...p, [errKey]: err })); return; }
    const prevPreview = deepSquatVideos[slot].preview;
    if (prevPreview?.startsWith("blob:")) URL.revokeObjectURL(prevPreview);
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    setDeepSquatVideos((p) => ({ ...p, [slot]: { file, preview: URL.createObjectURL(file), sizeMb } }));
    clearError(errKey, setErrors);
  }

  function handleVideoRemove(slot: VideoSlot) {
    const prevPreview = deepSquatVideos[slot].preview;
    if (prevPreview?.startsWith("blob:")) URL.revokeObjectURL(prevPreview);
    setDeepSquatVideos((p) => ({ ...p, [slot]: { file: null, preview: null, sizeMb: null } }));
  }

  function handleNext() {
    // Step 4: validate photos
    if (step === 4) {
      const photoErrors: Record<string, string> = {};
      if (!photos.frontal.file) photoErrors.photo_frontal = "Foto frontal obrigatória.";
      if (!photos.lateral.file) photoErrors.photo_lateral = "Foto lateral obrigatória.";
      if (!photos.posterior.file) photoErrors.photo_posterior = "Foto posterior obrigatória.";
      if (Object.keys(photoErrors).length > 0) { setErrors(photoErrors); return; }
    } else if (step === 5) {
      // nothing — submit validates step 5
    } else {
      const stepErrors = validateFormStep(step, form);
      if (Object.keys(stepErrors).length > 0) { setErrors(stepErrors); return; }
    }
    setErrors({});
    setStep((s) => s + 1);
    scrollTop();
  }

  function handleBack() {
    setErrors({});
    setStep((s) => s - 1);
    scrollTop();
  }

  function toggleEquipment(value: string) {
    setForm((prev) => ({
      ...prev,
      availableEquipment: prev.availableEquipment.includes(value)
        ? prev.availableEquipment.filter((e) => e !== value)
        : [...prev.availableEquipment, value],
    }));
    clearError("availableEquipment", setErrors);
  }

  async function handleSubmit() {
    const fmsErrors = validateFormStep(5, form);
    const videoErrors: Record<string, string> = {};
    if (!deepSquatVideos.frontal.file) videoErrors.video_frontal = "Vídeo frontal do Deep Squat obrigatório.";
    if (!deepSquatVideos.lateral.file) videoErrors.video_lateral = "Vídeo lateral do Deep Squat obrigatório.";
    if (!deepSquatVideos.posterior.file) videoErrors.video_posterior = "Vídeo posterior do Deep Squat obrigatório.";
    const allErrors = { ...fmsErrors, ...videoErrors };
    if (Object.keys(allErrors).length > 0) { setErrors(allErrors); return; }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // 1. Upload photos + videos in parallel
      const [fotoFrontalUrl, fotoLateralUrl, fotoPosteriorUrl,
             videoFrontalUrl, videoLateralUrl, videoPosteriorUrl] = await Promise.all([
        uploadPhoto(photos.frontal.file!, "frontal"),
        uploadPhoto(photos.lateral.file!, "lateral"),
        uploadPhoto(photos.posterior.file!, "posterior"),
        uploadVideo(deepSquatVideos.frontal.file!, "frontal"),
        uploadVideo(deepSquatVideos.lateral.file!, "lateral"),
        uploadVideo(deepSquatVideos.posterior.file!, "posterior"),
      ]);

      // 2. Submit to edge function
      await invokeSupabaseEdgeFunction(EDGE_FUNCTION_NAMES.anamnesisSubmit, {
        body: {
          teacherId: teacherId ?? undefined,
          fullName: form.fullName.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.replace(/\D/g, ""),
          age: Number(form.age),
          weightKg: Number(form.weightKg),
          goal: form.goal,
          experienceLevel: form.experienceLevel,
          availableDaysPerWeek: Number(form.availableDaysPerWeek),
          sessionDuration: form.sessionDuration,
          preferredTime: form.preferredTime,
          availableEquipment: form.availableEquipment,
          injuryHistory: form.injuryHistory.trim() || "nenhuma",
          hasTrainedBefore: form.hasTrainedBefore,
          stoppedTrainingDuration: form.hasTrainedBefore ? form.stoppedTrainingDuration.trim() || null : null,
          fotoFrontalUrl,
          fotoLateralUrl,
          fotoPosteriorUrl,
          deepSquatScore: Number(form.deepSquatScore),
          deepSquatObs: form.deepSquatObs.trim() || null,
          deepSquatVideoFrontalUrl: videoFrontalUrl,
          deepSquatVideoLateralUrl: videoLateralUrl,
          deepSquatVideoPosteriorUrl: videoPosteriorUrl,
        },
      });

      localStorage.removeItem(DRAFT_KEY);
      setSubmitted(true);
      scrollTop();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar. Tente novamente.";
      setSubmitError(
        msg.toLowerCase().includes("failed to fetch") || msg.toLowerCase().includes("network")
          ? "Erro de conexão. Verifique sua internet e tente novamente."
          : msg,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const progress = Math.round((step / STEPS.length) * 100);
  const isLastStep = step === STEPS.length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative flex min-h-screen items-start justify-center overflow-x-hidden px-3 py-8 sm:px-4 sm:py-10 lg:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.1),transparent_28%)]" />

      <button onClick={toggleTheme} aria-label={theme === "light" ? "Ativar modo escuro" : "Ativar modo claro"}
        className="absolute right-4 top-4 z-10 flex h-12 w-12 items-center justify-center rounded-[20px] border border-border/60 bg-card/80 text-muted-foreground transition-colors hover:text-foreground sm:right-6 sm:top-6">
        {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
      </button>

      <div ref={topRef} className="relative z-10 w-full max-w-[42rem] animate-fade-in py-4">
        {/* Header */}
        <div className="mb-6 flex flex-col items-center text-center sm:mb-8">
          <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
            Sano+ workspace
          </span>
          <Link to="/" className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Sano<span className="text-primary">+</span>
          </Link>
          <h1 className="mt-3 text-balance font-display text-2xl font-semibold text-foreground sm:text-3xl">
            {submitted ? "Anamnese enviada!" : "Ficha de anamnese"}
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            {submitted
              ? "Recebemos seus dados. Em até 48h você receberá seu acesso e treino personalizado por e-mail."
              : "Preencha as informações abaixo para que possamos montar seu treino ideal."}
          </p>
        </div>

        {/* Success screen */}
        {submitted ? (
          <div className="section-shell flex flex-col items-center gap-5 p-6 text-center sm:p-8">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/15">
              <CheckCircle2 className="h-10 w-10 text-primary" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">Anamnese recebida com sucesso!</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Enviamos uma confirmação para <strong>{form.email}</strong>. Nossa equipe vai analisar seu perfil e
                em até <strong>48 horas</strong> você receberá seu acesso e treino personalizado.
              </p>
            </div>
            <div className="mt-2 w-full rounded-2xl border border-border bg-card/60 p-4 text-left">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Próximos passos</p>
              <ol className="mt-3 space-y-2 text-sm text-foreground">
                <li className="flex items-start gap-2"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">1</span>Analisamos seu perfil e objetivos.</li>
                <li className="flex items-start gap-2"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">2</span>Montamos seu treino personalizado.</li>
                <li className="flex items-start gap-2"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">3</span>Você recebe tudo por e-mail para começar.</li>
              </ol>
            </div>
          </div>
        ) : (
          <>
            {/* Progress bar */}
            <div className="mb-5 space-y-2">
              <div className="flex justify-between text-xs font-medium text-muted-foreground">
                <span>Etapa {step} de {STEPS.length} — {STEPS[step - 1]}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <div className="section-shell p-4 sm:p-5 lg:p-6">

              {/* ── Step 1: Dados pessoais ── */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nome completo</Label>
                    <Input id="fullName" autoComplete="name" placeholder="Seu nome completo"
                      value={form.fullName} onChange={(e) => setField("fullName", e.target.value)}
                      className={errors.fullName ? "border-destructive" : ""} />
                    {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" type="email" autoComplete="email" placeholder="seu@email.com"
                      value={form.email} onChange={(e) => setField("email", e.target.value)}
                      className={errors.email ? "border-destructive" : ""} />
                    {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone (WhatsApp)</Label>
                    <Input id="phone" type="tel" inputMode="numeric" autoComplete="tel" placeholder="(11) 99999-9999"
                      value={form.phone} onChange={(e) => setField("phone", formatPhone(e.target.value))}
                      className={errors.phone ? "border-destructive" : ""} />
                    {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="age">Idade</Label>
                      <Input id="age" type="number" inputMode="numeric" placeholder="25" min={10} max={100}
                        value={form.age} onChange={(e) => setField("age", e.target.value)}
                        className={errors.age ? "border-destructive" : ""} />
                      {errors.age && <p className="text-xs text-destructive">{errors.age}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="weightKg">Peso atual (kg)</Label>
                      <Input id="weightKg" type="number" inputMode="decimal" placeholder="75.5" step="0.1"
                        value={form.weightKg} onChange={(e) => setField("weightKg", e.target.value)}
                        className={errors.weightKg ? "border-destructive" : ""} />
                      {errors.weightKg && <p className="text-xs text-destructive">{errors.weightKg}</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step 2: Objetivo e rotina ── */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label>Objetivo principal</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {GOAL_OPTIONS.map((opt) => (
                        <OptionCard key={opt.value} selected={form.goal === opt.value}
                          onClick={() => setField("goal", opt.value)} label={opt.label} desc={opt.desc} />
                      ))}
                    </div>
                    {errors.goal && <p className="text-xs text-destructive">{errors.goal}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Nível de experiência</Label>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {EXPERIENCE_OPTIONS.map((opt) => (
                        <OptionCard key={opt.value} selected={form.experienceLevel === opt.value}
                          onClick={() => setField("experienceLevel", opt.value)} label={opt.label} desc={opt.desc} />
                      ))}
                    </div>
                    {errors.experienceLevel && <p className="text-xs text-destructive">{errors.experienceLevel}</p>}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="days">Dias disponíveis por semana</Label>
                      <Input id="days" type="number" inputMode="numeric" placeholder="3" min={1} max={7}
                        value={form.availableDaysPerWeek} onChange={(e) => setField("availableDaysPerWeek", e.target.value)}
                        className={errors.availableDaysPerWeek ? "border-destructive" : ""} />
                      {errors.availableDaysPerWeek && <p className="text-xs text-destructive">{errors.availableDaysPerWeek}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>Duração do treino</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {DURATION_OPTIONS.map((d) => (
                          <OptionCard key={d} selected={form.sessionDuration === d}
                            onClick={() => setField("sessionDuration", d)} label={d} />
                        ))}
                      </div>
                      {errors.sessionDuration && <p className="text-xs text-destructive">{errors.sessionDuration}</p>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Horário preferido para treinar</Label>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {TIME_OPTIONS.map((opt) => (
                        <OptionCard key={opt.value} selected={form.preferredTime === opt.value}
                          onClick={() => setField("preferredTime", opt.value)} label={opt.label} />
                      ))}
                    </div>
                    {errors.preferredTime && <p className="text-xs text-destructive">{errors.preferredTime}</p>}
                  </div>
                </div>
              )}

              {/* ── Step 3: Contexto físico ── */}
              {step === 3 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label>Equipamentos disponíveis</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {EQUIPMENT_OPTIONS.map((opt) => (
                        <CheckCard key={opt.value} checked={form.availableEquipment.includes(opt.value)}
                          onClick={() => toggleEquipment(opt.value)} label={opt.label} />
                      ))}
                    </div>
                    {errors.availableEquipment && <p className="text-xs text-destructive">{errors.availableEquipment}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Já treinou musculação antes?</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <OptionCard selected={form.hasTrainedBefore} onClick={() => setField("hasTrainedBefore", true)} label="Sim" />
                      <OptionCard selected={!form.hasTrainedBefore}
                        onClick={() => { setField("hasTrainedBefore", false); setField("stoppedTrainingDuration", ""); }} label="Não" />
                    </div>
                  </div>
                  {form.hasTrainedBefore && (
                    <div className="space-y-2">
                      <Label htmlFor="stoppedDuration">Há quanto tempo parou? (opcional)</Label>
                      <Input id="stoppedDuration" placeholder="Ex: 6 meses, 1 ano, 3 semanas..."
                        value={form.stoppedTrainingDuration} onChange={(e) => setField("stoppedTrainingDuration", e.target.value)} />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="injuries">Lesões ou limitações físicas</Label>
                    <Textarea id="injuries" rows={3}
                      placeholder={'Descreva lesões, cirurgias ou limitações. Se não tiver nenhuma, escreva "nenhuma".'}
                      value={form.injuryHistory} onChange={(e) => setField("injuryHistory", e.target.value)}
                      className={errors.injuryHistory ? "border-destructive" : ""} />
                    {errors.injuryHistory && <p className="text-xs text-destructive">{errors.injuryHistory}</p>}
                  </div>
                </div>
              )}

              {/* ── Step 4: Avaliação postural ── */}
              {step === 4 && (
                <div className="space-y-6">
                  <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-sm leading-5 text-muted-foreground">
                    <p className="flex items-center gap-1.5 font-semibold text-foreground">
                      <Camera className="h-4 w-4 text-primary" /> Como tirar as fotos
                    </p>
                    <p className="mt-1">Peça para alguém fotografar ou use um apoio. Distância: 2 a 3 metros. Use roupas justas (shorts/top/regata) para que a postura seja visível. Corpo inteiro, do topo da cabeça até os pés.</p>
                  </div>

                  <PhotoUploadArea slot="frontal" label="Foto Frontal"
                    silhouette={<SilhouetteFrontal />}
                    preview={photos.frontal.preview}
                    onSelect={(f) => handlePhotoSelect("frontal", f)}
                    onRemove={() => handlePhotoRemove("frontal")}
                    error={errors.photo_frontal}
                    disabled={isSubmitting} />

                  <PhotoUploadArea slot="lateral" label="Foto Lateral"
                    silhouette={<SilhouetteLateral />}
                    preview={photos.lateral.preview}
                    onSelect={(f) => handlePhotoSelect("lateral", f)}
                    onRemove={() => handlePhotoRemove("lateral")}
                    error={errors.photo_lateral}
                    disabled={isSubmitting} />

                  <PhotoUploadArea slot="posterior" label="Foto Posterior"
                    silhouette={<SilhouettePosterior />}
                    preview={photos.posterior.preview}
                    onSelect={(f) => handlePhotoSelect("posterior", f)}
                    onRemove={() => handlePhotoRemove("posterior")}
                    error={errors.photo_posterior}
                    disabled={isSubmitting} />
                </div>
              )}

              {/* ── Step 5: Testes funcionais ── */}
              {step === 5 && (
                <div className="space-y-6">
                  <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-sm leading-5 text-muted-foreground">
                    Execute cada teste com cuidado. Para o Deep Squat, grave um vídeo de cada ângulo. <strong>0</strong> = dor ou impossível · <strong>1</strong> = muita dificuldade · <strong>2</strong> = com compensações · <strong>3</strong> = executou corretamente
                  </div>

                  {/* Deep Squat */}
                  <div className="space-y-4 rounded-2xl border border-border bg-card/40 p-4 sm:p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex h-32 w-24 shrink-0 items-center justify-center text-primary/60">
                        <DeepSquatSVG />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">Deep Squat (Agachamento Profundo)</p>
                        <p className="mt-1 text-sm leading-5 text-muted-foreground">
                          Fique em pé com os pés na largura dos ombros. Segure um cabo de vassoura com as mãos bem abertas acima da cabeça (cotovelos estendidos). Desça em agachamento profundo mantendo os calcanhares no chão e o cabo alinhado sobre os pés. Retorne à posição inicial.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Passo a passo</p>
                      <ol className="space-y-1">
                        {[
                          "Fique em pé, pés na largura dos ombros, dedos levemente para fora.",
                          "Segure o cabo com mãos bem abertas, braços estendidos acima da cabeça.",
                          "Desça lentamente até o agachamento mais profundo possível.",
                          "Mantenha calcanhares no chão, tronco o mais ereto possível e joelhos alinhados com os pés.",
                          "Retorne à posição inicial. Repita 3 vezes e avalie sua dificuldade geral.",
                        ].map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">{i + 1}</span>
                            {s}
                          </li>
                        ))}
                      </ol>
                    </div>

                    <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                      <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Pontos de atenção</p>
                      <ul className="space-y-0.5">
                        {[
                          "Calcanhares devem permanecer no chão (não levantar).",
                          "Joelhos não devem colapsar para dentro.",
                          "O cabo deve ficar alinhado acima da cabeça (não cair para frente).",
                          "Tronco o mais ereto possível durante todo o movimento.",
                        ].map((p, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
                            {p}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Difficulty selector */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Como foi sua execução?</Label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {DIFFICULTY_OPTIONS.map((opt) => (
                          <OptionCard key={opt.score} selected={form.deepSquatScore === opt.score}
                            onClick={() => { setField("deepSquatScore", opt.score); clearError("deepSquatScore", setErrors); }}
                            label={opt.label} desc={opt.desc} disabled={isSubmitting} />
                        ))}
                      </div>
                      {errors.deepSquatScore && <p className="text-xs text-destructive">{errors.deepSquatScore}</p>}
                    </div>

                    {/* Video uploads */}
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-foreground">Vídeos do Deep Squat</p>
                      <p className="text-xs text-muted-foreground">Grave de 3 ângulos diferentes realizando o movimento. Os vídeos ajudam na análise postural completa.</p>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <VideoUploadArea slot="frontal" label="Vídeo Frontal"
                          preview={deepSquatVideos.frontal.preview} sizeMb={deepSquatVideos.frontal.sizeMb}
                          onSelect={(f) => handleVideoSelect("frontal", f)} onRemove={() => handleVideoRemove("frontal")}
                          error={errors.video_frontal} disabled={isSubmitting} />
                        <VideoUploadArea slot="lateral" label="Vídeo Lateral"
                          preview={deepSquatVideos.lateral.preview} sizeMb={deepSquatVideos.lateral.sizeMb}
                          onSelect={(f) => handleVideoSelect("lateral", f)} onRemove={() => handleVideoRemove("lateral")}
                          error={errors.video_lateral} disabled={isSubmitting} />
                        <VideoUploadArea slot="posterior" label="Vídeo Posterior"
                          preview={deepSquatVideos.posterior.preview} sizeMb={deepSquatVideos.posterior.sizeMb}
                          onSelect={(f) => handleVideoSelect("posterior", f)} onRemove={() => handleVideoRemove("posterior")}
                          error={errors.video_posterior} disabled={isSubmitting} />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Observações sobre o Deep Squat (opcional)</Label>
                      <Textarea rows={2} placeholder="Dificuldades, dores, compensações que notou durante o movimento..."
                        value={form.deepSquatObs} onChange={(e) => setField("deepSquatObs", e.target.value)}
                        disabled={isSubmitting} className="text-sm" />
                    </div>
                  </div>

                  {submitError && (
                    <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {submitError}
                    </p>
                  )}
                </div>
              )}

              {/* Navigation */}
              <div className={`mt-6 flex ${step > 1 ? "justify-between" : "justify-end"}`}>
                {step > 1 && (
                  <Button type="button" variant="outline" onClick={handleBack} disabled={isSubmitting}>
                    <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
                  </Button>
                )}
                {!isLastStep ? (
                  <Button type="button" onClick={handleNext}>
                    Próximo <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? "Enviando..." : "Enviar anamnese"}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}

        <p className="mt-5 text-center text-xs text-muted-foreground">
          Já tem acesso?{" "}
          <Link to="/" className="font-medium text-primary hover:text-primary/80">Entrar na plataforma</Link>
        </p>
      </div>
    </div>
  );
}
