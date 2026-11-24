function notFound(req, res, next) {
  const err = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  err.status = 404; next(err);
}
function errorHandler(err, req, res, next) {
  console.error(err);
  const status = err.status || (err.code === 'ER_DUP_ENTRY' ? 409 : 500);
  const message = status === 500 ? 'Internal server error' :
    (err.code === 'ER_DUP_ENTRY' ? 'A record with this value already exists' : err.message);
  res.status(status).json({ success: false, message });
}
module.exports = { notFound, errorHandler };
