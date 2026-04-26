/// <reference types="vite/client" />

// Vite re-emits imported assets (e.g. @fontsource/... woff2) as URL strings.
// @fontsource/jetbrains-mono ships its own types; this file is only here
// to satisfy tsconfig.web.json's include list and to enable Vite-specific
// import.meta typing in future renderer-side code.

export {};
