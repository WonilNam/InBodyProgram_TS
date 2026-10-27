import * as sdk from '../../index';
import { InBodyDeviceService } from '../application/services/InBodyDeviceService';
import { ParsedDataBroadcaster } from '../infrastructure/engine/ParsedDataBroadcaster';
import { InBodyError, InBodyErrorCode } from '../domain/value-objects/InBodyError';

function getBroadcaster(): ParsedDataBroadcaster {
  let broadcaster: ParsedDataBroadcaster | undefined;
  const original = InBodyDeviceService.prototype.subscribe;
  const spy = jest.spyOn(InBodyDeviceService.prototype, 'subscribe').mockImplementation(function (this: InBodyDeviceService, handlers) {
    broadcaster = (this as unknown as { broadcaster: ParsedDataBroadcaster }).broadcaster;
    return original.call(this, handlers);
  });
  sdk.subscribe({});
  spy.mockRestore();
  return broadcaster!;
}

describe('Public hardware facade contracts', () => {
  it('preserves Error identity, message and code for onError', () => {
    sdk.init('H30');
    const broadcaster = getBroadcaster();
    const onError = jest.fn();
    const unsubscribe = sdk.subscribe({ onError });
    const error = new InBodyError(InBodyErrorCode.TIMEOUT, 'device timed out');
    broadcaster._onInternalError(error);
    expect(onError).toHaveBeenCalledWith(error);
    expect(onError.mock.calls[0][0].message).toBe('device timed out');
    expect(onError.mock.calls[0][0].code).toBe(InBodyErrorCode.TIMEOUT);
    unsubscribe();
  });

  it('exposes a cleaned completion payload through the public onCompleted event', () => {
    sdk.init('H30');
    const broadcaster = getBroadcaster();
    const onCompleted = jest.fn();
    const unsubscribe = sdk.subscribe({ onCompleted });
    broadcaster._onInternalCompleted({ deviceId: 'device-A', cmd: 'HR', isCompleted: true, weight: 60 } as never);
    expect(onCompleted).toHaveBeenCalledWith({ weight: 60 });
    unsubscribe();
  });

  it('isolates old asynchronous broadcasters when a new device session is initialized', () => {
    sdk.init('H30');
    const old = getBroadcaster();
    sdk.init('H40');
    const current = getBroadcaster();
    const onCompleted = jest.fn();
    const onError = jest.fn();
    const unsubscribe = sdk.subscribe({ onCompleted, onError });
    expect(old).not.toBe(current);
    old._onInternalCompleted({ weight: 60 } as never);
    old._onInternalError(new Error('late error'));
    expect(onCompleted).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    current._onInternalCompleted({ weight: 61 } as never);
    expect(onCompleted).toHaveBeenCalledWith({ weight: 61 });
    unsubscribe();
  });
});
