export interface HttpRequestConfig<TReq = Record<string, unknown>> {
  readonly url: string;
  readonly method?: 'GET' | 'POST';
  readonly data?: TReq;
  readonly responseType?: 'text' | 'arraybuffer';
  readonly timeoutMs?: number;
}

export interface ApiEnvelope<TData = unknown> {
  readonly IsSuccess: boolean;
  readonly Data: TData;
  readonly ErrorMsg?: string;
}

export interface IHttpClient {
  request<TRes = unknown, TReq = Record<string, unknown>>(
    config: HttpRequestConfig<TReq>
  ): Promise<TRes>;

  postEnvelope<TData = unknown, TReq = Record<string, unknown>>(
    path: string,
    data?: TReq
  ): Promise<TData>;
}
