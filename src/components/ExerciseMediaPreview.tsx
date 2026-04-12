import { useEffect, useState } from "react";
import { Exercise } from "@/types";
import { loadPersistedExerciseVideo } from "@/lib/exercise-media";

interface Props {
  exercise: Pick<Exercise, "name" | "videoFileUrl" | "videoStorageKey" | "youtubeEmbedUrl">;
  className?: string;
}

export default function ExerciseMediaPreview({ exercise, className = "" }: Props) {
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrlToRevoke: string | null = null;
    const canUseDirectUrl = Boolean(exercise.videoFileUrl && !exercise.videoFileUrl.startsWith("blob:"));

    if (!exercise.videoStorageKey && canUseDirectUrl) {
      setResolvedVideoUrl(exercise.videoFileUrl);
      return () => {
        active = false;
      };
    }

    if (!exercise.videoStorageKey) {
      setResolvedVideoUrl(null);
      return () => {
        active = false;
      };
    }

    loadPersistedExerciseVideo(exercise.videoStorageKey)
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
  }, [exercise.videoFileUrl, exercise.videoStorageKey]);

  const hasVideo = Boolean(resolvedVideoUrl);
  const hasYoutube = Boolean(exercise.youtubeEmbedUrl);

  if (!hasVideo && !hasYoutube) return null;

  return (
    <div className={`grid gap-3 ${hasVideo && hasYoutube ? "lg:grid-cols-2" : ""} ${className}`.trim()}>
      {resolvedVideoUrl && (
        <div className="overflow-hidden rounded-[20px] border border-border/60 bg-background/70">
          <div className="border-b border-border/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Video MP4
          </div>
          <video controls preload="metadata" className="h-64 w-full bg-black object-cover">
            <source src={resolvedVideoUrl} type="video/mp4" />
            Seu navegador nao suporta video MP4.
          </video>
        </div>
      )}

      {exercise.youtubeEmbedUrl && (
        <div className="overflow-hidden rounded-[20px] border border-border/60 bg-background/70">
          <div className="border-b border-border/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            YouTube
          </div>
          <iframe
            src={exercise.youtubeEmbedUrl}
            title={`Video de ${exercise.name}`}
            className="h-64 w-full"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}
