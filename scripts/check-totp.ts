// RFC 6238 test vectors (SHA-1). Run: npx tsx --conditions=react-server scripts/check-totp.ts
import { verifyTotp } from "../src/lib/totp";

const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"; // ASCII "12345678901234567890"
const cases: [number, string][] = [
  [59, "287082"],
  [1111111109, "081804"],
  [1234567890, "005924"],
  [2000000000, "279037"],
];
let failed = 0;
for (const [t, code] of cases) {
  const ok = verifyTotp(secret, code, t * 1000);
  if (!ok) failed++;
  console.log(t, code, ok ? "ok" : "FAIL");
}
console.log(verifyTotp(secret, "000000", 59_000) ? "FAIL: accepted wrong code" : "rejects wrong code: ok");
process.exit(failed ? 1 : 0);
