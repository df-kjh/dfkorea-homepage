import { X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const backendRoot = join(__dirname, "..", "..");
const certificatePath = join(
  backendRoot,
  "certificates",
  "lh-turingsign-rsa-secure-ca-2.pem",
);

describe("LH TLS certificate chain packaging", () => {
  it("packages the verified missing intermediate without disabling TLS verification", () => {
    const certificate = new X509Certificate(readFileSync(certificatePath));
    const dockerfile = readFileSync(join(backendRoot, "Dockerfile"), "utf8");

    expect(certificate.ca).toBe(true);
    expect(certificate.subject).toContain("CN=TuringSign RSA Secure CA 2");
    expect(certificate.issuer).toContain("CN=OISTE WISeKey Global Root GB CA");
    expect(certificate.fingerprint256).toBe(
      "A6:F9:C9:67:EB:8A:A9:28:3A:1C:A6:49:B8:7B:76:47:20:E9:F5:C3:AF:A8:1C:15:06:76:F4:CA:36:E9:8C:F6",
    );
    expect(dockerfile).toContain("COPY certificates ./certificates");
    expect(dockerfile).toContain(
      "ENV NODE_EXTRA_CA_CERTS=/app/certificates/lh-turingsign-rsa-secure-ca-2.pem",
    );
    expect(dockerfile).not.toContain("NODE_TLS_REJECT_UNAUTHORIZED=0");
  });
});
