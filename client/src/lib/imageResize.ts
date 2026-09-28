/**
 * Shrinks a phone photo before it's uploaded: longest side capped, re-encoded as JPEG. A camera
 * photo is often 3–8MB, which is slow on a weak signal and heavy to keep in the offline outbox;
 * this brings it down to a few hundred KB. If the browser can't decode the file (e.g. HEIC outside
 * Safari) the original is used unchanged and the server's own size check still applies.
 */

const MAX_SIDE = 1600
const QUALITY = 0.82

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read the image'))
    img.src = src
  })
}

/** Report-photo settings. Takes only the file, so it can be passed straight to `files.map()`. */
export function shrinkImage(file: File): Promise<{ fileData: string; fileName: string }> {
  return shrinkImageTo(file, MAX_SIDE, QUALITY)
}

/**
 * Explicit size and quality. The check-in photo uses much smaller values (~50 KB) since it proves
 * presence, not detail, and is kept in the database.
 */
export async function shrinkImageTo(file: File, maxSide: number, quality: number): Promise<{ fileData: string; fileName: string }> {
  const original = await readAsDataUrl(file)
  try {
    const img = await loadImage(original)
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('No canvas')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const shrunk = canvas.toDataURL('image/jpeg', quality)
    // Keep the original if re-encoding somehow made it bigger (a tiny PNG, say).
    if (shrunk.length >= original.length) return { fileData: original, fileName: file.name }
    const base = file.name.replace(/\.[^.]+$/, '') || 'photo'
    return { fileData: shrunk, fileName: `${base}.jpg` }
  } catch {
    return { fileData: original, fileName: file.name }
  }
}
