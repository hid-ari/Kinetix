import sql from 'mssql/msnodesqlv8.js';

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
  const result = await pool.request()
    .input('companyId', sql.Int, companyId)
    .input('userId', sql.NVarChar(450), userId)
    .input('title', sql.NVarChar(150), title)
    .input('message', sql.NVarChar(1000), message)
    .input('category', sql.NVarChar(50), category)
    .input('refType', sql.NVarChar(50), referenceType ? String(referenceType) : null)
    .input('refId', sql.NVarChar(100), referenceId ? String(referenceId) : null)
    .query(`
      INSERT INTO dbo.HrNotifications (CompanyId, UserId, Title, Message, Category, ReferenceType, ReferenceId)
      OUTPUT INSERTED.Id, INSERTED.Title, INSERTED.Category, INSERTED.CreatedAt
      VALUES (@companyId, @userId, @title, @message, @category, @refType, @refId);
    `);
  return result.recordset[0];
}

/**
 * Gets count of unread notifications for a user
 */
export async function getUnreadNotificationsCount(pool, userId) {
  const result = await pool.request()
    .input('userId', sql.NVarChar(450), userId)
    .query(`
      SELECT COUNT(*) AS unreadCount
      FROM dbo.HrNotifications
      WHERE UserId = @userId AND IsRead = 0;
    `);
  return result.recordset[0]?.unreadCount || 0;
}

/**
 * Lists notifications for a user with pagination
 */
export async function listUserNotifications(pool, userId, { page = 1, pageSize = 20, unreadOnly = false } = {}) {
  const offset = (Math.max(1, page) - 1) * pageSize;
  let where = `WHERE UserId = @userId`;
  if (unreadOnly) where += ` AND IsRead = 0`;

  const [countRes, dataRes] = await Promise.all([
    pool.request()
      .input('userId', sql.NVarChar(450), userId)
      .query(`SELECT COUNT(*) AS total FROM dbo.HrNotifications ${where};`),
    pool.request()
      .input('userId', sql.NVarChar(450), userId)
      .input('offset', sql.Int, offset)
      .input('pageSize', sql.Int, pageSize)
      .query(`
        SELECT Id, CompanyId, Title, Message, Category, ReferenceType, ReferenceId, IsRead, ReadAt, CreatedAt
        FROM dbo.HrNotifications
        ${where}
        ORDER BY CreatedAt DESC
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;
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
  const result = await pool.request()
    .input('id', sql.BigInt, Number(id))
    .input('userId', sql.NVarChar(450), userId)
    .query(`
      UPDATE dbo.HrNotifications
      SET IsRead = 1, ReadAt = SYSUTCDATETIME()
      OUTPUT INSERTED.Id, INSERTED.IsRead, INSERTED.ReadAt
      WHERE Id = @id AND UserId = @userId;
    `);
  return result.recordset[0];
}

/**
 * Marks all notifications for a user as read
 */
export async function markAllNotificationsRead(pool, userId) {
  await pool.request()
    .input('userId', sql.NVarChar(450), userId)
    .query(`
      UPDATE dbo.HrNotifications
      SET IsRead = 1, ReadAt = SYSUTCDATETIME()
      WHERE UserId = @userId AND IsRead = 0;
    `);
  return { success: true };
}
