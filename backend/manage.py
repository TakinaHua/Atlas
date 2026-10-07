#!/usr/bin/env python3
"""Entry point for migrations, the local server, and Django tests."""

import os
import sys

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
from django.core.management import execute_from_command_line

execute_from_command_line(sys.argv)
