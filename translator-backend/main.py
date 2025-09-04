from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uuid
from pathlib import Path
import logging
import base64
import fitz

from services.pdf_processor import PDFProcessor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="PDF Translation API", version="2.0.0")

# CORS - Allow all origins and URLs
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Folders
UPLOAD_DIR = Path("uploads")
TRANSLATED_DIR = Path("translated")
UPLOAD_DIR.mkdir(exist_ok=True)
TRANSLATED_DIR.mkdir(exist_ok=True)

pdf_processor = PDFProcessor()


@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/api/files")
async def list_files():
    """List all uploaded files and their translation status"""
    files = []
    
    for upload_file in UPLOAD_DIR.glob("*_*.pdf"):
        file_id = upload_file.name.split("_")[0]
        original_name = upload_file.name.replace(f"{file_id}_", "")
        translated_file = TRANSLATED_DIR / f"{file_id}_translated.pdf"
        
        files.append({
            "file_id": file_id,
            "original_name": original_name,
            "upload_path": str(upload_file),
            "translated_exists": translated_file.exists(),
            "translated_path": str(translated_file) if translated_file.exists() else None
        })
    
    return {"files": files, "total": len(files)}


@app.post("/api/upload")
async def upload_pdf(file: UploadFile = File(...)):
    """Upload PDF and detect language"""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")

    contents = await file.read()
    file_id = str(uuid.uuid4())
    filename = f"{file_id}_{file.filename}"
    file_path = UPLOAD_DIR / filename

    with open(file_path, "wb") as f:
        f.write(contents)

    extracted = await pdf_processor.extract_text_from_pdf(str(file_path))
    if not extracted["success"]:
        raise HTTPException(status_code=400, detail="Failed to process PDF")

    first_text = ""
    if extracted["pages"]:
        for block in extracted["pages"][0]["text_blocks"]:
            first_text += block["text"] + " "

    detected_lang = await pdf_processor.detect_language(first_text)

    return JSONResponse({
        "file_id": file_id,
        "filename": filename,
        "detected_language": detected_lang,
        "pages": len(extracted["pages"]),
        "message": "Upload successful"
    })


@app.post("/api/translate")
async def translate_pdf(file_id: str = Form(...), source_lang: str = Form(...), target_lang: str = Form(...)):
    """Translate uploaded PDF"""
    matches = list(UPLOAD_DIR.glob(f"{file_id}_*"))
    if not matches:
        raise HTTPException(status_code=404, detail="File not found")

    original_file = matches[0]
    logger.info(f"Starting translation: {source_lang} -> {target_lang} for file {original_file.name}")
    
    extracted = await pdf_processor.extract_text_from_pdf(str(original_file))
    if not extracted["success"]:
        raise HTTPException(status_code=400, detail="Failed to extract PDF")

    total_blocks = sum(len(page["text_blocks"]) for page in extracted["pages"])
    logger.info(f"Extracted {len(extracted['pages'])} pages with {total_blocks} text blocks")

    translated_data = {"pages": []}
    processed_pages = 0
    
    for page in extracted["pages"]:
        processed_pages += 1
        page_blocks = page["text_blocks"]
        
        logger.info(f"Translating page {processed_pages}/{len(extracted['pages'])} with {len(page_blocks)} blocks")
        
        # Translate entire page at once
        translated_blocks = await pdf_processor.translate_page_blocks(page_blocks, source_lang, target_lang)
        
        # Prepare translated page data
        translated_page = {
            "page_number": page["page_number"], 
            "text_blocks": [],
            "images": page.get("images", [])
        }
        
        for block in translated_blocks:
            translated_page["text_blocks"].append({
                "bbox": block["bbox"],
                "original_text": block["text"],
                "translated_text": block["translated_text"],
                "font_info": block["font_info"]
            })
            
        translated_data["pages"].append(translated_page)
        logger.info(f"Page {processed_pages} translation completed")

    output_filename = f"{file_id}_translated.pdf"
    output_path = TRANSLATED_DIR / output_filename
    
    logger.info(f"Creating translated PDF: {output_path}")
    success = await pdf_processor.create_translated_pdf(str(original_file), translated_data, str(output_path))

    if not success:
        logger.error("Failed to create translated PDF")
        raise HTTPException(status_code=500, detail="Failed to create translated PDF")

    logger.info(f"Translation completed successfully: {output_filename}")
    return {
        "success": True, 
        "output_filename": output_filename,
        "total_blocks": total_blocks,
        "pages": len(extracted["pages"]),
        "processing_method": "page-by-page"
    }


@app.get("/api/preview/{file_id}/original")
async def preview_original_pdf(file_id: str):
    """Preview original PDF"""
    matches = list(UPLOAD_DIR.glob(f"{file_id}_*"))
    if not matches:
        raise HTTPException(status_code=404, detail="Original file not found")
    return FileResponse(path=matches[0], media_type="application/pdf")


@app.get("/api/preview/{file_id}/translated")
async def preview_translated_pdf(file_id: str):
    """Preview translated PDF"""
    file_path = TRANSLATED_DIR / f"{file_id}_translated.pdf"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Translated file not found. Please translate the document first.")
    return FileResponse(path=file_path, media_type="application/pdf")


@app.get("/api/download/{file_id}")
async def download_translated_pdf(file_id: str):
    """Download translated PDF"""
    file_path = TRANSLATED_DIR / f"{file_id}_translated.pdf"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Translated file not found. Please translate the document first.")
    
    # Get original filename for better download name
    original_matches = list(UPLOAD_DIR.glob(f"{file_id}_*"))
    if original_matches:
        original_name = original_matches[0].name.replace(f"{file_id}_", "")
        download_name = f"translated_{original_name}"
    else:
        download_name = f"translated_{file_id}.pdf"
    
    return FileResponse(path=file_path, filename=download_name, media_type="application/pdf")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
