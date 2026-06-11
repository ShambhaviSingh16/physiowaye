const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testConnection() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .limit(1);

  if (error) {
    console.error("Supabase Error:", error.message);
  } else {
    console.log("Supabase Connected ✅");
    console.log(data);
  }
}

testConnection();

module.exports = supabase;