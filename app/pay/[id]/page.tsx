"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type PaymentMethod =
  | "personal"
  | "gateway"
  | "cash";

type InvoiceStatus =
  | "pending"
  | "verification"
  | "paid";

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

  const BKASH_NUMBER = process.env.NEXT_PUBLIC_BKASH_NUMBER || "{BKASH_NUMBER}";

  const id =
    typeof params.id === "string"
      ? params.id
      : "";

  const [invoice, setInvoice] =
    useState<Invoice | null>(null);

  const [method, setMethod] =
    useState<PaymentMethod>("personal");

  const [trxId, setTrxId] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  // ========================================
  // FETCH INVOICE
  // ========================================

  useEffect(() => {
    async function fetchInvoice() {
      if (!id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMessage("");

      const { data, error } =
        await supabase
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
            `
          )
          .eq("id", id)
          .single();

      if (error) {
        console.error(
          "Invoice fetch error:",
          error
        );

        setInvoice(null);

        setErrorMessage(
          "Invoice তথ্য লোড করা যায়নি।"
        );

        setLoading(false);
        return;
      }

      const invoiceData =
        data as unknown as Invoice;

      setInvoice(invoiceData);

      /*
        Existing TrxID থাকলে input-এ দেখাবে।
        যেমন rejected payment-এর ক্ষেত্রে।
      */
      setTrxId(
        invoiceData.bkash_trxid ?? ""
      );

      /*
        Existing payment method থাকলে
        সেটি restore হবে।
      */
      if (
        invoiceData.payment_method ===
          "personal" ||
        invoiceData.payment_method ===
          "gateway" ||
        invoiceData.payment_method ===
          "cash"
      ) {
        setMethod(
          invoiceData.payment_method
        );
      }

      setLoading(false);
    }

    fetchInvoice();
  }, [id]);

  // ========================================
  // SUBMIT PAYMENT FOR VERIFICATION
  // ========================================

  async function handleConfirm() {
    if (!invoice) {
      return;
    }

    /*
      Already paid হলে আর submission
      করা যাবে না।
    */
    if (invoice.status === "paid") {
      setErrorMessage(
        "এই invoice ইতিমধ্যে paid হয়েছে।"
      );
      return;
    }

    /*
      Verification already submitted হলে
      duplicate submission বন্ধ।
    */
    if (
      invoice.status === "verification"
    ) {
      setErrorMessage(
        "এই payment ইতিমধ্যে verification-এর জন্য জমা হয়েছে।"
      );
      return;
    }

    /*
      এখন শুধু personal bKash payment
      supported।
    */
    if (method !== "personal") {
      setErrorMessage(
        "এই payment method এখনো চালু করা হয়নি।"
      );
      return;
    }

    const cleanedTrxId =
      trxId.trim().toUpperCase();

    if (
      !cleanedTrxId ||
      cleanedTrxId.length < 6
    ) {
      setErrorMessage(
        "সঠিক bKash TrxID দিন।"
      );
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    /*
      Existing reference থাকলে সেটি থাকবে।
      না থাকলে invoice ID থেকে তৈরি হবে।
    */
    const referenceCode =
      invoice.reference_code ??
      `INV-${invoice.id
        .replace(/-/g, "")
        .slice(0, 8)
        .toUpperCase()}`;

    /*
      একই timestamp database এবং local state
      দুই জায়গায় ব্যবহার করা হবে।
    */
    const submittedAt =
      new Date().toISOString();

    /*
      গুরুত্বপূর্ণ:
      শুধু pending invoice-ই verification-এ
      যেতে পারবে।
    */
    const { data, error } =
      await supabase
        .from("invoices")
        .update({
          bkash_trxid: cleanedTrxId,
          reference_code: referenceCode,
          payment_method: "personal",
          status: "verification",
          submitted_at: submittedAt,

          /*
            Rejected payment আবার submit করলে
            পুরোনো rejection reason মুছে যাবে।
          */
          rejection_reason: null,
        })
        .eq("id", invoice.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();

    if (error) {
      console.error(
        "Payment submission error:",
        error
      );

      setErrorMessage(
        "Payment information জমা দেওয়া যায়নি। আবার চেষ্টা করুন।"
      );

      setSubmitting(false);
      return;
    }

    /*
      যদি data না আসে, তাহলে update হয়নি।
      সম্ভবত invoice-এর status ইতিমধ্যে পরিবর্তিত হয়েছে।
    */
    if (!data) {
      setErrorMessage(
        "এই invoice-এর status পরিবর্তিত হয়েছে। Page refresh করে আবার দেখুন।"
      );

      setSubmitting(false);
      return;
    }

    /*
      Local UI immediately verification screen-এ যাবে।
    */
    setInvoice(
      (currentInvoice) =>
        currentInvoice
          ? {
              ...currentInvoice,

              bkash_trxid:
                cleanedTrxId,

              reference_code:
                referenceCode,

              payment_method:
                "personal",

              status:
                "verification",

              submitted_at:
                submittedAt,

              rejection_reason:
                null,
            }
          : currentInvoice
    );

    setSubmitting(false);
  }

  // ========================================
  // LOADING
  // ========================================

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f8f7f5]">
        <p className="text-sm text-zinc-500">
          Loading...
        </p>
      </div>
    );
  }

  // ========================================
  // INVOICE NOT FOUND
  // ========================================

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

  // ========================================
  // VERIFICATION PENDING
  // ========================================

  if (
    invoice.status === "verification"
  ) {
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
            আপনার TrxID সফলভাবে জমা হয়েছে।
            মালিক payment যাচাই করার পর
            invoice Paid হিসেবে দেখানো হবে।
          </p>

          <div className="mt-5 rounded-xl bg-zinc-50 p-4 text-left">
            <div className="flex justify-between gap-4">
              <span className="text-sm text-zinc-500">
                Reference
              </span>

              <span className="font-mono text-sm font-semibold text-zinc-900">
                {invoice.reference_code ??
                  `INV-${invoice.id
                    .replace(/-/g, "")
                    .slice(0, 8)
                    .toUpperCase()}`}
              </span>
            </div>

            <div className="mt-2 flex justify-between gap-4">
              <span className="text-sm text-zinc-500">
                Amount
              </span>

              <span className="font-bold text-zinc-900">
                {Number(
                  invoice.total_amount
                ).toLocaleString(
                  "bn-BD"
                )}{" "}
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

            {invoice.submitted_at && (
              <div className="mt-2 flex justify-between gap-4">
                <span className="text-sm text-zinc-500">
                  Submitted
                </span>

                <span className="text-right text-xs text-zinc-600">
                  {new Date(
                    invoice.submitted_at
                  ).toLocaleString(
                    "bn-BD"
                  )}
                </span>
              </div>
            )}
          </div>

          <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-3 text-left text-xs leading-5 text-blue-800">
            Payment verification সম্পন্ন
            না হওয়া পর্যন্ত আবার payment
            পাঠানোর দরকার নেই।
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

  // ========================================
  // ALREADY PAID
  // ========================================

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
            এই invoice-এর payment
            ইতিমধ্যে Confirm করা হয়েছে।
          </p>

          <div className="mt-5 rounded-xl bg-zinc-50 p-4 text-left">
            <div className="flex justify-between gap-4">
              <span className="text-sm text-zinc-500">
                Reference
              </span>

              <span className="font-mono text-sm font-semibold text-zinc-900">
                {invoice.reference_code ??
                  `INV-${invoice.id
                    .replace(/-/g, "")
                    .slice(0, 8)
                    .toUpperCase()}`}
              </span>
            </div>

            <div className="mt-2 flex justify-between gap-4">
              <span className="text-sm text-zinc-500">
                Amount
              </span>

              <span className="font-bold text-zinc-900">
                {Number(
                  invoice.total_amount
                ).toLocaleString(
                  "bn-BD"
                )}{" "}
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

            {invoice.paid_at && (
              <div className="mt-2 flex justify-between gap-4">
                <span className="text-sm text-zinc-500">
                  Paid
                </span>

                <span className="text-right text-xs text-zinc-600">
                  {new Date(
                    invoice.paid_at
                  ).toLocaleString(
                    "bn-BD"
                  )}
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

  // ========================================
  // PENDING PAYMENT FORM
  // ========================================

  const propertyName =
    invoice.leases?.units?.properties
      ?.name ?? "Basha";

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
                ).toLocaleString(
                  "bn-BD"
                )}{" "}
                ৳
              </span>
            </div>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() =>
              setMethod("personal")
            }
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
            onClick={() =>
              setMethod("gateway")
            }
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
            onClick={() =>
              setMethod("cash")
            }
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

        {/* Rejection reason */}
        {invoice.rejection_reason && (
          <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-4">
            <p className="text-sm font-bold text-red-700">
              আগের payment submission
              reject করা হয়েছে
            </p>

            <p className="mt-1 text-sm text-red-600">
              কারণ:{" "}
              {invoice.rejection_reason}
            </p>

            <p className="mt-2 text-xs text-red-500">
              সঠিক TrxID দিয়ে আবার
              submit করুন।
            </p>
          </div>
        )}

        {/* Personal bKash */}
        {method === "personal" && (
          <div className="mt-4 space-y-4 rounded-2xl border bg-white p-5 shadow-sm">

            <div>
              <h3 className="font-bold text-zinc-900">
                bKash এ কিভাবে পাঠাবেন
              </h3>

              <p className="mt-1 text-xs text-zinc-500">
                Personal Send Money ব্যবহার
                করে payment করুন।
              </p>
            </div>

            <div className="space-y-3 text-sm leading-6 text-zinc-600">
              <p>
                <b>১.</b> আপনার bKash অ্যাপে
                লগইন করুন।
              </p>

              <p>
                <b>২.</b>{" "}
                <strong>
                  Send Money
                </strong>{" "}
                করুন মালিকের bKash নম্বরে।
              </p>

              <div className="rounded-xl bg-yellow-50 p-3 text-center">
                <span className="font-mono font-bold text-zinc-900">
                  017XX XXX XXX
                </span>
              </div>

              <p className="text-xs text-red-600">
                টাকা পাঠানোর আগে নম্বরটি
                মালিকের কাছ থেকে নিশ্চিত করুন।
              </p>

              <p>
                <b>৩.</b> পুরো invoice amount
                একবারে পাঠান।
              </p>

              <p>
                <b>৪.</b> bKash Reference-এ
                লিখুন:
              </p>

              <div className="rounded-xl bg-zinc-50 p-3 text-center">
                <span className="font-mono font-bold text-zinc-900">
                  {referenceCode}
                </span>
              </div>
            </div>

            {/* TrxID */}
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
                    event.target.value
                      .toUpperCase()
                  )
                }
                placeholder="যেমন: 9K2L3M4N5P"
                autoComplete="off"
                spellCheck={false}
                className="mt-2 h-12 w-full rounded-xl border border-zinc-200 px-4 font-mono text-sm uppercase outline-none focus:border-zinc-900"
              />

              <p className="mt-1 text-xs text-zinc-500">
                TrxID bKash App-এর
                Transaction History-তে পাবেন।
              </p>
            </div>

            {/* Submit */}
            <button
              type="button"
              disabled={submitting}
              onClick={handleConfirm}
              className="h-12 w-full rounded-xl bg-emerald-500 font-bold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? "পাঠানো হচ্ছে..."
                : "পেমেন্ট কনফার্ম করেছি"}
            </button>

            <p className="text-center text-xs leading-5 text-zinc-500">
              TrxID জমা দেওয়ার পর মালিক
              payment যাচাই করে Confirm
              করবেন।
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
              bKash Payment Gateway এখনো
              চালু করা হয়নি। আপাতত
              Personal Send Money ব্যবহার
              করুন।
            </p>

            <button
              type="button"
              onClick={() =>
                setMethod("personal")
              }
              className="mt-5 h-10 rounded-full bg-zinc-900 px-5 text-sm font-medium text-white"
            >
              Personal অপশনে যান
            </button>
          </div>
        )}

        {/* Cash */}
        {method === "cash" && (
          <div className="mt-4 rounded-2xl border bg-white p-5 shadow-sm">
            <h3 className="font-bold text-zinc-900">
              Cash Payment
            </h3>

            <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-600">
              <p>
                • মালিকের সাথে যোগাযোগ করে
                সরাসরি টাকা দিন।
              </p>

              <p>
                • টাকা দেওয়ার সময় Reference
                দেখান:
              </p>

              <div className="rounded-xl bg-zinc-50 p-3 text-center">
                <span className="font-mono font-bold text-zinc-900">
                  {referenceCode}
                </span>
              </div>

              <p>
                • মালিক Basha Manager থেকে
                payment Confirm করবেন।
              </p>
            </div>
          </div>
        )}

        {/* Security note */}
        <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
          Payment information শুধুমাত্র
          payment verification-এর জন্য
          ব্যবহার করা হবে।
        </div>
      </div>
    </div>
  );
}