import * as OTPAuth from "otpauth";

export function createTotp(email: string, secret?: string) {
  return new OTPAuth.TOTP({
    issuer: "Pramana CX",
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: secret ? OTPAuth.Secret.fromBase32(secret) : new OTPAuth.Secret({ size: 20 })
  });
}

export function verifyTotp(email: string, secret: string, token: string) {
  if (!/^\d{6}$/.test(token)) return false;
  return createTotp(email, secret).validate({ token, window: 1 }) !== null;
}
