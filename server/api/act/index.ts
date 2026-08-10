// Legacy: old nudges embedded ?t= query links. Point them at the new /act/:token path.
export default defineEventHandler(async (event) => {
  const token = getQuery(event).t
  return sendRedirect(event, `/act/${String(token ?? '')}`, 302)
})