export class AuthValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthValidationError";
  }
}

export class AuthConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthConflictError";
  }
}

export class AuthUnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthUnauthorizedError";
  }
}

export class AuthExpiredTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthExpiredTokenError";
  }
}
