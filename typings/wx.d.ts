interface WxComponentInstance {
  data: Record<string, any>;
  properties: Record<string, any>;
  setData(data: Record<string, any>, callback?: () => void): void;
  triggerEvent(name: string, detail?: any, options?: any): void;
  createSelectorQuery(): any;
  selectComponent(selector: string): any;
  [key: string]: any;
}

interface WxComponentOptions {
  properties?: Record<string, any>;
  data?: Record<string, any>;
  lifetimes?: Record<string, (this: WxComponentInstance, ...args: any[]) => any>;
  pageLifetimes?: Record<string, (this: WxComponentInstance, ...args: any[]) => any>;
  methods?: Record<string, (this: WxComponentInstance, ...args: any[]) => any>;
  observers?: Record<string, (this: WxComponentInstance, ...args: any[]) => any>;
  [key: string]: any;
}

declare function App(options: Record<string, any>): void;
/** Function members get contextual `any` parameters (e, options, res...) instead of implicit-any errors. */
type WxPageHandler = (this: WxComponentInstance, ...args: any[]) => any;
interface WxPageOptions {
  data?: Record<string, any>;
  [key: string]: WxPageHandler | Record<string, any> | any[] | string | number | boolean | null | undefined;
}
declare function Page(options: WxPageOptions & ThisType<WxComponentInstance>): void;
declare function Component(options: WxComponentOptions & ThisType<WxComponentInstance>): void;
declare const wx: any;
declare const getApp: <T = any>() => T;
declare const getCurrentPages: () => any[];
declare const requirePlugin: (name: string) => any;
declare function require(path: string): any;
declare const module: { exports: any };
declare const process: { env: Record<string, string | undefined>; [key: string]: any };
declare function setImmediate(callback: (...args: any[]) => void, ...args: any[]): any;
