from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin
from app import db, login_manager
from datetime import datetime

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), index=True, unique=True)
    email = db.Column(db.String(120), index=True, unique=True)
    password_hash = db.Column(db.String(128))
    assignments = db.relationship('Assignment', backref='uploader', lazy='dynamic')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return '<User {}>'.format(self.username)

@login_manager.user_loader
def load_user(id):
    return User.query.get(int(id))

class Assignment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    filename = db.Column(db.String(128), nullable=False)
    uploaded_at = db.Column(db.DateTime, index=True, default=datetime.utcnow)
    ocr_text_raw = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(64), default='processed') # e.g., 'processed', 'reviewed'
    qa_items = db.relationship('QAItem', backref='assignment', lazy='dynamic', cascade="all, delete-orphan")

    def __repr__(self):
        return f'<Assignment {self.filename}>'

class QAItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    assignment_id = db.Column(db.Integer, db.ForeignKey('assignment.id'), nullable=False)
    question_text = db.Column(db.Text, nullable=False)
    answer_text = db.Column(db.Text, nullable=True)
    is_correct = db.Column(db.Boolean, default=True, nullable=False)
    explanation = db.Column(db.Text, nullable=True)

    def __repr__(self):
        return f'<QAItem {self.id} for Assignment {self.assignment_id} - Q: {self.question_text[:30]}>'
