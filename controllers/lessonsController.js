const db = require("../utils/db");

class LessonsController {
  async getLessons(req, res) {
    const { date, status, teacherIds, studentsCount, page, lessonsPerPage } =
      req.query;
    let datesArray;
    // datesArray[0] - start date
    // datesArray[1] - end date
    if(date) {
      datesArray = date.split(",");
    } else {
      datesArray = ['2000-01-01', '2400-01-01']
    }
    let lessons;
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

    const startSelect = (!page ? 0 : (page-1)) * (!lessonsPerPage ? 5 : lessonsPerPage)
    const endSelect = (!page ? 1 : (page)) * (!lessonsPerPage ? 5 : lessonsPerPage)
     

    const selectedLessons = lessons.filter((lesson) => lesson).slice(startSelect, endSelect);

    // returning an array with removed null values (after checking through needed teachers)
    res.json(selectedLessons);
  }

  async createLesson(req, res) {}
}

module.exports = new LessonsController();
