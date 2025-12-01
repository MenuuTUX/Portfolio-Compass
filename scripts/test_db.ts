import 'dotenv/config';
import pg from 'pg';

async function testConnection() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL is not defined');
    return;
  }
  console.log(`Testing connection to: ${connectionString.replace(/:[^:@]*@/, ':***@')}`);

  // Test 1: Default connection
  console.log('\n--- Test 1: Default Connection ---');
  try {
    const pool1 = new pg.Pool({ connectionString, connectionTimeoutMillis: 5000 });
    const client1 = await pool1.connect();
    console.log('✅ Connected successfully (Default)');
    client1.release();
    await pool1.end();
  } catch (e: any) {
    console.error('❌ Failed (Default):', e.message);
  }

  // Test 2: SSL Connection
  console.log('\n--- Test 2: SSL Connection ---');
  try {
    const pool2 = new pg.Pool({ 
      connectionString, 
      connectionTimeoutMillis: 5000,
      ssl: { rejectUnauthorized: false } 
    });
    const client2 = await pool2.connect();
    console.log('✅ Connected successfully (SSL)');
    client2.release();
    await pool2.end();
  } catch (e: any) {
    console.error('❌ Failed (SSL):', e.message);
  }
}

testConnection();
