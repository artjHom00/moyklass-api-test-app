const Pool = require('pg').Pool;

const pool = new Pool({
  user: 'postgres',
  password: '',
  host: '127.0.0.1',
  port: 5432,
  database: 'moyklass'
});


module.exports = pool;