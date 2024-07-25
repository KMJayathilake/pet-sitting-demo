const db = require('../db');

async function getProfile(userId, userType) {
  let userData;
  if (userType === "employer") {
    userData = await db.one(
      `SELECT a.name, a.location, e.budget
       FROM app_user a
       INNER JOIN employer e ON a.id = e.user_id
       WHERE a.id = $1`, [userId]
    );
    return { user: userData, employer: { budget: userData.budget } };
  } else if (userType === "freelancer") {
    userData = await db.one(
      `SELECT a.name, a.location, f.bio, f.profile_picture
       FROM app_user a
       INNER JOIN freelancer f ON a.id = f.user_id
       WHERE a.id = $1`, [userId]
    );
    return { user: userData, freelancer: { bio: userData.bio, profile_picture: userData.profile_picture } };
  }
}

async function updateProfile(userId, profileData, userType) {
  await db.tx(async t => {
    if (userType === "employer" && profileData.budget !== undefined) {
      await t.none(
        `UPDATE employer
         SET budget = $1
         WHERE user_id = $2`, [profileData.budget, userId]
      );
    } else if (userType === "freelancer") {
      await t.none(
        `UPDATE freelancer
         SET bio = COALESCE($1, bio), profile_picture = COALESCE($2, profile_picture)
         WHERE user_id = $3`, [profileData.bio, profileData.profile_picture, userId]
      );
    }
    await t.none(
      `UPDATE app_user
       SET name = COALESCE($1, name), location = COALESCE($2, location)
       WHERE id = $3`, [profileData.name, profileData.location, userId]
    );
  });
}

module.exports = { getProfile, updateProfile };
