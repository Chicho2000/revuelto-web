export type DeviceNavigator = {
  userAgent?: string;
  userAgentData?: { mobile?: boolean };
};

export function isMobileDevice(navigatorLike: DeviceNavigator) {
  if (typeof navigatorLike.userAgentData?.mobile === "boolean") {
    return navigatorLike.userAgentData.mobile;
  }

  return /Android|iPhone|iPad|iPod/i.test(navigatorLike.userAgent ?? "");
}
