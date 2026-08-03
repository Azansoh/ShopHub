const mongoose = require("mongoose");
const Product = require("./Models/products"); // Ensure path matches your project structure

// Replace with your MongoDB connection string
mongoose.connect("mongodb://127.0.0.1:27017/your_database_name")
    .then(() => console.log("Database connected for fix"))
    .catch(err => console.log(err));

async function fixPrices() {
    const products = await Product.find({});
    for (let p of products) {
        p.price = Number(p.price);
        p.stock = Number(p.stock);
        await p.save();
    }
    console.log("SUCCESS: All product prices converted to real Numbers!");
    mongoose.connection.close();
}

fixPrices();