"use client";

import { useState, useEffect, useCallback } from "react";
import { Headphones, X, MessageSquare, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SupportContact {
  id: string;
  name: string;
  number: string;
  type: string;
  description?: string;
  isActive: boolean;
  order: number;
}

export function SupportBubble() {
  const [supportContacts, setSupportContacts] = useState<SupportContact[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Obtener contactos de soporte
  useEffect(() => {
    const fetchSupportContacts = async () => {
      try {
        const response = await fetch("/api/support-contacts");
        if (response.ok) {
          const data = await response.json();
          setSupportContacts(data.contacts || []);
        }
      } catch (error) {
        /* logger.error(
          { err: error },
          "Error al obtener los contactos de soporte",
        ); */
      }
    };

    fetchSupportContacts();
  }, []);

  // Cerrar cuando se hace clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const bubble = document.getElementById("support-bubble");

      if (bubble && !bubble.contains(target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Calcular contactos activos y ordenarlos
  const activeContacts = supportContacts
    .filter((contact) => contact.isActive)
    .sort((a, b) => a.order - b.order);

  // Manejar clic en un contacto
  const handleContactClick = useCallback((contact: SupportContact) => {
    let url = "";
    if (contact.type === "whatsapp") {
      const cleanNumber = contact.number.replace(/[^\d+]/g, "");
      url = `https://wa.me/${cleanNumber}`;
    } else if (contact.type === "telegram") {
      url = `https://t.me/${contact.number.replace("@", "")}`;
    } else {
      url = `tel:${contact.number}`;
    }
    window.open(url, "_blank");
    setIsOpen(false);
  }, []);

  // Si no hay contactos activos, no mostrar nada
  if (activeContacts.length === 0) {
    return null;
  }

  return (
    <div id="support-bubble" className="fixed bottom-6 right-6 z-50">
      {/* Dropdown de contactos */}
      {isOpen && (
        <div className="absolute bottom-20 right-0 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r  from-emerald-500 via-teal-600 to-cyan-700 ">
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <Headphones className="w-5 h-5 text-white" />
                </div>
                <div className="text-white">
                  <h3 className="text-white font-semibold">
                    Contacto y soporte
                  </h3>
                  <p className="text-emerald-100 text-xs">
                    Contacta con nosotros
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-red-500/15 backdrop-blur-md border border-red-500/20 hover:bg-red-500/30 flex items-center justify-center transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {/* Lista de contactos */}
          <div className="max-h-96 overflow-y-auto p-3 space-y-2">
            {activeContacts.map((contact) => (
              <div
                key={contact.id}
                onClick={() => handleContactClick(contact)}
                className="bg-slate-700 rounded-lg p-3 border border-slate-600 hover:bg-slate-600 hover:border-emerald-500/50 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-xl">
                      {contact.type === "whatsapp"
                        ? "💬"
                        : contact.type === "phone"
                          ? "📞"
                          : contact.type === "telegram"
                            ? "✈️"
                            : "💬"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-white font-semibold truncate">
                        {contact.name}
                      </h4>
                      <Badge className="bg-emerald-600/20 text-emerald-300 text-xs flex-shrink-0">
                        {contact.type === "whatsapp"
                          ? "WhatsApp"
                          : contact.type === "phone"
                            ? "Teléfono"
                            : contact.type === "telegram"
                              ? "Telegram"
                              : "SMS"}
                      </Badge>
                    </div>
                    <p className="text-emerald-400 font-medium text-sm mb-1">
                      {contact.number}
                    </p>
                    {contact.description && (
                      <p className="text-slate-400 text-xs truncate">
                        {contact.description}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    className={`flex-shrink-0 ${
                      contact.type === "whatsapp"
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleContactClick(contact);
                    }}
                  >
                    {contact.type === "whatsapp" ? (
                      <MessageSquare className="w-4 h-4" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-700 p-3">
            <p className="text-center text-slate-400 text-xs">
              Selecciona un medio de contacto para iniciar el chat
            </p>
          </div>
        </div>
      )}

      {/* Botón de burbuja */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative w-12 h-12 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 ${
          isOpen
            ? "bg-gradient-to-r from-red-500/20 to-orange-600/20 border border-red-500/30  text-red-300 hover:text-red-200 transition-all duration-300 hover:scale-100"
            : "bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 transition-all duration-300 hover:scale-100"
        }`}
      >
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center border-2 border-slate-900">
          <span className="text-white text-xs font-bold">
            {activeContacts.length}
          </span>
        </div>
        {isOpen ? (
          <X className="w-7 h-7 text-white" />
        ) : (
          <Headphones className="w-7 h-7 text-white" />
        )}
      </button>
    </div>
  );
}
