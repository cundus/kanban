import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database.types"
import {
  compressImage,
  fileExtension,
  imageDimensions,
  isAcceptedImage,
} from "@/lib/fileProcessing"

export type TaskImage = Database["public"]["Tables"]["task_images"]["Row"]

const BUCKET = "task-images"
/** Umur signed URL. Lebih panjang dari staleTime query di bawah. */
const SIGNED_URL_TTL = 60 * 60 // 1 jam (detik)

function taskImagesKey(projectId: string) {
  return ["task-images", projectId] as const
}

/**
 * Batch: semua gambar untuk semua task di satu project, dikelompokkan per
 * task_id (pola sama dgn useTaskLabels / useTaskAssignees). Dipakai TaskCard
 * (indikator jumlah) dan TaskDialog. Metadata saja — signed URL diambil
 * terpisah lewat useSignedImageUrls hanya untuk task yang dibuka.
 */
export function useTaskImages(projectId: string) {
  return useQuery({
    queryKey: taskImagesKey(projectId),
    queryFn: async (): Promise<Record<string, TaskImage[]>> => {
      const { data, error } = await supabase
        .from("task_images")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true })
      if (error) throw error
      const result: Record<string, TaskImage[]> = {}
      for (const row of (data ?? []) as TaskImage[]) {
        ;(result[row.task_id] ??= []).push(row)
      }
      return result
    },
  })
}

/**
 * Signed URL untuk sekumpulan storage path. Bucket privat, jadi tiap tampilan
 * gambar butuh URL bertanda tangan. Di-cache lebih pendek dari TTL supaya tidak
 * pernah menyajikan URL yang sudah kedaluwarsa.
 */
export function useSignedImageUrls(paths: string[]) {
  const sortedPaths = [...paths].sort()
  return useQuery({
    queryKey: ["task-image-urls", sortedPaths],
    enabled: sortedPaths.length > 0,
    staleTime: (SIGNED_URL_TTL - 5 * 60) * 1000,
    gcTime: SIGNED_URL_TTL * 1000,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(sortedPaths, SIGNED_URL_TTL)
      if (error) throw error
      const out: Record<string, string> = {}
      for (const item of data ?? []) {
        if (item.path && item.signedUrl) out[item.path] = item.signedUrl
      }
      return out
    },
  })
}

/**
 * Unggah satu atau lebih gambar ke sebuah task: kompres → upload ke storage →
 * insert baris metadata. Kalau insert gagal, object di storage dihapus lagi
 * supaya tidak jadi orphan. File non-gambar diabaikan.
 */
export function useUploadTaskImages(taskId: string, projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (files: File[]) => {
      const accepted = files.filter(isAcceptedImage)
      if (accepted.length === 0) {
        throw new Error("Hanya file gambar (PNG, JPEG, WebP, GIF) yang didukung.")
      }

      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) {
        throw userError ?? new Error("Sesi tidak ditemukan.")
      }
      const userId = userData.user.id

      for (const original of accepted) {
        const file = await compressImage(original)
        const dims = await imageDimensions(file)
        const path = `${projectId}/${taskId}/${crypto.randomUUID()}.${fileExtension(file)}`

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false })
        if (uploadError) throw uploadError

        const { error: insertError } = await supabase.from("task_images").insert({
          task_id: taskId,
          project_id: projectId,
          storage_path: path,
          mime_type: file.type,
          size_bytes: file.size,
          width: dims?.width ?? null,
          height: dims?.height ?? null,
          created_by: userId,
        })
        if (insertError) {
          await supabase.storage.from(BUCKET).remove([path])
          throw insertError
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskImagesKey(projectId) })
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Gagal mengunggah gambar.",
      )
    },
  })
}

/** Hapus satu gambar: baris metadata dulu, lalu object storage-nya. */
export function useDeleteTaskImage(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (image: Pick<TaskImage, "id" | "storage_path">) => {
      const { error } = await supabase
        .from("task_images")
        .delete()
        .eq("id", image.id)
      if (error) throw error
      await supabase.storage.from(BUCKET).remove([image.storage_path])
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskImagesKey(projectId) })
    },
    onError: () => {
      toast.error("Gagal menghapus gambar.")
    },
  })
}
