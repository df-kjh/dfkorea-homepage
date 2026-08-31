import { Injectable } from "@nestjs/common";
import { ProcurementType, TenderOpportunityType } from "./tender.enums";
import { TenderLicenseLimit } from "./normalized-tender";

export interface TenderOpportunityClassificationInput {
  procurementType: ProcurementType;
  title: string;
  description: string;
  attachmentNames: string[];
  contractMethod: string | null;
  licenseLimits: TenderLicenseLimit[];
}

export interface TenderOpportunityClassification {
  type: TenderOpportunityType;
  reasons: string[];
}

const MAS_PATTERN =
  /다수\s*공급자\s*계약|(?<![A-Za-z0-9_])MAS(?![A-Za-z0-9_])/i;
const ELECTRICAL_CONSTRUCTION_PATTERN = /전기공사업/;

@Injectable()
export class TenderOpportunityClassifier {
  classify(
    input: TenderOpportunityClassificationInput,
  ): TenderOpportunityClassification {
    if (input.procurementType === ProcurementType.CONSTRUCTION) {
      return {
        type: TenderOpportunityType.EXCLUDED_CONSTRUCTION,
        reasons: ["공사 업무구분"],
      };
    }

    if (input.procurementType === ProcurementType.GOODS) {
      const electricalLicenseLimit = input.licenseLimits.find((licenseLimit) =>
        ELECTRICAL_CONSTRUCTION_PATTERN.test(
          `${licenseLimit.name} ${licenseLimit.permittedIndustries}`,
        ),
      );
      if (electricalLicenseLimit) {
        return {
          type: TenderOpportunityType.EXCLUDED_CONSTRUCTION,
          reasons: ["전기공사업 면허제한"],
        };
      }

      const masField = this.findMasField(input);
      if (masField) {
        return {
          type: TenderOpportunityType.MAS,
          reasons: [`MAS 표현: ${masField}`],
        };
      }

      return {
        type: TenderOpportunityType.GOODS_SUPPLY,
        reasons: ["물품 업무구분"],
      };
    }

    return {
      type: TenderOpportunityType.EXCLUDED_NON_SUPPLY,
      reasons: ["물품 외 업무구분"],
    };
  }

  private findMasField(
    input: TenderOpportunityClassificationInput,
  ): string | null {
    const fields: ReadonlyArray<[string, string]> = [
      ["제목", input.title],
      ["설명", input.description],
      ["첨부파일", input.attachmentNames.join(" ")],
      ["계약방법", input.contractMethod ?? ""],
    ];

    return fields.find(([, value]) => MAS_PATTERN.test(value))?.[0] ?? null;
  }
}
