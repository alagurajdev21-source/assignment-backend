const mongoose = require('mongoose');

const SubmissionSchema = new mongoose.Schema({
  assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  answer: { type: String, required: true },
  submittedAt: { type: Date, default: Date.now },
  reviewedAt:{ type: Date, default: null },
  reviewed: { type: Boolean, default: false },
  grade: { type: Number }
}, { timestamps: true });

module.exports = mongoose.model('Submission', SubmissionSchema);
