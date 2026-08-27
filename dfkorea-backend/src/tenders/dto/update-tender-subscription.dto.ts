import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  Matches,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";

const DELIVERY_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

@ValidatorConstraint({ name: "recipientsRequiredWhenEnabled", async: false })
class RecipientsRequiredWhenEnabledConstraint implements ValidatorConstraintInterface {
  validate(recipients: unknown, arguments_: ValidationArguments): boolean {
    const subscription = arguments_.object as UpdateTenderSubscriptionDto;
    return (
      !subscription.enabled ||
      (Array.isArray(recipients) && recipients.length > 0)
    );
  }

  defaultMessage(): string {
    return "recipients must contain at least one address while delivery is enabled";
  }
}

export class UpdateTenderSubscriptionDto {
  @IsBoolean()
  enabled: boolean;

  @Matches(DELIVERY_TIME_PATTERN)
  deliveryTime: string;

  // Normalize before validation so the API rejects duplicates that differ only
  // by case or surrounding whitespace and persists one canonical address form.
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((email) =>
          typeof email === "string" ? email.trim().toLowerCase() : email,
        )
      : value,
  )
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique((email: unknown) =>
    typeof email === "string" ? email.trim().toLowerCase() : email,
  )
  @IsEmail({}, { each: true })
  @Validate(RecipientsRequiredWhenEnabledConstraint)
  recipients: string[];
}
