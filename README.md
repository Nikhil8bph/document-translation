# PDF Translation Tool

A production-grade PDF translation application powered by IBM Granite AI models.

## Quick Start

1. Install Ollama and pull models:
```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull granite3.3:2b
ollama pull granite3.2-vision:2b
ollama serve
```

2. Start backend:
```bash
pip install -r requirements.txt
uvicorn fastapi_backend:app --reload
```

3. Start frontend:
```bash
cd angular
npm install
ng serve
```

Visit http://localhost:4200 to use the application.

## Features

- PDF upload with drag-and-drop
- Auto language detection
- Side-by-side translation view
- Mobile responsive design
- Synchronized scrolling
- Download translated PDFs

## Technology Stack

- Backend: FastAPI, PyMuPDF, Ollama
- Frontend: Angular 17, TypeScript, SCSS
- AI: IBM Granite 3.3 2B & Granite 3.2 Vision
