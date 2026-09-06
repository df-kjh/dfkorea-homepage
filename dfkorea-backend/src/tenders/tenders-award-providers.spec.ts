import { MODULE_METADATA } from "@nestjs/common/constants";
import { TendersModule } from "./tenders.module";
import { G2bAwardAdapter } from "./adapters/g2b-award.adapter";
import { TenderAwardCollectorService } from "./services/tender-award-collector.service";
import { TenderPriceAnalyzer } from "./domain/tender-price-analyzer";
it("registers and exports the award adapter, collector and price analyzer for orchestration", () => {
  const providers = Reflect.getMetadata(
    MODULE_METADATA.PROVIDERS,
    TendersModule,
  );
  const exports = Reflect.getMetadata(MODULE_METADATA.EXPORTS, TendersModule);
  for (const token of [
    G2bAwardAdapter,
    TenderAwardCollectorService,
    TenderPriceAnalyzer,
  ]) {
    expect(
      providers.some(
        (provider) => provider === token || provider.provide === token,
      ),
    ).toBe(true);
    expect(exports).toContain(token);
  }
});
