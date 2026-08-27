import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { UpdateTenderSubscriptionDto } from "./update-tender-subscription.dto";

describe("UpdateTenderSubscriptionDto", () => {
  it("normalizes email addresses before validating and rejects normalized duplicates", async () => {
    const dto = plainToInstance(UpdateTenderSubscriptionDto, {
      enabled: true,
      deliveryTime: "09:00",
      recipients: [" Sales@DFKorea.co.kr ", "sales@dfkorea.co.kr"],
    });

    await expect(validate(dto)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: "recipients" }),
      ]),
    );
    expect(dto.recipients).toEqual([
      "sales@dfkorea.co.kr",
      "sales@dfkorea.co.kr",
    ]);
  });

  it.each([["24:00"], ["9:00"], ["12:60"]])(
    "rejects a non-HH:mm delivery time: %s",
    async (deliveryTime) => {
      const dto = plainToInstance(UpdateTenderSubscriptionDto, {
        enabled: false,
        deliveryTime,
        recipients: [],
      });

      await expect(validate(dto)).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ property: "deliveryTime" }),
        ]),
      );
    },
  );

  it("rejects invalid addresses, more than 20 recipients, and enabled empty delivery", async () => {
    const invalidEmail = plainToInstance(UpdateTenderSubscriptionDto, {
      enabled: false,
      deliveryTime: "09:00",
      recipients: ["not-an-email"],
    });
    const tooManyRecipients = plainToInstance(UpdateTenderSubscriptionDto, {
      enabled: false,
      deliveryTime: "09:00",
      recipients: Array.from(
        { length: 21 },
        (_, index) => `sales${index}@dfkorea.co.kr`,
      ),
    });
    const noRecipientsWhileEnabled = plainToInstance(
      UpdateTenderSubscriptionDto,
      {
        enabled: true,
        deliveryTime: "09:00",
        recipients: [],
      },
    );

    const [invalidEmailErrors, tooManyErrors, noRecipientsErrors] =
      await Promise.all([
        validate(invalidEmail),
        validate(tooManyRecipients),
        validate(noRecipientsWhileEnabled),
      ]);

    expect(invalidEmailErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: "recipients" }),
      ]),
    );
    expect(tooManyErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: "recipients" }),
      ]),
    );
    expect(noRecipientsErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: "recipients" }),
      ]),
    );
  });
});
