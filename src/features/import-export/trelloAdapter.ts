import { FORMAT_ID, FORMAT_VERSION, type ExportDocV1, type ExportList } from "./exportFormat"

/**
 * Adapter Trello board JSON → dokumen `personal-kanban-export` v1.
 *
 * Hanya transform bentuk data — hasilnya tetap dilewatkan ke `validateImport`
 * oleh pemanggil, jadi semua batas (jumlah list/task, panjang deskripsi) &
 * pesan error tetap ditangani di satu tempat. Tidak mengimpor React / supabase.
 *
 * Yang dipetakan: `lists` (buang yang `closed`) → lists, `cards` (buang yang
 * `closed`) → tasks di list-nya, `checklists` di-fold jadi checkbox Markdown di
 * `description_md`, `due` → `due_date`. Yang diabaikan total: `labels`,
 * `actions`, `members`, `customFields`, `attachments`, `pluginData`.
 */

interface TrelloCheckItem {
  name?: unknown
  state?: unknown
  pos?: unknown
}
interface TrelloChecklist {
  idCard?: unknown
  name?: unknown
  pos?: unknown
  checkItems?: unknown
}
interface TrelloList {
  id?: unknown
  name?: unknown
  closed?: unknown
  pos?: unknown
}
interface TrelloCard {
  id?: unknown
  name?: unknown
  closed?: unknown
  idList?: unknown
  pos?: unknown
  due?: unknown
  desc?: unknown
}

export type AdaptResult =
  | { ok: true; doc: ExportDocV1 }
  | { ok: false; errors: string[] }

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

/**
 * Apakah `raw` terlihat seperti hasil export board Trello?
 * Sengaja longgar, tapi menolak file yang punya key `format` supaya file export
 * native Personal Kanban selalu lewat jalur validasi biasa.
 */
export function isTrelloExport(raw: unknown): boolean {
  if (!isPlainObject(raw)) return false
  if ("format" in raw) return false
  return Array.isArray(raw.cards) && Array.isArray(raw.lists)
}

/** `pos` Trello biasanya number; kadang string. Fallback 0 supaya sort tetap stabil. */
function toPos(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return 0
}

function str(v: unknown): string {
  return typeof v === "string" ? v : ""
}

/** ISO / tanggal Trello → `YYYY-MM-DD`, atau `null` bila tak bisa dipastikan valid. */
function toDueDate(v: unknown): string | null {
  if (typeof v !== "string") return null
  const head = v.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(head)) return null
  return Number.isFinite(Date.parse(head)) ? head : null
}

/**
 * Gabung `desc` kartu + semua checklist-nya jadi satu string Markdown.
 * Tiap checklist jadi heading `## <nama>` diikuti `- [ ]` / `- [x]` per item.
 * Semua bagian dipisah satu baris kosong; hasil kosong → caller ubah ke `null`.
 */
function buildDescription(desc: string, checklists: TrelloChecklist[]): string {
  const parts: string[] = []
  const base = desc.trim()
  if (base) parts.push(base)

  for (const cl of checklists) {
    const items = (Array.isArray(cl.checkItems) ? (cl.checkItems as TrelloCheckItem[]) : [])
      .slice()
      .sort((a, b) => toPos(a.pos) - toPos(b.pos))
    const lines = [`## ${str(cl.name).trim() || "Checklist"}`]
    for (const item of items) {
      const box = item.state === "complete" ? "[x]" : "[ ]"
      lines.push(`- ${box} ${str(item.name).trim()}`)
    }
    // Heading tanpa item pun tetap ditulis — informasinya nyata di board asal.
    parts.push(lines.join("\n"))
  }

  return parts.join("\n\n")
}

export function adaptTrelloExport(raw: unknown): AdaptResult {
  if (!isTrelloExport(raw)) {
    return { ok: false, errors: ["File tidak dikenali sebagai export board Trello."] }
  }
  const board = raw as Record<string, unknown>

  const projectName = str(board.name).trim() || "Trello Import"
  const projectDescription = str(board.desc).trim() || null

  // --- lists: buang closed, urut pos, catat id yang dipertahankan ---
  const rawLists = (board.lists as TrelloList[]).filter((l) => l.closed !== true)
  rawLists.sort((a, b) => toPos(a.pos) - toPos(b.pos))
  const keptListIds = new Set(
    rawLists.map((l) => str(l.id)).filter((id) => id.length > 0)
  )

  // --- checklists di-index per idCard ---
  const checklistsByCard = new Map<string, TrelloChecklist[]>()
  const rawChecklists = Array.isArray(board.checklists)
    ? (board.checklists as TrelloChecklist[])
    : []
  for (const cl of rawChecklists) {
    const cardId = str(cl.idCard)
    if (!cardId) continue
    const bucket = checklistsByCard.get(cardId)
    if (bucket) bucket.push(cl)
    else checklistsByCard.set(cardId, [cl])
  }
  for (const bucket of checklistsByCard.values()) {
    bucket.sort((a, b) => toPos(a.pos) - toPos(b.pos))
  }

  // --- cards: buang closed / list tak dikenal, group per list, urut pos ---
  const cardsByList = new Map<string, TrelloCard[]>()
  for (const card of board.cards as TrelloCard[]) {
    if (card.closed === true) continue
    const listId = str(card.idList)
    if (!keptListIds.has(listId)) continue
    const bucket = cardsByList.get(listId)
    if (bucket) bucket.push(card)
    else cardsByList.set(listId, [card])
  }
  for (const bucket of cardsByList.values()) {
    bucket.sort((a, b) => toPos(a.pos) - toPos(b.pos))
  }

  const exportedAt = new Date().toISOString()

  const lists: ExportList[] = rawLists.map((list, li) => {
    const listId = str(list.id)
    const cards = cardsByList.get(listId) ?? []
    return {
      name: str(list.name).trim() || `List ${li + 1}`,
      position: toPos(list.pos),
      tasks: cards.map((card, ci) => {
        const checklists = checklistsByCard.get(str(card.id)) ?? []
        const description = buildDescription(str(card.desc), checklists)
        return {
          title: str(card.name).trim() || "(tanpa judul)",
          description_md: description.length > 0 ? description : null,
          due_date: toDueDate(card.due),
          position: toPos(card.pos) || ci + 1,
          updated_at: exportedAt,
        }
      }),
    }
  })

  return {
    ok: true,
    doc: {
      format: FORMAT_ID,
      version: FORMAT_VERSION,
      exportedAt,
      project: { name: projectName, description: projectDescription, createdAt: exportedAt },
      lists,
    },
  }
}
