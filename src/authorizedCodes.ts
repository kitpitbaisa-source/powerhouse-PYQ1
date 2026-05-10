/**
 * MANUAL ACCESS MANAGEMENT
 * 
 * To give a user access:
 * 1. Generate a unique code (e.g., 'NDA-PREM-XXXX')
 * 2. Add it to the list below
 * 3. Give the code to the user after they pay
 */

export const AUTHORIZED_CODES = [
  "PREMIUM2026", // Example code
  "NDA-SUCCESS-2026",
  // Add new codes below this line:
];

export const isValidCode = (code: string): boolean => {
  return AUTHORIZED_CODES.includes(code.trim().toUpperCase());
};
