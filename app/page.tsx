"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import StatsCard from "./components/StatsCard";
import InvoiceCard from "./components/InvoiceCard";

type Invoice = {
  id: string;
  month: string;
  total_amount: number;
  status: "pending" | "paid";
  created_at: string;
  leases?: {
    units?: { unit_name: string; properties?: { name: string } | null } | null;
    tenants?: { name: string } | null;
  } | null;
};

type Stats = { total: number; due: number; paid: number };

export default function Home() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, due: 0, paid: 0 });
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const calculateStats = useCallback((data: Invoice[]) => {
    let due = 0, paid = 0;
    data.forEach((inv) => {
      const amt = Number(inv.total_amount) || 0;
      if (inv.status === "pending") due += amt;
      else paid += amt;
    });
    setStats({ total: due + paid, due, paid });
  }, []);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("invoices").select(`id, month, total_amount, status, created_at, leases(units(unit_name, properties(name)), tenants(name))`).order("created_at", { ascending: false });
    const list = (data as unknown as Invoice[])?? [];
    setInvoices(list);
    calculateStats(list);
    setLoading(false);
  }, [calculateStats]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const markAsPaid = async (id: string) => {
    const trx = prompt("bKash TrxID লিখো:");
    if (!trx || trx.trim().length < 5) return;
    setUpdatingId(id);
    const { error } = await supabase.from("invoices").update({ status: "paid", bkash_trxid: trx.trim(), paid_at: new Date().toISOString() }).eq("id", id);
    if (!error) {
      setInvoices((cur) => {
        const updated = cur.map((inv) => inv.id === id? {...inv, status: "paid" as const } : inv);
        calculateStats(updated);
        return updated;
      });
    }
    setUpdatingId(null);
  };

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-2xl font-bold">🏠 Basha Manager</h1>
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatsCard title="মোট আদায়" amount={stats.paid} color="text-green-600" />
          <StatsCard title="বাকি" amount={stats.due} color="text-red-600" />
          <StatsCard title="মোট বিল" amount={stats.total} color="text-gray-900" />
        </div>
        <div className="space-y-3">
          {loading? <div className="rounded-xl bg-white p-6 text-center shadow">Loading...</div> :
            invoices.map((inv) => (
              <InvoiceCard
                key={inv.id}
                id={inv.id}
                month={inv.month}
                total_amount={inv.total_amount}
                status={inv.status}
                tenantName={inv.leases?.tenants?.name}
                unitName={inv.leases?.units?.unit_name}
                propertyName={inv.leases?.units?.properties?.name}
                onPay={markAsPaid}
                isPaying={updatingId === inv.id}
              />
            ))}
        </div>
      </div>
    </main>
  );
}