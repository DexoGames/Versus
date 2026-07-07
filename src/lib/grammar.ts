/**
 * Subject–verb agreement for player names. Seats named "You" (and "I"/"We")
 * take the base verb — "You win" — while third-person names take the -s form —
 * "Bob wins". Keeps win/round banners from reading "You wins".
 */
const SECOND_OR_FIRST_PERSON = /^(you|i|we)$/i;

export function conjugate(name: string, verb: string): string {
  const base = SECOND_OR_FIRST_PERSON.test(name.trim());
  return `${name} ${verb}${base ? "" : "s"}`;
}
