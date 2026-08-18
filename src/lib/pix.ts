// Gerador de payload PIX (BR Code / EMV) — sem dependências externas
// Especificação BACEN: https://www.bcb.gov.br/content/estabilidadefinanceira/pix_docs/Manual-BR_Code.pdf

function emvField(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

function crc16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function sanitize(str: string, maxLen: number): string {
  return str
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .slice(0, maxLen)
    .toUpperCase();
}

export type PixKeyType = "cpf" | "cnpj" | "email" | "phone" | "random";

export const PIX_KEY_TYPE_LABELS: Record<PixKeyType, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  phone: "Telefone",
  random: "Chave aleatória",
};

export function buildPixPayload(params: {
  pixKey: string;
  merchantName: string;
  merchantCity?: string;
  amount?: number;
  description?: string;
  txId?: string;
}): string {
  const city = sanitize(params.merchantCity ?? "SAO PAULO", 15) || "SAO PAULO";
  const name = sanitize(params.merchantName, 25) || "PERSONAL TRAINER";
  // TxId: somente alfanumérico, max 25 chars; "***" = valor variável
  const txId = (params.txId ?? "***").replace(/[^a-zA-Z0-9*]/g, "").slice(0, 25) || "***";

  const pixSub = emvField("00", "BR.GOV.BCB.PIX") + emvField("01", params.pixKey);
  const merchantAccount = emvField("26", pixSub);
  const additionalData = emvField("62", emvField("05", txId));

  const payload =
    emvField("00", "01") +
    merchantAccount +
    emvField("52", "0000") +
    emvField("53", "986") +
    (params.amount != null ? emvField("54", params.amount.toFixed(2)) : "") +
    emvField("58", "BR") +
    emvField("59", name) +
    emvField("60", city) +
    additionalData +
    "6304";

  return payload + crc16(payload);
}
