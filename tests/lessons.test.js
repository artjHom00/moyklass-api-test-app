let axios = require('axios');


test('request to localhost/ should return an array of lessons', () => {
  axios.get('/').then((response) => {
    expect(typeof response.data).toBe("object");
  });
});

test('request to localhost/lessons should return an array of inserted lessons ids', () => {
  axios.post('/lessons', {
    "teacherIds": [1,2],
    "title": "Blue Ocean",
    "days": [0,1,3,6],
    "firstDate": "2019-09-10",
    "lessonsCount": 9
  }).then((response) => {
    expect(typeof response.data).toBe("object");
  });
});