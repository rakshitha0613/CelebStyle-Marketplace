import { Router } from "express";
import { authenticate } from "../auth/middleware/authenticate.js";
import { addressService } from "../services/address.service.js";
import {
  CommerceValidationError,
  CommerceNotFoundError,
  CommerceForbiddenError,
} from "../lib/commerce.errors.js";

export const addressesRouter = Router();

// All address routes require authentication
addressesRouter.use(authenticate);

function handleError(err: unknown, res: import("express").Response): void {
  if (err instanceof CommerceValidationError) {
    res.status(400).json({ message: err.message });
  } else if (err instanceof CommerceNotFoundError) {
    res.status(404).json({ message: err.message });
  } else if (err instanceof CommerceForbiddenError) {
    res.status(403).json({ message: err.message });
  } else {
    console.error("[Addresses]", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

// GET /api/addresses
addressesRouter.get("/", async (req, res) => {
  try {
    const addresses = await addressService.getAddresses(req.user!.id);
    res.json({ data: addresses });
  } catch (err) {
    handleError(err, res);
  }
});

// POST /api/addresses
addressesRouter.post("/", async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;

    const address = await addressService.createAddress(
      req.user!.id,
      {
        label:             typeof body.label             === "string" ? body.label             : undefined,
        fullName:          typeof body.fullName          === "string" ? body.fullName          : "",
        phone:             typeof body.phone             === "string" ? body.phone             : "",
        line1:             typeof body.line1             === "string" ? body.line1             : "",
        line2:             typeof body.line2             === "string" ? body.line2             : undefined,
        city:              typeof body.city              === "string" ? body.city              : "",
        state:             typeof body.state             === "string" ? body.state             : "",
        pincode:           typeof body.pincode           === "string" ? body.pincode           : "",
        country:           typeof body.country           === "string" ? body.country           : undefined,
        isDefaultShipping: typeof body.isDefaultShipping === "boolean" ? body.isDefaultShipping : undefined,
        isDefaultBilling:  typeof body.isDefaultBilling  === "boolean" ? body.isDefaultBilling  : undefined,
      },
      req.ip
    );
    res.status(201).json({ data: address });
  } catch (err) {
    handleError(err, res);
  }
});

// PATCH /api/addresses/:id
addressesRouter.patch("/:id", async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;

    const address = await addressService.updateAddress(
      req.user!.id,
      req.params.id as string,
      {
        ...(body.label             !== undefined && { label:             typeof body.label             === "string" ? body.label             : undefined }),
        ...(body.fullName          !== undefined && { fullName:          typeof body.fullName          === "string" ? body.fullName          : "" }),
        ...(body.phone             !== undefined && { phone:             typeof body.phone             === "string" ? body.phone             : "" }),
        ...(body.line1             !== undefined && { line1:             typeof body.line1             === "string" ? body.line1             : "" }),
        ...(body.line2             !== undefined && { line2:             typeof body.line2             === "string" ? body.line2             : undefined }),
        ...(body.city              !== undefined && { city:              typeof body.city              === "string" ? body.city              : "" }),
        ...(body.state             !== undefined && { state:             typeof body.state             === "string" ? body.state             : "" }),
        ...(body.pincode           !== undefined && { pincode:           typeof body.pincode           === "string" ? body.pincode           : "" }),
        ...(body.country           !== undefined && { country:           typeof body.country           === "string" ? body.country           : undefined }),
        ...(body.isDefaultShipping !== undefined && { isDefaultShipping: typeof body.isDefaultShipping === "boolean" ? body.isDefaultShipping : false }),
        ...(body.isDefaultBilling  !== undefined && { isDefaultBilling:  typeof body.isDefaultBilling  === "boolean" ? body.isDefaultBilling  : false }),
      },
      req.ip
    );
    res.json({ data: address });
  } catch (err) {
    handleError(err, res);
  }
});

// DELETE /api/addresses/:id
addressesRouter.delete("/:id", async (req, res) => {
  try {
    await addressService.deleteAddress(
      req.user!.id,
      req.params.id as string,
      req.ip
    );
    res.status(204).send();
  } catch (err) {
    handleError(err, res);
  }
});
