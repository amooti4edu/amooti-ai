#!/usr/bin/env node

const SUPABASE_URL = "https://ehswpksboxyzqztdhofh.supabase.co";
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_KEY) {
  console.error("❌ VITE_SUPABASE_PUBLISHABLE_KEY environment variable not set");
  process.exit(1);
}

async function checkTableWithColumns(tableName, columns) {
  try {
    const columnList = columns.join(",");
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${tableName}?limit=1&select=${encodeURIComponent(columnList)}`,
      {
        method: "GET",
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      return {
        exists: response.status !== 404,
        data: null,
        error: `${response.status} ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      exists: true,
      data: Array.isArray(data) ? data[0] : data,
      error: null,
    };
  } catch (err) {
    return {
      exists: false,
      data: null,
      error: err.message,
    };
  }
}

async function checkColumn(tableName, columnName) {
  const result = await checkTableWithColumns(tableName, [columnName]);
  return result.error === null;
}

async function main() {
  console.log("🔍 Checking Supabase Schema at: " + SUPABASE_URL + "\n");

  // Check profiles table
  console.log("📋 Checking profiles table...");
  const profileCols = ["id", "user_id", "tier", "role", "subject", "class"];
  let profileExists = false;
  let profileFoundCols = [];
  
  for (const col of profileCols) {
    const exists = await checkColumn("profiles", col);
    if (exists) {
      profileFoundCols.push(col);
      profileExists = true;
    }
  }

  if (profileFoundCols.length > 0) {
    console.log(`✅ profiles table exists`);
    console.log(`   Found columns: ${profileFoundCols.join(", ")}`);
    
    const requiredFields = ["id", "user_id", "tier", "role"];
    const optionalFields = ["subject", "class"];
    
    console.log("   Required fields check:");
    for (const field of requiredFields) {
      if (profileFoundCols.includes(field)) {
        console.log(`   ✅ ${field}`);
      } else {
        console.log(`   ❌ ${field} MISSING`);
      }
    }
    
    console.log("   Optional fields:");
    for (const field of optionalFields) {
      if (profileFoundCols.includes(field)) {
        console.log(`   ℹ️  ${field} exists`);
      } else {
        console.log(`   ⚠️  ${field} not found (recommended)`);
      }
    }
  } else {
    console.log(`❌ profiles table NOT FOUND or no accessible columns`);
  }

  // Check rate_limits table
  console.log("\n📋 Checking rate_limits table...");
  const rateLimitCols = ["user_id", "daily_count", "burst_count", "window_start", "last_day"];
  let rateLimitFoundCols = [];
  
  for (const col of rateLimitCols) {
    const exists = await checkColumn("rate_limits", col);
    if (exists) {
      rateLimitFoundCols.push(col);
    }
  }

  if (rateLimitFoundCols.length > 0) {
    console.log(`✅ rate_limits table exists`);
    console.log(`   Found columns: ${rateLimitFoundCols.join(", ")}`);
    
    const requiredFields = ["user_id", "daily_count", "burst_count", "window_start"];
    console.log("   Required fields:");
    for (const field of requiredFields) {
      if (rateLimitFoundCols.includes(field)) {
        console.log(`   ✅ ${field}`);
      } else {
        console.log(`   ❌ ${field} MISSING`);
      }
    }
  } else {
    console.log(`❌ rate_limits table NOT FOUND or no accessible columns`);
  }

  // Check conversations table
  console.log("\n📋 Checking conversations table...");
  const convCols = ["id", "user_id", "title", "created_at", "updated_at"];
  let convFoundCols = [];
  
  for (const col of convCols) {
    const exists = await checkColumn("conversations", col);
    if (exists) {
      convFoundCols.push(col);
    }
  }

  if (convFoundCols.length > 0) {
    console.log(`✅ conversations table exists`);
    console.log(`   Found columns: ${convFoundCols.join(", ")}`);
    
    const requiredFields = ["id", "user_id", "title"];
    console.log("   Required fields:");
    for (const field of requiredFields) {
      if (convFoundCols.includes(field)) {
        console.log(`   ✅ ${field}`);
      } else {
        console.log(`   ❌ ${field} MISSING`);
      }
    }
  } else {
    console.log(`❌ conversations table NOT FOUND or no accessible columns`);
  }

  // Check messages table
  console.log("\n📋 Checking messages table...");
  const msgCols = ["id", "conversation_id", "role", "content", "created_at"];
  let msgFoundCols = [];
  
  for (const col of msgCols) {
    const exists = await checkColumn("messages", col);
    if (exists) {
      msgFoundCols.push(col);
    }
  }

  if (msgFoundCols.length > 0) {
    console.log(`✅ messages table exists`);
    console.log(`   Found columns: ${msgFoundCols.join(", ")}`);
    
    const requiredFields = ["id", "conversation_id", "role", "content"];
    console.log("   Required fields:");
    for (const field of requiredFields) {
      if (msgFoundCols.includes(field)) {
        console.log(`   ✅ ${field}`);
      } else {
        console.log(`   ❌ ${field} MISSING`);
      }
    }
  } else {
    console.log(`❌ messages table NOT FOUND or no accessible columns`);
  }

  // Check edge functions deployment
  console.log("\n🔧 Checking Edge Functions...");
  
  const functions = [
    { name: "chat", method: "POST", expectedStatus: [400, 401, 200] },
    { name: "teacher", method: "POST", expectedStatus: [401, 400, 200] },
  ];

  for (const fnc of functions) {
    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/${fnc.name}`,
        {
          method: fnc.method,
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer invalid-token`,
          },
          body: JSON.stringify({ messages: [] }),
        }
      );
      
      // Edge function exists if we don't get 404
      if (response.status !== 404) {
        if (fnc.name === "teacher" && response.status === 401) {
          console.log(`✅ /functions/v1/${fnc.name} is deployed (requires auth)`);
        } else {
          console.log(`✅ /functions/v1/${fnc.name} is deployed`);
        }
      } else {
        console.log(`❌ /functions/v1/${fnc.name} NOT FOUND`);
      }
    } catch (err) {
      console.log(`⚠️  Could not check /functions/v1/${fnc.name}: ${err.message}`);
    }
  }

  console.log("\n✨ Schema check complete!");
}

main().catch(console.error);
