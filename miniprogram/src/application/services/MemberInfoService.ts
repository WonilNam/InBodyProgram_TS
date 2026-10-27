export function refreshMemberInfo(
  wxApi: Pick<typeof wx, 'request' | 'setStorageSync'>,
  app: { globalData: Record<string, any> },
  serverUrl: string,
  uid: string | number | null | undefined
): Promise<void> {
  if (!uid) return Promise.resolve();

  return new Promise<void>((resolve) => {
    wxApi.request({
      method: 'POST',
      url: `${serverUrl}/main/GetUserInfo`,
      data: { UID: uid },
      success: (res: any) => {
        if (String(app.globalData.UID) !== String(uid)) return;
        const response = res?.data;
        const member =
          response && response.IsSuccess && Array.isArray(response.Data)
            ? response.Data[0]
            : null;
        if (member) {
          const userInfo = {
            ...(app.globalData.InBodyUserInfo || {}),
            ...member,
          };
          app.globalData.InBodyUserInfo = userInfo;
          wxApi.setStorageSync('InBodyUserInfo', userInfo);
        }
      },
      complete: () => resolve(),
    });
  });
}

module.exports = {
  refreshMemberInfo,
};
