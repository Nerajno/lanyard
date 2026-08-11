export interface PasswordUpdatePayload {
  password: string
  current_password?: string
}

export function buildPasswordUpdate(currentPassword: string, newPassword: string): PasswordUpdatePayload {
  const payload: PasswordUpdatePayload = { password: newPassword }
  if (currentPassword.trim()) payload.current_password = currentPassword
  return payload
}