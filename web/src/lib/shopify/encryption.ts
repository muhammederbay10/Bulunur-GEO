import "server-only";

import crypto from "node:crypto";

import { getShopifyConfig } from "@/lib/shopify/config";

const TOKEN_ENCRYPTION_ALGORITHM = "aes-256-gcm";

function getTokenEncryptionKey() {
  const { tokenEncryptionKey } = getShopifyConfig();
  const base64Key = Buffer.from(tokenEncryptionKey, "base64");

  if (base64Key.length === 32) {
    return base64Key;
  }

  const hexKey = Buffer.from(tokenEncryptionKey, "hex");

  if (hexKey.length === 32) {
    return hexKey;
  }

  throw new Error("Invalid Shopify token encryption key.");
}

export function encryptShopifyAccessToken(accessToken: string) {
  const key = getTokenEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(TOKEN_ENCRYPTION_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(accessToken, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}

export function decryptShopifyAccessToken(encryptedAccessToken: string) {
  const [ivBase64, authTagBase64, encryptedBase64] =
    encryptedAccessToken.split(".");

  if (!ivBase64 || !authTagBase64 || !encryptedBase64) {
    throw new Error("Invalid encrypted Shopify token format.");
  }

  const key = getTokenEncryptionKey();
  const decipher = crypto.createDecipheriv(
    TOKEN_ENCRYPTION_ALGORITHM,
    key,
    Buffer.from(ivBase64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(authTagBase64, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
