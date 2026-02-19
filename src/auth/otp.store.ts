const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

export type OtpType = 'platform' | 'staff' | 'customer';

export interface OtpRecord {
  code: string;
  expiresAt: Date;
  type: OtpType;
}

const store = new Map<string, OtpRecord>();

export function setOtp(phone: string, code: string, type: OtpType): void {
  store.set(phone, {
    code,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
    type,
  });
}

export function getAndClearOtp(phone: string): OtpRecord | null {
  const record = store.get(phone) ?? null;
  store.delete(phone);
  return record;
}

export function getOtp(phone: string): OtpRecord | null {
  return store.get(phone) ?? null;
}
