/**
 * Unified WeChat Mini Program Canvas 2D Adapter (`<canvas type="2d">`).
 *
 * Replaces all legacy `wx.createCanvasContext(canvasId, scope)` calls and
 * `shareCanvasContext.ts` with a high-DPI (`pixelRatio`) `<canvas type="2d">`
 * rendering pipeline.
 *
 * Features:
 * - Queries `<canvas type="2d" id="...">` via `SelectorQuery.fields({ node: true, size: true })`
 * - Automatically configures physical resolution (`node.width = width * dpr`, `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`)
 * - Caches resolved 2D nodes per page/component scope so subsequent redraws (e.g. touch pan/zoom, tab switch) execute synchronously
 * - Supports both standard HTML5 Canvas 2D property assignments (`ctx.fillStyle = ...`) and legacy WeChat methods (`ctx.setFillStyle(...)`, `ctx.draw(reserve, cb)`)
 * - Automatically preloads string image paths via `canvas.createImage()` when `drawImage('/images/...', ...)` is used
 */

export interface Canvas2DCacheEntry {
  node: any;
  ctx: any;
  width: number;
  height: number;
  dpr: number;
  images: Map<string, any>;
}

interface DeferredGradientStop {
  offset: number;
  color: string;
}

interface DeferredGradient {
  __isDeferredGradient: true;
  kind: 'linear' | 'radial';
  args: number[];
  stops: DeferredGradientStop[];
  addColorStop(offset: number | string, color: string): void;
}

type RecordedCommand =
  | { type: 'set'; prop: string; value: any }
  | { type: 'call'; method: string; args: any[] };

const LEGACY_SETTER_MAP: Record<string, string> = {
  setFillStyle: 'fillStyle',
  setStrokeStyle: 'strokeStyle',
  setLineWidth: 'lineWidth',
  setGlobalAlpha: 'globalAlpha',
  setTextAlign: 'textAlign',
  setTextBaseline: 'textBaseline',
  setLineCap: 'lineCap',
  setLineJoin: 'lineJoin',
  setMiterLimit: 'miterLimit',
};

const fallbackScopeRegistry = new Map<string, Canvas2DCacheEntry>();

function getScopeRegistry(scope: any): Map<string, Canvas2DCacheEntry> {
  if (!scope || typeof scope !== 'object') {
    return fallbackScopeRegistry;
  }
  if (!scope.__canvas2dRegistry) {
    Object.defineProperty(scope, '__canvas2dRegistry', {
      value: new Map<string, Canvas2DCacheEntry>(),
      enumerable: false,
      configurable: true,
      writable: true,
    });
  }
  return scope.__canvas2dRegistry;
}

function getDevicePixelRatio(): number {
  try {
    if (typeof wx !== 'undefined' && typeof wx.getWindowInfo === 'function') {
      const info = wx.getWindowInfo();
      if (info && Number.isFinite(info.pixelRatio) && info.pixelRatio > 0) {
        return info.pixelRatio;
      }
    }
  } catch (_e) {
    // Fallback to 2x Retina
  }
  return 2;
}

function normalizeFontString(fontValue: string): string {
  const str = String(fontValue || '');
  const match = str.match(/([\d.]+)px/);
  if (!match) {
    return str || 'normal 12px sans-serif';
  }
  const weight = /\bbold\b|\b[6-9]00\b/i.test(str) ? 'bold' : 'normal';
  return `${weight} ${Number(match[1])}px sans-serif`;
}

function normalizeTextBaseline(value: string): string {
  if (value === 'normal') {
    return 'alphabetic';
  }
  return value;
}

function materializeGradient(targetCtx: any, value: any): any {
  if (!value || typeof value !== 'object' || !value.__isDeferredGradient) {
    return value;
  }
  const def = value as DeferredGradient;
  let grad: any;
  if (def.kind === 'linear' && typeof targetCtx.createLinearGradient === 'function') {
    const [x0, y0, x1, y1] = def.args;
    grad = targetCtx.createLinearGradient(x0, y0, x1, y1);
  } else if (def.kind === 'radial' && typeof targetCtx.createRadialGradient === 'function') {
    const [x0, y0, r0, x1, y1, r1] = def.args;
    grad = targetCtx.createRadialGradient(x0, y0, r0, x1, y1, r1);
  }
  if (grad && typeof grad.addColorStop === 'function') {
    for (const stop of def.stops) {
      grad.addColorStop(Number(stop.offset), stop.color);
    }
    return grad;
  }
  return def.stops.length > 0 ? def.stops[def.stops.length - 1].color : '#000000';
}

function createDeferredGradient(kind: 'linear' | 'radial', args: number[]): DeferredGradient {
  const stops: DeferredGradientStop[] = [];
  return {
    __isDeferredGradient: true,
    kind,
    args,
    stops,
    addColorStop(offset: number | string, color: string) {
      stops.push({ offset: Number(offset), color });
    },
  };
}

function configureCanvasEntry(
  node: any,
  rawWidth: number,
  rawHeight: number,
  existingImages?: Map<string, any>
): Canvas2DCacheEntry | null {
  if (!node || typeof node.getContext !== 'function') {
    return null;
  }
  const ctx = node.getContext('2d');
  if (!ctx) {
    return null;
  }
  const dpr = getDevicePixelRatio();
  const cssWidth = rawWidth > 0 ? rawWidth : (node.width > 0 ? node.width / dpr : 300);
  const cssHeight = rawHeight > 0 ? rawHeight : (node.height > 0 ? node.height / dpr : 150);
  const targetPhysW = Math.max(1, Math.round(cssWidth * dpr));
  const targetPhysH = Math.max(1, Math.round(cssHeight * dpr));

  if (node.width !== targetPhysW || node.height !== targetPhysH) {
    node.width = targetPhysW;
    node.height = targetPhysH;
  }
  if (typeof ctx.setTransform === 'function') {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  } else if (typeof ctx.scale === 'function') {
    ctx.scale(dpr, dpr);
  }

  return {
    node,
    ctx,
    width: cssWidth,
    height: cssHeight,
    dpr,
    images: existingImages || new Map<string, any>(),
  };
}

function resolveCanvas2DEntry(
  cleanId: string,
  scope: any,
  fallbackSize?: { width?: number; height?: number }
): Promise<Canvas2DCacheEntry | null> {
  const registry = getScopeRegistry(scope);
  const cached = registry.get(cleanId);
  if (cached && cached.node && cached.ctx && cached.width > 0 && cached.height > 0) {
    if (
      fallbackSize &&
      fallbackSize.width &&
      fallbackSize.height &&
      (Math.abs(cached.width - fallbackSize.width) > 1 ||
        Math.abs(cached.height - fallbackSize.height) > 1)
    ) {
      const updated = configureCanvasEntry(
        cached.node,
        fallbackSize.width,
        fallbackSize.height,
        cached.images
      );
      if (updated) {
        registry.set(cleanId, updated);
        return Promise.resolve(updated);
      }
    }
    return Promise.resolve(cached);
  }

  return new Promise((resolve) => {
    if (typeof wx === 'undefined' || typeof wx.createSelectorQuery !== 'function') {
      resolve(null);
      return;
    }

    const selector =
      cleanId.startsWith('#') || cleanId.startsWith('.') ? cleanId : `#${cleanId}`;

    const tryQuery = (useScope: boolean) => {
      try {
        const baseQuery = wx.createSelectorQuery();
        const query = useScope && scope ? baseQuery.in(scope) : baseQuery;
        query
          .select(selector)
          .fields({ node: true, size: true } as any)
          .exec((res: any) => {
            const hit = Array.isArray(res) ? res[0] : res;
            if (hit && hit.node) {
              const w = hit.width || fallbackSize?.width || 300;
              const h = hit.height || fallbackSize?.height || 150;
              const entry = configureCanvasEntry(hit.node, w, h, cached?.images);
              if (entry) {
                registry.set(cleanId, entry);
                resolve(entry);
                return;
              }
            }
            if (useScope && scope) {
              // Fallback without `.in(scope)` in case `scope` is a Page or nested ref
              tryQuery(false);
            } else {
              resolve(null);
            }
          });
      } catch (_err) {
        resolve(null);
      }
    };

    tryQuery(Boolean(scope));
  });
}

async function ensureImagesLoaded(
  entry: Canvas2DCacheEntry,
  commands: RecordedCommand[]
): Promise<void> {
  if (!entry.node || typeof entry.node.createImage !== 'function') {
    return;
  }
  const missingSources = new Set<string>();
  for (const cmd of commands) {
    if (cmd.type === 'call' && cmd.method === 'drawImage') {
      const src = cmd.args[0];
      if (typeof src === 'string' && src && !entry.images.has(src)) {
        missingSources.add(src);
      }
    }
  }
  if (missingSources.size === 0) {
    return;
  }
  await Promise.all(
    Array.from(missingSources, (src) =>
      new Promise<void>((resolve) => {
        try {
          const img = entry.node.createImage();
          img.onload = () => {
            entry.images.set(src, img);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = src;
        } catch (_e) {
          resolve();
        }
      })
    )
  );
}

function replayCommandsOnEntry(
  entry: Canvas2DCacheEntry,
  commands: RecordedCommand[],
  reserve?: boolean
): void {
  const target = entry.ctx;
  if (!target) return;

  if (typeof target.setTransform === 'function') {
    target.setTransform(entry.dpr, 0, 0, entry.dpr, 0, 0);
  }
  if (!reserve && typeof target.clearRect === 'function') {
    target.clearRect(0, 0, entry.width + 2, entry.height + 2);
  }

  for (const cmd of commands) {
    if (cmd.type === 'set') {
      if (cmd.prop === 'font') {
        target.font = normalizeFontString(cmd.value);
      } else if (cmd.prop === 'textBaseline') {
        target.textBaseline = normalizeTextBaseline(cmd.value);
      } else if (cmd.prop === 'fillStyle' || cmd.prop === 'strokeStyle') {
        target[cmd.prop] = materializeGradient(target, cmd.value);
      } else {
        target[cmd.prop] = cmd.value;
      }
    } else if (cmd.type === 'call') {
      if (cmd.method === 'drawImage') {
        const [source, ...rest] = cmd.args;
        const img = typeof source === 'string' ? entry.images.get(source) : source;
        if (img && typeof target.drawImage === 'function') {
          target.drawImage(img, ...rest);
        }
      } else if (typeof target[cmd.method] === 'function') {
        target[cmd.method](...cmd.args);
      }
    }
  }
}

/**
 * Creates a Canvas 2D context compatible with both standard CanvasRenderingContext2D
 * and WeChat legacy drawing helper conventions (`setFillStyle`, `draw(reserve, cb)`, etc.).
 */
export function createCanvas2DContext(
  canvasId: string,
  scope?: any,
  fallbackSize?: { width?: number; height?: number }
): any {
  const cleanId = String(canvasId || '').replace(/^#/, '');
  const registry = getScopeRegistry(scope);
  let commands: RecordedCommand[] = [];
  let currentFontSize = 12;
  let currentFont = 'normal 12px sans-serif';

  const recordSet = (prop: string, value: any) => {
    if (prop === 'font') {
      currentFont = normalizeFontString(value);
      const m = currentFont.match(/([\d.]+)px/);
      if (m) currentFontSize = Number(m[1]);
    }
    commands.push({ type: 'set', prop, value });
  };

  const recordCall = (method: string, args: any[]) => {
    commands.push({ type: 'call', method, args });
  };

  const baseTarget: Record<string, any> = {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    globalAlpha: 1,
    textAlign: 'left',
    textBaseline: 'alphabetic',
    lineCap: 'butt',
    lineJoin: 'miter',
    miterLimit: 10,
    font: currentFont,
  };

  return new Proxy(baseTarget, {
    get(target, property: string) {
      if (property in LEGACY_SETTER_MAP) {
        const mappedProp = LEGACY_SETTER_MAP[property];
        return (value: any) => {
          target[mappedProp] = value;
          recordSet(mappedProp, value);
        };
      }
      if (property === 'setFontSize') {
        return (size: number) => {
          currentFontSize = Number(size) || 12;
          const weight = /\bbold\b/i.test(currentFont) ? 'bold' : 'normal';
          currentFont = `${weight} ${currentFontSize}px sans-serif`;
          target.font = currentFont;
          recordSet('font', currentFont);
        };
      }
      if (property === 'setShadow') {
        return (offsetX = 0, offsetY = 0, blur = 0, color = 'rgba(0,0,0,0)') => {
          recordSet('shadowOffsetX', offsetX);
          recordSet('shadowOffsetY', offsetY);
          recordSet('shadowBlur', blur);
          recordSet('shadowColor', color);
        };
      }
      if (property === 'setLineDash') {
        return (pattern: number[] = [], offset = 0) => {
          recordCall('setLineDash', [pattern]);
          recordSet('lineDashOffset', offset);
        };
      }
      if (property === 'createLinearGradient') {
        return (x0: number, y0: number, x1: number, y1: number) =>
          createDeferredGradient('linear', [x0, y0, x1, y1]);
      }
      if (property === 'createCircularGradient') {
        return (x: number, y: number, r: number) =>
          createDeferredGradient('radial', [x, y, 0, x, y, r]);
      }
      if (property === 'createRadialGradient') {
        return (x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) =>
          createDeferredGradient('radial', [x0, y0, r0, x1, y1, r1]);
      }
      if (property === 'measureText') {
        return (text: string) => {
          const str = String(text ?? '');
          const cached = registry.get(cleanId);
          if (cached && cached.ctx && typeof cached.ctx.measureText === 'function') {
            cached.ctx.font = currentFont;
            return cached.ctx.measureText(str);
          }
          let width = 0;
          for (let i = 0; i < str.length; i++) {
            width += str.charCodeAt(i) > 255 ? currentFontSize : currentFontSize * 0.56;
          }
          return { width };
        };
      }
      if (property === 'draw') {
        return (reserve?: boolean | (() => void), callback?: () => void) => {
          const isReserve = typeof reserve === 'boolean' ? reserve : false;
          const cb = typeof reserve === 'function' ? reserve : callback;
          const batch = commands;
          commands = [];

          const cached = registry.get(cleanId);
          const hasStringImages = batch.some(
            (c) => c.type === 'call' && c.method === 'drawImage' && typeof c.args[0] === 'string'
          );

          // Fast synchronous path when Canvas 2D node is already cached and no uncached string images exist
          if (
            cached &&
            cached.node &&
            cached.ctx &&
            cached.width > 0 &&
            cached.height > 0 &&
            !hasStringImages
          ) {
            replayCommandsOnEntry(cached, batch, isReserve);
            if (typeof cb === 'function') cb();
            return;
          }

          resolveCanvas2DEntry(cleanId, scope, fallbackSize).then(async (entry) => {
            if (entry) {
              if (hasStringImages) {
                await ensureImagesLoaded(entry, batch);
              }
              replayCommandsOnEntry(entry, batch, isReserve);
            }
            if (typeof cb === 'function') cb();
          });
        };
      }

      if (property in target) {
        return target[property];
      }

      // Standard Canvas 2D drawing methods (beginPath, moveTo, lineTo, arc, fill, stroke, etc.)
      return (...args: any[]) => {
        recordCall(property, args);
      };
    },
    set(target, property: string, value: any) {
      target[property] = value;
      recordSet(property, value);
      return true;
    },
  });
}

/**
 * Wraps an already-resolved native Canvas 2D context (e.g. offscreen/poster share canvas)
 * with legacy method compatibility and preloaded image lookup.
 */
export function createShareCanvasContext(
  context: any,
  images: Map<string, any> = new Map()
): any {
  return new Proxy(context, {
    get(target, property: string) {
      if (property === 'hasImage') {
        return (source: string) => images.has(source);
      }
      if (LEGACY_SETTER_MAP[property]) {
        return (value: any) => {
          const prop = LEGACY_SETTER_MAP[property];
          target[prop] = prop === 'textBaseline' ? normalizeTextBaseline(value) : value;
        };
      }
      if (property === 'setFontSize') {
        return (size: number) => {
          target.font = `normal ${size}px sans-serif`;
        };
      }
      if (property === 'drawImage') {
        return (source: any, ...args: any[]) => {
          const image = typeof source === 'string' ? images.get(source) : source;
          if (!image) throw new Error('Report image not loaded: ' + source);
          target.drawImage(image, ...args);
        };
      }
      if (property === 'draw') {
        return (reserve?: boolean | (() => void), cb?: () => void) => {
          const fn = typeof reserve === 'function' ? reserve : cb;
          if (typeof fn === 'function') fn();
        };
      }
      const value = target[property];
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set(target, property: string, value: any) {
      if (property === 'font') {
        target.font = normalizeFontString(value);
      } else if (property === 'textBaseline') {
        target.textBaseline = normalizeTextBaseline(value);
      } else {
        target[property] = value;
      }
      return true;
    },
  });
}

/**
 * Preloads report poster images using `canvas.createImage()` on a Canvas 2D node.
 */
export async function loadReportImages(canvas: any, report: any): Promise<Map<string, any>> {
  const paths = new Set<string>();
  for (const section of report?.sections || []) {
    if (section.groups && section.groups.length) paths.add('/images/icon_body_gray.png');
    if (section.type === 'cid') {
      const key = String(section.symbol || '').trim().toLowerCase();
      if (['c', 'd', 'p'].includes(key)) paths.add('/images/ic_cidp_' + key + '.png');
    }
    for (const row of section.rows || []) {
      if (row.type === 'coordinate') {
        const female = String(row.sex).toUpperCase() !== 'M';
        paths.add(
          female ? '/images/item_body_component_f.png' : '/images/item_body_component_m.png'
        );
      }
    }
  }
  const images = new Map<string, any>();
  await Promise.all(
    Array.from(paths, (path) =>
      new Promise<void>((resolve, reject) => {
        const image = canvas.createImage();
        image.onload = () => {
          images.set(path, image);
          resolve();
        };
        image.onerror = () => reject(new Error('Cannot load report image: ' + path));
        image.src = path;
      })
    )
  );
  return images;
}

module.exports = {
  createCanvas2DContext,
  createShareCanvasContext,
  loadReportImages,
};
