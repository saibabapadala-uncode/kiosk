import type { CatalogResponse, Category, PaginatedProducts, Product } from '@/types/catalog';
import catalogJson from '@/mock/catalog.json';
import { delay, getFlowDelay } from './stripe/static.mock';

type ImageToken = {
  label: string;
  bg: string;
  fg: string;
  accent: string;
};

type CatalogProductJson = Omit<Product, 'imageUrl'> & {
  image?: ImageToken;
  imageUrl?: string;
};

type CatalogJsonShape = {
  categories: Category[];
  products: CatalogProductJson[];
};

const SOURCE = catalogJson as CatalogJsonShape;

function image(label: string, bg: string, fg: string, accent: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${bg}"/>
          <stop offset="1" stop-color="${accent}"/>
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#g)"/>
      <circle cx="650" cy="70" r="150" fill="rgba(255,255,255,.18)"/>
      <circle cx="150" cy="520" r="190" fill="rgba(0,0,0,.08)"/>
      <rect x="110" y="125" width="580" height="350" rx="44" fill="rgba(255,255,255,.88)"/>
      <ellipse cx="400" cy="355" rx="220" ry="70" fill="rgba(0,0,0,.12)"/>
      <circle cx="400" cy="280" r="130" fill="${fg}"/>
      <circle cx="350" cy="240" r="28" fill="rgba(255,255,255,.55)"/>
      <circle cx="455" cy="325" r="38" fill="rgba(0,0,0,.12)"/>
      <text x="400" y="520" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="42" font-weight="800" fill="white">${label}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function toProduct(product: CatalogProductJson): Product {
  return {
    ...product,
    imageUrl: product.imageUrl ?? (product.image ? image(product.image.label, product.image.bg, product.image.fg, product.image.accent) : ''),
  };
}

export const STATIC_CATALOG: CatalogResponse = {
  categories: SOURCE.categories,
  products: SOURCE.products.map(toProduct),
};

export async function getStaticCatalog(): Promise<CatalogResponse> {
  await delay(getFlowDelay('catalogMs', 250));
  return STATIC_CATALOG;
}

export async function getStaticCategories(): Promise<Category[]> {
  await delay(getFlowDelay('categoriesMs', 150));
  return STATIC_CATALOG.categories;
}

export async function getStaticProductsPage(params: {
  categoryId?: string | null;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedProducts> {
  await delay(getFlowDelay('productsPageMs', 250));
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const search = params.search?.trim().toLowerCase() ?? '';

  let products = STATIC_CATALOG.products.filter((product) => product.available);

  if (params.categoryId) {
    products = products.filter((product) => product.categoryId === params.categoryId);
  }

  if (search) {
    products = products.filter((product) =>
      product.name.toLowerCase().includes(search) ||
      product.description.toLowerCase().includes(search) ||
      product.tags.some((tag) => tag.toLowerCase().includes(search)),
    );
  }

  products = [...products].sort((a, b) => a.sortOrder - b.sortOrder);

  const start = (page - 1) * pageSize;
  const data = products.slice(start, start + pageSize);

  return {
    data,
    page,
    pageSize,
    total: products.length,
    hasMore: start + pageSize < products.length,
  };
}

export async function getStaticRecommendations(productIds: string[]): Promise<Product[]> {
  await delay(getFlowDelay('recommendationsMs', 150));
  const excluded = new Set(productIds);
  return STATIC_CATALOG.products
    .filter((product) => product.available && !excluded.has(product.id))
    .sort((a, b) => Number(b.popular) - Number(a.popular) || a.sortOrder - b.sortOrder)
    .slice(0, 4);
}
