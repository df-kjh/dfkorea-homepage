import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';

export class InitialSchema1706200000000 implements MigrationInterface {
  name = 'InitialSchema1706200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // All baseline UUID primary keys use uuid_generate_v4(), so a pristine
    // disposable database must enable the extension before its first table.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Create products table
    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "category" varchar NOT NULL,
        "images" text[] DEFAULT '{}',
        "modelName" varchar NOT NULL,
        "dimensions" varchar NOT NULL,
        "power" varchar NOT NULL,
        "lifespan" varchar NOT NULL,
        "colorTemp" varchar NOT NULL,
        "ledChipManufacturer" varchar NOT NULL,
        "certifications" text[] DEFAULT '{}',
        "description" text NOT NULL,
        "isNew" boolean DEFAULT false,
        "isFeatured" boolean DEFAULT false,
        "createdAt" TIMESTAMP DEFAULT now(),
        "updatedAt" TIMESTAMP DEFAULT now()
      )
    `);

    // Create posts table
    await queryRunner.query(`
      CREATE TABLE "posts" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "title" varchar NOT NULL,
        "excerpt" text NOT NULL,
        "content" text NOT NULL,
        "category" varchar NOT NULL,
        "image" varchar,
        "views" integer DEFAULT 0,
        "createdAt" TIMESTAMP DEFAULT now(),
        "updatedAt" TIMESTAMP DEFAULT now()
      )
    `);

    // Create admins table
    await queryRunner.query(`
      CREATE TABLE "admins" (
        "id" SERIAL PRIMARY KEY,
        "username" varchar UNIQUE NOT NULL,
        "password" varchar NOT NULL
      )
    `);

    // Insert default admin account
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await queryRunner.query(
      `INSERT INTO "admins" ("username", "password") VALUES ($1, $2)`,
      ['admin', hashedPassword],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "admins"`);
    await queryRunner.query(`DROP TABLE "posts"`);
    await queryRunner.query(`DROP TABLE "products"`);
  }
}
