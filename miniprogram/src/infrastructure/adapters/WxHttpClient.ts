import { ApiEnvelope, HttpRequestConfig, IHttpClient } from '../../domain/ports/IHttpClient';
import { inBodyApiUrl, resolveInBodyServerUrl } from '../api/InBodyApi';

export class WxHttpClient implements IHttpClient {
  constructor(private readonly baseUrl: string | (() => string) = resolveInBodyServerUrl) {}

  request<TRes = unknown, TReq = Record<string, unknown>>(
    config: HttpRequestConfig<TReq>
  ): Promise<TRes> {
    const fullUrl = inBodyApiUrl(config.url, typeof this.baseUrl === 'function' ? this.baseUrl() : this.baseUrl);

    return new Promise<TRes>((resolve, reject) => {
      if (typeof wx === 'undefined' || typeof wx.request !== 'function') {
        reject(new Error('wx.request is not available in current environment'));
        return;
      }

      wx.request({
        url: fullUrl,
        method: config.method ?? 'POST',
        data: config.data ?? {},
        responseType: config.responseType ?? 'text',
        timeout: config.timeoutMs ?? 15000,
        success: (res: { statusCode?: number; data: TRes }) => {
          const status = res.statusCode ?? 200;
          if (status >= 200 && status < 300) {
            resolve(res.data);
          } else {
            reject(new Error(`HTTP Error ${status} for ${config.url}`));
          }
        },
        fail: (err: { errMsg?: string }) => {
          reject(new Error(err?.errMsg || `Network request failed: ${config.url}`));
        },
      });
    });
  }

  async postEnvelope<TData = unknown, TReq = Record<string, unknown>>(
    path: string,
    data?: TReq
  ): Promise<TData> {
    let envelope = await this.request<
      ApiEnvelope<TData> & { Success?: boolean; data?: unknown },
      TReq
    >({
      url: path,
      method: 'POST',
      data,
    });
    if (typeof envelope === 'string') {
      try { envelope = JSON.parse(envelope); }
      catch { throw new Error(`Invalid API response on ${path}`); }
    }
    if (
      envelope &&
      (envelope.Data === ('EmptyData' as unknown) || envelope.data === 'EmptyData')
    ) {
      return [] as unknown as TData;
    }
    if (!envelope || (!envelope.IsSuccess && !envelope.Success)) {
      throw new Error(envelope?.ErrorMsg || `API business error on ${path}`);
    }
    return envelope.Data;
  }
}
