import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

export async function GET() {
  try {
    await supabase.from("invoices").select("id").limit(1);
    return NextResponse.json({
      ok: true,
      message: "Supabase is awake",
      time: new Date().toISOString()
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}