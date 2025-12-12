import { Client } from 'pg';

const connectionString = 'postgresql://postgres:xBxbjEkOkJrHrcKgqwVNJANuDJNtAolD@crossover.proxy.rlwy.net:24288/railway';

const client = new Client({
  connectionString,
});

async function main() {
  console.log('Connecting to database...');
  await client.connect();
  console.log('Connected!');

  try {
    await client.query('BEGIN');

    // Create Tables
    console.log('Creating tables...');
    await client.query(`
      DROP TABLE IF EXISTS order_items;
      DROP TABLE IF EXISTS orders;
      DROP TABLE IF EXISTS products;
      DROP TABLE IF EXISTS users;

      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100),
        email VARCHAR(100),
        country VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100),
        category VARCHAR(50),
        price DECIMAL(10, 2),
        stock INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE orders (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id),
        status VARCHAR(20),
        total DECIMAL(10, 2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE order_items (
        id SERIAL PRIMARY KEY,
        order_id INT REFERENCES orders(id),
        product_id INT REFERENCES products(id),
        quantity INT,
        price DECIMAL(10, 2)
      );
    `);

    // Insert Users
    console.log('Seeding 10,000 users...');
    const usersBatchSize = 1000;
    for (let i = 0; i < 10000; i += usersBatchSize) {
        let usersValues = [];
        for (let j = 0; j < usersBatchSize; j++) {
            const idx = i + j;
            const name = `User ${idx}`;
            const email = `user${idx}@example.com`;
            const country = ['USA', 'France', 'Germany', 'Japan', 'Brazil'][Math.floor(Math.random() * 5)];
            usersValues.push(`('${name}', '${email}', '${country}')`);
        }
        await client.query(`INSERT INTO users (name, email, country) VALUES ${usersValues.join(',')}`);
    }


    // Insert Products
    console.log('Seeding 5,000 products...');
    const productsBatchSize = 1000;
    for (let i = 0; i < 5000; i += productsBatchSize) {
        let productsValues = [];
        for (let j = 0; j < productsBatchSize; j++) {
            const idx = i + j;
            const name = `Product ${idx}`;
            const category = ['Electronics', 'Books', 'Clothing', 'Home', 'Toys'][Math.floor(Math.random() * 5)];
            const price = (Math.random() * 100).toFixed(2);
            const stock = Math.floor(Math.random() * 1000);
            productsValues.push(`('${name}', '${category}', ${price}, ${stock})`);
        }
        await client.query(`INSERT INTO products (name, category, price, stock) VALUES ${productsValues.join(',')}`);
    }

    // Insert Orders
    console.log('Seeding 100,000 orders...');
    const ordersBatchSize = 1000;
    for (let i = 0; i < 100000; i += ordersBatchSize) {
        let ordersValues = [];
        for (let j = 0; j < ordersBatchSize; j++) {
            const userId = Math.floor(Math.random() * 10000) + 1;
            const status = ['pending', 'completed', 'shipped', 'cancelled'][Math.floor(Math.random() * 4)];
            const total = (Math.random() * 500).toFixed(2);
            ordersValues.push(`(${userId}, '${status}', ${total})`);
        }
        await client.query(`INSERT INTO orders (user_id, status, total) VALUES ${ordersValues.join(',')}`);
    }

    // Insert Order Items
    console.log('Seeding 300,000 order items...');
    const itemsBatchSize = 1000;
    for (let i = 0; i < 300000; i += itemsBatchSize) {
        let itemsValues = [];
        for (let j = 0; j < itemsBatchSize; j++) {
            const orderId = Math.floor(Math.random() * 100000) + 1;
             const productId = Math.floor(Math.random() * 5000) + 1;
            const quantity = Math.floor(Math.random() * 5) + 1;
            const price = (Math.random() * 100).toFixed(2);
            itemsValues.push(`(${orderId}, ${productId}, ${quantity}, ${price})`);
        }
        await client.query(`INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ${itemsValues.join(',')}`);
    }

    // Create Thousands of Tables
    console.log('Creating 2,000 extra dummy tables...');
    for (let i = 0; i < 2000; i++) {
        await client.query(`
            CREATE TABLE IF NOT EXISTS dummy_table_${i} (
                id SERIAL PRIMARY KEY,
                data_1 VARCHAR(100),
                data_2 INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        // Optional: Insert one row to make it not completely empty
        if (i % 10 === 0) { // Insert data in 10% of them to be faster
             await client.query(`INSERT INTO dummy_table_${i} (data_1, data_2) VALUES ('Dummy Data ${i}', ${i * 10})`);
        }
    }

    await client.query('COMMIT');
    console.log('Database populated successfully!');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error seeding database:', e);
  } finally {
    await client.end();
  }
}

main();
