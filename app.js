const express = require("express");
const app = express();
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");

const profileRoutes = require('./src/profile/profileRoutes');

app.use(express.static("public"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    saveUninitialized: true,
    resave: true,
  })
);

app.use('/', profileRoutes);

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});

module.exports = { app };
