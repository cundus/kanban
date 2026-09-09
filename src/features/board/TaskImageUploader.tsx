import { useEffect, useRef, useState } from "react"
import { ImagePlusIcon, Loader2Icon, Trash2Icon } from "lucide-react"
import { cn } from "cn"
import { Label } from "@/components/ui/label"
import {
  ACCEPTED_IMAGE_TYPES,
  formatBytes,
  imagesFromClipboard,
} from "@/lib/fileProcessing"
import {
  useDeleteTaskImage,
  useSignedImageUrls,
  useUploadTaskImages,
  type TaskImage,
} from "./useTaskImages"

/**
 * Uploader + galeri gambar sebuah task. Dirender di TaskDialog persis di bawah
 * composer description. Sumber gambar: klik (file picker), drag-drop, atau
 * paste clipboard di mana saja selama dialog terbuka. Satu task boleh punya
 * banyak gambar.
 */
export function TaskImageUploader({
  taskId,
  projectId,
  images,
}: {
  taskId: string
  projectId: string
  images: TaskImage[]
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const upload = useUploadTaskImages(taskId, projectId)
  const remove = useDeleteTaskImage(projectId)

  const { data: urls } = useSignedImageUrls(images.map((i) => i.storage_path))

  const submit = (files: File[]) => {
    if (files.length > 0 && !upload.isPending) upload.mutate(files)
  }

  // Paste di mana saja selama dialog terbuka: kalau clipboard berisi file
  // gambar, langsung jadi lampiran — tangkap di fase capture supaya editor
  // markdown tidak ikut memproses gambar yang sama. Paste teks/URL (termasuk
  // di dalam editor & input) tidak tersentuh karena handler langsung keluar
  // saat tidak ada file gambar.
  const submitRef = useRef(submit)
  submitRef.current = submit
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = imagesFromClipboard(e.clipboardData)
      if (files.length === 0) return
      e.preventDefault()
      e.stopPropagation()
      submitRef.current(files)
    }
    document.addEventListener("paste", onPaste, true)
    return () => document.removeEventListener("paste", onPaste, true)
  }, [])

  return (
    <div className="flex flex-col gap-2">
      <Label>Images</Label>

      <div
        role="button"
        tabIndex={0}
        aria-label="Tambah gambar: klik atau tarik"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          submit(Array.from(e.dataTransfer.files))
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed px-3 py-4 text-center text-label transition-colors [transition-duration:var(--dur-fast)] outline-none focus-visible:border-accent-line focus-visible:ring-3 focus-visible:ring-accent-soft",
          dragOver
            ? "border-accent-line bg-accent-soft text-accent-solid"
            : "border-line text-text-3 hover:border-line-strong hover:text-text-2",
        )}
      >
        {upload.isPending ? (
          <span className="flex items-center gap-1.5">
            <Loader2Icon className="size-4 animate-spin" />
            Mengunggah…
          </span>
        ) : (
          <>
            <ImagePlusIcon className="size-5" />
            <span>Klik atau tarik gambar ke sini</span>
            <span className="text-micro text-text-4">
              atau paste (Ctrl/⌘+V) di mana saja
            </span>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        multiple
        hidden
        onChange={(e) => {
          submit(Array.from(e.target.files ?? []))
          e.target.value = ""
        }}
      />

      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {images.map((image) => {
            const url = urls?.[image.storage_path]
            return (
              <li
                key={image.id}
                className="group/img relative overflow-hidden rounded-md border border-line bg-surface-1"
              >
                {url ? (
                  <a href={url} target="_blank" rel="noreferrer">
                    <img
                      src={url}
                      alt=""
                      loading="lazy"
                      className="aspect-video w-full object-cover"
                    />
                  </a>
                ) : (
                  <div className="aspect-video w-full animate-pulse bg-surface-3" />
                )}
                <div className="flex items-center justify-between gap-1 px-2 py-1 text-micro text-text-4">
                  <span>{formatBytes(image.size_bytes)}</span>
                  <button
                    type="button"
                    onClick={() => remove.mutate(image)}
                    disabled={remove.isPending}
                    aria-label="Hapus gambar"
                    className="rounded p-0.5 text-text-4 opacity-0 transition-opacity [transition-duration:var(--dur-fast)] hover:text-danger group-hover/img:opacity-100 disabled:pointer-events-none disabled:opacity-40 max-sm:opacity-100"
                  >
                    <Trash2Icon className="size-3.5" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
