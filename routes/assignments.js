const express = require('express');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const auth = require('../middleware/auth');
const User = require('../models/User');
const { ROLES } = require('../constant');
const router = express.Router();

// Create Assignment (Teacher)
router.post('/', auth(ROLES.TEACHER), async (req, res) => {
  try {
    const assignment = await Assignment.create({ ...req.body, teacher: req.user.id });
    res.status(201).json(assignment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get Assignments for Teacher
router.get('/', auth(ROLES.TEACHER), async (req, res) => {
  try {
    const { title = '', status = '', sortByDueDate = 'asc', page = 0, limit = 10 } = req.query;

    const query = { teacher: req.user.id };
    const intialRecords = await Assignment.countDocuments(query)
    if (title) query.title = { $regex: title, $options: 'i' };
    if (status) query.status = status;

    const total = await Assignment.countDocuments(query);

    const assignments = await Assignment.find(query)
      .sort({ dueDate: sortByDueDate === 'asc' ? 1 : -1 })
      .skip(parseInt(page) * parseInt(limit))
      .limit(parseInt(limit));

    const totalStudents = await User.countDocuments({ role: "student" })

    res.json({ assignments: assignments, total, totalStudents,intialRecords });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.get('/student', auth(ROLES.STUDENT), async (req, res) => {
  try {
    // Pagination query params
    const page = parseInt(req.query.page, 10) || 1;  
    const limit = parseInt(req.query.limit, 10) || 10; 
    const skip = (page - 1) * limit;

    // Fetch published assignments with pagination
    const total = await Assignment.countDocuments({ status: 'Published' });
    const assignments = await Assignment.find({ status: 'Published' })
      .sort({ dueDate: 1 })
      .skip(skip)
      .limit(limit);

    // Fetch all submissions for this student across those assignments
    const submissions = await Submission.find({
      student: req.user.id,
      assignment: { $in: assignments.map(a => a._id) }
    }).lean();

    const submissionMap = {};
    submissions.forEach(s => {
      submissionMap[s.assignment.toString()] = s;
    });

    // Merge assignments and submissions
    const studentAssignments = assignments.map(a => {
      const submission = submissionMap[a._id.toString()] || null;
      return {
        _id: a._id,
        title: a.title,
        description: a.description,
        dueDate: a.dueDate,
        teacher: a.teacher,
        submitted: !!submission,
        grade: submission?.grade || null,
        review: submission?.reviewed || false,
        answer: submission?.answer || null,
        submittedAt: submission?.submittedAt || null,
        expired: new Date(a.dueDate) < new Date()
      };
    });

    // Return assignments + total count
    res.json({
      assignments: studentAssignments,
      total
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch assignments' });
  }
});



// Update Assignment (Teacher)
router.put('/:id', auth(ROLES.TEACHER), async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });
    if (assignment.status !== 'Draft') return res.status(400).json({ message: 'Cannot edit non-draft assignment' });
    Object.assign(assignment, req.body);
    await assignment.save();
    res.json(assignment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete Assignment (Teacher)
router.delete('/:id', auth(ROLES.TEACHER), async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });
    if (assignment.status !== 'Draft') return res.status(400).json({ message: 'Cannot delete non-draft assignment' });

    await Submission.deleteMany({ assignment: assignment._id }); // Remove all related submissions
    await assignment.deleteOne();
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update Assignment Status (Teacher)
router.patch('/:id/status', auth(ROLES.TEACHER), async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });
    assignment.status = req.body.status;
    await assignment.save();
    res.json(assignment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Submit Assignment (Student)
router.post('/:id/submit', auth(ROLES.STUDENT), async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });
    if (new Date(assignment.dueDate) < new Date()) return res.status(400).json({ message: 'Assignment expired' });

    const existing = await Submission.findOne({ assignment: assignment._id, student: req.user.id });
    if (existing) return res.status(400).json({ message: 'Already submitted' });

    const submission = await Submission.create({
      assignment: assignment._id,
      student: req.user.id,
      answer: req.body.answer
    });

    res.json({ message: 'Submitted successfully', submission });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/submissions', auth(ROLES.TEACHER), async (req, res) => {
  try {
    const assignmentId = req.params.id;

    // Get assignment with teacher check
    const assignment = await Assignment.findById(assignmentId).select('teacher');
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

    // Fetch all submissions for this assignment with student info
    const submissions = await Submission.aggregate([
      { $match: { assignment: assignment._id } },
      {
        $lookup: {
          from: 'users',
          localField: 'student',
          foreignField: '_id',
          as: 'studentInfo'
        }
      },
      { $unwind: '$studentInfo' },
      {
        $project: {
          studentId: '$studentInfo._id',
          name: '$studentInfo.name', 
          email: '$studentInfo.email',
          answer: 1,
          submittedAt: 1,
          reviewed: 1,
          grade: 1
        }
      }
    ]);

    const submittedIds = submissions.map(s => s.studentId.toString());

    // Fetch only students who haven't submitted yet
    const notSubmitted = await User.find({
      role: 'student',
      _id: { $nin: submittedIds }
    }).select('_id name email');

    res.json({
      submitted: submissions,
      notSubmitted
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch submissions' });
  }
});

router.patch('/:id/submissions/review', auth(ROLES.TEACHER), async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const { submissions } = req.body;

    if (!Array.isArray(submissions) || submissions.length === 0) {
      return res.status(400).json({ message: 'No submissions provided' });
    }

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const bulkOps = submissions.map(s => ({
      updateOne: {
        filter: { assignment: assignmentId, student: s.studentId },
        update: {
          $set: {
            grade: s.grade || null,
            reviewed: s.reviewed ?? false,
            reviewedAt: new Date()
          }
        }
      }
    }));

    await Submission.bulkWrite(bulkOps);

    res.json({ message: 'Submissions updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update submissions' });
  }
});



module.exports = router;
