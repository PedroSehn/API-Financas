const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

module.exports = function demoMiddleware(req, res, next) {
  if (req.user.is_demo && WRITE_METHODS.has(req.method)) {
    return res.status(403).json({ message: 'Usuário demo não pode realizar esta ação' });
  }
  next();
};
