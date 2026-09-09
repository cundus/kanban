import Compressor from "compressorjs"

/**
 * Helper pemrosesan file di browser. Fokus sekarang: gambar untuk task card
 * (kompres + ambil dari clipboard), tapi util generik (`fileExtension`,
 * `formatBytes`) sengaja dipisah supaya bisa dipakai ulang untuk jenis file
 * lain nanti (lampiran PDF, dsb).
 */

export const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const

export function isAcceptedImage(file: File): boolean {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)
}

export interface CompressImageOptions {
  maxWidth?: number
  maxHeight?: number
  /** 0..1 — dipakai saat re-encode ke JPEG/WebP. */
  quality?: number
  /** Ukuran (byte) di atas mana PNG dikonversi ke JPEG. */
  convertSize?: number
  /** Paksa mime hasil; default `auto` (biarkan compressor.js memilih). */
  mimeType?: string
}

const COMPRESS_DEFAULTS: Required<
  Omit<CompressImageOptions, "mimeType">
> = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.82,
  convertSize: 1_000_000,
}

/**
 * Kompres gambar lewat compressor.js (canvas re-encode + resize). Bersifat
 * "mendekati lossless" pada kualitas default: dimensi besar diperkecil ke
 * maxWidth/maxHeight dan PNG besar dijadikan JPEG, tanpa artefak yang kentara.
 *
 * - GIF dilewati (canvas mematikan animasi) → kembalikan file asli.
 * - Kalau hasil kompres justru lebih besar (mis. PNG kecil), pakai yang asli.
 * - Tipe non-gambar dikembalikan apa adanya.
 */
export function compressImage(
  file: File,
  options: CompressImageOptions = {},
): Promise<File> {
  if (!isAcceptedImage(file) || file.type === "image/gif") {
    return Promise.resolve(file)
  }
  const opts = { ...COMPRESS_DEFAULTS, ...options }
  return new Promise((resolve, reject) => {
    new Compressor(file, {
      maxWidth: opts.maxWidth,
      maxHeight: opts.maxHeight,
      quality: opts.quality,
      convertTypes: ["image/png"],
      convertSize: opts.convertSize,
      mimeType: options.mimeType,
      success: (result) => {
        const name = renameForType(file.name, result.type || file.type)
        const compressed =
          result instanceof File && result.name === name
            ? result
            : new File([result], name, {
                type: result.type || file.type,
                lastModified: Date.now(),
              })
        resolve(compressed.size < file.size ? compressed : file)
      },
      error: reject,
    })
  })
}

/** Ambil file gambar dari `DataTransfer` sebuah event paste/drop clipboard. */
export function imagesFromClipboard(data: DataTransfer | null): File[] {
  if (!data) return []
  const out: File[] = []
  for (const item of Array.from(data.items)) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile()
      if (file) out.push(file)
    }
  }
  // Sebagian browser menaruh gambar di `files`, bukan `items`.
  if (out.length === 0) {
    for (const file of Array.from(data.files)) {
      if (file.type.startsWith("image/")) out.push(file)
    }
  }
  return out
}

/** Ekstensi file (tanpa titik, lowercase). Dari nama dulu, lalu mime. */
export function fileExtension(file: File): string {
  const fromName = file.name.includes(".")
    ? file.name.split(".").pop()?.trim()
    : ""
  if (fromName) return fromName.toLowerCase()
  const fromType = file.type.split("/")[1]
  return (fromType || "bin").toLowerCase()
}

/** Format byte jadi string ringkas: `840 B`, `1.2 MB`. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB", "TB"]
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`
}

/** Dimensi natural sebuah image file, atau null kalau gagal dimuat. */
export function imageDimensions(
  file: File,
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      resolve(null)
      URL.revokeObjectURL(url)
    }
    img.src = url
  })
}

/** Ganti ekstensi nama file agar cocok dengan mime hasil kompres. */
function renameForType(name: string, mime: string): string {
  const ext = mime.split("/")[1]
  if (!ext) return name
  const base = name.includes(".")
    ? name.slice(0, name.lastIndexOf("."))
    : name
  return `${base || "image"}.${ext === "jpeg" ? "jpg" : ext}`
}
