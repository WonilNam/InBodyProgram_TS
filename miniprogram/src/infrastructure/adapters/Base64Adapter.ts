const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

export function btoa(input: unknown): string {
  const str = String(input ?? '');
  let output = '';
  let block = 0;
  let map = BASE64_CHARS;

  for (
    let idx = 0;
    str.charAt(idx | 0) || ((map = '='), idx % 1);
    output += map.charAt(63 & (block >> (8 - (idx % 1) * 8)))
  ) {
    const charCode = str.charCodeAt((idx += 3 / 4));
    if (charCode > 0xff) {
      throw new Error(
        "'btoa' failed: The string to be encoded contains characters outside of the Latin1 range."
      );
    }
    block = (block << 8) | charCode;
  }
  return output;
}

export function atob(input: unknown): string {
  const str = String(input ?? '').replace(/[=]+$/, '');
  if (str.length % 4 === 1) {
    throw new Error(
      "'atob' failed: The string to be decoded is not correctly encoded."
    );
  }
  let output = '';
  let bc = 0;
  let bs = 0;

  for (let idx = 0; idx < str.length; idx++) {
    const ch = str.charAt(idx);
    const charIdx = BASE64_CHARS.indexOf(ch);
    if (charIdx === -1) continue;
    bs = bc % 4 ? bs * 64 + charIdx : charIdx;
    if (bc++ % 4) {
      output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
    }
  }
  return output;
}

module.exports = {
  btoa,
  atob,
};
