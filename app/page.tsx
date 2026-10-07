"use client";

import { useCallback, useEffect, useState } from "react";

import { supabase } from "../lib/supabase";
import StatsCard from "./components/StatsCard";
import InvoiceCard from "./components/InvoiceCard";

type Invoice = {
  id: string;
  month: string;
  total_amount: number;
  status: "pending" | "verification" | "paid";
  created_at: string;

  paid_at?: string | null;
  submitted_at?: string | null;
  verified_at?: string | null;
  verified_by?: string | null;
  rejection_reason?: string | null;

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
      phone?: string;
    } | null;
  } | null;
};

type Stats = {
  total: number;
  due: number;
  paid: number;
  verification: number;
};

export default function Home() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const [stats, setStats] = useState<Stats>({
    total: 0,
    due: 0,
    paid: 0,
    verification: 0,
  });

  const [loading, setLoading] = useState(true);

  const [processingId, setProcessingId] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState("");

  // =========================
  // CALCULATE STATS
  // =========================

  const calculateStats = useCallback((data: Invoice[]) => {
    let due = 0;
    let paid = 0;
    let verification = 0;

    data.forEach((invoice) => {
      const amount = Number(invoice.total_amount) || 0;

      if (invoice.status === "pending") {
        due += amount;
      }

      if (invoice.status === "verification") {
        verification += 1;
      }

      if (invoice.status === "paid") {
        paid += amount;
      }
    });

    setStats({
      total: due + paid,
      due,
      paid,
      verification,
    });
  }, []);

  // =========================
  // FETCH INVOICES
  // =========================

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("invoices")
      .select(
        `
            id,
            month,
            total_amount,
            status,
            created_at,
            paid_at,
            submitted_at,
            verified_at,
            verified_by,
            rejection_reason,
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
                name,
                phone
              )
            )
          `,
      )
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error("Invoice fetch error:", error);

      setInvoices([]);

      setStats({
        total: 0,
        due: 0,
        paid: 0,
        verification: 0,
      });

      setErrorMessage("Invoice data লোড করা যায়নি।");

      setLoading(false);
      return;
    }

    const list = (data ?? []) as unknown as Invoice[];

    setInvoices(list);
    calculateStats(list);
    setLoading(false);
  }, [calculateStats]);

  // =========================
  // INITIAL LOAD
  // =========================

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // =========================
  // APPROVE PAYMENT
  // =========================

  const approvePayment = async (id: string) => {
    const invoice = invoices.find((item) => item.id === id);

    if (!invoice) {
      return;
    }

    if (invoice.status !== "verification") {
      return;
    }

    const confirmed = window.confirm("এই payment verify করে Paid করতে চান?");

    if (!confirmed) {
      return;
    }

    setProcessingId(id);
    setErrorMessage("");

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("invoices")
      .update({
        status: "paid",
        paid_at: now,
        verified_at: now,
        verified_by: "admin",
        rejection_reason: null,
      })
      .eq("id", id)
      .eq("status", "verification");

    if (error) {
      console.error("Approve payment error:", error);

      setErrorMessage("Payment approve করা যায়নি। আবার চেষ্টা করুন।");

      setProcessingId(null);
      return;
    }

    setInvoices((currentInvoices) => {
      const updatedInvoices = currentInvoices.map((currentInvoice) =>
        currentInvoice.id === id
          ? {
              ...currentInvoice,
              status: "paid" as const,
              paid_at: now,
              verified_at: now,
              verified_by: "admin",
              rejection_reason: null,
            }
          : currentInvoice,
      );

      calculateStats(updatedInvoices);

      return updatedInvoices;
    });

    setProcessingId(null);
  };

  // =========================
  // REJECT PAYMENT
  // =========================

  const rejectPayment = async (id: string) => {
    const invoice = invoices.find((item) => item.id === id);

    if (!invoice) {
      return;
    }

    if (invoice.status !== "verification") {
      return;
    }

    const reason = window.prompt("Payment reject করার কারণ লিখুন:");

    const cleanedReason = reason?.trim();

    if (!cleanedReason) {
      return;
    }

    setProcessingId(id);
    setErrorMessage("");

    const verifiedAt = new Date().toISOString();

    const { error } = await supabase
      .from("invoices")
      .update({
        status: "pending",
        rejection_reason: cleanedReason,
        verified_at: verifiedAt,
        verified_by: "admin",
      })
      .eq("id", id)
      .eq("status", "verification");

    if (error) {
      console.error("Reject payment error:", error);

      setErrorMessage("Payment reject করা যায়নি। আবার চেষ্টা করুন।");

      setProcessingId(null);
      return;
    }

    setInvoices((currentInvoices) => {
      const updatedInvoices = currentInvoices.map((currentInvoice) =>
        currentInvoice.id === id
          ? {
              ...currentInvoice,
              status: "pending" as const,
              rejection_reason: cleanedReason,
              verified_at: verifiedAt,
              verified_by: "admin",
            }
          : currentInvoice,
      );

      calculateStats(updatedInvoices);

      return updatedInvoices;
    });

    setProcessingId(null);
  };

  // =========================
  // MANUAL MARK AS PAID
  // =========================

  const markAsPaid = async (id: string) => {
    const invoice = invoices.find((item) => item.id === id);

    if (!invoice) {
      return;
    }

    if (invoice.status === "paid") {
      return;
    }

    const trxId = window.prompt("bKash TrxID দিন:");

    if (trxId === null) {
      return;
    }

    const cleanedTrxId = trxId.trim().toUpperCase();

    if (!cleanedTrxId) {
      setErrorMessage("TrxID দিতে হবে।");
      return;
    }

    const confirmed = window.confirm("এই invoice-টি সরাসরি Paid করতে চান?");

    if (!confirmed) {
      return;
    }

    setProcessingId(id);
    setErrorMessage("");

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("invoices")
      .update({
        status: "paid",
        bkash_trxid: cleanedTrxId,
        paid_at: now,
        verified_at: now,
        verified_by: "admin",
        rejection_reason: null,
      })
      .eq("id", id)
      .eq("status", "pending");

    if (error) {
      console.error("Mark as paid error:", error);

      setErrorMessage("Invoice Paid করা যায়নি। আবার চেষ্টা করুন।");

      setProcessingId(null);
      return;
    }

    setInvoices((currentInvoices) => {
      const updatedInvoices = currentInvoices.map((currentInvoice) =>
        currentInvoice.id === id
          ? {
              ...currentInvoice,
              status: "paid" as const,
              bkash_trxid: cleanedTrxId,
              paid_at: now,
              verified_at: now,
              verified_by: "admin",
              rejection_reason: null,
            }
          : currentInvoice,
      );

      calculateStats(updatedInvoices);

      return updatedInvoices;
    });

    setProcessingId(null);
  };

  // =========================
  // PAYMENT LINK
  // =========================

  // PAYMENT LINK - Upgraded
  const handlePay = (invoice: Invoice) => {
    const payId = invoice.reference_code || invoice.id;
    window.open(`/pay/${payId}`, "_blank", "noopener,noreferrer");
  };

  // =========================
  // GROUPED VIEW - Same Table View
  // =========================
  const verificationInvoices = invoices.filter(
    (i) => i.status === "verification",
  );
  const pendingInvoices = invoices.filter((i) => i.status === "pending");
  const paidInvoices = invoices.filter((i) => i.status === "paid");

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-2xl font-bold">🏠 Basha Manager</h1>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatsCard
            title="মোট আদায়"
            amount={stats.paid}
            color="text-green-600"
          />
          <StatsCard title="বাকি" amount={stats.due} color="text-red-600" />
          <StatsCard
            title="মোট বিল"
            amount={stats.total}
            color="text-gray-900"
          />
          <StatsCard
            title="Verification"
            amount={stats.verification}
            color="text-blue-600"
            showCurrency={false}
          />
        </div>

        {errorMessage && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {loading ? (
          <div className="rounded-xl bg-white p-6 text-center shadow">
            <p className="text-gray-500">Invoice loading হচ্ছে...</p>
          </div>
        ) : (
          <>
            {verificationInvoices.length > 0 && (
              <div className="mb-8">
                <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-blue-700">
                  🔵 Payment Verification{" "}
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-sm">
                    {verificationInvoices.length}
                  </span>
                </h2>
                <div className="space-y-3">
                  {verificationInvoices.map((invoice) => (
                    <InvoiceCard
                      key={invoice.id}
                      id={invoice.id}
                      month={invoice.month}
                      total_amount={invoice.total_amount}
                      status={invoice.status}
                      reference_code={invoice.reference_code}
                      bkash_trxid={invoice.bkash_trxid}
                      submitted_at={invoice.submitted_at}
                      tenantName={invoice.leases?.tenants?.name}
                      unitName={invoice.leases?.units?.unit_name}
                      propertyName={invoice.leases?.units?.properties?.name}
                      onApprove={approvePayment}
                      onReject={rejectPayment}
                      isProcessing={processingId === invoice.id}
                      onPay={() => handlePay(invoice)}
                      isPaying={processingId === invoice.id}
                    />
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 className="mb-3 text-lg font-bold">All Invoices</h2>
              <div className="space-y-3">
                {invoices.length === 0 ? (
                  <div className="rounded-xl bg-white p-6 text-center shadow">
                    <p className="text-gray-500">কোনো invoice পাওয়া যায়নি।</p>
                  </div>
                ) : (
                  <>
                    {pendingInvoices.map((invoice) => (
                      <InvoiceCard
                        key={invoice.id}
                        id={invoice.id}
                        month={invoice.month}
                        total_amount={invoice.total_amount}
                        status={invoice.status}
                        reference_code={invoice.reference_code}
                        bkash_trxid={invoice.bkash_trxid}
                        submitted_at={invoice.submitted_at}
                        tenantName={invoice.leases?.tenants?.name}
                        unitName={invoice.leases?.units?.unit_name}
                        propertyName={invoice.leases?.units?.properties?.name}
                        onApprove={approvePayment}
                        onReject={rejectPayment}
                        isProcessing={processingId === invoice.id}
                        onPay={() => handlePay(invoice)}
                        isPaying={processingId === invoice.id}
                      />
                    ))}
                    {paidInvoices.map((invoice) => (
                      <InvoiceCard
                        key={invoice.id}
                        id={invoice.id}
                        month={invoice.month}
                        total_amount={invoice.total_amount}
                        status={invoice.status}
                        reference_code={invoice.reference_code}
                        bkash_trxid={invoice.bkash_trxid}
                        submitted_at={invoice.submitted_at}
                        tenantName={invoice.leases?.tenants?.name}
                        unitName={invoice.leases?.units?.unit_name}
                        propertyName={invoice.leases?.units?.properties?.name}
                        onApprove={approvePayment}
                        onReject={rejectPayment}
                        isProcessing={processingId === invoice.id}
                        onPay={() => handlePay(invoice)}
                        isPaying={processingId === invoice.id}
                      />
                    ))}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
