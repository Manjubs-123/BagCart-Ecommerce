// import passport from "passport";
// import { Strategy as GoogleStrategy } from "passport-google-oauth20";
// import dotenv from "dotenv";
// import User from "../models/userModel.js";  // adjust path if needed

// dotenv.config();

// passport.use(
//   new GoogleStrategy(
//     {
//       clientID: process.env.GOOGLE_CLIENT_ID,
//       clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//       callbackURL: process.env.GOOGLE_CALLBACK_URL,
//     },
//     async (accessToken, refreshToken, profile, done) => {
//       try {
//         let user = await User.findOne({ googleId: profile.id });

//         if (!user) {
//           user = new User({
//             googleId: profile.id,
//             name: profile.displayName,
//             email: profile.emails[0].value,
//             avatar: profile.photos[0].value,
//           });
//           await user.save();
//         }

//         return done(null, user);
//       } catch (err) {
//         return done(err, null);
//       }
//     }
//   )
// );

// passport.serializeUser((user, done) => {
//   done(null, user.id);
// });

// passport.deserializeUser(async (id, done) => {
//   const user = await User.findById(id);
//   done(null, user);
// });

// import passport from "passport"; 
// import { Strategy as GoogleStrategy } from "passport-google-oauth20"; 
// import dotenv from "dotenv"; 
// import User from "../models/userModel.js"; // adjust path if needed
// dotenv.config();
// passport.use( new GoogleStrategy( { clientID: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, callbackURL: process.env.GOOGLE_CALLBACK_URL, }, async (accessToken, refreshToken, profile, done) => { try { let user = await User.findOne({ googleId: profile.id }); if (!user) { user = new User({ googleId: profile.id, name: profile.displayName, email: profile.emails[0].value, avatar: profile.photos[0].value, }); await user.save(); } return done(null, user); } catch (err) { return done(err, null); } } ) ); passport.serializeUser((user, done) => { done(null, user.id); }); passport.deserializeUser(async (id, done) => { const user = await User.findById(id); done(null, user); }); export default passport;

// import passport from "passport";
// import { Strategy as GoogleStrategy } from "passport-google-oauth20";
// import dotenv from "dotenv";
// import User from "../models/userModel.js";  // adjust path if needed

// dotenv.config();

// passport.use(
//   new GoogleStrategy(
//     {
//       clientID: process.env.GOOGLE_CLIENT_ID,
//       clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//       callbackURL: process.env.GOOGLE_CALLBACK_URL,
//     },
//     async (accessToken, refreshToken, profile, done) => {
//       try {
//         let user = await User.findOne({ googleId: profile.id });

//         if (!user) {
//           user = new User({
//             googleId: profile.id,
//             name: profile.displayName,
//             email: profile.emails[0].value,
//             avatar: profile.photos[0].value,
//           });
//           await user.save();
//         }

//         return done(null, user);
//       } catch (err) {
//         return done(err, null);
//       }
//     }
//   )
// );

// passport.serializeUser((user, done) => {
//   done(null, user.id);
// });

// passport.deserializeUser(async (id, done) => {
//   const user = await User.findById(id);
//   done(null, user);
// });
// export default passport;


import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";
import User from "../models/userModel.js";

dotenv.config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        let user = await User.findOne({ email }); // 🔍 check by email first

        if (user) {
          // If user exists but doesn’t have Google ID, attach it
          if (!user.googleId) {
            user.googleId = profile.id;
            user.avatar = profile.photos[0]?.value;
            user.isVerified = true;
            await user.save();
          }
        } else {
          // Otherwise create new Google user
          user = new User({
            googleId: profile.id,
            name: profile.displayName,
            email,
            avatar: profile.photos[0]?.value,
            isVerified: true,
          });
          await user.save();
        }

        return done(null, user);
      } catch (err) {
        console.error("Google auth error:", err);
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});

export default passport;
