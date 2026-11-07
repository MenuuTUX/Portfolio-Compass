import { describe, expect, it } from "bun:test";
import { shrinkOffDiagonal } from "@/lib/math/covariance";
import { createRandom, getCholeskyDecomposition } from "@/lib/monte-carlo";
import { calculateCovarianceMatrix } from "@/lib/math/stats";

const randomReturns = (seed: number, assets: number, observations: number) => {
  const random = createRandom(seed);
  return Array.from({ length: assets }, () =>
    Array.from({ length: observations }, () => (random() - 0.5) * 0.03),
  );
};

describe("shrinkOffDiagonal", () => {
  it("leaves the matrix unchanged when there are at least 10 observations per asset", () => {
    const matrix = [
      [0.04, 0.01],
      [0.01, 0.09],
    ];
    expect(shrinkOffDiagonal(matrix, 1000)).toEqual(matrix);
  });

  it("keeps the diagonal and scales off-diagonal terms by 1 minus the intensity", () => {
    const assets = 15;
    const observations = 40;
    const matrix = calculateCovarianceMatrix(randomReturns(21, assets, observations));
    const lambda = (10 - observations / assets) / 20;

    const shrunk = shrinkOffDiagonal(matrix, observations);

    for (let i = 0; i < assets; i++) {
      expect(shrunk[i][i]).toBe(matrix[i][i]);
      for (let j = 0; j < assets; j++) {
        if (i !== j) expect(shrunk[i][j]).toBeCloseTo(matrix[i][j] * (1 - lambda), 15);
      }
    }
  });

  it("caps the intensity at one half", () => {
    const matrix = [
      [1, 0.4],
      [0.4, 1],
    ];
    expect(shrinkOffDiagonal(matrix, 0)[0][1]).toBeCloseTo(0.2, 12);
  });

  it("stays symmetric and positive semi-definite for 15 assets on 40 observations", () => {
    const matrix = calculateCovarianceMatrix(randomReturns(33, 15, 40));
    const shrunk = shrinkOffDiagonal(matrix, 40);
    const n = shrunk.length;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) expect(shrunk[i][j]).toBeCloseTo(shrunk[j][i], 15);
    }

    expect(() => getCholeskyDecomposition(shrunk)).not.toThrow();

    const random = createRandom(7);
    for (let trial = 0; trial < 200; trial++) {
      const x = Array.from({ length: n }, () => random() - 0.5);
      let quad = 0;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) quad += x[i] * shrunk[i][j] * x[j];
      expect(quad).toBeGreaterThanOrEqual(-1e-12);
    }
  });
});
