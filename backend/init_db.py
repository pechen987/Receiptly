import click
from flask.cli import with_appcontext
from models import db # Use db from models.py, not application.py

@click.command('init-db')
@with_appcontext
def init_db_command(*args, **kwargs):
    """Clears existing data and creates new tables."""
    try:
        print("Attempting to create all database tables...")
        # The following line will create all tables based on your models
        db.create_all()
        print("Database tables created successfully.")
        click.echo('Initialized the database.')
    except Exception as e:
        # This will print the full error to the deployment logs
        print(f"An error occurred during database initialization: {e}")
        click.echo(f"Failed to initialize database: {e}")
        # Exit with a non-zero status code to signal failure to Elastic Beanstalk
        raise

def init_app(app):
    """Register database functions with the Flask app."""
    # This makes the 'init-db' command available to the 'flask' command
    app.cli.add_command(init_db_command)