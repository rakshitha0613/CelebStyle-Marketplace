const rawPort = process.env.PORT ?? "4000";
const port = Number(rawPort);

if (Number.isNaN(port) || port < 1 || port > 65535) {
  throw new Error(
    `[startup] PORT must be a valid port number (1-65535), got: "${rawPort}"`
  );
}

export const config = {
  port,
} as const;
