let routes = require('express').Router();
const lessonsController = require('../controllers/lessonsController');


routes.get('/', lessonsController.getLessons);

routes.post('/lessons', lessonsController.createLesson);

module.exports = routes;