/**
 * Licens-fixtures for e2e. TEST_LICENSE_CODE er den frosne vektorkode fra
 * apps/party-server/test/license.vectors.ts — den validerer kun, fordi
 * playwright.config.ts booter partykit dev med det offentlige test-secret
 * (LICENSE_SECRET_V1=dystn-test-secret-...). Ingen af delene deployes.
 */
export const TEST_LICENSE_CODE = "040V4F-P41YC0-45RCV8-6Z341G";

/** Gyldigt format, ugyldig signatur (sidste tegn flippet G→H). */
export const INVALID_LICENSE_CODE = "040V4F-P41YC0-45RCV8-6Z341H";
