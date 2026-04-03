import type { Principal } from "@icp-sdk/core/principal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  PaymentRecord,
  PrivatePropertyListing,
  PublicPropertyListing,
} from "../backend";
import type { PaymentStatus, PendingPayment } from "../types/paymentTypes";
import { useActor } from "./useActor";

export function useGetPublicProperties() {
  const { actor, isFetching } = useActor();
  return useQuery<PublicPropertyListing[]>({
    queryKey: ["publicProperties"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getPublicProperties();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetPropertyDetails(propertyId: string | null) {
  const { actor, isFetching } = useActor();
  return useQuery<PrivatePropertyListing>({
    queryKey: ["propertyDetails", propertyId],
    queryFn: async () => {
      if (!actor || !propertyId) throw new Error("No actor or property ID");
      return actor.getPropertyDetails(propertyId);
    },
    enabled: !!actor && !isFetching && !!propertyId,
    retry: false,
  });
}

export function useSubmitPayment() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      propertyId,
      transactionId,
    }: { propertyId: string; transactionId: string }) => {
      if (!actor) throw new Error("Not connected");
      // submitPayment is in the backend but types not yet regenerated; use cast
      await (actor as any).submitPayment(propertyId, transactionId);
    },
    onSuccess: (_, { propertyId }) => {
      queryClient.invalidateQueries({
        queryKey: ["propertyDetails", propertyId],
      });
      queryClient.invalidateQueries({ queryKey: ["myPaymentStatus"] });
      queryClient.invalidateQueries({ queryKey: ["pendingPayments"] });
    },
  });
}

export function useIsCallerAdmin() {
  const { actor, isFetching } = useActor();
  return useQuery<boolean | null>({
    queryKey: ["isCallerAdmin"],
    queryFn: async () => {
      if (!actor) return false;
      try {
        return await actor.isCallerAdmin();
      } catch {
        // User is not registered (backend traps with "User is not registered")
        // Return null to distinguish from "registered but not admin" (false)
        return null;
      }
    },
    enabled: !!actor && !isFetching,
    retry: false,
  });
}

export function useGetAllPaymentRecords() {
  const { actor, isFetching } = useActor();
  return useQuery<Array<[Principal, Array<PaymentRecord>]>>({
    queryKey: ["allPaymentRecords"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllPaymentRecords();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetMyPaymentStatus(propertyId: string | null) {
  const { actor, isFetching } = useActor();
  return useQuery<PaymentStatus | null>({
    queryKey: ["myPaymentStatus", propertyId],
    queryFn: async (): Promise<PaymentStatus | null> => {
      if (!actor || !propertyId) return null;
      const result = (await (actor as any).getMyPaymentStatus(
        propertyId,
      )) as Array<PaymentStatus>;
      return result.length > 0 ? (result[0] as PaymentStatus) : null;
    },
    enabled: !!actor && !isFetching && !!propertyId,
    retry: false,
  });
}

export function useGetPendingPayments() {
  const { actor, isFetching } = useActor();
  return useQuery<PendingPayment[]>({
    queryKey: ["pendingPayments"],
    queryFn: async (): Promise<PendingPayment[]> => {
      if (!actor) return [];
      return (actor as any).getPendingPayments() as Promise<PendingPayment[]>;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useApprovePayment() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      propertyId,
      customerPrincipal,
    }: { propertyId: string; customerPrincipal: Principal }) => {
      if (!actor) throw new Error("Not connected");
      await (actor as any).approvePayment(propertyId, customerPrincipal);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingPayments"] });
      queryClient.invalidateQueries({ queryKey: ["allPaymentRecords"] });
    },
  });
}

export function useRejectPayment() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      propertyId,
      customerPrincipal,
    }: { propertyId: string; customerPrincipal: Principal }) => {
      if (!actor) throw new Error("Not connected");
      await (actor as any).rejectPayment(propertyId, customerPrincipal);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingPayments"] });
      queryClient.invalidateQueries({ queryKey: ["allPaymentRecords"] });
    },
  });
}

export function useCreateOrUpdateProperty() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      propertyId,
      property,
    }: { propertyId: string; property: PrivatePropertyListing }) => {
      if (!actor) throw new Error("Not connected");
      await actor.createOrUpdateProperty(propertyId, property);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["publicProperties"] });
      queryClient.invalidateQueries({ queryKey: ["adminProperties"] });
    },
  });
}

export function useDeleteProperty() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (propertyId: string) => {
      if (!actor) throw new Error("Not connected");
      await actor.deleteProperty(propertyId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["publicProperties"] });
      queryClient.invalidateQueries({ queryKey: ["adminProperties"] });
    },
  });
}
