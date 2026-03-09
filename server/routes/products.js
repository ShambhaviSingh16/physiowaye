const express = require("express");
const router = express.Router();
const db = require("../db");

/**
 * GET all products (with optional search)
 */
router.get("/", (req, res) => {
  const search = req.query.search;
  let sql = "SELECT * FROM products";
  let params = [];

  if (search) {
    sql += " WHERE name LIKE ? OR description LIKE ?";
    params.push(`%${search}%`, `%${search}%`);
  }

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

/**
 * GET single product by ID
 */
router.get("/:id", (req, res) => {
  const productId = req.params.id;

  const sql = "SELECT * FROM products WHERE id = ?";
  db.query(sql, [productId], (err, results) => {
    if (err) return res.status(500).json(err);
    if (results.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(results[0]);
  });
});

module.exports = router;
