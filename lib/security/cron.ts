import "server-only";
import { timingSafeEqual } from "node:crypto";

export function isValidCronAuthorization(authorization: string | null, secret: string) {
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  const received = Buffer.from(authorization ?? "", "utf8");
  return received.length === expected.length && timingSafeEqual(received, expected);
}
