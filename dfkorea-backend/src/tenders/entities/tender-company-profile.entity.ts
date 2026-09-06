import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";

@Entity("tender_company_profiles")
@Unique("UQ_tender_company_profile_singleton_key", ["singletonKey"])
export class TenderCompanyProfile {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 32, default: "company" })
  singletonKey: string;

  @Column({ type: "varchar" })
  companyName: string;

  @Column({ type: "varchar", length: 10 })
  businessNumber: string;

  @Column({ type: "varchar" })
  headquartersSido: string;

  @Column({ type: "varchar" })
  headquartersSigungu: string;

  @Column({ type: "boolean", default: false })
  g2bRegistered: boolean;

  @Column({ type: "jsonb", default: () => "'[]'" })
  supplyProducts: Record<string, unknown>[];

  @Column({ type: "jsonb", default: () => "'[]'" })
  licenses: Record<string, unknown>[];

  @Column({ type: "jsonb", default: () => "'[]'" })
  companyTypes: Record<string, unknown>[];

  @Column({ type: "jsonb", default: () => "'[]'" })
  directProduction: Record<string, unknown>[];

  @Column({ type: "jsonb", default: () => "'[]'" })
  certifications: Record<string, unknown>[];

  @Column({ type: "jsonb", default: () => "'[]'" })
  performanceRecords: Record<string, unknown>[];

  @Column({ type: "integer", default: 1 })
  version: number;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
