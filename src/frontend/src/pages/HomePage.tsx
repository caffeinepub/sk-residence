import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@tanstack/react-router";
import {
  Building2,
  ChevronRight,
  Home,
  Lock,
  MapPin,
  Shield,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import type { PublicPropertyListing } from "../backend";
import UnlockModal from "../components/UnlockModal";
import { useGetPublicProperties } from "../hooks/useQueries";

const HOW_IT_WORKS = [
  { step: "1", text: "Browse free property listings", icon: Building2 },
  { step: "2", text: "Pay \u20b920 via UPI to unlock details", icon: Lock },
  { step: "3", text: "Get owner number + exact location", icon: MapPin },
];

export default function HomePage() {
  const { data: properties, isLoading } = useGetPublicProperties();
  const [selectedProperty, setSelectedProperty] = useState<{
    property: PublicPropertyListing;
    index: number;
  } | null>(null);

  const activeProperties = properties?.filter((p) => p.isActive) ?? [];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header
        className="bg-white border-b border-border sticky top-0 z-50 shadow-xs"
        data-ocid="home.section"
      >
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2"
            data-ocid="home.link"
          >
            <div className="w-9 h-9 rounded-lg bg-saffron-500 flex items-center justify-center">
              <Home className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-display font-bold text-lg text-foreground leading-none block">
                SK Residence
              </span>
              <span className="text-[10px] text-muted-foreground tracking-wide">
                PREMIUM PROPERTIES
              </span>
            </div>
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              to="/"
              className="text-sm font-medium text-foreground hover:text-saffron-600 transition-colors"
              data-ocid="nav.link"
            >
              Browse
            </Link>
            <Link to="/admin" data-ocid="nav.admin.link">
              <Button
                variant="outline"
                size="sm"
                className="border-saffron-300 text-saffron-700 hover:bg-saffron-50"
              >
                Admin Login
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-saffron-600 via-saffron-500 to-amber-400 text-white py-16 md:py-24">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />
        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl"
          >
            <Badge className="bg-white/20 text-white border-white/30 mb-4 text-xs tracking-wider">
              TRUSTED SINCE 2020
            </Badge>
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-4 leading-tight">
              Find Your Perfect Home in Your Budget
            </h1>
            <p className="text-white/85 text-lg mb-8 leading-relaxed">
              Browse verified rental properties \u2014 1RK, 1BHK, 2BHK & more.
              Pay just \u20b920 to unlock owner contact and exact location.
            </p>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 bg-white/15 rounded-full px-4 py-2 text-sm">
                <Shield className="w-4 h-4" />
                <span>Verified Listings</span>
              </div>
              <div className="flex items-center gap-2 bg-white/15 rounded-full px-4 py-2 text-sm">
                <MapPin className="w-4 h-4" />
                <span>Exact Location After Payment</span>
              </div>
              <div className="flex items-center gap-2 bg-white/15 rounded-full px-4 py-2 text-sm">
                <Lock className="w-4 h-4" />
                <span>Owner Details for \u20b920</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white border-b border-border py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 md:gap-8 text-sm">
            {HOW_IT_WORKS.map((item, i) => (
              <div key={item.step} className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-saffron-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {item.step}
                  </div>
                  <span className="text-foreground font-medium">
                    {item.text}
                  </span>
                </div>
                {i < 2 && (
                  <ChevronRight className="w-4 h-4 text-muted-foreground hidden sm:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Properties */}
      <main className="flex-1 container mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">
              Available Properties
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              {isLoading
                ? "Loading..."
                : `${activeProperties.length} properties found`}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            data-ocid="properties.loading_state"
          >
            {["sk1", "sk2", "sk3", "sk4", "sk5", "sk6"].map((k) => (
              <div
                key={k}
                className="rounded-xl overflow-hidden shadow-card bg-card"
              >
                <Skeleton className="h-52 w-full" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-10 w-full mt-4" />
                </div>
              </div>
            ))}
          </div>
        ) : activeProperties.length === 0 ? (
          <div className="text-center py-20" data-ocid="properties.empty_state">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-display text-xl font-semibold text-foreground mb-2">
              No Properties Yet
            </h3>
            <p className="text-muted-foreground">
              Properties will appear here once added by the admin.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeProperties.map((property, index) => (
              <PropertyCard
                key={property.title + property.areaName}
                property={property}
                index={index}
                onUnlock={() => setSelectedProperty({ property, index })}
              />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-foreground text-white/70 py-8 mt-auto">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-saffron-500 flex items-center justify-center">
                <Home className="w-4 h-4 text-white" />
              </div>
              <span className="font-display font-bold text-white">
                SK Residence
              </span>
            </div>
            <p className="text-sm text-center">
              For queries, contact us at{" "}
              <span className="text-saffron-300 font-medium">7095244790</span>
            </p>
            <p className="text-xs text-white/50 text-center">
              \u00a9 {new Date().getFullYear()}. Built with \u2764\ufe0f using{" "}
              <a
                href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
                className="underline hover:text-white/80 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                caffeine.ai
              </a>
            </p>
          </div>
        </div>
      </footer>

      {/* Unlock Modal */}
      {selectedProperty && (
        <UnlockModal
          property={selectedProperty.property}
          propertyId={`property-${selectedProperty.index}`}
          onClose={() => setSelectedProperty(null)}
        />
      )}
    </div>
  );
}

function PropertyCard({
  property,
  index,
  onUnlock,
}: {
  property: PublicPropertyListing;
  index: number;
  onUnlock: () => void;
}) {
  const [imgIdx, setImgIdx] = useState(0);
  const photos = property.photos;
  const hasPhotos = photos && photos.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4 }}
      className="rounded-xl overflow-hidden shadow-card hover:shadow-card-hover transition-shadow duration-300 bg-card flex flex-col"
      data-ocid={`properties.item.${index + 1}`}
    >
      {/* Photo */}
      <div className="relative h-52 bg-muted overflow-hidden group">
        {hasPhotos ? (
          <>
            <img
              src={photos[imgIdx].getDirectURL()}
              alt={property.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            {photos.length > 1 && (
              <div className="absolute bottom-2 right-2 flex gap-1">
                {photos.map((_, i) => (
                  <button
                    // biome-ignore lint/suspicious/noArrayIndexKey: photo dots use stable position index
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
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-saffron-100 to-amber-50">
            <Building2 className="w-12 h-12 text-saffron-300" />
          </div>
        )}
        <div className="absolute top-3 left-3">
          <Badge className="bg-saffron-500 text-white border-0 text-xs font-semibold shadow-sm">
            {property.propertyType}
          </Badge>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-foreground leading-tight line-clamp-1">
            {property.title}
          </h3>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground text-sm mb-3">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-saffron-500" />
          <span className="line-clamp-1">{property.areaName}</span>
        </div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-xs text-muted-foreground">Price Range</span>
            <p className="font-bold text-saffron-600 text-base">
              {property.priceRange}
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="w-3 h-3" />
            <span>Details locked</span>
          </div>
        </div>
        <Button
          onClick={onUnlock}
          className="w-full bg-saffron-500 hover:bg-saffron-600 text-white font-semibold shadow-sm mt-auto"
          data-ocid={`properties.primary_button.${index + 1}`}
        >
          \ud83d\udd13 Unlock Owner Details \u20b920
        </Button>
      </div>
    </motion.div>
  );
}
