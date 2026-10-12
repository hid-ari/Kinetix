import express from 'express';
import {
  getUnreadNotificationsCount,
  listUserNotifications,
  markNotificationRead,
  markAllNotificationsRead
} from '../repositories/notifications.repo.js';

export function createNotificationsRouter(ctx) {
  const router = express.Router();
  const { pool } = ctx;

  // Unread count
  router.get('/notifications/unread-count', async (req, res) => {
    try {
      const count = await getUnreadNotificationsCount(pool, req.user.userId);
      res.json({ unreadCount: count });
    } catch (err) {
      console.error('Error getting unread notifications count:', err);
      res.status(500).json({ message: 'Error al consultar notificaciones.' });
    }
  });

  // List notifications
  router.get('/notifications', async (req, res) => {
    try {
      const page = req.query.page ? Number(req.query.page) : 1;
      const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 20;
      const unreadOnly = req.query.unreadOnly === 'true';

      const result = await listUserNotifications(pool, req.user.userId, { page, pageSize, unreadOnly });
      res.json(result);
    } catch (err) {
      console.error('Error listing notifications:', err);
      res.status(500).json({ message: 'Error al listar notificaciones.' });
    }
  });

  // Mark single as read
  const handleMarkRead = async (req, res) => {
    try {
      const updated = await markNotificationRead(pool, req.params.id, req.user.userId);
      res.json(updated);
    } catch (err) {
      console.error('Error marking notification read:', err);
      res.status(500).json({ message: 'Error al actualizar notificación.' });
    }
  };
  router.patch('/notifications/:id/read', handleMarkRead);
  router.put('/notifications/:id/read', handleMarkRead);

  // Mark all as read
  const handleMarkAllRead = async (req, res) => {
    try {
      await markAllNotificationsRead(pool, req.user.userId);
      res.json({ message: 'Todas las notificaciones han sido marcadas como leídas.' });
    } catch (err) {
      console.error('Error marking all notifications read:', err);
      res.status(500).json({ message: 'Error al actualizar notificaciones.' });
    }
  };
  router.post('/notifications/read-all', handleMarkAllRead);
  router.put('/notifications/mark-all-read', handleMarkAllRead);
  router.put('/notifications/read-all', handleMarkAllRead);

  return router;
}
