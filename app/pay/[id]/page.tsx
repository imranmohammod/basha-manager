"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { useParams } from "next/navigation";

type Invoice = {
  id: string;
  month: string;
  total_amount: number;
  status: string;
  leases?: {
    units?: { unit_name: string; properties?: { name: string } | null } | null;
    tenants?: { name: string; phone?: string } | null;
  } | null;
};

export default function PayPage() {
  const { id } = useParams() as { id: string };
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [method, setMethod] = useState<"personal" | "gateway" | "cash">("personal");
  const [trxId, setTrxId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("invoices").select(`id, month, total_amount, status, leases(units(unit_name, properties(name)), tenants(name, phone))`).eq("id", id).single();
      setInvoice(data as any);
      setLoading(false);
    };
    if (id) fetch();
  }, [id]);

  const handleConfirm = async () => {
    if (!trxId || trxId.length < 6) {
      alert("সঠিক TrxID দিন");
      return;
    }
    setSubmitting(true);
    // রেফারেন্স অনুযায়ী: Tenant TrxID দিবে, মালিক পরে Confirm করবে
    const { error } = await supabase.from("invoices").update({ bkash_trxid: trxId, status: "pending" }).eq("id", id);
    if (!error) setDone(true);
    setSubmitting(false);
  };

  if (loading) return <div className="min-h-screen grid place-items-center bg-[#f8f7f5]">Loading...</div>;
  if (!invoice) return <div className="min-h-screen grid place-items-center">Invoice পাওয়া যায়নি</div>;

  if (done) {
    return (
      <div className="min-h-screen bg-[#f8f7f5] p-4 grid place-items-center">
        <div className="w-full max-w- rounded- bg-white border p-8 text-center shadow-sm">
          <div className="mx-auto w-12 h-12 rounded-full bg-green-50 grid place-items-center text-xl">✓</div>
          <h2 className="mt-4 font-bold">আপনার পেমেন্ট যাচাইয়ের জন্য পাঠানো হয়েছে</h2>
          <p className="mt-2 text-sm text-zinc-500">যাচাই হতে সাধারণত ১-২ ঘণ্টা লাগে। মালিক Confirm করলেই রশিদ পাবেন।</p>
          <a href="/" className="mt-6 inline-block text-sm text-zinc-600">পেমেন্ট পেজে ফিরে যান</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f7f5]">
      <div className="max-w- mx-auto p-3">
        {/* Header */}
        <div className="rounded- bg-zinc-900 text-white p-5">
          <p className="text- tracking-widest uppercase opacity-60">নিরাপদ ভাড়া পেমেন্ট</p>
          <h1 className="mt-1 text- font-bold">{invoice.leases?.units?.properties?.name?? "Basha"} - {invoice.leases?.units?.unit_name}</h1>
          <p className="text-sm opacity-70">{invoice.month} • {invoice.leases?.tenants?.name}</p>
          <div className="mt-4 rounded-xl bg-white/10 p-3 flex justify-between">
            <span className="text-xs opacity-70">মোট দিতে হবে</span>
            <span className="font-bold">{Number(invoice.total_amount).toLocaleString("bn-BD")} ৳</span>
          </div>
        </div>

        {/* Method Tabs */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button onClick={() => setMethod("personal")} className={`h-12 rounded-full text- font-bold border ${method==="personal"?"bg-zinc-900 text-white":"bg-white"}`}>bKash Personal</button>
          <button onClick={() => setMethod("gateway")} className={`h-12 rounded-full text- font-bold border ${method==="gateway"?"bg-zinc-900 text-white":"bg-white"}`}>Gateway</button>
          <button onClick={() => setMethod("cash")} className={`h-12 rounded-full text- font-bold border ${method==="cash"?"bg-zinc-900 text-white":"bg-white"}`}>Cash</button>
        </div>

        {/* Personal Flow - রেফারেন্স অনুযায়ী */}
        {method==="personal" && (
          <div className="mt-4 rounded- bg-white border shadow-sm p-5 space-y-4">
            <h3 className="font-bold text-">bKash এ কিভাবে পাঠাবেন</h3>
            <div className="text- leading-6 space-y-2 text-zinc-600">
              <p>১. আপনার bKash অ্যাপে লগইন করুন</p>
              <p>২. <b>Send Money</b> করুন <span className="font-mono bg-yellow-50 px-2 py-1 rounded">017XX XXX XXX</span> নাম্বারে - ভুল নাম্বারে পাঠাবেন না</p>
              <p>৩. পুরো অ্যামাউন্ট একবারে পাঠান</p>
              <p>৪. রেফারেন্স এ লিখুন: <span className="font-mono font-bold text-zinc-900">{invoice.id.slice(0,8).toUpperCase()}</span> - রেফারেন্স ভুল হলে ভেরিফিকেশন দেরি হবে</p>
            </div>
            <div>
              <label className="text- font-semibold">TrxID নিচে দিন</label>
              <input value={trxId} onChange={e=>setTrxId(e.target.value.toUpperCase())} placeholder="যেমন: 9K2L3M4N5P" className="mt-2 w-full h-12 rounded-xl border px-4 font-mono uppercase" />
              <p className="mt-1 text- text-zinc-500">TrxID টি bKash App এর History তে পাবেন</p>
            </div>
            <button disabled={submitting} onClick={handleConfirm} className="w-full h- rounded- bg-[#10b981] text-white font-bold disabled:opacity-50">
              {submitting?"পাঠানো হচ্ছে...":"পেমেন্ট কনফার্ম করেছি"}
            </button>
            <p className="text-center text- text-zinc-500">এন্ড-টু-এন্ড এনক্রিপ্টেড • মালিকের কাছে সরাসরি যাবে</p>
          </div>
        )}

        {method==="gateway" && (
          <div className="mt-4 rounded- bg-white border p-8 text-center">
            <h4 className="font-bold text-sm">Auto Verification শীঘ্রই আসছে</h4>
            <p className="mt-2 text- text-zinc-500">bKash Payment Gateway ইন্টিগ্রেশন চলছে। আপাতত Personal Send Money ব্যবহার করুন।</p>
            <button onClick={()=>setMethod("personal")} className="mt-5 h-10 px-5 rounded-full bg-zinc-900 text-white text-">Personal অপশনে যান</button>
          </div>
        )}

        {method==="cash" && (
          <div className="mt-4 rounded- bg-white border p-5">
            <h3 className="font-bold text-sm">Cash Payment</h3>
            <p className="mt-3 text- text-zinc-600">• মালিকের সাথে যোগাযোগ করে সরাসরি টাকা দিন</p>
            <p className="text- text-zinc-600">• টাকা দেয়ার সময় এই Invoice ID টি দেখান: <span className="font-mono font-bold text-zinc-900">{invoice.id.slice(0,8)}</span></p>
            <p className="text- text-zinc-600">• মালিক Basha Manager এ পেমেন্ট Confirm করবেন</p>
          </div>
        )}

        <div className="mt-4 rounded- bg-[#f0fdf4] border border-emerald-100 p-3 text-[11.5px] text-emerald-800">
          আপনার তথ্য নিরাপদ। এই পেমেন্ট Basha Manager দ্বারা সুরক্ষিত এবং সরাসরি মালিকের কাছে যাবে।
        </div>
      </div>
    </div>
  );
}