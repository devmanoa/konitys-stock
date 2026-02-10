import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Button from '../ui/Button';
import Input from '../ui/Input';
import api from '../../services/api';
import type { SupplierContact, ApiResponse } from '../../types';

interface CreateSupplierContactInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  position?: string;
  description?: string;
}

interface SupplierContactFormProps {
  supplierId: string;
  contact?: SupplierContact;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function SupplierContactForm({ supplierId, contact, onSuccess, onCancel }: SupplierContactFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!contact;

  const [formData, setFormData] = useState<CreateSupplierContactInput>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    position: '',
    description: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (contact) {
      setFormData({
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email || '',
        phone: contact.phone || '',
        position: contact.position || '',
        description: contact.description || '',
      });
    }
  }, [contact]);

  const createMutation = useMutation({
    mutationFn: async (data: CreateSupplierContactInput) => {
      const res = await api.post<ApiResponse<SupplierContact>>(`/suppliers/${supplierId}/contacts`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier', supplierId] });
      onSuccess();
    },
    onError: (error: any) => {
      if (error.response?.data?.details) {
        const fieldErrors: Record<string, string> = {};
        error.response.data.details.forEach((e: { field: string; message: string }) => {
          fieldErrors[e.field] = e.message;
        });
        setErrors(fieldErrors);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: CreateSupplierContactInput) => {
      const res = await api.put<ApiResponse<SupplierContact>>(`/suppliers/${supplierId}/contacts/${contact!.id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier', supplierId] });
      onSuccess();
    },
    onError: (error: any) => {
      if (error.response?.data?.details) {
        const fieldErrors: Record<string, string> = {};
        error.response.data.details.forEach((e: { field: string; message: string }) => {
          fieldErrors[e.field] = e.message;
        });
        setErrors(fieldErrors);
      }
    },
  });

  const handleChange = (field: keyof CreateSupplierContactInput, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'Le prénom est requis';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Le nom est requis';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email invalide';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const data = {
      ...formData,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      position: formData.position || undefined,
      description: formData.description || undefined,
    };

    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
            Prénom <span className="text-[--k-danger]">*</span>
          </label>
          <Input
            value={formData.firstName}
            onChange={(e) => handleChange('firstName', e.target.value)}
            placeholder="Prénom"
            className={errors.firstName ? 'border-[--k-danger]' : ''}
          />
          {errors.firstName && (
            <p className="mt-1 text-[13px] text-[--k-danger]">{errors.firstName}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
            Nom <span className="text-[--k-danger]">*</span>
          </label>
          <Input
            value={formData.lastName}
            onChange={(e) => handleChange('lastName', e.target.value)}
            placeholder="Nom"
            className={errors.lastName ? 'border-[--k-danger]' : ''}
          />
          {errors.lastName && (
            <p className="mt-1 text-[13px] text-[--k-danger]">{errors.lastName}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
            Email
          </label>
          <Input
            type="email"
            value={formData.email || ''}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="email@example.com"
            className={errors.email ? 'border-[--k-danger]' : ''}
          />
          {errors.email && (
            <p className="mt-1 text-[13px] text-[--k-danger]">{errors.email}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
            Téléphone
          </label>
          <Input
            value={formData.phone || ''}
            onChange={(e) => handleChange('phone', e.target.value)}
            placeholder="01 23 45 67 89"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
          Poste
        </label>
        <Input
          value={formData.position || ''}
          onChange={(e) => handleChange('position', e.target.value)}
          placeholder="Ex: Responsable commercial"
        />
      </div>

      <div>
        <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
          Description
        </label>
        <textarea
          value={formData.description || ''}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Notes ou informations supplémentaires..."
          rows={2}
          className="input-field"
          style={{ height: 'auto', padding: '0.5rem 0.75rem' }}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 border-t border-[--k-border] pt-4">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
          Annuler
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Enregistrement...' : isEditing ? 'Modifier' : 'Ajouter'}
        </Button>
      </div>
    </form>
  );
}
