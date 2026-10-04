import type { Express, Request, Response } from 'express';

const SYNC_TOKEN = process.env.NEXORO_SYNC_TOKEN || '';

type PendingOrder = {
  syncId: string;
  order: any;
  createdAt: string;
  acknowledged: boolean;
};

const pendingOrders: PendingOrder[] = [];

function authorized(req: Request): boolean {
  if (!SYNC_TOKEN) return false;

  const header = String(req.headers.authorization || '');
  const token = header.startsWith('Bearer ')
    ? header.slice(7)
    : '';

  return token === SYNC_TOKEN;
}

export function queueOnlineOrder(order: any): string | null {
  if (!order?.id) return null;

  const syncId = String(
    order.syncId ||
    order.id
  );

  const existing = pendingOrders.find(
    item => item.syncId === syncId
  );

  if (!existing) {
    pendingOrders.push({
      syncId,
      order: {
        ...order,
        syncId,
        source: order.source || 'online'
      },
      createdAt: new Date().toISOString(),
      acknowledged: false
    });
  }

  return syncId;
}

export function registerSyncRoutes(app: Express): void {
  app.get('/api/sync/orders', (req: Request, res: Response) => {
    if (!authorized(req)) {
      return res.status(401).json({
        error: 'Não autorizado'
      });
    }

    return res.json({
      orders: pendingOrders
        .filter(item => !item.acknowledged)
        .map(item => item.order)
    });
  });

  app.post('/api/sync/orders/:syncId/ack', (req: Request, res: Response) => {
    if (!authorized(req)) {
      return res.status(401).json({
        error: 'Não autorizado'
      });
    }

    const item = pendingOrders.find(
      entry => entry.syncId === String(req.params.syncId)
    );

    if (!item) {
      return res.status(404).json({
        error: 'Pedido não encontrado'
      });
    }

    item.acknowledged = true;

    return res.json({
      ok: true,
      syncId: item.syncId
    });
  });

  app.get('/api/sync/health', (req: Request, res: Response) => {
    if (!authorized(req)) {
      return res.status(401).json({
        error: 'Não autorizado'
      });
    }

    return res.json({
      ok: true,
      service: 'nexoro-sync',
      pending: pendingOrders.filter(
        item => !item.acknowledged
      ).length
    });
  });
}
