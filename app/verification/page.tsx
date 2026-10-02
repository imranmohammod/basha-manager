// app/verification/page.tsx বা app/page.tsx এর ভিতরে

const [verificationList, setVerificationList] = useState<Invoice[]>([]);

const fetchVerificationQueue = async () => {
  const { data, error } = await supabase
    .from("invoices")
    .select(`
      id,
      month,
      total_amount,
      status,
      created_at,
      submitted_at,
      reference_code,
      bkash_trxid,
      payment_method,
      leases (
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
    `)
    .eq("status", "verification")
    .order("submitted_at", { ascending: false });

  if (error) {
    console.error("Verification queue error:", error);
    return;
  }

  setVerificationList(data as any);
};

// Usage:
// verificationList.length > 0 হলে নীল Badge এ Count দেখাও
// StatsCard: Verification {verificationList.length} টি