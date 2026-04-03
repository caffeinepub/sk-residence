import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export class ExternalBlob {
    getBytes(): Promise<Uint8Array<ArrayBuffer>>;
    getDirectURL(): string;
    static fromURL(url: string): ExternalBlob;
    static fromBytes(blob: Uint8Array<ArrayBuffer>): ExternalBlob;
    withUploadProgress(onProgress: (percentage: number) => void): ExternalBlob;
}
export interface PaymentRecord {
    propertyId: string;
    timestamp: bigint;
    amount: bigint;
    transactionId: string;
}
export type PaymentStatus = { pending: null } | { approved: null } | { rejected: null };
export interface PendingPayment {
    propertyId: string;
    transactionId: string;
    customerPrincipal: Principal;
    amount: bigint;
    timestamp: bigint;
    status: PaymentStatus;
}
export interface PublicPropertyListing {
    title: string;
    propertyType: string;
    isActive: boolean;
    priceRange: string;
    areaName: string;
    photos: Array<ExternalBlob>;
}
export interface PrivatePropertyListing {
    latitude: number;
    title: string;
    ownerName: string;
    propertyType: string;
    ownerPhone: string;
    description: string;
    isActive: boolean;
    priceRange: string;
    longitude: number;
    areaName: string;
    fullAddress: string;
    photos: Array<ExternalBlob>;
}
export interface UserProfile {
    name: string;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    createOrUpdateProperty(propertyId: string, property: PrivatePropertyListing): Promise<void>;
    deleteProperty(propertyId: string): Promise<void>;
    getAllPaymentRecords(): Promise<Array<[Principal, Array<PaymentRecord>]>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getPropertyDetails(propertyId: string): Promise<PrivatePropertyListing>;
    getPublicProperties(): Promise<Array<PublicPropertyListing>>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    submitPayment(propertyId: string, transactionId: string): Promise<void>;
    getMyPaymentStatus(propertyId: string): Promise<[PaymentStatus] | []>;
    getPendingPayments(): Promise<PendingPayment[]>;
    approvePayment(propertyId: string, customerPrincipal: Principal): Promise<void>;
    rejectPayment(propertyId: string, customerPrincipal: Principal): Promise<void>;
}
