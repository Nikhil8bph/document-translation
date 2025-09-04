# PDF Translation API Documentation

## Base URL
```
http://localhost:8000
```

## Features
- Line-by-line translation for better accuracy
- Automatic URL and filename preservation
- Support for multiple languages including Hindi (Devanagari script)
- Complete content preservation with fallback mechanisms
- CORS enabled for all origins

## Endpoints

### GET /api/health
Health check endpoint.

**Response:**
```json
{
  "status": "healthy"
}
```

### GET /api/files
List all uploaded files and their translation status.

**Response:**
```json
{
  "files": [
    {
      "file_id": "uuid",
      "original_name": "document.pdf",
      "upload_path": "uploads/uuid_document.pdf",
      "translated_exists": true,
      "translated_path": "translated/uuid_translated.pdf"
    }
  ],
  "total": 1
}
```

### POST /api/upload
Upload PDF file for translation.

**Request:**
- Content-Type: `multipart/form-data`
- Body: PDF file (max 50MB)

**Response:**
```json
{
  "file_id": "uuid",
  "filename": "uuid_filename.pdf",
  "detected_language": "en",
  "pages": 5,
  "message": "Upload successful"
}
```

**Errors:**
- 400: Invalid file format or processing failed

### POST /api/translate
Translate uploaded PDF with line-by-line processing.

**Request:**
- Content-Type: `application/x-www-form-urlencoded`
- Body:
  - `file_id`: string (required)
  - `source_lang`: string (required)
  - `target_lang`: string (required)

**Response:**
```json
{
  "success": true,
  "output_filename": "uuid_translated.pdf",
  "total_blocks": 274,
  "pages": 9
}
```

**Errors:**
- 404: File not found
- 400: Extraction failed
- 500: Translation failed

### GET /api/preview/{file_id}/original
Preview original uploaded PDF.

**Parameters:**
- `file_id`: string (path parameter)

**Response:** PDF file stream

**Errors:**
- 404: Original file not found

### GET /api/preview/{file_id}/translated
Preview translated PDF.

**Parameters:**
- `file_id`: string (path parameter)

**Response:** PDF file stream

**Errors:**
- 404: Translated file not found. Please translate the document first.

### GET /api/download/{file_id}
Download translated PDF with original filename.

**Parameters:**
- `file_id`: string (path parameter)

**Response:** PDF file download with filename `translated_{original_name}.pdf`

**Errors:**
- 404: Translated file not found. Please translate the document first.

## Supported Languages

### Language Codes
- **en**: English
- **es**: Spanish
- **fr**: French
- **de**: German
- **hi**: Hindi (हिन्दी) - Devanagari script
- **zh**: Chinese
- **ja**: Japanese
- **ko**: Korean
- **ar**: Arabic
- **ru**: Russian
- **pt**: Portuguese
- **it**: Italian

## Translation Features

### Content Preservation
- URLs and file references are automatically preserved
- Technical terms and code snippets remain unchanged
- Document structure and formatting maintained
- Fallback to original text if translation fails

### Processing Details
- **Text Chunking**: 1500 character limit per chunk
- **Context Window**: 2048 characters for translation model
- **Line-by-Line**: Each line translated independently for accuracy
- **Error Handling**: Multiple fallback strategies for text insertion

## File Storage
- **Original files**: `uploads/` directory
- **Translated files**: `translated/` directory
- **Naming convention**: `{file_id}_{original_filename}.pdf`
- **Max file size**: 50MB

## CORS Configuration
- **Origins**: All origins allowed (`*`)
- **Methods**: All HTTP methods allowed
- **Headers**: All headers allowed
- **Credentials**: Supported

## Error Handling
All endpoints return appropriate HTTP status codes:
- **200**: Success
- **400**: Bad request (invalid file, processing failed)
- **404**: Resource not found
- **500**: Internal server error