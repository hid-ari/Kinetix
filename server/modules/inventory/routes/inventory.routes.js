import { Router } from 'express';
import { getPool, sql } from '../../../core/db.js';
import { requirePermission, isGlobalAdmin, writeAudit } from '../../../core/auth.js';

export function createInventoryRouter() {
  const router = Router();

  // Productos
  router.get('/products', requirePermission('Productos', 'Ver productos'), async (request, response) => {
    try {
      const result = await (await getPool()).request()
        .input('companyId', sql.Int, request.user.companyId)
        .input('isGlobal', sql.Bit, isGlobalAdmin(request))
        .query(`
           SELECT p.Id AS id, p.Sku AS sku, p.Name AS name, p.Category AS category, p.UnitName AS unit,
             p.MinimumStock AS minimum, p.UnitCost AS price, p.IsActive AS isActive, COALESCE(SUM(s.Quantity), 0) AS stock
          FROM dbo.Products AS p
          LEFT JOIN dbo.InventoryStock AS s ON s.ProductId = p.Id
          WHERE p.IsActive = 1 AND (@isGlobal = 1 OR p.CompanyId = @companyId)
          GROUP BY p.Id, p.Sku, p.Name, p.Category, p.UnitName, p.MinimumStock, p.UnitCost, p.IsActive
          ORDER BY p.Name;
        `);
      response.json(result.recordset);
    } catch (error) {
      console.error('Products query failed:', error.message);
      response.status(500).json({ message: 'No fue posible cargar los productos.' });
    }
  });

  router.post('/products', requirePermission('Productos', 'Crear productos'), async (request, response) => {
    const { sku, name, category, unit = 'und.', minimum = 0, price = 0, companyId } = request.body;
    const targetCompanyId = isGlobalAdmin(request) ? Number(companyId || request.user.companyId) : request.user.companyId;
    if (!Number.isInteger(Number(targetCompanyId)) || !sku?.trim() || !name?.trim() || Number(minimum) < 0 || Number(price) < 0) {
      return response.status(400).json({ message: 'Empresa, SKU, nombre y valores válidos son obligatorios.' });
    }
    try {
      const result = await (await getPool()).request()
        .input('companyId', sql.Int, targetCompanyId).input('sku', sql.NVarChar(50), sku.trim())
        .input('name', sql.NVarChar(180), name.trim()).input('category', sql.NVarChar(100), category?.trim() || null)
        .input('unit', sql.NVarChar(30), unit.trim()).input('minimum', sql.Decimal(18, 3), Number(minimum))
        .input('price', sql.Decimal(18, 4), Number(price))
        .query(`INSERT INTO dbo.Products (CompanyId, Sku, Name, Category, UnitName, MinimumStock, UnitCost)
                OUTPUT INSERTED.Id AS id, INSERTED.Sku AS sku, INSERTED.Name AS name
                VALUES (@companyId, @sku, @name, @category, @unit, @minimum, @price);`);
      await writeAudit(request, 'CREATE', 'Productos', 'Product', result.recordset[0].id, targetCompanyId);
      response.status(201).json(result.recordset[0]);
    } catch (error) {
      console.error('Product creation failed:', error.message);
      response.status(error.number === 2627 ? 409 : 500).json({ message: error.number === 2627 ? 'Ese SKU ya existe en la empresa.' : 'No fue posible crear el producto.' });
    }
  });

  router.put('/products/:id', requirePermission('Productos', 'Editar productos'), async (request, response) => {
    const { sku, name, category, unit = 'und.', minimum = 0, price = 0 } = request.body;
    if (!sku?.trim() || !name?.trim() || Number(minimum) < 0 || Number(price) < 0) {
      return response.status(400).json({ message: 'SKU, nombre y valores válidos son obligatorios.' });
    }
    try {
      const result = await (await getPool()).request()
        .input('id', sql.Int, Number(request.params.id)).input('companyId', sql.Int, request.user.companyId || null)
        .input('isGlobal', sql.Bit, isGlobalAdmin(request)).input('sku', sql.NVarChar(50), sku.trim())
        .input('name', sql.NVarChar(180), name.trim()).input('category', sql.NVarChar(100), category?.trim() || null)
        .input('unit', sql.NVarChar(30), unit.trim()).input('minimum', sql.Decimal(18, 3), Number(minimum))
        .input('price', sql.Decimal(18, 4), Number(price))
        .query(`UPDATE dbo.Products SET Sku = @sku, Name = @name, Category = @category, UnitName = @unit,
                MinimumStock = @minimum, UnitCost = @price, UpdatedAt = SYSUTCDATETIME()
                OUTPUT INSERTED.Id AS id, INSERTED.Sku AS sku, INSERTED.Name AS name
                WHERE Id = @id AND (@isGlobal = 1 OR CompanyId = @companyId);`);
      if (!result.recordset[0]) return response.status(404).json({ message: 'Producto no encontrado.' });
      await writeAudit(request, 'UPDATE', 'Productos', 'Product', request.params.id);
      response.json(result.recordset[0]);
    } catch (error) {
      console.error('Product update failed:', error.message);
      response.status(error.number === 2627 ? 409 : 500).json({ message: error.number === 2627 ? 'Ese SKU ya existe en la empresa.' : 'No fue posible actualizar el producto.' });
    }
  });

  router.patch('/products/:id/status', requirePermission('Productos', 'Editar productos'), async (request, response) => {
    if (typeof request.body?.isActive !== 'boolean') return response.status(400).json({ message: 'isActive debe ser booleano.' });
    try {
      const result = await (await getPool()).request()
        .input('id', sql.Int, Number(request.params.id)).input('isActive', sql.Bit, request.body.isActive)
        .input('companyId', sql.Int, request.user.companyId || null).input('isGlobal', sql.Bit, isGlobalAdmin(request))
        .query(`UPDATE dbo.Products SET IsActive = @isActive, UpdatedAt = SYSUTCDATETIME()
                OUTPUT INSERTED.Id AS id, INSERTED.IsActive AS isActive
                WHERE Id = @id AND (@isGlobal = 1 OR CompanyId = @companyId);`);
      if (!result.recordset[0]) return response.status(404).json({ message: 'Producto no encontrado.' });
      await writeAudit(request, request.body.isActive ? 'ACTIVATE' : 'DEACTIVATE', 'Productos', 'Product', request.params.id);
      response.json(result.recordset[0]);
    } catch (error) {
      console.error('Product status update failed:', error.message);
      response.status(500).json({ message: 'No fue posible actualizar el producto.' });
    }
  });

  // Existencias
  router.get('/stock', requirePermission('Existencias', 'Ver existencias'), async (request, response) => {
    try {
      const result = await (await getPool()).request()
        .input('companyId', sql.Int, request.user.companyId)
        .input('isGlobal', sql.Bit, isGlobalAdmin(request))
        .query(`
          SELECT s.Id AS id, s.ProductId AS productId, p.Sku AS sku, p.Name AS product,
                 p.UnitName AS unit, p.MinimumStock AS minimum, s.Quantity AS quantity,
                 b.Id AS branchId, b.Name AS branch
          FROM dbo.InventoryStock AS s
          INNER JOIN dbo.Products AS p ON p.Id = s.ProductId
          INNER JOIN dbo.Branches AS b ON b.Id = s.BranchId
          WHERE (@isGlobal = 1 OR s.CompanyId = @companyId)
          ORDER BY p.Name, b.Name;
        `);
      response.json(result.recordset);
    } catch (error) {
      console.error('Stock query failed:', error.message);
      response.status(500).json({ message: 'No fue posible cargar las existencias.' });
    }
  });

  // Movimientos
  router.get('/movements', requirePermission('Movimientos', 'Ver movimientos'), async (request, response) => {
    try {
      const result = await (await getPool()).request()
        .input('companyId', sql.Int, request.user.companyId)
        .input('isGlobal', sql.Bit, isGlobalAdmin(request))
        .query(`
          SELECT TOP 100 m.Id AS id, m.CreatedAt AS createdAt, m.MovementType AS type,
                 p.Sku AS sku, p.Name AS product, m.Quantity AS quantity, b.Name AS branch,
                 COALESCE(CONCAT(u.FirstName, N' ', u.LastName), N'Sistema') AS userName
          FROM dbo.InventoryMovements AS m
          INNER JOIN dbo.Products AS p ON p.Id = m.ProductId
          INNER JOIN dbo.Branches AS b ON b.Id = m.BranchId
          LEFT JOIN dbo.UserOrganizations AS u ON u.UserId = m.CreatedBy
          WHERE (@isGlobal = 1 OR m.CompanyId = @companyId)
          ORDER BY m.CreatedAt DESC;
        `);
      response.json(result.recordset);
    } catch (error) {
      console.error('Movements query failed:', error.message);
      response.status(500).json({ message: 'No fue posible cargar los movimientos.' });
    }
  });

  router.post('/movements', requirePermission('Movimientos', 'Registrar movimientos'), async (request, response) => {
    const { productId, branchId, type, quantity, notes } = request.body;
    if (!Number.isInteger(Number(productId)) || !Number.isInteger(Number(branchId)) || !Number(quantity) || !['Entrada', 'Salida'].includes(type)) {
      return response.status(400).json({ message: 'Producto, sucursal, tipo y cantidad válida son obligatorios.' });
    }
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    try {
      await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
      const requestScope = new sql.Request(transaction)
        .input('productId', sql.Int, Number(productId)).input('branchId', sql.Int, Number(branchId))
        .input('companyId', sql.Int, request.user.companyId || null).input('isGlobal', sql.Bit, isGlobalAdmin(request));
      const productResult = await requestScope.query(`
        SELECT p.Id, p.CompanyId, p.UnitCost FROM dbo.Products AS p
        INNER JOIN dbo.Branches AS b ON b.Id = @branchId AND b.CompanyId = p.CompanyId
        WHERE p.Id = @productId AND p.IsActive = 1 AND (@isGlobal = 1 OR p.CompanyId = @companyId);
      `);
      const product = productResult.recordset[0];
      if (!product) throw Object.assign(new Error('Producto o sucursal fuera de tu organización.'), { status: 403 });
      const stockRequest = new sql.Request(transaction).input('productId', sql.Int, Number(productId)).input('branchId', sql.Int, Number(branchId));
      const stockResult = await stockRequest.query('SELECT Quantity FROM dbo.InventoryStock WITH (UPDLOCK) WHERE ProductId = @productId AND BranchId = @branchId;');
      const currentStock = Number(stockResult.recordset[0]?.Quantity || 0);
      const amount = Number(quantity);
      if (type === 'Salida' && currentStock < amount) throw Object.assign(new Error('La existencia disponible no alcanza para esta salida.'), { status: 409 });
      const nextStock = currentStock + (type === 'Entrada' ? amount : -amount);
      const updateStock = new sql.Request(transaction).input('companyId', sql.Int, product.CompanyId)
        .input('productId', sql.Int, Number(productId)).input('branchId', sql.Int, Number(branchId)).input('quantity', sql.Decimal(18, 3), nextStock);
      await updateStock.query(`
        IF EXISTS (SELECT 1 FROM dbo.InventoryStock WHERE ProductId = @productId AND BranchId = @branchId)
          UPDATE dbo.InventoryStock SET Quantity = @quantity, UpdatedAt = SYSUTCDATETIME() WHERE ProductId = @productId AND BranchId = @branchId;
        ELSE
          INSERT INTO dbo.InventoryStock (CompanyId, ProductId, BranchId, Quantity) VALUES (@companyId, @productId, @branchId, @quantity);
      `);
      const movement = await new sql.Request(transaction).input('companyId', sql.Int, product.CompanyId)
        .input('productId', sql.Int, Number(productId)).input('branchId', sql.Int, Number(branchId))
        .input('type', sql.NVarChar(10), type).input('quantity', sql.Decimal(18, 3), amount)
        .input('unitCost', sql.Decimal(18, 4), product.UnitCost).input('notes', sql.NVarChar(300), notes?.trim() || null)
        .input('createdBy', sql.NVarChar(450), request.user.userId)
        .query(`INSERT INTO dbo.InventoryMovements (CompanyId, ProductId, BranchId, MovementType, Quantity, UnitCost, Notes, CreatedBy)
                OUTPUT INSERTED.Id AS id, INSERTED.CreatedAt AS createdAt
                VALUES (@companyId, @productId, @branchId, @type, @quantity, @unitCost, @notes, @createdBy);`);
      await transaction.commit();
      response.status(201).json(movement.recordset[0]);
    } catch (error) {
      await transaction.rollback().catch(() => {});
      console.error('Movement creation failed:', error.message);
      response.status(error.status || 500).json({ message: error.status ? error.message : 'No fue posible registrar el movimiento.' });
    }
  });

  return router;
}
