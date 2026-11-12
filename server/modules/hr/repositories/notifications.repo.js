
/**
 * Creates an in-app notification for a specific user
 */
export async function createNotification(pool, {
  companyId,
  userId,
  title,
  message,
  category = 'Sistema',
  referenceType = null,
  referenceId = null
}) {
  return pool.insert('HrNotifications', {
    CompanyId: companyId,
    UserId: userId,
    Title: String(title ?? '').slice(0, 150),
    Message: String(message ?? '').slice(0, 1000),
    Category: category,
    ReferenceType: referenceType ? String(referenceType) : null,
    ReferenceId: referenceId ? String(referenceId) : null
  }, { returning: 'Id, Title, Category, CreatedAt' });
}

/**
 * Gets count of unread notifications for a user
 */
export async function getUnreadNotificationsCount(pool, userId) {
  return pool.count('HrNotifications', { UserId: userId, IsRead: false });
}

/**
 * Lists notifications for a user with pagination
 */
export async function listUserNotifications(pool, userId, { page = 1, pageSize = 20, unreadOnly = false } = {}) {
  const offset = (Math.max(1, page) - 1) * pageSize;
  let where = `WHERE UserId = @userId`;
  if (unreadOnly) where += ` AND IsRead = FALSE`;

  const [countRes, dataRes] = await Promise.all([
    pool.request()
      .input('userId', userId)
      .query(`SELECT COUNT(*) AS total FROM HrNotifications ${where};`),
    pool.request()
      .input('userId', userId)
      .input('offset', offset)
      .input('pageSize', pageSize)
      .query(`
        SELECT Id, CompanyId, Title, Message, Category, ReferenceType, ReferenceId, IsRead, ReadAt, CreatedAt
        FROM HrNotifications
        ${where}
        ORDER BY CreatedAt DESC
        LIMIT @pageSize OFFSET @offset;
      `)
  ]);

  return {
    total: countRes.recordset[0].total,
    data: dataRes.recordset,
    page,
    pageSize
  };
}

/**
 * Marks single notification as read
 */
export async function markNotificationRead(pool, id, userId) {
  const numericId = Number(id);
  if (!Number.isSafeInteger(numericId) || numericId <= 0) return undefined;
  const res = await pool.update('HrNotifications', { Id: numericId, UserId: userId }, {
    IsRead: true,
    ReadAt: new Date()
  }, { returning: 'Id, IsRead, ReadAt' });
  return Array.isArray(res) ? res[0] : res;
}

/**
 * Marks all notifications for a user as read
 */
export async function markAllNotificationsRead(pool, userId) {
  await pool.update('HrNotifications', { UserId: userId, IsRead: false }, {
    IsRead: true,
    ReadAt: new Date()
  }, { returning: false });
  return { success: true };
}
