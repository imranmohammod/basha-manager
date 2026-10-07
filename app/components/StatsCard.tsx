type Props = {
  title: string;
  amount: number;
  color: string;
  showCurrency?: boolean;
};

export default function StatsCard({
  title,
  amount,
  color,
  showCurrency = true,
}: Props) {
  return (
    <div className="rounded-xl bg-white p-4 shadow">
      <p className="text-sm text-gray-500">{title}</p>

      <p className={`text-xl font-bold ${color}`}>
        {Number(amount || 0).toLocaleString("bn-BD")}
        {showCurrency && " ৳"}
      </p>
    </div>
  );
}
