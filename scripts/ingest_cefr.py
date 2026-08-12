import csv
import json
import os
import re
import urllib.request
import zipfile

CEFRJ_URL = "https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/master/cefrj-vocabulary-profile-1.5.csv"
OCTANOVE_URL = "https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/master/octanove-vocabulary-profile-c1c2-1.0.csv"
OXFORD_URL = "https://raw.githubusercontent.com/winterdl/oxford-5000-vocabulary-audio-definition/master/data/oxford_5000.json"
WORDNET_CEFR_URL = "https://huggingface.co/datasets/star092304/CEFR-Annotated-WordNet/raw/main/cefr-level_annotation/wordnet_sensekey_cefr.tsv"

OUTPUT_JS = os.path.join("data", "cefr_lexicon.js")

def normalize_cefr(raw_level):
    if not raw_level:
        return None
    raw = raw_level.strip().upper()
    if raw.startswith("A1"): return "A1"
    if raw.startswith("A2"): return "A2"
    if raw.startswith("B1"): return "B1"
    if raw.startswith("B2"): return "B2"
    if raw.startswith("C1"): return "C1"
    if raw.startswith("C2"): return "C2"
    return None

def fetch_and_parse():
    print(f"Downloading CEFR-J (A1-B2) from {CEFRJ_URL}...")
    req1 = urllib.request.urlopen(CEFRJ_URL)
    lines1 = [line.decode("utf-8", errors="ignore") for line in req1.readlines()]
    reader1 = csv.DictReader(lines1)

    words = {}
    count_cefrj = 0
    for row in reader1:
        hw = row.get("headword", "").strip().lower()
        pos = row.get("pos", "").strip().lower()
        level = normalize_cefr(row.get("CEFR", ""))
        if hw and level and not hw.startswith("#"):
            variants = [v.strip().lower() for v in hw.split('/') if v.strip()]
            for v in variants:
                if v and not v.startswith("#") and v not in words:
                    words[v] = {"lemma": v, "pos": pos, "cefr": level}
                    count_cefrj += 1

    print(f"Loaded {count_cefrj} headwords from CEFR-J.")

    print(f"Downloading Octanove (C1-C2) from {OCTANOVE_URL}...")
    req2 = urllib.request.urlopen(OCTANOVE_URL)
    lines2 = [line.decode("utf-8", errors="ignore") for line in req2.readlines()]
    reader2 = csv.DictReader(lines2)

    count_octanove = 0
    for row in reader2:
        hw = row.get("headword", "").strip().lower()
        pos = row.get("pos", "").strip().lower()
        level = normalize_cefr(row.get("CEFR", ""))
        if hw and level and not hw.startswith("#"):
            variants = [v.strip().lower() for v in hw.split('/') if v.strip()]
            for v in variants:
                if v and not v.startswith("#") and v not in words:
                    words[v] = {"lemma": v, "pos": pos, "cefr": level}
                    count_octanove += 1

    print(f"Loaded {count_octanove} advanced headwords from Octanove.")
    return words

STOPWORDS = {
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
    'as', 'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'it', 'its', 'they', 'them', 'their', 'we', 'our', 'us', 'you', 'your', 'he', 'him', 'his', 'she',
    'her', 'that', 'this', 'these', 'those', 'which', 'who', 'whom', 'whose', 'what', 'where', 'when',
    'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
    'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should',
    'now', 'somebody', 'something', 'someone', 'used', 'make', 'made', 'etc'
}

def fetch_oxford_polysemy():
    print(f"Downloading Oxford 5000 Graded Corpus from {OXFORD_URL}...")
    req = urllib.request.Request(OXFORD_URL, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        raw = json.loads(urllib.request.urlopen(req).read().decode('utf-8'))
    except Exception as e:
        print(f"Warning: Oxford 5000 download failed: {e}")
        return {}

    words_map = {}
    for entry in raw.values():
        w = entry.get('word', '').strip().lower()
        cefr = entry.get('cefr', '').strip().upper()
        defn = entry.get('definition', '').strip()
        ex = entry.get('example', '').strip()
        pos = entry.get('type', '').strip()
        if not w or not cefr or len(w) <= 2 or '/' in w:
            continue
        level = normalize_cefr(cefr)
        if not level:
            continue
        words_map.setdefault(w, []).append({
            'pos': pos,
            'cefr': level,
            'definition': defn,
            'example': ex
        })

    poly_dict = {}
    for w, entries in words_map.items():
        distinct_levels = set(e['cefr'] for e in entries)
        if len(distinct_levels) > 1:
            senses = []
            for idx, e in enumerate(entries):
                raw_text = (e['definition'] + ' ' + e['example']).lower()
                tokens = re.findall(r'[a-z]{3,}', raw_text)
                kw = [t for t in tokens if t not in STOPWORDS and t != w][:15]
                first_words = [t.upper() for t in re.findall(r'[a-z]{3,}', e['definition'].lower()) if t not in STOPWORDS][:3]
                gw_desc = ' '.join(first_words) if first_words else 'GENERAL'
                guideword = f"{e['pos'].upper()} / {gw_desc}"
                senses.append({
                    'id': f"{w}_{e['cefr'].lower()}_{idx+1}",
                    'guideword': guideword,
                    'pos': e['pos'].lower(),
                    'definition': e['definition'],
                    'cefr': e['cefr'],
                    'keywords': kw
                })
            poly_dict[w] = {
                'lemma': w,
                'pos': '/'.join(sorted(set(e['pos'] for e in entries))),
                'hasDiscrepancy': True,
                'senses': senses
            }

    print(f"Extracted {len(poly_dict)} polysemous multi-tier words from Oxford 5000.")
    return poly_dict

def fetch_wordnet_polysemy():
    print(f"Downloading CEFR-Annotated WordNet from {WORDNET_CEFR_URL}...")
    try:
        from nltk.corpus import wordnet as wn
    except Exception as e:
        print(f"Warning: NLTK WordNet not available: {e}")
        return {}

    req = urllib.request.Request(WORDNET_CEFR_URL, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        lines = urllib.request.urlopen(req).read().decode('utf-8').strip().split('\n')
    except Exception as e:
        print(f"Warning: Failed downloading CEFR WordNet: {e}")
        return {}

    pos_map = {'n': 'noun', 'v': 'verb', 'a': 'adjective', 's': 'adjective', 'r': 'adverb'}
    words_map = {}

    for l in lines:
        parts = l.strip().split('\t')
        if len(parts) == 2:
            sk, cefr = parts
            lemma = sk.split('%')[0].lower()
            if len(lemma) <= 2 or '_' in lemma:
                continue
            norm_cefr = normalize_cefr(cefr)
            if not norm_cefr:
                continue
            try:
                syn = wn.synset_from_sense_key(sk)
                words_map.setdefault(lemma, []).append({
                    'sensekey': sk,
                    'cefr': norm_cefr,
                    'pos': pos_map.get(syn.pos(), syn.pos()),
                    'definition': syn.definition(),
                    'examples': syn.examples()
                })
            except Exception:
                pass

    poly_dict = {}
    for w, entries in words_map.items():
        distinct_levels = set(e['cefr'] for e in entries)
        if len(distinct_levels) > 1:
            senses = []
            for idx, e in enumerate(entries):
                raw_text = (e['definition'] + ' ' + ' '.join(e['examples'])).lower()
                tokens = re.findall(r'[a-z]{3,}', raw_text)
                kw = [t for t in tokens if t not in STOPWORDS and t != w][:15]
                first_words = [t.upper() for t in re.findall(r'[a-z]{3,}', e['definition'].lower()) if t not in STOPWORDS][:3]
                gw_desc = ' '.join(first_words) if first_words else 'GENERAL'
                guideword = f"{e['pos'].upper()} / {gw_desc}"
                senses.append({
                    'id': f"{w}_{e['cefr'].lower()}_wn{idx+1}",
                    'guideword': guideword,
                    'pos': e['pos'],
                    'definition': e['definition'],
                    'cefr': e['cefr'],
                    'keywords': kw
                })
            poly_dict[w] = {
                'lemma': w,
                'pos': '/'.join(sorted(set(e['pos'] for e in entries))),
                'hasDiscrepancy': True,
                'senses': senses
            }

    print(f"Extracted {len(poly_dict)} polysemous multi-tier words from CEFR-WordNet.")
    return poly_dict

def fetch_wordnet_irregulars():
    irregulars = {}
    zip_paths = [
        os.path.expanduser("~/nltk_data/corpora/wordnet.zip"),
        os.path.expanduser(r"~\AppData\Roaming\nltk_data\corpora\wordnet.zip"),
        "/usr/share/nltk_data/corpora/wordnet.zip",
        "/usr/local/share/nltk_data/corpora/wordnet.zip"
    ]
    try:
        import nltk
        try:
            wn_found = str(nltk.data.find('corpora/wordnet.zip'))
            if wn_found:
                zip_paths.insert(0, wn_found)
        except Exception:
            pass
    except ImportError:
        pass

    zip_path = next((p for p in zip_paths if os.path.exists(p)), None)
    if zip_path and os.path.exists(zip_path):
        try:
            with zipfile.ZipFile(zip_path, 'r') as z:
                for ef in ['wordnet/noun.exc', 'wordnet/verb.exc', 'wordnet/adj.exc', 'wordnet/adv.exc']:
                    try:
                        with z.open(ef) as f:
                            for line in f.read().decode('utf-8', errors='ignore').splitlines():
                                parts = line.strip().split()
                                if len(parts) >= 2:
                                    inflected = parts[0].lower()
                                    base = parts[1].lower()
                                    irregulars[inflected] = base
                    except Exception:
                        pass
        except Exception as e:
            print(f"Warning: Failed reading WordNet irregulars: {e}")
    print(f"Loaded {len(irregulars)} irregular inflections from WordNet.")
    return irregulars

# curated multi-sense definitions spanning different levels
CURATED_POLYSEMOUS_SENSES = {
    "party": {
        "lemma": "party", "pos": "noun", "hasDiscrepancy": True,
        "senses": [
            {"id": "party_a1", "guideword": "CELEBRATION / SOCIAL", "definition": "A social gathering of guests for celebration, entertainment, dinner, or conversation.", "cefr": "A1", "keywords": ["birthday", "celebration", "fun", "music", "dance", "friends", "night", "drink", "food", "guests", "dinner", "annual", "hosted", "held"]},
            {"id": "party_b1", "guideword": "POLITICAL GROUP", "definition": "An organized group of people with shared political beliefs who contest elections.", "cefr": "B1", "keywords": ["political", "election", "vote", "government", "parliament", "leader", "campaign", "policy", "candidate", "opposition", "coalition", "ruling"]},
            {"id": "party_c1", "guideword": "LEGAL / CONTRACTUAL ENTITY", "definition": "One of the persons, groups, or entities formally involved in a legal dispute, contract, or treaty.", "cefr": "C1", "keywords": ["contract", "agreement", "legal", "lawyer", "dispute", "liable", "signed", "terms", "clause", "treaty", "arbitration", "contracting"]}
        ]
    },
    "bank": {
        "lemma": "bank", "pos": "noun", "hasDiscrepancy": True,
        "senses": [
            {"id": "bank_a1", "guideword": "FINANCIAL INSTITUTION", "definition": "An organization or building where people deposit, withdraw, or borrow money.", "cefr": "A1", "keywords": ["money", "account", "cash", "deposit", "finance", "loan", "card", "atm", "branch", "savings", "central", "commercial", "directors", "teller", "closed", "open", "hours", "sunday", "sundays", "paycheck", "borrow", "borrowed", "invest", "financial", "lending"]},
            {"id": "bank_b1", "guideword": "RIVERBANK / SLOPE", "definition": "The raised ground bordering a river, canal, or lake; a steep mound of earth.", "cefr": "B1", "keywords": ["river", "water", "canal", "lake", "grass", "grassy", "mud", "shore", "steep", "trees", "stream", "collapse", "collapsed", "fish", "fishing", "earth", "slope"]},
            {"id": "bank_b2", "guideword": "STORE / REPOSITORY", "definition": "A collection or repository of something saved for later use (e.g., blood bank, data bank).", "cefr": "B2", "keywords": ["blood", "data", "repository", "storage", "supply", "donor", "memory", "reserve", "archive", "classified", "seed", "seeds", "store", "stored", "plant", "planting", "farmer", "specimen", "sample", "vault"]},
            {"id": "bank_c1", "guideword": "AVIATION / TILT", "definition": "The tilting or sideways rolling motion of an aircraft or vehicle when turning.", "cefr": "C1", "keywords": ["aircraft", "plane", "airplane", "tilt", "turn", "turned", "flight", "pilot", "steep", "aviation", "maneuver", "car", "vehicle", "race", "driver", "curve", "curved", "rounded", "track", "road", "incline", "angle"]}
        ]
    },
    "record": {
        "lemma": "record", "pos": "noun/verb", "hasDiscrepancy": True,
        "senses": [
            {"id": "record_a1", "guideword": "MUSIC ALBUM / DISC", "definition": "A flat circular plastic disc on which music or sound is pressed and played.", "cefr": "A1", "keywords": ["vinyl", "music", "song", "album", "player", "disc", "jazz", "band"]},
            {"id": "record_a2", "guideword": "SPORTS ACHIEVEMENT", "definition": "The best, fastest, or highest official performance ever achieved in a competition.", "cefr": "A2", "keywords": ["world", "olympic", "broke", "held", "fastest", "swimming", "sport", "champion", "race"]},
            {"id": "record_b1", "guideword": "REGISTER / STORE DATA", "definition": "To store sounds, images, flight logs, or written notes in permanent format for future reference.", "cefr": "B1", "keywords": ["video", "camera", "expenses", "document", "notes", "write", "audio", "store", "file", "archive", "classified", "flight", "log"]},
            {"id": "record_c1", "guideword": "OFFICIAL / CRIMINAL DOSSIER", "definition": "A formal history of a person's conduct, convictions, or corporate history.", "cefr": "C1", "keywords": ["criminal", "conviction", "police", "track", "employment", "unblemished", "history", "conduct", "litigation"]}
        ]
    },
    "interest": {
        "lemma": "interest", "pos": "noun", "hasDiscrepancy": True,
        "senses": [
            {"id": "interest_a1", "guideword": "HOBBY / CURIOSITY", "definition": "The feeling of wanting to know, learn, or be involved in something; personal curiosity.", "cefr": "A1", "keywords": ["curiosity", "hobby", "like", "learn", "passion", "fascinated", "reading", "enjoy", "personal", "express", "expressed", "keen", "photography", "languages", "subject", "enthusiasm"]},
            {"id": "interest_b1", "guideword": "FINANCIAL RATE", "definition": "The extra money that you must pay when borrowing money, or receive on savings.", "cefr": "B1", "keywords": ["rate", "percentage", "loan", "debt", "bank", "mortgage", "credit", "annual", "borrow", "capital"]},
            {"id": "interest_b2", "guideword": "STAKE / BENEFIT", "definition": "A financial share, equity, or commercial stake in a company or venture.", "cefr": "B2", "keywords": ["stake", "share", "benefit", "venture", "controlling", "equity", "company", "startup", "firm", "advantage"]},
            {"id": "interest_c1", "guideword": "CONFLICT OF INTEREST / LEGAL CLAIM", "definition": "A legal title, right, or equitable claim in real estate or corporate governance.", "cefr": "C1", "keywords": ["conflict", "ethics", "board", "governance", "legal", "estate", "disclosed", "fiduciary", "corporate"]}
        ]
    },
    "treat": {
        "lemma": "treat", "pos": "verb/noun", "hasDiscrepancy": True,
        "senses": [
            {"id": "treat_a2", "guideword": "BEHAVE TOWARDS", "definition": "To act, behave towards, deal with, or regard someone or something in a specific manner.", "cefr": "A2", "keywords": ["respect", "kindness", "people", "unfairly", "badly", "nicely", "dignity", "behave", "citizens", "employee", "wellbeing", "priority", "regard", "consider"]},
            {"id": "treat_b1", "guideword": "MEDICAL THERAPY", "definition": "To provide medical care to cure a disease, infection, or heal an injury.", "cefr": "B1", "keywords": ["patient", "doctor", "hospital", "medicine", "disease", "cure", "antibiotics", "illness", "injury", "epidemic", "field"]},
            {"id": "treat_b2", "guideword": "SPECIAL PLEASURE / GIFT", "definition": "A special food, gift, or enjoyable event that is an unexpected luxury.", "cefr": "B2", "keywords": ["chocolate", "delicious", "gift", "special", "reward", "luxury", "dessert", "ice cream", "gelato"]},
            {"id": "treat_c1", "guideword": "DISCOURSE / ANALYZE RIGOROUSLY", "definition": "To deal with, consider, or analyze a subject critically or systematically in writing.", "cefr": "C1", "keywords": ["monograph", "philosophy", "analysis", "discourse", "epistemic", "subject", "chapter", "critique", "rigorous", "author"]}
        ]
    },
    "plant": {
        "lemma": "plant", "pos": "noun/verb", "hasDiscrepancy": True,
        "senses": [
            {"id": "plant_a1", "guideword": "LIVING ORGANISM / FLORA", "definition": "A living thing that grows in earth, in water, or on other plants, usually has a stem, leaves, roots, and flowers, and produces seeds.", "cefr": "A1", "keywords": ["flower", "tree", "garden", "green", "soil", "grow", "leaves", "water", "seed", "roots"]},
            {"id": "plant_b1", "guideword": "FACTORY / INDUSTRIAL FACILITY", "definition": "A building or factory where an industrial process happens or where that process is controlled.", "cefr": "B1", "keywords": ["factory", "industrial", "power", "manufacturing", "chemical", "nuclear", "workers", "facility", "production"]},
            {"id": "plant_b2", "guideword": "SOW IN GROUND (VERB)", "definition": "To put a seed, bulb, or plant into the ground so that it will grow.", "cefr": "B2", "keywords": ["sow", "gardening", "spring", "ground", "farmer", "vegetables", "seeds", "pot"]},
            {"id": "plant_c1", "guideword": "CONCEAL / COVERT AGENT", "definition": "To hide something secretly or put a person into a group as a spy or informant.", "cefr": "C1", "keywords": ["spy", "informant", "police", "evidence", "bomb", "covert", "hidden", "secretly"]}
        ]
    },
    "book": {
        "lemma": "book", "pos": "noun/verb", "hasDiscrepancy": True,
        "senses": [
            {"id": "book_a1", "guideword": "READING VOLUME", "definition": "A written text that can be published in printed or electronic form.", "cefr": "A1", "keywords": ["read", "author", "pages", "novel", "library", "chapter", "cover", "paper"]},
            {"id": "book_a2", "guideword": "RESERVE IN ADVANCE (VERB)", "definition": "To arrange to have a seat, room, entertainer, etc. at a particular time in the future.", "cefr": "A2", "keywords": ["hotel", "flight", "ticket", "table", "advance", "reservation", "seat", "holiday"]},
            {"id": "book_b2", "guideword": "CHARGE WITH CRIME (VERB)", "definition": "If the police book someone, they make an official record of the charge against them.", "cefr": "B2", "keywords": ["police", "charged", "station", "suspect", "arrested", "offence", "referee"]}
        ]
    },
    "train": {
        "lemma": "train", "pos": "noun/verb", "hasDiscrepancy": True,
        "senses": [
            {"id": "train_a1", "guideword": "RAIL VEHICLE", "definition": "A railway engine connected to carriages for carrying people or goods.", "cefr": "A1", "keywords": ["railway", "station", "track", "commute", "carriages", "ticket", "passengers", "express"]},
            {"id": "train_a2", "guideword": "PRACTICE / INSTRUCT (VERB)", "definition": "To prepare someone or yourself for a job, activity, or sport by learning skills.", "cefr": "A2", "keywords": ["coach", "practice", "skills", "gym", "athlete", "exercise", "hard", "prepare"]},
            {"id": "train_b2", "guideword": "CHAIN / SUCCESSION", "definition": "A series of connected events, thoughts, or people moving along.", "cefr": "B2", "keywords": ["thought", "events", "succession", "consequences", "procession"]}
        ]
    },
    "run": {
        "lemma": "run", "pos": "verb/noun", "hasDiscrepancy": True,
        "senses": [
            {
                "id": "run_a1_locomotion",
                "guideword": "PHYSICAL LOCOMOTION / JOG / SPRINT",
                "pos": "verb",
                "definition": "To move quickly using your legs, going faster than a walk.",
                "cefr": "A1",
                "keywords": ["fast", "jog", "sprint", "legs", "feet", "marathon", "race", "park", "morning", "healthy", "exercise", "athlete", "running shoes", "track"]
            },
            {
                "id": "run_a2_flow",
                "guideword": "FLOW OF LIQUID",
                "pos": "verb",
                "definition": "To flow as a liquid, stream, or fluid from a tap, pipe, or container.",
                "cefr": "A2",
                "keywords": ["water", "tap", "liquid", "bucket", "tears", "river", "pipe", "sink", "wash", "flowing", "turn on", "pour"]
            },
            {
                "id": "run_b1_transport",
                "guideword": "TRANSPORT SERVICE / ROUTE",
                "pos": "verb",
                "definition": "To travel or operate on a regular schedule or route (buses, trains, ferries).",
                "cefr": "B1",
                "keywords": ["train", "bus", "ferry", "service", "schedule", "station", "route", "track", "mountains", "arrives", "on time", "travel", "city"]
            },
            {
                "id": "run_b2_manage",
                "guideword": "MANAGE / OPERATE BUSINESS",
                "pos": "verb",
                "definition": "To manage, operate, direct, or be in charge of an organization, company, or business.",
                "cefr": "B2",
                "keywords": ["business", "company", "restaurant", "shop", "manage", "staff", "customers", "own", "uncle", "office", "executive", "store", "organization", "hotel"]
            }
        ]
    },
    "watch": {
        "lemma": "watch", "pos": "noun/verb", "hasDiscrepancy": True,
        "senses": [
            {
                "id": "watch_a1_noun",
                "guideword": "WRISTWATCH / TIMEPIECE",
                "pos": "noun",
                "definition": "A small clock worn on the wrist or carried in a pocket to tell time.",
                "cefr": "A1",
                "keywords": ["wrist", "wristband", "clock", "time", "strap", "pocket", "tick", "hours", "minutes", "hands", "dial", "quartz", "check the time", "my watch"]
            },
            {
                "id": "watch_a1_verb",
                "guideword": "OBSERVE / LOOK AT WITH EYES",
                "pos": "verb",
                "definition": "To look at someone or something for a period of time and pay close attention to what is happening.",
                "cefr": "A1",
                "keywords": ["see", "look", "eyes", "birds", "flying", "movie", "television", "tv", "match", "game", "journey", "window", "fields", "sky"]
            },
            {
                "id": "watch_b2_noun",
                "guideword": "LOOKOUT / SURVEILLANCE / VIGIL",
                "pos": "noun",
                "definition": "A period of keeping guard, staying awake at night, or maintaining vigilance for danger (especially 'keep watch').",
                "cefr": "B2",
                "keywords": ["keep", "guard", "danger", "sailors", "night", "lookout", "vigil", "patrol", "sentinel", "threat", "warning", "horizon", "duty", "station", "ancient", "crew", "sea", "attack", "enemy"]
            },
            {
                "id": "watch_b2_phrasal",
                "guideword": "GUARD / SUPERVISE / PROTECT",
                "pos": "verb",
                "definition": "To guard, supervise, take care of, or protect someone or something (especially 'watch over').",
                "cefr": "B2",
                "keywords": ["over", "guard", "protect", "care", "supervise", "safety", "safe", "house", "children", "property", "secure", "flock", "shepherd", "neighbours", "away", "father", "decided", "safety", "threat"]
            }
        ]
    },
    "look": {
        "lemma": "look", "pos": "verb/noun", "hasDiscrepancy": True,
        "senses": [
            {
                "id": "look_a1_direct",
                "guideword": "DIRECT EYES / LOOK AT",
                "pos": "verb",
                "definition": "To turn your eyes in a particular direction to see or inspect someone or something (e.g., 'look at').",
                "cefr": "A1",
                "keywords": ["at", "eyes", "see", "watch", "board", "mirror", "window", "picture", "screen", "direction", "closely", "turned", "face", "time"]
            },
            {
                "id": "look_a2_search",
                "guideword": "SEARCH / LOOK FOR / IN PLACES",
                "pos": "verb",
                "definition": "To try to find someone or something that is lost, needed, or sought (e.g., 'look for', 'look in different places').",
                "cefr": "A2",
                "keywords": ["for", "search", "find", "lost", "missing", "dog", "keys", "wallet", "phone", "job", "everywhere", "seeking", "looking for", "pet", "in", "places", "different", "nearby", "around", "calling", "house", "garden"]
            },
            {
                "id": "look_a2_care",
                "guideword": "TAKE CARE / LOOK AFTER",
                "pos": "verb",
                "definition": "To take care of or be responsible for someone or something (e.g., 'look after').",
                "cefr": "A2",
                "keywords": ["after", "care", "baby", "children", "pet", "dog", "elderly", "sick", "take care"]
            },
            {
                "id": "look_a2_noun",
                "guideword": "GLANCE / INSPECTION (NOUN)",
                "pos": "noun",
                "definition": "An act of looking at something or someone; a quick glance or inspection (e.g., 'have a look', 'take a look').",
                "cefr": "A2",
                "keywords": ["take", "have", "good", "quick", "closer", "glance", "inspection"]
            },
            {
                "id": "look_b2_investigate",
                "guideword": "INVESTIGATE / LOOK INTO",
                "pos": "verb",
                "definition": "To examine, investigate, or research the facts about a problem or situation (e.g., 'look into').",
                "cefr": "B2",
                "keywords": ["into", "investigate", "police", "matter", "complaint", "allegations", "problem", "incident", "committee", "inquiry"]
            }
        ]
    },
    "figure": {
        "lemma": "figure", "pos": "verb/noun", "hasDiscrepancy": True,
        "senses": [
            {
                "id": "figure_a2_num",
                "guideword": "NUMBER / STATISTIC / AMOUNT",
                "pos": "noun",
                "definition": "A number representing a particular amount, especially in official information, statistics, or finance.",
                "cefr": "A2",
                "keywords": ["number", "amount", "sales", "official", "statistics", "inflation", "unemployment", "double", "digits", "calculate", "data", "economic", "total"]
            },
            {
                "id": "figure_b1_phrasal",
                "guideword": "FIGURE OUT / SOLVE / UNDERSTAND",
                "pos": "verb",
                "definition": "To understand, solve, calculate, or find the answer to something (especially 'figure out').",
                "cefr": "B1",
                "keywords": ["out", "understand", "solve", "how", "why", "where", "what", "answer", "reason", "puzzle", "trying", "manage", "solution", "calculating", "find", "gone", "happened"]
            },
            {
                "id": "figure_b1_shape",
                "guideword": "BODY SHAPE / PERSON / PUBLIC FIGURE",
                "pos": "noun",
                "definition": "The shape of the human body; or a prominent or well-known public person.",
                "cefr": "B1",
                "keywords": ["body", "shape", "tall", "slim", "person", "prominent", "political", "public", "historical", "leading"]
            },
            {
                "id": "figure_b2_part",
                "guideword": "FEATURE / PLAY ROLE IN PROCESS",
                "pos": "verb",
                "definition": "To be part of a process, situation, or discussion; to feature prominently.",
                "cefr": "B2",
                "keywords": ["part", "process", "situation", "prominently", "role", "debate", "factor", "scandal", "inquiry"]
            }
        ]
    },
    "light": {
        "lemma": "light", "pos": "noun/verb/adjective", "hasDiscrepancy": True,
        "senses": [
            {
                "id": "light_a1_sun",
                "guideword": "NATURAL LIGHT / ENERGY / SUN / LAMP",
                "pos": "noun",
                "definition": "The energy from the sun, a lamp, etc. that allows things to be seen.",
                "cefr": "A1",
                "keywords": ["sun", "sunlight", "shine", "daylight", "window", "bright", "room", "beam", "glow", "lamp", "dark", "darkness", "see", "shadow"]
            },
            {
                "id": "light_a1_pale",
                "guideword": "PALE COLOUR / NOT DARK",
                "pos": "adjective",
                "definition": "Pale in colour or not having a dark shade (e.g., 'light blue', 'light brown').",
                "cefr": "A1",
                "keywords": ["blue", "green", "brown", "grey", "color", "colour", "pale", "shade", "hair", "skin", "blond", "light-colored"]
            },
            {
                "id": "light_a1_weight",
                "guideword": "NOT HEAVY / LIGHTWEIGHT",
                "pos": "adjective",
                "definition": "Not heavy; of little weight or easy to lift and carry.",
                "cefr": "A1",
                "keywords": ["heavy", "weigh", "weight", "bag", "box", "suitcase", "feather", "load", "pack", "lightweight", "carry", "lift"]
            },
            {
                "id": "light_a2_burn",
                "guideword": "IGNITE / START BURNING / FIRE",
                "pos": "verb",
                "definition": "To ignite, start a flame, burn, or illuminate with fire (e.g., 'light a candle', 'light a fire').",
                "cefr": "A2",
                "keywords": ["candle", "fire", "match", "flame", "cigarette", "ignite", "stove", "smoke", "kindle", "torch", "burn", "bonfire"]
            },
            {
                "id": "light_b1_lamp",
                "guideword": "ELECTRIC LAMP / TRAFFIC LIGHT / DEVICE",
                "pos": "noun",
                "definition": "An electric light bulb, lamp, street lamp, or traffic lights.",
                "cefr": "B1",
                "keywords": ["traffic", "turn on", "switch", "lamp", "bulb", "street", "red", "green", "ceiling", "desk", "switch on", "switch off"]
            },
            {
                "id": "light_b1_gentle",
                "guideword": "GENTLE / DELICATE / SOFT TOUCH",
                "pos": "adjective",
                "definition": "Gentle, delicate, subtle, or slight in pressure, touch, breeze, or rainfall.",
                "cefr": "B1",
                "keywords": ["touch", "delicate", "gentle", "breeze", "rain", "tap", "pressure", "soft", "artist", "stroke", "painting", "brush", "brushstroke", "subtle"]
            },
            {
                "id": "light_b2_tunnel",
                "guideword": "SIGN OF HOPE / LIGHT AT END OF TUNNEL",
                "pos": "noun",
                "definition": "A sign of hope or relief that a difficult period or ordeal is finally coming to an end (e.g. 'light at the end of the tunnel').",
                "cefr": "B2",
                "keywords": ["tunnel", "end", "end of the tunnel", "hope", "relief", "crisis", "ordeal", "finally", "weeks", "months", "hard work", "difficulty", "struggle"]
            }
        ]
    },
    "color": {
        "lemma": "color", "pos": "noun/verb", "hasDiscrepancy": True,
        "senses": [
            {
                "id": "color_a1_hue",
                "guideword": "VISUAL HUE / PIGMENT / SHADE",
                "pos": "noun",
                "definition": "Red, blue, green, yellow, or any other visual hue or pigment produced by light reflecting off an object.",
                "cefr": "A1",
                "keywords": ["red", "blue", "green", "yellow", "delicate", "bright", "vibrant", "shade", "paint", "painting", "artist", "hue", "pigment", "colorful", "dark", "pale", "canvas"]
            },
            {
                "id": "color_a1_verb",
                "guideword": "ADD COLOR / PAINT / CRAYON",
                "pos": "verb",
                "definition": "To fill in or add color to a drawing, picture, or surface using crayons, pencils, or paint.",
                "cefr": "A1",
                "keywords": ["draw", "crayon", "pencil", "picture", "coloring", "drawing", "page", "book"]
            },
            {
                "id": "color_c2_interest",
                "guideword": "INTEREST / VITALITY / CHARACTER",
                "pos": "noun",
                "definition": "Interesting or exciting details, vitality, character, or cultural flavor in an account, story, or speech (e.g. 'local color').",
                "cefr": "C2",
                "keywords": ["local", "vitality", "intensity", "character", "flavor", "anecdotes", "spice", "narrative", "story", "account"]
            }
        ]
    },
    "see": {
        "lemma": "see", "pos": "verb", "hasDiscrepancy": True,
        "senses": [
            {
                "id": "see_a1_sight",
                "guideword": "PERCEIVE BY SIGHT / NOTICE WITH EYES",
                "pos": "verb",
                "definition": "To perceive, detect, look at, or notice something with your eyes (e.g. 'I saw a bird', 'I saw a light').",
                "cefr": "A1",
                "keywords": ["eyes", "sight", "look", "watch", "notice", "spotted", "glance", "view", "vision", "visible", "bird", "light", "tunnel", "person", "sign", "finally"]
            },
            {
                "id": "see_a1_visit",
                "guideword": "VISIT / MEET PERSON / CONSULT",
                "pos": "verb",
                "definition": "To meet someone socially, visit a person, or consult a professional (e.g., 'see a doctor', 'see friends').",
                "cefr": "A1",
                "keywords": ["doctor", "friend", "dentist", "specialist", "meet", "visit", "consult", "tonight", "tomorrow"]
            },
            {
                "id": "see_a2_understand",
                "guideword": "UNDERSTAND / REALIZE / I SEE",
                "pos": "verb",
                "definition": "To understand, comprehend, or realize what someone means (e.g., 'I see what you mean', 'I see your point').",
                "cefr": "A2",
                "keywords": ["understand", "mean", "point", "what you mean", "realize", "comprehend", "now", "aha"]
            },
            {
                "id": "see_b2_deem",
                "guideword": "DEEM / REGARD AS / CONSIDER",
                "pos": "verb",
                "definition": "To regard, consider, or deem someone or something to be a certain way (e.g., 'saw fit to leave', 'saw as necessary').",
                "cefr": "B2",
                "keywords": ["fit", "proper", "necessary", "regard", "consider", "deem", "viewed as", "judged"]
            }
        ]
    }
}

# graded phrasal verbs list
PHRASAL_VERBS = {
    "come from": {"lemma": "come from", "base": "come", "particles": ["from"], "cefr": "A1", "guideword": "ORIGIN / BORN IN", "definition": "To have your home in or have been born in a particular place."},
    "get up": {"lemma": "get up", "base": "get", "particles": ["up"], "cefr": "A1", "guideword": "RISE FROM BED", "definition": "To stand up or to get out of bed after sleeping."},
    "go out": {"lemma": "go out", "base": "go", "particles": ["out"], "cefr": "A1", "guideword": "LEAVE HOME / SOCIALIZE", "definition": "To leave a room or building, especially in order to do something for entertainment."},
    "sit down": {"lemma": "sit down", "base": "sit", "particles": ["down"], "cefr": "A1", "guideword": "SEAT ONESELF", "definition": "To lower your body into a sitting position on a chair or the ground."},
    "stand up": {"lemma": "stand up", "base": "stand", "particles": ["up"], "cefr": "A1", "guideword": "RISE TO FEET", "definition": "To rise to a standing position on your feet."},
    "turn on": {"lemma": "turn on", "base": "turn", "particles": ["on"], "cefr": "A1", "guideword": "SWITCH ON / ACTIVATE", "definition": "To activate or start a machine, light, or device by using a switch."},
    "turn off": {"lemma": "turn off", "base": "turn", "particles": ["off"], "cefr": "A1", "guideword": "SWITCH OFF / DEACTIVATE", "definition": "To deactivate or stop a machine, light, or device by using a switch."},
    "wake up": {"lemma": "wake up", "base": "wake", "particles": ["up"], "cefr": "A1", "guideword": "STOP SLEEPING", "definition": "To stop sleeping or cause someone to stop sleeping."},
    "break down": {"lemma": "break down", "base": "break", "particles": ["down"], "cefr": "A2", "guideword": "STOP WORKING / VEHICLE", "definition": "If a machine or vehicle breaks down, it stops working properly."},
    "come back": {"lemma": "come back", "base": "come", "particles": ["back"], "cefr": "A2", "guideword": "RETURN TO PLACE", "definition": "To return to a place where you were before."},
    "come in": {"lemma": "come in", "base": "come", "particles": ["in"], "cefr": "A2", "guideword": "ENTER ROOM", "definition": "To enter a room or building."},
    "fill in": {"lemma": "fill in", "base": "fill", "particles": ["in"], "cefr": "A2", "guideword": "COMPLETE FORM", "definition": "To write necessary information on an official document or form."},
    "find out": {"lemma": "find out", "base": "find", "particles": ["out"], "cefr": "A2", "guideword": "DISCOVER INFORMATION", "definition": "To get or discover information about something because you want to know more."},
    "get back": {"lemma": "get back", "base": "get", "particles": ["back"], "cefr": "A2", "guideword": "RETURN HOME / RECOVER", "definition": "To return to a place or retrieve something you lost."},
    "get in": {"lemma": "get in", "base": "get", "particles": ["in"], "cefr": "A2", "guideword": "ENTER CAR / ARRIVE", "definition": "To enter a car or taxi, or arrive at a destination."},
    "get off": {"lemma": "get off", "base": "get", "particles": ["off"], "cefr": "A2", "guideword": "LEAVE BUS / TRAIN", "definition": "To leave a bus, train, aircraft, or boat."},
    "get on": {"lemma": "get on", "base": "get", "particles": ["on"], "cefr": "A2", "guideword": "BOARD BUS / TRAIN", "definition": "To board a bus, train, aircraft, or boat."},
    "get out": {"lemma": "get out", "base": "get", "particles": ["out"], "cefr": "A2", "guideword": "LEAVE CAR / ROOM", "definition": "To exit a vehicle, room, or building."},
    "give back": {"lemma": "give back", "base": "give", "particles": ["back"], "cefr": "A2", "guideword": "RETURN BORROWED ITEM", "definition": "To return something to the person who gave or lent it to you."},
    "give up": {"lemma": "give up", "base": "give", "particles": ["up"], "cefr": "A2", "guideword": "STOP TRYING / QUIT", "definition": "To stop doing something or stop trying because it is too difficult."},
    "go away": {"lemma": "go away", "base": "go", "particles": ["away"], "cefr": "A2", "guideword": "LEAVE PLACE", "definition": "To leave a place or person, or go on holiday."},
    "go back": {"lemma": "go back", "base": "go", "particles": ["back"], "cefr": "A2", "guideword": "RETURN TO PLACE", "definition": "To return to a place where you came from."},
    "grow up": {"lemma": "grow up", "base": "grow", "particles": ["up"], "cefr": "A2", "guideword": "BECOME ADULT", "definition": "To gradually change from being a child to being an adult."},
    "look after": {"lemma": "look after", "base": "look", "particles": ["after"], "cefr": "A2", "guideword": "TAKE CARE OF", "definition": "To take care of or be responsible for someone or something."},
    "look at": {"lemma": "look at", "base": "look", "particles": ["at"], "cefr": "A1", "guideword": "DIRECT EYES / INSPECT", "definition": "To turn your eyes towards someone or something in order to see them."},
    "look for": {"lemma": "look for", "base": "look", "particles": ["for"], "cefr": "A2", "guideword": "SEARCH / TRY TO FIND", "definition": "To try to find someone or something that is lost or needed."},
    "look out": {"lemma": "look out", "base": "look", "particles": ["out"], "cefr": "A2", "guideword": "BE CAREFUL / WARNING", "definition": "Used to tell someone to be careful of immediate danger."},
    "pick up": {"lemma": "pick up", "base": "pick", "particles": ["up"], "cefr": "A2", "guideword": "LIFT / COLLECT PERSON", "definition": "To lift something up from the ground or collect someone in a vehicle."},
    "put on": {"lemma": "put on", "base": "put", "particles": ["on"], "cefr": "A2", "guideword": "WEAR CLOTHES", "definition": "To dress yourself in a piece of clothing, shoes, or accessories."},
    "run away": {"lemma": "run away", "base": "run", "particles": ["away"], "cefr": "A2", "guideword": "ESCAPE / FLEE", "definition": "To leave a place or home secretly and suddenly."},
    "take off": {"lemma": "take off", "base": "take", "particles": ["off"], "cefr": "A2", "guideword": "PLANE DEPARTS / REMOVE", "definition": "If an aircraft takes off, it leaves the ground and starts flying; or to remove clothing."},
    "try on": {"lemma": "try on", "base": "try", "particles": ["on"], "cefr": "A2", "guideword": "TEST FIT OF CLOTHES", "definition": "To put on a piece of clothing to see if it fits and looks nice."},
    "turn around": {"lemma": "turn around", "base": "turn", "particles": ["around"], "cefr": "A2", "guideword": "FACE OPPOSITE DIRECTION", "definition": "To change direction so that you face the opposite way."},
    "write down": {"lemma": "write down", "base": "write", "particles": ["down"], "cefr": "A2", "guideword": "RECORD ON PAPER", "definition": "To write words on paper so that you remember them."},
    "bring up": {"lemma": "bring up", "base": "bring", "particles": ["up"], "cefr": "B1", "guideword": "RAISE CHILD / MENTION", "definition": "To care for a child until adult; or to mention a topic in conversation."},
    "call off": {"lemma": "call off", "base": "call", "particles": ["off"], "cefr": "B1", "guideword": "CANCEL EVENT", "definition": "To cancel a planned event or activity."},
    "carry on": {"lemma": "carry on", "base": "carry", "particles": ["on"], "cefr": "B1", "guideword": "CONTINUE DOING", "definition": "To continue doing something or continuing on your way."},
    "carry out": {"lemma": "carry out", "base": "carry", "particles": ["out"], "cefr": "B1", "guideword": "EXECUTE / CONDUCT TASK", "definition": "To perform or complete a task, experiment, investigation, or order."},
    "catch up": {"lemma": "catch up", "base": "catch", "particles": ["up"], "cefr": "B1", "guideword": "REACH SAME LEVEL", "definition": "To reach the same standard or stage as other people after falling behind."},
    "check in": {"lemma": "check in", "base": "check", "particles": ["in"], "cefr": "B1", "guideword": "REGISTER AT HOTEL/AIRPORT", "definition": "To show your ticket at an airport or register your arrival at a hotel."},
    "check out": {"lemma": "check out", "base": "check", "particles": ["out"], "cefr": "B1", "guideword": "LEAVE HOTEL / EXAMINE", "definition": "To leave a hotel after paying; or to examine or look at something interesting."},
    "come across": {"lemma": "come across", "base": "come", "particles": ["across"], "cefr": "B1", "guideword": "FIND BY CHANCE", "definition": "To discover or meet someone or something by chance."},
    "come out": {"lemma": "come out", "base": "come", "particles": ["out"], "cefr": "B1", "guideword": "BE PUBLISHED / RELEASED", "definition": "If a book, movie, or album comes out, it becomes available to the public."},
    "come up with": {"lemma": "come up with", "base": "come", "particles": ["up", "with"], "cefr": "B1", "guideword": "PRODUCE IDEA / PLAN", "definition": "To think of or produce an idea, answer, or solution."},
    "cut down": {"lemma": "cut down", "base": "cut", "particles": ["down"], "cefr": "B1", "guideword": "REDUCE CONSUMPTION", "definition": "To reduce the amount or quantity of something you eat, drink, or use."},
    "dress up": {"lemma": "dress up", "base": "dress", "particles": ["up"], "cefr": "B1", "guideword": "WEAR FORMAL CLOTHES", "definition": "To put on smart, formal, or costume clothing."},
    "eat out": {"lemma": "eat out", "base": "eat", "particles": ["out"], "cefr": "B1", "guideword": "DINE AT RESTAURANT", "definition": "To have a meal in a restaurant instead of at home."},
    "end up": {"lemma": "end up", "base": "end", "particles": ["up"], "cefr": "B1", "guideword": "FINISH IN SITUATION", "definition": "To finally be in a particular place, state, or situation after a series of events."},
    "figure out": {"lemma": "figure out", "base": "figure", "particles": ["out"], "cefr": "B1", "guideword": "SOLVE / UNDERSTAND", "definition": "To understand, calculate, solve, or find the answer to a problem or situation."},
    "get along with": {"lemma": "get along with", "base": "get", "particles": ["along", "with"], "cefr": "B1", "guideword": "FRIENDLY RELATIONSHIP", "definition": "To have a friendly, smooth relationship with someone."},
    "get along": {"lemma": "get along", "base": "get", "particles": ["along"], "cefr": "B1", "guideword": "MANAGE / BE FRIENDLY", "definition": "To have a good relationship, or manage to deal with a situation."},
    "give away": {"lemma": "give away", "base": "give", "particles": ["away"], "cefr": "B1", "guideword": "DONATE / REVEAL SECRET", "definition": "To supply something free of charge, or reveal confidential information."},
    "hang out": {"lemma": "hang out", "base": "hang", "particles": ["out"], "cefr": "B1", "guideword": "SPEND TIME SOCIALLY", "definition": "To spend time relaxing and enjoying oneself with friends."},
    "keep on": {"lemma": "keep on", "base": "keep", "particles": ["on"], "cefr": "B1", "guideword": "CONTINUE PERSISTENTLY", "definition": "To continue doing something persistently without stopping."},
    "look forward to": {"lemma": "look forward to", "base": "look", "particles": ["forward", "to"], "cefr": "B1", "guideword": "ANTICIPATE WITH PLEASURE", "definition": "To feel excited and pleased about something that is going to happen."},
    "look up": {"lemma": "look up", "base": "look", "particles": ["up"], "cefr": "B1", "guideword": "SEARCH IN REFERENCE", "definition": "To search for a word, number, or fact in a dictionary, phonebook, or computer."},
    "make up": {"lemma": "make up", "base": "make", "particles": ["up"], "cefr": "B1", "guideword": "INVENT STORY / RECONCILE", "definition": "To invent an explanation or story, or become friends again after an argument."},
    "pay back": {"lemma": "pay back", "base": "pay", "particles": ["back"], "cefr": "B1", "guideword": "RETURN BORROWED MONEY", "definition": "To return money that you borrowed from someone."},
    "point out": {"lemma": "point out", "base": "point", "particles": ["out"], "cefr": "B1", "guideword": "DIRECT ATTENTION TO", "definition": "To tell someone about a fact or draw their attention to something."},
    "put off": {"lemma": "put off", "base": "put", "particles": ["off"], "cefr": "B1", "guideword": "POSTPONE / DELAY", "definition": "To delay or postpone an arrangement or event until a later time."},
    "run out of": {"lemma": "run out of", "base": "run", "particles": ["out", "of"], "cefr": "B1", "guideword": "DEPLETE SUPPLY", "definition": "To use up all of a supply of something until none remains."},
    "set off": {"lemma": "set off", "base": "set", "particles": ["off"], "cefr": "B1", "guideword": "START JOURNEY", "definition": "To start on a trip or journey."},
    "set up": {"lemma": "set up", "base": "set", "particles": ["up"], "cefr": "B1", "guideword": "ESTABLISH BUSINESS/SYSTEM", "definition": "To establish, arrange, or organize a business, system, or meeting."},
    "take care of": {"lemma": "take care of", "base": "take", "particles": ["care", "of"], "cefr": "A2", "guideword": "NURTURE / HANDLE", "definition": "To protect, nurture, or manage responsibility for someone or something."},
    "take part in": {"lemma": "take part in", "base": "take", "particles": ["part", "in"], "cefr": "B1", "guideword": "PARTICIPATE IN EVENT", "definition": "To be involved in an activity or event with other people."},
    "take up": {"lemma": "take up", "base": "take", "particles": ["up"], "cefr": "B1", "guideword": "START HOBBY / OCCUPY", "definition": "To begin doing a new hobby or activity, or fill space or time."},
    "turn down": {"lemma": "turn down", "base": "turn", "particles": ["down"], "cefr": "B1", "guideword": "REFUSE OFFER / LOWER VOLUME", "definition": "To refuse or reject an invitation, offer, or request; or decrease sound."},
    "turn into": {"lemma": "turn into", "base": "turn", "particles": ["into"], "cefr": "B1", "guideword": "TRANSFORM BECOME", "definition": "To change and become someone or something different."},
    "turn up": {"lemma": "turn up", "base": "turn", "particles": ["up"], "cefr": "B1", "guideword": "ARRIVE / INCREASE VOLUME", "definition": "To arrive unexpectedly or be found; or increase the volume of sound."},
    "work out": {"lemma": "work out", "base": "work", "particles": ["out"], "cefr": "B1", "guideword": "EXERCISE / SOLVE PROBLEM", "definition": "To do physical exercises; or calculate and find a solution."},
    "account for": {"lemma": "account for", "base": "account", "particles": ["for"], "cefr": "B2", "guideword": "EXPLAIN REASON / PROPORTION", "definition": "To explain the cause of something, or constitute a specific proportion."},
    "back up": {"lemma": "back up", "base": "back", "particles": ["up"], "cefr": "B2", "guideword": "SUPPORT CLAIM / COPY DATA", "definition": "To provide evidence supporting a claim, or create a copy of electronic data."},
    "blow up": {"lemma": "blow up", "base": "blow", "particles": ["up"], "cefr": "B2", "guideword": "EXPLODE / BECOME ANGRY", "definition": "To explode or destroy with explosives; or suddenly become very angry."},
    "break out": {"lemma": "break out", "base": "break", "particles": ["out"], "cefr": "B2", "guideword": "START SUDDENLY (WAR/DISEASE)", "definition": "If something dangerous such as war, disease, or fire breaks out, it starts suddenly."},
    "bring about": {"lemma": "bring about", "base": "bring", "particles": ["about"], "cefr": "B2", "guideword": "CAUSE TO HAPPEN", "definition": "To cause something to occur or happen."},
    "call for": {"lemma": "call for", "base": "call", "particles": ["for"], "cefr": "B2", "guideword": "DEMAND / REQUIRE ACTION", "definition": "To publicly demand or require that something be done."},
    "clear up": {"lemma": "clear up", "base": "clear", "particles": ["up"], "cefr": "B2", "guideword": "EXPLAIN / WEATHER CLEARS", "definition": "To resolve a mystery or misunderstanding; or for weather to improve."},
    "close down": {"lemma": "close down", "base": "close", "particles": ["down"], "cefr": "B2", "guideword": "CEASE OPERATIONS", "definition": "If a business or factory closes down, it stops operating permanently."},
    "come round": {"lemma": "come round", "base": "come", "particles": ["round"], "cefr": "B2", "guideword": "REGAIN CONSCIOUSNESS / VISIT", "definition": "To regain consciousness after fainting, or visit someone's house."},
    "count on": {"lemma": "count on", "base": "count", "particles": ["on"], "cefr": "B2", "guideword": "RELY ON / EXPECT HELP", "definition": "To rely on someone with confidence to help you."},
    "die out": {"lemma": "die out", "base": "die", "particles": ["out"], "cefr": "B2", "guideword": "BECOME EXTINCT", "definition": "To become increasingly rare and eventually disappear completely."},
    "drop out": {"lemma": "drop out", "base": "drop", "particles": ["out"], "cefr": "B2", "guideword": "LEAVE SCHOOL / ABANDON", "definition": "To leave school, college, or a course before completing studies."},
    "get away with": {"lemma": "get away with", "base": "get", "particles": ["away", "with"], "cefr": "B2", "guideword": "ESCAPE PUNISHMENT", "definition": "To succeed in doing something wrong or illegal without being punished."},
    "get over": {"lemma": "get over", "base": "get", "particles": ["over"], "cefr": "B2", "guideword": "RECOVER FROM ILLNESS/SHOCK", "definition": "To return to your usual state of health or happiness after an illness or shock."},
    "give in": {"lemma": "give in", "base": "give", "particles": ["in"], "cefr": "B2", "guideword": "SURRENDER / YIELD", "definition": "To stop resisting or arguing and accept someone's demands."},
    "hand in": {"lemma": "hand in", "base": "hand", "particles": ["in"], "cefr": "B2", "guideword": "SUBMIT ASSIGNMENT/NOTICE", "definition": "To deliver homework, a report, or resignation to an authority."},
    "keep up with": {"lemma": "keep up with", "base": "keep", "particles": ["up", "with"], "cefr": "B2", "guideword": "MAINTAIN PACE", "definition": "To move or develop at the same high speed as someone or something."},
    "look down on": {"lemma": "look down on", "base": "look", "particles": ["down", "on"], "cefr": "B2", "guideword": "CONSIDER INFERIOR", "definition": "To think that someone is less important or of lower status than yourself."},
    "look into": {"lemma": "look into", "base": "look", "particles": ["into"], "cefr": "B2", "guideword": "INVESTIGATE COMPLAINT", "definition": "To examine, investigate, or research the facts about a problem or crime."},
    "pass away": {"lemma": "pass away", "base": "pass", "particles": ["away"], "cefr": "B2", "guideword": "DIE (POLITE)", "definition": "Polite euphemism meaning to die."},
    "put up with": {"lemma": "put up with", "base": "put", "particles": ["up", "with"], "cefr": "B2", "guideword": "TOLERATE UNPLEASANT", "definition": "To accept an unpleasant situation or person without complaining."},
    "rule out": {"lemma": "rule out", "base": "rule", "particles": ["out"], "cefr": "B2", "guideword": "EXCLUDE POSSIBILITY", "definition": "To decide that something is impossible or not suitable."},
    "run into": {"lemma": "run into", "base": "run", "particles": ["into"], "cefr": "B2", "guideword": "MEET UNEXPECTEDLY / COLLIDE", "definition": "To meet someone by chance, or collide with something accidentally."},
    "take after": {"lemma": "take after", "base": "take", "particles": ["after"], "cefr": "B2", "guideword": "RESEMBLE PARENT", "definition": "To resemble an older family member in appearance or character."},
    "take over": {"lemma": "take over", "base": "take", "particles": ["over"], "cefr": "B2", "guideword": "ASSUME CONTROL", "definition": "To take control of a company, position, or responsibility."},
    "wear out": {"lemma": "wear out", "base": "wear", "particles": ["out"], "cefr": "B2", "guideword": "EXHAUST / DAMAGE BY USE", "definition": "To make someone extremely tired, or become unusable through long wear."},
    "boil down to": {"lemma": "boil down to", "base": "boil", "particles": ["down", "to"], "cefr": "C1", "guideword": "ESSENTIAL REASON", "definition": "To be the primary, most essential reason or summary for a complex situation."},
    "clamp down on": {"lemma": "clamp down on", "base": "clamp", "particles": ["down", "on"], "cefr": "C1", "guideword": "SUPPRESS / STRICT MEASURES", "definition": "To take severe or official action to stop crime or illegal activities."},
    "crack down on": {"lemma": "crack down on", "base": "crack", "particles": ["down", "on"], "cefr": "C1", "guideword": "ENFORCE STRINGENT LAWS", "definition": "To enforce stringent administrative measures against violators."},
    "iron out": {"lemma": "iron out", "base": "iron", "particles": ["out"], "cefr": "C1", "guideword": "RESOLVE DIFFICULTIES", "definition": "To resolve remaining minor difficulties, disputes, or inconsistencies in negotiations."},
    "phase out": {"lemma": "phase out", "base": "phase", "particles": ["out"], "cefr": "C1", "guideword": "GRADUALLY DISCONTINUE", "definition": "To stop using, producing, or providing something in gradual stages."},
    "root out": {"lemma": "root out", "base": "root", "particles": ["out"], "cefr": "C1", "guideword": "ERADICATE CORRUPTION", "definition": "To find and eliminate the underlying source of corruption, crime, or problems."},
    "single out": {"lemma": "single out", "base": "single", "particles": ["out"], "cefr": "C1", "guideword": "CHOOSE FOR SPECIAL CRITICISM", "definition": "To choose one person or thing from a group for special attention or criticism."},
    "spell out": {"lemma": "spell out", "base": "spell", "particles": ["out"], "cefr": "C1", "guideword": "EXPLAIN IN DETAIL", "definition": "To explain something in complete, explicit, and meticulous detail."},
    "tap into": {"lemma": "tap into", "base": "tap", "particles": ["into"], "cefr": "C1", "guideword": "EXPLOIT RESOURCE / POTENTIAL", "definition": "To utilize, access, or exploit a plentiful resource, market, or talent pool."}
}

ACADEMIC_OVERLAY = {
    "paradigm": {"lemma": "paradigm", "pos": "noun", "cefr": "C1"},
    "anomaly": {"lemma": "anomaly", "pos": "noun", "cefr": "C2"},
    "juxtapose": {"lemma": "juxtapose", "pos": "verb", "cefr": "C2"},
    "quintessential": {"lemma": "quintessential", "pos": "adjective", "cefr": "C2"},
    "cacophony": {"lemma": "cacophony", "pos": "noun", "cefr": "C2"},
    "antithetical": {"lemma": "antithetical", "pos": "adjective", "cefr": "C2"},
    "ephemeral": {"lemma": "ephemeral", "pos": "adjective", "cefr": "C1"},
    "ubiquitous": {"lemma": "ubiquitous", "pos": "adjective", "cefr": "C1"},
    "dilemma": {"lemma": "dilemma", "pos": "noun", "cefr": "B2"},
    "epistemic": {"lemma": "epistemic", "pos": "adjective", "cefr": "C2"},
    "rigorous": {"lemma": "rigorous", "pos": "adjective", "cefr": "C1"},
    "critique": {"lemma": "critique", "pos": "noun", "cefr": "C1"},
    "antibiotic": {"lemma": "antibiotic", "pos": "noun", "cefr": "B2"},
    "gelato": {"lemma": "gelato", "pos": "noun", "cefr": "A2"},
    "startup": {"lemma": "startup", "pos": "noun", "cefr": "B2"},
    "tech": {"lemma": "tech", "pos": "noun", "cefr": "B1"},
    "disclose": {"lemma": "disclose", "pos": "verb", "cefr": "C1"},
    "controlling": {"lemma": "controlling", "pos": "adjective", "cefr": "B2"},
    "italian": {"lemma": "italian", "pos": "adjective", "cefr": "A1"},
    "kantian": {"lemma": "kantian", "pos": "adjective", "cefr": "C2"}
}

def generate_inflections(words):
    PROTECTED_NOUNS = {
        "evening", "morning", "building", "painting", "meeting",
        "feeling", "training", "meaning", "ceiling", "drawing",
        "clothing", "gathering", "warning", "opening", "saving", 
        "belonging", "understanding", "setting", "surroundings", "wedding"
    }

    inflections = {}
    for w in words:
        if len(w) <= 2: continue
        if w.endswith("y") and len(w) > 3 and w[-2] not in "aeiou":
            inflections[w[:-1] + "ies"] = w
        elif w.endswith(("s", "sh", "ch", "x", "z")):
            inflections[w + "es"] = w
        else:
            cand_s = w + "s"
            if cand_s not in words:
                inflections[cand_s] = w

        if w in {"see", "flee", "be", "do", "go", "have"}:
            pass
        elif w.endswith("e"):
            cand_d = w + "d"
            if cand_d not in words:
                inflections[cand_d] = w
            cand_ing = w[:-1] + "ing"
            if cand_ing not in words and cand_ing not in PROTECTED_NOUNS:
                inflections[cand_ing] = w
        else:
            cand_ed = w + "ed"
            if cand_ed not in words:
                inflections[cand_ed] = w
            cand_ing = w + "ing"
            if cand_ing not in words and cand_ing not in PROTECTED_NOUNS:
                inflections[cand_ing] = w

    # load irregular forms from wordnet exception lists
    wn_irregulars = fetch_wordnet_irregulars()
    inflections.update(wn_irregulars)

    # additional irregular entries not found in standard tables
    irregulars = {
        "ran": "run", "running": "run", "runs": "run",
        "swam": "swim", "swum": "swim",
        "drank": "drink", "drunk": "drink",
        "wrote": "write", "written": "write",
        "ate": "eat", "eaten": "eat",
        "went": "go", "gone": "go",
        "saw": "see", "seen": "see",
        "took": "take", "taken": "take",
        "gave": "give", "given": "give",
        "spoke": "speak", "spoken": "speak",
        "broke": "break", "broken": "break",
        "flew": "fly", "flown": "fly",
        "drove": "drive", "driven": "drive",
        "knew": "know", "known": "know",
        "thought": "think",
        "bought": "buy",
        "brought": "bring",
        "caught": "catch",
        "felt": "feel",
        "kept": "keep",
        "slept": "sleep",
        "left": "leave",
        "met": "meet",
        "sat": "sit",
        "won": "win",
        "held": "hold",
        "stood": "stand",
        "understood": "understand",
        "children": "child",
        "men": "man",
        "women": "woman",
        "teeth": "tooth",
        "feet": "foot",
        "mice": "mouse",
        "people": "person",
        "better": "good",
        "best": "good",
        "worse": "bad",
        "worst": "bad",
        "further": "far",
        "furthest": "far",
        "wore": "wear",
        "worn": "wear",
        "taught": "teach",
        "paradigms": "paradigm",
        "juxtaposed": "juxtapose",
        "juxtaposing": "juxtapose",
        "doctors": "doctor",
        "disclosed": "disclose",
        "antibiotics": "antibiotic",
        "anomalies": "anomaly",
        "dilemmas": "dilemma",
        "epistemic": "epistemic",
        "criteria": "criterion",
        "criterion": "criterion",
        "favorite": "favourite",
        "favorites": "favourite",
        "neighbor": "neighbour",
        "neighbors": "neighbour",
        "neighborhood": "neighbourhood",
        "neighborhoods": "neighbourhood",
        "behavior": "behaviour",
        "flavor": "flavour",
        "flavors": "flavour",
        "honor": "honour",
        "humor": "humour",
        "theater": "theatre",
        "theaters": "theatre",
        "center": "centre",
        "centers": "centre",
        "meter": "metre",
        "meters": "metre",
        "defense": "defence",
        "offense": "offence"
    }
    inflections.update(irregulars)

    # keep standalone nouns distinct from their base verbs
    for pn in PROTECTED_NOUNS:
        inflections.pop(pn, None)

    return inflections

def main():
    words = fetch_and_parse()
    
    # add academic vocabulary list items
    for k, v in ACADEMIC_OVERLAY.items():
        if k not in words:
            words[k] = v

    # wordnet cefr polysemy dataset
    wn_poly = fetch_wordnet_polysemy()

    # oxford graded senses dataset
    oxford_poly = fetch_oxford_polysemy()

    # merge hierarchy where curated entries take highest priority
    combined_poly = {}
    combined_poly.update(wn_poly)
    combined_poly.update(oxford_poly)
    combined_poly.update(CURATED_POLYSEMOUS_SENSES)

    # normalize parts of speech to standard labels
    for word_obj in combined_poly.values():
        for sense in word_obj.get("senses", []):
            if not sense.get("pos"):
                gw = sense.get("guideword", "").lower()
                if gw.startswith("noun"): sense["pos"] = "noun"
                elif gw.startswith("verb"): sense["pos"] = "verb"
                elif gw.startswith("adj"): sense["pos"] = "adjective"
                elif gw.startswith("adv"): sense["pos"] = "adverb"
                elif gw.startswith("conj"): sense["pos"] = "conjunction"
                else: sense["pos"] = word_obj.get("pos", "").split("/")[0].strip().lower()

    # drop polysemous words from the monosemous dictionary to avoid duplicate keys
    for p in combined_poly:
        if p in words:
            del words[p]

    inflections = generate_inflections(list(words.keys()) + list(combined_poly.keys()))
    total_senses = sum(len(v["senses"]) for v in combined_poly.values())

    compiled = {
        "metadata": {
            "source": "CEFR-J 1.5, Octanove C1-C2, Oxford 5000, CEFR-Annotated WordNet (star092304 / Kikuchi et al.), and Curated Corpus",
            "total_headwords": len(words) + len(combined_poly),
            "polysemous_words": len(combined_poly),
            "total_polysemous_senses": total_senses,
            "phrasal_verbs": len(PHRASAL_VERBS),
            "total_inflections": len(inflections)
        },
        "polysemous": combined_poly,
        "monosemous": words,
        "phrasal_verbs": PHRASAL_VERBS,
        "inflections": inflections
    }

    os.makedirs("data", exist_ok=True)
    with open(OUTPUT_JS, "w", encoding="utf-8") as f:
        f.write("const CEFR_LEXICON = " + json.dumps(compiled, indent=2) + ";\n\nif (typeof window !== 'undefined') window.CEFR_LEXICON = CEFR_LEXICON;\nif (typeof globalThis !== 'undefined') globalThis.CEFR_LEXICON = CEFR_LEXICON;\nif (typeof module !== 'undefined' && module.exports) module.exports = { CEFR_LEXICON };\n")
    
    file_size_kb = os.path.getsize(OUTPUT_JS) // 1024
    print(f"\n==========================================")
    print(f"SUCCESS: Saved Lexicon to {OUTPUT_JS} ({file_size_kb} KB)")
    print(f"Total headwords: {len(words) + len(combined_poly)}")
    print(f"Polysemous words: {len(combined_poly)} (Total senses: {total_senses})")
    print(f"Phrasal verbs: {len(PHRASAL_VERBS)}")
    print(f"Total inflections: {len(inflections)}")
    print(f"==========================================\n")

if __name__ == "__main__":
    main()
