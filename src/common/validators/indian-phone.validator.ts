import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

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
