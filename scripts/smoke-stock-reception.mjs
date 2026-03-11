import { createClient } from '@supabase/supabase-js';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function buildClient(url, key) {
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function buildRunId() {
  return new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
}

function assertCondition(condition, message, details = {}) {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

async function createTemporaryUser(adminClient, runId) {
  const email = `smoke.stock.${runId}@cashpilot.test`;
  const password = `CashPilot!${runId}`;

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: `Stock Smoke ${runId}`,
    },
  });

  if (error) {
    throw error;
  }

  return {
    email,
    password,
    user: data.user,
  };
}

async function safeDeleteByEq(client, table, column, value) {
  const { error } = await client.from(table).delete().eq(column, value);
  if (error && !['PGRST116', 'PGRST204', '42P01'].includes(error.code)) {
    throw error;
  }
}

async function safeDeleteByIds(client, table, ids) {
  if (!ids.length) {
    return;
  }

  const { error } = await client.from(table).delete().in('id', ids);
  if (error && !['PGRST116', 'PGRST204', '42P01'].includes(error.code)) {
    throw error;
  }
}

async function main() {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const runId = buildRunId();

  const adminClient = buildClient(supabaseUrl, serviceRoleKey);
  const serviceClient = buildClient(supabaseUrl, serviceRoleKey);

  const summary = {
    runId,
    passed: false,
    user: null,
    companyId: null,
    supplierId: null,
    supplierProductId: null,
    productId: null,
    orderId: null,
    checks: {
      stockUpdated: false,
      deliveryDateStamped: false,
      historyCreated: false,
      alertResolved: false,
      accountingEntriesCreated: false,
      accountingCompanyScoped: false,
    },
    cleanup: {
      rowsDeleted: false,
      userDeleted: false,
    },
  };

  const cleanupIds = {
    companyId: null,
    supplierId: null,
    supplierProductId: null,
    productId: null,
    orderId: null,
    itemId: null,
    stockAlertId: null,
  };

  let tempUserId = null;
  let executionError = null;

  try {
    const tempUser = await createTemporaryUser(adminClient, runId);
    tempUserId = tempUser.user.id;
    summary.user = {
      id: tempUser.user.id,
      email: tempUser.email,
    };

    const { data: company, error: companyError } = await serviceClient
      .from('company')
      .insert([{
        user_id: tempUserId,
        company_name: `Smoke Stock ${runId}`,
        company_type: 'company',
        country: 'BE',
        currency: 'EUR',
        accounting_currency: 'EUR',
        city: 'Brussels',
      }])
      .select('id')
      .single();

    if (companyError) {
      throw companyError;
    }

    cleanupIds.companyId = company.id;
    summary.companyId = company.id;

    const { error: prefsError } = await serviceClient
      .from('user_company_preferences')
      .upsert({
        user_id: tempUserId,
        active_company_id: company.id,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (prefsError) {
      throw prefsError;
    }

    const { error: settingsError } = await serviceClient
      .from('user_accounting_settings')
      .upsert({
        user_id: tempUserId,
        country: 'BE',
        is_initialized: true,
        auto_journal_enabled: true,
      }, {
        onConflict: 'user_id',
      });

    if (settingsError) {
      throw settingsError;
    }

    const { data: mapping, error: mappingError } = await serviceClient
      .from('accounting_mappings')
      .insert([{
        user_id: tempUserId,
        source_type: 'supplier_order',
        source_category: 'merchandise',
        debit_account_code: '601',
        credit_account_code: '401',
        mapping_name: 'Smoke supplier order',
        description: 'Smoke test mapping',
        is_active: true,
      }])
      .select('id')
      .single();

    if (mappingError) {
      throw mappingError;
    }

    const { data: supplier, error: supplierError } = await serviceClient
      .from('suppliers')
      .insert([{
        user_id: tempUserId,
        company_name: `Smoke Supplier ${runId}`,
        currency: 'EUR',
        status: 'active',
        supplier_type: 'product',
      }])
      .select('id')
      .single();

    if (supplierError) {
      throw supplierError;
    }

    cleanupIds.supplierId = supplier.id;
    summary.supplierId = supplier.id;

    const { data: supplierProduct, error: supplierProductError } = await serviceClient
      .from('supplier_products')
      .insert([{
        supplier_id: supplier.id,
        product_name: `Smoke Supplier Product ${runId}`,
        sku: `SSP-${runId}`,
        unit: 'piece',
        unit_price: 10,
        stock_quantity: 0,
        min_stock_level: 0,
        reorder_quantity: 0,
      }])
      .select('id')
      .single();

    if (supplierProductError) {
      throw supplierProductError;
    }

    cleanupIds.supplierProductId = supplierProduct.id;
    summary.supplierProductId = supplierProduct.id;

    const { data: product, error: productError } = await serviceClient
      .from('products')
      .insert([{
        user_id: tempUserId,
        product_name: `Smoke Product ${runId}`,
        sku: `SMK-${runId}`,
        unit: 'piece',
        stock_quantity: 2,
        min_stock_level: 5,
        purchase_price: 10,
        unit_price: 20,
        supplier_id: supplier.id,
      }])
      .select('id, stock_quantity')
      .single();

    if (productError) {
      throw productError;
    }

    cleanupIds.productId = product.id;
    summary.productId = product.id;

    const { data: alert, error: alertError } = await serviceClient
      .from('stock_alerts')
      .insert([{
        product_id: product.id,
        user_product_id: product.id,
        alert_type: 'low_stock',
        is_active: true,
      }])
      .select('id')
      .single();

    if (alertError) {
      throw alertError;
    }

    cleanupIds.stockAlertId = alert.id;

    const { data: order, error: orderError } = await serviceClient
      .from('supplier_orders')
      .insert([{
        user_id: tempUserId,
        supplier_id: supplier.id,
        order_number: `SO-${runId}`,
        order_date: new Date().toISOString().slice(0, 10),
        order_status: 'confirmed',
        total_amount: 40,
        notes: 'Smoke stock reception',
      }])
      .select('id, order_number')
      .single();

    if (orderError) {
      throw orderError;
    }

    cleanupIds.orderId = order.id;
    summary.orderId = order.id;

    const { data: item, error: itemError } = await serviceClient
      .from('supplier_order_items')
      .insert([{
        order_id: order.id,
        product_id: supplierProduct.id,
        quantity: 4,
        unit_price: 10,
        total_price: 40,
        user_product_id: product.id,
      }])
      .select('id')
      .single();

    if (itemError) {
      throw itemError;
    }

    cleanupIds.itemId = item.id;

    const { error: receiveError } = await serviceClient
      .from('supplier_orders')
      .update({
        order_status: 'received',
      })
      .eq('id', order.id);

    if (receiveError) {
      throw receiveError;
    }

    const { data: productAfter, error: productAfterError } = await serviceClient
      .from('products')
      .select('stock_quantity')
      .eq('id', product.id)
      .single();

    if (productAfterError) {
      throw productAfterError;
    }

    summary.checks.stockUpdated = Number(productAfter.stock_quantity) === 6;
    assertCondition(summary.checks.stockUpdated, 'Expected product stock to be incremented to 6.', {
      actualStock: productAfter.stock_quantity,
    });

    const { data: orderAfter, error: orderAfterError } = await serviceClient
      .from('supplier_orders')
      .select('actual_delivery_date, order_status')
      .eq('id', order.id)
      .single();

    if (orderAfterError) {
      throw orderAfterError;
    }

    summary.checks.deliveryDateStamped = Boolean(orderAfter.actual_delivery_date) && ['received', 'delivered'].includes(orderAfter.order_status);
    assertCondition(summary.checks.deliveryDateStamped, 'Expected supplier order to be delivered with an actual delivery date.', orderAfter);

    const { data: historyRows, error: historyError } = await serviceClient
      .from('product_stock_history')
      .select('previous_quantity, new_quantity, change_quantity, reason')
      .eq('order_id', order.id)
      .eq('user_product_id', product.id);

    if (historyError) {
      throw historyError;
    }

    const historyRow = historyRows?.[0] || null;
    summary.checks.historyCreated = Boolean(historyRow)
      && Number(historyRow.previous_quantity) === 2
      && Number(historyRow.new_quantity) === 6
      && Number(historyRow.change_quantity) === 4
      && historyRow.reason === 'purchase_received';
    assertCondition(summary.checks.historyCreated, 'Expected stock history row to be written for the supplier reception.', {
      historyRows,
    });

    const { data: alertAfter, error: alertAfterError } = await serviceClient
      .from('stock_alerts')
      .select('is_active, resolved_at')
      .eq('id', alert.id)
      .single();

    if (alertAfterError) {
      throw alertAfterError;
    }

    summary.checks.alertResolved = alertAfter.is_active === false && Boolean(alertAfter.resolved_at);
    assertCondition(summary.checks.alertResolved, 'Expected the low-stock alert to be resolved after reception.', alertAfter);

    const { data: entries, error: entriesError } = await serviceClient
      .from('accounting_entries')
      .select('account_code, debit, credit, entry_ref, company_id')
      .eq('user_id', tempUserId)
      .eq('source_type', 'supplier_order')
      .eq('source_id', order.id)
      .order('account_code', { ascending: true });

    if (entriesError) {
      throw entriesError;
    }

    const hasLegacySupplierOrderPosting = entries.some((entry) => entry.account_code === '401' && Number(entry.credit) === 40)
      && entries.some((entry) => entry.account_code === '601' && Number(entry.debit) === 40);
    const hasExtournePosting = entries.some((entry) => entry.account_code === '801' && Number(entry.credit) === 40)
      && entries.some((entry) => entry.account_code === '809' && Number(entry.debit) === 40);

    summary.checks.accountingEntriesCreated = Array.isArray(entries)
      && entries.length === 2
      && (hasLegacySupplierOrderPosting || hasExtournePosting);
    assertCondition(
      summary.checks.accountingEntriesCreated,
      'Expected two accounting entries for the supplier order (either legacy 601/401 or extourne 809/801 model).',
      { entries },
    );

    summary.checks.accountingCompanyScoped = entries.every((entry) => entry.company_id === company.id);
    assertCondition(summary.checks.accountingCompanyScoped, 'Expected accounting entries to inherit the active company.', {
      expectedCompanyId: company.id,
      entries,
    });

    summary.passed = true;
  } catch (error) {
    executionError = error;
    summary.error = {
      message: error.message,
      details: error.details || null,
    };
  } finally {
    try {
      if (cleanupIds.orderId) {
        await safeDeleteByEq(serviceClient, 'product_stock_history', 'order_id', cleanupIds.orderId);
      }
      if (tempUserId) {
        await safeDeleteByEq(serviceClient, 'accounting_entries', 'user_id', tempUserId);
        await safeDeleteByEq(serviceClient, 'accounting_mappings', 'user_id', tempUserId);
        await safeDeleteByEq(serviceClient, 'user_accounting_settings', 'user_id', tempUserId);
        await safeDeleteByEq(serviceClient, 'user_company_preferences', 'user_id', tempUserId);
      }
      if (cleanupIds.stockAlertId) {
        await safeDeleteByIds(serviceClient, 'stock_alerts', [cleanupIds.stockAlertId]);
      }
      if (cleanupIds.itemId) {
        await safeDeleteByIds(serviceClient, 'supplier_order_items', [cleanupIds.itemId]);
      }
      if (cleanupIds.orderId) {
        await safeDeleteByIds(serviceClient, 'supplier_orders', [cleanupIds.orderId]);
      }
      if (cleanupIds.productId) {
        await safeDeleteByIds(serviceClient, 'products', [cleanupIds.productId]);
      }
      if (cleanupIds.supplierProductId) {
        await safeDeleteByIds(serviceClient, 'supplier_products', [cleanupIds.supplierProductId]);
      }
      if (cleanupIds.supplierId) {
        await safeDeleteByIds(serviceClient, 'suppliers', [cleanupIds.supplierId]);
      }
      if (cleanupIds.companyId) {
        await safeDeleteByIds(serviceClient, 'company', [cleanupIds.companyId]);
      }
      summary.cleanup.rowsDeleted = true;
    } catch (cleanupError) {
      console.error(JSON.stringify({
        cleanupError: cleanupError.message,
        details: cleanupError.details || null,
      }, null, 2));
    }

    if (tempUserId) {
      try {
        const { error } = await adminClient.auth.admin.deleteUser(tempUserId);
        if (error) {
          throw error;
        }
        summary.cleanup.userDeleted = true;
      } catch (deleteError) {
        console.error(JSON.stringify({
          deleteUserError: deleteError.message,
        }, null, 2));
      }
    }
  }

  console.log(JSON.stringify(summary, null, 2));

  if (executionError) {
    throw executionError;
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    message: error.message,
    details: error.details || null,
  }, null, 2));
  process.exitCode = 1;
});
