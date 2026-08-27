import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("products")
export class Product {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column()
  category: string;

  @Column("jsonb", { default: [] })
  images: { image: string; description?: string }[];

  @Column()
  modelName: string;

  @Column()
  dimensions: string;

  @Column("numeric", { array: true, default: [] })
  power: number[];

  @Column("numeric")
  lifespan: number;

  @Column("numeric", { array: true, default: [] })
  colorTemp: number[];

  @Column()
  ledChipManufacturer: string;

  @Column("text", { array: true, default: [] })
  certifications: string[];

  @Column({ nullable: true })
  powerFactor: string;

  @Column("numeric", { nullable: true })
  luminanceEfficiency: number;

  @Column({ nullable: true })
  colorRendering: string;

  @Column("text", { array: true, default: [] })
  options: string[];

  @Column("text")
  description: string;

  @Column({ default: false })
  isNew: boolean;

  @Column({ default: false })
  isFeatured: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
