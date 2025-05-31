from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_migrate import Migrate
from flask_wtf.csrf import CSRFProtect # Import CSRFProtect
from config import Config

db = SQLAlchemy()
login_manager = LoginManager()
login_manager.login_view = 'main.login' # Corrected blueprint name
migrate = Migrate()
csrf = CSRFProtect() # Initialize CSRFProtect

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    login_manager.init_app(app)
    migrate.init_app(app, db)
    csrf.init_app(app) # Initialize CSRF for the app

    from app.routes import bp as main_bp
    app.register_blueprint(main_bp)

    from app import models

    return app
