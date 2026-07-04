import { prisma } from "../lib/prisma.js";
import { CommerceNotFoundError, CommerceValidationError } from "../lib/commerce.errors.js";

export type WarehouseInput = {
  slug:          string;
  name:          string;
  city:          string;
  state:         string;
  pincode:       string;
  country?:      string;
  contactPhone?: string;
  priority?:     number;
};

export const warehouseService = {
  async list(includeInactive = false) {
    return prisma.warehouse.findMany({
      where:   includeInactive ? {} : { isActive: true },
      orderBy: [{ priority: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { inventory: true } },
      },
    });
  },

  async get(id: string) {
    const wh = await prisma.warehouse.findUnique({
      where:   { id },
      include: { inventory: { select: { variantId: true, quantity: true, reservedQuantity: true } } },
    });
    if (!wh) throw new CommerceNotFoundError("Warehouse not found");
    return wh;
  },

  async create(data: WarehouseInput) {
    if (!data.slug || !data.name || !data.city || !data.state || !data.pincode) {
      throw new CommerceValidationError("slug, name, city, state, and pincode are required");
    }
    if (!/^\d{6}$/.test(data.pincode)) {
      throw new CommerceValidationError("pincode must be 6 digits");
    }
    return prisma.warehouse.create({
      data: {
        slug:         data.slug,
        name:         data.name,
        city:         data.city,
        state:        data.state,
        pincode:      data.pincode,
        country:      data.country      ?? "India",
        contactPhone: data.contactPhone ?? null,
        priority:     data.priority     ?? 100,
      },
    });
  },

  async update(id: string, data: Partial<WarehouseInput> & { isActive?: boolean }) {
    await this.get(id); // throws if not found
    if (data.pincode && !/^\d{6}$/.test(data.pincode)) {
      throw new CommerceValidationError("pincode must be 6 digits");
    }
    return prisma.warehouse.update({
      where: { id },
      data: {
        ...(data.name         !== undefined && { name:         data.name }),
        ...(data.city         !== undefined && { city:         data.city }),
        ...(data.state        !== undefined && { state:        data.state }),
        ...(data.pincode      !== undefined && { pincode:      data.pincode }),
        ...(data.country      !== undefined && { country:      data.country }),
        ...(data.contactPhone !== undefined && { contactPhone: data.contactPhone }),
        ...(data.priority     !== undefined && { priority:     data.priority }),
        ...(data.isActive     !== undefined && { isActive:     data.isActive }),
      },
    });
  },

  // Find highest-priority warehouse with >= qty available units for the given variant.
  async findBestForVariant(variantId: string, qty: number) {
    const inventories = await prisma.inventory.findMany({
      where:   { variantId, warehouse: { isActive: true } },
      include: { warehouse: { select: { id: true, name: true, priority: true } } },
      orderBy: { warehouse: { priority: "asc" } },
    });
    return inventories.find((inv) => inv.quantity - inv.reservedQuantity >= qty) ?? null;
  },
};
