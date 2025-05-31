import os
from flask import render_template, redirect, url_for, flash, request, Blueprint, current_app, session, abort
from flask_login import current_user, login_user, logout_user, login_required
from app import db # Import db from app package
from app.models import User, Assignment, QAItem # Import new models
from app.forms import LoginForm, RegistrationForm # Assuming we might use a form for explanation later
from werkzeug.urls import url_parse
from werkzeug.utils import secure_filename
import pytesseract
from PIL import Image
from app.ocr_parser import parse_ocr_text
from datetime import datetime

bp = Blueprint('main', __name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Try to set Tesseract command path if necessary (common in some environments)
# This might need adjustment based on the actual installation path in the sandbox
try:
    pytesseract.pytesseract.tesseract_cmd = r'/usr/bin/tesseract'
except Exception:
    pass # If it fails, assume it's in PATH or handle error later

@bp.route('/')
@bp.route('/index')
def index():
    return render_template('index.html', title='Home')

@bp.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))
    form = RegistrationForm()
    if form.validate_on_submit():
        user = User(username=form.username.data, email=form.email.data)
        user.set_password(form.password.data)
        db.session.add(user)
        db.session.commit()
        flash('Congratulations, you are now a registered user!')
        return redirect(url_for('main.login'))
    return render_template('register.html', title='Register', form=form)

@bp.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(username=form.username.data).first()
        if user is None or not user.check_password(form.password.data):
            flash('Invalid username or password')
            return redirect(url_for('main.login'))
        login_user(user, remember=form.remember_me.data)
        next_page = request.args.get('next')
        if not next_page or url_parse(next_page).netloc != '': # url_parse needs to be imported from werkzeug.urls
            next_page = url_for('main.index')
        return redirect(next_page)
    return render_template('login.html', title='Sign In', form=form)

@bp.route('/logout')
def logout():
    logout_user()
    return redirect(url_for('main.index'))

@bp.route('/upload', methods=['GET', 'POST'])
@login_required
def upload():
    if request.method == 'POST':
        if 'image' not in request.files:
            flash('No file part', 'error')
            return redirect(request.url)
        file = request.files['image']
        if file.filename == '':
            flash('No selected file', 'error')
            return redirect(request.url)
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            upload_folder = os.path.join(current_app.root_path, 'static/uploads')
            os.makedirs(upload_folder, exist_ok=True) # Ensure directory exists
            filepath = os.path.join(upload_folder, filename)
            file.save(filepath)

            try:
                # Perform OCR
                img = Image.open(filepath)
                # Try chi_sim first, then eng as fallback
                try:
                    extracted_text = pytesseract.image_to_string(img, lang='chi_sim')
                except pytesseract.TesseractError: # Catch specific error for language pack not found
                     extracted_text = pytesseract.image_to_string(img, lang='eng')

                # Perform OCR
                img = Image.open(filepath)
                try:
                    extracted_text = pytesseract.image_to_string(img, lang='chi_sim')
                except pytesseract.TesseractError:
                    extracted_text = pytesseract.image_to_string(img, lang='eng')

                # Create Assignment and QAItem records
                assignment = Assignment(
                    uploader=current_user,
                    filename=filename,
                    ocr_text_raw=extracted_text,
                    uploaded_at=datetime.utcnow()
                )
                db.session.add(assignment)
                db.session.flush() # To get assignment.id for QAItems

                parsed_qas = parse_ocr_text(extracted_text)
                if not parsed_qas and extracted_text.strip(): # If parsing fails but text exists
                    # Store raw text as a single QA item of type unknown if parser didn't handle it
                     qa_item = QAItem(
                        assignment_id=assignment.id,
                        question_text="Raw OCR Output", # Or a more descriptive placeholder
                        answer_text=extracted_text,
                        is_correct=True # Default, user can mark later
                    )
                     db.session.add(qa_item)
                else:
                    for qa_data in parsed_qas:
                        # Adapt based on what parse_ocr_text returns
                        q_text = qa_data.get('question', qa_data.get('text', 'Error: Could not parse question'))
                        a_text = qa_data.get('answer', '') if qa_data.get('type') != 'unknown' else qa_data.get('text', '')

                        qa_item = QAItem(
                            assignment_id=assignment.id,
                            question_text=q_text,
                            answer_text=a_text,
                            is_correct=True # Default
                        )
                        db.session.add(qa_item)

                db.session.commit()
                flash('File uploaded and processed successfully!', 'success')
                return redirect(url_for('main.assignment_detail', assignment_id=assignment.id))
            except pytesseract.TesseractNotFoundError:
                 flash('Tesseract is not installed or not in your PATH. Cannot process file.', 'error')
                 return redirect(request.url)
            except Exception as e:
                flash(f'An error occurred during OCR processing: {str(e)}', 'error')
                return redirect(request.url)
        else:
            flash('File type not allowed. Please upload a PNG, JPG, or JPEG image.', 'error')
            return redirect(request.url)

    return render_template('upload.html', title='Upload Assignment')

@bp.route('/my-assignments')
@login_required
def my_assignments():
    user_assignments = Assignment.query.filter_by(user_id=current_user.id).order_by(Assignment.uploaded_at.desc()).all()
    return render_template('my_assignments.html', assignments=user_assignments, title="My Assignments")

@bp.route('/assignment/<int:assignment_id>')
@login_required
def assignment_detail(assignment_id):
    assignment = Assignment.query.get_or_404(assignment_id)
    if assignment.uploader != current_user: # Authorization check
        abort(403) # Forbidden

    # No need to parse OCR text here, it's already parsed and stored as QAItems
    # If QAItems are empty for some reason (e.g. parsing failed, but no 'unknown' block was created)
    # we might want to show raw text as a fallback.
    # For now, assume qa_items are populated correctly during upload.
    qa_items = assignment.qa_items.all()

    return render_template('assignment_detail.html', title=f"Results for {assignment.filename}",
                           assignment=assignment, qa_items=qa_items)

@bp.route('/mark_error/<int:qa_item_id>', methods=['POST'])
@login_required
def mark_error(qa_item_id):
    qa_item = QAItem.query.get_or_404(qa_item_id)
    assignment = qa_item.assignment

    if assignment.uploader != current_user: # Authorization check
        abort(403) # Forbidden

    explanation = request.form.get('explanation', '').strip()
    mark_incorrect = request.form.get('mark_incorrect') # Check if the button was pressed

    if not mark_incorrect:
        flash('Invalid action.', 'error')
        return redirect(url_for('main.assignment_detail', assignment_id=assignment.id))

    if not explanation:
        flash('Explanation cannot be empty when marking as incorrect.', 'error')
    else:
        qa_item.is_correct = False
        qa_item.explanation = explanation
        assignment.status = 'reviewed' # Mark assignment as reviewed
        db.session.commit()
        flash('Answer marked as incorrect and explanation saved.', 'success')

    return redirect(url_for('main.assignment_detail', assignment_id=assignment.id))
