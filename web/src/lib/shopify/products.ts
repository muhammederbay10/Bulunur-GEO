import "server-only";

import { shopifyAdminGraphqlRequest } from "@/lib/shopify/client";
import type { ShopifyProduct } from "@/types/shopify";

const SHOPIFY_PRODUCTS_PAGE_SIZE = 50;
const SHOPIFY_PRODUCTS_MAX_PAGES = 2;

const SHOPIFY_PRODUCTS_QUERY = `
  query GetProducts($first: Int!, $after: String) {
    products(first: $first, after: $after, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        id
        title
        handle
        description
        descriptionHtml
        status
        vendor
        productType
        tags
        updatedAt
        onlineStorePreviewUrl
        totalInventory
        seo {
          title
          description
        }
        featuredMedia {
          preview {
            image {
              url
              altText
            }
          }
        }
        media(first: 5) {
          nodes {
            preview {
              image {
                url
                altText
              }
            }
          }
        }
        priceRangeV2 {
          minVariantPrice {
            amount
            currencyCode
          }
          maxVariantPrice {
            amount
            currencyCode
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

type ShopifyProductsQueryResponse = {
  products: {
    nodes: ShopifyProduct[];
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
  };
};

export type FetchShopifyProductsResult = {
  products: ShopifyProduct[];
  hasNextPage: boolean;
  lastCursor: string | null;
};

export async function fetchShopifyProducts({
  shop,
  accessToken,
}: {
  shop: string;
  accessToken: string;
}): Promise<FetchShopifyProductsResult> {
  const products: ShopifyProduct[] = [];
  let hasNextPage = false;
  let cursor: string | null = null;

  for (let page = 0; page < SHOPIFY_PRODUCTS_MAX_PAGES; page += 1) {
    const data: ShopifyProductsQueryResponse =
      await shopifyAdminGraphqlRequest<ShopifyProductsQueryResponse>({
      shop,
      accessToken,
      query: SHOPIFY_PRODUCTS_QUERY,
      variables: {
        first: SHOPIFY_PRODUCTS_PAGE_SIZE,
        after: cursor,
      },
    });

    products.push(...data.products.nodes);
    hasNextPage = data.products.pageInfo.hasNextPage;
    cursor = data.products.pageInfo.endCursor;

    if (!hasNextPage || !cursor) {
      break;
    }
  }

  return {
    products,
    hasNextPage,
    lastCursor: cursor,
  };
}
