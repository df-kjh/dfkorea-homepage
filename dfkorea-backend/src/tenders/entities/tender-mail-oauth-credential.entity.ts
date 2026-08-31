import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";

@Entity("tender_mail_oauth_credentials")
@Unique("UQ_tender_mail_oauth_credential_singleton_key", ["singletonKey"])
export class TenderMailOAuthCredential {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 32, default: "naver-works" })
  singletonKey: string;

  @Column({ type: "varchar", length: 32, default: "NAVER_WORKS" })
  provider: string;

  @Column({ type: "text", nullable: true })
  accessTokenEncrypted: string | null;

  @Column({ type: "text", nullable: true })
  refreshTokenEncrypted: string | null;

  @Column({ type: "timestamptz", nullable: true })
  accessTokenExpiresAt: Date | null;

  @Column({ type: "varchar", nullable: true })
  scope: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  oauthStateHash: string | null;

  @Column({ type: "timestamptz", nullable: true })
  oauthStateExpiresAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  connectedAt: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
