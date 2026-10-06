/**
 * Turns a typed phone number into E.164.
 * An Israeli mobile that starts with 0 (05… or 07…) becomes +972.
 * Any other country must already include the + country code.
 */
export function toE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const digits = trimmed.replace(/\D/g, '');
  if (digits === '') return null;

  const international = trimmed.startsWith('+')
    ? digits
    : digits.startsWith('972') && digits.length === 12
      ? digits
      : isIsraeliMobile(digits)
        ? `972${digits.slice(1)}`
        : null;
  if (international === null) return null;
  if (!/^[1-9]\d{7,14}$/.test(international)) return null;
  return `+${international}`;
}

/** Local Israeli mobiles are 10 digits and start with 05 or 07. */
function isIsraeliMobile(digits: string): boolean {
  return digits.length === 10 && (digits.startsWith('05') || digits.startsWith('07'));
}
