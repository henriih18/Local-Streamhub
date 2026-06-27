import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { user, error } = await auth(request);
  if (!user) {
    return NextResponse.json(
      { error: error || "No autorizado" },
      { status: 401 },
    );
  }
  return NextResponse.json({ user });
}
