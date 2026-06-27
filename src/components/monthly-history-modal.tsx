"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Eye,
  Download,
  BarChart3,
} from "lucide-react";
import { toast } from "@/components/ui/toast-custom";

interface MonthlyRecord {
  id: string;
  year: number;
  month: number;
  revenue: number;
  expenses: number;
  profits: number;
  profitMargin: number;
  totalRecharges: number;
  uniqueUsers: number;
  averageRecharge: number;
  isClosed: boolean;
  createdAt: string;
  details?: any;
}

interface HistoryData {
  history: MonthlyRecord[];
  summary: {
    totalRevenue: number;
    totalExpenses: number;
    totalProfits: number;
    averageProfitMargin: number;
    totalMonths: number;
  };
  yearlySummary: any[];
  availableYears: number[];
  currentMonth: {
    year: number;
    month: number;
  };
}

interface MonthlyHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMonth: (year: number, month: number) => void;
}

export function MonthlyHistoryModal({
  isOpen,
  onClose,
  onSelectMonth,
}: MonthlyHistoryModalProps) {
  const [historyData, setHistoryData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      fetchHistoryData();
    }
  }, [isOpen, selectedYear]);

  const fetchHistoryData = async () => {
    try {
      setLoading(true);
      let url = "/api/expenses/monthly/history";
      if (selectedYear !== "all") {
        url += `?year=${selectedYear}`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setHistoryData(data);
      }
    } catch (error) {
      //console.error('Error al obtener los datos del historial:', error)
      toast.error("Error al cargar historial");
    } finally {
      setLoading(false);
    }
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

  const toggleMonthExpansion = (recordId: string) => {
    const newExpanded = new Set(expandedMonths);
    if (newExpanded.has(recordId)) {
      newExpanded.delete(recordId);
    } else {
      newExpanded.add(recordId);
    }
    setExpandedMonths(newExpanded);
  };

  const toggleYearExpansion = (year: string) => {
    const newExpanded = new Set(expandedYears);
    if (newExpanded.has(year)) {
      newExpanded.delete(year);
    } else {
      newExpanded.add(year);
    }
    setExpandedYears(newExpanded);
  };

  const exportToCSV = () => {
    if (!historyData) return;

    const csvContent = [
      [
        "Año",
        "Mes",
        "Ingresos",
        "Gastos",
        "Ganancias",
        "Margen %",
        "Recargas",
        "Usuarios Únicos",
      ],
      ...historyData.history.map((record) => [
        record.year,
        getMonthName(record.month),
        record.revenue.toString(),
        record.expenses.toString(),
        record.profits.toString(),
        record.profitMargin.toFixed(2),
        record.totalRecharges.toString(),
        record.uniqueUsers.toString(),
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historial-ganancias-${
      new Date().toISOString().split("T")[0]
    }.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success("Historial exportado exitosamente");
  };

  const isCurrentMonth = (year: number, month: number) => {
    const now = new Date();
    return year === now.getFullYear() && month === now.getMonth() + 1;
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-4xl max-h-[80vh]">
          <div className="flex items-center justify-center h-64">
            <div className="text-lg">Cargando historial...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!historyData) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-4xl max-h-[80vh]">
          <div className="flex items-center justify-center h-64">
            <div className="text-lg">No hay datos disponibles</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Calendar className="h-5 w-5" />
            Historial de Ganancias Mensuales
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Controles */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-40 bg-gray-700 border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  <SelectItem value="all">Todos los años</SelectItem>
                  {historyData.availableYears.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={exportToCSV}
              variant="outline"
              size="sm"
              className="bg-gray-700 border-gray-600"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>

          {/* Tarjetas de resumen */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-gray-700 border-gray-600">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400">Ingresos Totales</p>
                    <p className="text-lg font-bold text-green-400">
                      {formatCurrency(historyData.summary.totalRevenue)}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-400/50" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-700 border-gray-600">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400">Gastos Totales</p>
                    <p className="text-lg font-bold text-red-400">
                      {formatCurrency(historyData.summary.totalExpenses)}
                    </p>
                  </div>
                  <TrendingDown className="h-8 w-8 text-red-400/50" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-700 border-gray-600">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400">Ganancias Totales</p>
                    <p className="text-lg font-bold text-blue-400">
                      {formatCurrency(historyData.summary.totalProfits)}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-blue-400/50" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-700 border-gray-600">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400">Margen Promedio</p>
                    <p className="text-lg font-bold text-yellow-400">
                      {historyData.summary.averageProfitMargin.toFixed(1)}%
                    </p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-yellow-400/50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Historial Mensual */}
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {historyData.yearlySummary.map((yearData: any) => (
                <Card
                  key={yearData.year}
                  className="bg-gray-700 border-gray-600"
                >
                  <CardHeader
                    className="pb-3 cursor-pointer hover:bg-gray-600/50 transition-colors"
                    onClick={() =>
                      toggleYearExpansion(yearData.year.toString())
                    }
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Año {yearData.year}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-gray-600">
                          {yearData.months.length} meses
                        </Badge>
                        {expandedYears.has(yearData.year.toString()) ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </div>

                    {/* Resumen del año */}
                    <div className="grid grid-cols-4 gap-4 mt-3">
                      <div className="text-center">
                        <p className="text-xs text-gray-400">Ingresos</p>
                        <p className="text-sm font-bold text-green-400">
                          {formatCurrency(yearData.totalRevenue)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-400">Gastos</p>
                        <p className="text-sm font-bold text-red-400">
                          {formatCurrency(yearData.totalExpenses)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-400">Ganancias</p>
                        <p className="text-sm font-bold text-blue-400">
                          {formatCurrency(yearData.totalProfits)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-400">
                          Promedio Mensual
                        </p>
                        <p className="text-sm font-bold text-yellow-400">
                          {formatCurrency(yearData.averageMonthlyProfit)}
                        </p>
                      </div>
                    </div>
                  </CardHeader>

                  {expandedYears.has(yearData.year.toString()) && (
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {yearData.months
                          .sort(
                            (a: MonthlyRecord, b: MonthlyRecord) =>
                              b.month - a.month,
                          )
                          .map((record: MonthlyRecord) => (
                            <Card
                              key={record.id}
                              className={`bg-gray-600 border-gray-500 cursor-pointer hover:bg-gray-500/50 transition-colors ${
                                isCurrentMonth(record.year, record.month)
                                  ? "ring-2 ring-blue-500"
                                  : ""
                              }`}
                              onClick={() => toggleMonthExpansion(record.id)}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div>
                                      <p className="font-medium flex items-center gap-2">
                                        {getMonthName(record.month)}
                                        {isCurrentMonth(
                                          record.year,
                                          record.month,
                                        ) && (
                                          <Badge
                                            variant="default"
                                            className="bg-blue-500 text-xs"
                                          >
                                            Actual
                                          </Badge>
                                        )}
                                      </p>
                                      <p className="text-xs text-gray-400">
                                        {record.totalRecharges} recargas •{" "}
                                        {record.uniqueUsers} usuarios
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-4">
                                    <div className="text-right">
                                      <p
                                        className={`font-bold ${
                                          record.profits >= 0
                                            ? "text-green-400"
                                            : "text-red-400"
                                        }`}
                                      >
                                        {formatCurrency(record.profits)}
                                      </p>
                                      <p className="text-xs text-gray-400">
                                        {record.profitMargin.toFixed(1)}% margen
                                      </p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onSelectMonth(
                                            record.year,
                                            record.month,
                                          );
                                          onClose();
                                        }}
                                        className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                                      >
                                        <Eye className="h-3 w-3" />
                                      </Button>
                                      {expandedMonths.has(record.id) ? (
                                        <ChevronUp className="h-4 w-4 text-gray-400" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4 text-gray-400" />
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {expandedMonths.has(record.id) && (
                                  <div className="mt-3 pt-3 border-t border-gray-500 grid grid-cols-2 gap-4">
                                    <div>
                                      <p className="text-xs text-gray-400 mb-1">
                                        Desglose
                                      </p>
                                      <div className="space-y-1">
                                        <div className="flex justify-between text-xs">
                                          <span>Ingresos:</span>
                                          <span className="text-green-400">
                                            {formatCurrency(record.revenue)}
                                          </span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                          <span>Gastos:</span>
                                          <span className="text-red-400">
                                            {formatCurrency(record.expenses)}
                                          </span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                          <span>Promedio recarga:</span>
                                          <span className="text-yellow-400">
                                            {formatCurrency(
                                              record.averageRecharge,
                                            )}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-400 mb-1">
                                        Estado
                                      </p>
                                      <div className="flex items-center gap-2">
                                        <Badge
                                          variant={
                                            record.isClosed
                                              ? "default"
                                              : "secondary"
                                          }
                                          className={
                                            record.isClosed
                                              ? "bg-green-600"
                                              : "bg-yellow-600"
                                          }
                                        >
                                          {record.isClosed
                                            ? "Cerrado"
                                            : "Activo"}
                                        </Badge>
                                        <span className="text-xs text-gray-400">
                                          {new Date(
                                            record.createdAt,
                                          ).toLocaleDateString("es-CO")}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
