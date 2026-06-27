/**
 * Utilidades para manejo de fechas y duraciones
 */

/**
 * Convierte una cadena de duración en meses
 * @param duration - Cadena de duración (ej: "1 mes", "3 meses", "6 meses")
 * @returns Número de meses
 */
export function durationToMonths(duration: string): number {
  const durationMap: { [key: string]: number } = {
    "1 mes": 1,
    "3 meses": 3,
    "6 meses": 6,
  };

  return durationMap[duration] || 1; // Por defecto 1 mes si no se encuentra
}

/**
 * Calcula la fecha de expiración basada en la duración
 * @param duration - Cadena de duración (ej: "1 mes", "3 meses", "6 meses")
 * @param startDate - Fecha de inicio (opcional, por defecto la fecha actual)
 * @returns Fecha de expiración
 */
export function calculateExpirationDate(
  duration: string,
  startDate?: Date,
): Date {
  const months = durationToMonths(duration);
  const date = startDate || new Date();

  const expirationDate = new Date(date);
  expirationDate.setMonth(expirationDate.getMonth() + months);

  return expirationDate;
}

/**
 * Verifica si una fecha está por expirar dentro de los días especificados
 * @param expirationDate - Fecha de expiración
 * @param daysThreshold - Días antes de la expiración para considerar "por expirar"
 * @returns Objeto con información del estado
 */
export function getExpirationStatus(
  expirationDate: Date,
  daysThreshold: number = 3,
) {
  const now = new Date();
  const diffMs = expirationDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs < 0) {
    return {
      isExpired: true,
      isExpiringSoon: false,
      daysUntilExpiration: Math.abs(diffDays),
      status: "Expirado",
      color: "text-red-400",
      bgColor: "bg-red-600/20 border-red-600/30",
    };
  } else if (diffDays <= daysThreshold) {
    return {
      isExpired: false,
      isExpiringSoon: true,
      daysUntilExpiration: diffDays,
      status: `Por expirar (${diffDays}d)`,
      color: "text-yellow-400",
      bgColor: "bg-yellow-600/20 border-yellow-600/30",
    };
  } else {
    return {
      isExpired: false,
      isExpiringSoon: false,
      daysUntilExpiration: diffDays,
      status: `Vigente (${diffDays}d)`,
      color: "text-green-400",
      bgColor: "bg-green-600/20 border-green-600/30",
    };
  }
}

/**
 * Formatea una fecha en formato legible
 * @param date - Fecha a formatear
 * @returns Cadena de fecha formateada
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Calcula los días restantes hasta la expiración
 * @param expirationDate - Fecha de expiración
 * @returns Número de días restantes (negativo si ya expiró)
 */
export function getDaysUntilExpiration(expirationDate: Date): number {
  const now = new Date();
  const diffMs = expirationDate.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
