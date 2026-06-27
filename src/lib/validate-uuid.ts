const CUID_REGEX = /^c[a-z0-9]{20,}$/;

export function validateUUID(id: string): boolean {
  return CUID_REGEX.test(id);
}

export function requireUUID(id: string): {
  valid: boolean;
  error: string | null;
} {
  if (!id || typeof id !== "string") {
    return { valid: false, error: "ID es requerido" };
  }
  if (!validateUUID(id)) {
    return { valid: false, error: "ID inválido" };
  }
  return { valid: true, error: null };
}

