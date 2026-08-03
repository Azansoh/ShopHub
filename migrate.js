require("dotenv").config();
const mongoose = require("mongoose");

const LOCAL_URL = process.env.LOCAL_MONGO_URL || "mongodb://127.0.0.1:27017/major_project";
const REMOTE_URL = process.env.MONGO_URL;

if (!REMOTE_URL) {
    console.error("ERROR: MONGO_URL is not set in .env");
    process.exit(1);
}

async function main() {
    console.log("Connecting to LOCAL DB...");
    const local = mongoose.createConnection(LOCAL_URL, { serverSelectionTimeoutMS: 10000 });
    await local.asPromise();
    console.log("Local DB connected:", local.name);

    console.log("Connecting to REMOTE (Atlas) DB...");
    const remote = mongoose.createConnection(REMOTE_URL, { serverSelectionTimeoutMS: 30000 });
    await remote.asPromise();
    console.log("Remote DB connected:", remote.name);

    const collections = await local.db.listCollections().toArray();
    const names = collections.map((c) => c.name).sort();
    console.log("\nCollections found locally:", names.join(", "));

    let totalDocs = 0;

    for (const name of names) {
        const src = local.collection(name);
        const dst = remote.collection(name);

        const docs = await src.find({}).toArray();
        if (docs.length === 0) {
            console.log(`- ${name}: 0 docs (skipped)`);
            continue;
        }

        const ops = docs.map((doc) => ({
            replaceOne: {
                filter: { _id: doc._id },
                replacement: doc,
                upsert: true,
            },
        }));

        const result = await dst.bulkWrite(ops, { ordered: false });
        const inserted = result.upsertedCount || 0;
        const updated = result.modifiedCount || 0;
        const matched = result.matchedCount || 0;
        console.log(`- ${name}: ${docs.length} docs (inserted=${inserted}, updated=${updated}, matched=${matched})`);
        totalDocs += docs.length;
    }

    // Fix the admin account: isVerified is stored as string 'true' -> real boolean true
    console.log("\nFixing isVerified type issues (string 'true'/'false' -> boolean)...");
    const usersDst = remote.collection("users");
    const fixResult = await usersDst.updateMany(
        { isVerified: { $type: "string" } },
        [{ $set: { isVerified: { $eq: ["$isVerified", "true"] } } }]
    );
    console.log(`Fixed ${fixResult.modifiedCount} user(s)`);

    console.log(`\nDONE. Total documents copied: ${totalDocs}`);

    await local.close();
    await remote.close();
    console.log("Connections closed.");
}

main().catch((err) => {
    console.error("\nMIGRATION FAILED:", err.message);
    process.exit(1);
});
