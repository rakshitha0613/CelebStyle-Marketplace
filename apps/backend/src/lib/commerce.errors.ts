export class CommerceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommerceValidationError";
  }
}

export class CommerceNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommerceNotFoundError";
  }
}

export class CommerceForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "CommerceForbiddenError";
  }
}

export class CheckoutError extends Error {
  constructor(
    message: string,
    public readonly code: string = "CHECKOUT_ERROR"
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

export class InsufficientStockError extends Error {
  constructor(
    public readonly available: number,
    public readonly requested: number
  ) {
    super(
      available === 0
        ? "This item is currently out of stock"
        : `Only ${available} unit(s) available (requested ${requested})`
    );
    this.name = "InsufficientStockError";
  }
}
