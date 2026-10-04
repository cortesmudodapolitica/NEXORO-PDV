const RENDER_URL =
  process.env.NEXORO_SYNC_SERVER ||
  'https://nexoro-pdv.onrender.com';

const TOKEN =
  process.env.NEXORO_SYNC_TOKEN || '';

const INTERVAL =
  Number(process.env.NEXORO_SYNC_INTERVAL || 3000);

const LOCAL_URL =
  process.env.NEXORO_LOCAL_URL ||
  'http://127.0.0.1:3000';

let syncing = false;

async function syncOrders() {
  if (syncing) return;

  syncing = true;

  try {
    const response = await fetch(
      \\/api/sync/orders\,
      {
        headers: TOKEN
          ? { Authorization: \Bearer \\ }
          : {}
      }
    );

    if (!response.ok) {
      return;
    }

    const data = await response.json();

    const orders = Array.isArray(data.orders)
      ? data.orders
      : [];

    for (const order of orders) {
      try {
        const localResponse = await fetch(
          \\/api/sync/import\,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ order })
          }
        );

        if (!localResponse.ok) {
          console.log(
            '[NEXORO SYNC] Falha ao importar pedido local:',
            order.id
          );
          continue;
        }

        const ackResponse = await fetch(
          \\/api/sync/orders/\/ack\,
          {
            method: 'POST',
            headers: TOKEN
              ? { Authorization: \Bearer \\ }
              : {}
          }
        );

        if (ackResponse.ok) {
          console.log(
            '[NEXORO SYNC] Pedido sincronizado:',
            order.id
          );
        }
      } catch {
        console.log(
          '[NEXORO SYNC] PDV/Render indisponível. Tentando novamente.'
        );
      }
    }
  } finally {
    syncing = false;
  }
}

console.log(
  '[NEXORO SYNC] Agente iniciado.'
);

console.log(
  '[NEXORO SYNC] Render:',
  RENDER_URL
);

console.log(
  '[NEXORO SYNC] Intervalo:',
  INTERVAL,
  'ms'
);

syncOrders();

setInterval(
  syncOrders,
  INTERVAL
);
