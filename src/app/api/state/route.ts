import { getState } from '@/lib/runtime'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  return Response.json(getState())
}
