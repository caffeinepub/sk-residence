import Map "mo:core/Map";
import List "mo:core/List";
import Set "mo:core/Set";
import Iter "mo:core/Iter";
import Text "mo:core/Text";
import Runtime "mo:core/Runtime";
import Principal "mo:core/Principal";
import Order "mo:core/Order";
import Array "mo:core/Array";
import Time "mo:core/Time";

import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";
import Storage "blob-storage/Storage";
import MixinStorage "blob-storage/Mixin";

actor {
  type PublicPropertyListing = {
    title : Text;
    areaName : Text;
    propertyType : Text;
    priceRange : Text;
    photos : [Storage.ExternalBlob];
    isActive : Bool;
  };

  type PrivatePropertyListing = {
    title : Text;
    areaName : Text;
    propertyType : Text;
    priceRange : Text;
    photos : [Storage.ExternalBlob];
    latitude : Float;
    longitude : Float;
    ownerName : Text;
    ownerPhone : Text;
    fullAddress : Text;
    description : Text;
    isActive : Bool;
  };

  type BackendPropertyListing = {
    publicListing : PublicPropertyListing;
    latitude : Float;
    longitude : Float;
    ownerName : Text;
    ownerPhone : Text;
    fullAddress : Text;
    description : Text;
  };

  public type PaymentRecord = {
    propertyId : Text;
    transactionId : Text;
    amount : Nat;
    timestamp : Int;
  };

  public type PaymentStatus = {
    #pending;
    #approved;
    #rejected;
  };

  public type PendingPayment = {
    propertyId : Text;
    transactionId : Text;
    customerPrincipal : Principal;
    amount : Nat;
    timestamp : Int;
    status : PaymentStatus;
  };

  public type UserProfile = {
    name : Text;
  };

  module PropertyListing {
    public func compare(p1 : PublicPropertyListing, p2 : PublicPropertyListing) : Order.Order {
      Text.compare(p1.title, p2.title);
    };
  };

  module PrivatePropertyListing {
    public func compare(p1 : PrivatePropertyListing, p2 : PrivatePropertyListing) : Order.Order {
      Text.compare(p1.title, p2.title);
    };
  };

  let propertyListings = Map.empty<Text, BackendPropertyListing>();
  let unlockedProperties = Map.empty<Principal, Set.Set<Text>>();
  let paymentRecords = Map.empty<Principal, List.List<PaymentRecord>>();
  // Key: propertyId # "__" # customerPrincipalText
  let pendingPayments = Map.empty<Text, PendingPayment>();
  let userProfiles = Map.empty<Principal, UserProfile>();

  let accessControlState = AccessControl.initState();

  // Hardcoded site owner as permanent admin (Internet Identity login)
  let ownerPrincipal = Principal.fromText("6pfma-c42f4-wvpag-fq575-uxdsl-rw55p-6yg67-xqyhu-meu3b-scx4c-nae");
  accessControlState.userRoles.add(ownerPrincipal, #admin);

  // Hardcoded principal for username/password login (derived from fixed Ed25519 seed)
  let passwordAdminPrincipal = Principal.fromText("4o6ml-wiipq-olpc7-aviix-v5kie-lvzse-b2f7t-gxaem-akxbr-n4pjj-3qe");
  accessControlState.userRoles.add(passwordAdminPrincipal, #admin);

  accessControlState.adminAssigned := true;

  include MixinAuthorization(accessControlState);
  include MixinStorage();

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  public shared ({ caller }) func createOrUpdateProperty(propertyId : Text, property : PrivatePropertyListing) : async () {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can manage property listings");
    };

    let publicListing : PublicPropertyListing = {
      title = property.title;
      areaName = property.areaName;
      propertyType = property.propertyType;
      priceRange = property.priceRange;
      photos = property.photos;
      isActive = property.isActive;
    };
    let backendListing : BackendPropertyListing = {
      latitude = property.latitude;
      longitude = property.longitude;
      ownerName = property.ownerName;
      ownerPhone = property.ownerPhone;
      fullAddress = property.fullAddress;
      description = property.description;
      publicListing;
    };
    propertyListings.add(propertyId, backendListing);
  };

  public shared ({ caller }) func deleteProperty(propertyId : Text) : async () {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can manage property listings");
    };
    propertyListings.remove(propertyId);
  };

  public query func getPublicProperties() : async [PublicPropertyListing] {
    propertyListings.values().toArray().map(
      func(backendListing) { backendListing.publicListing }
    ).sort();
  };

  // Submit payment for manual approval (does NOT unlock immediately)
  public shared ({ caller }) func submitPayment(propertyId : Text, transactionId : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can submit payments");
    };

    let property = propertyListings.get(propertyId);
    switch (property) {
      case (null) { Runtime.trap("Property does not exist") };
      case (_) {};
    };

    let key = propertyId # "__" # caller.toText();
    let newPendingPayment : PendingPayment = {
      propertyId;
      transactionId;
      customerPrincipal = caller;
      amount = 20;
      timestamp = Time.now();
      status = #pending;
    };
    pendingPayments.add(key, newPendingPayment);

    // Also record in payment records for history
    let newPayment : PaymentRecord = {
      propertyId;
      transactionId;
      amount = 20;
      timestamp = Time.now();
    };
    let existingPayments = switch (paymentRecords.get(caller)) {
      case (null) { List.empty<PaymentRecord>() };
      case (?payments) { payments };
    };
    existingPayments.add(newPayment);
    paymentRecords.add(caller, existingPayments);
  };

  // Get payment status for the caller on a specific property
  public query ({ caller }) func getMyPaymentStatus(propertyId : Text) : async ?PaymentStatus {
    let key = propertyId # "__" # caller.toText();
    switch (pendingPayments.get(key)) {
      case (null) { null };
      case (?payment) { ?payment.status };
    };
  };

  // Admin: get all pending payments awaiting approval
  public query ({ caller }) func getPendingPayments() : async [PendingPayment] {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can view pending payments");
    };
    pendingPayments.values().toArray();
  };

  // Admin: approve a payment and unlock property for the customer
  public shared ({ caller }) func approvePayment(propertyId : Text, customerPrincipal : Principal) : async () {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can approve payments");
    };

    let key = propertyId # "__" # customerPrincipal.toText();
    switch (pendingPayments.get(key)) {
      case (null) { Runtime.trap("Payment record not found") };
      case (?payment) {
        let updatedPayment : PendingPayment = {
          payment with
          status = #approved;
        };
        pendingPayments.add(key, updatedPayment);

        // Unlock the property for the customer
        let currentUnlocks = switch (unlockedProperties.get(customerPrincipal)) {
          case (null) { Set.empty<Text>() };
          case (?unlocks) { unlocks };
        };
        currentUnlocks.add(propertyId);
        unlockedProperties.add(customerPrincipal, currentUnlocks);
      };
    };
  };

  // Admin: reject a payment
  public shared ({ caller }) func rejectPayment(propertyId : Text, customerPrincipal : Principal) : async () {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can reject payments");
    };

    let key = propertyId # "__" # customerPrincipal.toText();
    switch (pendingPayments.get(key)) {
      case (null) { Runtime.trap("Payment record not found") };
      case (?payment) {
        let updatedPayment : PendingPayment = {
          payment with
          status = #rejected;
        };
        pendingPayments.add(key, updatedPayment);
      };
    };
  };

  public query ({ caller }) func getPropertyDetails(propertyId : Text) : async PrivatePropertyListing {
    switch (propertyListings.get(propertyId)) {
      case (null) { Runtime.trap("Property does not exist") };
      case (?backendListing) {
        if (AccessControl.isAdmin(accessControlState, caller)) {
          return {
            backendListing with
            title = backendListing.publicListing.title;
            areaName = backendListing.publicListing.areaName;
            propertyType = backendListing.publicListing.propertyType;
            priceRange = backendListing.publicListing.priceRange;
            photos = backendListing.publicListing.photos;
            isActive = backendListing.publicListing.isActive;
          };
        };

        switch (unlockedProperties.get(caller)) {
          case (null) { Runtime.trap("Unauthorized: You must unlock this property to view details") };
          case (?unlocks) {
            if (not unlocks.contains(propertyId)) {
              Runtime.trap("Unauthorized: You must unlock this property to view details");
            };
            {
              backendListing with
              title = backendListing.publicListing.title;
              areaName = backendListing.publicListing.areaName;
              propertyType = backendListing.publicListing.propertyType;
              priceRange = backendListing.publicListing.priceRange;
              photos = backendListing.publicListing.photos;
              isActive = backendListing.publicListing.isActive;
            };
          };
        };
      };
    };
  };

  public query ({ caller }) func getAllPaymentRecords() : async [(Principal, [PaymentRecord])] {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can view all payment records");
    };
    paymentRecords.toArray().map(
      func((principal, payments)) {
        (principal, payments.toArray());
      }
    );
  };
};
