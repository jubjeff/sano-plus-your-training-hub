/**
 * Reconhecimento de URL de vídeo externo para a biblioteca de exercícios.
 *
 * O campo `exercises.video_url` guarda duas coisas diferentes: a URL pública do
 * MP4 no bucket `exercise-media` ou um link do YouTube. Quem decide como
 * renderizar (`<video>` ou `<iframe>`) é o formato da URL, não uma coluna nova —
 * evita migration e mantém o mapper intocado.
 *
 * O embed sai no domínio `youtube-nocookie.com`: o aluno não é rastreado por
 * abrir a ficha de um exercício.
 */

const ID_VALIDO = /^[A-Za-z0-9_-]{11}$/;

const HOSTS_YOUTUBE = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

const HOSTS_CURTOS = new Set(["youtu.be", "www.youtu.be"]);

/** Caminhos que carregam o id no primeiro segmento: /shorts/ID, /embed/ID, /live/ID */
const PREFIXOS_COM_ID = ["shorts", "embed", "live", "v"];

/**
 * Extrai o id de 11 caracteres de qualquer forma conhecida de URL do YouTube.
 * Devolve null se não for YouTube ou se o id não for válido.
 */
export function parseYoutubeVideoId(input: string | null | undefined): string | null {
  if (!input) return null;

  const texto = input.trim();
  if (!texto) return null;

  let url: URL;
  try {
    // Aceita "youtube.com/watch?v=..." sem protocolo, que é como as pessoas colam.
    url = new URL(/^https?:\/\//i.test(texto) ? texto : `https://${texto}`);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();

  if (HOSTS_CURTOS.has(host)) {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id && ID_VALIDO.test(id) ? id : null;
  }

  if (!HOSTS_YOUTUBE.has(host)) return null;

  const segmentos = url.pathname.split("/").filter(Boolean);

  if (segmentos[0] === "watch") {
    const id = url.searchParams.get("v");
    return id && ID_VALIDO.test(id) ? id : null;
  }

  if (segmentos.length >= 2 && PREFIXOS_COM_ID.includes(segmentos[0])) {
    const id = segmentos[1];
    return ID_VALIDO.test(id) ? id : null;
  }

  return null;
}

export function isYoutubeUrl(input: string | null | undefined): boolean {
  return parseYoutubeVideoId(input) !== null;
}

/** URL de embed pronta para o src do iframe. */
export function buildYoutubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
}

/**
 * Valida o que o professor digitou no campo de link.
 * Devolve a mensagem de erro, ou null quando está aceitável.
 */
export function validateExerciseVideoUrl(input: string): string | null {
  const texto = input.trim();
  if (!texto) return null;

  if (isYoutubeUrl(texto)) return null;

  // Vídeo hospedado em outro lugar só toca se for MP4 servido direto.
  if (/^https:\/\//i.test(texto) && /\.mp4($|\?)/i.test(texto)) return null;

  if (/^http:\/\//i.test(texto)) {
    return "Use um endereço https — links http são bloqueados no navegador.";
  }

  return "Cole um link do YouTube (youtube.com ou youtu.be) ou a URL direta de um arquivo .mp4.";
}

/** true quando a URL aponta para um arquivo tocável pela tag <video>. */
export function isDirectVideoUrl(input: string | null | undefined): boolean {
  if (!input) return false;
  if (input.startsWith("blob:")) return true;
  return /^https?:\/\//i.test(input) && !isYoutubeUrl(input);
}
