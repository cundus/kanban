import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip } from "@/components/ui/tooltip"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useMembership } from "./useMembership"
import {
  useInviteMember,
  useLeaveProject,
  useMembers,
  useRemoveMember,
  type MemberRow,
} from "./useMembers"

const EMAIL_RE = /^\S+@\S+\.\S+$/

export function MembersDialog({
  projectId,
  projectName,
  open,
  onOpenChange,
}: {
  projectId: string
  projectName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const { data: membership } = useMembership(projectId)
  const isOwner = membership?.role === "owner"
  const isMember = membership?.role === "member"

  const { data: members, isLoading } = useMembers(projectId)
  const inviteMember = useInviteMember(projectId)
  const removeMember = useRemoveMember(projectId)
  const leaveProject = useLeaveProject(projectId)

  const [email, setEmail] = useState("")
  const [pendingRemoval, setPendingRemoval] = useState<MemberRow | null>(null)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const emailValid = EMAIL_RE.test(email.trim())

  function handleInvite() {
    if (!emailValid || inviteMember.isPending) return
    inviteMember.mutate(email.trim(), { onSuccess: () => setEmail("") })
  }

  function handleCopyLink() {
    void navigator.clipboard.writeText(
      `${window.location.origin}/projects/${projectId}`
    )
    toast.success("Invite link copied.")
  }

  function handleLeave() {
    leaveProject.mutate(undefined, {
      onSuccess: () => {
        onOpenChange(false)
        navigate("/")
      },
    })
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Members — {projectName}</DialogTitle>
        </DialogHeader>

        <DialogBody>
        {isOwner && (
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="name@example.com"
              aria-label="Invite by email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              className="min-w-0 flex-1"
            />
            <Button
              onClick={handleInvite}
              disabled={!emailValid || inviteMember.isPending}
            >
              Invite
            </Button>
          </div>
        )}

        <ul className="flex flex-col gap-1" aria-busy={isLoading}>
          {isLoading &&
            [0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-3 px-2 py-1.5">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <Skeleton className="h-4 flex-1" />
              </li>
            ))}
          {!isLoading && (members?.length ?? 0) === 0 && (
            <li className="rounded-md border border-dashed border-line px-3 py-6 text-center text-label text-text-3">
              No members yet. Invite someone by email to share this board.
            </li>
          )}
          {members?.map((member) => (
            <MemberListItem
              key={member.id}
              member={member}
              isOwner={isOwner}
              onRemove={() => setPendingRemoval(member)}
              onCopyLink={handleCopyLink}
            />
          ))}
        </ul>
        </DialogBody>

        {isMember && (
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() => setLeaveOpen(true)}
              disabled={leaveProject.isPending}
            >
              Leave project
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>

      <ConfirmDialog
        open={pendingRemoval !== null}
        onOpenChange={(o) => !o && setPendingRemoval(null)}
        title={`Remove ${
          pendingRemoval?.profile?.full_name ?? pendingRemoval?.invited_email
        }?`}
        description="They lose access to this project immediately. You can invite them again later."
        confirmLabel="Remove"
        onConfirm={() => {
          if (pendingRemoval) removeMember.mutate(pendingRemoval.id)
          setPendingRemoval(null)
        }}
      />

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="Leave this project?"
        description="You lose access to its lists and tasks until someone invites you back."
        confirmLabel="Leave"
        onConfirm={handleLeave}
      />
    </>
  )
}

function MemberListItem({
  member,
  isOwner,
  onRemove,
  onCopyLink,
}: {
  member: MemberRow
  isOwner: boolean
  onRemove: () => void
  onCopyLink: () => void
}) {
  const isPending = member.status === "pending"
  const name =
    member.profile?.full_name ??
    (isPending ? member.invited_email : member.profile?.email) ??
    member.invited_email
  const email = member.profile?.email ?? member.invited_email
  const initial = (name || email || "?").charAt(0).toUpperCase()
  const canRemove = isOwner && member.role === "member"

  return (
    <li className="group/member flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors [transition-duration:var(--dur-fast)] hover:bg-surface-3">
      <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-3 text-label text-text-2">
        {member.profile?.avatar_url ? (
          <img
            src={member.profile.avatar_url}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          initial
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-ui text-text-1">{name}</p>
        {name !== email && (
          <p className="truncate text-micro text-text-3">{email}</p>
        )}
      </div>

      <RoleBadge role={member.role} status={member.status} />

      {isPending && isOwner && (
        <Button size="sm" variant="ghost" onClick={onCopyLink}>
          Copy link
        </Button>
      )}
      {canRemove && (
        <Tooltip label={isPending ? "Cancel invite" : "Remove member"}>
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={onRemove}
            aria-label={isPending ? `Cancel invite for ${name}` : `Remove ${name}`}
            className="opacity-0 hover:text-danger group-hover/member:opacity-100 focus-visible:opacity-100"
          >
            <XIcon size={12} strokeWidth={1.5} aria-hidden />
          </Button>
        </Tooltip>
      )}
    </li>
  )
}

function RoleBadge({
  role,
  status,
}: {
  role: "owner" | "member"
  status: "pending" | "accepted"
}) {
  if (status === "pending") {
    return (
      <span className="rounded-xs border border-line bg-surface-3 px-1.5 py-0.5 text-micro text-text-3">
        Pending
      </span>
    )
  }
  if (role === "owner") {
    return (
      <span className="rounded-xs border border-accent-line bg-accent-soft px-1.5 py-0.5 text-micro text-accent-solid">
        Owner
      </span>
    )
  }
  return (
    <span className="rounded-xs border border-line px-1.5 py-0.5 text-micro text-text-3">
      Member
    </span>
  )
}
