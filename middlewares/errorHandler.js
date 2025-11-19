export const errorHandler = (err, req, res, next) => {
  console.error(" Error caught:", err.message);

  // Prevent sending multiple responses
  if (res.headersSent) {
    return next(err);
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
};
