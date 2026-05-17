import { inflateRawSync } from "node:zlib";

import type { NativeFallbackImportItem } from "@/types/native-url-import";

const MAX_FALLBACK_IMPORT_ROWS = 100;

type TabularRow = Record<string, string>;

type ZipEntry = {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

function cleanText(value: string | null | undefined) {
  const cleaned = value?.replace(/\s+/g, " ").trim();

  return cleaned ? cleaned : null;
}

function splitList(value: string | null | undefined) {
  if (!value) return [];

  return value
    .split(/[;,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-z0-9ğüşöçıİ]+/gi, "_")
    .replace(/^_+|_+$/g, "");
}

function getField(row: TabularRow, aliases: string[]) {
  for (const alias of aliases) {
    const value = row[alias];

    if (cleanText(value)) {
      return cleanText(value);
    }
  }

  return null;
}

function normalizeTabularRows(
  rows: TabularRow[],
  sourceType: NativeFallbackImportItem["sourceType"],
) {
  return rows
    .map((row): NativeFallbackImportItem | null => {
      const title = getField(row, [
        "title",
        "urun_adi",
        "urun_adı",
        "product_name",
        "name",
        "ad",
      ]);
      const productUrl = getField(row, [
        "url",
        "product_url",
        "urun_url",
        "urun_linki",
        "link",
      ]);

      if (!title) return null;

      return {
        title,
        productUrl,
        description: getField(row, [
          "description",
          "aciklama",
          "açıklama",
          "urun_aciklamasi",
          "urun_açıklaması",
        ]),
        priceDisplay: getField(row, ["price", "fiyat", "price_display"]),
        currency: getField(row, ["currency", "para_birimi"]),
        imageUrls: splitList(
          getField(row, [
            "image",
            "image_url",
            "image_urls",
            "gorsel",
            "gorsel_url",
            "görsel",
            "görsel_url",
          ]),
        ),
        brand: getField(row, ["brand", "marka", "vendor"]),
        sku: getField(row, ["sku", "stok_kodu", "urun_kodu"]),
        category: getField(row, ["category", "kategori", "product_type"]),
        tags: splitList(getField(row, ["tags", "etiketler", "etiket"])),
        sourceType,
        rawSourcePayload: row,
      } satisfies NativeFallbackImportItem;
    })
    .filter((item): item is NativeFallbackImportItem => Boolean(item))
    .slice(0, MAX_FALLBACK_IMPORT_ROWS);
}

export function parseCsvText(
  text: string,
  sourceType: "csv" = "csv",
): NativeFallbackImportItem[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"' && inQuotes && nextCharacter === '"') {
      field += '"';
      index++;
      continue;
    }

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && (character === "," || character === "\t" || character === ";")) {
      row.push(field.trim());
      field = "";
      continue;
    }

    if (!inQuotes && (character === "\n" || character === "\r")) {
      if (character === "\r" && nextCharacter === "\n") {
        index++;
      }

      row.push(field.trim());
      field = "";

      if (row.some(Boolean)) {
        rows.push(row);
      }

      row = [];
      continue;
    }

    field += character;
  }

  row.push(field.trim());

  if (row.some(Boolean)) {
    rows.push(row);
  }

  const [headerRow, ...dataRows] = rows;

  if (!headerRow) {
    return [];
  }

  const headers = headerRow.map(normalizeHeader);
  const tabularRows = dataRows.map((dataRow) =>
    Object.fromEntries(headers.map((header, index) => [header, dataRow[index] ?? ""])),
  );

  return normalizeTabularRows(tabularRows, sourceType);
}

function readUInt16(buffer: Buffer, offset: number) {
  return buffer.readUInt16LE(offset);
}

function readUInt32(buffer: Buffer, offset: number) {
  return buffer.readUInt32LE(offset);
}

function findEndOfCentralDirectory(buffer: Buffer) {
  for (let offset = buffer.length - 22; offset >= 0; offset--) {
    if (readUInt32(buffer, offset) === 0x06054b50) {
      return offset;
    }
  }

  return -1;
}

function readZipEntries(buffer: Buffer): ZipEntry[] {
  const endOffset = findEndOfCentralDirectory(buffer);

  if (endOffset < 0) {
    throw new Error("Geçersiz XLSX dosyası.");
  }

  const entryCount = readUInt16(buffer, endOffset + 10);
  const centralDirectoryOffset = readUInt32(buffer, endOffset + 16);
  const entries: ZipEntry[] = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index++) {
    if (readUInt32(buffer, offset) !== 0x02014b50) {
      throw new Error("Geçersiz XLSX merkez dizini.");
    }

    const compressionMethod = readUInt16(buffer, offset + 10);
    const compressedSize = readUInt32(buffer, offset + 20);
    const uncompressedSize = readUInt32(buffer, offset + 24);
    const fileNameLength = readUInt16(buffer, offset + 28);
    const extraLength = readUInt16(buffer, offset + 30);
    const commentLength = readUInt16(buffer, offset + 32);
    const localHeaderOffset = readUInt32(buffer, offset + 42);
    const name = buffer
      .subarray(offset + 46, offset + 46 + fileNameLength)
      .toString("utf8");

    entries.push({
      name,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function readZipEntry(buffer: Buffer, entry: ZipEntry) {
  const localOffset = entry.localHeaderOffset;

  if (readUInt32(buffer, localOffset) !== 0x04034b50) {
    throw new Error("Geçersiz XLSX yerel dosya başlığı.");
  }

  const fileNameLength = readUInt16(buffer, localOffset + 26);
  const extraLength = readUInt16(buffer, localOffset + 28);
  const dataOffset = localOffset + 30 + fileNameLength + extraLength;
  const compressedData = buffer.subarray(
    dataOffset,
    dataOffset + entry.compressedSize,
  );

  if (entry.compressionMethod === 0) {
    return compressedData.toString("utf8");
  }

  if (entry.compressionMethod === 8) {
    return inflateRawSync(compressedData, {
      finishFlush: 2,
    }).toString("utf8");
  }

  throw new Error("Unsupported XLSX compression method.");
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractCellText(cellXml: string, sharedStrings: string[]) {
  const type = cellXml.match(/\st="([^"]+)"/)?.[1];

  if (type === "inlineStr") {
    const text = Array.from(cellXml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g))
      .map((match) => decodeXml(match[1]))
      .join("");

    return cleanText(text) ?? "";
  }

  const value = cellXml.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";

  if (type === "s") {
    return sharedStrings[Number(value)] ?? "";
  }

  return decodeXml(value);
}

function parseSharedStrings(xml: string) {
  return Array.from(xml.matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)).map((match) =>
    Array.from(match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g))
      .map((textMatch) => decodeXml(textMatch[1]))
      .join(""),
  );
}

function parseSheetRows(xml: string, sharedStrings: string[]) {
  return Array.from(xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)).map((match) =>
    Array.from(match[1].matchAll(/<c[^>]*>([\s\S]*?)<\/c>/g)).map((cellMatch) =>
      extractCellText(cellMatch[0], sharedStrings),
    ),
  );
}

export function parseXlsxBuffer(buffer: Buffer): NativeFallbackImportItem[] {
  const entries = readZipEntries(buffer);
  const entryByName = new Map(entries.map((entry) => [entry.name, entry]));
  const sharedStringsEntry = entryByName.get("xl/sharedStrings.xml");
  const sheetEntry =
    entryByName.get("xl/worksheets/sheet1.xml") ??
    entries.find((entry) => entry.name.startsWith("xl/worksheets/sheet"));

  if (!sheetEntry) {
    return [];
  }

  const sharedStrings = sharedStringsEntry
    ? parseSharedStrings(readZipEntry(buffer, sharedStringsEntry))
    : [];
  const sheetRows = parseSheetRows(readZipEntry(buffer, sheetEntry), sharedStrings);
  const [headerRow, ...dataRows] = sheetRows;

  if (!headerRow) {
    return [];
  }

  const headers = headerRow.map(normalizeHeader);
  const tabularRows = dataRows.map((dataRow) =>
    Object.fromEntries(headers.map((header, index) => [header, dataRow[index] ?? ""])),
  );

  return normalizeTabularRows(tabularRows, "excel");
}

export function buildManualFallbackItem(input: {
  title: string;
  productUrl?: string | null;
  description?: string | null;
  priceDisplay?: string | null;
  currency?: string | null;
  imageUrls?: string[];
  brand?: string | null;
  sku?: string | null;
  category?: string | null;
  tags?: string[];
}): NativeFallbackImportItem {
  return {
    title: input.title.trim(),
    productUrl: cleanText(input.productUrl),
    description: cleanText(input.description),
    priceDisplay: cleanText(input.priceDisplay),
    currency: cleanText(input.currency),
    imageUrls: input.imageUrls ?? [],
    brand: cleanText(input.brand),
    sku: cleanText(input.sku),
    category: cleanText(input.category),
    tags: input.tags ?? [],
    sourceType: "manual",
    rawSourcePayload: input,
  };
}
