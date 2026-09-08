import { useState } from "react"
import { KeyIcon, TrashIcon, CopyIcon } from "lucide-react"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { useApiTokens, useCreateApiToken, useRevokeApiToken, type ApiToken } from "./useApiTokens"

const MCP_ENDPOINT = "https://mcp.cundus.my.id/mcp"
const MCP_TOOLS = "list_projects, list_lists, list_labels, list_tasks, create_task, update_task, delete_task"

function buildCliCommand(token: string) {
  return `claude mcp add --transport http kanban ${MCP_ENDPOINT} --header "Authorization: Bearer ${token}"`
}

function buildMcpJson(token: string) {
  return `{
  "mcpServers": {
    "kanban": {
      "type": "http",
      "url": "${MCP_ENDPOINT}",
      "headers": {
        "Authorization": "Bearer ${token}"
      }
    }
  }
}`
}

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
  const [guideOpen, setGuideOpen] = useState(false)

  const tokenForSnippet = revealedToken ?? "<TOKEN_ANDA>"

  function handleCreate() {
    if (!newName.trim()) return
    createToken.mutate(newName.trim(), {
      onSuccess: (rawToken) => { setRevealedToken(rawToken); setNewName(""); setGuideOpen(true) },
    })
  }

  async function copyText(text: string, okMsg = "Disalin.") {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(okMsg)
    } catch (e) {
      console.error(e)
      toast.error("Gagal menyalin. Salin manual dari kotak di atas.")
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setRevealedToken(null); createToken.reset() } }}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>API Tokens</DialogTitle></DialogHeader>

        <DialogBody>
        {revealedToken ? (
          <div className="flex flex-col gap-2 rounded-md border border-line bg-surface-3 p-3">
            <p className="text-label text-text-3">Salin token ini sekarang — tidak akan ditampilkan lagi.</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-surface-2 px-2 py-1 text-micro text-text-1">{revealedToken}</code>
              <Button size="sm" aria-label="Salin token" onClick={() => copyText(revealedToken, "Token disalin.")}><CopyIcon size={14} /></Button>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setRevealedToken(null)}>Selesai</Button>
          </div>
        ) : null}

        <details
          open={guideOpen}
          onToggle={(e) => setGuideOpen(e.currentTarget.open)}
          className="rounded-md border border-line-subtle bg-surface-2"
        >
          <summary className="cursor-pointer select-none px-3 py-2 text-ui text-text-2">
            Petunjuk setup MCP
          </summary>
          <div className="flex flex-col gap-3 border-t border-line-subtle p-3">
            <p className="text-label text-text-3">
              Hubungkan AI agent (Claude Code, dll.) ke board kanban lewat server MCP. Buat token di
              bawah, lalu pakai salah satu cara berikut.
            </p>

            <div className="flex flex-col gap-1">
              <p className="text-label text-text-3">1 · Endpoint</p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded bg-surface-3 px-2 py-1 text-micro text-text-1">{MCP_ENDPOINT}</code>
                <Button size="sm" variant="ghost" aria-label="Salin endpoint" onClick={() => copyText(MCP_ENDPOINT)}><CopyIcon size={14} /></Button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <p className="text-label text-text-3">2a · Claude Code (perintah CLI)</p>
              <div className="flex items-start gap-2">
                <code className="min-w-0 flex-1 whitespace-pre-wrap break-all rounded bg-surface-3 px-2 py-1 text-micro text-text-1">{buildCliCommand(tokenForSnippet)}</code>
                <Button size="sm" variant="ghost" aria-label="Salin perintah CLI" onClick={() => copyText(buildCliCommand(tokenForSnippet))}><CopyIcon size={14} /></Button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <p className="text-label text-text-3">2b · Atau file <code className="text-micro">.mcp.json</code> / config klien MCP</p>
              <div className="flex items-start gap-2">
                <pre className="min-w-0 flex-1 overflow-x-auto rounded bg-surface-3 px-2 py-1 text-micro text-text-1"><code>{buildMcpJson(tokenForSnippet)}</code></pre>
                <Button size="sm" variant="ghost" aria-label="Salin config JSON" onClick={() => copyText(buildMcpJson(tokenForSnippet))}><CopyIcon size={14} /></Button>
              </div>
            </div>

            <p className="text-micro text-text-4">
              {revealedToken
                ? "Token barumu sudah dimasukkan ke perintah di atas."
                : "Ganti <TOKEN_ANDA> dengan token yang kamu buat di bawah."}
              {" "}Tool tersedia: {MCP_TOOLS}.
            </p>
          </div>
        </details>

        <div className="flex flex-col gap-2">
          {isLoading ? (
            <><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></>
          ) : (tokens?.length ?? 0) === 0 ? (
            <EmptyState icon={<KeyIcon size={18} strokeWidth={1.5} aria-hidden />} title="Belum ada token" />
          ) : (
            tokens?.map((token) => (
              <div key={token.id} className="flex items-center gap-2 rounded-md border border-line px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-ui text-text-1">{token.name}</p>
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
        </DialogBody>

        <DialogFooter className="flex-row items-center sm:justify-start">
          <Input placeholder="Nama token (mis. Claude Code)" value={newName} onChange={(e) => setNewName(e.target.value)} className="min-w-0 flex-1" onKeyDown={(e) => e.key === "Enter" && !createToken.isPending && handleCreate()} />
          <Button onClick={handleCreate} disabled={!newName.trim() || createToken.isPending}>Buat</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
      <ConfirmDialog
        open={!!pendingRevoke}
        onOpenChange={(v) => { if (!v) setPendingRevoke(null) }}
        title={`Cabut "${pendingRevoke?.name}"?`}
        description="Token ini tidak akan bisa dipakai lagi setelah dicabut."
        confirmLabel="Cabut"
        onConfirm={() => { if (pendingRevoke) revokeToken.mutate(pendingRevoke.id); setPendingRevoke(null) }}
      />
    </>
  )
}

export { ApiTokensDialog }
