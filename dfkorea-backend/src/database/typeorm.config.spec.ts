import { getTypeOrmPaths } from './typeorm.config';

describe('TypeORM migration discovery paths', () => {
  it.each([
    {
      runtimeExtension: '.ts' as const,
      entities: [
        'src/entities/*.entity.ts',
        'src/tenders/entities/*.entity.ts',
      ],
      migrations: ['src/migrations/*.ts'],
    },
    {
      runtimeExtension: '.js' as const,
      entities: [
        'dist/entities/*.entity.js',
        'dist/tenders/entities/*.entity.js',
      ],
      migrations: ['dist/migrations/*.js'],
    },
  ])(
    'discovers existing and tender artifacts when the runtime uses $runtimeExtension',
    ({ runtimeExtension, entities, migrations }) => {
      expect(getTypeOrmPaths(runtimeExtension)).toEqual({ entities, migrations });
    },
  );
});
