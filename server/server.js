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

/* ---------- ADD TO CART ---------- */

app.post("/api/cart", async (req, res) => {

  try {

    console.log("CART REQUEST:", req.body);

    const { user_id, product_id, quantity } = req.body;

    const { data: existing, error: existingError } =
      await supabase
        .from("cart")
        .select("*")
        .eq("user_id", user_id)
        .eq("product_id", product_id)
        .maybeSingle();

    console.log("EXISTING:", existing);
    console.log("EXISTING ERROR:", existingError);

    if (existing) {

      const { error } = await supabase
        .from("cart")
        .update({
          quantity: existing.quantity + quantity
        })
        .eq("id", existing.id);

      if (error) {
        console.log("UPDATE ERROR:", error);
        return res.status(500).json(error);
      }

      return res.json({
        message: "Cart updated"
      });
    }

    const { data, error } = await supabase
      .from("cart")
      .insert([
        {
          user_id,
          product_id,
          quantity
        }
      ])
      .select();

    console.log("INSERT DATA:", data);
    console.log("INSERT ERROR:", error);

    if (error) {
      return res.status(500).json(error);
    }

    res.json({
      message: "Added to cart"
    });

  } catch (err) {

    console.log("CATCH ERROR:", err);

    res.status(500).json(err);

  }

});

/* ---------- GET USER CART ---------- */

app.get("/api/cart/:userId", async (req, res) => {

  try {

    const { data, error } = await supabase
      .from("cart")
      .select(`
        id,
        quantity,
        products (
          id,
          product_name,
          selling_price,
          mrp,
          image_url
        )
      `)
      .eq("user_id", req.params.userId);

    if (error) {
      return res.status(500).json(error);
    }

    res.json(data);

  } catch (err) {

    res.status(500).json(err);

  }

});

/* ---------- REMOVE CART ITEM ---------- */

app.delete("/api/cart/:cartId", async (req, res) => {

  try {

    const { error } = await supabase
      .from("cart")
      .delete()
      .eq("id", req.params.cartId);

    if (error) {
      return res.status(500).json(error);
    }

    res.json({
      success: true
    });

  } catch (err) {

    res.status(500).json(err);

  }

});

/* ---------- UPDATE CART QUANTITY ---------- */

app.put("/api/cart/:cartId", async (req, res) => {

  try {

    const { quantity } = req.body;

    const { error } = await supabase
      .from("cart")
      .update({ quantity })
      .eq("id", req.params.cartId);

    if (error) {
      return res.status(500).json(error);
    }

    res.json({
      success: true
    });

  } catch (err) {

    res.status(500).json(err);

  }

});

/* ---------- CREATE ORDER ---------- */

app.post("/api/orders", async (req, res) => {

  try {

    const { user_id, items, total_amount } = req.body;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert([
        {
          user_id,
          total_amount,
          status: "Pending"
        }
      ])
      .select()
      .single();

    if (orderError) {
      return res.status(500).json(orderError);
    }

    const orderItems = items.map(item => ({
      order_id: order.id,
      product_id: item.id,
      quantity: item.qty,
      price: item.price
    }));

    const { error: itemError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemError) {
      return res.status(500).json(itemError);
    }

    res.json({
      success: true,
      order_id: order.id
    });

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

});

app.get("/api/orders/:userId", async (req, res) => {

  try {

    const { data, error } =
      await supabase
      .from("orders")
      .select("*")
      .eq(
        "user_id",
        req.params.userId
      )
      .order(
        "created_at",
        { ascending: false }
      );

    if (error)
      return res.status(500)
      .json(error);

    res.json(data);

  } catch(err) {

    res.status(500)
    .json(err);

  }

});

app.listen(process.env.PORT || 5000, () => {
  console.log("Server running");
});

app.get("/", (req, res) => {
  res.send("Physiowaye API is running 🚀");
});