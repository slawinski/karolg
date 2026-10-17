import { connection } from 'next/server'

export async function awaitPublicRequest() {
  await connection()
}
