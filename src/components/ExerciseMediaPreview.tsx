import { useEffect, useState } from "react";
import { PlayCircle } from "lucide-react";
import { Exercise } from "@/types";
import { loadPersistedExerciseVideo } from "@/lib/exercise-media";
import { buildYoutubeEmbedUrl, isDirectVideoUrl, parseYoutubeVideoId } from "@/lib/video-url";

interface Props {
  exercise: Pick<Exercise, "name" | "videoUrl" | "videoStoragePath" | "thumbnailUrl">;
  className?: string;
}

const MOLDURA = "overflow-hidden rounded-[20px] border border-border/60 bg-background/70";
const ROTULO =
  "border-b border-border/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground";

export default function ExerciseMediaPreview({ exercise, className = "" }: Props) {
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string | null>(null);
  // A imagem vem de CDN externa (jsDelivr). Se cair, volta para o estado vazio
  // em vez de deixar um ícone de imagem quebrada na tela do aluno.
  const [imageFailed, setImageFailed] = useState(false);

  // Trocou de exercício, zera a falha: senão o componente reaproveitado esconde
  // a imagem do exercício seguinte por causa do erro do anterior.
  useEffect(() => {
    setImageFailed(false);
  }, [exercise.thumbnailUrl]);

  const youtubeId = parseYoutubeVideoId(exercise.videoUrl);

  useEffect(() => {
    let active = true;
    let objectUrlToRevoke: string | null = null;

    // Link do YouTube não passa por aqui: vira iframe, não <video>.
    if (parseYoutubeVideoId(exercise.videoUrl)) {
      setResolvedVideoUrl(null);
      return () => {
        active = false;
      };
    }

    // A URL direta tem prioridade sobre o IndexedDB. Em produção o upload grava
    // video_url (URL pública do bucket) E video_storage_path — e o IndexedDB
    // fica sempre vazio, porque persistExerciseVideoFile só é usado pelo store
    // LocalStorage. Checar o storage_path primeiro fazia o vídeo do professor
    // nunca aparecer, nem para ele mesmo.
    if (isDirectVideoUrl(exercise.videoUrl)) {
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

  if (youtubeId) {
    return (
      <div className={`${MOLDURA} ${className}`.trim()}>
        <div className={ROTULO}>Vídeo do YouTube</div>
        <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
          <iframe
            src={buildYoutubeEmbedUrl(youtubeId)}
            title={`Demonstração do exercício ${exercise.name}`}
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 h-full w-full border-0"
          />
        </div>
      </div>
    );
  }

  if (resolvedVideoUrl) {
    return (
      <div className={`${MOLDURA} ${className}`.trim()}>
        <div className={ROTULO}>Vídeo MP4</div>
        <video
          controls
          preload="metadata"
          poster={exercise.thumbnailUrl ?? undefined}
          className="h-64 w-full bg-black object-cover"
        >
          <source src={resolvedVideoUrl} type="video/mp4" />
          Seu navegador não suporta vídeo MP4.
        </video>
      </div>
    );
  }

  // Sem vídeo, cai para a imagem de demonstração do catálogo global. O vídeo do
  // professor sempre ganha: a imagem é o piso, não a preferência.
  if (exercise.thumbnailUrl && !imageFailed) {
    return (
      <div className={`${MOLDURA} ${className}`.trim()}>
        <div className={ROTULO}>Demonstração</div>
        <img
          src={exercise.thumbnailUrl}
          alt={`Demonstração do exercício ${exercise.name}`}
          loading="lazy"
          onError={() => setImageFailed(true)}
          className="h-64 w-full bg-white object-contain"
        />
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-[20px] border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground ${className}`.trim()}
    >
      <PlayCircle className="h-5 w-5 shrink-0 text-primary" />
      Nenhuma mídia adicionada ainda. O exercício continua pronto para uso mesmo sem vídeo.
    </div>
  );
}
