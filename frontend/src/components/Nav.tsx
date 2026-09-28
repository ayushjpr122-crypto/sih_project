/* Compatibility shim — navigation now lives in the unified single-row
   Header (Header.tsx). This re-export keeps any existing `Nav` imports
   working without duplicating the nav implementation. */
export { default } from "./Header";
