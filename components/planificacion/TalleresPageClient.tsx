"use client";

import { useState } from "react";
import { TalleresCrud } from "./TalleresCrud";
import { CalendarioAnualConfig } from "./CalendarioAnualConfig";

type Tab = "catalogo" | "calendario";

export function TalleresPageClient() {
  const [activeTab, setActiveTab] = useState<Tab>("catalogo");

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("catalogo")}
          className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === "catalogo"
              ? "border-slate-900 text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Catalogo Base
          <span className="ml-2 text-xs text-slate-400">(20 slots fijos)</span>
        </button>
        <button
          onClick={() => setActiveTab("calendario")}
          className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === "calendario"
              ? "border-slate-900 text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Calendario Anual
          <span className="ml-2 text-xs text-slate-400">(semanas normal/intensiva)</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "catalogo" && <TalleresCrud />}
      {activeTab === "calendario" && <CalendarioAnualConfig />}
    </div>
  );
}
