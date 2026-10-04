import 'dotenv/config';

const RENDER_URL = (
  process.env.NEXORO_SYNC_SERVER ||
  'https://nexoro-pdv.onrender.com'
).replace(/\/$/, '');

const TOKEN = process.env.NEXORO_SYNC_TOKEN || '';
const INTERVAL = Number(process.env.NEXORO_SYNC_INTERVAL || 3000);
const LOCAL_URL = (
  process.env.NEXORO_LOCAL_URL ||
  'http://127.0.0.1:3000'
).replace(/\/$/, '');

let syncing = false;

async function syncOrders() {
  if (syncing) return;

  syncing = true;

  try {
    const response = await fetch(
      `${RENDER_URL}/api/sync/orders`,
      {
        headers: TOKEN
          ? { Authorization: `Bearer ${TOKEN}` }
          : {}
      }
    );

    if (!response.ok) {
      throw new Error(`Servidor online respondeu HTTP ${response.status}`);
    }

    const data = await response.json();
    const orders = Array.isArray(data?.orders) ? data.orders : [];

    for (const order of orders) {
      try {
        const importResponse = await fetch(
          `${LOCAL_URL}/api/sync/import`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(TOKEN
                ? { Authorization: `Bearer ${TOKEN}` }
                : {})
            },
            body: JSON.stringify({ order })
          }
        );

        if (!importResponse.ok) {
          throw new Error(
            `Importação local respondeu HTTP ${importResponse.status}`
          );
        }

        const imported = await importResponse.json();

        if (imported?.ok) {
          await fetch(
            `${RENDER_URL}/api/sync/orders/${encodeURIComponent(order.syncId || order.id)}/ack`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(TOKEN
                  ? { Authorization: `Bearer ${TOKEN}` }
                  : {})
              }
            }
          );

          console.log(
            `[SYNC] Pedido ${order.shortCode || order.id} enviado ao PDV local.`
          );
        }
      } catch (error) {
        console.error(
          `[SYNC] Falha ao importar pedido ${order.shortCode || order.id}:`,
          error instanceof Error ? error.message : error
        );
      }
    }
  } catch (error) {
    console.error(
      '[SYNC] Falha na comunicação com NEXORO online:',
      error instanceof Error ? error.message : error
    );
  } finally {
    syncing = false;
  }
}

console.log('==============================================');
console.log('NEXORO SYNC AGENT');
console.log(`Online: ${RENDER_URL}`);
console.log(`PDV local: ${LOCAL_URL}`);
console.log(`Intervalo: ${INTERVAL} ms`);
console.log('==============================================');

syncOrders();

setInterval(syncOrders, INTERVAL);
