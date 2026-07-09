import json
import re

TOPIC_TAXONOMY = [
    {
        "id": "toeic",
        "scopeTerms": ["TOEIC", "thi TOEIC", "đăng ký TOEIC"]
    },
    {
        "id": "mos",
        "scopeTerms": ["MOS", "Microsoft Office Specialist"]
    },
    {
        "id": "sat_hach_cntt",
        "scopeTerms": ["Sát hạch CNTT", "Sát hạch Công nghệ thông tin", "thi CNTT", "thi Công nghệ thông tin", "đăng ký thi CNTT", "đăng ký sát hạch CNTT", "lịch thi CNTT", "ngày thi CNTT", "ca thi CNTT", "lệ phí thi CNTT", "phí thi CNTT", "điểm thi CNTT", "kết quả thi CNTT", "xem điểm CNTT", "chứng chỉ CNTT", "nhận chứng chỉ CNTT", "cấp chứng chỉ CNTT", "CNTT cơ bản", "CNTT nâng cao", "Tin học cơ bản", "Tin học nâng cao", "Tin cơ bản", "Tin nâng cao", "THCB", "THNC", "IC3"]
    },
    {
        "id": "hoc_tieng_anh",
        "scopeTerms": ["Học Tiếng Anh", "Tiếng Anh", "Anh văn"]
    },
    {
        "id": "hoc_tin_hoc",
        "scopeTerms": ["Học Tin học", "khóa tin học", "lớp tin học", "học tin học"]
    }
]

def normalizeTopicText(value):
    import unicodedata
    s = unicodedata.normalize('NFD', value)
    s = re.sub(r'[\u0300-\u036f]', '', s)
    s = s.replace('đ', 'd').replace('Đ', 'D').lower()
    return re.sub(r'\s+', ' ', s).strip()

def hasCodeToken(text, code):
    pattern = r"(^|[^a-z0-9_])" + re.escape(code) + r"($|[^a-z0-9_])"
    return re.search(pattern, text) is not None

def matchesScopeTerms(text, topicId):
    topic = next((t for t in TOPIC_TAXONOMY if t['id'] == topicId), None)
    if not topic: return False
    
    for term in topic['scopeTerms']:
        normalizedTerm = normalizeTopicText(term)
        if not normalizedTerm or normalizedTerm == 'khac': continue
        if re.match(r'^[a-z0-9]+$', normalizedTerm) and len(normalizedTerm) <= 10:
            if hasCodeToken(text, normalizedTerm): return True
        else:
            if normalizedTerm in text: return True
    return False

def mapTopicToGroupId(value):
    if any(t['id'] == value for t in TOPIC_TAXONOMY): return value
    normalized = normalizeTopicText(value)
    if not normalized or normalized == 'tat ca': return None
    if any(t['id'] == normalized for t in TOPIC_TAXONOMY): return normalized
    
    legacyExact = {
        "tin hoc": "hoc_tin_hoc",
        "tin hoc / mos / ic3": "mos",
        "chuan dau ra": "hoc_tieng_anh",
        "chuan dau ra / chung chi": "hoc_tieng_anh",
        "chuan dau ra ngoai ngu": "hoc_tieng_anh",
        "other": "khac",
        "unknown": "khac",
        "none": "khac",
    }
    if normalized in legacyExact: return legacyExact[normalized]
    
    if matchesScopeTerms(normalized, "toeic"): return "toeic"
    if matchesScopeTerms(normalized, "mos"): return "mos"
    if matchesScopeTerms(normalized, "sat_hach_cntt"): return "sat_hach_cntt"
    if matchesScopeTerms(normalized, "hoc_tieng_anh"): return "hoc_tieng_anh"
    if matchesScopeTerms(normalized, "hoc_tin_hoc"): return "hoc_tin_hoc"
    
    return "khac"

print(mapTopicToGroupId('["Học Tin học"]'))
print(mapTopicToGroupId('["Sát hạch CNTT", "Học Tin học"]'))
