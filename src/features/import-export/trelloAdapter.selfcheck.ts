import { FORMAT_ID, FORMAT_VERSION } from "./exportFormat"
import { validateImport } from "./importValidation"
import { adaptTrelloExport, isTrelloExport, type AdaptResult } from "./trelloAdapter"

function assert(cond: boolean, label: string) {
  if (!cond) {
    console.error(`FAIL: ${label}`)
    process.exit(1)
  }
  console.log(`PASS: ${label}`)
}

function assertEqual(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) {
    console.error(`FAIL: ${label}\n  expected: ${e}\n  actual:   ${a}`)
    process.exit(1)
  }
  console.log(`PASS: ${label}`)
}

function ok(res: AdaptResult) {
  if ("errors" in res) {
    console.error(`FAIL: adapter unexpectedly errored: ${JSON.stringify(res.errors)}`)
    process.exit(1)
  }
  return res.doc
}

/** Board mini yang meniru bentuk export Trello asli (lihat docs/export-trello.json). */
function trelloBoard() {
  return {
    id: "b1",
    name: "Cundus Transition Tasklist",
    desc: "",
    closed: false,
    lists: [
      { id: "l-done", name: "DONE", closed: false, pos: 49152 },
      { id: "l-todo", name: "TODO", closed: false, pos: 16384 },
      { id: "l-doing", name: "DOING", closed: false, pos: 32768 },
      { id: "l-archived", name: "OLD", closed: true, pos: 8192 },
    ],
    cards: [
      {
        id: "c-2",
        name: "Invoice Submit",
        closed: false,
        idList: "l-doing",
        pos: 200,
        due: null,
        desc: "",
        idChecklists: [],
      },
      {
        id: "c-1",
        name: "Integrasi Admin Dashboard",
        closed: false,
        idList: "l-todo",
        pos: 100,
        due: "2026-10-01T00:00:00.000Z",
        desc: "Fully integration di halaman admin dashboard",
        idChecklists: ["ck-1"],
      },
      {
        id: "c-3",
        name: "DOCS - USER MANUAL",
        closed: false,
        idList: "l-doing",
        pos: 100,
        due: null,
        desc: "Create comprehensive documentation",
        idChecklists: ["ck-2"],
      },
      {
        id: "c-archived",
        name: "Old card",
        closed: true,
        idList: "l-doing",
        pos: 50,
        due: null,
        desc: "",
        idChecklists: [],
      },
      {
        id: "c-orphan",
        name: "Card in archived list",
        closed: false,
        idList: "l-archived",
        pos: 10,
        due: null,
        desc: "",
        idChecklists: [],
      },
    ],
    checklists: [
      {
        id: "ck-2",
        idCard: "c-3",
        name: "E-FORM",
        pos: 100,
        checkItems: [
          { name: "Tech Docs", state: "incomplete", pos: 200 },
          { name: "User Manual", state: "complete", pos: 100 },
        ],
      },
      {
        id: "ck-1",
        idCard: "c-1",
        name: "Checklist",
        pos: 100,
        checkItems: [
          { name: "Delete Button", state: "incomplete", pos: 100 },
          { name: "Whatsapp Button", state: "incomplete", pos: 200 },
        ],
      },
    ],
    labels: [{ id: "lb1", name: "E-FORM", color: "green" }],
    actions: [{ id: "a1", type: "commentCard" }],
    members: [{ id: "m1", fullName: "Someone" }],
  }
}

// 1. Deteksi.
assert(isTrelloExport(trelloBoard()) === true, "isTrelloExport → true untuk board Trello")
assert(
  isTrelloExport({ format: FORMAT_ID, version: FORMAT_VERSION, cards: [], lists: [] }) === false,
  "isTrelloExport → false bila ada key 'format' (file native menang)"
)
for (const bad of ["x", null, [] as unknown, 3, { cards: [] }, { lists: [] }]) {
  assert(isTrelloExport(bad) === false, `isTrelloExport → false untuk ${JSON.stringify(bad)}`)
}

// 2. Bentuk dokumen hasil adaptasi.
{
  const doc = ok(adaptTrelloExport(trelloBoard()))
  assertEqual(doc.format, FORMAT_ID, "doc.format = personal-kanban-export")
  assertEqual(doc.version, FORMAT_VERSION, "doc.version = 1")
  assertEqual(doc.project.name, "Cundus Transition Tasklist", "board.name → project.name")
  assertEqual(doc.project.description, null, "board.desc kosong → project.description null")
}

// 3. Lists: closed dibuang, sisanya urut pos.
{
  const doc = ok(adaptTrelloExport(trelloBoard()))
  assertEqual(
    doc.lists.map((l) => l.name),
    ["TODO", "DOING", "DONE"],
    "list closed dibuang; sisanya urut pos (TODO<DOING<DONE)"
  )
}

// 4. Cards: closed + list-tak-dikenal dibuang, group ke list benar, urut pos.
{
  const doc = ok(adaptTrelloExport(trelloBoard()))
  const byName = Object.fromEntries(doc.lists.map((l) => [l.name, l.tasks.map((t) => t.title)]))
  assertEqual(byName["TODO"], ["Integrasi Admin Dashboard"], "card ke list TODO")
  assertEqual(
    byName["DOING"],
    ["DOCS - USER MANUAL", "Invoice Submit"],
    "DOING: card closed dibuang, sisanya urut pos (100 < 200)"
  )
  assertEqual(byName["DONE"], [], "DONE kosong")
}

// 5. Checklist di-fold ke description_md sebagai checkbox Markdown, item urut pos.
{
  const doc = ok(adaptTrelloExport(trelloBoard()))
  const todo = doc.lists.find((l) => l.name === "TODO")!
  assertEqual(
    todo.tasks[0].description_md,
    "Fully integration di halaman admin dashboard\n\n## Checklist\n- [ ] Delete Button\n- [ ] Whatsapp Button",
    "desc + checklist → Markdown, item urut pos"
  )
}

// 6. Card tanpa desc tapi punya checklist → tidak ada baris kosong nyasar di depan;
//    state 'complete' → [x].
{
  const doc = ok(adaptTrelloExport(trelloBoard()))
  const doing = doc.lists.find((l) => l.name === "DOING")!
  const docsCard = doing.tasks.find((t) => t.title === "DOCS - USER MANUAL")!
  assertEqual(
    docsCard.description_md,
    "Create comprehensive documentation\n\n## E-FORM\n- [x] User Manual\n- [ ] Tech Docs",
    "state complete → [x]; item urut pos"
  )
}

// 7. due ISO → due_date YYYY-MM-DD; null tetap null.
{
  const doc = ok(adaptTrelloExport(trelloBoard()))
  const todo = doc.lists.find((l) => l.name === "TODO")!
  assertEqual(todo.tasks[0].due_date, "2026-10-01", "due ISO → 2026-10-01")
  const doing = doc.lists.find((l) => l.name === "DOING")!
  assertEqual(doing.tasks[1].due_date, null, "due null → null")
}

// 8. Fallback: board tanpa nama.
{
  const doc = ok(adaptTrelloExport({ ...trelloBoard(), name: "   " }))
  assertEqual(doc.project.name, "Trello Import", "board.name kosong → 'Trello Import'")
}

// 9. Round-trip: hasil adaptasi lolos validateImport apa adanya.
{
  const doc = ok(adaptTrelloExport(trelloBoard()))
  const res = validateImport(doc)
  assert(res.ok === true, "validateImport(adaptTrelloExport(board)).ok === true")
}

// 10. Bukan board Trello → error, bukan throw.
{
  const res = adaptTrelloExport({ hello: "world" })
  assert("errors" in res, "input non-Trello → { errors }")
}

console.log("All trelloAdapter self-checks passed.")
