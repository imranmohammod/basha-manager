type Props = {
  id: string;
  month: string;
  total_amount: number;
  status: "pending" | "paid";
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
  tenantName,
  unitName,
  propertyName,
  onPay,
  isPaying,
}: Props) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow">
      <div>
        <p className="font-bold">
          {tenantName?? "Unknown"} - {unitName?? "Unit"}
        </p>
        <p className="text-sm text-gray-500">
          {propertyName?? ""} | {month} - {Number(total_amount).toLocaleString()} ৳
        </p>
        <span className={`mt-2 inline-block rounded px-2 py-1 text-xs ${status === "paid"? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
          {status}
        </span>
      </div>
      {status === "pending" && (
        <button
          disabled={isPaying}
          onClick={() => onPay(id)}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
        >
          {isPaying? "Wait..." : "Paid করো"}
        </button>
      )}
    </div>
  );
}