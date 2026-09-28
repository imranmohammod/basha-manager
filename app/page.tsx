"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

// Types
type Property = {
  name: string;
};

type Unit = {
  unit_name: string;
  properties?: Property | null;
};

type Tenant = {
  name: string;
  phone: string;
};

type Lease = {
  monthly_rent: number;
  units?: Unit | null;
  tenants?: Tenant | null;
};

type Invoice = {
  id: string;
  month: string;
  total_amount: number;
  status: "pending" | "paid";
  bkash_trxid?: string | null;
  paid_at?: string | null;
  created_at: string;
  leases?: Lease | null;
};

type Stats = {
  total: number;
  due: number;
  paid: number;
};

export default function Home() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, due: 0, paid: 0 });
  const [loading, setLoading] = useState<boolean>(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const calculateStats = useCallback((data: Invoice[]) => {
    let due = 0;
    let paid = 0;
    data.forEach((inv) => {
      const amount = Number(inv.total_amount) || 0;
      if (inv.status === "pending") due += amount;
      else if (inv.status === "paid") paid += amount;
    });
    setStats({ total: due + paid, due, paid });
  }, []);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
     .from("invoices")
     .select(`
        id,
        month,
        total_amount,
        status,
        created_at,
        bkash_trxid,
        paid_at,
        leases (
          monthly_rent,
          units ( unit_name, properties ( name ) ),
          tenants ( name, phone )
        )
      `)
     .order("created_at", { ascending: false });

    if (error) {
      console.error("Invoice fetch error:", error);
      setInvoices([]);
      setStats({ total: 0, due: 0, paid: 0 });
      setLoading(false);
      return;
    }

    const invoiceData = (data as unknown as Invoice[])?? [];
    setInvoices(invoiceData);
    calculateStats(invoiceData);
    setLoading(false);
  }, [calculateStats]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const markAsPaid = async (id: string) => {
    const trx = prompt("bKash TrxID লিখো (কমপক্ষে 6 অক্ষর):");
    if (!trx || trx.trim().length < 5) {
      if (trx!== null) alert("সঠিক TrxID দাও");
      return;
    }

    setUpdatingId(id);
    const { error } = await supabase
     .from("invoices")
     .update({
        status: "paid",
        bkash_trxid: trx.trim(),
        paid_at: new Date().toISOString(),
      })
     .eq("id", id);

    if (error) {
      console.error("Payment update error:", error);
      alert("Payment update করা যায়নি। আবার চেষ্টা করুন।");
      setUpdatingId(null);
      return;
    }

    // Optimistic update + recalculate
    setInvoices((current) => {
      const updated = current.map((inv) =>
        inv.id === id? {...inv, status: "paid" as const, bkash_trxid: trx.trim() } : inv
      );
      calculateStats(updated);
      return updated;
    });
    setUpdatingId(null);
  };

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-2xl font-bold">🏠 Basha Manager</h1>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-white p-4 shadow">
            <p className="text-sm text-gray-500">মোট আদায়</p>
            <p className="text-xl font-bold text-green-600">{stats.paid.toLocaleString("bn-BD")} ৳</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow">
            <p className="text-sm text-gray-500">বাকি</p>
            <p className="text-xl font-bold text-red-600">{stats.due.toLocaleString("bn-BD")} ৳</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow">
            <p className="text-sm text-gray-500">মোট বিল</p>
            <p className="text-xl font-bold">{stats.total.toLocaleString("bn-BD")} ৳</p>
          </div>
        </div>

        <div className="space-y-3">
          {loading? (
            <div className="rounded-xl bg-white p-6 text-center shadow">Loading...</div>
          ) : invoices.length === 0? (
            <div className="rounded-xl bg-white p-6 text-center shadow">কোনো invoice পাওয়া যায়নি।</div>
          ) : (
            invoices.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow">
                <div>
                  <p className="font-bold">
                    {invoice.leases?.tenants?.name?? "Unknown"} - {invoice.leases?.units?.unit_name?? "Unit"}
                  </p>
                  <p className="text-sm text-gray-500">
                    {invoice.leases?.units?.properties?.name?? ""} | {invoice.month} - {Number(invoice.total_amount).toLocaleString()} ৳
                  </p>
                  <span className={`mt-2 inline-block rounded px-2 py-1 text-xs ${invoice.status === "paid"? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {invoice.status}
                  </span>
                </div>
                {invoice.status === "pending" && (
                  <button
                    disabled={updatingId === invoice.id}
                    onClick={() => markAsPaid(invoice.id)}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {updatingId === invoice.id? "Wait..." : "Paid করো"}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}