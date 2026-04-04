export function formatDate(date: string) {
  return new Date(date).toLocaleDateString("pt-BR");
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function getDaysUntil(date?: string) {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function getRelativeWorkoutLabel(date?: string) {
  const days = getDaysUntil(date);

  if (days === null) return "Sem data";
  if (days <= 0) return "Hoje";
  if (days === 1) return "1 dia";
  return `${days} dias`;
}
