import { connection } from 'next/server'

export async function awaitPublicRequest() {
  if (process.env.STATIC_EXPORT !== '1') await connection()
}
