console.clear();

const express = require('express');
const app = express();

const bodyParser = require('body-parser');
const routes = require('./routes/lessonsRoutes');

app.use(express.json());
app.use(express.urlencoded());

app.use('/', routes);

app.listen(80, () => {
  console.log('server started!');
});