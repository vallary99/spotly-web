// Mirrors spotly-api's src/common/utils/phone.util.ts. M-Pesa STK Push
// only works for Safaricom lines, in 2547XXXXXXXX / 2541XXXXXXXX
// format. People naturally type 0712345678, +254712345678, or
// 254712345678 — this accepts all of those and normalizes to what the
// API expects, or returns null if it's not a plausible Safaricom
// number at all.
const SAFARICOM_REGEX = /^254(7\d{8}|11[0-5]\d{6})$/;

export function normalizeKenyanMsisdn(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9]/g, "");

  let normalized: string;
  if (digits.startsWith("254")) {
    normalized = digits;
  } else if (digits.startsWith("0")) {
    normalized = `254${digits.slice(1)}`;
  } else if (digits.startsWith("7") || digits.startsWith("1")) {
    normalized = `254${digits}`;
  } else {
    return null;
  }

  return SAFARICOM_REGEX.test(normalized) ? normalized : null;
}
