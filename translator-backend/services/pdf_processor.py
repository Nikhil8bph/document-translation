import os
import base64
import fitz  # PyMuPDF
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional

import tiktoken
from dotenv import load_dotenv
from openai import AsyncOpenAI
from langchain.prompts import PromptTemplate

# Set up font for Hindi support
fitz.TOOLS.set_small_glyph_heights(True)

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL")

client = AsyncOpenAI(api_key=OPENAI_API_KEY)


class PDFProcessor:
    def __init__(self):
        self.model = OPENAI_MODEL

    def _split_text_into_chunks(self, text: str, max_chars: int = 1500) -> list[str]:
        """Split text into manageable chunks while preserving structure."""
        if len(text) <= max_chars:
            return [text]
        
        chunks = []
        lines = text.split('\n')
        current_chunk = ""
        
        for line in lines:
            # If adding this line would exceed the limit
            if len(current_chunk) + len(line) + 1 > max_chars:
                if current_chunk.strip():
                    chunks.append(current_chunk.strip())
                current_chunk = line
            else:
                if current_chunk:
                    current_chunk += "\n" + line
                else:
                    current_chunk = line
        
        # Add the last chunk
        if current_chunk.strip():
            chunks.append(current_chunk.strip())
        
        return chunks if chunks else [text]

    async def extract_text_from_pdf(self, pdf_path: str) -> Dict[str, Any]:
        """Extract text and structure from PDF"""
        try:
            doc = fitz.open(pdf_path)
            pages_data = []

            for page_num in range(len(doc)):
                page = doc[page_num]
                text_dict = page.get_text("dict")

                blocks = []
                for block in text_dict.get("blocks", []):
                    if "lines" in block:
                        block_text = ""
                        font_info: Optional[Dict[str, Any]] = None
                        for line in block["lines"]:
                            line_text = ""
                            for span in line.get("spans", []):
                                line_text += span["text"]
                                if font_info is None:
                                    font_info = span
                            if line_text.strip():
                                block_text += line_text + "\n"

                        if block_text.strip():
                            blocks.append({
                                "text": block_text.strip(),
                                "bbox": block["bbox"],
                                "font_info": font_info
                            })

                # Extract images
                images = []
                for img_index, img in enumerate(page.get_images(full=True)):
                    try:
                        xref = img[0]
                        pix = fitz.Pixmap(doc, xref)
                        if pix.n - pix.alpha < 4:
                            img_data = pix.tobytes("png")
                            img_rect = page.get_image_rects(xref)
                            bbox = img_rect[0] if img_rect else [0, 0, 100, 100]
                            images.append({
                                "index": img_index,
                                "data": base64.b64encode(img_data).decode(),
                                "bbox": bbox
                            })
                    except Exception as e:
                        logger.warning(f"Image processing error on page {page_num+1}: {e}")
                        continue

                pages_data.append({
                    "page_number": page_num + 1,
                    "text_blocks": blocks,
                    "images": images,
                    "page_rect": page.rect
                })

            doc.close()
            return {"success": True, "pages": pages_data}

        except Exception as e:
            logger.error(f"PDF extraction failed: {e}")
            return {"success": False, "error": str(e)}

    async def detect_language(self, text: str) -> str:
        """Detect language with model"""
        if not text.strip():
            return "en"

        prompt = f"Detect the language of this text and respond with only the 2-letter ISO code (en, es, hi, fr, etc.):\n\n{text[:500]}"

        try:
            response = await client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a language detector. Return only the 2-letter ISO language code."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=10,
                temperature=0
            )

            content = response.choices[0].message.content
            if isinstance(content, list):
                lang_code = content[0].text.strip().lower()
            else:
                lang_code = str(content).strip().lower()

            # Extract just the language code if there's extra text
            lang_code = lang_code.split()[0] if lang_code else "en"
            
            if len(lang_code) == 2 and lang_code.isalpha():
                return lang_code
            return "en"

        except Exception as e:
            logger.error(f"Language detection error: {e}")
            return "en"

    async def translate_page_blocks(self, page_blocks: list, source_lang: str, target_lang: str) -> list:
        """Translate all text blocks from a page together maintaining line structure"""
        if source_lang == target_lang:
            for block in page_blocks:
                block["translated_text"] = block["text"]
            return page_blocks

        try:
            # Prepare text with line markers for proper mapping
            lines_to_translate = []
            block_line_counts = []
            
            for block in page_blocks:
                if block["text"].strip():
                    block_lines = block["text"].split('\n')
                    lines_to_translate.extend(block_lines)
                    block_line_counts.append(len(block_lines))
                else:
                    block_line_counts.append(0)
            
            if not lines_to_translate:
                for block in page_blocks:
                    block["translated_text"] = block["text"]
                return page_blocks
            
            # Combine lines with newlines for translation
            combined_text = "\n".join(lines_to_translate)
            
            # Translate the entire page content
            translated_text = await self._translate_page_content(combined_text, source_lang, target_lang)
            
            # Split translated text back into lines
            translated_lines = translated_text.split("\n")
            
            # Map translated lines back to original blocks
            line_index = 0
            
            for i, block in enumerate(page_blocks):
                if block_line_counts[i] > 0:
                    # Get the translated lines for this block
                    block_translated_lines = []
                    for _ in range(block_line_counts[i]):
                        if line_index < len(translated_lines):
                            block_translated_lines.append(translated_lines[line_index])
                            line_index += 1
                        else:
                            # Fallback to original line if translation is shorter
                            original_lines = block["text"].split('\n')
                            if len(block_translated_lines) < len(original_lines):
                                block_translated_lines.append(original_lines[len(block_translated_lines)])
                    
                    block["translated_text"] = "\n".join(block_translated_lines)
                else:
                    block["translated_text"] = block["text"]
            
            return page_blocks
            
        except Exception as e:
            logger.error(f"Page translation failed: {e}")
            # Return original blocks with text as translated_text
            for block in page_blocks:
                block["translated_text"] = block["text"]
            return page_blocks

    async def _translate_page_content(self, text: str, source_lang: str, target_lang: str) -> str:
        """Translate page content maintaining exact line structure"""
        if not text.strip():
            return text
            
        # Get language names for better prompting
        lang_names = {
            'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
            'hi': 'Hindi', 'zh': 'Chinese', 'ja': 'Japanese', 'ko': 'Korean',
            'ar': 'Arabic', 'ru': 'Russian', 'pt': 'Portuguese', 'it': 'Italian'
        }
        
        source_name = lang_names.get(source_lang, source_lang)
        target_name = lang_names.get(target_lang, target_lang)
        
        prompt = f"""Translate this text from {source_name} to {target_name}.
CRITICAL Rules:
- Translate line by line, maintaining EXACT same number of lines
- Each line in output must correspond to each line in input
- Do NOT translate URLs, file names, or technical references
- Preserve line breaks exactly as they appear
- Return ONLY the translated text with same line structure
- If a line is empty, keep it empty

Text to translate:
{text}"""

        try:
            # Special handling for Hindi and other complex scripts
            if target_lang == 'hi':
                system_msg = "You are a professional translator. Translate to Hindi (हिन्दी) using Devanagari script. MAINTAIN EXACT LINE STRUCTURE - same number of lines in output as input."
            else:
                system_msg = f"You are a professional translator. Translate to {target_name}. MAINTAIN EXACT LINE STRUCTURE - same number of lines in output as input."
            
            response = await client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=4000,
                temperature=0.0,
            )
            
            content = response.choices[0].message.content
            if isinstance(content, list):
                translated = content[0].text.strip()
            else:
                translated = str(content).strip() if content else ""
            
            # Validate line count matches
            original_lines = text.split('\n')
            translated_lines = translated.split('\n') if translated else []
            
            # If line counts don't match, pad or truncate
            if len(translated_lines) != len(original_lines):
                if len(translated_lines) < len(original_lines):
                    # Pad with original lines if translation is shorter
                    while len(translated_lines) < len(original_lines):
                        idx = len(translated_lines)
                        translated_lines.append(original_lines[idx] if idx < len(original_lines) else "")
                else:
                    # Truncate if translation is longer
                    translated_lines = translated_lines[:len(original_lines)]
                
                translated = '\n'.join(translated_lines)
            
            return translated if translated else text
                
        except Exception as e:
            logger.error(f"Page translation error: {e}")
            return text

    async def create_translated_pdf(self, original_pdf_path: str, translated_data: Dict[str, Any], output_path: str) -> bool:
        """Create new blank PDF with translated content"""
        try:
            # Open original to get page dimensions
            original_doc = fitz.open(original_pdf_path)
            
            # Create new blank document
            new_doc = fitz.open()
            
            # Try to embed a font that supports Hindi
            try:
                # Check if we have Hindi text to determine font needs
                has_hindi_content = any(
                    any('\u0900' <= char <= '\u097F' for char in block.get('translated_text', ''))
                    for page_data in translated_data["pages"]
                    for block in page_data["text_blocks"]
                )
                logger.info(f"Document contains Hindi content: {has_hindi_content}")
            except Exception as e:
                logger.warning(f"Could not check for Hindi content: {e}")
                has_hindi_content = False
            total_blocks = 0
            successful_blocks = 0

            for page_data in translated_data["pages"]:
                original_page = original_doc[page_data["page_number"] - 1]
                page_rect = original_page.rect
                
                # Create new blank page with same dimensions
                new_page = new_doc.new_page(width=page_rect.width, height=page_rect.height)

                for block in page_data["text_blocks"]:
                    total_blocks += 1
                    translated_text = block.get("translated_text", "")
                    original_text = block.get("text", "")
                    
                    # Use translated text if available, otherwise original
                    text_to_use = translated_text.strip() if translated_text else original_text.strip()
                    
                    logger.info(f"Processing block {total_blocks}: '{text_to_use[:50]}...' (translated: {bool(translated_text)}, bbox: {block['bbox']})")
                    
                    if text_to_use and len(text_to_use.strip()) > 0:
                        bbox = fitz.Rect(block["bbox"])
                        font_info = block.get("font_info", {})
                        font_size = max(8, min(font_info.get("size", 12) if font_info else 12, 16))
                        
                        # Ensure bbox is valid
                        if bbox.width <= 0 or bbox.height <= 0:
                            bbox = fitz.Rect(bbox.x0, bbox.y0, bbox.x0 + 200, bbox.y0 + font_size * 2)
                        
                        try:
                            # Check if text contains Hindi/Devanagari characters
                            has_hindi = any('\u0900' <= char <= '\u097F' for char in text_to_use)
                            
                            if has_hindi:
                                # Use textbox for Hindi with better font support
                                result = new_page.insert_textbox(
                                    bbox,
                                    text_to_use,
                                    fontsize=font_size,
                                    fontname="cjk",  # Better Unicode support
                                    color=(0, 0, 0),
                                    align=0
                                )
                                if result >= 0:
                                    successful_blocks += 1
                                    logger.info(f"Successfully inserted Hindi text block {successful_blocks}")
                                else:
                                    raise Exception("Textbox insertion failed")
                            else:
                                # Regular text insertion for English/Latin
                                lines = text_to_use.split('\n')
                                line_height = font_size * 1.2
                                
                                for i, line in enumerate(lines):
                                    if line.strip():
                                        y_pos = bbox.y0 + (i * line_height) + font_size
                                        new_page.insert_text(
                                            (bbox.x0, y_pos),
                                            line.strip(),
                                            fontsize=font_size,
                                            color=(0, 0, 0)
                                        )
                                
                                successful_blocks += 1
                                logger.info(f"Successfully inserted text block {successful_blocks}")
                            
                        except Exception as e:
                            logger.error(f"Text insertion failed: {e}")
                            # Fallback with different font
                            try:
                                new_page.insert_text(
                                    (bbox.x0, bbox.y0 + font_size),
                                    text_to_use.replace('\n', ' '),
                                    fontsize=max(6, font_size * 0.8),
                                    color=(0, 0, 0)
                                )
                                successful_blocks += 1
                                logger.info(f"Fallback insertion successful")
                            except Exception as e2:
                                logger.error(f"All insertion methods failed: {e2}")

            logger.info(f"PDF Creation Summary: {successful_blocks}/{total_blocks} text blocks inserted")
            
            if successful_blocks == 0:
                logger.error("No text blocks were inserted! PDF will be blank.")
                # Add debug info
                for i, page_data in enumerate(translated_data["pages"]):
                    logger.error(f"Page {i+1}: {len(page_data['text_blocks'])} blocks")
                    for j, block in enumerate(page_data['text_blocks'][:3]):  # Show first 3 blocks
                        logger.error(f"  Block {j+1}: '{block.get('translated_text', '')[:50]}...'")
            
            new_doc.save(output_path)
            new_doc.close()
            original_doc.close()
            
            return successful_blocks > 0

        except Exception as e:
            logger.error(f"Error creating translated PDF: {e}")
            return False
