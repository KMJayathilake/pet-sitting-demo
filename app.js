const express = require("express");
const app = express();
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const pgp = require("pg-promise")();
const bcrypt = require("bcryptjs");
const handlebars = require("express-handlebars");

// Import routes
const profileRoutes = require('./src/profile/profileRoutes');

console.log("Public directory:", path.join(__dirname, "public"));
app.use(express.static("public"));


const hbs = handlebars.create({
  extname: "hbs",
  layoutsDir: path.join(__dirname, "views", "layouts"),
  partialsDir: path.join(__dirname, "views", "partials"),
  helpers: {
    ifEquals: function (arg1, arg2, options) {
      return arg1 == arg2 ? options.fn(this) : options.inverse(this);
    },
  },
});
app.engine("hbs", hbs.engine);
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

// Middleware setup
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session setup
app.use(session({
  secret: process.env.SESSION_SECRET,
  saveUninitialized: true,
  resave: true,
}));

// database configuration
const dbConfig = {
  host: process.env.HOST,
  port: 5432,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
};
const db = pgp(dbConfig);

//  database connection
db.connect()
  .then(obj => {
    console.log("Database connection successful");
    obj.done();
  })
  .catch(error => {
    console.error("Database connection error:", error);
    console.error("Connection details:", dbConfig);
  });


db.query("SELECT * FROM job_post")
  .then(result => {
    console.log("Table exists");
  })
  .catch(error => {
    console.error("Table does not exist:", error);
  });

// Define routes
app.get("/", (req, res) => {
  res.send("Example website");
});

app.get("/register", (req, res) => {
  res.render("pages/register");
});

app.get("/login", (req, res) => {
  res.render("pages/login");
});

// User registration
app.post("/register", async (req, res) => {
  const { name, email, password, location } = req.body;
  const type = req.query.type;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await db.one(
      `INSERT INTO app_user (name, email, password_hash, type, location)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, email, hashedPassword, type, location]
    );

    if (type === "employer") {
      await db.none(
        `INSERT INTO employer (user_id, budget)
         VALUES ($1, $2)`,
        [newUser.id, 0]
      );
    }

    if (type === "freelancer") {
      await db.none(
        `INSERT INTO freelancer (user_id, bio, profile_picture)
         VALUES ($1, $2, $3)`,
        [newUser.id, "new freelancer", "default.jpg"]
      );
    }

    req.session.userId = newUser.id;
    req.session.userType = type;
    res.send(`
      <script>
        alert('Registration successful');
        setTimeout(function() {
          window.location.href = '/login';
        }, 1000);
      </script>
    `);
  } catch (error) {
    console.log(error);
    res.status(500).send("Error in user registration");
  }
});

// User login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await db.oneOrNone("SELECT * FROM app_user WHERE email = $1", [email]);
    if (user && (await bcrypt.compare(password, user.password_hash))) {
      req.session.userId = user.id;
      req.session.userType = user.type;
      req.session.email = user.email;
      if (user.type === "freelancer") {
        res.redirect("/jobs");
      }
      if (user.type === "employer") {
        res.redirect("/edit-profile");
      }
    } else {
      res.status(401).send("Invalid credentials");
    }
  } catch (error) {
    console.log(error);
    res.status(500).send("Error logging in");
  }
});

// User logout
app.get("/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(400).send("Unable to log out");
    }
    res.send(`
      <script>
        alert('Logout successful');
        setTimeout(function() {
          window.location.href = '/login';
        }, 1000);
      </script>
    `);
  });
});

// Middleware
function isLoggedIn(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).send("You are not logged in");
  }
  next();
}

// profile routes
app.use('/', profileRoutes);

// Job listing
app.get("/jobs", isLoggedIn, async (req, res) => {
  try {
    const query = `
      SELECT 
        jp.id,
        jp.title,
        jp.description,
        TO_CHAR(jp.date_start, 'MM/DD/YYYY') AS date_start,
        TO_CHAR(jp.date_end, 'MM/DD/YYYY') AS date_end,
        jp.status,
        jp.hourly_rate,
        e.name AS employer_name,
        e.location,
        p.name AS pet_name,
        p.pet_type
      FROM 
        job_post jp
      JOIN 
        employer emp ON jp.employer_id = emp.id
      JOIN 
        app_user e ON emp.user_id = e.id
      JOIN 
        pet p ON jp.pet_id = p.id
      WHERE 
        jp.status = 'open'
      ORDER BY 
        jp.created_at DESC
    `;
    const jobs = await db.any(query);
    res.render("pages/job_listing", { jobs, email: req.session.email });
  } catch (err) {
    console.error("Error fetching job posts:", err);
    res.status(500).send("Server error");
  }
});

//Server start
app.listen(3000, () => {
  console.log("Server is running on port 3000");
});

module.exports = { app, db };
