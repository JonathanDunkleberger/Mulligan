import { NextResponse } from "next/server";
// Minimal details handler; you can extend as we had earlier.
// For v1 we can omit rich details to keep this short.
export async function GET() {
  return NextResponse.json({}); // (implement later if needed)
}
