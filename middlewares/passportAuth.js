// // middlewares/passportAuth.js
// export function isAuthenticated(req, res, next) {
//   if (req.isAuthenticated()) {
//     return next();
//   }
//   return res.redirect("/user/login");
// }
export const isAuthenticated = (req, res, next) => {
  next()
};
