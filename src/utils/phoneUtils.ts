/**
 * Egyptian B2B Phone Normalization & Validation Utility
 *
 * Handles:
 * - Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩ -> 0123456789)
 * - Leading/trailing and internal spaces, dashes, parentheses
 * - Egyptian international prefixes (+20, 0020, 20)
 * - Strict 11-digit mobile validation (010, 011, 012, 015)
 */

export function normalizeEgyptianPhone(input: string | null | undefined): string {
  if (!input) return '';

  // 1. Convert Arabic-Indic digits to Latin 0-9
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let cleaned = String(input);
  arabicDigits.forEach((d, i) => {
    cleaned = cleaned.split(d).join(String(i));
  });

  // 2. Strip whitespace and non-digits except potential leading +
  cleaned = cleaned.trim();
  const hasPlus = cleaned.startsWith('+');
  cleaned = cleaned.replace(/\D/g, '');

  // 3. Normalize international Egyptian formats to local 01xxxxxxxxx
  if (cleaned.startsWith('0020') && cleaned.length >= 13) {
    cleaned = '0' + cleaned.slice(4);
  } else if (cleaned.startsWith('20') && cleaned.length === 12) {
    cleaned = '0' + cleaned.slice(2);
  } else if (hasPlus && cleaned.startsWith('20') && cleaned.length === 12) {
    cleaned = '0' + cleaned.slice(2);
  }

  return cleaned;
}

export function isValidEgyptianMobile(phone: string | null | undefined): boolean {
  const norm = normalizeEgyptianPhone(phone);
  return /^01[0125]\d{8}$/.test(norm);
}

export function formatEgyptianPhoneDisplay(phone: string | null | undefined): string {
  const norm = normalizeEgyptianPhone(phone);
  if (norm.length === 11) {
    return `${norm.slice(0, 4)} ${norm.slice(4, 7)} ${norm.slice(7)}`;
  }
  return norm;
}
