const db = require("../utils/db");
const format = require("date-format");

class LessonsController {
  #hasYearPassed = (d1, d2) => {
    d1 = new Date(d1);
    d2 = new Date(d2);

    let diff = d2.getTime() - d1.getTime();
    let hasYearPassed = diff / 31536000000;

    return hasYearPassed > 1;
  };

  #addDays = (date, day) => {
    let new_date = new Date(date);
    new_date.setDate(new_date.getDate() + day);
    return new_date;
  };

  #getDates = (k, day, date) => {
    const day_num = day;

    let new_day = new Date(date);
    while (new_day.getDay() !== day_num) {
      new_day = this.#addDays(new_day, 1);
    }

    return Array(k)
      .fill()
      .map((_, index) =>
        format("yyyy-MM-dd", this.#addDays(new_day, index * 7))
      );
  };

  getLessons = async (req, res) => {
    const { date, status, teacherIds, studentsCount, page, lessonsPerPage } =
      req.query;

    if(date && (new Date(date) == 'Invalid Date')) {
      res
        .status(400)
        .send({ error: "Неверно указан параметр date" });
      
        return;
    }

    if(status && (status !== 0 || status !== 1)) {
      res
        .status(400)
        .send({ error: "Неверно указан параметр status" });
      
      return;
    }

    let datesArray;
    let lessons;

    // datesArray[0] - start date
    // datesArray[1] - end date
    if (date) {
      datesArray = date.split(",");
    } else {
      datesArray = ["2000-01-01", "2400-01-01"];
    }

    let sql = `SELECT lessons.*, count as visitCount FROM lessons
      JOIN (SELECT lesson_id, COUNT(*) FROM lesson_students GROUP BY lesson_id ORDER BY lesson_id) AS lesson_students
      ON lesson_students.lesson_id = lessons.id
      WHERE date BETWEEN $1 AND $2`;

    // if user passed only start_date - set end_date same as the start_date
    if (datesArray.length === 1) {
      datesArray.push(datesArray[0]);
    }

    // if user passed the status param - set extra condition
    if (typeof status !== "undefined") {
      sql = sql.concat("AND status = $3");
      lessons = await db.query(sql, [datesArray[0], datesArray[1], status]);
    } else {
      lessons = await db.query(sql, [datesArray[0], datesArray[1]]);
    }

    lessons = lessons.rows;

    // filling arrays with students & teachers arrays
    for (let i = 0; i < lessons.length; i++) {
      const lesson_id = lessons[i].id;

      const sqlStudents = `SELECT students.id, students.name, lesson_students.visit FROM students
      INNER JOIN lesson_students
      ON lesson_students.lesson_id = $1 AND student_id = id;`;
      const sqlTeachers = `SELECT teachers.id, teachers.name FROM teachers
      INNER JOIN lesson_teachers
      ON lesson_teachers.lesson_id = $1 AND teacher_id = id`;

      let students = await db.query(sqlStudents, [lesson_id]);
      let teachers = await db.query(sqlTeachers, [lesson_id]);

      students = students.rows;
      teachers = teachers.rows;

      // if filter param exists
      if (teacherIds) {
        let teacherIdsArray = teacherIds.split(",").map(Number);

        // find if in array of teachers there is at least one teacher from teachersIds (filter param)
        let lessonIncludesTeacher = teachers.find((teacher) => {
          return teacherIdsArray.includes(teacher.id);
        });

        if (!lessonIncludesTeacher) {
          lessons[i] = undefined;
        }
      }

      // if filter param exists
      if (studentsCount) {
        let studentsCountArray = studentsCount.split(",").map(Number);

        // if user passed only one number in studentsCount param - set the second number the same
        if (studentsCountArray.length === 1) {
          studentsCountArray.push(studentsCountArray[0]);
        }

        let studentsCountFilter =
          studentsCountArray[0] <= students.length &&
          students.length <= studentsCountArray[1];

        if (!studentsCountFilter) {
          lessons[i] = undefined;
        }
      }

      // if lesson is not deleted (is not null) while checking through
      // add arrays of students & teachers to the object
      if (lessons[i]) {
        lessons[i]["students"] = students;
        lessons[i]["teachers"] = teachers;
      }
    }

    const startSelect =
      (!page ? 0 : page - 1) * (!lessonsPerPage ? 5 : lessonsPerPage);
    const endSelect =
      (!page ? 1 : page) * (!lessonsPerPage ? 5 : lessonsPerPage);

    const selectedLessons = lessons
      .filter((lesson) => lesson)
      .slice(startSelect, endSelect);

    // returning an array with removed null values (after checking through needed teachers)
    res.json(selectedLessons);
  };

  createLesson = async (req, res) => {
    const { teacherIds, title, days, firstDate, lessonsCount, lastDate } =
      req.body;

    // only 1 param needs
    // to be passed
    if (lessonsCount && lastDate) {
      res
        .status(400)
        .send({
          error:
            "Только один параметр из lessonsCount или lastDate должен быть указан",
        });

      return;
    }

    if (!teacherIds || teacherIds.length === 0) {
      res
        .status(400)
        .send({ error: "Не задан и/или неверно указан параметр teacherIds" });

      return;
    }

    if(!days && days.length === 0) {
      res
        .status(400)
        .send({ error: "Не указан или неверно указано параметр days" });
    
      return;
    }

    if(!title) {
      res
        .status(400)
        .send({ error: "Не указан параметр title"});
      
      return;
    }

    if(!firstDate || (new Date(firstDate)) == 'Invalid Date') {
      res
        .status(400)
        .send({ error: "Не указан или неверно указан параметр firstDate"});
    
      return;
    }

    if((new Date(lastDate)) == 'Invalid Date') {
      res
        .status(400)
        .send({ error: "Неверно указан параметр lastDate"});
    
      return;
    }

    let lessonsId = [];

    const sql = `INSERT INTO lessons VALUES(default, $1, $2, 0) RETURNING id`;

    let firstLesson = await db.query(sql, [firstDate, title]);

    lessonsId.push(firstLesson.rows[0].id);

    if (lessonsCount) {
      let lessonsToAdd = lessonsCount;
      // as the first date we already inserted
      lessonsToAdd -= 1;

      let iterationLastDate = firstDate;
      let k = 0;

      while (
        lessonsToAdd > 0 &&
        lessonsId.length < 300 &&
        !this.#hasYearPassed(firstDate, iterationLastDate)
      ) {
        if (!days[k]) {
          k = 0;
        }

        // get dates by days of the week
        let date = await this.#getDates(1, days[k], iterationLastDate);

        let insertedLesson = await db.query(sql, [date, title]);

        lessonsId.push(insertedLesson.rows[0].id);

        iterationLastDate = date;
        k += 1;
        lessonsToAdd -= 1;
      }
    }

    if (lastDate) {
      let iterationLastDate = firstDate;
      let k = 0;

      while (
        iterationLastDate < lastDate &&
        lessonsId.length < 300 &&
        !this.#hasYearPassed(firstDate, iterationLastDate)
      ) {
        if (!days[k]) {
          k = 0;
        }

        // get dates by days of the week
        let date = await this.#getDates(1, days[k], iterationLastDate);

        let insertedLesson = await db.query(sql, [date, title]);

        lessonsId.push(insertedLesson.rows[0].id);

        iterationLastDate = date;
        k += 1;
      }
    }

    const lessonTeacherSql = `INSERT INTO lesson_teachers VALUES($1, $2)`;

    for (let i = 0; i < lessonsId.length; i++) {
      for (let j = 0; j < teacherIds.length; j++) {
        await db.query(lessonTeacherSql, [lessonsId[i], teacherIds[j]]);
      }
    }

    res.send(lessonsId);
  };
}

module.exports = new LessonsController();
