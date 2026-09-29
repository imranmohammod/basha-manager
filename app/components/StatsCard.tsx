
type Props = {
  title: string;
  amount: number | string | null | undefined;
  color: string;
};

export default function StatsCard({
  title,
  amount,
  color,
}: Props) {
  const numericAmount = Number(amount);

  const safeAmount = Number.isFinite(numericAmount)
    ? numericAmount
    : 0;

  return (
    <div className="rounded-xl bg-white p-4 shadow">
      <p className="text-sm text-gray-500">
        {title}
      </p>

      <p className={`text-xl font-bold ${color}`}>
        {safeAmount.toLocaleString("bn-BD")} ৳
      </p>
    </div>
  );
}
