import { describe, expect, it } from "vitest";
import {
  buildYoutubeEmbedUrl,
  isDirectVideoUrl,
  isYoutubeUrl,
  parseYoutubeVideoId,
  validateExerciseVideoUrl,
} from "@/lib/video-url";

const ID = "dQw4w9WgXcQ";

describe("parseYoutubeVideoId", () => {
  it("aceita as formas de link que as pessoas realmente colam", () => {
    const casos = [
      `https://www.youtube.com/watch?v=${ID}`,
      `https://youtube.com/watch?v=${ID}`,
      `https://m.youtube.com/watch?v=${ID}`,
      `https://youtu.be/${ID}`,
      `https://www.youtube.com/shorts/${ID}`,
      `https://www.youtube.com/embed/${ID}`,
      `https://www.youtube.com/live/${ID}`,
      // sem protocolo — copiado da barra de endereço
      `youtube.com/watch?v=${ID}`,
      `youtu.be/${ID}`,
      // com espaço em volta
      `  https://youtu.be/${ID}  `,
    ];

    for (const caso of casos) {
      expect(parseYoutubeVideoId(caso), caso).toBe(ID);
    }
  });

  it("preserva o id quando há parâmetros extras na URL", () => {
    expect(parseYoutubeVideoId(`https://www.youtube.com/watch?v=${ID}&t=42s`)).toBe(ID);
    expect(parseYoutubeVideoId(`https://youtu.be/${ID}?t=42`)).toBe(ID);
    expect(parseYoutubeVideoId(`https://www.youtube.com/watch?list=PL123&v=${ID}`)).toBe(ID);
  });

  it("devolve null para entrada vazia ou inválida", () => {
    for (const caso of [null, undefined, "", "   ", "não é url", "javascript:alert(1)"]) {
      expect(parseYoutubeVideoId(caso)).toBeNull();
    }
  });

  it("recusa host que apenas parece YouTube", () => {
    // proteção contra domínio de phishing terminando em youtube.com
    expect(parseYoutubeVideoId(`https://youtube.com.evil.net/watch?v=${ID}`)).toBeNull();
    expect(parseYoutubeVideoId(`https://notyoutube.com/watch?v=${ID}`)).toBeNull();
    expect(parseYoutubeVideoId(`https://vimeo.com/watch?v=${ID}`)).toBeNull();
  });

  it("recusa id com tamanho errado", () => {
    expect(parseYoutubeVideoId("https://youtu.be/curto")).toBeNull();
    expect(parseYoutubeVideoId("https://youtu.be/idmuitolongodemais123")).toBeNull();
    expect(parseYoutubeVideoId("https://www.youtube.com/watch?v=abc")).toBeNull();
  });

  it("recusa a home e a busca do YouTube", () => {
    expect(parseYoutubeVideoId("https://www.youtube.com")).toBeNull();
    expect(parseYoutubeVideoId("https://www.youtube.com/results?search_query=agachamento")).toBeNull();
  });
});

describe("buildYoutubeEmbedUrl", () => {
  it("monta embed no dominio sem cookie", () => {
    expect(buildYoutubeEmbedUrl(ID)).toBe(
      `https://www.youtube-nocookie.com/embed/${ID}?rel=0&modestbranding=1`,
    );
  });
});

describe("validateExerciseVideoUrl", () => {
  it("aceita campo vazio — o link e opcional", () => {
    expect(validateExerciseVideoUrl("")).toBeNull();
    expect(validateExerciseVideoUrl("   ")).toBeNull();
  });

  it("aceita YouTube e mp4 direto em https", () => {
    expect(validateExerciseVideoUrl(`https://youtu.be/${ID}`)).toBeNull();
    expect(validateExerciseVideoUrl("https://cdn.exemplo.com/agachamento.mp4")).toBeNull();
    expect(validateExerciseVideoUrl("https://cdn.exemplo.com/v.mp4?token=abc")).toBeNull();
  });

  it("explica o problema em vez de so recusar", () => {
    expect(validateExerciseVideoUrl("http://cdn.exemplo.com/v.mp4")).toMatch(/https/i);
    expect(validateExerciseVideoUrl("https://vimeo.com/123456")).toMatch(/YouTube/i);
  });
});

describe("isDirectVideoUrl", () => {
  it("separa o que a tag video consegue tocar", () => {
    expect(isDirectVideoUrl("https://projeto.supabase.co/storage/v1/object/public/x/demo.mp4")).toBe(true);
    expect(isDirectVideoUrl("blob:http://localhost:8080/abc-123")).toBe(true);
    expect(isDirectVideoUrl(`https://youtu.be/${ID}`)).toBe(false);
    expect(isDirectVideoUrl(null)).toBe(false);
    expect(isDirectVideoUrl("")).toBe(false);
  });
});

describe("isYoutubeUrl", () => {
  it("concorda com o parser", () => {
    expect(isYoutubeUrl(`https://youtu.be/${ID}`)).toBe(true);
    expect(isYoutubeUrl("https://exemplo.com/v.mp4")).toBe(false);
  });
});
