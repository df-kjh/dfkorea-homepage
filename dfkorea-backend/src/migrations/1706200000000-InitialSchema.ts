import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1706200000000 implements MigrationInterface {
  name = "InitialSchema1706200000000";

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
        "images" text[] NOT NULL DEFAULT '{}',
        "modelName" varchar NOT NULL,
        "dimensions" varchar NOT NULL,
        "power" varchar NOT NULL,
        "lifespan" varchar NOT NULL,
        "colorTemp" varchar NOT NULL,
        "ledChipManufacturer" varchar NOT NULL,
        "certifications" text[] NOT NULL DEFAULT '{}',
        "powerFactor" varchar,
        "luminanceEfficiency" varchar,
        "colorRendering" varchar,
        "options" text[] NOT NULL DEFAULT '{}',
        "description" text NOT NULL,
        "isNew" boolean NOT NULL DEFAULT false,
        "isFeatured" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "admins"`);
    await queryRunner.query(`DROP TABLE "posts"`);
    await queryRunner.query(`DROP TABLE "products"`);
  }
}
