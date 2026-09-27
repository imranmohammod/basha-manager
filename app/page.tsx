"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Invoice = {
  id: string | number;
  month: string;
  total_amount: number;
  status: string;
  leases?: {
    monthly_rent: number;
    units?: {
      unit_name: string;
      properties?: {
        name: string;
      };
    };
    tenants?: {
      name: string;
      phone: string;
    };
  };
};

type Stats = {
  total: number;
  due: number;
  paid: number;
};

export default function Home() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    due: 0,
    paid: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInvoices() {
      setLoading(true);

      const { data, error } = await supabase
        .from("invoices")
        .select(`
          *,
          leases (
            monthly_rent,
            units (
              unit_name,
              properties (name)
            ),
            tenants (
              name,
              phone
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Invoice fetch error:", error);

        setInvoices([]);
        setStats({
          total: 0,
          due: 0,
          paid: 0,
        });

        setLoading(false);
        return;
      }

      const invoiceData = (data ?? []) as Invoice[];

      setInvoices(invoiceData);

      let due = 0;
      let paid = 0;

      invoiceData.forEach((invoice) => {
        const amount = Number(invoice.total_amount) || 0;

        if (invoice.status === "pending") {
          due += amount;
        } else if (invoice.status === "paid") {
          paid += amount;
        }
      });

      setStats({
        total: due + paid,
        due,
        paid,
      });

      setLoading(false);
    }

    fetchInvoices();
  }, []);

  async function markAsPaid(id: string | number) {
    const trx = prompt("bKash TrxID লিখো:");

    if (!trx?.trim()) {
      return;
    }

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
      return;
    }

    // Update the invoice locally after successful payment.
    setInvoices((currentInvoices) =>
      currentInvoices.map((invoice) =>
        invoice.id === id
          ? { ...invoice, status: "paid" }
          : invoice
      )
    );

    // Recalculate statistics.
    setStats((currentStats) => {
      const invoice = invoices.find((item) => item.id === id);

      if (!invoice) {
        return currentStats;
      }

      const amount = Number(invoice.total_amount) || 0;

      return {
        total: currentStats.total,
        due: Math.max(0, currentStats.due - amount),
        paid: currentStats.paid + amount,
      };
    });
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-2xl font-bold">
          🏠 Basha Manager
        </h1>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-white p-4 shadow">
            <p className="text-sm text-gray-500">
              মোট আদায়
            </p>

            <p className="text-xl font-bold text-green-600">
              {stats.paid.toLocaleString()} ৳
            </p>
          </div>

          <div className="rounded-xl bg-white p-4 shadow">
            <p className="text-sm text-gray-500">
              বাকি
            </p>

            <p className="text-xl font-bold text-red-600">
              {stats.due.toLocaleString()} ৳
            </p>
          </div>

          <div className="rounded-xl bg-white p-4 shadow">
            <p className="text-sm text-gray-500">
              মোট বিল
            </p>

            <p className="text-xl font-bold">
              {stats.total.toLocaleString()} ৳
            </p>
          </div>
        </div>

        {/* Invoice List */}
        <div className="space-y-3">
          {loading ? (
            <div className="rounded-xl bg-white p-6 text-center shadow">
              <p className="text-gray-500">
                Invoice loading হচ্ছে...
              </p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="rounded-xl bg-white p-6 text-center shadow">
              <p className="text-gray-500">
                কোনো invoice পাওয়া যায়নি।
              </p>
            </div>
          ) : (
            invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between rounded-xl bg-white p-4 shadow"
              >
                <div>
                  <p className="font-bold">
                    {invoice.leases?.tenants?.name ?? "Unknown Tenant"}
                    {" - "}
                    {invoice.leases?.units?.unit_name ?? "Unknown Unit"}
                  </p>

                  <p className="text-sm text-gray-500">
                    {invoice.month} -{" "}
                    {Number(invoice.total_amount).toLocaleString()} ৳
                  </p>

                  <span
                    className={`mt-2 inline-block rounded px-2 py-1 text-xs ${
                      invoice.status === "paid"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {invoice.status}
                  </span>
                </div>

                {invoice.status === "pending" && (
                  <button
                    onClick={() => markAsPaid(invoice.id)}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
                  >
                    Paid করো
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

