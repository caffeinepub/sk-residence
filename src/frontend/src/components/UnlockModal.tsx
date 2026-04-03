import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Copy,
  ExternalLink,
  Home,
  Loader2,
  MapPin,
  Phone,
  User,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { PrivatePropertyListing, PublicPropertyListing } from "../backend";
import { useActor } from "../hooks/useActor";
import { useSubmitPayment } from "../hooks/useQueries";
import type { PaymentStatus } from "../types/paymentTypes";
import PropertyDetailsView from "./PropertyDetailsView";

interface UnlockModalProps {
  property: PublicPropertyListing;
  propertyId: string;
  onClose: () => void;
}

const WHAT_YOU_GET = [
  { icon: User, text: "Owner full name" },
  { icon: Phone, text: "Owner contact number (call directly)" },
  { icon: MapPin, text: "Exact property location on map" },
  { icon: Home, text: "Full address & all property details" },
];

type PaymentStep = "payment" | "pending" | "approved" | "rejected";

export default function UnlockModal({
  property,
  propertyId,
  onClose,
}: UnlockModalProps) {
  const [utrNumber, setUtrNumber] = useState("");
  const [utrError, setUtrError] = useState("");
  const [step, setStep] = useState<PaymentStep>("payment");
  const [unlockedDetails, setUnlockedDetails] =
    useState<PrivatePropertyListing | null>(null);
  const [submittedUtr, setSubmittedUtr] = useState("");
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { mutateAsync: submitPayment, isPending } = useSubmitPayment();
  const { actor } = useActor();

  const UPI_ID = "7095244790@ybl";
  const UPI_LINK = `upi://pay?pa=${UPI_ID}&pn=SK+Residence&am=20&cu=INR&tn=Property+Details`;

  useEffect(() => {
    if (utrNumber.trim()) setUtrError("");
  }, [utrNumber]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const checkPaymentStatus = useCallback(async () => {
    if (!actor) return;
    try {
      const result: [PaymentStatus] | [] = await (
        actor as any
      ).getMyPaymentStatus(propertyId);
      if (result.length === 0) return;
      const status = result[0];
      if ("approved" in status) {
        stopPolling();
        // Fetch property details now that payment is approved
        try {
          const details = await actor.getPropertyDetails(propertyId);
          setUnlockedDetails(details);
          setStep("approved");
          toast.success("Payment approved! Property details unlocked.");
        } catch {
          toast.error("Could not fetch property details. Please refresh.");
        }
      } else if ("rejected" in status) {
        stopPolling();
        setStep("rejected");
      }
    } catch {
      // silently ignore poll errors
    }
  }, [actor, propertyId, stopPolling]);

  // Start polling when step becomes pending
  useEffect(() => {
    if (step !== "pending") {
      stopPolling();
      return;
    }
    // Check immediately on entering pending
    checkPaymentStatus();
    pollIntervalRef.current = setInterval(checkPaymentStatus, 30_000);
    return () => stopPolling();
  }, [step, checkPaymentStatus, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const handleVerify = async () => {
    if (!utrNumber.trim()) {
      setUtrError("Please enter your UTR / Transaction ID");
      return;
    }
    if (utrNumber.trim().length < 6) {
      setUtrError(
        "Transaction ID seems too short. Please check and try again.",
      );
      return;
    }
    try {
      await submitPayment({
        propertyId,
        transactionId: utrNumber.trim(),
      });
      setSubmittedUtr(utrNumber.trim());
      setStep("pending");
    } catch {
      toast.error("Submission failed. Please check your transaction ID.");
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-w-lg w-full max-h-[90vh] overflow-y-auto p-0"
        data-ocid="unlock.dialog"
      >
        <AnimatePresence mode="wait">
          {/* ── Step: Approved → show full property details ── */}
          {step === "approved" && unlockedDetails ? (
            <motion.div
              key="details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <DialogHeader className="px-6 pt-6 pb-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <DialogTitle className="font-display text-xl">
                    Property Unlocked!
                  </DialogTitle>
                </div>
              </DialogHeader>
              <PropertyDetailsView details={unlockedDetails} />
            </motion.div>
          ) : step === "pending" ? (
            /* ── Step: Pending review ── */
            <motion.div
              key="pending"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
                <DialogTitle className="font-display text-xl">
                  Payment Under Review
                </DialogTitle>
                <div className="text-sm text-muted-foreground mt-1">
                  {property.title} &middot; {property.areaName} &middot;{" "}
                  <Badge variant="secondary" className="text-xs">
                    {property.propertyType}
                  </Badge>
                </div>
              </DialogHeader>

              <div
                className="px-6 py-8 flex flex-col items-center gap-5 text-center"
                data-ocid="unlock.pending.panel"
              >
                {/* Clock + Spinner */}
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center">
                    <Clock className="w-7 h-7 text-amber-500" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white flex items-center justify-center">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  </span>
                </div>

                <div className="space-y-1.5">
                  <h3 className="font-semibold text-foreground text-base">
                    Payment received — under review
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Usually approved within a few hours. This page will update
                    automatically when approved.
                  </p>
                </div>

                {/* UTR reference */}
                <div className="bg-muted/60 rounded-lg px-5 py-3 w-full max-w-xs">
                  <p className="text-xs text-muted-foreground mb-0.5">
                    Your Transaction ID
                  </p>
                  <p className="font-mono font-semibold text-sm text-foreground break-all">
                    {submittedUtr}
                  </p>
                </div>

                <p className="text-xs text-muted-foreground">
                  Checking status every 30 seconds…
                </p>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  className="mt-1"
                  data-ocid="unlock.pending.close_button"
                >
                  Close — I&apos;ll come back later
                </Button>
              </div>
            </motion.div>
          ) : step === "rejected" ? (
            /* ── Step: Rejected ── */
            <motion.div
              key="rejected"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
                <DialogTitle className="font-display text-xl">
                  Payment Not Approved
                </DialogTitle>
              </DialogHeader>

              <div
                className="px-6 py-8 flex flex-col items-center gap-5 text-center"
                data-ocid="unlock.rejected.panel"
              >
                <div className="w-16 h-16 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center">
                  <AlertCircle className="w-7 h-7 text-red-500" />
                </div>

                <div className="space-y-1.5">
                  <h3 className="font-semibold text-foreground text-base">
                    Payment rejected
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Your payment could not be verified. Please contact support
                    with your transaction ID.
                  </p>
                </div>

                {submittedUtr && (
                  <div className="bg-muted/60 rounded-lg px-5 py-3 w-full max-w-xs">
                    <p className="text-xs text-muted-foreground mb-0.5">
                      Transaction ID
                    </p>
                    <p className="font-mono font-semibold text-sm text-foreground break-all">
                      {submittedUtr}
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStep("payment");
                      setUtrNumber("");
                    }}
                    data-ocid="unlock.rejected.secondary_button"
                  >
                    Try Again
                  </Button>
                  <Button
                    variant="default"
                    onClick={onClose}
                    data-ocid="unlock.rejected.close_button"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : (
            /* ── Step: Payment form (default) ── */
            <motion.div
              key="payment"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
                <DialogTitle className="font-display text-xl">
                  Unlock Property Details
                </DialogTitle>
                <div className="text-sm text-muted-foreground mt-1">
                  {property.title} &middot; {property.areaName} &middot;{" "}
                  <Badge variant="secondary" className="text-xs">
                    {property.propertyType}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="px-6 py-5 space-y-5">
                {/* What you get */}
                <div className="bg-saffron-50 border border-saffron-200 rounded-lg p-4">
                  <h4 className="font-semibold text-saffron-800 text-sm mb-2">
                    After payment you will get:
                  </h4>
                  <ul className="space-y-1.5 text-sm text-saffron-700">
                    {WHAT_YOU_GET.map((item) => (
                      <li key={item.text} className="flex items-center gap-2">
                        <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
                        {item.text}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* QR Code */}
                <div className="flex flex-col items-center gap-3">
                  <p className="font-semibold text-foreground text-sm text-center">
                    Scan QR or pay via UPI ID
                  </p>
                  <div className="border-2 border-saffron-200 rounded-xl p-3 bg-white shadow-card">
                    <img
                      src="/assets/generated/upi-qr-code.dim_300x300.png"
                      alt="Scan to pay ₹20 via UPI to SK Residence"
                      className="w-48 h-48 object-contain"
                    />
                  </div>
                  <div className="flex items-center gap-2 bg-muted rounded-lg px-4 py-2.5 text-sm font-mono">
                    <span className="text-foreground font-semibold">
                      {UPI_ID}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(UPI_ID);
                        toast.success("UPI ID copied!");
                      }}
                      className="text-muted-foreground hover:text-saffron-600 transition-colors"
                      aria-label="Copy UPI ID"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-center">
                    <span className="inline-flex items-center gap-1.5 bg-saffron-500 text-white px-5 py-2 rounded-full font-bold text-lg">
                      ₹20
                    </span>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      One-time payment per property
                    </p>
                  </div>
                  <a
                    href={UPI_LINK}
                    className="flex items-center gap-1.5 text-xs text-saffron-600 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open in UPI app
                  </a>
                </div>

                {/* UTR Input */}
                <div className="space-y-2">
                  <Label htmlFor="utr" className="font-semibold text-sm">
                    Enter UTR / Transaction ID{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    After paying, find the transaction ID in your UPI app
                    payment history.
                  </p>
                  <Input
                    id="utr"
                    placeholder="e.g. 123456789012"
                    value={utrNumber}
                    onChange={(e) => setUtrNumber(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                    className={utrError ? "border-destructive" : ""}
                    data-ocid="unlock.input"
                  />
                  {utrError && (
                    <p
                      className="text-xs text-destructive"
                      data-ocid="unlock.error_state"
                    >
                      {utrError}
                    </p>
                  )}
                </div>

                <Button
                  onClick={handleVerify}
                  disabled={isPending}
                  className="w-full bg-saffron-500 hover:bg-saffron-600 text-white font-bold py-3 text-base"
                  data-ocid="unlock.submit_button"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />{" "}
                      Submitting Payment...
                    </>
                  ) : (
                    "✓ Submit Payment for Approval"
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Your payment will be reviewed by our admin. Details unlock
                  automatically once approved — usually within a few hours.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
