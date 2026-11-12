/**
 * Data Access Layer (Repository) para el módulo de Inventario.
 * Encapsula todas las operaciones SQL y transacciones de base de datos.
 */

export async function getProducts(pool, { companyId, isGlobal }) {
  const result = await pool.request()
    .input('companyId', companyId)
    .input('isGlobal', isGlobal)
    .query(`
      SELECT p.Id AS id, p.Sku AS sku, p.Name AS name, p.Category AS category, p.UnitName AS unit,
             p.MinimumStock AS minimum, p.UnitCost AS price, p.IsActive AS isActive, COALESCE(SUM(s.Quantity), 0) AS stock
      FROM Products AS p
      LEFT JOIN InventoryStock AS s ON s.ProductId = p.Id
      WHERE p.IsActive = TRUE AND (@isGlobal = TRUE OR p.CompanyId = @companyId)
      GROUP BY p.Id, p.Sku, p.Name, p.Category, p.UnitName, p.MinimumStock, p.UnitCost, p.IsActive
      ORDER BY p.Name;
    `);
  return result.recordset;
}

export async function createProduct(pool, { targetCompanyId, sku, name, category, unit, minimum, price }) {
  return pool.insert('Products', {
    CompanyId: targetCompanyId,
    Sku: sku.trim(),
    Name: name.trim(),
    Category: category?.trim() || null,
    UnitName: unit.trim(),
    MinimumStock: Number(minimum),
    UnitCost: Number(price)
  }, { returning: 'Id AS id, Sku AS sku, Name AS name' });
}

export async function updateProduct(pool, { id, sku, name, category, unit, minimum, price, companyId, isGlobal }) {
  const where = { Id: Number(id) };
  if (!isGlobal) where.CompanyId = companyId;

  const res = await pool.update('Products', where, {
    Sku: sku.trim(),
    Name: name.trim(),
    Category: category?.trim() || null,
    UnitName: unit.trim(),
    MinimumStock: Number(minimum),
    UnitCost: Number(price),
    UpdatedAt: new Date()
  }, { returning: 'Id AS id, Sku AS sku, Name AS name' });

  return Array.isArray(res) ? res[0] : res;
}

export async function updateProductStatus(pool, { id, isActive, companyId, isGlobal }) {
  const where = { Id: Number(id) };
  if (!isGlobal) where.CompanyId = companyId;

  const res = await pool.update('Products', where, {
    IsActive: isActive,
    UpdatedAt: new Date()
  }, { returning: 'Id AS id, IsActive AS isActive' });

  return Array.isArray(res) ? res[0] : res;
}

export async function getStock(pool, { companyId, isGlobal }) {
  const result = await pool.request()
    .input('companyId', companyId)
    .input('isGlobal', isGlobal)
    .query(`
      SELECT s.Id AS id, s.ProductId AS productId, p.Sku AS sku, p.Name AS product,
             p.UnitName AS unit, p.MinimumStock AS minimum, s.Quantity AS quantity,
             b.Id AS branchId, b.Name AS branch
      FROM InventoryStock AS s
      INNER JOIN Products AS p ON p.Id = s.ProductId
      INNER JOIN Branches AS b ON b.Id = s.BranchId
      WHERE (@isGlobal = TRUE OR s.CompanyId = @companyId)
      ORDER BY p.Name, b.Name;
    `);
  return result.recordset;
}

export async function getMovements(pool, { companyId, isGlobal }) {
  const result = await pool.request()
    .input('companyId', companyId)
    .input('isGlobal', isGlobal)
    .query(`
      SELECT m.Id AS id, m.CreatedAt AS createdAt, m.MovementType AS type,
             p.Sku AS sku, p.Name AS product, m.Quantity AS quantity, b.Name AS branch,
             COALESCE(CONCAT(u.FirstName, ' ', u.LastName), 'Sistema') AS userName
      FROM InventoryMovements AS m
      INNER JOIN Products AS p ON p.Id = m.ProductId
      INNER JOIN Branches AS b ON b.Id = m.BranchId
      LEFT JOIN UserOrganizations AS u ON u.UserId = m.CreatedBy
      WHERE (@isGlobal = TRUE OR m.CompanyId = @companyId)
      ORDER BY m.CreatedAt DESC
      LIMIT 100;
    `);
  return result.recordset;
}

export async function recordStockMovement(pool, { productId, branchId, type, quantity, notes, userId, companyId, isGlobal }) {
  const transaction = pool.transaction();
  await transaction.begin();

  try {
    const requestScope = transaction.request()
      .input('productId', Number(productId))
      .input('branchId', Number(branchId))
      .input('companyId', companyId || null)
      .input('isGlobal', isGlobal);

    const productResult = await requestScope.query(`
      SELECT p.Id, p.CompanyId, p.UnitCost FROM Products AS p
      INNER JOIN Branches AS b ON b.Id = @branchId AND b.CompanyId = p.CompanyId
      WHERE p.Id = @productId AND p.IsActive = TRUE AND (@isGlobal = TRUE OR p.CompanyId = @companyId);
    `);

    const product = productResult.recordset[0];
    if (!product) {
      throw Object.assign(new Error('Producto o sucursal fuera de tu organización.'), { status: 403 });
    }

    const stockRequest = transaction.request()
      .input('productId', Number(productId))
      .input('branchId', Number(branchId));

    const stockResult = await stockRequest.query(
      'SELECT Quantity FROM InventoryStock WHERE ProductId = @productId AND BranchId = @branchId FOR UPDATE;'
    );

    const currentStock = Number(stockResult.recordset[0]?.Quantity || 0);
    const amount = Number(quantity);

    if (type === 'Salida' && currentStock < amount) {
      throw Object.assign(new Error('La existencia disponible no alcanza para esta salida.'), { status: 409 });
    }

    const nextStock = currentStock + (type === 'Entrada' ? amount : -amount);
    const existingStock = await transaction.findOne('InventoryStock', {
      ProductId: Number(productId),
      BranchId: Number(branchId)
    });

    if (existingStock) {
      await transaction.update('InventoryStock', { ProductId: Number(productId), BranchId: Number(branchId) }, {
        Quantity: nextStock
      });
    } else {
      await transaction.insert('InventoryStock', {
        CompanyId: product.CompanyId,
        ProductId: Number(productId),
        BranchId: Number(branchId),
        Quantity: nextStock
      });
    }

    const movement = await transaction.insert('InventoryMovements', {
      CompanyId: product.CompanyId,
      ProductId: Number(productId),
      BranchId: Number(branchId),
      MovementType: type,
      Quantity: amount,
      UnitCost: product.UnitCost,
      Notes: notes?.trim() || null,
      CreatedBy: userId
    });

    await transaction.commit();
    return { id: movement.Id, createdAt: movement.CreatedAt };
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  }
}
