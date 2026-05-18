export function buildNativeImportLoadingPath(importUrl?: string | null) {
  const normalizedUrl = importUrl?.trim();

  if (!normalizedUrl) {
    return null;
  }

  const params = new URLSearchParams({
    url: normalizedUrl,
  });

  return `/sources/native-import/loading?${params.toString()}`;
}
