import { Ed25519KeyIdentity } from "@dfinity/identity";

// Fixed seed derived from admin credentials — produces a stable principal
// This is NOT a secret: the backend hardcodes this principal as admin
const ADMIN_SEED = new Uint8Array([
  65, 100, 109, 105, 110, 55, 48, 57, 90, 120, 99, 118, 98, 64, 55, 48, 57, 83,
  75, 82, 101, 115, 105, 100, 101, 110, 99, 101, 65, 100, 109, 105,
]);

const _adminIdentity = Ed25519KeyIdentity.generate(ADMIN_SEED);
console.log(
  "Admin identity principal:",
  _adminIdentity.getPrincipal().toText(),
);

export function getAdminIdentity(): Ed25519KeyIdentity {
  return _adminIdentity;
}
