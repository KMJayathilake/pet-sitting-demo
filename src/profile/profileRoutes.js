const express = require('express');
const router = express.Router();
const { getProfile, updateProfile } = require('./profileQueries');

function isLoggedIn(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).send("You are not logged in");
  }
  next();
}

router.get("/edit-profile", isLoggedIn, async (req, res) => {
  const userId = req.session.userId;
  const userType = req.session.userType;
  try {
    const userData = await getProfile(userId, userType);
    res.render("pages/edit-profile", {
      user: userData.user,
      freelancer: userData.freelancer,
      employer: userData.employer,
      email: req.session.email,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Error fetching profile data");
  }
});

router.post("/edit-profile", isLoggedIn, async (req, res) => {
  const userId = req.session.userId;
  const { name, location, budget, bio, profile_picture } = req.body;
  const userType = req.session.userType;
  try {
    await updateProfile(userId, { name, location, budget, bio, profile_picture }, userType);
    res.send(`
      <script>
        alert('Profile updated successfully');
        setTimeout(function() {
          window.location.href = '/edit-profile';
        }, 500);
      </script>
    `);
  } catch (error) {
    console.log(error);
    res.status(500).send("Error updating profile");
  }
});

module.exports = router;
