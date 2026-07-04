import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { writeAuditLog } from "../lib/audit.js";
import {
  CommerceValidationError,
  CommerceNotFoundError,
  CommerceForbiddenError,
} from "../lib/commerce.errors.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AddressDto = {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateAddressInput = {
  label?: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  isDefaultShipping?: boolean;
  isDefaultBilling?: boolean;
};

export type UpdateAddressInput = Partial<CreateAddressInput>;

// ── Helpers ───────────────────────────────────────────────────────────────────

const ADDRESS_SELECT = {
  id:                true,
  label:             true,
  fullName:          true,
  phone:             true,
  line1:             true,
  line2:             true,
  city:              true,
  state:             true,
  pincode:           true,
  country:           true,
  isDefaultShipping: true,
  isDefaultBilling:  true,
  createdAt:         true,
  updatedAt:         true,
} as const;

function validateInput(input: CreateAddressInput): void {
  const required: Array<keyof CreateAddressInput> = [
    "fullName", "phone", "line1", "city", "state", "pincode",
  ];
  for (const field of required) {
    const val = input[field];
    if (typeof val !== "string" || !val.trim()) {
      throw new CommerceValidationError(`${field} is required`);
    }
  }
  if (!/^\d{6}$/.test(input.pincode)) {
    throw new CommerceValidationError("pincode must be a 6-digit number");
  }
  if (!/^\+?[\d\s\-()]{7,15}$/.test(input.phone)) {
    throw new CommerceValidationError("phone must be a valid phone number");
  }
}

// ── Service ───────────────────────────────────────────────────────────────────

export const addressService = {

  async getAddresses(userId: string): Promise<AddressDto[]> {
    return prisma.address.findMany({
      where:   { userId, isActive: true },
      select:  ADDRESS_SELECT,
      orderBy: [{ isDefaultShipping: "desc" }, { createdAt: "asc" }],
    });
  },

  async createAddress(
    userId: string,
    input: CreateAddressInput,
    actorIp?: string
  ): Promise<AddressDto> {
    validateInput(input);

    const country = input.country?.trim() || "India";
    const setDefaultShipping = input.isDefaultShipping ?? false;
    const setDefaultBilling  = input.isDefaultBilling  ?? false;

    // First address is auto-default for both
    const count = await prisma.address.count({ where: { userId, isActive: true } });
    const isFirstAddress = count === 0;

    const willBeDefaultShipping = isFirstAddress || setDefaultShipping;
    const willBeDefaultBilling  = isFirstAddress || setDefaultBilling;

    // PgBouncer-safe: array-form $transaction — no interactive tx
    const ops: Prisma.PrismaPromise<unknown>[] = [];

    if (willBeDefaultShipping) {
      ops.push(
        prisma.address.updateMany({
          where: { userId, isActive: true, isDefaultShipping: true },
          data:  { isDefaultShipping: false },
        })
      );
    }
    if (willBeDefaultBilling) {
      ops.push(
        prisma.address.updateMany({
          where: { userId, isActive: true, isDefaultBilling: true },
          data:  { isDefaultBilling: false },
        })
      );
    }
    if (ops.length > 0) {
      await prisma.$transaction(ops);
    }

    const address = await prisma.address.create({
      data: {
        userId,
        label:             input.label?.trim()    ?? null,
        fullName:          input.fullName.trim(),
        phone:             input.phone.trim(),
        line1:             input.line1.trim(),
        line2:             input.line2?.trim()    ?? null,
        city:              input.city.trim(),
        state:             input.state.trim(),
        pincode:           input.pincode.trim(),
        country,
        isActive:          true,
        isDefault:         willBeDefaultShipping,
        isDefaultShipping: willBeDefaultShipping,
        isDefaultBilling:  willBeDefaultBilling,
      },
      select: ADDRESS_SELECT,
    });

    writeAuditLog({
      actorId:      userId,
      action:       "ADDRESS_CREATED",
      resourceType: "Address",
      resourceId:   address.id,
      after:        { city: address.city, state: address.state },
      ipAddress:    actorIp,
    });

    return address;
  },

  async updateAddress(
    userId: string,
    addressId: string,
    input: UpdateAddressInput,
    actorIp?: string
  ): Promise<AddressDto> {
    const existing = await prisma.address.findUnique({
      where:  { id: addressId },
      select: { userId: true, isActive: true },
    });
    if (!existing || !existing.isActive) {
      throw new CommerceNotFoundError("Address not found");
    }
    if (existing.userId !== userId) throw new CommerceForbiddenError();

    if (input.pincode && !/^\d{6}$/.test(input.pincode)) {
      throw new CommerceValidationError("pincode must be a 6-digit number");
    }
    if (input.phone && !/^\+?[\d\s\-()]{7,15}$/.test(input.phone)) {
      throw new CommerceValidationError("phone must be a valid phone number");
    }

    const ops: Prisma.PrismaPromise<unknown>[] = [];

    if (input.isDefaultShipping === true) {
      ops.push(
        prisma.address.updateMany({
          where: { userId, isActive: true, isDefaultShipping: true },
          data:  { isDefaultShipping: false },
        })
      );
    }
    if (input.isDefaultBilling === true) {
      ops.push(
        prisma.address.updateMany({
          where: { userId, isActive: true, isDefaultBilling: true },
          data:  { isDefaultBilling: false },
        })
      );
    }
    if (ops.length > 0) {
      await prisma.$transaction(ops);
    }

    const updated = await prisma.address.update({
      where: { id: addressId },
      data: {
        ...(input.label             !== undefined && { label:             input.label?.trim()    ?? null }),
        ...(input.fullName          !== undefined && { fullName:          input.fullName.trim() }),
        ...(input.phone             !== undefined && { phone:             input.phone.trim() }),
        ...(input.line1             !== undefined && { line1:             input.line1.trim() }),
        ...(input.line2             !== undefined && { line2:             input.line2?.trim()   ?? null }),
        ...(input.city              !== undefined && { city:              input.city.trim() }),
        ...(input.state             !== undefined && { state:             input.state.trim() }),
        ...(input.pincode           !== undefined && { pincode:           input.pincode.trim() }),
        ...(input.country           !== undefined && { country:           input.country.trim() }),
        ...(input.isDefaultShipping !== undefined && { isDefaultShipping: input.isDefaultShipping }),
        ...(input.isDefaultBilling  !== undefined && { isDefaultBilling:  input.isDefaultBilling }),
      },
      select: ADDRESS_SELECT,
    });

    writeAuditLog({
      actorId:      userId,
      action:       "ADDRESS_UPDATED",
      resourceType: "Address",
      resourceId:   addressId,
      after:        { fields: Object.keys(input) },
      ipAddress:    actorIp,
    });

    return updated;
  },

  async deleteAddress(
    userId: string,
    addressId: string,
    actorIp?: string
  ): Promise<void> {
    const existing = await prisma.address.findUnique({
      where:  { id: addressId },
      select: { userId: true, isActive: true },
    });
    if (!existing || !existing.isActive) {
      throw new CommerceNotFoundError("Address not found");
    }
    if (existing.userId !== userId) throw new CommerceForbiddenError();

    // Soft delete — preserves FK for existing order snapshots
    await prisma.address.update({
      where: { id: addressId },
      data:  { isActive: false, isDefault: false, isDefaultShipping: false, isDefaultBilling: false },
    });

    writeAuditLog({
      actorId:      userId,
      action:       "ADDRESS_DELETED",
      resourceType: "Address",
      resourceId:   addressId,
      ipAddress:    actorIp,
    });
  },
};
