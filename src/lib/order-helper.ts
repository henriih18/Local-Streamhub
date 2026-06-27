import { encrypt, decrypt, isEncrypted } from "./crypto";
import { logger } from "./logger";

/**
 * Interfaz para orden con credenciales descifradas
 */
export interface OrderWithDecryptedCredentials {
  accountEmail?: string;
  accountPassword?: string;
  profileName?: string;
  profilePin?: string;
}

/**
 * Cifra las credenciales de una orden
 */
export function encryptOrderCredentials(data: {
  accountEmail: string;
  accountPassword: string;
  profileName?: string;
  profilePin?: string;
}): {
  accountEmail: string;
  accountPassword: string;
  profileName?: string;
  profilePin?: string;
} {
  return {
    accountEmail: encrypt(data.accountEmail),
    accountPassword: encrypt(data.accountPassword),
    profileName: data.profileName ? encrypt(data.profileName) : undefined,
    profilePin: data.profilePin ? encrypt(data.profilePin) : undefined,
  };
}

/**
 * Descifra las credenciales de una orden
 */
export function decryptOrderCredentials(
  order: any,
): OrderWithDecryptedCredentials {
  if (!order) return order;

  const decryptedOrder: any = { ...order };

  const fields: Array<keyof OrderWithDecryptedCredentials> = [
    "accountEmail",
    "accountPassword",
    "profileName",
    "profilePin",
  ];

  fields.forEach((field) => {
    const value = order[field];
    if (value && isEncrypted(value)) {
      try {
        decryptedOrder[field] = decrypt(value);
      } catch (error) {
        logger.error({ err: error }, `Error descifrando credenciales de orden`);
        decryptedOrder[field] = value; // mantener original si falla
      }
    }
  });

  return decryptedOrder;
}

/**
 * Descifra múltiples órdenes
 */
export function decryptOrdersCredentials(orders: any[]): any[] {
  if (!orders || !Array.isArray(orders)) return orders;
  return orders.map((order) => decryptOrderCredentials(order));
}

/**
 * Descifra credenciales de inventario (AccountStock, AccountProfile, ExclusiveStock)
 */
export function decryptInventoryCredentials(item: {
  email?: string;
  password?: string;
  profilePin?: string | null;
  profileName?: string | null;
}): {
  email?: string;
  password?: string;
  profilePin?: string | null;
  profileName?: string | null;
} {
  if (!item) return item;

  const decrypted: any = { ...item };

  if (item.email && isEncrypted(item.email))
    decrypted.email = decrypt(item.email);
  if (item.password && isEncrypted(item.password))
    decrypted.password = decrypt(item.password);
  if (item.profilePin && isEncrypted(item.profilePin))
    decrypted.profilePin = decrypt(item.profilePin);
  if (item.profileName && isEncrypted(item.profileName))
    decrypted.profileName = decrypt(item.profileName);

  return decrypted;
}

/**
 * Cifra credenciales de inventario
 */
export function encryptInventoryCredentials(data: {
  email?: string;
  password?: string;
  profilePin?: string;
  profileName?: string;
}): {
  email?: string;
  password?: string;
  profilePin?: string;
  profileName?: string;
} {
  const encrypted: any = {};

  if (data.email) encrypted.email = encrypt(data.email);
  if (data.password) encrypted.password = encrypt(data.password);
  if (data.profilePin) encrypted.profilePin = encrypt(data.profilePin);
  if (data.profileName) encrypted.profileName = encrypt(data.profileName);

  return encrypted;
}

/**
 * Descifra credenciales de stock (para admin)
 */
export function decryptStockCredentials(stock: any): any {
  if (!stock) return stock;

  const decrypted: any = { ...stock };
  ["email", "password", "profilePin", "profileName"].forEach((field) => {
    const value = stock[field];
    if (value && isEncrypted(value)) {
      try {
        decrypted[field] = decrypt(value);
      } catch (error) {
        logger.error({ err: error }, `Error descifrando credenciales de stock`);
        decrypted[field] = value;
      }
    }
  });

  return decrypted;
}

/**
 * Cifra credenciales de stock (para admin)
 */
export function encryptStockCredentials(stockData: any): any {
  if (!stockData) return stockData;

  const encrypted: any = { ...stockData };
  ["email", "password", "profilePin", "profileName"].forEach((field) => {
    const value = stockData[field];
    if (typeof value === "string" && value) {
      try {
        encrypted[field] = encrypt(value);
      } catch (error) {
        logger.error({err: error},`Error cifrando stock`);
      }
    }
  });

  return encrypted;
}

/**
 * Descifra múltiples stocks
 */
export function decryptStocksCredentials(stocks: any[]): any[] {
  if (!stocks || !Array.isArray(stocks)) return stocks;
  return stocks.map((stock) => decryptStockCredentials(stock));
}

/**
 * Cifra múltiples stocks
 */
export function encryptStocksCredentials(stocksData: any[]): any[] {
  if (!stocksData || !Array.isArray(stocksData)) return stocksData;
  return stocksData.map((stock) => encryptStockCredentials(stock));
}
