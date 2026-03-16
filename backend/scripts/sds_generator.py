#!/usr/bin/env python3

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path


def _fail(msg: str, code: int = 2):
    print(msg, file=sys.stderr)
    raise SystemExit(code)


def _require_file(p: str, label: str):
    if not p or not os.path.isfile(p):
        _fail(f"{label} not found: {p}")


def _require_dir(p: str, label: str):
    if not p or not os.path.isdir(p):
        _fail(f"{label} not found: {p}")


def _safe_int_list(values):
    out = []
    for v in values or []:
        try:
            n = int(str(v).strip())
        except Exception:
            continue
        if 1 <= n <= 9:
            out.append(n)
    # keep order but dedupe
    seen = set()
    uniq = []
    for n in out:
        if n in seen:
            continue
        seen.add(n)
        uniq.append(n)
    return uniq


@dataclass
class TargetShape:
    name: str
    left: int
    top: int
    width: int
    height: int


def _walk_shapes(shapes):
    """Yield shapes recursively, including group shapes' children."""
    for shape in shapes:
        yield shape
        try:
            # GroupShape has .shapes
            sub = getattr(shape, "shapes", None)
            if sub is not None:
                for child in _walk_shapes(sub):
                    yield child
        except Exception:
            continue


def _collect_named_shapes(prs, shape_name: str):
    found = []
    for slide in prs.slides:
        for shape in _walk_shapes(slide.shapes):
            try:
                if getattr(shape, "name", None) == shape_name:
                    found.append(shape)
            except Exception:
                continue
    return found


def _set_text(shape, text: str):
    try:
        tf = shape.text_frame
    except Exception:
        return

    try:
        tf.clear()
    except Exception:
        pass

    try:
        tf.text = text
    except Exception:
        # fallback
        try:
            p = tf.paragraphs[0]
            p.text = text
        except Exception:
            return


def _replace_with_picture(shape, image_path: str):
    """Replace a shape by adding a picture at the same bbox, then removing original."""
    slide = shape.part.slide
    left = shape.left
    top = shape.top
    width = shape.width
    height = shape.height

    slide.shapes.add_picture(image_path, left, top, width=width, height=height)

    # remove original element
    try:
        el = shape._element
        el.getparent().remove(el)
    except Exception:
        # If we can't remove, leave it (will overlap)
        pass


def _generate_qr_png(out_path: str, payload: str):
    try:
        import qrcode
        from qrcode.constants import ERROR_CORRECT_H
    except Exception as e:
        _fail(f"Missing python dependency for QR generation (qrcode). {e}")

    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    img.save(out_path)


def _compose_pictograms(out_path: str, pictograms_dir: str, ids: list[int], target_w: int = 1200, target_h: int = 600):
    try:
        from PIL import Image
    except Exception as e:
        _fail(f"Missing python dependency for image composition (Pillow). {e}")

    ids = _safe_int_list(ids)
    if not ids:
        # create transparent 1x1 to avoid crashing replace
        img = Image.new("RGBA", (1, 1), (0, 0, 0, 0))
        img.save(out_path)
        return

    pics = []
    for n in ids:
        p = os.path.join(pictograms_dir, f"{n}.png")
        if not os.path.isfile(p):
            _fail(f"Pictogram not found: {p}")
        pics.append(Image.open(p).convert("RGBA"))

    # Fit all pictograms into target box horizontally with spacing.
    spacing = max(10, int(target_w * 0.03))
    available_w = max(1, target_w - spacing * (len(pics) - 1))

    # each pictogram max width and height
    per_w = max(1, available_w // len(pics))
    per_h = max(1, target_h)

    resized = []
    for im in pics:
        w, h = im.size
        if w <= 0 or h <= 0:
            continue
        scale = min(per_w / w, per_h / h)
        nw = max(1, int(w * scale))
        nh = max(1, int(h * scale))
        resized.append(im.resize((nw, nh), Image.LANCZOS))

    total_w = sum(im.size[0] for im in resized) + spacing * (len(resized) - 1)
    max_h = max(im.size[1] for im in resized)

    canvas_w = min(target_w, max(target_w, total_w))
    canvas_h = min(target_h, max(target_h, max_h))

    canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))

    x = (canvas_w - total_w) // 2
    for im in resized:
        y = (canvas_h - im.size[1]) // 2
        canvas.alpha_composite(im, (x, y))
        x += im.size[0] + spacing

    canvas.save(out_path)


def _pptx_to_pdf(pptx_path: str, out_pdf_path: str, soffice_bin: str):
    out_pdf_path = os.path.abspath(out_pdf_path)
    out_dir = os.path.dirname(out_pdf_path)
    os.makedirs(out_dir, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="sds_pptx2pdf_") as tmpdir:
        tmpdir = os.path.abspath(tmpdir)

        cmd = [
            soffice_bin,
            "--headless",
            "--nologo",
            "--nolockcheck",
            "--norestore",
            "--convert-to",
            "pdf",
            "--outdir",
            tmpdir,
            pptx_path,
        ]

        proc = subprocess.run(cmd, capture_output=True, text=True)
        if proc.returncode != 0:
            _fail(f"LibreOffice conversion failed. stdout={proc.stdout} stderr={proc.stderr}")

        # libreoffice outputs with same base name
        base = os.path.splitext(os.path.basename(pptx_path))[0]
        produced = os.path.join(tmpdir, base + ".pdf")
        if not os.path.isfile(produced):
            # fallback: find any pdf
            pdfs = [p for p in os.listdir(tmpdir) if p.lower().endswith(".pdf")]
            if len(pdfs) == 1:
                produced = os.path.join(tmpdir, pdfs[0])
            else:
                _fail(f"LibreOffice did not produce expected PDF in {tmpdir}")

        shutil.copyfile(produced, out_pdf_path)


def _fill_qr_template(qr_template: str, product_name: str, qr_png: str, pictos_png: str, out_pptx: str):
    try:
        from pptx import Presentation
    except Exception as e:
        _fail(f"Missing python dependency for PPTX editing (python-pptx). {e}")

    prs = Presentation(qr_template)

    # QR Code
    qr_shapes = _collect_named_shapes(prs, "QR Code")
    if not qr_shapes:
        _fail('Shape named "QR Code" not found in QR template')
    for s in qr_shapes:
        _replace_with_picture(s, qr_png)

    # Product name
    name_shapes = _collect_named_shapes(prs, "Product name")
    if not name_shapes:
        _fail('Shape named "Product name" not found in QR template')
    for s in name_shapes:
        _set_text(s, product_name)

    # Pictograms container
    pic_shapes = _collect_named_shapes(prs, "Pictograms")
    if not pic_shapes:
        _fail('Shape named "Pictograms" not found in QR template')
    for s in pic_shapes:
        _replace_with_picture(s, pictos_png)

    prs.save(out_pptx)


def _fill_tags_template(tag_template: str, product_name: str, qr_png: str, pictos_png: str, out_pptx: str):
    try:
        from pptx import Presentation
    except Exception as e:
        _fail(f"Missing python dependency for PPTX editing (python-pptx). {e}")

    prs = Presentation(tag_template)

    # Fill all repeated shapes across groups
    qr_shapes = _collect_named_shapes(prs, "QR Code")
    name_shapes = _collect_named_shapes(prs, "Product name")
    pic_shapes = _collect_named_shapes(prs, "Pictograms")

    if not qr_shapes:
        _fail('Shape named "QR Code" not found in Tags template')
    if not name_shapes:
        _fail('Shape named "Product name" not found in Tags template')
    if not pic_shapes:
        _fail('Shape named "Pictograms" not found in Tags template')

    for s in qr_shapes:
        _replace_with_picture(s, qr_png)

    for s in name_shapes:
        _set_text(s, product_name)

    for s in pic_shapes:
        _replace_with_picture(s, pictos_png)

    prs.save(out_pptx)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--qr-template", required=True)
    ap.add_argument("--tag-template", required=True)
    ap.add_argument("--pictograms-dir", required=True)
    ap.add_argument("--product-name", required=True)
    ap.add_argument("--public-url", required=True)
    ap.add_argument("--out-qr-pdf", required=True)
    ap.add_argument("--out-tag-pdf", required=True)
    ap.add_argument("--doc-id", required=True)
    ap.add_argument("--picto", action="append", default=[])
    ap.add_argument("--soffice", default=os.environ.get("SDS_LIBREOFFICE_BIN", "soffice"))

    args = ap.parse_args()

    _require_file(args.qr_template, "QR template")
    _require_file(args.tag_template, "Tags template")
    _require_dir(args.pictograms_dir, "Pictograms dir")

    pictos = _safe_int_list(args.picto)

    with tempfile.TemporaryDirectory(prefix=f"sds_gen_{args.doc_id}_") as tmpdir:
        tmpdir = os.path.abspath(tmpdir)

        qr_png = os.path.join(tmpdir, "qr.png")
        pictos_png = os.path.join(tmpdir, "pictos.png")

        _generate_qr_png(qr_png, args.public_url)
        # high-res composition; PowerPoint will scale down into bbox
        _compose_pictograms(pictos_png, args.pictograms_dir, pictos, 1600, 800)

        qr_pptx_out = os.path.join(tmpdir, "qr_out.pptx")
        tag_pptx_out = os.path.join(tmpdir, "tag_out.pptx")

        _fill_qr_template(args.qr_template, args.product_name, qr_png, pictos_png, qr_pptx_out)
        _fill_tags_template(args.tag_template, args.product_name, qr_png, pictos_png, tag_pptx_out)

        _pptx_to_pdf(qr_pptx_out, args.out_qr_pdf, args.soffice)
        _pptx_to_pdf(tag_pptx_out, args.out_tag_pdf, args.soffice)

    print("ok")


if __name__ == "__main__":
    main()
