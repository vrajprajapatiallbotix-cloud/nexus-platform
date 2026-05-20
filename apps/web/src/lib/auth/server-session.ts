import { cookies } from 'next/headers';

export async function getServerSession(): Promise<{ userId: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('nexus_access_token');
  if (!token?.value) return null;
  // In production verify the JWT here; for dev just check presence
  return { userId: 'server-side' };
}
