export const ACCESS_COOKIE = "hotel_erp_access";
export const REFRESH_COOKIE = "hotel_erp_refresh";

export const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
