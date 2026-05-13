import { isIP } from "node:net";

import type { UrlValidationResult } from "@/types/native-url-import";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "0.0.0.0",
]);

function normalizeIpLiteral(hostname: string): string {
  const normalizedHostname = hostname.toLowerCase().trim();

  if (normalizedHostname.startsWith("[") && normalizedHostname.endsWith("]")) {
    return normalizedHostname.slice(1, -1);
  }

  return normalizedHostname;
}

function isUnsafeIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);

  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return true;
  }

  const [first, second] = parts;

  // 10.0.0.0/8
  if (first === 10) return true;

  // 100.64.0.0/10 carrier-grade NAT
  if (first === 100 && second >= 64 && second <= 127) return true;

  // 172.16.0.0/12
  if (first === 172 && second >= 16 && second <= 31) return true;

  // 192.168.0.0/16
  if (first === 192 && second === 168) return true;

  // 127.0.0.0/8
  if (first === 127) return true;

  // 169.254.0.0/16
  if (first === 169 && second === 254) return true;

  // 0.0.0.0/8
  if (first === 0) return true;

  // 192.0.0.0/24 special-purpose network
  if (first === 192 && second === 0 && parts[2] === 0) return true;

  // 192.0.2.0/24 documentation network
  if (first === 192 && second === 0 && parts[2] === 2) return true;

  // 198.18.0.0/15 benchmarking network
  if (first === 198 && (second === 18 || second === 19)) return true;

  // 198.51.100.0/24 documentation network
  if (first === 198 && second === 51 && parts[2] === 100) return true;

  // 203.0.113.0/24 documentation network
  if (first === 203 && second === 0 && parts[2] === 113) return true;

  // 224.0.0.0/4 multicast and 240.0.0.0/4 reserved
  if (first >= 224) return true;

  return false;
}

function isUnsafeIPv6(ip: string): boolean {
  const normalizedIp = normalizeIpLiteral(ip);

  if (normalizedIp.startsWith("::ffff:")) {
    const mappedIPv4 = normalizedIp.replace("::ffff:", "");

    if (isIP(mappedIPv4) === 4) {
      return isUnsafeIPv4(mappedIPv4);
    }
  }

  return (
    normalizedIp === "::" ||
    normalizedIp === "::1" ||
    normalizedIp.startsWith("fc") ||
    normalizedIp.startsWith("fd") ||
    normalizedIp.startsWith("fe80") ||
    normalizedIp.startsWith("ff") ||
    normalizedIp.startsWith("2001:db8")
  );
}

export function isUnsafeIpAddress(ip: string): boolean {
  const normalizedIp = normalizeIpLiteral(ip);
  const ipVersion = isIP(normalizedIp);

  if (ipVersion === 4) {
    return isUnsafeIPv4(normalizedIp);
  }

  if (ipVersion === 6) {
    return isUnsafeIPv6(normalizedIp);
  }

  return true;
}

function looksLikeMalformedIpLiteral(hostname: string): boolean {
  const normalizedHostname = normalizeIpLiteral(hostname);

  if (isIP(normalizedHostname)) return false;

  return (
    /^\d+$/.test(normalizedHostname) ||
    /^0x[0-9a-f]+$/i.test(normalizedHostname) ||
    /^(?:\d{1,3}\.){1,3}\d{0,3}$/.test(normalizedHostname) ||
    normalizedHostname.includes(":")
  );
}

export function isBlockedHostname(hostname: string): boolean {
  const normalizedHostname = hostname.toLowerCase().trim();

  if (!normalizedHostname) return true;

  if (BLOCKED_HOSTNAMES.has(normalizedHostname)) return true;

  if (normalizedHostname.endsWith(".localhost")) return true;

  if (normalizedHostname.endsWith(".local")) return true;

  if (looksLikeMalformedIpLiteral(normalizedHostname)) return true;

  if (isIP(normalizeIpLiteral(normalizedHostname))) {
    return isUnsafeIpAddress(normalizedHostname);
  }

  return false;
}

export function validateProductListingUrl(
  inputUrl: string,
): UrlValidationResult {
  const trimmedUrl = inputUrl.trim();

  if (!trimmedUrl) {
    return {
      isValid: false,
      error: "URL is required.",
      errorCode: "invalid_url",
    };
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(trimmedUrl);
  } catch {
    return {
      isValid: false,
      error: "Invalid URL format.",
      errorCode: "invalid_url",
    };
  }

  if (!ALLOWED_PROTOCOLS.has(parsedUrl.protocol)) {
    return {
      isValid: false,
      error: "Only HTTP and HTTPS URLs are allowed.",
      errorCode: "unsafe_url",
    };
  }

  if (isBlockedHostname(parsedUrl.hostname)) {
    return {
      isValid: false,
      error: "Local, private, or internal network URLs are not allowed.",
      errorCode: "unsafe_url",
    };
  }

  parsedUrl.hash = "";

  return {
    isValid: true,
    normalizedUrl: parsedUrl.toString(),
    hostname: parsedUrl.hostname,
  };
}
