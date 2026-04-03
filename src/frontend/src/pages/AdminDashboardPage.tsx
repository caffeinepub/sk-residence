import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import {
  AlertCircle,
  Bell,
  Building2,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Download,
  Edit,
  Home,
  Loader2,
  LogOut,
  PlusCircle,
  RefreshCw,
  Trash2,
  Upload,
  Users,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ExternalBlob, PublicPropertyListing } from "../backend";
import PropertyForm from "../components/PropertyForm";
import { useActor } from "../hooks/useActor";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import {
  useApprovePayment,
  useCreateOrUpdateProperty,
  useDeleteProperty,
  useGetAllPaymentRecords,
  useGetPendingPayments,
  useGetPublicProperties,
  useIsCallerAdmin,
  useRejectPayment,
} from "../hooks/useQueries";
import type { PendingPayment } from "../types/paymentTypes";

const ADMIN_SESSION_KEY = "sk_admin_session";

type Section = "properties" | "add" | "payments" | "import";

const VALID_PROPERTY_TYPES = [
  "1RK",
  "1BHK",
  "2BHK",
  "3BHK",
  "4BHK",
  "Villa",
  "Plot",
];

const CSV_TEMPLATE_HEADER =
  "propertyId,title,areaName,propertyType,priceRange,ownerName,ownerPhone,fullAddress,description,latitude,longitude,isActive";
const CSV_TEMPLATE_SAMPLE = `property-001,Sample Property,Gachibowli Hyderabad,2BHK,₹10000/month,Ramesh Kumar,9876543210,"Flat 203, Palm Springs, Gachibowli",Spacious flat with parking,17.44,78.36,true`;

interface ParsedRow {
  propertyId: string;
  title: string;
  areaName: string;
  propertyType: string;
  priceRange: string;
  ownerName: string;
  ownerPhone: string;
  fullAddress: string;
  description: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
  rowIndex: number;
  validationError?: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(content: string): ParsedRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return [];

  // skip header
  const dataLines = lines.slice(1);
  const rows: ParsedRow[] = [];

  dataLines.forEach((line, idx) => {
    const cols = parseCSVLine(line);
    const [
      propertyId = "",
      title = "",
      areaName = "",
      propertyType = "",
      priceRange = "",
      ownerName = "",
      ownerPhone = "",
      fullAddress = "",
      description = "",
      latStr = "",
      lngStr = "",
      isActiveStr = "",
    ] = cols;

    const latitude = latStr === "" ? 0 : Number(latStr);
    const longitude = lngStr === "" ? 0 : Number(lngStr);
    const isActive =
      isActiveStr === "" ? true : isActiveStr.toLowerCase() !== "false";

    let validationError: string | undefined;

    const required = [
      ["propertyId", propertyId],
      ["title", title],
      ["areaName", areaName],
      ["propertyType", propertyType],
      ["priceRange", priceRange],
      ["ownerName", ownerName],
      ["ownerPhone", ownerPhone],
      ["fullAddress", fullAddress],
    ] as [string, string][];

    const missing = required.filter(([, v]) => !v).map(([k]) => k);
    if (missing.length > 0) {
      validationError = `Missing required fields: ${missing.join(", ")}`;
    } else if (!VALID_PROPERTY_TYPES.includes(propertyType)) {
      validationError = `Invalid propertyType "${propertyType}". Must be one of: ${VALID_PROPERTY_TYPES.join(", ")}`;
    } else if (latStr !== "" && Number.isNaN(latitude)) {
      validationError = `Invalid latitude value "${latStr}"`;
    } else if (lngStr !== "" && Number.isNaN(longitude)) {
      validationError = `Invalid longitude value "${lngStr}"`;
    }

    rows.push({
      propertyId,
      title,
      areaName,
      propertyType,
      priceRange,
      ownerName,
      ownerPhone,
      fullAddress,
      description,
      latitude,
      longitude,
      isActive,
      rowIndex: idx + 2, // 1-based, accounting for header
      validationError,
    });
  });

  return rows;
}

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { section?: string };
  const section = params.section;
  const [activeSection, setActiveSection] = useState<Section>("properties");
  const [editingProperty, setEditingProperty] = useState<{
    id: string;
    property: PublicPropertyListing;
  } | null>(null);

  const { clear, identity } = useInternetIdentity();
  const queryClient = useQueryClient();
  const { isFetching: actorLoading } = useActor();
  const { data: isAdmin, isLoading: adminLoading } = useIsCallerAdmin();

  const isLocalAdmin = sessionStorage.getItem(ADMIN_SESSION_KEY) === "true";
  const hasAccess = isLocalAdmin || (!!identity && isAdmin === true);

  // Guard: redirect if not admin
  useEffect(() => {
    if (isLocalAdmin) return;
    if (!identity) {
      navigate({ to: "/admin" });
      return;
    }
    if (!actorLoading && !adminLoading && isAdmin === false) {
      navigate({ to: "/admin" });
    }
  }, [isLocalAdmin, identity, isAdmin, actorLoading, adminLoading, navigate]);

  useEffect(() => {
    if (
      section === "add" ||
      section === "payments" ||
      section === "properties" ||
      section === "import"
    ) {
      setActiveSection(section as Section);
    }
  }, [section]);

  const handleLogout = () => {
    clear();
    queryClient.clear();
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    navigate({ to: "/" });
  };

  const handleEditProperty = (id: string, property: PublicPropertyListing) => {
    setEditingProperty({ id, property });
    setActiveSection("add");
  };

  const handleFormSuccess = () => {
    setEditingProperty(null);
    setActiveSection("properties");
  };

  if (!hasAccess && (adminLoading || actorLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-saffron-500" />
      </div>
    );
  }

  const navItems: {
    id: Section;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: "properties", label: "Properties", icon: Building2 },
    { id: "add", label: "Add Property", icon: PlusCircle },
    { id: "payments", label: "Payments", icon: CreditCard },
    { id: "import", label: "Import", icon: Upload },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col flex-shrink-0">
        <div className="p-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-saffron-500 flex items-center justify-center">
              <Home className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-display font-bold text-sidebar-foreground text-sm leading-none block">
                SK Residence
              </span>
              <span className="text-[10px] text-sidebar-foreground/70 tracking-wide">
                ADMIN
              </span>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {/* Home button at the top */}
          <button
            type="button"
            onClick={() => navigate({ to: "/" })}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors font-medium"
            data-ocid="admin.home_button"
          >
            <Home className="w-4 h-4" />
            Home
          </button>

          <div className="border-t border-sidebar-border my-1" />

          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveSection(item.id);
                if (item.id !== "add") setEditingProperty(null);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeSection === item.id
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
              data-ocid={`admin.nav.${item.id}.link`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
              {activeSection === item.id && (
                <ChevronRight className="w-3 h-3 ml-auto" />
              )}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-1">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            data-ocid="admin.logout_button"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {activeSection === "properties" && (
            <PropertiesSection onEdit={handleEditProperty} />
          )}
          {activeSection === "add" && (
            <PropertyForm
              editData={editingProperty}
              onSuccess={handleFormSuccess}
              onCancel={() => {
                setEditingProperty(null);
                setActiveSection("properties");
              }}
            />
          )}
          {activeSection === "payments" && <PaymentsSection />}
          {activeSection === "import" && <ImportSection />}
        </div>
      </main>
    </div>
  );
}

function PropertiesSection({
  onEdit,
}: {
  onEdit: (id: string, property: PublicPropertyListing) => void;
}) {
  const { data: properties, isLoading } = useGetPublicProperties();
  const { mutate: deleteProperty, isPending: isDeleting } = useDeleteProperty();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Properties
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {properties?.length ?? 0} listings
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3" data-ocid="admin.properties.loading_state">
          {["s1", "s2", "s3"].map((k) => (
            <Skeleton key={k} className="h-16 w-full" />
          ))}
        </div>
      ) : !properties?.length ? (
        <div
          className="text-center py-16 bg-white rounded-xl border border-border"
          data-ocid="admin.properties.empty_state"
        >
          <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No properties yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Use &ldquo;Add Property&rdquo; in the sidebar to create your first
            listing.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden shadow-xs">
          <Table data-ocid="admin.properties.table">
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {properties.map((property, index) => (
                <TableRow
                  // biome-ignore lint/suspicious/noArrayIndexKey: index is stable for property list
                  key={index}
                  data-ocid={`admin.properties.row.${index + 1}`}
                >
                  <TableCell className="font-medium">
                    {property.title}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {property.propertyType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {property.areaName}
                  </TableCell>
                  <TableCell className="font-semibold text-saffron-600">
                    {property.priceRange}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={property.isActive ? "default" : "secondary"}
                      className={
                        property.isActive
                          ? "bg-green-100 text-green-700 border-green-200"
                          : ""
                      }
                    >
                      {property.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(`property-${index}`, property)}
                        data-ocid={`admin.properties.edit_button.${index + 1}`}
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            data-ocid={`admin.properties.delete_button.${index + 1}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent data-ocid="admin.delete.dialog">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Property</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete &ldquo;
                              {property.title}&rdquo;? This action cannot be
                              undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel data-ocid="admin.delete.cancel_button">
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => {
                                deleteProperty(`property-${index}`, {
                                  onSuccess: () =>
                                    toast.success("Property deleted"),
                                  onError: () =>
                                    toast.error("Failed to delete property"),
                                });
                              }}
                              disabled={isDeleting}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              data-ocid="admin.delete.confirm_button"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function PendingApprovalsSection() {
  const { data: pendingPayments, isLoading, refetch } = useGetPendingPayments();
  const { mutate: approvePayment, isPending: isApproving } =
    useApprovePayment();
  const { mutate: rejectPayment, isPending: isRejecting } = useRejectPayment();
  const prevCountRef = useRef<number | null>(null);

  const pendingList = pendingPayments ?? [];

  // Browser notification on new payment
  const requestAndNotify = useCallback(async () => {
    try {
      if (!("Notification" in window)) return;
      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }
      if (permission === "granted") {
        new Notification("New payment pending approval", {
          body: "A customer is waiting for payment approval — SK Residence",
          icon: "/favicon.ico",
        });
      }
    } catch {
      // silently ignore notification errors
    }
  }, []);

  // Poll every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 30_000);
    return () => clearInterval(interval);
  }, [refetch]);

  // Watch count changes and trigger notification
  useEffect(() => {
    if (pendingPayments === undefined) return;
    const count = pendingPayments.length;
    if (prevCountRef.current === null) {
      // First load — set baseline, no notification
      prevCountRef.current = count;
      return;
    }
    if (count > prevCountRef.current) {
      requestAndNotify();
    }
    prevCountRef.current = count;
  }, [pendingPayments, requestAndNotify]);

  const handleApprove = (payment: PendingPayment) => {
    approvePayment(
      {
        propertyId: payment.propertyId,
        customerPrincipal: payment.customerPrincipal,
      },
      {
        onSuccess: () =>
          toast.success(
            "Payment approved — customer can now access property details",
          ),
        onError: () => toast.error("Failed to approve payment"),
      },
    );
  };

  const handleReject = (payment: PendingPayment) => {
    rejectPayment(
      {
        propertyId: payment.propertyId,
        customerPrincipal: payment.customerPrincipal,
      },
      {
        onSuccess: () => toast.success("Payment rejected"),
        onError: () => toast.error("Failed to reject payment"),
      },
    );
  };

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <Bell className="w-5 h-5 text-amber-500" />
        <h2 className="font-display text-lg font-bold text-foreground">
          Pending Approvals
        </h2>
        {pendingList.length > 0 && (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs px-2 py-0.5">
            {pendingList.length} pending
          </Badge>
        )}
        <button
          type="button"
          onClick={() => refetch()}
          className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Refresh pending payments"
          data-ocid="admin.approvals.secondary_button"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3" data-ocid="admin.approvals.loading_state">
          {["a1", "a2"].map((k) => (
            <Skeleton key={k} className="h-14 w-full" />
          ))}
        </div>
      ) : pendingList.length === 0 ? (
        <div
          className="text-center py-8 bg-white rounded-xl border border-border"
          data-ocid="admin.approvals.empty_state"
        >
          <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground font-medium">
            No pending payments
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            All payments have been reviewed.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-amber-200 overflow-hidden shadow-xs">
          <Table data-ocid="admin.approvals.table">
            <TableHeader>
              <TableRow className="bg-amber-50/60">
                <TableHead>Property</TableHead>
                <TableHead>Transaction ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date / Time</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingList.map((payment, index) => (
                <TableRow
                  key={`${payment.propertyId}-${payment.customerPrincipal.toString()}`}
                  data-ocid={`admin.approvals.row.${index + 1}`}
                >
                  <TableCell className="font-medium text-sm">
                    {payment.propertyId}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {payment.transactionId}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs font-mono max-w-[100px] truncate">
                    {payment.customerPrincipal.toString().slice(0, 16)}…
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(
                      Number(payment.timestamp / 1_000_000n),
                    ).toLocaleString("en-IN")}
                  </TableCell>
                  <TableCell className="font-semibold text-saffron-600">
                    ₹{payment.amount.toString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        className="bg-green-500 hover:bg-green-600 text-white h-7 px-3 text-xs"
                        onClick={() => handleApprove(payment)}
                        disabled={isApproving || isRejecting}
                        data-ocid={`admin.approvals.confirm_button.${index + 1}`}
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-200 text-red-600 hover:bg-red-50 h-7 px-3 text-xs"
                        onClick={() => handleReject(payment)}
                        disabled={isApproving || isRejecting}
                        data-ocid={`admin.approvals.delete_button.${index + 1}`}
                      >
                        <XCircle className="w-3 h-3 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function PaymentsSection() {
  const { data: records, isLoading } = useGetAllPaymentRecords();

  const allPayments =
    records?.flatMap(([principal, payments]) =>
      payments.map((payment) => ({
        principal: principal.toString(),
        ...payment,
      })),
    ) ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground">
          Payments
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Manage pending approvals and view all payment records
        </p>
      </div>

      {/* Pending approvals section */}
      <PendingApprovalsSection />

      {/* All payment records */}
      <div>
        <h2 className="font-display text-lg font-bold text-foreground mb-4">
          All Payment Records
        </h2>
        <p className="text-muted-foreground text-sm mb-4">
          {allPayments.length} total payments
        </p>

        {isLoading ? (
          <div className="space-y-3" data-ocid="admin.payments.loading_state">
            {["p1", "p2", "p3"].map((k) => (
              <Skeleton key={k} className="h-16 w-full" />
            ))}
          </div>
        ) : allPayments.length === 0 ? (
          <div
            className="text-center py-16 bg-white rounded-xl border border-border"
            data-ocid="admin.payments.empty_state"
          >
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No payments yet</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-border overflow-hidden shadow-xs">
            <Table data-ocid="admin.payments.table">
              <TableHeader>
                <TableRow>
                  <TableHead>Property ID</TableHead>
                  <TableHead>Transaction ID</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Principal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allPayments.map((payment, index) => (
                  <TableRow
                    // biome-ignore lint/suspicious/noArrayIndexKey: stable index for payment list
                    key={index}
                    data-ocid={`admin.payments.row.${index + 1}`}
                  >
                    <TableCell className="font-medium">
                      {payment.propertyId}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {payment.transactionId}
                    </TableCell>
                    <TableCell className="font-semibold text-saffron-600">
                      ₹{payment.amount.toString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(
                        Number(payment.timestamp / 1_000_000n),
                      ).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs font-mono truncate max-w-[120px]">
                      {payment.principal}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

type ImportState =
  | { phase: "idle" }
  | { phase: "parsed"; rows: ParsedRow[] }
  | { phase: "importing"; rows: ParsedRow[]; done: number; total: number }
  | {
      phase: "done";
      rows: ParsedRow[];
      successCount: number;
      failedRows: { row: ParsedRow; error: string }[];
    };

function ImportSection() {
  const [state, setState] = useState<ImportState>({ phase: "idle" });
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mutateAsync: saveProperty } = useCreateOrUpdateProperty();

  const handleDownloadTemplate = () => {
    const content = `${CSV_TEMPLATE_HEADER}\n${CSV_TEMPLATE_SAMPLE}`;
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sk-residence-property-template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast.error("Please select a .csv file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const rows = parseCSV(content);
      if (rows.length === 0) {
        toast.error("No data rows found in the CSV file");
        return;
      }
      setState({ phase: "parsed", rows });
    };
    reader.readAsText(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // reset so same file can be re-selected
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleImport = async () => {
    if (state.phase !== "parsed") return;
    const validRows = state.rows.filter((r) => !r.validationError);
    if (validRows.length === 0) return;

    setState({
      phase: "importing",
      rows: state.rows,
      done: 0,
      total: validRows.length,
    });

    let successCount = 0;
    const failedRows: { row: ParsedRow; error: string }[] = [];

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        const property = {
          title: row.title,
          areaName: row.areaName,
          propertyType: row.propertyType,
          priceRange: row.priceRange,
          ownerName: row.ownerName,
          ownerPhone: row.ownerPhone,
          fullAddress: row.fullAddress,
          description: row.description,
          latitude: row.latitude,
          longitude: row.longitude,
          isActive: row.isActive,
          photos: [] as ExternalBlob[],
        };
        await saveProperty({ propertyId: row.propertyId, property });
        successCount++;
      } catch (err) {
        failedRows.push({
          row,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
      setState((prev) =>
        prev.phase === "importing" ? { ...prev, done: i + 1 } : prev,
      );
    }

    setState({
      phase: "done",
      rows: state.rows,
      successCount,
      failedRows,
    });

    if (successCount > 0) {
      toast.success(
        `${successCount} propert${successCount === 1 ? "y" : "ies"} imported successfully`,
      );
    }
    if (failedRows.length > 0) {
      toast.error(
        `${failedRows.length} row${failedRows.length === 1 ? "" : "s"} failed to import`,
      );
    }
  };

  const handleReset = () => {
    setState({ phase: "idle" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const parsedRows =
    state.phase === "parsed" ||
    state.phase === "importing" ||
    state.phase === "done"
      ? state.rows
      : [];
  const validRows = parsedRows.filter((r) => !r.validationError);
  const invalidRows = parsedRows.filter((r) => !!r.validationError);
  const importingState = state.phase === "importing" ? state : null;
  const doneState = state.phase === "done" ? state : null;

  const progressPercent =
    importingState && importingState.total > 0
      ? Math.round((importingState.done / importingState.total) * 100)
      : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Import Properties
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Upload a CSV file to bulk-import property listings
          </p>
        </div>
        <div className="flex items-center gap-2">
          {state.phase !== "idle" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              data-ocid="admin.import.secondary_button"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Reset
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadTemplate}
            data-ocid="admin.import.download_button"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Download Template
          </Button>
        </div>
      </div>

      {/* Step 1: Upload */}
      {state.phase === "idle" && (
        <div className="space-y-6">
          {/* Instructions card */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex gap-3">
              <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs font-bold">i</span>
              </div>
              <div>
                <p className="text-sm font-medium text-blue-800 mb-1">
                  How to import
                </p>
                <ol className="text-sm text-blue-700 space-y-0.5 list-decimal list-inside">
                  <li>Download the CSV template using the button above</li>
                  <li>
                    Fill in your property data following the sample row format
                  </li>
                  <li>Upload the completed CSV file below</li>
                  <li>Review the preview and fix any validation errors</li>
                  <li>Click Import to save all valid properties</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
              isDragOver
                ? "border-saffron-400 bg-saffron-50"
                : "border-border hover:border-saffron-300 hover:bg-muted/30"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ")
                fileInputRef.current?.click();
            }}
            data-ocid="admin.import.dropzone"
          >
            <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium text-foreground mb-1">
              Drag & drop your CSV file here
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              or click to browse files
            </p>
            <Button
              variant="outline"
              size="sm"
              type="button"
              data-ocid="admin.import.upload_button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              Choose CSV File
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {(state.phase === "parsed" ||
        state.phase === "importing" ||
        state.phase === "done") && (
        <div className="space-y-5">
          {/* Summary bar */}
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary" className="text-sm px-3 py-1">
              {parsedRows.length} total rows
            </Badge>
            <Badge className="text-sm px-3 py-1 bg-green-100 text-green-700 border-green-200">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              {validRows.length} valid
            </Badge>
            {invalidRows.length > 0 && (
              <Badge className="text-sm px-3 py-1 bg-red-100 text-red-700 border-red-200">
                <AlertCircle className="w-3.5 h-3.5 mr-1" />
                {invalidRows.length} invalid
              </Badge>
            )}
          </div>

          {/* Validation errors (first 5 invalid rows) */}
          {invalidRows.length > 0 && (
            <div
              className="bg-red-50 border border-red-200 rounded-xl p-4"
              data-ocid="admin.import.error_state"
            >
              <p className="text-sm font-semibold text-red-800 mb-2">
                Validation errors (first {Math.min(5, invalidRows.length)} of{" "}
                {invalidRows.length})
              </p>
              <ul className="space-y-1">
                {invalidRows.slice(0, 5).map((row) => (
                  <li key={row.rowIndex} className="text-sm text-red-700">
                    <span className="font-medium">Row {row.rowIndex}</span>
                    {row.propertyId ? ` (${row.propertyId})` : ""}:{" "}
                    {row.validationError}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Preview table */}
          <div className="bg-white rounded-xl border border-border overflow-hidden shadow-xs">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-medium text-foreground">Preview</p>
            </div>
            <ScrollArea className="h-80">
              <Table data-ocid="admin.import.table">
                <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Property ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Area</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((row, idx) => (
                    <TableRow
                      key={row.rowIndex}
                      className={row.validationError ? "bg-red-50/60" : ""}
                      data-ocid={`admin.import.row.${idx + 1}`}
                    >
                      <TableCell className="text-muted-foreground text-xs">
                        {row.rowIndex}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.propertyId || (
                          <span className="text-red-500 italic">missing</span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {row.title || (
                          <span className="text-red-500 italic">missing</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{row.areaName}</TableCell>
                      <TableCell>
                        {row.propertyType ? (
                          <Badge
                            variant="secondary"
                            className={`text-xs ${
                              VALID_PROPERTY_TYPES.includes(row.propertyType)
                                ? ""
                                : "bg-red-100 text-red-700 border-red-200"
                            }`}
                          >
                            {row.propertyType}
                          </Badge>
                        ) : (
                          <span className="text-red-500 italic text-xs">
                            missing
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.priceRange}
                      </TableCell>
                      <TableCell className="text-sm">{row.ownerName}</TableCell>
                      <TableCell className="text-sm font-mono">
                        {row.ownerPhone}
                      </TableCell>
                      <TableCell>
                        {row.validationError ? (
                          <Badge className="text-xs bg-red-100 text-red-700 border-red-200">
                            Invalid
                          </Badge>
                        ) : (
                          <Badge className="text-xs bg-green-100 text-green-700 border-green-200">
                            Valid
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>

          {/* Import progress */}
          {state.phase === "importing" && (
            <div
              className="bg-white rounded-xl border border-border p-5 space-y-3"
              data-ocid="admin.import.loading_state"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-saffron-500" />
                  <span className="text-sm font-medium">
                    Importing {importingState?.done ?? 0} /{" "}
                    {importingState?.total ?? 0}...
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {progressPercent}%
                </span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
          )}

          {/* Done summary */}
          {state.phase === "done" && doneState && (
            <div
              className="bg-white rounded-xl border border-border p-5 space-y-3"
              data-ocid="admin.import.success_state"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <p className="font-semibold text-foreground">Import complete</p>
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="text-green-700 font-medium">
                  {doneState.successCount} propert
                  {doneState.successCount === 1 ? "y" : "ies"} imported
                  successfully
                </span>
                {doneState.failedRows.length > 0 && (
                  <>
                    ,{" "}
                    <span className="text-red-700 font-medium">
                      {doneState.failedRows.length} failed
                    </span>
                  </>
                )}
              </p>
              {doneState.failedRows.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs font-semibold text-red-800">
                    Failed rows:
                  </p>
                  {doneState.failedRows.map(({ row, error }) => (
                    <p key={row.rowIndex} className="text-xs text-red-700">
                      Row {row.rowIndex} ({row.propertyId}): {error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          {state.phase === "parsed" && (
            <div className="flex items-center gap-3">
              <Button
                onClick={handleImport}
                disabled={validRows.length === 0}
                className="bg-saffron-500 hover:bg-saffron-600 text-white"
                data-ocid="admin.import.primary_button"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import {validRows.length} Valid Propert
                {validRows.length === 1 ? "y" : "ies"}
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                data-ocid="admin.import.cancel_button"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
