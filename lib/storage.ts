import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

// Files are created at runtime on persistent disk, never bundled as build assets.
export const uploadDirectory = () => path.resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR || path.join(process.cwd(), '.data', 'uploads'))
export const validOwner = (owner: string) => /^[A-Za-z0-9_-]+$/.test(owner)
export const validFilename = (name: string) => /^[0-9a-f-]{36}\.(png|jpg|gif|webp)$/.test(name)

export function imageType(bytes: Buffer): { extension: string; mime: string } | null {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { extension: 'png', mime: 'image/png' }
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { extension: 'jpg', mime: 'image/jpeg' }
  if (['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString())) return { extension: 'gif', mime: 'image/gif' }
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') return { extension: 'webp', mime: 'image/webp' }
  return null
}

export async function saveProof(owner: string, bytes: Buffer, extension: string) {
  if (!validOwner(owner)) throw new Error('Invalid owner')
  const directory = path.join(/* turbopackIgnore: true */ uploadDirectory(), owner)
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const filename = `${crypto.randomUUID()}.${extension}`
  await writeFile(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ directory, filename), bytes, { flag: 'wx', mode: 0o600 })
  return `/api/proofs/${owner}/${filename}`
}

export async function readProof(owner: string, filename: string) {
  if (!validOwner(owner) || !validFilename(filename)) return null
  try { return await readFile(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ uploadDirectory(), owner, filename)) }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error }
}
