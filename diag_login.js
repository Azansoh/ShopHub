require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./Models/user");

const inputUsername = process.argv[2];
const inputPassword = process.argv[3];

async function main() {
  await mongoose.connect(process.env.MONGO_URL, { serverSelectionTimeoutMS: 20000 });
  console.log("Connected to DB\n");

  const users = await User.find({});
  console.log("Total users in DB:", users.length);

  for (const u of users) {
    const doc = await User.findById(u._id).select("+hash +salt");
    const salt = doc.salt || "";
    const hash = doc.hash || "";
    console.log(
      `- username="${u.username}" email="${u.email}" isVerified=${u.isVerified} ` +
        `saltLen=${salt.length} hashLen=${hash.length} (64 = sha256/32-byte)`
    );
  }

  if (inputUsername) {
    console.log("\n--- Testing authenticate() ---");
    const auth = User.authenticate();
    const { user, error } = await new Promise((res) => {
      auth(inputUsername, inputPassword || "wrong-password-for-diagnosis", (err, u, authErr) =>
        res({ err, user: u, error: authErr })
      );
    });
    if (user) {
      console.log("SUCCESS: password verified for", inputUsername);
    } else {
      console.log("AUTH FAILED. Error name:", error && error.name);
      console.log("AUTH FAILED. Message:", error && error.message);
    }
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
