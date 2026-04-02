/**
 * TSP (Traveling Salesman Problem) algorithms for multi-stop trip optimization.
 *
 * Academic context: TSP is a classic NP-Hard combinatorial optimization problem.
 * For practical trip planning (n ≤ 12 cities), we use the Nearest Neighbour
 * heuristic — a greedy O(n²) approximation that typically produces solutions
 * within 20-25% of optimal for Euclidean instances.
 *
 * Reference: Rosenkrantz, D.J., Stearns, R.E., Lewis, P.M. (1977).
 * "An Analysis of Several Heuristics for the Traveling Salesman Problem."
 * SIAM Journal on Computing, 6(3), 563–581.
 */

export interface City {
  name: string;
  lat: number;
  lon: number;
}

/**
 * Haversine formula — computes great-circle distance between two geographic
 * coordinates on a sphere (Earth radius ≈ 6371 km).
 *
 * Time complexity: O(1)
 * Formula: a = sin²(Δφ/2) + cos(φ₁)·cos(φ₂)·sin²(Δλ/2)
 *          d = 2R·atan2(√a, √(1−a))
 */
export function haversine(a: City, b: City): number {
  const R = 6371; // Earth radius in km
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lon - a.lon) * Math.PI) / 180;

  const h =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Builds an n×n symmetric distance matrix using the Haversine formula.
 * Time complexity: O(n²)
 * Space complexity: O(n²)
 */
export function buildDistanceMatrix(cities: City[]): number[][] {
  const n = cities.length;
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = haversine(cities[i], cities[j]);
      matrix[i][j] = d;
      matrix[j][i] = d; // symmetric — Haversine is undirected
    }
  }
  return matrix;
}

/**
 * Computes the total open-path distance for a given ordering of city indices.
 * Open path = does NOT include return to start (one-way travel trip).
 */
export function pathDistance(matrix: number[][], order: number[]): number {
  let total = 0;
  for (let i = 0; i < order.length - 1; i++) {
    total += matrix[order[i]][order[i + 1]];
  }
  return total;
}

/**
 * Nearest Neighbour Heuristic — greedy TSP approximation.
 *
 * Algorithm:
 *   1. Fix cities[0] as the start (the user's origin — never reordered).
 *   2. Greedily pick the nearest unvisited city at each step.
 *   3. Return open path (no return to origin) — suitable for one-way trips.
 *
 * Time complexity:  O(n²)
 * Space complexity: O(n)
 * Approximation:   Typically within 20–25% of optimal (TSP-NN classical bound).
 */
export function nearestNeighbourTSP(cities: City[]): {
  order: City[];
  orderIndices: number[];
  totalKm: number;
} {
  const n = cities.length;

  if (n === 0) return { order: [], orderIndices: [], totalKm: 0 };
  if (n === 1) return { order: [...cities], orderIndices: [0], totalKm: 0 };
  if (n === 2) {
    return {
      order: [...cities],
      orderIndices: [0, 1],
      totalKm: haversine(cities[0], cities[1]),
    };
  }

  const matrix = buildDistanceMatrix(cities);
  const visited = new Set<number>([0]); // origin always first — fixed anchor
  const orderIndices: number[] = [0];

  while (visited.size < n) {
    const last = orderIndices[orderIndices.length - 1];
    let nearest = -1;
    let minDist = Infinity;

    for (let i = 0; i < n; i++) {
      if (visited.has(i)) continue;
      if (matrix[last][i] < minDist) {
        minDist = matrix[last][i];
        nearest = i;
      }
    }

    if (nearest === -1) break; // safety guard
    orderIndices.push(nearest);
    visited.add(nearest);
  }

  const totalKm = pathDistance(matrix, orderIndices);
  return {
    order: orderIndices.map((i) => cities[i]),
    orderIndices,
    totalKm,
  };
}

/**
 * Computes the total km for the user's original (naive) input ordering.
 * Used to calculate how much the TSP optimization saves.
 */
export function naiveOrderKm(cities: City[]): number {
  if (cities.length <= 1) return 0;
  const matrix = buildDistanceMatrix(cities);
  return pathDistance(
    matrix,
    cities.map((_, i) => i),
  );
}
