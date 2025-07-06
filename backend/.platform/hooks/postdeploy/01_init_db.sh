#!/bin/bash
set -e

# This script runs after every deployment to initialize the database.
# The leader check has been removed to ensure it runs in a single-instance environment.

echo "Running database initialization..."

# Activate the virtual environment created by Elastic Beanstalk.
source /var/app/venv/staging-LQM1lest/bin/activate
  
# Change to the current application directory where your code is.
cd /var/app/current

# Add the application directory to the existing PYTHONPATH.
# This ensures that Python can find your modules, like 'config.py'.
export PYTHONPATH="${PYTHONPATH}:/var/app/current"
  
# Run your custom database initialization command.
flask --app application.py init-db
  
echo "Database initialization complete."
