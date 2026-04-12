import { Camera, Trash2, Upload } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

type ProfileImageFieldProps = {
  previewUrl: string | null;
  onFileChange: (file: File | null) => void;
  onRemove: () => void;
  error?: string;
  disabled?: boolean;
  fullName?: string;
};

function getInitials(value?: string) {
  const parts = value?.trim().split(/\s+/).filter(Boolean) ?? [];
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "SP";
}

export default function ProfileImageField({
  previewUrl,
  onFileChange,
  onRemove,
  error,
  disabled,
  fullName,
}: ProfileImageFieldProps) {
  return (
    <div className="space-y-3 rounded-[24px] border border-border/60 bg-muted/30 p-4">
      <div className="flex items-center gap-4">
        <Avatar className="h-20 w-20 rounded-[28px] border border-border/60">
          {previewUrl ? <AvatarImage src={previewUrl} alt="Foto de perfil" className="object-cover" /> : null}
          <AvatarFallback className="rounded-[28px] bg-primary/10 font-semibold text-primary">
            {getInitials(fullName)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Foto de perfil</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            JPG, PNG ou WebP com ate 5 MB. O preview aparece antes de salvar.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
          <Upload className="h-4 w-4" />
          {previewUrl ? "Trocar foto" : "Enviar foto"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            disabled={disabled}
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
          />
        </label>

        {previewUrl ? (
          <Button type="button" variant="outline" onClick={onRemove} disabled={disabled}>
            <Trash2 className="h-4 w-4" />
            Remover
          </Button>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-md border border-dashed border-border/70 px-3 py-2 text-sm text-muted-foreground">
            <Camera className="h-4 w-4" />
            Avatar padrao automatico
          </div>
        )}
      </div>

      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
