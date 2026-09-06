import { renderQuoteMail } from "./quote-mail";
describe("quote email snapshots", () => {
  it("escapes all visitor content, labels requested certification separately and includes photo/item mapping", () => {
    const mail = renderQuoteMail(
      {
        reference: "Q-123",
        created_at: new Date(),
        verified_at: new Date(),
        company: {
          companyName: "<script>bad</script>",
          businessNumber: "1234567890",
          representativeName: "대표",
          openingDate: "2020-01-01",
          contactName: "담당",
          email: "person@example.com",
        },
        notes: "<img src=x>",
        requested_delivery_date: null,
      },
      [
        {
          id: "i",
          kind: "catalog",
          quantity: 5,
          snapshot: {
            name: "제품",
            modelName: "MODEL",
            certifications: ["KC"],
          },
          selected: { certifications: ["고효율"], options: [] },
        },
      ],
      [{ item_id: "i", name: "photo.jpg" }],
    );
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).not.toContain("<img");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.html).toContain("요구 인증");
    expect(mail.html).toContain("보유 인증");
    expect(mail.html).toContain("photo.jpg");
    expect(mail.to).toBe("kymkjh2002@dfkorealed.com");
    expect(mail.fromName).toBe("DF KOREA 온라인 견적");
  });
});
