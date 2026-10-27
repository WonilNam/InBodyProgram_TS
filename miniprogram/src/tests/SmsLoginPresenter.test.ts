import { SmsLoginPresenter, SmsState } from '../presentation/login/SmsLoginPresenter';

function deferred<T>() {
  let resolve!: (value:T)=>void;
  const promise = new Promise<T>(res=>{resolve=res;});
  return { promise, resolve };
}
describe('SMS login presenter lifecycle',()=>{
  afterEach(()=>jest.useRealTimers());
  it('keeps the code private, validates its phone and stops the countdown at expiry',async()=>{
    jest.useFakeTimers();
    const send = jest.fn().mockResolvedValue('123456');
    const render = jest.fn<void,[SmsState]>();
    const presenter = new SmsLoginPresenter({sendSmsAuthCode:send},render);
    await presenter.send('13800000000');
    expect(JSON.stringify(render.mock.calls)).not.toContain('123456');
    expect(()=>presenter.validate('13900000000','123456')).toThrow('当前手机号');
    expect(()=>presenter.validate('13800000000','999999')).toThrow('验证码不正确');
    expect(()=>presenter.validate('13800000000','123456')).not.toThrow();
    jest.advanceTimersByTime(60000);
    expect(render.mock.calls.slice(-1)[0][0]).toMatchObject({ isSend:false, btnSendDisabled:false });
    expect(()=>presenter.validate('13800000000','123456')).toThrow();
    presenter.dispose();
    expect(jest.getTimerCount()).toBe(0);
  });
  it('does not update the page or start a timer when a request returns after disposal',async()=>{
    jest.useFakeTimers();
    const request = deferred<string>();
    const render=jest.fn();
    const presenter=new SmsLoginPresenter({sendSmsAuthCode:()=>request.promise},render);
    const pending=presenter.send('13800000000');
    presenter.dispose();const count=render.mock.calls.length;
    request.resolve('123456');await pending;
    expect(render).toHaveBeenCalledTimes(count);
    expect(jest.getTimerCount()).toBe(0);
  });
  it('prevents duplicate sends and discards a cancelled request',async()=>{
    jest.useFakeTimers();
    const request=deferred<string>(), send=jest.fn(()=>request.promise), render=jest.fn();
    const presenter=new SmsLoginPresenter({sendSmsAuthCode:send},render);
    const first=presenter.send('13800000000');
    await presenter.send('13800000000');
    expect(send).toHaveBeenCalledTimes(1);
    presenter.cancel();request.resolve('123456');await first;
    expect(render.mock.calls.slice(-1)[0][0]).toMatchObject({isSend:false});
    expect(jest.getTimerCount()).toBe(0);presenter.dispose();
  });
});
