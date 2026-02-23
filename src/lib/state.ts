import { Complex, abs2, complex, conj, mul } from './complex.js';

export interface BlochVector {
  index: number;
  x: number;
  y: number;
  z: number;
  radius: number;
  theta: number;
  phi: number;
}

export interface BlochComputationResult {
  qubitCount: number;
  vectors: BlochVector[];
}

function nextPowerOfTwo(value: number): number {
  if (value <= 1) {
    return 1;
  }
  return 1 << Math.ceil(Math.log2(value));
}

export function normalizeStateVector(state: Complex[]): Complex[] {
  const total = Math.sqrt(state.reduce((sum, amp) => sum + abs2(amp), 0));
  if (!isFinite(total) || total === 0) {
    return state.map(() => complex(0, 0));
  }
  return state.map((amp) => ({ real: amp.real / total, imag: amp.imag / total }));
}

export function computeBlochVectors(state: Complex[]): BlochComputationResult {
  const normalizedState = normalizeStateVector(state);
  const dimension = normalizedState.length;
  const qubitCount = Math.max(1, Math.round(Math.log2(dimension)));
  const expectedDimension = nextPowerOfTwo(dimension);

  if (expectedDimension !== dimension) {
    normalizedState.length = expectedDimension;
    for (let i = dimension; i < expectedDimension; i += 1) {
      normalizedState[i] = complex(0, 0);
    }
  }

  const vectors: BlochVector[] = [];
  for (let qubit = 0; qubit < qubitCount; qubit += 1) {
    const rho = reducedDensity(normalizedState, qubit, qubitCount);
    const x = 2 * rho.offDiag.real;
    const y = -2 * rho.offDiag.imag;
    const z = rho.zeroZero - rho.oneOne;
    const radius = Math.min(1, Math.sqrt(x * x + y * y + z * z));
    const theta = radius === 0 ? 0 : Math.acos(clamp(z / (radius === 0 ? 1 : radius), -1, 1));
    const phi = Math.atan2(y, x);
    vectors.push({ index: qubit, x, y, z, radius, theta, phi });
  }

  return { qubitCount, vectors };
}

function reducedDensity(state: Complex[], qubit: number, totalQubits: number) {
  const zeroZero = { real: 0, imag: 0 };
  const oneOne = { real: 0, imag: 0 };
  const offDiag = complex(0, 0);
  const qubitMask = 1 << qubit;
  const restSize = 1 << (totalQubits - 1);

  for (let rest = 0; rest < restSize; rest += 1) {
    const basisZero = insertBit(rest, qubit, 0);
    const basisOne = insertBit(rest, qubit, 1);
    const ampZero = state[basisZero] ?? complex(0, 0);
    const ampOne = state[basisOne] ?? complex(0, 0);
    zeroZero.real += abs2(ampZero);
    oneOne.real += abs2(ampOne);
    const product = mul(ampZero, conj(ampOne));
    offDiag.real += product.real;
    offDiag.imag += product.imag;
  }

  return {
    zeroZero: zeroZero.real,
    oneOne: oneOne.real,
    offDiag
  };
}

function insertBit(rest: number, position: number, value: 0 | 1): number {
  const lowerMask = (1 << position) - 1;
  const lower = rest & lowerMask;
  const upper = rest & ~lowerMask;
  return (upper << 1) | (value << position) | lower;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
