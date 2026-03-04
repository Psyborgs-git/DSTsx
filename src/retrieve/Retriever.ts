/**
 * Abstract base class for all retrieval backends.
 *
 * Mirrors `dspy.Retrieve`'s underlying retriever protocol in Python.
 */
export abstract class Retriever {
  /**
   * Retrieve the top-`k` passages relevant to `query`.
   *
   * @param query - The search query string.
   * @param k     - Number of passages to return.
   * @returns     An ordered array of passage strings (most relevant first).
   */
  abstract retrieve(query: string, k: number): Promise<string[]>;
}
