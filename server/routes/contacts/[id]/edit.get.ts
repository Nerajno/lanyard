export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  return sendRedirect(event, `/app/c/${id}`, 301)
})