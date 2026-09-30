"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { supabase } from "../lib/supabase";
import StatsCard from "./components/StatsCard";
import InvoiceCard from "./components/InvoiceCard";

type Invoice = {
  id: string;
  month: string;
  total_amount: number;
  status: "pending" | "paid";
  created_at: string;
  paid_at?: string | null;

  reference_code?: string | null;
  bkash_trxid?: string | null;
  payment_method?: string | null;

  leases?: {
    units?: {
      unit_name: string;

      properties?: {
        name: string;
      } | null;
    } | null;

    tenants?: {
      name: string;
    } | null;
  } | null;
};

type Stats = {
  total: number;
  due: number;
  paid: number;
};

export default function Home() {
  const [invoices, setInvoices] =
    useState<Invoice[]>([]);

  const [stats, setStats] =
    useState<Stats>({
      total: 0,
      due: 0,
      paid: 0,
    });

  const [loading, setLoading] =
    useState(true);

  const [updatingId, setUpdatingId] =
    useState<string | null>(null);

  const [errorMessage, setErrorMessage] =
    useState("");

  const calculateStats = useCallback(
    (data: Invoice[]) => {
      let due = 0;
      let paid = 0;

      data.forEach((invoice) => {
        const amount =
          Number(invoice.total_amount) || 0;

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
    },
    []
  );

  const fetchInvoices = useCallback(
    async () => {
      setLoading(true);
      setErrorMessage("");

      const { data, error } =
        await supabase
          .from("invoices")
          .select(
            `
              id,
              month,
              total_amount,
              status,
              created_at,
              paid_at,
              reference_code,
              bkash_trxid,
              payment_method,
              leases (
                units (
                  unit_name,
                  properties (
                    name
                  )
                ),
                tenants (
                  name
                )
              )
            `
          )
          .order("created_at", {
            ascending: false,
          });

      if (error) {
        console.error(
          "Invoice fetch error:",
          error
        );

        setInvoices([]);

        setStats({
          total: 0,
          due: 0,
          paid: 0,
        });

        setErrorMessage(
          "Invoice data লোড করা যায়নি।"
        );

        setLoading(false);
        return;
      }

      const list =
        (data ?? []) as unknown as Invoice[];

      setInvoices(list);
      calculateStats(list);
      setLoading(false);
    },
    [calculateStats]
  );

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const markAsPaid = async (
    id: string
  ) => {
    const invoice =
      invoices.find(
        (item) => item.id === id
      );

    if (!invoice) {
      return;
    }

    if (invoice.status === "paid") {
      return;
    }

    const trx =
      prompt("bKash TrxID লিখো:");

    const cleanedTrx =
      trx?.trim().toUpperCase();

    if (
      !cleanedTrx ||
      cleanedTrx.length < 6
    ) {
      return;
    }

    setUpdatingId(id);
    setErrorMessage("");

    const paidAt =
      new Date().toISOString();

    const { error } =
      await supabase
        .from("invoices")
        .update({
          status: "paid",
          bkash_trxid: cleanedTrx,
          paid_at: paidAt,
        })
        .eq("id", id);

    if (error) {
      console.error(
        "Payment update error:",
        error
      );

      setErrorMessage(
        "Payment Confirm করা যায়নি। আবার চেষ্টা করুন।"
      );

      setUpdatingId(null);
      return;
    }

    setInvoices((currentInvoices) => {
      const updatedInvoices =
        currentInvoices.map(
          (currentInvoice) =>
            currentInvoice.id === id
              ? {
                  ...currentInvoice,
                  status: "paid" as const,
                  bkash_trxid:
                    cleanedTrx,
                  paid_at: paidAt,
                }
              : currentInvoice
        );

      calculateStats(updatedInvoices);

      return updatedInvoices;
    });

    setUpdatingId(null);
  };

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-4xl">

        {/* Header */}
        <h1 className="mb-6 text-2xl font-bold">
          🏠 Basha Manager
        </h1>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatsCard
            title="মোট আদায়"
            amount={stats.paid}
            color="text-green-600"
          />

          <StatsCard
            title="বাকি"
            amount={stats.due}
            color="text-red-600"
          />

          <StatsCard
            title="মোট বিল"
            amount={stats.total}
            color="text-gray-900"
          />
        </div>

        {/* Error */}
        {errorMessage && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {/* Invoice list */}
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
                কোনো invoice পাওয়া যায়নি।
              </p>
            </div>
          ) : (
            invoices.map((invoice) => (
              <InvoiceCard
                key={invoice.id}
                id={invoice.id}
                month={invoice.month}
                total_amount={invoice.total_amount}
                status={invoice.status}
                reference_code={
                  invoice.reference_code
                }
                bkash_trxid={
                  invoice.bkash_trxid
                }
                tenantName={
                  invoice.leases?.tenants?.name
                }
                unitName={
                  invoice.leases?.units?.unit_name
                }
                propertyName={
                  invoice.leases?.units?.properties?.name
                }
                onPay={markAsPaid}
                isPaying={
                  updatingId === invoice.id
                }
              />
            ))
          )}
        </div>
      </div>
    </main>
  );
}