import { useState, useEffect, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, CheckCircle, AlertCircle } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import RichTextEditor from '../ui/RichTextEditor';
import api from '../../services/api';
import type { Supplier, ApiResponse } from '../../types';

// Charger le script Google Maps dynamiquement (une seule fois)
let googleMapsLoaded = false;
let googleMapsLoading = false;
const loadGoogleMaps = (): Promise<void> => {
  if (googleMapsLoaded) return Promise.resolve();
  if (googleMapsLoading) {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (googleMapsLoaded) {
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
  }
  googleMapsLoading = true;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places&language=fr`;
    script.async = true;
    script.onload = () => {
      googleMapsLoaded = true;
      googleMapsLoading = false;
      resolve();
    };
    script.onerror = () => {
      googleMapsLoading = false;
      reject(new Error('Impossible de charger Google Maps'));
    };
    document.head.appendChild(script);
  });
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
  siret?: string | null;
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

// Extraire un composant d'adresse Google
const getAddressComponent = (
  components: google.maps.GeocoderAddressComponent[],
  type: string
): string => {
  const component = components.find((c) => c.types.includes(type));
  return component?.long_name || '';
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
    siret: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [geocodeStatus, setGeocodeStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [siretLookupState, setSiretLookupState] = useState<'idle' | 'loading' | 'found' | 'not-found'>('idle');
  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

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
        siret: supplier.siret || '',
      });
      if (supplier.latitude && supplier.longitude) {
        setGeocodeStatus('success');
      }
    }
  }, [supplier]);

  // Initialiser Google Places Autocomplete
  const initAutocomplete = useCallback(() => {
    if (!addressInputRef.current || autocompleteRef.current) return;

    const autocomplete = new google.maps.places.Autocomplete(addressInputRef.current, {
      types: ['address'],
      fields: ['address_components', 'geometry', 'formatted_address'],
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();

      if (!place.address_components || !place.geometry?.location) {
        setGeocodeStatus('error');
        return;
      }

      const components = place.address_components;

      // Extraire les composants d'adresse
      const streetNumber = getAddressComponent(components, 'street_number');
      const route = getAddressComponent(components, 'route');
      const postalCode = getAddressComponent(components, 'postal_code');
      const city = getAddressComponent(components, 'locality') || getAddressComponent(components, 'administrative_area_level_2');
      const country = getAddressComponent(components, 'country');

      const streetAddress = [streetNumber, route].filter(Boolean).join(' ');

      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();

      setFormData((prev) => ({
        ...prev,
        address: streetAddress || prev.address,
        postalCode: postalCode || prev.postalCode,
        city: city || prev.city,
        country: country || prev.country,
        latitude: lat,
        longitude: lng,
      }));

      setGeocodeStatus('success');
    });

    autocompleteRef.current = autocomplete;
  }, []);

  // Charger Google Maps et initialiser l'autocomplete
  useEffect(() => {
    loadGoogleMaps()
      .then(() => {
        initAutocomplete();
      })
      .catch((err) => {
        console.error('Erreur chargement Google Maps:', err);
      });
  }, [initAutocomplete]);

  // Réinitialiser l'autocomplete si le ref change (ex: re-render)
  useEffect(() => {
    if (googleMapsLoaded && addressInputRef.current && !autocompleteRef.current) {
      initAutocomplete();
    }
  }, [initAutocomplete]);

  // Manual SIREN/SIRET lookup against the proxied gouv.fr API. Pre-fills
  // the name and address fields when the user hasn't touched them yet.
  const handleSiretLookup = async () => {
    const raw = (formData.siret || '').replace(/\D/g, '');
    if (raw.length !== 9 && raw.length !== 14) {
      setSiretLookupState('not-found');
      return;
    }
    setSiretLookupState('loading');
    try {
      const res = await api.get<ApiResponse<any[]>>(
        `/suppliers/company-search?q=${encodeURIComponent(raw)}`,
      );
      const hits = res.data?.data || [];
      const hit = hits[0];
      if (!hit) {
        setSiretLookupState('not-found');
        return;
      }
      setFormData((prev) => ({
        ...prev,
        siret: hit.siret || prev.siret,
        name: prev.name?.trim() ? prev.name : hit.legalName || prev.name,
        address: prev.address?.trim() ? prev.address : hit.address || prev.address,
        postalCode: prev.postalCode?.trim() ? prev.postalCode : hit.postalCode || prev.postalCode,
        city: prev.city?.trim() ? prev.city : hit.city || prev.city,
      }));
      setSiretLookupState('found');
    } catch {
      setSiretLookupState('not-found');
    }
  };

  const handleChange = (field: keyof CreateSupplierInput, value: string | number | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'siret') setSiretLookupState('idle');

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

    // Reset geocode status when address fields change manually
    if (['address', 'postalCode', 'city', 'country'].includes(field)) {
      setGeocodeStatus('idle');
    }
  };

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

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* SIREN / SIRET lookup against api.gouv.fr (recherche-entreprises) */}
      <div>
        <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
          SIREN / SIRET
        </label>
        <div className="flex gap-2 items-start">
          <div className="flex-1">
            <Input
              value={formData.siret || ''}
              onChange={(e) => handleChange('siret', e.target.value)}
              placeholder="9 ou 14 chiffres"
              maxLength={14}
            />
            {siretLookupState === 'found' && (
              <p className="mt-1 text-xs text-emerald-600">
                ✓ Entreprise trouvée — champs pré-remplis
              </p>
            )}
            {siretLookupState === 'not-found' && (
              <p className="mt-1 text-xs text-amber-600">
                Aucune entreprise trouvée pour ce numéro
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleSiretLookup}
            disabled={siretLookupState === 'loading' || !(formData.siret || '').trim()}
          >
            {siretLookupState === 'loading' ? 'Recherche…' : 'Rechercher'}
          </Button>
        </div>
        <p className="mt-1 text-[11px] text-[--k-muted]">
          Pré-remplit nom et adresse depuis la base SIRENE officielle. Données rafraîchies automatiquement à la sauvegarde.
        </p>
      </div>

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

      {/* Adresse avec Google Places Autocomplete */}
      <div className="border-t border-[--k-border] pt-4">
        <h4 className="mb-3 text-[13px] font-medium text-[--k-text]">Adresse</h4>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
              Rue / Adresse
            </label>
            <input
              ref={addressInputRef}
              type="text"
              value={formData.address || ''}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="Commencez à taper une adresse..."
              className="input-field w-full"
              style={{ padding: '0.5rem 0.75rem' }}
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
      {(geocodeStatus === 'success' && formData.latitude && formData.longitude) ? (
        <div className="flex items-center gap-2 text-[13px]">
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
        </div>
      ) : geocodeStatus === 'error' ? (
        <div className="flex items-center gap-2 text-[13px]">
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          <span className="text-yellow-600">
            Adresse non trouvée - sélectionnez une suggestion
          </span>
        </div>
      ) : null}

      <div>
        <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
          Commentaire
        </label>
        <RichTextEditor
          content={formData.comment || ''}
          onChange={(html) => handleChange('comment', html)}
          placeholder="Notes ou commentaires..."
          fetchMentions={() => []}
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
