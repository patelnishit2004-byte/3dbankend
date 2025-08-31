require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads")); // Serve uploaded files

// 🔗 Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.error("MongoDB Connection Error:", err);
    process.exit(1); // Exit if DB connection fails
  });

// 📌 Define Menu Schema
const menuSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  description: { type: String, required: true },
  image: { type: String, default: "" },
  model: { type: String, default: "" }, // Store path for 3D model file
});

const Menu = mongoose.model("Menu", menuSchema);

// 📌 Multer Setup for Image & 3D Model Uploads
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
  },
});
const upload = multer({ storage });

// 📌 API Route: Add New Menu Item (Image + 3D Model)
app.post("/api/menu", upload.fields([{ name: "image" }, { name: "model" }]), async (req, res) => {
  try {
    const { name, price, description } = req.body;

    if (!name || !price || !description) {
      return res.status(400).json({ error: "❌ Name, price, and description are required" });
    }

    const newMenu = new Menu({
      name,
      price,
      description,
      image: req.files["image"] ? `/uploads/${req.files["image"][0].filename}` : "",
      model: req.files["model"] ? `/uploads/${req.files["model"][0].filename}` : "",
    });

    await newMenu.save();
    res.status(201).json({ message: "✅ Menu Item Added", menu: newMenu });
  } catch (err) {
    console.error("❌ Error adding menu item:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 📌 API Route: Get All Menu Items
app.get("/api/menu", async (req, res) => {
  try {
    const searchQuery = req.query.search || ""; // Get search term from query params
    const menus = await Menu.find({
      name: { $regex: searchQuery, $options: "i" }, // Case-insensitive search
    });
    res.json(menus);
  } catch (err) {
    console.error("❌ Error fetching menu:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 📌 API Route: Search Menu Items (Case-Insensitive)
app.get("/api/search", async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: "❌ Search query is required" });
    }

    const results = await Menu.find({
      name: { $regex: query, $options: "i" },
    });

    res.json(results);
  } catch (err) {
    console.error("❌ Error searching menu:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 📌 API Route: Delete a Menu Item + Remove Associated Image/Model
app.delete("/api/menu/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "❌ Invalid menu ID" });
    }

    const deletedItem = await Menu.findByIdAndDelete(id);

    if (!deletedItem) {
      return res.status(404).json({ error: "❌ Menu item not found" });
    }

    // Delete associated image file
    if (deletedItem.image) {
      const imagePath = path.join(__dirname, deletedItem.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        console.log(`✅ Deleted image: ${imagePath}`);
      }
    }

    // Delete associated 3D model file
    if (deletedItem.model) {
      const modelPath = path.join(__dirname, deletedItem.model);
      if (fs.existsSync(modelPath)) {
        fs.unlinkSync(modelPath);
        console.log(`✅ Deleted model: ${modelPath}`);
      }
    }

    res.json({ message: "✅ Menu Item and associated files deleted", deletedItem });
  } catch (err) {
    console.error("❌ Error deleting menu item:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Root Test Route
app.get("/", (req, res) => {
  res.send("Backend is live ✅");
});

// ✅ Export for Vercel
module.exports = app;

// ✅ Start locally if not in Vercel
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}
