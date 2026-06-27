"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/toast-custom";
import {
  DollarSign,
  Plus,
  Edit,
  Trash2,
  TrendingUp,
  TrendingDown,
  Calendar,
  AlertCircle,
  Calculator,
  RefreshCw,
} from "lucide-react";

interface Expense {
  id: string;
  name: string;
  description?: string;
  amount: number;
  category: string;
  frequency: "MENSUAL" | "ANUAL" | "UNICO";
  dueDate?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProfitData {
  revenue: number;
  expenses: number;
  profits: number;
  profitMargin: number;
  breakdown: {
    monthlyExpenses: number;
    annualExpensesMonthly: number;
    uniqueExpenses: number;
  };
}

interface ExpenseManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  "Hosting",
  "Dominio",
  "Marketing",
  "Streaming",
  "Soporte",
  "Herramientas",
  "Impuestos",
  "Otros",
];

const FREQUENCIES = [
  { value: "MENSUAL", label: "Mensual" },
  { value: "ANUAL", label: "Anual" },
  { value: "UNICO", label: "Único" },
];

export function ExpenseManager({ isOpen, onClose }: ExpenseManagerProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [profitData, setProfitData] = useState<ProfitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreateExpenseOpen, setIsCreateExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const [newExpense, setNewExpense] = useState({
    name: "",
    description: "",
    amount: "",
    category: "",
    frequency: "MENSUAL" as const,
    dueDate: "",
  });

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [expensesResponse, profitsResponse] = await Promise.all([
        fetch("/api/expenses"),
        fetch("/api/expenses/profits"),
      ]);

      if (expensesResponse.ok) {
        const expensesData = await expensesResponse.json();
        setExpenses(expensesData.expenses);
      }

      if (profitsResponse.ok) {
        const profitsData = await profitsResponse.json();
        setProfitData(profitsData);
      }
    } catch (error) {
      //console.error('Error al cargar los datos:', error)
      toast.error("Error al cargar los datos");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExpense = async () => {
    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newExpense,
          amount: parseFloat(newExpense.amount),
        }),
      });

      if (response.ok) {
        setIsCreateExpenseOpen(false);
        resetExpenseForm();
        fetchData();
        toast.success("Gasto creado correctamente");
      } else {
        toast.error("Error al crear el gasto");
      }
    } catch (error) {
      //console.error('Error al crear el gasto:', error)
      toast.error("Error de conexión");
    }
  };

  const handleUpdateExpense = async () => {
    if (!editingExpense) return;

    try {
      const response = await fetch(`/api/expenses/${editingExpense.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingExpense),
      });

      if (response.ok) {
        setEditingExpense(null);
        fetchData();
        toast.success("Gasto actualizado correctamente");
      } else {
        toast.error("Error al actualizar el gasto");
      }
    } catch (error) {
      //console.error('Error al actualizar el gasto:', error)
      toast.error("Error de conexión");
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      const response = await fetch(`/api/expenses/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchData();
        toast.success("Gasto eliminado correctamente");
      } else {
        toast.error("Error al eliminar el gasto");
      }
    } catch (error) {
      //console.error('Error al eliminar el gasto:', error)
      toast.error("Error de conexión");
    }
  };

  const resetExpenseForm = () => {
    setNewExpense({
      name: "",
      description: "",
      amount: "",
      category: "",
      frequency: "MENSUAL",
      dueDate: "",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getFrequencyColor = (frequency: string) => {
    switch (frequency) {
      case "MENSUAL":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "ANUAL":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "UNICO":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 text-white rounded-xl w-full max-w-6xl max-h-[95vh] overflow-hidden border border-gray-800">
        {/* Encabezado */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800 bg-gradient-to-r from-green-900/50 to-emerald-900/50">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-2 rounded-lg">
              <Calculator className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                Gestión de Gastos y Ganancias
              </h2>
              <p className="text-sm text-gray-400">
                Administra tus gastos y calcula tus ganancias
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchData}
              className="text-gray-400 hover:text-white"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              ×
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[500px] flex-1">
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="h-8 w-8 animate-spin text-green-500" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Resumen de ganancias */}
                {profitData && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-gray-800 border-gray-700">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400">
                          Créditos Recargados
                        </CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-400">
                          {formatCurrency(profitData.revenue)}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gray-800 border-gray-700">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400">
                          Gastos
                        </CardTitle>
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-red-400">
                          {formatCurrency(profitData.expenses)}
                        </div>
                      </CardContent>
                    </Card>

                    <Card
                      className={`border-gray-700 ${
                        profitData.profits >= 0
                          ? "bg-gray-800"
                          : "bg-red-900/20"
                      }`}
                    >
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400">
                          Ganancias
                        </CardTitle>
                        <DollarSign
                          className={`h-4 w-4 ${
                            profitData.profits >= 0
                              ? "text-green-500"
                              : "text-red-500"
                          }`}
                        />
                      </CardHeader>
                      <CardContent>
                        <div
                          className={`text-2xl font-bold ${
                            profitData.profits >= 0
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          {formatCurrency(profitData.profits)}
                        </div>
                        <p
                          className={`text-xs mt-1 ${
                            profitData.profitMargin >= 0
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          {profitData.profitMargin.toFixed(1)}% margen
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Acciones */}
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">
                    Lista de Gastos
                  </h3>
                  <Dialog
                    open={isCreateExpenseOpen}
                    onOpenChange={setIsCreateExpenseOpen}
                  >
                    <DialogTrigger asChild>
                      <Button className="bg-green-600 hover:bg-green-700">
                        <Plus className="h-4 w-4 mr-2" />
                        Nuevo Gasto
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-gray-900 border-gray-700 text-white">
                      <DialogHeader>
                        <DialogTitle>Crear Nuevo Gasto</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="name">Nombre</Label>
                          <Input
                            id="name"
                            value={newExpense.name}
                            onChange={(e) =>
                              setNewExpense({
                                ...newExpense,
                                name: e.target.value,
                              })
                            }
                            className="bg-gray-800 border-gray-600"
                            placeholder="Ej: Hosting mensual"
                          />
                        </div>
                        <div>
                          <Label htmlFor="description">
                            Descripción (opcional)
                          </Label>
                          <Textarea
                            id="description"
                            value={newExpense.description}
                            onChange={(e) =>
                              setNewExpense({
                                ...newExpense,
                                description: e.target.value,
                              })
                            }
                            className="bg-gray-800 border-gray-600"
                            placeholder="Descripción del gasto"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="amount">Monto</Label>
                            <Input
                              id="amount"
                              type="number"
                              value={newExpense.amount}
                              onChange={(e) =>
                                setNewExpense({
                                  ...newExpense,
                                  amount: e.target.value,
                                })
                              }
                              className="bg-gray-800 border-gray-600"
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <Label htmlFor="category">Categoría</Label>
                            <Select
                              value={newExpense.category}
                              onValueChange={(value) =>
                                setNewExpense({
                                  ...newExpense,
                                  category: value,
                                })
                              }
                            >
                              <SelectTrigger className="bg-gray-800 border-gray-600">
                                <SelectValue placeholder="Seleccionar" />
                              </SelectTrigger>
                              <SelectContent className="bg-gray-800 border-gray-600">
                                {CATEGORIES.map((category) => (
                                  <SelectItem key={category} value={category}>
                                    {category}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="frequency">Frecuencia</Label>
                            <Select
                              value={newExpense.frequency}
                              onValueChange={(value: any) =>
                                setNewExpense({
                                  ...newExpense,
                                  frequency: value,
                                })
                              }
                            >
                              <SelectTrigger className="bg-gray-800 border-gray-600">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-gray-800 border-gray-600">
                                {FREQUENCIES.map((freq) => (
                                  <SelectItem
                                    key={freq.value}
                                    value={freq.value}
                                  >
                                    {freq.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="dueDate">
                              Fecha de vencimiento (opcional)
                            </Label>
                            <Input
                              id="dueDate"
                              type="date"
                              value={newExpense.dueDate}
                              onChange={(e) =>
                                setNewExpense({
                                  ...newExpense,
                                  dueDate: e.target.value,
                                })
                              }
                              className="bg-gray-800 border-gray-600"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            onClick={() => setIsCreateExpenseOpen(false)}
                          >
                            Cancelar
                          </Button>
                          <Button
                            onClick={handleCreateExpense}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Crear Gasto
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Lista de gastos */}
                <div className="space-y-3">
                  {expenses.length === 0 ? (
                    <Card className="bg-gray-800 border-gray-700">
                      <CardContent className="p-6 text-center">
                        <AlertCircle className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                        <p className="text-gray-400">
                          No hay gastos registrados
                        </p>
                        <p className="text-sm text-gray-500 mt-2">
                          Crea tu primer gasto para empezar a gestionar tus
                          finanzas
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    expenses.map((expense) => (
                      <Card
                        key={expense.id}
                        className="bg-gray-800 border-gray-700"
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <h4 className="font-medium text-white">
                                  {expense.name}
                                </h4>
                                <Badge
                                  className={getFrequencyColor(
                                    expense.frequency,
                                  )}
                                >
                                  {
                                    FREQUENCIES.find(
                                      (f) => f.value === expense.frequency,
                                    )?.label
                                  }
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className="border-gray-600 text-gray-400"
                                >
                                  {expense.category}
                                </Badge>
                              </div>
                              {expense.description && (
                                <p className="text-sm text-gray-400 mt-1">
                                  {expense.description}
                                </p>
                              )}
                              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                                <span>{formatCurrency(expense.amount)}</span>
                                {expense.dueDate && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(
                                      expense.dueDate,
                                    ).toLocaleDateString("es-CO")}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingExpense(expense)}
                                className="text-blue-400 hover:text-blue-300"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteExpense(expense.id)}
                                className="text-red-400 hover:text-red-300"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Editar dialogo de gastos */}
      <Dialog
        open={!!editingExpense}
        onOpenChange={() => setEditingExpense(null)}
      >
        <DialogContent className="bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Editar Gasto</DialogTitle>
          </DialogHeader>
          {editingExpense && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Nombre</Label>
                <Input
                  id="edit-name"
                  value={editingExpense.name}
                  onChange={(e) =>
                    setEditingExpense({
                      ...editingExpense,
                      name: e.target.value,
                    })
                  }
                  className="bg-gray-800 border-gray-600"
                />
              </div>
              <div>
                <Label htmlFor="edit-description">Descripción</Label>
                <Textarea
                  id="edit-description"
                  value={editingExpense.description || ""}
                  onChange={(e) =>
                    setEditingExpense({
                      ...editingExpense,
                      description: e.target.value,
                    })
                  }
                  className="bg-gray-800 border-gray-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-amount">Monto</Label>
                  <Input
                    id="edit-amount"
                    type="number"
                    value={editingExpense.amount}
                    onChange={(e) =>
                      setEditingExpense({
                        ...editingExpense,
                        amount: parseFloat(e.target.value),
                      })
                    }
                    className="bg-gray-800 border-gray-600"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-category">Categoría</Label>
                  <Select
                    value={editingExpense.category}
                    onValueChange={(value) =>
                      setEditingExpense({ ...editingExpense, category: value })
                    }
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600">
                      {CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-frequency">Frecuencia</Label>
                  <Select
                    value={editingExpense.frequency}
                    onValueChange={(value: any) =>
                      setEditingExpense({ ...editingExpense, frequency: value })
                    }
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600">
                      {FREQUENCIES.map((freq) => (
                        <SelectItem key={freq.value} value={freq.value}>
                          {freq.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-dueDate">Fecha de vencimiento</Label>
                  <Input
                    id="edit-dueDate"
                    type="date"
                    value={
                      editingExpense.dueDate
                        ? new Date(editingExpense.dueDate)
                            .toISOString()
                            .split("T")[0]
                        : ""
                    }
                    onChange={(e) =>
                      setEditingExpense({
                        ...editingExpense,
                        dueDate: e.target.value,
                      })
                    }
                    className="bg-gray-800 border-gray-600"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEditingExpense(null)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleUpdateExpense}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Actualizar Gasto
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
