import { useState, type RefObject } from "react"
import { ChevronLeftIcon, ChevronRightIcon, Loader2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { TaskImage } from "./useTaskImages"

function ViewerImage({ url, number, loading }: { url?: string; number: number; loading: boolean }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading")
  const failed = status === "error" || (!url && !loading)

  return (
    <div className="relative flex h-[min(70dvh,48rem)] min-h-0 w-full items-center justify-center">
      {failed ? (
        <p role="alert" className="text-label text-text-3">Gagal memuat gambar. Tutup dan buka kembali untuk mencoba lagi.</p>
      ) : (
        <>
          {status !== "loaded" && <span role="status" aria-label="Loading image" className="absolute"><Loader2Icon className="size-6 animate-spin text-text-3" /></span>}
          {url && <img src={url} alt={`Task image ${number}`} className="block max-h-full max-w-full object-contain" onLoad={() => setStatus("loaded")} onError={() => setStatus("error")} />}
        </>
      )}
    </div>
  )
}

export function TaskImageViewer({ images, urls, loading, activeId, onSelect, onClose, returnFocus }: {
  images: TaskImage[]
  urls?: Record<string, string>
  loading: boolean
  activeId: string | null
  onSelect: (id: string) => void
  onClose: () => void
  returnFocus: RefObject<HTMLButtonElement>
}) {
  const index = images.findIndex(image => image.id === activeId)
  const image = images[index]
  const navigate = (direction: number) => {
    if (images.length > 1 && index >= 0) onSelect(images[(index + direction + images.length) % images.length].id)
  }
  const url = image ? urls?.[image.storage_path] : undefined

  return (
    <Dialog open={!!image} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent size="lg" className="sm:max-w-5xl" finalFocus={returnFocus} onKeyDown={event => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault()
          navigate(event.key === "ArrowLeft" ? -1 : 1)
        }
      }}>
        {image && <>
          <DialogHeader><DialogTitle>Image {index + 1} of {images.length}</DialogTitle></DialogHeader>
          <DialogBody className="p-4"><ViewerImage key={`${image.id}:${url ?? ""}`} url={url} number={index + 1} loading={loading} /></DialogBody>
          {images.length > 1 && <DialogFooter className="flex-row items-center justify-between">
            <Button variant="outline" aria-label="Previous image" onClick={() => navigate(-1)}><ChevronLeftIcon />Previous</Button>
            <span aria-live="polite" className="text-micro text-text-3">{index + 1} / {images.length}</span>
            <Button variant="outline" aria-label="Next image" onClick={() => navigate(1)}>Next<ChevronRightIcon /></Button>
          </DialogFooter>}
        </>}
      </DialogContent>
    </Dialog>
  )
}
