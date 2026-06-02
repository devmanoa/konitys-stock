import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Paperclip,
  Upload,
  Trash2,
  FileText,
  FileImage,
  File as FileIcon,
  Loader2,
  Download,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card'
import Button from './ui/Button'
import { useToast } from './ui/Toast'
import api from '../services/api'
import type { ApiResponse, OrderAttachment } from '../types'

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/api$/, '')

const fullUrl = (path: string) => {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${API_BASE_URL}${path}`
}

function formatBytes(size?: number | null) {
  if (!size || size <= 0) return ''
  if (size < 1024) return `${size} o`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} Ko`
  return `${(size / (1024 * 1024)).toFixed(2)} Mo`
}

function fileTypeIcon(mime?: string | null, name?: string) {
  const ext = (name || '').toLowerCase().split('.').pop() || ''
  if (mime?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
    return <FileImage className="h-4 w-4 text-blue-500" />
  }
  if (mime === 'application/pdf' || ext === 'pdf') {
    return <FileText className="h-4 w-4 text-red-500" />
  }
  return <FileIcon className="h-4 w-4 text-[--k-muted]" />
}

interface Props {
  orderId: string
}

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB — matches the server limit

export default function OrderAttachments({ orderId }: Props) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<OrderAttachment | null>(null)

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ['order-attachments', orderId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<OrderAttachment[]>>(
        `/orders/${orderId}/attachments`,
      )
      return res.data?.data || []
    },
  })

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post<ApiResponse<OrderAttachment>>(
        `/orders/${orderId}/attachments`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-attachments', orderId] })
      toast.success('Pièce jointe ajoutée')
    },
    onError: (err: any) => {
      toast.error(
        'Erreur',
        err?.response?.data?.error || 'Impossible d\'ajouter la pièce jointe',
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      await api.delete(`/orders/${orderId}/attachments/${attachmentId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-attachments', orderId] })
      setDeleteConfirm(null)
      toast.success('Pièce jointe supprimée')
    },
    onError: () => {
      toast.error('Erreur', 'Impossible de supprimer la pièce jointe')
    },
  })

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_BYTES) {
      toast.error(
        'Fichier trop gros',
        `Le fichier dépasse 10 Mo (${(file.size / (1024 * 1024)).toFixed(1)} Mo).`,
      )
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    uploadMutation.mutate(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Paperclip className="h-5 w-5" />
          Pièces jointes
          {attachments.length > 0 && (
            <span className="text-xs text-[--k-muted] font-normal">({attachments.length})</span>
          )}
        </CardTitle>
        <div>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploadMutation.isPending}
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => fileRef.current?.click()}
            disabled={uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Envoi…
              </>
            ) : (
              <>
                <Upload className="mr-1 h-4 w-4" />
                Ajouter
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center text-sm text-[--k-muted] py-4">Chargement…</p>
        ) : attachments.length === 0 ? (
          <p className="text-center text-sm italic text-[--k-muted] py-4">
            Aucune pièce jointe. Glissez une facture, un bon de commande, une photo de palette…
          </p>
        ) : (
          <ul className="divide-y divide-[--k-border]">
            {attachments.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 px-1 py-2 hover:bg-[--k-surface-2]/30 transition-colors rounded"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[--k-surface-2]">
                  {fileTypeIcon(a.mimeType, a.filename)}
                </span>
                <div className="min-w-0 flex-1">
                  <a
                    href={fullUrl(a.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block font-medium text-[--k-primary] hover:underline truncate"
                  >
                    {a.filename}
                  </a>
                  <div className="text-[11px] text-[--k-muted]">
                    {new Date(a.uploadedAt).toLocaleDateString('fr-FR')}{' '}
                    {new Date(a.uploadedAt).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {a.uploadedByName && <> · {a.uploadedByName}</>}
                    {a.size != null && <> · {formatBytes(a.size)}</>}
                  </div>
                </div>
                <a
                  href={fullUrl(a.url)}
                  download={a.filename}
                  className="rounded-md p-1.5 text-[--k-muted] hover:bg-[--k-surface-2] hover:text-[--k-text]"
                  title="Télécharger"
                >
                  <Download className="h-4 w-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(a)}
                  className="rounded-md p-1.5 text-[--k-muted] hover:bg-red-50 hover:text-red-600"
                  title="Supprimer"
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Inline confirm — no modal */}
        {deleteConfirm && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
            <span className="text-red-700">
              Supprimer <strong>{deleteConfirm.filename}</strong> ?
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setDeleteConfirm(null)}
              >
                Annuler
              </Button>
              <Button
                size="sm"
                onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                disabled={deleteMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleteMutation.isPending ? 'Suppression…' : 'Supprimer'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
