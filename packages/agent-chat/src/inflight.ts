export type InflightGate<T> = {
  /** Join the request already running, or start one. */
  share: (run: () => Promise<T>) => Promise<T>;
  /** After the current request settles, start another. Overlapping fresh calls share that later request. */
  fresh: (run: () => Promise<T>) => Promise<T>;
};

/** Collapse overlapping calls into one promise. A later call starts a new run. */
export function createInflightGate<T>(): InflightGate<T> {
  let current: Promise<T> | null = null;
  const share = (run: () => Promise<T>) => {
    if (!current) {
      const pending = run().finally(() => {
        if (current === pending) current = null;
      });
      current = pending;
    }
    return current;
  };
  const fresh = async (run: () => Promise<T>) => {
    const pending = current;
    if (pending) await pending.catch(() => {});
    return share(run);
  };
  return { share, fresh };
}
