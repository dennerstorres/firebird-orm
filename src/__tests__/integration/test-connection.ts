import { FirebirdConnectionOptions } from '../../types';

/**
 * Resolve connection options from environment variables, with safe fallback
 * to defaults compatible with the legacy CI Docker setup.
 *
 * Env vars (all optional):
 *   FB_HOST      default: localhost
 *   FB_PORT      default: 3050
 *   FB_DATABASE  default: test.fdb
 *   FB_USER      default: SYSDBA
 *   FB_PASSWORD  default: masterkey
 */
export function getTestConnectionOptions(): FirebirdConnectionOptions {
  const plugin = process.env.FB_PLUGIN_NAME as FirebirdConnectionOptions['pluginName'] | undefined;
  return {
    host: process.env.FB_HOST || 'localhost',
    port: parseInt(process.env.FB_PORT || '3050', 10),
    database: process.env.FB_DATABASE || 'test.fdb',
    user: process.env.FB_USER || 'SYSDBA',
    password: process.env.FB_PASSWORD || 'masterkey',
    poolSize: 5,
    // Only set pluginName when env forces it (e.g. Legacy_Auth for users without SRP entry).
    ...(plugin ? { pluginName: plugin } : {}),
  };
}
