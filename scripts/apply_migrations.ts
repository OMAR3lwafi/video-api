/**
 * Apply database migrations to Supabase cloud
 * This script runs all migrations in the correct order
 */

import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials. Please check your .env file');
  process.exit(1);
}

// Create Supabase admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration(sqlContent: string, migrationName: string) {
  console.log(`\n📝 Running migration: ${migrationName}`);
  
  try {
    // Split the SQL content into individual statements
    // This is a simplified approach - for production, use a proper SQL parser
    const statements = sqlContent
      .split(/;\s*$/m)
      .filter(stmt => stmt.trim().length > 0)
      .map(stmt => stmt.trim() + ';');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const statement of statements) {
      // Skip comments and empty statements
      if (statement.startsWith('--') || statement.trim() === ';') {
        continue;
      }
      
      // Execute the SQL statement
      const { error } = await supabase.rpc('query', { 
        query: statement 
      }).single();
      
      if (error) {
        console.error(`  ❌ Error: ${error.message}`);
        errorCount++;
      } else {
        successCount++;
      }
    }
    
    console.log(`  ✅ Completed: ${successCount} successful, ${errorCount} errors`);
    return errorCount === 0;
    
  } catch (error) {
    console.error(`  ❌ Failed to run migration: ${error}`);
    return false;
  }
}

async function applyAllMigrations() {
  console.log('🚀 Starting database migrations...\n');
  
  const migrationsDir = path.join(__dirname, '..', 'database', 'migrations');
  
  // Define migrations in order
  const migrations = [
    '001_initial_schema.sql',
    '002_functions.sql',
    '003_triggers.sql',
    '004_views.sql',
    '005_rls_policies.sql'
  ];
  
  let allSuccess = true;
  
  for (const migrationFile of migrations) {
    const filePath = path.join(migrationsDir, migrationFile);
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Migration file not found: ${migrationFile}`);
      allSuccess = false;
      continue;
    }
    
    const sqlContent = fs.readFileSync(filePath, 'utf-8');
    const success = await runMigration(sqlContent, migrationFile);
    
    if (!success) {
      allSuccess = false;
      console.error(`⚠️  Migration ${migrationFile} had errors. Continuing...`);
    }
  }
  
  if (allSuccess) {
    console.log('\n✅ All migrations completed successfully!');
  } else {
    console.log('\n⚠️  Some migrations had errors. Please check the output above.');
  }
  
  console.log('\n📋 Next steps:');
  console.log('1. Verify the database structure in Supabase dashboard');
  console.log('2. Run: npm run db:validate');
}

// Note: Direct SQL execution via RPC is not available in Supabase
// This script shows the structure, but you'll need to run the SQL in the dashboard
console.log('⚠️  Note: Supabase does not support direct SQL execution via the client library.');
console.log('📋 Please follow these steps:\n');
console.log('1. Go to: https://supabase.com/dashboard/project/lgpxottsoxddmhwnamva/sql');
console.log('2. Open the file: database/migrations/apply_all_migrations.sql');
console.log('3. Copy the entire content and paste it in the SQL editor');
console.log('4. Click "Run" to execute all migrations');
console.log('\nAlternatively, run each migration file individually in order:');
console.log('  - 001_initial_schema.sql');
console.log('  - 002_functions.sql');
console.log('  - 003_triggers.sql');
console.log('  - 004_views.sql');
console.log('  - 005_rls_policies.sql');

// Since we can't run SQL directly, just verify connection
async function verifyConnection() {
  console.log('\n🔍 Verifying Supabase connection...');
  
  try {
    // Try to query a simple table to verify connection
    const { data, error } = await supabase.from('jobs').select('count').single();
    
    if (error && error.code === '42P01') {
      console.log('❌ Tables do not exist yet. Please run migrations in Supabase dashboard.');
    } else if (error) {
      console.log(`❌ Connection error: ${error.message}`);
    } else {
      console.log('✅ Connection successful! Tables already exist.');
      console.log('   You can now run: npm run db:validate');
    }
  } catch (err) {
    console.error('❌ Failed to connect:', err);
  }
}

verifyConnection();