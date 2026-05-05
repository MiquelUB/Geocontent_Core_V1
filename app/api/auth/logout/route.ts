import { NextResponse } from 'next/server';
import { logout } from '@/lib/actions/auth';

export async function POST() {
  await logout();
  return NextResponse.json({ success: true });
}
