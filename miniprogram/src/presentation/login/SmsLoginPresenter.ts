import { AuthAppService } from '../../application/services/AuthAppService';

export const SMS_INITIAL_STATE = {
  txtTelHP: '', txtCode: '', btnDisabled: true, btnSendDisabled: false, btnSendLoading: false,
  btnAuthDisabled: true, btnCancelDisabled: true, inputClassTelHP: 'on', inputClassCode: '',
  btnSendText: '发送验证码', isFalseTelHP: 'display:none', isSend: false, resendTime: 60,
};
export type SmsState = typeof SMS_INITIAL_STATE;

/** Retains the original server-returned-code flow; does not expose the code in page data. */
export class SmsLoginPresenter {
  private code = '';
  private timer?: ReturnType<typeof setInterval>;
  private version = 0;
  private disposed = false;
  private state: SmsState = { ...SMS_INITIAL_STATE };
  constructor(private readonly auth: Pick<AuthAppService,'sendSmsAuthCode'>, private readonly render: (state: SmsState) => void) {}
  async send(phone: string): Promise<void> {
    if (this.state.btnSendDisabled) return;
    if (!/^\d{11}$/.test(phone)) { this.patch({ isFalseTelHP: 'display:block' }); return; }
    const version = ++this.version;
    this.patch({ btnSendDisabled: true, btnSendLoading: true, txtTelHP: phone, isFalseTelHP: 'display:none' });
    try {
      const code = await this.auth.sendSmsAuthCode(phone);
      if (this.disposed || version !== this.version) return;
      if (!code) throw new Error('验证码发送失败，请重试');
      this.code = code;
      this.patch({ btnSendLoading: false, isSend: true, btnCancelDisabled: false, resendTime: 60,
        inputClassTelHP: '', inputClassCode: 'on', btnSendText: '重新发送(60秒)' });
      this.timer = setInterval(() => {
        const seconds = this.state.resendTime - 1;
        if (seconds <= 0) {
          this.stopTimer();
          this.patch({ btnSendDisabled: false, isSend: false, resendTime: 60, btnSendText: '发送验证码' });
        } else this.patch({ resendTime: seconds, btnSendText: `重新发送(${seconds}秒)` });
      },1000);
    } catch (error) { this.cancel(); throw error; }
  }
  inputCode(value: string): void { this.patch({ txtCode: value, btnDisabled: value.length !== 6 }); }
  validate(phone: string, code: string): void {
    if (!this.state.isSend || phone !== this.state.txtTelHP) throw new Error('请先获取当前手机号的验证码');
    if (code !== this.code) { this.inputCode(''); throw new Error('验证码不正确！'); }
  }
  hideValidation(): void { this.patch({ isFalseTelHP: 'display:none' }); }
  cancel(): void {
    this.version++;
    this.stopTimer(); this.code = '';
    this.state = { ...SMS_INITIAL_STATE };
    if (!this.disposed) this.render(this.state);
  }
  dispose(): void { this.disposed = true; this.version++; this.stopTimer(); this.code = ''; }
  private stopTimer(): void { if (this.timer) clearInterval(this.timer); this.timer = undefined; }
  private patch(patch: Partial<SmsState>): void {
    this.state = { ...this.state, ...patch };
    if (!this.disposed) this.render(this.state);
  }
}
