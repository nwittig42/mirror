/**
 * Password rules that both the server and the browser need to know.
 *
 * Deliberately its own module, holding no code. It used to live in
 * `src/lib/password.ts`, and importing this one constant from the client-side
 * change-password form pulled that whole module into the browser bundle, where
 * `node:crypto`'s `scrypt` is undefined and `promisify(scrypt)` threw at module
 * evaluation, so the page rendered as "This page couldn't load". Neither the
 * test suite nor `next build` caught it, only loading the page did.
 *
 * Anything a client component needs about passwords belongs here. Anything
 * that touches crypto belongs in `src/lib/password.ts` and must stay server-side.
 */
export const MIN_PASSWORD_LENGTH = 12;
