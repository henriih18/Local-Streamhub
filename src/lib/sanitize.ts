/**
 * Sanitiza input de usuario para prevenir XSS
 * Elimina cualquier HTML/JavaScript y mantiene solo el texto plano
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== "string") {
    return "";
  }

  // Eliminar HTML/JavaScript y mantener solo texto plano
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

/**
 * Sanitiza HTML permitiendo ciertas etiquetas básicas
 * Para descripciones con formato simple
 */
export function sanitizeHtml(input: string): string {
  // FIX: Sin librerías externas — eliminar TODO el HTML, devolver solo texto plano.
  // Es 100x más seguro que el regex anterior porque NO permite ninguna etiqueta.
  return sanitizeInput(input);
}

/**
 * Sanitiza valores CSS para prevenir CSS Injection
 * Solo permite colores hexadecimales, rgb, rgba y valores numéricos
 */
export function sanitizeCssValue(input: string): string {
  if (typeof input !== "string") {
    return "";
  }

  const inputTrimmed = input.trim();

  // Permitir colores hexadecimales
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(inputTrimmed)) {
    return inputTrimmed;
  }

  // Permitir rgb()
  if (/^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/.test(inputTrimmed)) {
    return inputTrimmed;
  }

  // Permitir rgba()
  if (
    /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)$/.test(inputTrimmed)
  ) {
    return inputTrimmed;
  }

  // Permitir colores CSS básicos
  const basicColors = [
    "black",
    "white",
    "red",
    "green",
    "blue",
    "yellow",
    "cyan",
    "magenta",
    "gray",
    "grey",
    "orange",
    "pink",
    "purple",
    "brown",
  ];
  if (basicColors.includes(inputTrimmed.toLowerCase())) {
    return inputTrimmed;
  }

  // Si no coincide con ninguno, usar valor por defecto
  return inputTrimmed.startsWith("#") ? "#000000" : "black";
}

/**
 * Sanitiza texto para prevenir CSS injection en animaciones
 * Solo permite duraciones CSS válidas (ej: "20s", "5000ms")
 */
export function sanitizeAnimationValue(input: string | number): number {
  if (typeof input === "number") {
    return input > 0 ? Math.floor(input) : 20;
  }

  if (typeof input !== "string") {
    return 20;
  }

  const inputTrimmed = input.trim();

  // Permitir duraciones en segundos
  const secondsPattern = /^\d+(\.\d+)?s$/i;
  if (secondsPattern.test(inputTrimmed)) {
    // Validar que sea un número razonable (1s a 300s)
    const value = parseFloat(inputTrimmed);
    if (value >= 1 && value <= 300) {
      return Math.floor(value);
    }
  }

  // Permitir duraciones en milisegundos
  const msPattern = /^\d+ms$/i;
  if (msPattern.test(inputTrimmed)) {
    const value = parseInt(inputTrimmed);
    if (value >= 1000 && value <= 300000) {
      return Math.floor(value / 1000); // Convertir ms a segundos
    }
  }

  // Valor por defecto
  return 20;
}

/**
 * Sanitiza URLs para prevenir javascript: y data: URLs maliciosas
 */
export function sanitizeUrl(input: string): string {
  if (typeof input !== "string") {
    return "";
  }

  const inputTrimmed = input.trim();

  // Prevenir javascript: y data: URLs
  if (/^(javascript:|data:|vbscript:|about:)/i.test(inputTrimmed)) {
    return "";
  }

  return inputTrimmed;
}

/**
 * Sanitiza icon/emoji para prevenir código malicioso
 */
export function sanitizeIcon(input: string): string {
  if (typeof input !== "string") {
    return "";
  }

  const inputTrimmed = input.trim();

  // Solo permitir emoji (rangos Unicode) o texto simple
  // Caracteres permitidos: letras, números, espacios, emoji comunes
  const iconPattern = /^[\p{L}\p{N}\p{Z}\p{S}.,!?-]+$/u;

  if (iconPattern.test(inputTrimmed)) {
    return inputTrimmed;
  }

  // Si contiene HTML o caracteres sospechosos, devolver empty
  if (/[<>]/.test(inputTrimmed)) {
    return "";
  }

  return inputTrimmed;
}

/**
 * Sanitiza números de teléfono
 */

export function sanitizePhone(input: string): string {
  if (typeof input !== "string") {
    return "";
  }

  const inputTrimmed = input.trim();

  // Limpiar caracteres no permitidos en vez de devolver vacío
  const cleaned = inputTrimmed.replace(/[^+\d\s\-\(\)]/g, "");
  return cleaned;
}

/**
 * Sanitiza nombres de usuario
 */
export function sanitizeUsername(input: string): string {
  if (typeof input !== "string") {
    return "";
  }

  const inputTrimmed = input.trim();

  // Solo permitir letras, números, y guiones bajos (como en el registro)
  const usernamePattern = /^[a-zA-Z0-9_]{3,20}$/;

  if (usernamePattern.test(inputTrimmed)) {
    return inputTrimmed;
  }

  return "";
}

/**
 * Sanitiza nombres completos
 */
export function sanitizeFullName(input: string): string {
  if (typeof input !== "string") {
    return "";
  }

  const inputTrimmed = input.trim();

  // Solo permitir letras, espacios, acentos, y algunos caracteres especiales
  const namePattern = /^[A-Za-zÀ-ÖØ-öø-ÿ\s\-\']{3,100}$/;

  if (namePattern.test(inputTrimmed)) {
    return inputTrimmed;
  }

  return "";
}
