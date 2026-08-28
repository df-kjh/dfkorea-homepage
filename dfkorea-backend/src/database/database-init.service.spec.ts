import { DatabaseInitService } from "./database-init.service";

describe("DatabaseInitService", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("fails production startup without an admin and never auto-creates one", async () => {
    process.env.NODE_ENV = "production";
    const repository = {
      count: jest.fn().mockResolvedValue(0),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    await expect(
      new DatabaseInitService(repository as never).onModuleInit(),
    ).rejects.toThrow(/admin:provision:prod/);
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("does not create a default admin outside production", async () => {
    process.env.NODE_ENV = "test";
    const repository = {
      count: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    await new DatabaseInitService(repository as never).onModuleInit();

    expect(repository.findOne).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });
});
