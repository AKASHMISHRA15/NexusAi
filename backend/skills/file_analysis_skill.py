"""
Analyze uploaded images and documents.
"""
import base64
import io
import mimetypes
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Dict, Optional

from loguru import logger
from PIL import Image

from config import settings
from llm.client import _get_client


IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"}
TEXT_EXTENSIONS = {".txt", ".md", ".csv", ".tsv", ".json", ".log", ".py", ".js", ".ts", ".tsx", ".html", ".css"}


def _read_text_file(path: Path, max_chars: int = 12000) -> str:
    return path.read_text(encoding="utf-8", errors="replace")[:max_chars]


def _read_docx_text(path: Path, max_chars: int = 12000) -> str:
    chunks = []
    with zipfile.ZipFile(path) as docx:
        xml = docx.read("word/document.xml")
    root = ET.fromstring(xml)
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    for node in root.findall(".//w:t", ns):
        if node.text:
            chunks.append(node.text)
    return " ".join(chunks)[:max_chars]


def _image_metadata(path: Path) -> str:
    with Image.open(path) as img:
        return f"{img.format or path.suffix.upper().strip('.')} image, {img.width}x{img.height}px, mode {img.mode}"


async def _describe_image_with_vision(path: Path, question: str) -> Optional[str]:
    # Very large screenshots can consume the local vision model's context budget,
    # leaving it only a handful of tokens for the actual answer.  Normalising them
    # also avoids sending multi-megabyte data URLs to LM Studio.
    with Image.open(path) as image:
        image = image.convert("RGB")
        image.thumbnail((1600, 1600))
        encoded = io.BytesIO()
        image.save(encoded, format="JPEG", quality=88, optimize=True)
    mime_type = "image/jpeg"
    image_b64 = base64.b64encode(encoded.getvalue()).decode("ascii")
    data_url = f"data:{mime_type};base64,{image_b64}"

    prompt = (
        "Describe the attached image clearly and concretely. If it is a screenshot, "
        "summarize the visible UI, prominent text, and what the user likely needs to know. "
        "Answer the user's question directly.\n\n"
        f"User question: {question or 'What is in this image?'}"
    )

    client = _get_client()
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": data_url}},
            ],
        }
    ]
    try:
        response = await client.chat.completions.create(
            model=settings.get_llm_model(),
            messages=messages,
            temperature=0.2,
            max_tokens=1400,
        )
        description = (response.choices[0].message.content or "").strip()

        # Some small local vision models stop mid-sentence on screenshots. Ask for
        # one short continuation, preserving the original image in context, instead
        # of treating that partial text as a completed analysis.
        needs_continuation = (
            len(description) < 180
            or (description and description[-1] not in ".!?`)]}\"")
        )
        if description and needs_continuation:
            continuation_messages = messages + [
                {"role": "assistant", "content": description},
                {
                    "role": "user",
                    "content": (
                        "Continue the image description from where you stopped. Do not repeat the prior text. "
                        "Finish complete sentences and include the main visible text and UI details."
                    ),
                },
            ]
            continuation = await client.chat.completions.create(
                model=settings.get_llm_model(),
                messages=continuation_messages,
                temperature=0.2,
                max_tokens=1000,
            )
            extra = (continuation.choices[0].message.content or "").strip()
            if extra:
                separator = " " if not description.endswith((" ", "\n")) else ""
                description += separator + extra
        return description or None
    except Exception as exc:
        logger.warning(f"Vision analysis failed for {path}: {exc}")
        return None


async def analyze_file(file_path: str, question: str = "") -> Dict[str, Any]:
    path = Path(file_path.strip().strip('"'))
    if not path.exists() or not path.is_file():
        return {"success": False, "output": f"File not found: {file_path}"}

    ext = path.suffix.lower()
    try:
        if ext in IMAGE_EXTENSIONS:
            description = await _describe_image_with_vision(path, question)
            if description:
                return {
                    "success": True,
                    "output": description,
                    "data": {"file_path": str(path), "type": "image"},
                }
            return {
                "success": False,
                "output": (
                    f"I found the image ({_image_metadata(path)}), but the currently loaded model "
                    "did not accept image/vision input. Load a vision-capable model in LM Studio to describe image contents."
                ),
                "data": {"file_path": str(path), "type": "image"},
            }

        if ext in TEXT_EXTENSIONS:
            text = _read_text_file(path)
            return {
                "success": True,
                "output": f"Text extracted from {path.name}:\n\n{text}",
                "data": {"file_path": str(path), "type": "text"},
            }

        if ext == ".docx":
            text = _read_docx_text(path)
            return {
                "success": True,
                "output": f"Text extracted from {path.name}:\n\n{text or '[No readable text found]'}",
                "data": {"file_path": str(path), "type": "docx"},
            }

        return {
            "success": False,
            "output": f"I can locate {path.name}, but analysis for {ext or 'this file type'} is not supported yet.",
            "data": {"file_path": str(path), "type": ext},
        }
    except Exception as exc:
        logger.error(f"File analysis failed for {path}: {exc}")
        return {"success": False, "output": f"Could not analyze {path.name}: {exc}"}
