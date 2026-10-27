export type StoreListener<TState> = (state: Readonly<TState>) => void;

export class ObservableStore<TState extends object> {
  private state: TState;
  private readonly listeners = new Set<StoreListener<TState>>();

  constructor(initialState: TState) {
    this.state = { ...initialState };
  }

  getState(): Readonly<TState> {
    return this.state;
  }

  setState(patch: Partial<TState> | ((prev: Readonly<TState>) => Partial<TState>)): void {
    const nextPatch = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = { ...this.state, ...nextPatch };
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  subscribe(listener: StoreListener<TState>, immediate = true): () => void {
    this.listeners.add(listener);
    if (immediate) {
      listener(this.state);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }
}
