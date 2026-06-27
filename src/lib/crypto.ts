import crypto from "crypto";
import { logger } from "./logger";

// Obtener la clave de cifrado del entorno
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key || key.length !== 64) {
    throw new Error(
      "ERROR: ENCRYPTION_KEY no está configurada correctamente. Debe tener 64 caracteres hexadecimales.",
    );
  }

  return Buffer.from(key, "hex");
}

// Convertir la clave a Buffer (32 bytes para AES-256)

/**
 * Cifra datos sensibles usando AES-256-GCM
 * @param text - Texto a cifrar
 * @returns Texto cifrado en formato hexadecimales
 */
export function encrypt(text: string): string {
  try {
    const key = getEncryptionKey();
    // Generar un IV único para cada cifrado (12 bytes)
    const iv = crypto.randomBytes(12);

    // Crear cipher con AES-256-GCM
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

    // Cifrar el texto
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    // Obtener el auth tag (16 bytes)
    const authTag = cipher.getAuthTag();

    // Formato: iv (24 hex) + authTag (32 hex) + encrypted (variable)
    return iv.toString("hex") + authTag.toString("hex") + encrypted;
  } catch (error) {
    logger.error({err: error},"Error al cifrar");
    throw new Error("Error al cifrar datos");
  }
}

/**
 * Descifra datos usando AES-256-GCM
 * @param encryptedText - Texto cifrado en formato hexadecimales
 * @returns Texto original descifrado
 */
export function decrypt(encryptedText: string): string {
  try {
    // Extraer componentes del texto cifrado
    const key = getEncryptionKey();
    const iv = Buffer.from(encryptedText.substring(0, 24), "hex");
    const authTag = Buffer.from(encryptedText.substring(24, 56), "hex");
    const encrypted = encryptedText.substring(56);

    // Crear decipher
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);

    // Establecer el auth tag
    decipher.setAuthTag(authTag);

    // Descifrar
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    logger.error({err: error},"Error al descifrar");
    throw new Error("Error al descifrar datos");
  }
}

/**
 * Verifica si un texto parece estar cifrado
 * @param text - Texto a verificar
 * @returns true si parece estar cifrado, false en caso contrario
 */
export function isEncrypted(text: string): boolean {
  try {
    if (!text || text.length < 56) return false;
    // Verificar que tenga formato válido de cifrado
    const iv = text.substring(0, 24);
    const authTag = text.substring(24, 56);

    // Intentar decodificar como hex
    return /^[0-9a-fA-F]{24}$/.test(iv) && /^[0-9a-fA-F]{32}$/.test(authTag);
  } catch {
    return false;
  }
}
