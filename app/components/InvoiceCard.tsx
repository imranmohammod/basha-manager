type Props = {
  id: string;
  month: string;
  total_amount: number | string | null | undefined;
  status: "pending" | "paid";

  reference_code?: string | null;
  bkash_trxid?: string | null;

  tenantName?: string;
  unitName?: string;
  propertyName?: string;

  onPay: (id: string) => void;
  isPaying: boolean;
};

export default function InvoiceCard({
  id,
  month,
  total_amount,
  status,
  reference_code,
  bkash_trxid,
  tenantName,
  unitName,
  propertyName,
  onPay,
  isPaying,
}: Props) {
  const numericAmount = Number(total_amount);

  const safeAmount = Number.isFinite(numericAmount)
    ? numericAmount
    : 0;

  const formattedAmount =
    safeAmount.toLocaleString("bn-BD");

  const reference =
    reference_code ??
    `INV-${id
      .replace(/-/g, "")
      .slice(0, 8)
      .toUpperCase()}`;

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

    const date = new Date(
      Number(year),
      monthIndex - 1,
      1
    );

    return date.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  };

  const displayMonth = formatMonth(month);

  const tenant = tenantName ?? "ভাই";

  const waText =
    status === "pending"
      ? `আসসালামু আলাইকুম ${tenant}, আপনার ${displayMonth} মাসের ভাড়া ৳${formattedAmount} বাকি। রেফারেন্স: ${reference}। পেমেন্ট করতে এই লিংকে যান: https://basha-manager.vercel.app/pay/${id}`
      : `আসসালামু আলাইকুম ${tenant}, আপনার ${displayMonth} মাসের ৳${formattedAmount} ভাড়ার পেমেন্ট গ্রহণ করা হয়েছে। রেফারেন্স: ${reference}। ধন্যবাদ।`;

  const waUrl = `https://wa.me/?text=${encodeURIComponent(
    waText
  )}`;

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      {/* Main content */}
      <div className="min-w-0">
        {/* Tenant + Unit */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="font-bold text-zinc-900">
            {tenantName ?? "Unknown"}
          </p>

          <span className="text-zinc-300">
            •
          </span>

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
        <span
          className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-medium ${
            status === "paid"
              ? "bg-green-100 text-green-700"
              : "bg-yellow-100 text-yellow-700"
          }`}
        >
          {status === "paid"
            ? "Paid"
            : "Pending"}
        </span>
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

        {/* Payment Link + Paid button */}
        {status === "pending" && (
          <>
            <a
              href={`/pay/${id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="grid h-10 w-full place-items-center rounded-xl bg-zinc-100 px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-200"
            >
              Payment Link
            </a>

            <button
              type="button"
              disabled={isPaying}
              onClick={() => onPay(id)}
              className="h-10 w-full rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPaying
                ? "Wait..."
                : "Paid করো"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}