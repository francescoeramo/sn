import { federationStatus } from '@/lib/core/federation';
export function GET() {
  return Response.json(federationStatus, { status: 503, headers: { 'Cache-Control': 'no-store' } });
}
