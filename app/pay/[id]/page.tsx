"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type PaymentMethod = "personal" | "gateway" | "cash";

type Invoice = {
  id: string;
  month: string;
  rent_amount: number;
  utility_amount: number;
  total_amount: number;
  status: string;
  bkash_trxid?: string | null;
  reference_code?: string | null;
  payment_method?: string | null;

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

  const id = typeof params.id === "string" ? params.id : "";

  const [invoice, setInvoice] = useState<Invoice | null>(null);

  const [method, setMethod] = useState<PaymentMethod>("personal");

  const [trxId, setTrxId] = useState("");

  const [loading, setLoading] = useState(true);

  const [submitting, setSubmitting] = useState(false);

  const [done, setDone] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function fetchInvoice() {
      if (!id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("invoices")
        .select(
          `
            id,
            month,
            rent_amount,
            utility_amount,
            total_amount,
            status,
            bkash_trxid,
            reference_code,
            payment_method,
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
          `,
        )
        .eq("id", id)
        .single();

      if (error) {
        console.error("Invoice fetch error:", error);

        setInvoice(null);
        setErrorMessage("Invoice তথ্য লোড করা যায়নি।");

        setLoading(false);
        return;
      }

      const invoiceData = data as Invoice;

      setInvoice(invoiceData);

      if (invoiceData.bkash_trxid) {
        setTrxId(invoiceData.bkash_trxid);
      }

      if (
        invoiceData.payment_method === "gateway" ||
        invoiceData.payment_method === "cash" ||
        invoiceData.payment_method === "personal"
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

    if (method !== "personal") {
      setErrorMessage("এই payment method এখনো চালু করা হয়নি।");
      return;
    }

    const cleanedTrxId = trxId.trim().toUpperCase();

    if (!cleanedTrxId || cleanedTrxId.length < 6) {
      setErrorMessage("সঠিক bKash TrxID দিন।");
      return;
    }

    if (invoice.status === "paid") {
      setErrorMessage("এই invoice ইতিমধ্যে paid হয়েছে।");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    /*
      Existing reference থাকলে সেটাই ব্যবহার হবে।
      না থাকলে invoice ID থেকে তৈরি হবে।
    */
    const referenceCode =
      invoice.reference_code ??
      `INV-${invoice.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;

    const { error } = await supabase
      .from("invoices")
      .update({
        bkash_trxid: cleanedTrxId,
        reference_code: referenceCode,
        payment_method: "personal",
        status: "pending",
      })
      .eq("id", invoice.id);

    if (error) {
      console.error("Payment submission error:", error);

      setErrorMessage(
        "Payment information জমা দেওয়া যায়নি। আবার চেষ্টা করুন।",
      );

      setSubmitting(false);
      return;
    }

    setInvoice((currentInvoice) =>
      currentInvoice
        ? {
            ...currentInvoice,
            bkash_trxid: cleanedTrxId,
            reference_code: referenceCode,
            payment_method: "personal",
            status: "pending",
          }
        : currentInvoice,
    );

    setDone(true);
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f8f7f5]">
        <p className="text-sm text-zinc-500">Loading...</p>
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
            {errorMessage || "এই invoice-এর তথ্য পাওয়া যাচ্ছে না।"}
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

  /*
    Invoice already paid
  */
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
            এই invoice-এর payment ইতিমধ্যে Confirm করা হয়েছে।
          </p>

          <div className="mt-5 rounded-xl bg-zinc-50 p-4 text-left">
            <div className="flex justify-between gap-4">
              <span className="text-sm text-zinc-500">Reference</span>

              <span className="font-mono text-sm font-semibold text-zinc-900">
                {invoice.reference_code ?? invoice.id.slice(0, 8).toUpperCase()}
              </span>
            </div>

            <div className="mt-2 flex justify-between gap-4">
              <span className="text-sm text-zinc-500">Amount</span>

              <span className="font-bold text-zinc-900">
                {Number(invoice.total_amount).toLocaleString("bn-BD")} ৳
              </span>
            </div>

            {invoice.bkash_trxid && (
              <div className="mt-2 flex justify-between gap-4">
                <span className="text-sm text-zinc-500">TrxID</span>

                <span className="font-mono text-sm font-semibold text-zinc-900">
                  {invoice.bkash_trxid}
                </span>
              </div>
            )}
          </div>

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

  /*
    Payment submitted
  */
  if (done) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f8f7f5] p-4">
        <div className="w-full max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-green-50 text-xl text-green-600">
            ✓
          </div>

          <h2 className="mt-4 font-bold text-zinc-900">
            Payment verification-এর জন্য পাঠানো হয়েছে
          </h2>

          <p className="mt-2 text-sm leading-6 text-zinc-500">
            আপনার TrxID মালিকের কাছে পাঠানো হয়েছে। মালিক payment যাচাই করে
            Confirm করলে invoice paid হবে।
          </p>

          <div className="mt-5 rounded-xl bg-zinc-50 p-4 text-left">
            <div className="flex justify-between gap-4">
              <span className="text-sm text-zinc-500">Reference</span>

              <span className="font-mono text-sm font-semibold text-zinc-900">
                {invoice.reference_code ?? invoice.id.slice(0, 8).toUpperCase()}
              </span>
            </div>

            <div className="mt-2 flex justify-between gap-4">
              <span className="text-sm text-zinc-500">Amount</span>

              <span className="font-bold text-zinc-900">
                {Number(invoice.total_amount).toLocaleString("bn-BD")} ৳
              </span>
            </div>

            <div className="mt-2 flex justify-between gap-4">
              <span className="text-sm text-zinc-500">TrxID</span>

              <span className="font-mono text-sm font-semibold text-zinc-900">
                {trxId}
              </span>
            </div>
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

  const propertyName = invoice.leases?.units?.properties?.name ?? "Basha";

  const unitName = invoice.leases?.units?.unit_name ?? "Unknown Unit";

  const tenantName = invoice.leases?.tenants?.name ?? "Unknown Tenant";

  const referenceCode =
    invoice.reference_code ??
    `INV-${invoice.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;

  return (
    <div className="min-h-screen bg-[#f8f7f5]">
      <div className="mx-auto max-w-md p-3 pb-8">
        {/* Header */}
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
              <span className="text-xs text-white/70">Reference</span>

              <span className="font-mono text-sm font-bold">
                {referenceCode}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-white/70">মোট দিতে হবে</span>

              <span className="text-lg font-bold">
                {Number(invoice.total_amount).toLocaleString("bn-BD")} ৳
              </span>
            </div>
          </div>
        </div>

        {/* Payment methods */}
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
            onClick={() => setMethod("gateway")}
            className={`h-12 rounded-full border text-xs font-bold ${
              method === "gateway"
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white text-zinc-700"
            }`}
          >
            Gateway
          </button>

          <button
            type="button"
            onClick={() => setMethod("cash")}
            className={`h-12 rounded-full border text-xs font-bold ${
              method === "cash"
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white text-zinc-700"
            }`}
          >
            Cash
          </button>
        </div>

        {/* Error */}
        {errorMessage && (
          <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {/* Personal */}
        {method === "personal" && (
          <div className="mt-4 space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
            <div>
              <h3 className="font-bold text-zinc-900">
                bKash এ কিভাবে পাঠাবেন
              </h3>

              <p className="mt-1 text-xs text-zinc-500">
                Personal Send Money ব্যবহার করে payment করুন।
              </p>
            </div>

            <div className="space-y-3 text-sm leading-6 text-zinc-600">
              <p>
                <b>১.</b> আপনার bKash অ্যাপে লগইন করুন।
              </p>

              <p>
                <b>২.</b> <strong>Send Money</strong> করুন মালিকের bKash নম্বরে।
              </p>

              <div className="rounded-xl bg-yellow-50 p-3 text-center">
                <span className="font-mono font-bold text-zinc-900">
                  017XX XXX XXX
                </span>
              </div>

              <p className="text-xs text-red-600">
                টাকা পাঠানোর আগে নম্বরটি মালিকের কাছ থেকে নিশ্চিত করুন।
              </p>

              <p>
                <b>৩.</b> পুরো invoice amount একবারে পাঠান।
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
                onChange={(event) => setTrxId(event.target.value.toUpperCase())}
                placeholder="যেমন: 9K2L3M4N5P"
                autoComplete="off"
                spellCheck={false}
                className="mt-2 h-12 w-full rounded-xl border border-zinc-200 px-4 font-mono text-sm uppercase outline-none focus:border-zinc-900"
              />

              <p className="mt-1 text-xs text-zinc-500">
                TrxID bKash App-এর Transaction History-তে পাবেন।
              </p>
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={handleConfirm}
              className="h-12 w-full rounded-xl bg-emerald-500 font-bold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "পাঠানো হচ্ছে..." : "পেমেন্ট কনফার্ম করেছি"}
            </button>

            <p className="text-center text-xs leading-5 text-zinc-500">
              TrxID জমা দেওয়ার পর মালিক payment যাচাই করে Confirm করবেন।
            </p>
          </div>
        )}

        {/* Gateway */}
        {method === "gateway" && (
          <div className="mt-4 rounded-2xl border bg-white p-8 text-center shadow-sm">
            <h4 className="font-bold text-zinc-900">
              Auto Verification শীঘ্রই আসছে
            </h4>

            <p className="mt-2 text-sm leading-6 text-zinc-500">
              bKash Payment Gateway এখনো চালু করা হয়নি। আপাতত Personal Send
              Money ব্যবহার করুন।
            </p>

            <button
              type="button"
              onClick={() => setMethod("personal")}
              className="mt-5 h-10 rounded-full bg-zinc-900 px-5 text-sm font-medium text-white"
            >
              Personal অপশনে যান
            </button>
          </div>
        )}

        {/* Cash */}
        {method === "cash" && (
          <div className="mt-4 rounded-2xl border bg-white p-5 shadow-sm">
            <h3 className="font-bold text-zinc-900">Cash Payment</h3>

            <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-600">
              <p>• মালিকের সাথে যোগাযোগ করে সরাসরি টাকা দিন।</p>

              <p>• টাকা দেওয়ার সময় Reference দেখান:</p>

              <div className="rounded-xl bg-zinc-50 p-3 text-center">
                <span className="font-mono font-bold text-zinc-900">
                  {referenceCode}
                </span>
              </div>

              <p>• মালিক Basha Manager থেকে payment Confirm করবেন।</p>
            </div>
          </div>
        )}

        {/* Security note */}
        <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
          Payment information শুধুমাত্র payment verification-এর জন্য ব্যবহার করা
          হবে।
        </div>
      </div>
    </div>
  );
}
