import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameCertificateImageToPdf1740100000000 implements MigrationInterface {
    name = 'RenameCertificateImageToPdf1740100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // certificateImage 컬럼을 certificatePdf로 이름 변경
        await queryRunner.query(`
            ALTER TABLE "certificates" 
            RENAME COLUMN "certificateImage" TO "certificatePdf"
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 롤백: certificatePdf를 certificateImage로 되돌림
        await queryRunner.query(`
            ALTER TABLE "certificates" 
            RENAME COLUMN "certificatePdf" TO "certificateImage"
        `);
    }
}
