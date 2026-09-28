type Props = {
  title: string;
  amount: number;
  color: string;
};

export default function StatsCard({ title, amount, color }: Props) {
  return (
    <div className="rounded-xl bg-white p-4 shadow">
      <p className="text-sm text-gray-500">{title}</p>
      <p className={`text-xl font-bold ${color}`}>
        {amount.toLocaleString("bn-BD")} ৳
      </p>
    </div>
  );
}