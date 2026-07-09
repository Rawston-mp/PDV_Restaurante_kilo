export function textToEscposMock(text: string): Uint8Array {
  const encoder = new TextEncoder();
  const init = "\x1B\x40";
  const cut = "\n\n\n\x1D\x56\x42\x00";

  return encoder.encode(`${init}${text}${cut}`);
}