const fs = require('fs');
const path = require('path');
const { pool } = require('./index');

async function runMigration(filename) {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting database migration...');
    
    let filePath;
    if (filename) {
      filePath = path.join(__dirname, filename);
    } else {
      filePath = path.join(__dirname, 'schema.sql');
    }

    const migrationSQL = fs.readFileSync(filePath, 'utf8');
    await client.query(migrationSQL);
    
    console.log(`📋 Running migration: ${filename}`);
    // await client.query(schemaSQL);
    console.log(`✅ Migration applied: ${filename}`);
    
    console.log('🎉 Database migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}


// Run migration if this file is executed directly
if (require.main === module) {
  const filename = process.argv[2];
  runMigration(filename)
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };