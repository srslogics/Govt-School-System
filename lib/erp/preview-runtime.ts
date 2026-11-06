export const sharedErpAvailable = false;

export function handleErp() {
  return Response.json(
    {
      error:
        'This preview host has no shared ERP database. Run the Node server with a persistent database to use attendance.',
    },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
