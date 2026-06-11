require("dotenv").config();

const supabase = require("./supabase");
const express = require("express");
// const mysql = require("mysql2");
const cors = require("cors");


const app = express();

app.use(cors());
app.use(express.json());

/* DATABASE CONNECTION */

// const db = mysql.createConnection({
//   host: process.env.DB_HOST,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
//   port: process.env.DB_PORT
// });

// db.connect(err => {
//   if (err) {
//     console.error("Database connection failed:", err);
//     return;
//   }
//   console.log("MySQL Connected");
// });

/* ---------- REGISTER ---------- */

app.post("/api/register", (req, res) => {

  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "All fields required" });
  }

  db.query(
    "SELECT id FROM users WHERE email=?",
    [email],
    (err, result) => {

      if (err) return res.status(500).json(err);

      if (result.length > 0) {
        return res.status(409).json({ message: "User already exists" });
      }

      db.query(
        "INSERT INTO users (name,email,password) VALUES (?,?,?)",
        [name, email, password],
        (err) => {

          if (err) return res.status(500).json(err);

          res.json({ message: "Registered successfully" });
        }
      );

    }
  );
});

/* ---------- LOGIN ---------- */

app.post("/api/login", (req, res) => {

  const { email, password } = req.body;

  db.query(
    "SELECT id,name,email FROM users WHERE email=? AND password=?",
    [email, password],
    (err, result) => {

      if (err) return res.status(500).json(err);

      if (result.length === 0) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      res.json(result[0]);
    }
  );

});

/* ---------- PRODUCTS ---------- */

app.get("/api/products", async (req, res) => {
  try {

    const search = req.query.search;

    let query = supabase
      .from("products")
      .select("*")
      .eq("is_active", true);

    if (search) {
      query = query.ilike("product_name", `%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json(error);
    }

    res.json(data);

  } catch (err) {
    res.status(500).json(err);
  }
});

/* ---------- SINGLE PRODUCT ---------- */

app.get("/api/products/:id", async (req, res) => {

  try {

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error) {
      return res.status(404).json({
        message: "Product not found"
      });
    }

    res.json(data);

  } catch (err) {
    res.status(500).json(err);
  }

});

app.listen(process.env.PORT || 5000, () => {
  console.log("Server running");
});

app.get("/", (req, res) => {
  res.send("Physiowaye API is running 🚀");
});