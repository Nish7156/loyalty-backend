import { Injectable, Logger } from '@nestjs/common';

const FAST2SMS_BASE_URL = 'https://www.fast2sms.com/dev/bulkV2';

export interface SendOtpResult {
  return?: boolean;
  request_id?: string;
  message: string[] | string;
  status_code?: number;
}

@Injectable()
export class Fast2smsService {
  private readonly logger = new Logger(Fast2smsService.name);
  private readonly apiKey: string;

  constructor() {
    this.apiKey = process.env.FAST2SMS_API_KEY || '';
    if (!this.apiKey.trim()) {
      this.logger.warn('FAST2SMS_API_KEY is not set in environment variables');
    } else {
      this.logger.log(`Fast2SMS initialized with API key: ${this.apiKey.substring(0, 10)}...`);
    }
  }

  async sendOtp(numbers: string | string[], otp: string, flash = false): Promise<SendOtpResult> {
    if (!this.apiKey.trim()) {
      this.logger.error('FAST2SMS_API_KEY is not set in environment');
      throw new Error('Fast2SMS: FAST2SMS_API_KEY is not set in environment');
    }
    const normalizedNumbers = Array.isArray(numbers) ? numbers.join(',') : numbers;

    this.logger.log(`Sending OTP to ${normalizedNumbers}, flash: ${flash}`);

    const requestBody = {
      variables_values: otp,
      route: 'otp',
      numbers: normalizedNumbers,
      flash: flash ? '1' : '0',
    };

    this.logger.debug(`Fast2SMS Request: ${JSON.stringify(requestBody)}`);

    const response = await fetch(FAST2SMS_BASE_URL, {
      method: 'POST',
      headers: {
        authorization: this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = (await response.json()) as SendOtpResult;
    this.logger.debug(`Fast2SMS Response: ${JSON.stringify(data)}`);

    if (!response.ok) {
      const msg = Array.isArray(data.message) ? data.message.join('; ') : String(data.message ?? response.statusText);
      this.logger.error(`Fast2SMS HTTP ${response.status}: ${msg}`);
      throw new Error(`Fast2SMS HTTP ${response.status}: ${msg}`);
    }
    const msgStr = Array.isArray(data.message) ? data.message.join('; ') : String(data.message ?? '');
    if (data.status_code != null && data.status_code !== 200) {
      this.logger.error(`Fast2SMS status_code ${data.status_code}: ${msgStr}`);
      throw new Error(`Fast2SMS: ${msgStr || `status_code ${data.status_code}`}`);
    }
    if (data.return === false) {
      this.logger.error(`Fast2SMS returned false: ${msgStr}`);
      throw new Error(`Fast2SMS: ${msgStr || 'Unknown error'}`);
    }

    this.logger.log(`OTP sent successfully to ${normalizedNumbers}, request_id: ${data.request_id}`);
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
    this.logger.log(`Sending OTP via Quick SMS to ${numbers}`);
    const message = `Your Loyalty Platform OTP is ${otp}. Valid for 5 minutes. Do not share this code. - WebTriggers`;
    return this.sendQuickSms(numbers, message, flash);
  }
}
