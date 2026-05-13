import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import type {
  NativeUrlImportErrorCode,
  SafeFetchResult,
} from "@/types/native-url-import";

import {
  isBlockedHostname,
  isUnsafeIpAddress,
  validateProductListingUrl,
} from "./validate-url";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_HTML_BYTES = 2_000_000;
const MAX_REDIRECTS = 5;

const USER_AGENT = "Starq.dev Product Import Bot/0.1 (+https://starq.dev)";

const BLOCKED_STATUS_CODES = new Set([401, 403, 407, 429]);
const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);

type FetchFailure = {
  ok: false;
  error: string;
  errorCode: NativeUrlImportErrorCode;
  finalUrl?: string;
  status?: number;
  contentType?: string | null;
};

type FetchWithRedirectsResult =
  | {
      ok: true;
      response: Response;
      finalUrl: string;
    }
  | FetchFailure;

type HtmlReadResult =
  | {
      ok: true;
      html: string;
    }
  | FetchFailure;

function isHtmlContentType(contentType: string | null): boolean {
  if (!contentType) {
    // Some small/demo websites may not send a content-type header.
    // We allow missing content-type for MVP and let Cheerio parsing decide later.
    return true;
  }

  const normalizedContentType = contentType.toLowerCase();

  return (
    normalizedContentType.includes("text/html") ||
    normalizedContentType.includes("application/xhtml+xml")
  );
}

function isFileDownload(contentDisposition: string | null): boolean {
  if (!contentDisposition) return false;

  return contentDisposition.toLowerCase().includes("attachment");
}

async function cancelResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Best-effort cleanup before following a redirect.
  }
}

async function verifyPublicDnsResolution(url: string): Promise<FetchFailure | null> {
  const { hostname } = new URL(url);

  if (isBlockedHostname(hostname)) {
    return {
      ok: false,
      finalUrl: url,
      error: "Local, private, or internal network URLs are not allowed.",
      errorCode: "unsafe_url",
    };
  }

  if (isIP(hostname)) {
    if (isUnsafeIpAddress(hostname)) {
      return {
        ok: false,
        finalUrl: url,
        error: "URL resolved to a private or internal IP address.",
        errorCode: "dns_private_ip",
      };
    }

    return null;
  }

  try {
    const addresses = await lookup(hostname, {
      all: true,
      verbatim: true,
    });

    if (addresses.length === 0) {
      return {
        ok: false,
        finalUrl: url,
        error: "Could not resolve this website hostname.",
        errorCode: "dns_lookup_failed",
      };
    }

    if (addresses.some((address) => isUnsafeIpAddress(address.address))) {
      return {
        ok: false,
        finalUrl: url,
        error: "URL resolved to a private or internal IP address.",
        errorCode: "dns_private_ip",
      };
    }
  } catch {
    return {
      ok: false,
      finalUrl: url,
      error: "Could not resolve this website hostname.",
      errorCode: "dns_lookup_failed",
    };
  }

  return null;
}

function getRedirectUrl(response: Response, currentUrl: string): string | null {
  const location = response.headers.get("location");

  if (!location) return null;

  try {
    return new URL(location, currentUrl).toString();
  } catch {
    return null;
  }
}

async function fetchWithSafeRedirects({
  normalizedUrl,
  signal,
}: {
  normalizedUrl: string;
  signal: AbortSignal;
}): Promise<FetchWithRedirectsResult> {
  let currentUrl = normalizedUrl;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    const validation = validateProductListingUrl(currentUrl);

    if (!validation.isValid || !validation.normalizedUrl) {
      return {
        ok: false,
        finalUrl: currentUrl,
        error: validation.error ?? "Unsafe or unsupported URL.",
        errorCode:
          redirectCount === 0
            ? (validation.errorCode ?? "unsafe_url")
            : "unsafe_redirect",
      };
    }

    const dnsFailure = await verifyPublicDnsResolution(validation.normalizedUrl);

    if (dnsFailure) {
      return {
        ...dnsFailure,
        errorCode:
          redirectCount === 0 ? dnsFailure.errorCode : "unsafe_redirect",
      };
    }

    const response = await fetch(validation.normalizedUrl, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
    });

    const finalUrl = response.url || validation.normalizedUrl;

    if (!REDIRECT_STATUS_CODES.has(response.status)) {
      return {
        ok: true,
        response,
        finalUrl,
      };
    }

    const redirectUrl = getRedirectUrl(response, validation.normalizedUrl);

    await cancelResponseBody(response);

    if (!redirectUrl) {
      return {
        ok: false,
        finalUrl,
        status: response.status,
        contentType: response.headers.get("content-type"),
        error: "Website returned a redirect without a valid location.",
        errorCode: "unsafe_redirect",
      };
    }

    if (redirectCount === MAX_REDIRECTS) {
      return {
        ok: false,
        finalUrl: redirectUrl,
        status: response.status,
        contentType: response.headers.get("content-type"),
        error: "Website redirected too many times.",
        errorCode: "too_many_redirects",
      };
    }

    currentUrl = redirectUrl;
  }

  return {
    ok: false,
    finalUrl: currentUrl,
    error: "Website redirected too many times.",
    errorCode: "too_many_redirects",
  };
}

async function readHtmlWithLimit(response: Response): Promise<HtmlReadResult> {
  const contentType = response.headers.get("content-type");
  const contentLength = response.headers.get("content-length");
  const parsedContentLength = contentLength ? Number(contentLength) : null;

  if (
    parsedContentLength !== null &&
    Number.isFinite(parsedContentLength) &&
    parsedContentLength > MAX_HTML_BYTES
  ) {
    return {
      ok: false,
      status: response.status,
      contentType,
      error: "This HTML page is too large for the scanner.",
      errorCode: "too_large",
    };
  }

  if (!response.body) {
    const html = await response.text();
    const byteLength = new TextEncoder().encode(html).byteLength;

    if (byteLength > MAX_HTML_BYTES) {
      return {
        ok: false,
        status: response.status,
        contentType,
        error: "This HTML page is too large for the scanner.",
        errorCode: "too_large",
      };
    }

    return {
      ok: true,
      html,
    };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let html = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    bytesRead += value.byteLength;

    if (bytesRead > MAX_HTML_BYTES) {
      await reader.cancel();

      return {
        ok: false,
        status: response.status,
        contentType,
        error: "This HTML page is too large for the scanner.",
        errorCode: "too_large",
      };
    }

    html += decoder.decode(value, { stream: true });
  }

  html += decoder.decode();

  return {
    ok: true,
    html,
  };
}

export async function safeFetchHtml(
  inputUrl: string,
): Promise<SafeFetchResult> {
  const validation = validateProductListingUrl(inputUrl);

  if (!validation.isValid || !validation.normalizedUrl) {
    return {
      ok: false,
      url: inputUrl,
      error: validation.error ?? "Invalid URL.",
      errorCode: validation.errorCode ?? "invalid_url",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const fetchResult = await fetchWithSafeRedirects({
      normalizedUrl: validation.normalizedUrl,
      signal: controller.signal,
    });

    if (!fetchResult.ok) {
      return {
        ok: false,
        url: validation.normalizedUrl,
        finalUrl: fetchResult.finalUrl,
        status: fetchResult.status,
        contentType: fetchResult.contentType,
        error: fetchResult.error,
        errorCode: fetchResult.errorCode,
      };
    }

    const { response, finalUrl } = fetchResult;
    const contentType = response.headers.get("content-type");
    const contentDisposition = response.headers.get("content-disposition");

    if (BLOCKED_STATUS_CODES.has(response.status)) {
      return {
        ok: false,
        url: validation.normalizedUrl,
        finalUrl,
        status: response.status,
        contentType,
        error:
          "This website blocked the request or requires authentication. Please use CSV/Excel upload instead.",
        errorCode: "blocked_status",
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        url: validation.normalizedUrl,
        finalUrl,
        status: response.status,
        contentType,
        error: `Website returned HTTP ${response.status}.`,
        errorCode: "http_error",
      };
    }

    if (isFileDownload(contentDisposition)) {
      return {
        ok: false,
        url: validation.normalizedUrl,
        finalUrl,
        status: response.status,
        contentType,
        error: "This URL appears to be a file download, not an HTML page.",
        errorCode: "file_download",
      };
    }

    if (!isHtmlContentType(contentType)) {
      return {
        ok: false,
        url: validation.normalizedUrl,
        finalUrl,
        status: response.status,
        contentType,
        error: "This URL does not appear to return an HTML page.",
        errorCode: "non_html",
      };
    }

    const htmlReadResult = await readHtmlWithLimit(response);

    if (!htmlReadResult.ok) {
      return {
        ok: false,
        url: validation.normalizedUrl,
        finalUrl,
        status: htmlReadResult.status,
        contentType: htmlReadResult.contentType,
        error: htmlReadResult.error,
        errorCode: htmlReadResult.errorCode,
      };
    }

    const { html } = htmlReadResult;

    if (!html.trim()) {
      return {
        ok: false,
        url: validation.normalizedUrl,
        finalUrl,
        status: response.status,
        contentType,
        error: "The page returned empty HTML.",
        errorCode: "empty_html",
      };
    }

    return {
      ok: true,
      url: validation.normalizedUrl,
      finalUrl,
      status: response.status,
      contentType,
      html,
    };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Request timed out."
        : "Failed to fetch the website.";

    return {
      ok: false,
      url: validation.normalizedUrl,
      error: message,
      errorCode:
        error instanceof Error && error.name === "AbortError"
          ? "timeout"
          : "fetch_failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}
