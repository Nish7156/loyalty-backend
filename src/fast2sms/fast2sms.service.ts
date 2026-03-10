import { Injectable } from '@nestjs/common';

const FAST2SMS_BASE_URL = 'https://www.fast2sms.com/dev/bulkV2';

export interface SendOtpResult {
  return?: boolean;
  request_id?: string;
  message: string[] | string;
  status_code?: number;
}

@Injectable()
export class Fast2smsService {
  private readonly apiKey: string;

  constructor() {
    this.apiKey = process.env.FAST2SMS_API_KEY || '';
  }

  async sendOtp(numbers: string | string[], otp: string, flash = false): Promise<SendOtpResult> {
    if (!this.apiKey.trim()) {
      throw new Error('Fast2SMS: FAST2SMS_API_KEY is not set in environment');
    }
    const normalizedNumbers = Array.isArray(numbers) ? numbers.join(',') : numbers;
    const response = await fetch(FAST2SMS_BASE_URL, {
      method: 'POST',
      headers: {
        authorization: this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        variables_values: otp,
        route: 'otp',
        numbers: normalizedNumbers,
        flash: flash ? '1' : '0',
      }),
    });
    const data = (await response.json()) as SendOtpResult;
    if (!response.ok) {
      const msg = Array.isArray(data.message) ? data.message.join('; ') : String(data.message ?? response.statusText);
      throw new Error(`Fast2SMS HTTP ${response.status}: ${msg}`);
    }
    const msgStr = Array.isArray(data.message) ? data.message.join('; ') : String(data.message ?? '');
    if (data.status_code != null && data.status_code !== 200) {
      throw new Error(`Fast2SMS: ${msgStr || `status_code ${data.status_code}`}`);
    }
    if (data.return === false) {
      throw new Error(`Fast2SMS: ${msgStr || 'Unknown error'}`);
    }
    return data as SendOtpResult;
  }

  async sendQuickSms(numbers: string | string[], message: string, flash = false): Promise<SendOtpResult> {
    if (!this.apiKey.trim()) {
      throw new Error('Fast2SMS: FAST2SMS_API_KEY is not set in environment');
    }
    const normalizedNumbers = Array.isArray(numbers) ? numbers.join(',') : numbers;
    const response = await fetch(FAST2SMS_BASE_URL, {
      method: 'POST',
      headers: {
        authorization: this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        route: 'q',
        message,
        numbers: normalizedNumbers,
        flash: flash ? '1' : '0',
      }),
    });
    const data = (await response.json()) as SendOtpResult;
    if (!response.ok) {
      const msg = Array.isArray(data.message) ? data.message.join('; ') : String(data.message ?? response.statusText);
      throw new Error(`Fast2SMS HTTP ${response.status}: ${msg}`);
    }
    const msgStr = Array.isArray(data.message) ? data.message.join('; ') : String(data.message ?? '');
    if (data.status_code != null && data.status_code !== 200) {
      throw new Error(`Fast2SMS: ${msgStr || `status_code ${data.status_code}`}`);
    }
    if (data.return === false) {
      throw new Error(`Fast2SMS: ${msgStr || 'Unknown error'}`);
    }
    return data as SendOtpResult;
  }

  async sendOtpViaQuickSms(numbers: string | string[], otp: string, flash = false): Promise<SendOtpResult> {
    return this.sendQuickSms(numbers, `Your OTP: ${otp}`, flash);
  }
}
