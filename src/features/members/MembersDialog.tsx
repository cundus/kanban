import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
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
  const emailValid = EMAIL_RE.test(email.trim())

  function handleInvite() {
    if (!emailValid || inviteMember.isPending) return
    inviteMember.mutate(email.trim(), { onSuccess: () => setEmail("") })
  }

  function handleRemove(member: MemberRow) {
    const label = member.profile?.full_name ?? member.invited_email
    if (window.confirm(`Hapus ${label} dari project?`)) {
      removeMember.mutate(member.id)
    }
  }

  function handleCopyLink() {
    void navigator.clipboard.writeText(
      `${window.location.origin}/projects/${projectId}`
    )
    toast.success("Link undangan disalin.")
  }

  function handleLeave() {
    if (
      window.confirm("Keluar dari project ini? Kamu akan kehilangan aksesnya.")
    ) {
      leaveProject.mutate(undefined, {
        onSuccess: () => {
          onOpenChange(false)
          navigate("/")
        },
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Members — {projectName}</DialogTitle>
        </DialogHeader>

        {isOwner && (
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="email@contoh.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
            />
            <Button
              onClick={handleInvite}
              disabled={!emailValid || inviteMember.isPending}
            >
              Invite
            </Button>
          </div>
        )}

        <ul className="flex flex-col gap-1">
          {isLoading && (
            <li className="px-2 py-1.5 text-sm text-muted-foreground">
              Loading...
            </li>
          )}
          {!isLoading && (members?.length ?? 0) === 0 && (
            <li className="px-2 py-1.5 text-sm text-muted-foreground">
              Belum ada member.
            </li>
          )}
          {members?.map((member) => (
            <MemberListItem
              key={member.id}
              member={member}
              isOwner={isOwner}
              onRemove={() => handleRemove(member)}
              onCopyLink={handleCopyLink}
            />
          ))}
        </ul>

        {isMember && (
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={handleLeave}
              disabled={leaveProject.isPending}
            >
              Leave project
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
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
    <li className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
      <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-medium">
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
        <p className="truncate text-sm font-medium">{name}</p>
        {name !== email && (
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        )}
      </div>

      <RoleBadge role={member.role} status={member.status} />

      {isPending && isOwner && (
        <Button size="sm" variant="ghost" onClick={onCopyLink}>
          Copy link
        </Button>
      )}
      {canRemove && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onRemove}
          aria-label={isPending ? "Cancel invite" : "Remove member"}
        >
          ✕
        </Button>
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
      <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
        Pending
      </span>
    )
  }
  if (role === "owner") {
    return (
      <span className="rounded-md bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
        Owner
      </span>
    )
  }
  return (
    <span className="rounded-md border px-1.5 py-0.5 text-xs text-muted-foreground">
      Member
    </span>
  )
}
