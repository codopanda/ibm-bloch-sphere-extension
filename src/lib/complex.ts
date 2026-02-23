export interface Complex {
  real: number;
  imag: number;
}

export function complex(real = 0, imag = 0): Complex {
  return { real, imag };
}

export function add(a: Complex, b: Complex): Complex {
  return { real: a.real + b.real, imag: a.imag + b.imag };
}

export function sub(a: Complex, b: Complex): Complex {
  return { real: a.real - b.real, imag: a.imag - b.imag };
}

export function mul(a: Complex, b: Complex): Complex {
  return {
    real: a.real * b.real - a.imag * b.imag,
    imag: a.real * b.imag + a.imag * b.real
  };
}

export function conj(a: Complex): Complex {
  return { real: a.real, imag: -a.imag };
}

export function abs2(a: Complex): number {
  return a.real * a.real + a.imag * a.imag;
}

export function clone(a: Complex): Complex {
  return { real: a.real, imag: a.imag };
}

export function fromPolar(magnitude: number, phase: number): Complex {
  return { real: magnitude * Math.cos(phase), imag: magnitude * Math.sin(phase) };
}

export function approxEqual(a: Complex, b: Complex, eps = 1e-6): boolean {
  return Math.abs(a.real - b.real) < eps && Math.abs(a.imag - b.imag) < eps;
}
