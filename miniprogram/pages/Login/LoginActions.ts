import { getContainer } from '../../src/application/AppContainer';

/** Both phone entry points navigate only after a successful, current login. */
export async function loginAndNavigate(telHP: string, openId = ''): Promise<void> {
  try {
    const result = await getContainer().authService.loginWithPhone(telHP, openId);
    wx.redirectTo({ url: result.targetRoute });
  } catch (error) {
    wx.showToast({
      title: error instanceof Error ? error.message : '登录失败，请重试',
      icon: 'none',
    });
  }
}
