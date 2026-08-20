import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Check, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './ui/Toast';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import Button from './ui/Button';
import RichTextEditor from './ui/RichTextEditor';
import RichTextDisplay from './ui/RichTextDisplay';
import OperatorAvatar from './OperatorAvatar';
import api from '../services/api';
import type { ProductComment, KnownUser, ApiResponse } from '../types';
import Spinner from './ui/Spinner'

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "A l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffHour < 24) return `Il y a ${diffHour}h`;
  if (diffDay < 7) return `Il y a ${diffDay}j`;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function AuthorAvatar({ name }: { name: string }) {
  return <OperatorAvatar name={name} size="md" showName={false} />;
}

// Render comment HTML content safely with styled elements. Goes through
// DOMPurify via RichTextDisplay to strip any script tags / event handlers
// that might have been injected by a malicious commenter.
function CommentContent({ html }: { html: string }) {
  return (
    <RichTextDisplay
      content={html}
      className="text-[13px] text-[--k-text] break-words"
      emptyFallback={null}
    />
  );
}

interface CommentsProps {
  entityType: 'products' | 'orders';
  entityId: string;
}

export default function Comments({ entityType, entityId }: CommentsProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const queryKey = [`${entityType}-comments`, entityId];
  const apiBase = `/${entityType}/${entityId}/comments`;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState(0);

  // Fetch comments
  const { data: commentsData, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: ProductComment[]; pagination: any }>(
        `${apiBase}?limit=100`
      );
      return res.data;
    },
  });

  const comments = commentsData?.data || [];

  // Fetch known users for @mention
  const fetchMentions = useCallback(
    async (query: string): Promise<KnownUser[]> => {
      try {
        const params = query ? `?search=${encodeURIComponent(query)}` : '';
        const res = await api.get<ApiResponse<KnownUser[]>>(`/users/known${params}`);
        return res.data?.data || [];
      } catch {
        return [];
      }
    },
    []
  );

  // Create comment
  const createMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await api.post(apiBase, { content });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setEditorKey((k) => k + 1);
    },
    onError: (error: any) => {
      toast.error('Erreur', error?.response?.data?.error || 'Impossible de poster le commentaire');
    },
  });

  // Update comment
  const updateMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const res = await api.put(`${apiBase}/${id}`, { content });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setEditingId(null);
      setEditContent('');
    },
    onError: (error: any) => {
      toast.error('Erreur', error?.response?.data?.error || 'Impossible de modifier le commentaire');
    },
  });

  // Delete comment
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`${apiBase}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setDeleteConfirmId(null);
    },
    onError: (error: any) => {
      toast.error('Erreur', error?.response?.data?.error || 'Impossible de supprimer le commentaire');
    },
  });

  const handleSubmit = (html: string) => {
    const isEmpty = !html || html === '<p></p>';
    if (isEmpty) return;
    createMutation.mutate(html);
  };

  const handleEditSubmit = (html: string) => {
    if (!editingId) return;
    const isEmpty = !html || html === '<p></p>';
    if (isEmpty) return;
    updateMutation.mutate({ id: editingId, content: html });
  };

  const startEdit = (comment: ProductComment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Commentaires ({comments.length})
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Comment input */}
        <div className="mb-6">
          <div className="flex items-start gap-3">
            {user && <AuthorAvatar name={user.fullName || user.username} />}
            <div className="flex-1">
              <RichTextEditor
                editorKey={editorKey}
                placeholder="Ajouter un commentaire... (utilisez @ pour mentionner)"
                onSubmit={handleSubmit}
                isSubmitting={createMutation.isPending}
                fetchMentions={fetchMentions}
              />
            </div>
          </div>
        </div>

        {/* Comments list */}
        {isLoading ? (
          <Spinner size="md" className="py-8" />
        ) : comments.length === 0 ? (
          <p className="text-center text-[13px] text-[--k-muted] py-6 italic">
            Aucun commentaire pour le moment
          </p>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => {
              const isAuthor = user?.id === comment.authorId;
              const isEditing = editingId === comment.id;

              return (
                <div key={comment.id} className="flex gap-3">
                  <AuthorAvatar name={comment.authorName} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[13px] font-semibold text-[--k-text]">
                        {comment.authorName}
                      </span>
                      <span className="text-[11px] text-[--k-muted]">
                        @{comment.authorUsername}
                      </span>
                      <span className="text-[11px] text-[--k-muted]">
                        {formatRelativeTime(comment.createdAt)}
                      </span>
                      {comment.updatedAt !== comment.createdAt && (
                        <span className="text-[11px] text-[--k-muted] italic">(modifié)</span>
                      )}
                    </div>

                    {isEditing ? (
                      <div>
                        <RichTextEditor
                          content={editContent}
                          onSubmit={handleEditSubmit}
                          onChange={setEditContent}
                          isSubmitting={updateMutation.isPending}
                          fetchMentions={fetchMentions}
                          showToolbar={false}
                          autoFocus
                        />
                        <div className="flex gap-2 mt-1">
                          <Button
                            size="sm"
                            onClick={() => handleEditSubmit(editContent)}
                            disabled={!editContent.trim() || editContent === '<p></p>' || updateMutation.isPending}
                          >
                            <Check className="mr-1 h-3.5 w-3.5" />
                            Enregistrer
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(null);
                              setEditContent('');
                            }}
                          >
                            <X className="mr-1 h-3.5 w-3.5" />
                            Annuler
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <CommentContent html={comment.content} />
                    )}

                    {/* Actions (edit/delete) for the author */}
                    {isAuthor && !isEditing && (
                      <div className="flex gap-1 mt-1">
                        <button
                          type="button"
                          onClick={() => startEdit(comment)}
                          className="text-[11px] text-[--k-muted] hover:text-[--k-primary] transition-colors"
                        >
                          Modifier
                        </button>
                        <span className="text-[11px] text-[--k-muted]">·</span>
                        {deleteConfirmId === comment.id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => deleteMutation.mutate(comment.id)}
                              className="text-[11px] text-red-600 hover:text-red-700 font-medium transition-colors"
                              disabled={deleteMutation.isPending}
                            >
                              Confirmer
                            </button>
                            <span className="text-[11px] text-[--k-muted]">·</span>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(null)}
                              className="text-[11px] text-[--k-muted] hover:text-[--k-text] transition-colors"
                            >
                              Annuler
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(comment.id)}
                            className="text-[11px] text-[--k-muted] hover:text-red-600 transition-colors"
                          >
                            Supprimer
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
