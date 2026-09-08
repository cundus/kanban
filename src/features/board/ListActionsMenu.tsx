import { MoreHorizontalIcon, PencilIcon, PlusIcon, TrashIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu"

interface ListActionsMenuProps {
  onRename: () => void
  onAddToTop: () => void
  onDeleteRequest: () => void
}

function ListActionsMenu({ onRename, onAddToTop, onDeleteRequest }: ListActionsMenuProps) {
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="List actions"
            className="opacity-0 transition-opacity group-hover/list:opacity-100 sm:opacity-0 max-sm:opacity-100"
          >
            <MoreHorizontalIcon size={14} />
          </Button>
        }
      />
      <MenuContent>
        <MenuItem onClick={onRename}>
          <PencilIcon /> Rename
        </MenuItem>
        <MenuItem onClick={onAddToTop}>
          <PlusIcon /> Add task to top
        </MenuItem>
        <MenuSeparator />
        <MenuItem className="text-danger" onClick={onDeleteRequest}>
          <TrashIcon /> Delete list
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}

export { ListActionsMenu }
