type InstanceMethod<T> = (this: T, ...args: never[]) => unknown;
interface TypedComponent<T> {
  data: object;
  options?: object;
  properties?: object;
  lifetimes?: Record<string, InstanceMethod<T>>;
  pageLifetimes?: Record<string, InstanceMethod<T>>;
  methods?: Record<string, InstanceMethod<T>>;
}

/** Native registration boundary; page methods retain their concrete instance and event types. */
export function registerComponent<T>(options: TypedComponent<T>): void {
  Component(options as unknown as WxComponentOptions);
}
