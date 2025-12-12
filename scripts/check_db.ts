import { Client } from 'pg';

const connectionString = 'postgresql://postgres:xBxbjEkOkJrHrcKgqwVNJANuDJNtAolD@crossover.proxy.rlwy.net:24288/railway';

const client = new Client({
  connectionString,
});

async function main() {
  console.log('Connecting to database to verify data...');
  await client.connect();
  console.log('Connected!');

  try {
    const usersCount = await client.query('SELECT COUNT(*) FROM users');
    const productsCount = await client.query('SELECT COUNT(*) FROM products');
    const ordersCount = await client.query('SELECT COUNT(*) FROM orders');
    const itemsCount = await client.query('SELECT COUNT(*) FROM order_items');
    
    // Count all tables in public schema
    const tablesCount = await client.query(`
        SELECT COUNT(*) 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
    `);

    console.log('--- Verification Report ---');
    console.log(`Users: ${usersCount.rows[0].count}`);
    console.log(`Products: ${productsCount.rows[0].count}`);
    console.log(`Orders: ${ordersCount.rows[0].count}`);
    console.log(`Order Items: ${itemsCount.rows[0].count}`);
    console.log(`Total Tables: ${tablesCount.rows[0].count}`);
    console.log('---------------------------');
    
  } catch (e) {
    console.error('Error verifying database:', e);
  } finally {
    await client.end();
  }
}

main();
