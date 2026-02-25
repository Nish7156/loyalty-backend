import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

export const DEFAULT_COUNTRY_CODE = '+91';

export function normalizeIndianPhone(value: unknown): string {
  if (value === undefined || value === null) return '';
  const s = String(value).trim();
  if (!s) return s;
  const digits = s.replace(/\D/g, '');
  if (digits.length === 10) return DEFAULT_COUNTRY_CODE + digits;
  if (digits.length === 12 && digits.startsWith('91')) return '+' + digits;
  if (s.startsWith('+91')) return s;
  return s;
}

export function IndianPhoneTransform({ value }: { value: unknown }) {
  if (value === undefined || value === null) return value;
  return normalizeIndianPhone(value);
}

@ValidatorConstraint({ name: 'IsIndianPhone', async: false })
export class IndianPhoneConstraint implements ValidatorConstraintInterface {
  validate(value: string): boolean {
    if (value === undefined || value === null) return true;
    if (typeof value !== 'string' || !value.trim()) return false;
    const phone = parsePhoneNumberFromString(value);
    return !!(phone && phone.isValid() && phone.country === 'IN');
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a valid Indian phone number`;
  }
}

export function IsIndianPhone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IndianPhoneConstraint,
    });
  };
}
