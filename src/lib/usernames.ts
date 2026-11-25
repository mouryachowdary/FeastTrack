const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{0,49}$/;
const AUTH_EMAIL_DOMAIN = "login.feasttrack.invalid";

export function usernameToAuthEmail(username: string): string | undefined {
  const normalizedUsername = username.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(normalizedUsername)) return undefined;
  return `${normalizedUsername}@${AUTH_EMAIL_DOMAIN}`;
}
