// Deflated Sharpe ratio (Bailey and Lopez de Prado, 2014).
//
// The best of many tried variants has a flattering Sharpe ratio even when none
// of them has any edge. This estimates how large the best Sharpe of N unskilled
// variants would be (the "benchmark"), then asks how likely the observed Sharpe
// is to be real once that is allowed for. Sharpe ratios here are per period,
// not annualized, because the formula uses the number of observations.
//
// Assumptions worth stating next to any number it produces: returns are treated
// as independent over time, the N variants are treated as independent trials,
// and N counts only the variants the caller knows about.
import { mean } from "@/lib/math/stats";

const EULER_MASCHERONI = 0.5772156649015329;

/** Standard normal CDF (West's double-precision form of Hart's algorithm). */
export function normCdf(x: number): number {
  const z = Math.abs(x);
  let tail: number;
  if (z > 37) {
    tail = 0;
  } else {
    const e = Math.exp((-z * z) / 2);
    if (z < 7.07106781186547) {
      let n = 0.0352624965998911 * z + 0.700383064443688;
      n = n * z + 6.37396220353165;
      n = n * z + 33.912866078383;
      n = n * z + 112.079291497871;
      n = n * z + 221.213596169931;
      n = n * z + 220.206867912376;
      let d = 0.0883883476483184 * z + 1.75566716318264;
      d = d * z + 16.064177579207;
      d = d * z + 86.7807322029461;
      d = d * z + 296.564248779674;
      d = d * z + 637.333633378831;
      d = d * z + 793.826512519948;
      d = d * z + 440.413735824752;
      tail = (e * n) / d;
    } else {
      let b = z + 0.65;
      b = z + 4 / b;
      b = z + 3 / b;
      b = z + 2 / b;
      b = z + 1 / b;
      tail = e / b / 2.506628274631;
    }
  }
  return x > 0 ? 1 - tail : tail;
}

/** Inverse of the standard normal CDF (Acklam's rational approximation, refined once). */
export function normInv(p: number): number {
  if (!(p > 0 && p < 1)) return p <= 0 ? -Infinity : Infinity;
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const low = 0.02425;
  let x: number;
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p > 1 - low) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else {
    const q = p - 0.5;
    const r = q * q;
    x = ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  // One Halley step brings the approximation to near machine precision.
  const e = normCdf(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}

/**
 * The best per-period Sharpe expected from `trials` variants that all have no
 * edge, given the spread (variance) of the trials' Sharpe ratios.
 */
export function expectedMaxSharpe(trials: number, sharpeVariance: number): number {
  if (!(trials > 1) || !(sharpeVariance > 0)) return 0;
  return (
    Math.sqrt(sharpeVariance) *
    ((1 - EULER_MASCHERONI) * normInv(1 - 1 / trials) + EULER_MASCHERONI * normInv(1 - 1 / (trials * Math.E)))
  );
}

interface DeflatedSharpeInput {
  /** Per-period Sharpe of the best variant. */
  sharpe: number;
  /** Number of return observations behind it. */
  observations: number;
  skew: number;
  /** Raw kurtosis (3 for a normal distribution). */
  kurtosis: number;
  /** How many variants were tried. */
  trials: number;
  /** Sample variance of the variants' per-period Sharpe ratios. */
  trialSharpeVariance: number;
}

interface DeflatedSharpe {
  /** Probability the best variant's true Sharpe is above what luck alone would produce, from 0 to 1. */
  probability: number;
  /** Per-period Sharpe the best of `trials` unskilled variants would be expected to show. */
  benchmarkSharpe: number;
}

export function deflatedSharpe(input: DeflatedSharpeInput): DeflatedSharpe {
  const { sharpe, observations, skew, kurtosis, trials, trialSharpeVariance } = input;
  const benchmarkSharpe = expectedMaxSharpe(trials, trialSharpeVariance);
  const radicand = 1 - skew * sharpe + ((kurtosis - 1) / 4) * sharpe * sharpe;
  const z = ((sharpe - benchmarkSharpe) * Math.sqrt(Math.max(observations - 1, 0))) / Math.sqrt(Math.max(radicand, 1e-12));
  return { probability: Math.min(1, Math.max(0, normCdf(z))), benchmarkSharpe };
}

/** Mean excess return over its standard deviation, per period; null when returns do not vary. */
export function periodSharpe(returns: ArrayLike<number>, riskFreePerPeriod: number): number | null {
  const n = returns.length;
  if (n < 2) return null;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += returns[i];
  const m = sum / n;
  let ss = 0;
  for (let i = 0; i < n; i++) ss += (returns[i] - m) ** 2;
  const sd = Math.sqrt(ss / (n - 1));
  return sd > 1e-15 ? (m - riskFreePerPeriod) / sd : null;
}

/** Skew and raw kurtosis of a return series. */
export function returnMoments(returns: ArrayLike<number>): { skew: number; kurtosis: number } {
  const n = returns.length;
  if (n < 3) return { skew: 0, kurtosis: 3 };
  let sum = 0;
  for (let i = 0; i < n; i++) sum += returns[i];
  const m = sum / n;
  let m2 = 0;
  let m3 = 0;
  let m4 = 0;
  for (let i = 0; i < n; i++) {
    const d = returns[i] - m;
    m2 += d * d;
    m3 += d ** 3;
    m4 += d ** 4;
  }
  m2 /= n;
  m3 /= n;
  m4 /= n;
  return m2 > 0 ? { skew: m3 / m2 ** 1.5, kurtosis: m4 / (m2 * m2) } : { skew: 0, kurtosis: 3 };
}

/** Sample variance of the finite values. */
export function sampleVariance(values: (number | null)[]): number {
  const xs = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
}
