# Archived Legacy Components

This directory contains archived components from the initial Indiana Expungement Assistant architecture before its evolution into a fully client-side, zero-backend Chrome extension.

## Contents

### 1. `legacy_backend/`
- **`app.py`**: Former FastAPI web server providing local REST endpoints (`GET /health`, `POST /generate`, `POST /preview`).
- **`form_engine.py`**: 70KB Python document generator using `python-docx` and COM/LibreOffice to generate court filings and convert to PDF.
- **`requirements.txt`**: Python dependencies required by the former FastAPI backend (`fastapi`, `uvicorn`, `python-docx`, `pydantic`).

### 2. `legacy_python_tests/`
- **`test_api_endpoints.py`**: Pytest test suite for the FastAPI endpoints.
- **`test_form_engine.py`**: Pytest test suite validating the Python form engine.
- **`test_output.zip`**: Sample court petition zip generated during integration tests.

### 3. `legacy_extension_monolith/`
- **`sidepanel.js`**: Original 1,627-line monolithic script before it was refactored into modern, decoupled ES6 modules (`main.js`, `state.js`, `scanner.js`, `profile.js`, `generator.js`, `ui.js`, `utils.js`).

### 4. `legacy_bookmarklet/`
- **`bookmarklet.min.js`**: Former minified bookmarklet using the obsolete HTML parsing endpoint (`Accept: text/html`) that got redirected by the court portal.
- **`extension_bookmarklet.js`**: Former redundant copy of the bookmarklet inside the `extension/` directory.

### 5. `test_data/`
- **`mycase-expungement-data-2026-09-05.json`**: Historical sanitized MyCase export payload used during the initial debugging and verification of the JSON API scraper.

### 6. `plans/`
- **`1788630726845-redesign-docs-app-ui.md`**: Historical design artifact for the standalone web app UI redesign.

## Why Were These Archived?
1. **Client-Side Architecture**: PDF generation was transitioned to in-browser client-side generation using `pdf-lib` (`pdf-lib.min.js`). This eliminated the requirement for users to install Python, run a local server, and deal with local port/firewall issues.
2. **ES6 Modularization**: The sidepanel UI logic was decomposed into focused ES modules with clear responsibilities, improving testability and maintainability.
3. **Streamlined Repository**: Removing the 80MB Python virtual environment, obsolete bookmarklet copies, personal test data, and dead code keeps the repository lean, secure, and fast to clone, test, and distribute.

## Restoring or Referencing
If needed, these files can be referenced for historical context, legal wording templates, or revived by installing dependencies listed in `legacy_backend/requirements.txt`.
