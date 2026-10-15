/**
 * Shared data contract between the backend (Supabase edge function) and the
 * client (Expo app). The backend only ever sends GLOBAL data: listings and
 * every known offer for those merchants. It never sees the user's cards.
 * The client filters and computes locally (inverted privacy model).
 */
export {};
