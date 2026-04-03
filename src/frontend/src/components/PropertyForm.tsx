import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MapPin,
  Plus,
  Search,
  Upload,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalBlob } from "../backend";
import type { PublicPropertyListing } from "../backend";
import { useCreateOrUpdateProperty } from "../hooks/useQueries";

const PROPERTY_TYPES = ["1RK", "1BHK", "2BHK", "3BHK", "4BHK", "Villa", "Plot"];

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface FormData {
  propertyId: string;
  title: string;
  areaName: string;
  propertyType: string;
  priceRange: string;
  ownerName: string;
  ownerPhone: string;
  fullAddress: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
  photos: ExternalBlob[];
}

interface PropertyFormProps {
  editData: { id: string; property: PublicPropertyListing } | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function PropertyForm({
  editData,
  onSuccess,
  onCancel,
}: PropertyFormProps) {
  const [form, setForm] = useState<FormData>({
    propertyId: editData?.id ?? "",
    title: editData?.property.title ?? "",
    areaName: editData?.property.areaName ?? "",
    propertyType: editData?.property.propertyType ?? "",
    priceRange: editData?.property.priceRange ?? "",
    ownerName: "",
    ownerPhone: "",
    fullAddress: "",
    description: "",
    latitude: null,
    longitude: null,
    isActive: editData?.property.isActive ?? true,
    photos: [],
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>(
    {},
  );
  const [photoUploading, setPhotoUploading] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Address search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { mutateAsync: saveProperty, isPending } = useCreateOrUpdateProperty();

  // --- Address search handler (Nominatim) ---
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setSearchError("");
    // Clear location if user edits the search box
    setForm((prev) => ({ ...prev, latitude: null, longitude: null }));
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!value.trim()) {
      setSearchResults([]);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}&limit=5`,
          { headers: { "Accept-Language": "en" } },
        );
        const data: NominatimResult[] = await res.json();
        setSearchResults(data);
        // Auto-select first result if only one result or very close match
        if (data.length === 1) {
          handleSelectSearchResult(data[0]);
        } else if (data.length === 0) {
          setSearchError("No results found. Try a more specific address.");
        }
      } catch {
        setSearchError("Search failed. Please try again.");
      } finally {
        setSearching(false);
      }
    }, 600);
  };

  const handleSelectSearchResult = (result: NominatimResult) => {
    const lat = Number.parseFloat(result.lat);
    const lng = Number.parseFloat(result.lon);
    setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }));
    setErrors((prev) => ({ ...prev, latitude: undefined }));
    setSubmitError("");
    setSearchQuery(result.display_name);
    setSearchResults([]);
  };

  // --- Photos ---
  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setPhotoUploading(true);
    try {
      const newBlobs: ExternalBlob[] = [];
      for (const file of Array.from(files)) {
        const buffer = await file.arrayBuffer();
        const blob = ExternalBlob.fromBytes(new Uint8Array(buffer));
        newBlobs.push(blob);
      }
      setForm((prev) => ({ ...prev, photos: [...prev.photos, ...newBlobs] }));
    } catch {
      toast.error("Failed to load photos");
    } finally {
      setPhotoUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    setForm((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));
  };

  // --- Validation ---
  const validate = () => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    if (!form.propertyId.trim())
      newErrors.propertyId = "Property ID is required";
    if (!form.title.trim()) newErrors.title = "Title is required";
    if (!form.areaName.trim()) newErrors.areaName = "Area name is required";
    if (!form.propertyType)
      newErrors.propertyType = "Property type is required";
    if (!form.priceRange.trim())
      newErrors.priceRange = "Price range is required";
    if (!form.ownerName.trim()) newErrors.ownerName = "Owner name is required";
    if (!form.ownerPhone.trim())
      newErrors.ownerPhone = "Owner phone is required";
    if (!form.fullAddress.trim())
      newErrors.fullAddress = "Full address is required";
    if (form.latitude === null || form.longitude === null) {
      newErrors.latitude =
        "Location is required — search and select from the dropdown";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    setSubmitError("");
    if (!validate()) {
      // Build a list of missing fields to help the user
      const missing: string[] = [];
      if (!form.propertyId.trim()) missing.push("Property ID");
      if (!form.title.trim()) missing.push("Title");
      if (!form.areaName.trim()) missing.push("Area Name");
      if (!form.propertyType) missing.push("Property Type");
      if (!form.priceRange.trim()) missing.push("Price Range");
      if (!form.ownerName.trim()) missing.push("Owner Name");
      if (!form.ownerPhone.trim()) missing.push("Owner Phone");
      if (!form.fullAddress.trim()) missing.push("Full Address");
      if (form.latitude === null || form.longitude === null)
        missing.push("Property Location (select from search dropdown)");
      setSubmitError(`Please fill: ${missing.join(", ")}`);
      // Scroll to top of form
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    try {
      await saveProperty({
        propertyId: form.propertyId.trim(),
        property: {
          title: form.title.trim(),
          areaName: form.areaName.trim(),
          propertyType: form.propertyType,
          priceRange: form.priceRange.trim(),
          ownerName: form.ownerName.trim(),
          ownerPhone: form.ownerPhone.trim(),
          fullAddress: form.fullAddress.trim(),
          description: form.description.trim(),
          latitude: form.latitude!,
          longitude: form.longitude!,
          isActive: form.isActive,
          photos: form.photos,
        },
      });
      toast.success(editData ? "Property updated!" : "Property created!");
      onSuccess();
    } catch {
      toast.error("Failed to save property. Please try again.");
    }
  };

  const field = (key: keyof FormData) => ({
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value })),
  });

  const locationSet = form.latitude !== null && form.longitude !== null;

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground">
          {editData ? "Edit Property" : "Add New Property"}
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          All fields marked with * are required.
        </p>
      </div>

      {/* Top-level validation error banner */}
      {submitError && (
        <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{submitError}</p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-border p-6 space-y-5">
        {/* Property ID */}
        <div className="space-y-1.5">
          <Label htmlFor="propertyId">
            Property ID <span className="text-destructive">*</span>
          </Label>
          <Input
            id="propertyId"
            placeholder="e.g. property-001"
            {...field("propertyId")}
            disabled={!!editData}
            className={errors.propertyId ? "border-destructive" : ""}
            data-ocid="property_form.input"
          />
          {errors.propertyId && (
            <p
              className="text-xs text-destructive"
              data-ocid="property_form.error_state"
            >
              {errors.propertyId}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Unique identifier. Cannot be changed after creation.
          </p>
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="title">
            Property Title <span className="text-destructive">*</span>
          </Label>
          <Input
            id="title"
            placeholder="e.g. Spacious 2BHK in Gachibowli"
            {...field("title")}
            className={errors.title ? "border-destructive" : ""}
            data-ocid="property_form.input"
          />
          {errors.title && (
            <p className="text-xs text-destructive">{errors.title}</p>
          )}
        </div>

        {/* Area Name */}
        <div className="space-y-1.5">
          <Label htmlFor="areaName">
            Area Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="areaName"
            placeholder="e.g. Gachibowli, Hyderabad"
            {...field("areaName")}
            className={errors.areaName ? "border-destructive" : ""}
            data-ocid="property_form.input"
          />
          {errors.areaName && (
            <p className="text-xs text-destructive">{errors.areaName}</p>
          )}
        </div>

        {/* Property Type */}
        <div className="space-y-1.5">
          <Label>
            Property Type <span className="text-destructive">*</span>
          </Label>
          <Select
            value={form.propertyType}
            onValueChange={(v) =>
              setForm((prev) => ({ ...prev, propertyType: v }))
            }
          >
            <SelectTrigger
              className={errors.propertyType ? "border-destructive" : ""}
              data-ocid="property_form.select"
            >
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {PROPERTY_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.propertyType && (
            <p className="text-xs text-destructive">{errors.propertyType}</p>
          )}
        </div>

        {/* Price Range */}
        <div className="space-y-1.5">
          <Label htmlFor="priceRange">
            Price Range <span className="text-destructive">*</span>
          </Label>
          <Input
            id="priceRange"
            placeholder="e.g. \u20b98,000/month"
            {...field("priceRange")}
            className={errors.priceRange ? "border-destructive" : ""}
            data-ocid="property_form.input"
          />
          {errors.priceRange && (
            <p className="text-xs text-destructive">{errors.priceRange}</p>
          )}
        </div>

        {/* Owner Name */}
        <div className="space-y-1.5">
          <Label htmlFor="ownerName">
            Owner Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="ownerName"
            placeholder="e.g. Ramesh Kumar"
            {...field("ownerName")}
            className={errors.ownerName ? "border-destructive" : ""}
            data-ocid="property_form.input"
          />
          {errors.ownerName && (
            <p className="text-xs text-destructive">{errors.ownerName}</p>
          )}
        </div>

        {/* Owner Phone */}
        <div className="space-y-1.5">
          <Label htmlFor="ownerPhone">
            Owner Phone <span className="text-destructive">*</span>
          </Label>
          <Input
            id="ownerPhone"
            placeholder="e.g. 9876543210"
            {...field("ownerPhone")}
            className={errors.ownerPhone ? "border-destructive" : ""}
            data-ocid="property_form.input"
          />
          {errors.ownerPhone && (
            <p className="text-xs text-destructive">{errors.ownerPhone}</p>
          )}
        </div>

        {/* Full Address */}
        <div className="space-y-1.5">
          <Label htmlFor="fullAddress">
            Full Address <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="fullAddress"
            placeholder="e.g. Flat 203, Palm Springs Apartments, Kondapur Road, Gachibowli, Hyderabad - 500032"
            {...field("fullAddress")}
            rows={3}
            className={errors.fullAddress ? "border-destructive" : ""}
            data-ocid="property_form.textarea"
          />
          {errors.fullAddress && (
            <p className="text-xs text-destructive">{errors.fullAddress}</p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="Describe the property amenities, nearby places, etc."
            {...field("description")}
            rows={4}
            data-ocid="property_form.textarea"
          />
        </div>

        {/* Active Switch */}
        <div className="flex items-center gap-3 py-2">
          <Switch
            id="isActive"
            checked={form.isActive}
            onCheckedChange={(v) =>
              setForm((prev) => ({ ...prev, isActive: v }))
            }
            data-ocid="property_form.switch"
          />
          <Label htmlFor="isActive" className="cursor-pointer">
            Active (visible to customers)
          </Label>
        </div>

        {/* Photos Upload */}
        <div className="space-y-2">
          <Label>Property Photos</Label>
          <button
            type="button"
            className="w-full border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-saffron-300 hover:bg-saffron-50/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            data-ocid="property_form.dropzone"
          >
            {photoUploading ? (
              <Loader2 className="w-6 h-6 animate-spin text-saffron-500 mx-auto" />
            ) : (
              <>
                <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Click to upload property photos
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  JPG, PNG, WebP supported
                </p>
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handlePhotoUpload(e.target.files)}
            data-ocid="property_form.upload_button"
          />
          {form.photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              {form.photos.map((photo, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: photo order is stable in upload list
                  key={i}
                  className="relative rounded-lg overflow-hidden h-20"
                >
                  <img
                    src={photo.getDirectURL()}
                    alt={`Uploaded property view ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                    aria-label={`Remove photo ${i + 1}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center hover:border-saffron-300 hover:bg-saffron-50 transition-colors"
                aria-label="Add more photos"
              >
                <Plus className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>

        {/* ===== LOCATION SECTION ===== */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-saffron-500" />
            <Label>
              Property Location <span className="text-destructive">*</span>
            </Label>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <p className="text-xs text-blue-800">
              <strong>How to set location:</strong> Type the area name below and
              wait for suggestions. Tap/click one of the suggestions from the
              list to confirm the location.
            </p>
          </div>

          {/* Success banner */}
          {locationSet && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
              <p className="text-xs text-green-800 font-medium">
                Location confirmed: {form.latitude!.toFixed(5)},{" "}
                {form.longitude!.toFixed(5)}
              </p>
            </div>
          )}

          {/* Not confirmed warning */}
          {!locationSet && searchQuery.length > 3 && !searching && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-800">
                Location not confirmed yet — please select from the dropdown
                below.
              </p>
            </div>
          )}

          {/* Validation error */}
          {errors.latitude && !locationSet && (
            <p
              className="text-xs text-destructive flex items-center gap-1"
              data-ocid="property_form.error_state"
            >
              <AlertCircle className="w-3 h-3" /> {errors.latitude}
            </p>
          )}

          {/* Address Search */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="e.g. Gachibowli, Hyderabad"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className={`pl-9 pr-8 ${
                  errors.latitude && !locationSet ? "border-destructive" : ""
                }`}
                data-ocid="property_form.search_input"
              />
              {searching && (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
              )}
            </div>
            {searchResults.length > 0 && (
              <ul className="border border-border rounded-lg overflow-hidden divide-y divide-border">
                {searchResults.map((r) => (
                  <li key={r.display_name}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-saffron-50 transition-colors"
                      onClick={() => handleSelectSearchResult(r)}
                    >
                      {r.display_name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {searchError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {searchError}
              </p>
            )}
          </div>
        </div>
        {/* ===== END LOCATION SECTION ===== */}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            className="flex-1 bg-saffron-500 hover:bg-saffron-600 text-white font-bold"
            data-ocid="property_form.submit_button"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
              </>
            ) : editData ? (
              "Update Property"
            ) : (
              "Create Property"
            )}
          </Button>
          <Button
            variant="outline"
            onClick={onCancel}
            data-ocid="property_form.cancel_button"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
