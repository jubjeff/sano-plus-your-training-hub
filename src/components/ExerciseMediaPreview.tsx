import { useEffect, useState } from "react";
import { PlayCircle } from "lucide-react";
import { Exercise } from "@/types";
import { loadPersistedExerciseVideo } from "@/lib/exercise-media";

interface Props {
  exercise: Pick<Exercise, "name" | "videoUrl" | "videoStoragePath" | "thumbnailUrl">;
  className?: string;
}

export default function ExerciseMediaPreview({ exercise, className = "" }: Props) {
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrlToRevoke: string | null = null;
    const canUseDirectUrl = Boolean(exercise.videoUrl && !exercise.videoUrl.startsWith("blob:"));

    if (!exercise.videoStoragePath && canUseDirectUrl) {
      setResolvedVideoUrl(exercise.videoUrl ?? null);
      return () => {
        active = false;
      };
    }

    if (!exercise.videoStoragePath) {
      setResolvedVideoUrl(null);
      return () => {
        active = false;
      };
    }

    loadPersistedExerciseVideo(exercise.videoStoragePath)
      .then((url) => {
        if (!active) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        objectUrlToRevoke = url;
        setResolvedVideoUrl(url);
      })
      .catch(() => {
        if (active) setResolvedVideoUrl(null);
      });

    return () => {
      active = false;
      if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
    };
  }, [exercise.videoUrl, exercise.videoStoragePath]);

  if (!resolvedVideoUrl) {
    return (
      <div className={`flex items-center gap-3 rounded-[20px] border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground ${className}`.trim()}>
        <PlayCircle className="h-5 w-5 text-primary" />
        Nenhuma mídia adicionada ainda. O exercício continua pronto para uso mesmo sem vídeo.
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-[20px] border border-border/60 bg-background/70 ${className}`.trim()}>
      <div className="border-b border-border/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        Vídeo MP4
      </div>
      <video controls preload="metadata" poster={exercise.thumbnailUrl ?? undefined} className="h-64 w-full bg-black object-cover">
        <source src={resolvedVideoUrl} type="video/mp4" />
        Seu navegador não suporta vídeo MP4.
      </video>
    </div>
  );
}
