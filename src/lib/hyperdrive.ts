/**
 * Hyperdrive Cloudflare Worker integration helper
 * 
 * Hyperdrive accelerates queries to existing databases from Cloudflare Workers
 * by pooling and maintaining connections and caching query responses.
 */

export interface HyperdriveBinding {
  /**
   * Unique generated connection string to connect to your database via Hyperdrive
   */
  connectionString: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
}

export interface WorkerEnv {
  HYPERDRIVE?: HyperdriveBinding;
  [key: string]: unknown;
}

/**
 * Helper to get the Hyperdrive connection string from worker environment.
 */
export function getHyperdriveConnectionString(env: WorkerEnv): string | undefined {
  return env.HYPERDRIVE?.connectionString;
}
