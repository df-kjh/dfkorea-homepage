import type { Product } from "../entities/product.entity";
import { filterProducts } from "./product-filters";
import type { ProductFilters } from "./product-filters";

type ProductVariantGroup = NonNullable<Product["variantGroup"]>;

// These are reviewed SKU relationships, not name-based merge rules. Parking
// variants intentionally retain different wattage and certification lists.
const reviewedGroups = [
  {
    id: "round-ceiling",
    name: "원형 조명",
    primaryProductId: "d4705d1d-7dab-4381-b83c-9c9026efa896",
    requireSamePowerAndCertifications: true,
    variants: [
      { label: "일반형", productId: "d4705d1d-7dab-4381-b83c-9c9026efa896" },
      { label: "센서형", productId: "bc46e6f3-2dd0-4c17-bf5b-0ee5b681b538" },
    ],
  },
  {
    id: "parking-linear",
    name: "주차장 조명",
    primaryProductId: "492784ba-6318-4687-b877-9edde0b96b32",
    requireSamePowerAndCertifications: false,
    variants: [
      { label: "상시형", productId: "492784ba-6318-4687-b877-9edde0b96b32" },
      { label: "디밍형", productId: "f6bfbddf-a3b8-4127-b352-6ba9c703e252" },
    ],
  },
] as const;

const textValue = (value: unknown): string | undefined => {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return value.trim();
};

const scalarValue = (value: unknown): string | undefined => {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  if (typeof value === "string" && !value.trim()) return undefined;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return `number:${numeric}`;
  const text = textValue(value);
  return text === undefined ? undefined : `text:${text}`;
};

function sameArray(
  left: unknown,
  right: unknown,
  normalize: (value: unknown) => string | undefined,
): boolean {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  const first = left.map(normalize);
  const second = right.map(normalize);
  if (first.includes(undefined) || second.includes(undefined)) return false;
  const normalized = (values: string[]) =>
    JSON.stringify([...new Set(values)].sort());
  return normalized(first) === normalized(second);
}

function sharesReviewedSpecifications(
  primary: Product,
  member: Product,
  requireSamePowerAndCertifications: boolean,
): boolean {
  // Unknown common fields cannot prove equivalence, so serve separate SKUs
  // until their registered specifications are complete and agree again.
  for (const field of ["dimensions", "ledChipManufacturer"] as const) {
    const first = textValue(primary[field]);
    if (first === undefined || first !== textValue(member[field])) return false;
  }
  for (const field of [
    "lifespan",
    "powerFactor",
    "luminanceEfficiency",
    "colorRendering",
  ] as const) {
    const first = scalarValue(primary[field]);
    if (first === undefined || first !== scalarValue(member[field]))
      return false;
  }
  if (
    !primary.colorTemp?.length ||
    !sameArray(primary.colorTemp, member.colorTemp, scalarValue)
  ) {
    return false;
  }
  return (
    !requireSamePowerAndCertifications ||
    (Boolean(primary.power?.length) &&
      sameArray(primary.power, member.power, scalarValue) &&
      sameArray(primary.certifications, member.certifications, textValue))
  );
}

function sourceProduct(product: Product): Product {
  const { variantGroup: _variantGroup, ...source } = product;
  return source;
}

function validGroups(products: Product[]): ProductVariantGroup[] {
  const byId = new Map(products.map((product) => [product.id, product]));
  return reviewedGroups.flatMap((definition) => {
    const primary = byId.get(definition.primaryProductId);
    if (!primary) return [];
    const members = definition.variants.map((variant) =>
      byId.get(variant.productId),
    );
    if (
      members.some(
        (member) =>
          !member ||
          !sharesReviewedSpecifications(
            primary,
            member,
            definition.requireSamePowerAndCertifications,
          ),
      )
    )
      return [];
    return [
      {
        id: definition.id,
        name: definition.name,
        primaryProductId: definition.primaryProductId,
        variants: definition.variants.map((variant, index) => ({
          label: variant.label,
          product: sourceProduct(members[index]),
        })),
      },
    ];
  });
}

export function withProductVariantGroup(
  product: Product,
  catalog: Product[],
): Product {
  const group = validGroups(catalog).find((candidate) =>
    candidate.variants.some((variant) => variant.product.id === product.id),
  );
  const source = sourceProduct(product);
  return group ? { ...source, variantGroup: group } : source;
}

export function groupProductVariants(
  products: Product[],
  filters: ProductFilters = {},
): Product[] {
  const groupsByProduct = new Map<string, ProductVariantGroup>();
  const groupNames = new Map<string, string>();
  for (const group of validGroups(products)) {
    for (const variant of group.variants) {
      groupsByProduct.set(variant.product.id, group);
      groupNames.set(variant.product.id, group.name);
    }
  }
  // Match complete source SKUs before grouping: watts from one member must
  // never satisfy a request together with certifications/options from another.
  const matching = filterProducts(products, filters, groupNames);
  const matchingById = new Map(
    matching.map((product) => [product.id, product]),
  );
  const emitted = new Set<string>();
  return matching.flatMap((product) => {
    const group = groupsByProduct.get(product.id);
    if (!group) return [sourceProduct(product)];
    if (emitted.has(group.id)) return [];
    emitted.add(group.id);
    const representative =
      matchingById.get(group.primaryProductId) ??
      group.variants
        .map((variant) => matchingById.get(variant.product.id))
        .find(Boolean);
    return [{ ...sourceProduct(representative), variantGroup: group }];
  });
}
