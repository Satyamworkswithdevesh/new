// server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const { OAuth2Client } = require("google-auth-library");

const app = express();
app.use(express.json());

// Serve static files (HTML, CSS, JS)
app.use(express.static('.'));

// Serve index.html at root
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

// User schema
const UserSchema = new mongoose.Schema({
  googleId: { type: String, unique: true },
  email: String,
  name: String,
  picture: String,
  phone: String, // user can add later
  provider: { type: String, default: "google" }
});
const User = mongoose.model("User", UserSchema);

// Google client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Route: verify Google ID token
app.post("/auth/google/idtoken", async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: "Missing ID token" });

    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const googleId = payload.sub;

    let user = await User.findOne({ googleId });

    if (!user) {
      user = await User.create({
        googleId,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        provider: "google"
      });
    } else {
      // Update details if needed
      user.name = payload.name;
      user.picture = payload.picture;
      await user.save();
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        picture: user.picture,
        phone: user.phone || null
      }
    });
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: "Invalid ID token" });
  }
});

// Route: update phone number (user fills manually)
app.post("/auth/add-phone", async (req, res) => {
  const { userId, phone } = req.body;
  const user = await User.findByIdAndUpdate(userId, { phone }, { new: true });
  res.json({ success: true, user });
});

app.listen(5000, () => console.log("Server running on http://localhost:5000"));
