import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2,
  ExternalLink,
  FileText,
  Home,
  MapPin,
  Phone,
  User,
} from "lucide-react";
import { useState } from "react";
import type { PrivatePropertyListing } from "../backend";

interface Props {
  details: PrivatePropertyListing;
  compact?: boolean;
}

export default function PropertyDetailsView({ details, compact }: Props) {
  const [imgIdx, setImgIdx] = useState(0);

  const photos = details.photos ?? [];
  const hasLocation =
    details.latitude !== undefined &&
    details.latitude !== null &&
    details.longitude !== undefined &&
    details.longitude !== null;

  const googleMapsUrl = hasLocation
    ? `https://www.google.com/maps?q=${details.latitude},${details.longitude}`
    : null;

  const embedUrl = hasLocation
    ? `https://maps.google.com/maps?q=${details.latitude},${details.longitude}&z=16&output=embed`
    : null;

  return (
    <div className={`space-y-4 ${compact ? "" : "px-6 pb-6 pt-4"}`}>
      {/* Photos */}
      {photos.length > 0 && (
        <div className="space-y-2">
          <div className="relative h-52 rounded-lg overflow-hidden bg-muted">
            <img
              src={photos[imgIdx].getDirectURL()}
              alt={details.title}
              className="w-full h-full object-cover"
            />
            {photos.length > 1 && (
              <div className="absolute bottom-2 right-2 flex gap-1">
                {photos.map((_, i) => (
                  <button
                    // biome-ignore lint/suspicious/noArrayIndexKey: photo dots use stable index
                    key={i}
                    type="button"
                    onClick={() => setImgIdx(i)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      i === imgIdx
                        ? "bg-white scale-125"
                        : "bg-white/60 hover:bg-white"
                    }`}
                    aria-label={`View photo ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Property Info */}
      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-saffron-500" />
          <span className="font-semibold text-foreground">{details.title}</span>
          <Badge variant="secondary" className="text-xs ml-auto">
            {details.propertyType}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="w-4 h-4 text-saffron-500 flex-shrink-0" />
          <span className="text-foreground">{details.areaName}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Home className="w-4 h-4 text-saffron-500 flex-shrink-0" />
          <span className="font-bold text-saffron-600 text-base">
            {details.priceRange}
          </span>
        </div>
      </div>

      {/* Owner Details */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
        <h4 className="font-semibold text-green-800 text-sm flex items-center gap-2">
          <User className="w-4 h-4" /> Owner Details
        </h4>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-green-700">Owner Name</p>
            <p className="font-bold text-green-900 text-base">
              {details.ownerName}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-green-700">Contact Number</p>
            <p className="font-bold text-green-900 text-xl tracking-wide">
              {details.ownerPhone}
            </p>
          </div>
          <a href={`tel:${details.ownerPhone}`}>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white gap-2"
              data-ocid="property.call_button"
            >
              <Phone className="w-4 h-4" /> Call Now
            </Button>
          </a>
        </div>
      </div>

      {/* Full Address */}
      {details.fullAddress && (
        <div className="flex items-start gap-2 text-sm p-3 bg-muted/50 rounded-lg">
          <MapPin className="w-4 h-4 text-saffron-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Full Address</p>
            <p className="text-foreground font-medium">{details.fullAddress}</p>
          </div>
        </div>
      )}

      {/* Description */}
      {details.description && (
        <div className="flex items-start gap-2 text-sm p-3 bg-muted/50 rounded-lg">
          <FileText className="w-4 h-4 text-saffron-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Description</p>
            <p className="text-foreground">{details.description}</p>
          </div>
        </div>
      )}

      {/* Location Map */}
      {hasLocation && googleMapsUrl && embedUrl && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Property Location
            </p>
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              Open in Google Maps <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="h-56 rounded-lg overflow-hidden border border-border">
            <iframe
              title="Property Location"
              src={embedUrl}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      )}
    </div>
  );
}
