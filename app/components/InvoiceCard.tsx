type Props = {
  id: string;
  month: string;
  total_amount: number | string | null | undefined;
  status: "pending" | "verification" | "paid";

  reference_code?: string | null;
  bkash_trxid?: string | null;
  submitted_at?: string | null;

  tenantName?: string;
  unitName?: string;
  propertyName?: string;

  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isProcessing: boolean;
  onPay: () => void;
  isPaying: boolean;
};

export default function InvoiceCard({
  id,
  month,
  total_amount,
  status,
  reference_code,
  bkash_trxid,
  submitted_at,
  tenantName,
  unitName,
  propertyName,
  onApprove,
  onReject,
  isProcessing,
  onPay,
  isPaying,
}: Props) {
  const numericAmount = Number(total_amount);

  const safeAmount = Number.isFinite(numericAmount) ? numericAmount : 0;

  const formattedAmount = safeAmount.toLocaleString("bn-BD");

  const reference =
    reference_code ?? `INV-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;

  const payId = reference_code || id;

  const formatMonth = (value: string) => {
    const match = value.match(/^(\d{4})-(\d{2})$/);

    if (!match) {
      return value;
    }

    const [, year, monthNumber] = match;
    const monthIndex = Number(monthNumber);

    if (monthIndex < 1 || monthIndex > 12) {
      return value;
    }

    const date = new Date(Number(year), monthIndex - 1, 1);

    return date.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  };

  const displayMonth = formatMonth(month);

  const tenant = tenantName ?? "ভাই";

  const submittedDate = submitted_at
    ? new Date(submitted_at).toLocaleString("bn-BD")
    : null;

  // WhatsApp message
  let waText = "";

  if (status === "pending") {
    waText =
      `আসসালামু আলাইকুম ${tenant}, ` +
      `আপনার ${displayMonth} মাসের ভাড়া ` +
      `৳${formattedAmount} বাকি। ` +
      `রেফারেন্স: ${reference}। ` +
      `পেমেন্ট করতে এই লিংকে যান: ` +
      `https://basha-manager.vercel.app/pay/${payId}`;
  } else if (status === "verification") {
    waText =
      `আসসালামু আলাইকুম ${tenant}, ` +
      `আপনার ${displayMonth} মাসের ` +
      `৳${formattedAmount} payment information ` +
      `আমরা পেয়েছি। ` +
      `TrxID: ${bkash_trxid ?? "N/A"}। ` +
      `Payment বর্তমানে verification-এর অপেক্ষায় আছে।`;
  } else {
    waText =
      `আসসালামু আলাইকুম ${tenant}, ` +
      `আপনার ${displayMonth} মাসের ` +
      `৳${formattedAmount} ভাড়ার payment ` +
      `verify করা হয়েছে। ` +
      `রেফারেন্স: ${reference}। ` +
      `ধন্যবাদ।`;
  }

  const waUrl = `https://wa.me/?text=${encodeURIComponent(waText)}`;

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      {/* Main content */}
      <div className="min-w-0">
        {/* Tenant + Unit */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="font-bold text-zinc-900">{tenantName ?? "Unknown"}</p>

          <span className="text-zinc-300">•</span>

          <p className="text-sm font-medium text-zinc-700">
            {unitName ?? "Unit"}
          </p>
        </div>

        {/* Property */}
        <p className="mt-1 truncate text-sm text-gray-500">
          {propertyName ?? "Basha"}
        </p>

        {/* Month + Amount */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">
            {displayMonth}
          </span>

          <span className="text-base font-bold text-zinc-900">
            {formattedAmount} ৳
          </span>
        </div>

        {/* Reference */}
        <p className="mt-2 break-all text-xs text-gray-400">
          Ref:{" "}
          <span className="font-mono font-medium text-zinc-600">
            {reference}
          </span>
        </p>

        {/* TrxID */}
        {bkash_trxid && (
          <p className="mt-1 break-all text-xs text-gray-400">
            TrxID:{" "}
            <span className="font-mono font-medium text-zinc-600">
              {bkash_trxid}
            </span>
          </p>
        )}

        {/* Status */}
        {status === "pending" && (
          <span className="mt-3 inline-block rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700">
            Pending - বাকি
          </span>
        )}

        {status === "verification" && (
          <div className="mt-3 space-y-2">
            <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
              🔍 Verification Pending
            </span>

            <div className="rounded-xl bg-blue-50 p-3 text-xs text-blue-900">
              {bkash_trxid && (
                <p>
                  TrxID:{" "}
                  <span className="font-mono font-bold">{bkash_trxid}</span>
                </p>
              )}

              {submittedDate && (
                <p className="mt-1">Submitted: {submittedDate}</p>
              )}
            </div>

            {/* Admin verification actions */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onApprove(id)}
                disabled={isProcessing}
                className="h-11 rounded-xl bg-green-600 px-3 text-sm font-bold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isProcessing ? "Processing..." : "✓ Approve"}
              </button>

              <button
                type="button"
                onClick={() => onReject(id)}
                disabled={isProcessing}
                className="h-11 rounded-xl border border-red-100 bg-red-50 px-3 text-sm font-bold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isProcessing ? "Processing..." : "✕ Reject"}
              </button>
            </div>
          </div>
        )}

        {status === "paid" && (
          <span className="mt-3 inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
            ✓ Paid
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex w-full flex-col gap-2">
        {/* WhatsApp */}
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="grid h-10 w-full place-items-center rounded-xl bg-green-500 px-4 text-sm font-semibold text-white transition hover:bg-green-600"
        >
          WhatsApp
        </a>

        {/* Payment Link */}
        {status === "pending" && (
          <button
            type="button"
            onClick={onPay}
            disabled={isPaying}
            className="grid h-10 w-full place-items-center rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPaying ? "Opening..." : `Pay - ${reference}`}
          </button>
        )}
      </div>
    </div>
  );
}
