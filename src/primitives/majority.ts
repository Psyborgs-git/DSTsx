import type { Prediction } from "./Prediction.js";

/**
 * Returns a reducer function that picks the Prediction whose `field` value
 * appears most frequently.  Ties go to the first occurrence.
 */
export function majority(field = "answer"): (predictions: Prediction[]) => Prediction {
  return (predictions: Prediction[]): Prediction => {
    if (predictions.length === 0) {
      throw new Error("majority: empty predictions array");
    }

    const counts = new Map<string, number>();
    for (const p of predictions) {
      const val = JSON.stringify(p.get(field));
      counts.set(val, (counts.get(val) ?? 0) + 1);
    }

    let bestKey = "";
    let bestCount = 0;
    for (const [k, c] of counts) {
      if (c > bestCount) {
        bestCount = c;
        bestKey = k;
      }
    }

    return predictions.find((p) => JSON.stringify(p.get(field)) === bestKey)!;
  };
}
