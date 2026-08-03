require("dotenv").config();
const mongoose = require("mongoose");

async function main() {
    console.log("Testing connection to:", process.env.MONGO_URL.replace(/\/\/[^@]+@/, "//<credentials>@"));
    const conn = mongoose.createConnection(process.env.MONGO_URL, { serverSelectionTimeoutMS: 20000 });
    await conn.asPromise();
    console.log("CONNECTION OK!");
    console.log("Database name:", conn.name);

    const names = await conn.db.listCollections().toArray();
    console.log("Collections:", names.map((c) => c.name).join(", ") || "(none yet)");

    const users = conn.collection("users");
    const count = await users.countDocuments({});
    console.log("Users in this database:", count);

    await conn.close();
    console.log("Done.");
}

main().catch((err) => {
    console.error("\nCONNECTION FAILED:", err.message);
    process.exit(1);
});
