"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TrendingUp,
  TrendingDown,
  Calculator,
  RefreshCw,
  Calendar,
  History,
} from "lucide-react";
import { ExpenseManager } from "./expense-manager";
import { MonthlyHistoryModal } from "./monthly-history-modal";

interface ProfitData {
  year: number;
  month: number;
  revenue: number;
  expenses: number;
  profits: number;
  profitMargin: number;
  totalRecharges: number;
  uniqueUsers: number;
  averageRecharge: number;
}

interface MonthOption {
  value: string;
  label: string;
  year: number;
  month: number;
}

interface ProfitsCardProps {
  className?: string;
}

export function ProfitsCard({ className = "" }: ProfitsCardProps) {
  const [profitData, setProfitData] = useState<ProfitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExpenseManagerOpen, setIsExpenseManagerOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [availableMonths, setAvailableMonths] = useState<MonthOption[]>([]);

  useEffect(() => {
    fetchAvailableMonths();
    fetchProfitData();
  }, []);

  const fetchAvailableMonths = async () => {
    try {
      const response = await fetch("/api/expenses/monthly/history");
      if (response.ok) {
        const data = await response.json();
        const months: MonthOption[] = [];

        // Agregar mes actual
        const now = new Date();
        const currentMonthValue = `${now.getFullYear()}-${(now.getMonth() + 1)
          .toString()
          .padStart(2, "0")}`;
        months.push({
          value: currentMonthValue,
          label: `${getMonthName(
            now.getMonth() + 1,
          )} ${now.getFullYear()} (Actual)`,
          year: now.getFullYear(),
          month: now.getMonth() + 1,
        });

        // Agregar meses históricos
        data.history?.forEach((record: any) => {
          const monthValue = `${record.year}-${record.month
            .toString()
            .padStart(2, "0")}`;
          if (!months.find((m) => m.value === monthValue)) {
            months.push({
              value: monthValue,
              label: `${getMonthName(record.month)} ${record.year}`,
              year: record.year,
              month: record.month,
            });
          }
        });

        setAvailableMonths(months);
        setSelectedMonth(currentMonthValue);
      }
    } catch (error) {
      //console.error('Error al obtener los meses disponibles:', error)
    }
  };

  const fetchProfitData = async (year?: number, month?: number) => {
    try {
      setLoading(true);
      let url = "/api/expenses/profits";
      if (year && month) {
        url += `?year=${year}&month=${month}`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setProfitData(data);
      }
    } catch (error) {
      //console.error('Error al obtener los datos de ganancias:', error)
    } finally {
      setLoading(false);
    }
  };

  const handleMonthChange = (value: string) => {
    setSelectedMonth(value);
    const [year, month] = value.split("-").map(Number);
    fetchProfitData(year, month);
  };

  const getMonthName = (month: number) => {
    const months = [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ];
    return months[month - 1] || month.toString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const isProfitable = profitData?.profits && profitData.profits > 0;
  const isCurrentMonth = () => {
    if (!profitData) return false;
    const now = new Date();
    return (
      profitData.year === now.getFullYear() &&
      profitData.month === now.getMonth() + 1
    );
  };

  return (
    <>
      <Card
        className={`bg-gray-800 border-gray-700 hover:bg-gray-750 transition-colors ${className}`}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Ganancias Mensuales
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsHistoryModalOpen(true)}
              className="h-6 w-6 p-0 text-gray-400 hover:text-white"
              title="Ver historial"
            >
              <History className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchProfitData()}
              className="h-6 w-6 p-0 text-gray-400 hover:text-white"
              title="Actualizar"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
            <div
              className={`p-1 rounded ${
                isProfitable ? "bg-green-500/20" : "bg-red-500/20"
              }`}
            >
              {isProfitable ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent
          onClick={() => isCurrentMonth() && setIsExpenseManagerOpen(true)}
        >
          {/* Selector de mes */}
          <div className="mb-3">
            <Select value={selectedMonth} onValueChange={handleMonthChange}>
              <SelectTrigger className="w-full h-8 text-xs bg-gray-700 border-gray-600">
                <SelectValue placeholder="Seleccionar mes" />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                {availableMonths.map((month) => (
                  <SelectItem
                    key={month.value}
                    value={month.value}
                    className="text-xs"
                  >
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-2xl font-bold text-gray-400">Cargando...</div>
          ) : profitData ? (
            <>
              <div
                className={`text-2xl font-bold ${
                  isProfitable ? "text-green-400" : "text-red-400"
                }`}
              >
                {formatCurrency(profitData.profits)}
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-gray-500">
                  {profitData.profitMargin >= 0 ? "+" : ""}
                  {profitData.profitMargin.toFixed(1)}% margen
                </p>
                {isCurrentMonth() && (
                  <div className="flex items-center gap-1 text-xs text-blue-400">
                    <Calculator className="h-3 w-3" />
                    <span>Gestionar</span>
                  </div>
                )}
              </div>
              <div className="mt-2 pt-2 border-t border-gray-700">
                <div className="flex justify-between text-xs">
                  <span className="text-green-400">
                    Ingresos: {formatCurrency(profitData.revenue)}
                  </span>
                  <span className="text-red-400">
                    Gastos: {formatCurrency(profitData.expenses)}
                  </span>
                </div>
                {profitData.totalRecharges > 0 && (
                  <div className="flex justify-between text-xs mt-1 text-gray-400">
                    <span>{profitData.totalRecharges} recargas</span>
                    <span>{profitData.uniqueUsers} usuarios</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-2xl font-bold text-gray-400">
              No disponible
            </div>
          )}
        </CardContent>
      </Card>

      <ExpenseManager
        isOpen={isExpenseManagerOpen}
        onClose={() => {
          setIsExpenseManagerOpen(false);
          fetchProfitData();
        }}
      />

      <MonthlyHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        onSelectMonth={(year, month) => {
          const monthValue = `${year}-${month.toString().padStart(2, "0")}`;
          setSelectedMonth(monthValue);
          fetchProfitData(year, month);
          setIsHistoryModalOpen(false);
        }}
      />
    </>
  );
}
