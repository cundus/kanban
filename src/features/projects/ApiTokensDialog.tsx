import { useState } from "react"
import { KeyIcon, TrashIcon, CopyIcon } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { useApiTokens, useCreateApiToken, useRevokeApiToken, type ApiToken } from "./useApiTokens"

interface ApiTokensDialogProps {
  userId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function ApiTokensDialog({ userId, open, onOpenChange }: ApiTokensDialogProps) {
  const { data: tokens, isLoading } = useApiTokens(userId)
  const createToken = useCreateApiToken(userId)
  const revokeToken = useRevokeApiToken(userId)

  const [newName, setNewName] = useState("")
  const [pendingRevoke, setPendingRevoke] = useState<ApiToken | null>(null)
  const [revealedToken, setRevealedToken] = useState<string | null>(null)

  function handleCreate() {
    if (!newName.trim()) return
    createToken.mutate(newName.trim(), {
      onSuccess: (rawToken) => { setRevealedToken(rawToken); setNewName("") },
    })
  }

  function copyRevealedToken() {
    if (!revealedToken) return
    navigator.clipboard.writeText(revealedToken)
    toast.success("Token disalin.")
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setRevealedToken(null) }}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>API Tokens</DialogTitle></DialogHeader>

        {revealedToken ? (
          <div className="flex flex-col gap-2 rounded-md border border-line bg-surface-3 p-3">
            <p className="text-label text-text-3">Salin token ini sekarang — tidak akan ditampilkan lagi.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-surface-2 px-2 py-1 text-micro text-text-1">{revealedToken}</code>
              <Button size="sm" onClick={copyRevealedToken}><CopyIcon size={14} /></Button>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setRevealedToken(null)}>Selesai</Button>
          </div>
        ) : null}

        <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
          {isLoading ? (
            <><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></>
          ) : (tokens?.length ?? 0) === 0 ? (
            <EmptyState icon={<KeyIcon size={18} strokeWidth={1.5} aria-hidden />} title="Belum ada token" />
          ) : (
            tokens?.map((token) => (
              <div key={token.id} className="flex items-center gap-2 rounded-md border border-line px-3 py-2">
                <div className="flex-1">
                  <p className="text-ui text-text-1">{token.name}</p>
                  <p className="text-micro text-text-4">
                    Dibuat {new Date(token.created_at).toLocaleDateString("id-ID")}
                    {token.last_used_at ? ` · Terakhir dipakai ${new Date(token.last_used_at).toLocaleDateString("id-ID")}` : ""}
                  </p>
                </div>
                <Button variant="ghost" size="icon-sm" aria-label={`Revoke ${token.name}`} onClick={() => setPendingRevoke(token)}>
                  <TrashIcon size={14} />
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-line-subtle pt-3">
          <Input placeholder="Nama token (mis. Claude Code)" value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1" onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
          <Button onClick={handleCreate} disabled={!newName.trim()}>Buat</Button>
        </div>
      </DialogContent>
      <ConfirmDialog
        open={!!pendingRevoke}
        onOpenChange={(v) => { if (!v) setPendingRevoke(null) }}
        title={`Cabut "${pendingRevoke?.name}"?`}
        description="Token ini tidak akan bisa dipakai lagi setelah dicabut."
        confirmLabel="Cabut"
        onConfirm={() => { if (pendingRevoke) revokeToken.mutate(pendingRevoke.id); setPendingRevoke(null) }}
      />
    </Dialog>
  )
}

export { ApiTokensDialog }
