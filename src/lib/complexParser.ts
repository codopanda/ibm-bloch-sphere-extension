import { Complex, complex, fromPolar } from './complex.js';

const COMPLEX_REGEX = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*([+-])\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*[ij]$/i;
const POLAR_REGEX = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*(?:∠|angle|ang)\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)/i;
const E_EXP_REGEX = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*e\^\{?i([^}]+)\}?$/i;

export function parseComplexText(text: string): Complex | null {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return null;
  }

  const polarMatch = normalized.match(POLAR_REGEX);
  if (polarMatch) {
    const magnitude = Number(polarMatch[1]);
    const angle = Number(polarMatch[2]);
    if (isFinite(magnitude) && isFinite(angle)) {
      return fromPolar(magnitude, angle);
    }
  }

  const eExpMatch = normalized.match(E_EXP_REGEX);
  if (eExpMatch) {
    const magnitude = Number(eExpMatch[1]);
    const angle = Number(eExpMatch[2]);
    if (isFinite(magnitude) && isFinite(angle)) {
      return fromPolar(magnitude, angle);
    }
  }

  const complexMatch = normalized.match(COMPLEX_REGEX);
  if (complexMatch) {
    const real = Number(complexMatch[1]);
    const imag = Number(`${complexMatch[2]}${complexMatch[3]}`);
    if (isFinite(real) && isFinite(imag)) {
      return { real, imag };
    }
  }

  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?[ij]$/i.test(normalized)) {
    const imag = Number(normalized.replace(/[ij]/i, ''));
    if (isFinite(imag)) {
      return { real: 0, imag };
    }
  }

  const value = Number(normalized.replace(/[ij]/gi, ''));
  if (isFinite(value)) {
    return { real: value, imag: 0 };
  }

  return null;
}
