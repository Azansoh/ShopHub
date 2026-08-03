const express = require("express");
const router = express.Router();
const { isLoggedIn, isOwner } = require("../middleware/middleware");
const upload = require("../middleware/multer");
const products = require("../controllers/products");

// Index
router.get("/", products.index);

// New Form
router.get("/new", isLoggedIn, products.renderNewForm);

// Create (Accept up to 10 images under field name "images")
router.post("/", isLoggedIn, upload.array("images", 10), products.createProduct);

// Edit Page
router.get("/:id/edit", isLoggedIn, isOwner, products.renderEditForm);

// Update Product (Accept multiple images under field name "images")
router.put("/:id", isLoggedIn, isOwner, upload.array("images", 10), products.updateProduct);

// Delete Product
router.delete("/:id", isLoggedIn, isOwner, products.deleteProduct);

// Utility / Filter Routes
router.get("/recently-viewed", isLoggedIn, products.recentlyViewed);
router.get("/my-products", isLoggedIn, products.myProducts);

// Show Product (MUST BE LAST)
router.get("/:id", products.showProduct);

module.exports = router;