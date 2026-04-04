import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SanoExerciseCatalogItem } from "@/types/exercisedb";

interface Props {
  exercise: SanoExerciseCatalogItem;
  onSelect: (exercise: SanoExerciseCatalogItem) => void;
}

export default function ExerciseResultCard({ exercise, onSelect }: Props) {
  return (
    <article className="rounded-[24px] border border-border/60 bg-background/70 p-4 transition-colors hover:border-primary/30">
      <div className="flex gap-4">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[18px] border border-border/60 bg-card">
          {exercise.imageUrl ? (
            <img src={exercise.imageUrl} alt={exercise.name} className="h-full w-full object-cover" />
          ) : (
            <span className="px-3 text-center text-xs text-muted-foreground">Sem mídia</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold">{exercise.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {[exercise.bodyPart, exercise.target].filter(Boolean).join(" • ")}
              </p>
            </div>
            <Button size="sm" onClick={() => onSelect(exercise)}>
              Adicionar
            </Button>
          </div>

          {exercise.summary && <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{exercise.summary}</p>}

          <div className="mt-3 flex flex-wrap gap-2">
            {(exercise.muscles ?? []).slice(0, 2).map((muscle) => (
              <Badge key={`${exercise.externalId}-${muscle}`} variant="secondary" className="bg-primary/10 text-primary">
                {muscle}
              </Badge>
            ))}
            {(exercise.secondaryMuscles ?? []).slice(0, 2).map((muscle) => (
              <Badge key={`${exercise.externalId}-secondary-${muscle}`} variant="outline">
                {muscle}
              </Badge>
            ))}
            {(exercise.equipment ?? []).slice(0, 2).map((item) => (
              <Badge key={`${exercise.externalId}-${item}`} variant="outline">
                {item}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
