// Tiny typed pub/sub used to let stores announce things (sync errors and similar)
// without importing any UI. The UI layer subscribes and decides how to show them.
type Listener<T> = (event: T) => void;

export function createBus<T>() {
  const listeners = new Set<Listener<T>>();
  return {
    emit(event: T) {
      listeners.forEach((l) => l(event));
    },
    subscribe(listener: Listener<T>) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
