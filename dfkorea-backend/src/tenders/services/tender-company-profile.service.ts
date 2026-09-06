import { TenderAnalysis } from "../entities/tender-analysis.entity";
import { pendingAnalysis } from "./tender-analysis-queue";
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import {
  ReplaceTenderCompanyProfileDto,
  TenderCompanyProfileDto,
  TenderCompanyQualificationDto,
  TenderCompanyPerformanceRecordDto,
} from "../dto/tender-company-profile.dto";
import { TenderCompanyProfile } from "../entities/tender-company-profile.entity";

const COMPANY_PROFILE_SINGLETON_KEY = "company";

type TenderCompanyProfilePersistenceFields = Pick<
  TenderCompanyProfile,
  | "companyName"
  | "businessNumber"
  | "headquartersSido"
  | "headquartersSigungu"
  | "g2bRegistered"
  | "supplyProducts"
  | "licenses"
  | "companyTypes"
  | "directProduction"
  | "certifications"
  | "performanceRecords"
>;

@Injectable()
export class TenderCompanyProfileService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async get(): Promise<TenderCompanyProfileDto | null> {
    const profile = await this.dataSource
      .getRepository(TenderCompanyProfile)
      .findOne({ where: { singletonKey: COMPANY_PROFILE_SINGLETON_KEY } });
    return profile ? this.toDto(profile) : null;
  }

  async replace(
    input: ReplaceTenderCompanyProfileDto,
  ): Promise<TenderCompanyProfileDto> {
    const profile = await this.normalizeAndValidate(input);

    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(TenderCompanyProfile);

      // Inserting a version-zero candidate before taking the row lock lets two
      // initial PUTs converge on the same singleton row. The locked save below
      // is the only persisted profile state and always advances its version.
      await repository
        .createQueryBuilder()
        .insert()
        .values({
          singletonKey: COMPANY_PROFILE_SINGLETON_KEY,
          ...this.toPersistenceFields(profile),
          version: 0,
        })
        .orIgnore()
        .execute();

      const current = await repository.findOne({
        where: { singletonKey: COMPANY_PROFILE_SINGLETON_KEY },
        lock: { mode: "pessimistic_write" },
      });
      if (!current) {
        throw new InternalServerErrorException(
          "Unable to initialize tender company profile",
        );
      }

      const saved = await repository.save({
        ...current,
        ...this.toPersistenceFields(profile),
        version: current.version + 1,
      });
      await manager
        .getRepository(TenderAnalysis)
        .createQueryBuilder()
        .update()
        .set({ ...pendingAnalysis, companyProfileFingerprint: null })
        .execute();
      return this.toDto(saved);
    });
  }

  private async normalizeAndValidate(
    input: ReplaceTenderCompanyProfileDto,
  ): Promise<ReplaceTenderCompanyProfileDto> {
    const profile = plainToInstance(ReplaceTenderCompanyProfileDto, input);
    const errors = await validate(profile);
    if (errors.length > 0) {
      throw new BadRequestException("Invalid tender company profile");
    }
    return profile;
  }

  private toPersistenceFields(
    profile: ReplaceTenderCompanyProfileDto,
  ): TenderCompanyProfilePersistenceFields {
    return {
      companyName: profile.companyName,
      businessNumber: profile.businessNumber,
      headquartersSido: profile.headquarters.sido,
      headquartersSigungu: profile.headquarters.sigungu,
      g2bRegistered: profile.g2bRegistered,
      supplyProducts: this.toQualificationRecords(profile.supplyProducts),
      licenses: this.toQualificationRecords(profile.licenses),
      companyTypes: this.toQualificationRecords(profile.companyTypes),
      directProduction: this.toQualificationRecords(profile.directProduction),
      certifications: this.toQualificationRecords(profile.certifications),
      performanceRecords: this.toPerformanceRecords(profile.performanceRecords),
    };
  }

  private toDto(profile: TenderCompanyProfile): TenderCompanyProfileDto {
    return {
      companyName: profile.companyName,
      businessNumber: profile.businessNumber,
      headquarters: {
        sido: profile.headquartersSido,
        sigungu: profile.headquartersSigungu,
      },
      g2bRegistered: profile.g2bRegistered,
      supplyProducts: this.toQualificationDtos(profile.supplyProducts),
      licenses: this.toQualificationDtos(profile.licenses),
      companyTypes: this.toQualificationDtos(profile.companyTypes),
      directProduction: this.toQualificationDtos(profile.directProduction),
      certifications: this.toQualificationDtos(profile.certifications),
      performanceRecords: this.toPerformanceDtos(profile.performanceRecords),
      version: profile.version,
    };
  }

  private toQualificationRecords(
    qualifications: TenderCompanyQualificationDto[],
  ): Record<string, unknown>[] {
    return qualifications.map(({ code, name, expiresAt }) => ({
      code,
      name,
      expiresAt,
    }));
  }

  private toPerformanceRecords(
    records: TenderCompanyPerformanceRecordDto[],
  ): Record<string, unknown>[] {
    return records.map(({ itemName, from, to, amount }) => ({
      itemName,
      from,
      to,
      amount,
    }));
  }

  private toQualificationDtos(
    qualifications: Record<string, unknown>[],
  ): TenderCompanyQualificationDto[] {
    return qualifications.map(({ code, name, expiresAt }) => ({
      code: String(code),
      name: String(name),
      expiresAt: typeof expiresAt === "string" ? expiresAt : null,
    }));
  }

  private toPerformanceDtos(
    records: Record<string, unknown>[],
  ): TenderCompanyPerformanceRecordDto[] {
    return records.map(({ itemName, from, to, amount }) => ({
      itemName: String(itemName),
      from: String(from),
      to: String(to),
      amount: String(amount),
    }));
  }
}
