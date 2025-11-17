import express  from 'express'
import redis from './redis.js'
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pkg from 'express-openid-connect';
const { auth, requiresAuth } = pkg;

dotenv.config();
const app = express()
const port = 3000

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mainAppPath = path.join(__dirname, "../src", "mainapp.html");

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from src directory
app.use(express.static(path.join(__dirname, '../src')));

// Auth0 configuration
const config = {
  authRequired: false,
  auth0Logout: true,
  secret: process.env.AUTH0_SECRET,
  baseURL: process.env.AUTH0_BASE_URL,
  clientID: process.env.AUTH0_CLIENT_ID,
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`
};

// Auth0 middleware
app.use(auth(config));

redis.connect().catch(console.error);

// Home route - serves the main app
app.get("/", (req, res) => {
  if (req.oidc.isAuthenticated()) {
    // User is logged in, serve the main app
    res.sendFile(mainAppPath, (err) => {
      if (err) {
        console.error("Error sending mainapp.html", err);
        res.status(500).send("Error loading page");
      }
    });
  } else {
    // User is not logged in, show signin page
    res.sendFile(path.join(__dirname, "../src/Pages", "signin.html"));
  }
});

// Profile route - shows user info (optional, for debugging)
app.get("/profile", requiresAuth(), (req, res) => {
  res.send(JSON.stringify(req.oidc.user, null, 2));
});

// Board route - protected, requires authentication
app.get("/board", requiresAuth(), (req, res) => {
  res.sendFile(mainAppPath, (err) => {
    if (err) {
      console.error("Error sending mainapp.html", err);
      res.status(500).send("Error loading page");
    }
  });
});

// Chat route - protected, requires authentication
app.get("/chat", requiresAuth(), (req, res) => {
  res.sendFile(mainAppPath, (err) => {
    if (err) {
      console.error("Error sending mainapp.html", err);
      res.status(500).send("Error loading page");
    }
  });
});



app.listen(port, () => {
    console.log(`Example app listening on port ${3000}`)
})
