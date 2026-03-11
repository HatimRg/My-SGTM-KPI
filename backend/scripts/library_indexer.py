#!/usr/bin/env python3

import argparse
import json
import os
import re
import sys
import time
import unicodedata
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")
os.environ.setdefault("TRANSFORMERS_VERBOSITY", "error")

ACRONYMS = {
    "HSE", "QHSE", "PPE", "EPI", "SDS", "FDS", "SGTM", "UM6P", "KPI", "AD"
}

STOPWORDS_CUSTOM_FR = {
    "etre", "avoir", "faire", "donner", "prendre", "aller", "venir",
    "pouvoir", "devoir", "falloir", "utiliser", "effectuer", "proceder",
    "assurer", "garantir", "generalement", "rapidement", "pratiques",
    "possible", "important", "document", "procedure", "systeme",
    "processus", "fonction", "fonctionnement", "partie", "chapitre",
    "rapport", "information", "donnees", "resultats", "analyse",
    "analyses", "evaluation", "objectif", "objectifs", "description",
    "presentation", "conclusion"
}

DOMAIN_STOPWORDS_FR = {
    "personnel", "entreprise", "service", "responsable"
}

STOPWORDS_CUSTOM_EN = {
    "the", "an", "and", "or", "to", "in", "on", "for", "with", "by",
    "from", "into", "during", "after", "between", "through", "over",
    "is", "are", "was", "were", "been", "being", "this", "that",
    "those", "it", "its", "as", "not", "no", "yes", "can", "should",
    "would", "must", "may", "will", "shall", "use", "used",
    "procedure", "procedures", "document", "documents", "process", "processes",
    "report", "reports"
}

STOPWORDS_CUSTOM_AR = {
    "في", "من", "الى", "إلى", "عن", "مع", "هذه", "ذلك", "تلك", "هو",
    "هم", "هن", "كان", "كانت", "تكون", "لا", "نعم", "ما", "لم", "لن",
    "قد", "كما", "أي", "او", "أو", "و"
}

WORD_RE = re.compile(r"[\w\u0600-\u06FF]+", re.UNICODE)
NON_WORD_RE = re.compile(r"[^\w\s\u0600-\u06FF]", re.UNICODE)
MULTISPACE_RE = re.compile(r"\s+")
SENTENCE_SPLIT_RE = re.compile(r"[.!?\n\r;:]+")
ARABIC_RE = re.compile(r"[\u0600-\u06FF]")

LANG_STOPWORDS = {
    "fr": STOPWORDS_CUSTOM_FR | DOMAIN_STOPWORDS_FR,
    "en": STOPWORDS_CUSTOM_EN,
    "ar": STOPWORDS_CUSTOM_AR,
}

def _strip_accents(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFKD", s)
        if not unicodedata.combining(c)
    )

@lru_cache(maxsize=50000)
def normalize_keyword(keyword: str) -> str:
    s = (keyword or "").strip()
    if not s:
        return ""
    s = _strip_accents(s)
    s = s.lower()
    s = NON_WORD_RE.sub(" ", s)
    s = MULTISPACE_RE.sub(" ", s).strip()
    return s

def format_keyword(keyword: str) -> str:
    words = re.split(r"\s+", (keyword or "").strip())
    out = []
    for w in words:
        if w.upper() in ACRONYMS:
            out.append(w.upper())
        else:
            out.append(w.lower())
    return " ".join(w for w in out if w)

def _is_acronym(word: str) -> bool:
    w = (word or "").strip()
    return bool(w) and (w.upper() in ACRONYMS or bool(re.fullmatch(r"[A-Z]{2,10}", w)))

def _tokenize(text: str) -> list[str]:
    return WORD_RE.findall(text or "")

def _get_stopwords(lang: str) -> set[str]:
    return LANG_STOPWORDS.get(lang, set())

def _is_bad_phrase_tokens(tokens: list[str], lang: str) -> bool:
    if not tokens:
        return True

    stopwords = _get_stopwords(lang)
    normalized = [normalize_keyword(t) for t in tokens if t.strip()]
    normalized = [t for t in normalized if t]

    if not normalized:
        return True

    if all(t.isdigit() for t in normalized):
        return True

    meaningful = 0
    for t, raw in zip(normalized, tokens):
        if t in stopwords:
            continue
        if len(t) >= 4 or _is_acronym(raw):
            meaningful += 1

    return meaningful == 0

def _valid_keyword_phrase(phrase: str, lang: str) -> bool:
    p = (phrase or "").strip()
    if not p:
        return False

    if re.fullmatch(r"\d+", p):
        return False

    parts = [x for x in re.split(r"\s+", p) if x]
    if not parts:
        return False

    if _is_bad_phrase_tokens(parts, lang):
        return False

    # reject phrases that are only stopwords
    norm_parts = [normalize_keyword(x) for x in parts]
    stopwords = _get_stopwords(lang)
    if all(x in stopwords for x in norm_parts if x):
        return False

    return True

def keyword_weight(keyword: str, score: float) -> int:
    words = len([w for w in keyword.split() if w])
    boost = 0
    if words == 2:
        boost += 3
    elif words == 3:
        boost += 5
    elif words >= 4:
        boost += 4

    return min(999, max(1, int(round(score * 10)) + boost))

def _detect_language(text: str) -> str:
    sample = (text or "")[:4000]
    if not sample.strip():
        return "unknown"

    if ARABIC_RE.search(sample):
        return "ar"

    try:
        from langdetect import detect
        lang = detect(sample)
        if lang.startswith("fr"):
            return "fr"
        if lang.startswith("en"):
            return "en"
        if lang.startswith("ar"):
            return "ar"
        return lang
    except Exception:
        return "unknown"

def _clean_text(text: str) -> str:
    text = MULTISPACE_RE.sub(" ", text or "").strip()
    try:
        max_chars = int(os.environ.get("LIBRARY_INDEXER_MAX_CHARS", "80000"))
    except Exception:
        max_chars = 80000

    if max_chars > 1000 and len(text) > max_chars:
        head_n = int(max_chars * 0.7)
        tail_n = max_chars - head_n
        text = (text[:head_n] + " " + text[-tail_n:]).strip()

    return text

def _generate_candidate_phrases(text: str, lang: str, ngram_min: int = 1, ngram_max: int = 4) -> Counter:
    stopwords = _get_stopwords(lang)
    candidates = Counter()

    for sentence in SENTENCE_SPLIT_RE.split(text):
        tokens = _tokenize(sentence)
        if not tokens:
            continue

        norm_tokens = [normalize_keyword(t) for t in tokens]

        for n in range(ngram_min, ngram_max + 1):
            for i in range(len(tokens) - n + 1):
                raw_ngram = tokens[i:i+n]
                norm_ngram = norm_tokens[i:i+n]

                if any(not t for t in norm_ngram):
                    continue

                if all(t in stopwords for t in norm_ngram):
                    continue

                phrase_raw = " ".join(raw_ngram).strip()
                phrase_norm = " ".join(norm_ngram).strip()

                if not _valid_keyword_phrase(phrase_raw, lang):
                    continue

                score = 1.0

                # reward repetition
                score += 1.0

                # reward multiword phrases
                if n == 2:
                    score += 1.5
                elif n == 3:
                    score += 2.2
                elif n == 4:
                    score += 2.0

                # reward acronym-containing phrases
                if any(_is_acronym(t) for t in raw_ngram):
                    score += 1.5

                # slight penalty if starts/ends with stopword
                if norm_ngram[0] in stopwords:
                    score -= 0.8
                if norm_ngram[-1] in stopwords:
                    score -= 0.8

                if score > 0:
                    candidates[(phrase_raw, phrase_norm)] += score

    return candidates

def _extract_keywords_once(text: str, lang: str, top_n: int) -> list[dict]:
    candidates = _generate_candidate_phrases(text, lang, 1, 4)

    merged = {}
    for (raw_phrase, norm_phrase), score in candidates.items():
        if not norm_phrase:
            continue

        formatted = format_keyword(raw_phrase)
        weight = keyword_weight(formatted, score)

        prev = merged.get(norm_phrase)
        if prev is None:
            merged[norm_phrase] = {
                "keyword": formatted,
                "keyword_normalized": norm_phrase,
                "weight": weight,
            }
        else:
            prev["weight"] = max(prev["weight"], weight)
            if len(formatted) > len(prev["keyword"]):
                prev["keyword"] = formatted

    out = list(merged.values())
    out.sort(key=lambda x: (-int(x["weight"]), len(x["keyword"])))
    return out[:top_n]

def _extract_keywords(text: str, lang: str, top_n: int) -> list[dict]:
    text = (text or "").strip()
    if not text:
        return []

    try:
        split_chars = int(os.environ.get("LIBRARY_INDEXER_SPLIT_CHARS", "60000"))
    except Exception:
        split_chars = 60000

    if len(text) <= split_chars:
        return _extract_keywords_once(text, lang, top_n)

    mid = len(text) // 2
    chunks = [text[:mid], text[mid:]]
    per_chunk = max(top_n * 2, 20)

    try:
        with ThreadPoolExecutor(max_workers=2) as ex:
            results = list(ex.map(lambda c: _extract_keywords_once(c, lang, per_chunk), chunks))
    except Exception:
        results = [_extract_keywords_once(c, lang, per_chunk) for c in chunks]

    merged = {}
    for block in results:
        for item in block:
            norm = item["keyword_normalized"]
            if norm not in merged:
                merged[norm] = item.copy()
            else:
                merged[norm]["weight"] = min(999, merged[norm]["weight"] + item["weight"])
                if len(item["keyword"]) > len(merged[norm]["keyword"]):
                    merged[norm]["keyword"] = item["keyword"]

    out = list(merged.values())
    out.sort(key=lambda x: (-int(x["weight"]), len(x["keyword"])))
    return out[:top_n]