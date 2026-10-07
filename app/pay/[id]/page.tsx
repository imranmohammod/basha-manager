"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { supabase } from "../../../lib/supabase";

type PaymentMethod = "personal" | "gateway" | "cash";
type InvoiceStatus = "pending" | "verification" | "paid";

type Invoice = {
  id: string;
  month: string;
  rent_amount: number;
  utility_amount: number;
  total_amount: number;
  status: InvoiceStatus;

  bkash_trxid?: string | null;
  reference_code?: string | null;
  payment_method?: string | null;

  submitted_at?: string | null;
  verified_at?: string | null;
  verified_by?: string | null;
  rejection_reason?: string | null;
  paid_at?: string | null;

  leases?: {
    monthly_rent?: number;
    utility_fixed?: number;

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

export default function PayPage() {
  const params = useParams();

  const BKASH_NUMBER =
    process.env.NEXT_PUBLIC_BKASH_NUMBER || "017XX XXX XXX";

  const id = typeof params.id === "string" ? params.id : "";

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [method, setMethod] =
    useState<PaymentMethod>("personal");
  const [trxId, setTrxId] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function fetchInvoice() {
      if (!id) {
        setLoading(false);
        setErrorMessage("Invalid invoice ID.");
        return;
      }

      setLoading(true);
      setErrorMessage("");

      const isReferenceCode = id.startsWith("INV-");

      const selectQuery = `
        id,
        month,
        rent_amount,
        utility_amount,
        total_amount,
        status,
        bkash_trxid,
        reference_code,
        payment_method,
        submitted_at,
        verified_at,
        verified_by,
        rejection_reason,
        paid_at,
        leases (
          monthly_rent,
          utility_fixed,
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
      `;

      const query = supabase
        .from("invoices")
        .select(selectQuery);

      const { data, error } = isReferenceCode
        ? await query
            .eq("reference_code", id)
            .maybeSingle()
        : await query
            .eq("id", id)
            .maybeSingle();

      if (error) {
        console.error("Invoice fetch error:", error);

        setInvoice(null);
        setErrorMessage(
          "এই invoice-এর তথ্য পাওয়া যাচ্ছে না।"
        );
        setLoading(false);
        return;
      }

      if (!data) {
        setInvoice(null);
        setErrorMessage(
          "এই invoice-এর তথ্য পাওয়া যাচ্ছে না।"
        );
        setLoading(false);
        return;
      }

      const invoiceData =
        data as unknown as Invoice;

      setInvoice(invoiceData);
      setTrxId(invoiceData.bkash_trxid ?? "");

      if (
        invoiceData.payment_method === "personal" ||
        invoiceData.payment_method === "gateway" ||
        invoiceData.payment_method === "cash"
      ) {
        setMethod(invoiceData.payment_method);
      }

      setLoading(false);
    }

    fetchInvoice();
  }, [id]);

  async function handleConfirm() {
    if (!invoice) {
      return;
    }

    if (invoice.status === "paid") {
      setErrorMessage(
        "এই invoice ইতিমধ্যে paid হয়েছে।"
      );
      return;
    }

    if (invoice.status === "verification") {
      setErrorMessage(
        "এই payment ইতিমধ্যে verification-এর জন্য জমা হয়েছে।"
      );
      return;
    }

    if (method !== "personal") {
      setErrorMessage(
        "এই payment method এখনো চালু করা হয়নি।"
      );
      return;
    }

    const cleanedTrxId = trxId.trim().toUpperCase();

    if (!cleanedTrxId || cleanedTrxId.length < 6) {
      setErrorMessage("সঠিক bKash TrxID দিন।");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    const referenceCode =
      invoice.reference_code ??
      `INV-${invoice.id
        .replace(/-/g, "")
        .slice(0, 8)
        .toUpperCase()}`;

    const submittedAt =
      new Date().toISOString();

    const { data, error } = await supabase
      .from("invoices")
      .update({
        bkash_trxid: cleanedTrxId,
        reference_code: referenceCode,
        payment_method: "personal",
        status: "verification",
        submitted_at: submittedAt,
        rejection_reason: null,
      })
      .eq("id", invoice.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (error || !data) {
      console.error(
        "Payment submission error:",
        error
      );

      setErrorMessage(
        error
          ? "Payment information জমা দেওয়া যায়নি।"
          : "এই invoice-এর status পরিবর্তিত হয়েছে। Page refresh করুন।"
      );

      setSubmitting(false);
      return;
    }

    setInvoice((current) =>
      current
        ? {
            ...current,
            bkash_trxid: cleanedTrxId,
            reference_code: referenceCode,
            payment_method: "personal",
            status: "verification",
            submitted_at: submittedAt,
            rejection_reason: null,
          }
        : current
    );

    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f8f7f5]">
        <p className="text-sm text-zinc-500">
          Loading...
        </p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f8f7f5] p-4">
        <div className="w-full max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-50 text-xl text-red-600">
            !
          </div>

          <h2 className="mt-4 font-bold text-zinc-900">
            Invoice পাওয়া যায়নি
          </h2>

          <p className="mt-2 text-sm text-zinc-500">
            {errorMessage ||
              "এই invoice-এর তথ্য পাওয়া যাচ্ছে না।"}
          </p>

          <Link
            href="/"
            className="mt-6 inline-block rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white"
          >
            ড্যাশবোর্ডে ফিরে যান
          </Link>
        </div>
      </div>
    );
  }

  if (invoice.status === "verification") {
    const verificationReference =
      invoice.reference_code ??
      `INV-${invoice.id
        .replace(/-/g, "")
        .slice(0, 8)
        .toUpperCase()}`;

    return (
      <div className="grid min-h-screen place-items-center bg-[#f8f7f5] p-4">
        <div className="w-full max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-blue-50 text-xl text-blue-600">
            🔍
          </div>

          <h2 className="mt-4 font-bold text-zinc-900">
            Payment Verification চলছে
          </h2>

          <p className="mt-2 text-sm leading-6 text-zinc-500">
            আপনার TrxID সফলভাবে জমা হয়েছে। মালিক
            payment যাচাই করার পর invoice Paid হিসেবে
            দেখানো হবে।
          </p>

          <div className="mt-5 rounded-xl bg-zinc-50 p-4 text-left">
            <div className="flex justify-between gap-4">
              <span className="text-sm text-zinc-500">
                Reference
              </span>

              <span className="font-mono text-sm font-semibold text-zinc-900">
                {verificationReference}
              </span>
            </div>

            <div className="mt-2 flex justify-between gap-4">
              <span className="text-sm text-zinc-500">
                Amount
              </span>

              <span className="font-bold text-zinc-900">
                {Number(
                  invoice.total_amount
                ).toLocaleString("bn-BD")}{" "}
                ৳
              </span>
            </div>

            {invoice.bkash_trxid && (
              <div className="mt-2 flex justify-between gap-4">
                <span className="text-sm text-zinc-500">
                  TrxID
                </span>

                <span className="break-all font-mono text-sm font-semibold text-zinc-900">
                  {invoice.bkash_trxid}
                </span>
              </div>
            )}
          </div>

          <Link
            href="/"
            className="mt-6 inline-block text-sm font-medium text-zinc-600 underline underline-offset-4"
          >
            ড্যাশবোর্ডে ফিরে যান
          </Link>
        </div>
      </div>
    );
  }

  if (invoice.status === "paid") {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f8f7f5] p-4">
        <div className="w-full max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-green-50 text-xl text-green-600">
            ✓
          </div>

          <h2 className="mt-4 font-bold text-zinc-900">
            Payment সম্পন্ন হয়েছে
          </h2>

          <p className="mt-2 text-sm text-zinc-500">
            এই invoice-এর payment ইতিমধ্যে Confirm
            করা হয়েছে।
          </p>

          <Link
            href="/"
            className="mt-6 inline-block rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white"
          >
            ড্যাশবোর্ডে ফিরে যান
          </Link>
        </div>
      </div>
    );
  }

  const propertyName =
    invoice.leases?.units?.properties?.name ??
    "Basha";

  const unitName =
    invoice.leases?.units?.unit_name ??
    "Unknown Unit";

  const tenantName =
    invoice.leases?.tenants?.name ??
    "Unknown Tenant";

  const referenceCode =
    invoice.reference_code ??
    `INV-${invoice.id
      .replace(/-/g, "")
      .slice(0, 8)
      .toUpperCase()}`;

  return (
    <div className="min-h-screen bg-[#f8f7f5]">
      <div className="mx-auto max-w-md p-3 pb-8">
        <div className="rounded-2xl bg-zinc-900 p-5 text-white">
          <p className="text-xs font-medium uppercase tracking-widest text-white/60">
            নিরাপদ ভাড়া পেমেন্ট
          </p>

          <h1 className="mt-2 text-xl font-bold">
            {propertyName} - {unitName}
          </h1>

          <p className="mt-1 text-sm text-white/70">
            {invoice.month} • {tenantName}
          </p>

          <div className="mt-4 rounded-xl bg-white/10 p-3">
            <div className="flex justify-between">
              <span className="text-xs text-white/70">
                Reference
              </span>

              <span className="font-mono text-sm font-bold">
                {referenceCode}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-white/70">
                মোট দিতে হবে
              </span>

              <span className="text-lg font-bold">
                {Number(
                  invoice.total_amount
                ).toLocaleString("bn-BD")}{" "}
                ৳
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setMethod("personal")}
            className={`h-12 rounded-full border text-xs font-bold ${
              method === "personal"
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white text-zinc-700"
            }`}
          >
            bKash Personal
          </button>

          <button
            type="button"
            disabled
            className="h-12 rounded-full border border-zinc-200 bg-zinc-100 text-xs font-bold text-zinc-400"
          >
            Gateway
          </button>

          <button
            type="button"
            disabled
            className="h-12 rounded-full border border-zinc-200 bg-zinc-100 text-xs font-bold text-zinc-400"
          >
            Cash
          </button>
        </div>

        {errorMessage && (
          <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {invoice.rejection_reason && (
          <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-4">
            <p className="text-sm font-bold text-red-700">
              আগের payment submission reject করা হয়েছে
            </p>

            <p className="mt-1 text-sm text-red-600">
              কারণ: {invoice.rejection_reason}
            </p>
          </div>
        )}

        {method === "personal" && (
          <div className="mt-4 space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
            <div>
              <h3 className="font-bold text-zinc-900">
                bKash এ কিভাবে পাঠাবেন
              </h3>

              <p className="mt-1 text-xs text-zinc-500">
                Personal Send Money ব্যবহার করে payment
                করুন।
              </p>
            </div>

            <div className="space-y-3 text-sm leading-6 text-zinc-600">
              <p>
                <b>১.</b> আপনার bKash অ্যাপে লগইন করুন।
              </p>

              <p>
                <b>২.</b>{" "}
                <strong>Send Money</strong> করুন মালিকের
                bKash নম্বরে।
              </p>

              <div className="rounded-xl bg-yellow-50 p-3 text-center">
                <span className="font-mono font-bold text-zinc-900">
                  {BKASH_NUMBER}
                </span>
              </div>

              <p>
                <b>৩.</b> পুরো invoice amount একবারে
                পাঠান।
              </p>

              <p>
                <b>৪.</b> bKash Reference-এ লিখুন:
              </p>

              <div className="rounded-xl bg-zinc-50 p-3 text-center">
                <span className="font-mono font-bold text-zinc-900">
                  {referenceCode}
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="trxId"
                className="text-sm font-semibold text-zinc-900"
              >
                TrxID দিন
              </label>

              <input
                id="trxId"
                type="text"
                value={trxId}
                onChange={(event) =>
                  setTrxId(
                    event.target.value.toUpperCase()
                  )
                }
                placeholder="যেমন: 9K2L3M4N5P"
                autoComplete="off"
                spellCheck={false}
                className="mt-2 h-12 w-full rounded-xl border border-zinc-200 px-4 font-mono text-sm uppercase outline-none focus:border-zinc-900"
              />
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={handleConfirm}
              className="h-12 w-full rounded-xl bg-emerald-500 font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              {submitting
                ? "পাঠানো হচ্ছে..."
                : "পেমেন্ট কনফার্ম করেছি"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}