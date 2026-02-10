import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import api from '../../services/api';
import type { Supplier, ApiResponse } from '../../types';

// Fonction de géocodage via Nominatim (OpenStreetMap)
const geocodeAddress = async (address: string, postalCode: string, city: string, country: string): Promise<{ lat: number; lon: number } | null> => {
  // Besoin d'au moins adresse + ville ou CP + ville pour une recherche fiable
  if (!city && !postalCode) return null;
  if (!address && !postalCode) return null;

  const parts = [address, postalCode, city, country].filter(Boolean);
  const query = parts.join(', ');

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
      {
        headers: {
          'Accept-Language': 'fr',
        },
      }
    );
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
      };
    }
    return null;
  } catch (error) {
    console.error('Erreur de géocodage:', error);
    return null;
  }
};

interface CreateSupplierInput {
  name: string;
  contact?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
  comment?: string;
}

interface SupplierFormProps {
  supplier?: Supplier;
  onSuccess: () => void;
  onCancel: () => void;
}

// Fonction pour vérifier si c'est un téléphone portable (à rejeter)
const isMobilePhone = (phone: string): boolean => {
  const cleanPhone = phone.replace(/[\s.-]/g, '');
  // Portable français: 06, 07 ou +33 6, +33 7
  return /^(?:(?:\+|00)33[\s.-]?[67]|0[67])/.test(cleanPhone);
};

export default function SupplierForm({ supplier, onSuccess, onCancel }: SupplierFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!supplier;

  const [formData, setFormData] = useState<CreateSupplierInput>({
    name: '',
    contact: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    postalCode: '',
    city: '',
    country: 'France',
    latitude: null,
    longitude: null,
    comment: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeStatus, setGeocodeStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const geocodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (supplier) {
      setFormData({
        name: supplier.name,
        contact: supplier.contact || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        website: supplier.website || '',
        address: supplier.address || '',
        postalCode: supplier.postalCode || '',
        city: supplier.city || '',
        country: supplier.country || 'France',
        latitude: supplier.latitude ?? null,
        longitude: supplier.longitude ?? null,
        comment: supplier.comment || '',
      });
    }
  }, [supplier]);

  const createMutation = useMutation({
    mutationFn: async (data: CreateSupplierInput) => {
      const res = await api.post<ApiResponse<Supplier>>('/suppliers', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
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
    mutationFn: async (data: CreateSupplierInput) => {
      const res = await api.put<ApiResponse<Supplier>>(`/suppliers/${supplier!.id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
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

  const handleChange = (field: keyof CreateSupplierInput, value: string | number | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Validation automatique du téléphone
    if (field === 'phone' && typeof value === 'string') {
      if (value && isMobilePhone(value)) {
        setErrors(prev => ({ ...prev, phone: 'Les numéros de portable ne sont pas acceptés. Utilisez un numéro fixe.' }));
      } else if (errors.phone) {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.phone;
          return newErrors;
        });
      }
    } else if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    // Reset geocode status when address fields change
    if (['address', 'postalCode', 'city', 'country'].includes(field)) {
      setGeocodeStatus('idle');
    }
  };

  // Géocodage automatique quand l'adresse change (avec debounce)
  useEffect(() => {
    const { address, postalCode, city, country } = formData;

    // Nettoyer le timeout précédent
    if (geocodeTimeoutRef.current) {
      clearTimeout(geocodeTimeoutRef.current);
    }

    // Vérifier si on a assez d'informations pour géocoder
    const hasEnoughInfo = (address || postalCode) && city;
    if (!hasEnoughInfo) {
      return;
    }

    // Attendre 800ms après la dernière frappe avant de géocoder
    geocodeTimeoutRef.current = setTimeout(async () => {
      setIsGeocoding(true);
      setGeocodeStatus('idle');

      const result = await geocodeAddress(
        address || '',
        postalCode || '',
        city || '',
        country || 'France'
      );

      setIsGeocoding(false);

      if (result) {
        setFormData(prev => ({
          ...prev,
          latitude: result.lat,
          longitude: result.lon,
        }));
        setGeocodeStatus('success');
      } else {
        setGeocodeStatus('error');
      }
    }, 800);

    return () => {
      if (geocodeTimeoutRef.current) {
        clearTimeout(geocodeTimeoutRef.current);
      }
    };
  }, [formData.address, formData.postalCode, formData.city, formData.country]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Le nom est requis';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email invalide';
    }

    if (formData.phone && isMobilePhone(formData.phone)) {
      newErrors.phone = 'Les numéros de portable ne sont pas acceptés. Utilisez un numéro fixe.';
    }

    if (formData.latitude !== null && formData.latitude !== undefined && (formData.latitude < -90 || formData.latitude > 90)) {
      newErrors.latitude = 'Latitude invalide (-90 à 90)';
    }

    if (formData.longitude !== null && formData.longitude !== undefined && (formData.longitude < -180 || formData.longitude > 180)) {
      newErrors.longitude = 'Longitude invalide (-180 à 180)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const emptyToUndef = (val: string | undefined) => val || undefined;

    const data = {
      ...formData,
      contact: emptyToUndef(formData.contact),
      email: emptyToUndef(formData.email),
      phone: emptyToUndef(formData.phone),
      website: emptyToUndef(formData.website),
      address: emptyToUndef(formData.address),
      postalCode: emptyToUndef(formData.postalCode),
      city: emptyToUndef(formData.city),
      country: emptyToUndef(formData.country),
      latitude: formData.latitude ?? null,
      longitude: formData.longitude ?? null,
      comment: emptyToUndef(formData.comment),
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
      <div>
        <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
          Nom <span className="text-[--k-danger]">*</span>
        </label>
        <Input
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="Nom du fournisseur"
          className={errors.name ? 'border-red-500' : ''}
        />
        {errors.name && (
          <p className="mt-1 text-[13px] text-[--k-danger]">{errors.name}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
            Contact
          </label>
          <Input
            value={formData.contact || ''}
            onChange={(e) => handleChange('contact', e.target.value)}
            placeholder="Nom du contact"
          />
        </div>

        <div>
          <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
            Téléphone (fixe uniquement)
          </label>
          <Input
            value={formData.phone || ''}
            onChange={(e) => handleChange('phone', e.target.value)}
            placeholder="01 23 45 67 89"
            className={errors.phone ? 'border-red-500' : ''}
          />
          {errors.phone && (
            <p className="mt-1 text-[13px] text-[--k-danger]">Numéro fixe non valide</p>
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
            placeholder="contact@fournisseur.com"
            className={errors.email ? 'border-red-500' : ''}
          />
          {errors.email && (
            <p className="mt-1 text-[13px] text-[--k-danger]">{errors.email}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
            Site web
          </label>
          <Input
            value={formData.website || ''}
            onChange={(e) => handleChange('website', e.target.value)}
            placeholder="https://www.fournisseur.com"
          />
        </div>
      </div>

      {/* Adresse */}
      <div className="border-t border-[--k-border] pt-4">
        <h4 className="mb-3 text-[13px] font-medium text-[--k-text]">Adresse</h4>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
              Rue / Adresse
            </label>
            <Input
              value={formData.address || ''}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="123 rue de la Paix"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
                Code postal
              </label>
              <Input
                value={formData.postalCode || ''}
                onChange={(e) => handleChange('postalCode', e.target.value)}
                placeholder="75001"
              />
            </div>

            <div>
              <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
                Ville
              </label>
              <Input
                value={formData.city || ''}
                onChange={(e) => handleChange('city', e.target.value)}
                placeholder="Paris"
              />
            </div>

            <div>
              <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
                Pays
              </label>
              <Input
                value={formData.country || ''}
                onChange={(e) => handleChange('country', e.target.value)}
                placeholder="France"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Indicateur de géolocalisation */}
      {(formData.address || formData.postalCode || formData.city) && (
        <div className="flex items-center gap-2 text-[13px]">
          {isGeocoding ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              <span className="text-[--k-muted]">Recherche des coordonnées GPS...</span>
            </>
          ) : geocodeStatus === 'success' && formData.latitude && formData.longitude ? (
            <>
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-green-600">
                Coordonnées GPS trouvées
              </span>
              <a
                href={`https://www.google.com/maps?q=${formData.latitude},${formData.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 text-[--k-primary] hover:underline"
              >
                <MapPin className="inline h-3.5 w-3.5" /> Voir sur la carte
              </a>
            </>
          ) : geocodeStatus === 'error' ? (
            <>
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <span className="text-yellow-600">
                Adresse non trouvée - vérifiez les informations
              </span>
            </>
          ) : null}
        </div>
      )}

      <div>
        <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
          Commentaire
        </label>
        <textarea
          value={formData.comment || ''}
          onChange={(e) => handleChange('comment', e.target.value)}
          placeholder="Notes ou commentaires..."
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
          {isLoading ? 'Enregistrement...' : isEditing ? 'Modifier' : 'Créer'}
        </Button>
      </div>
    </form>
  );
}
